/**
 * Clips ElevenLabs already made for words the app ships (the Sound guide),
 * kept in the public `lanna-public` R2 bucket and listed in
 * curriculum/<profile>/sound-audio.json (written by scripts/push-sound-audio.ts).
 * A word is downloaded once and kept in the audio library where a clip
 * ElevenLabs made here would be, so an install with no key plays the same
 * voice and one with a key does not pay for it again.
 *
 * Public access on R2 is for a whole bucket
 * (developers.cloudflare.com/r2/buckets/public-buckets), so `lanna-public`
 * holds only audio of shipped curriculum text and the private `lanna` bucket
 * is for everything else.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { PATHS } from "../../config.ts";
import { processWide } from "../core/process-wide.ts";
import { audioKey, findAudioClip, setAsideAudioClip, storeAudioClip } from "../store/corpus.ts";

export interface SharedAudioManifest {
	base: string;
	voice: string;
	clips: Record<string, { object: string; model: string }>;
}

export function sharedAudioFile(profile: string): string {
	return path.join(PATHS.curriculum, profile, "sound-audio.json");
}

const loaded = processWide("sharedAudio", () => new Map<string, SharedAudioManifest | null>());

function load(profile: string): SharedAudioManifest | null {
	if (loaded.has(profile)) return loaded.get(profile)!;
	let manifest: SharedAudioManifest | null = null;
	try {
		manifest = JSON.parse(fs.readFileSync(sharedAudioFile(profile), "utf-8")) as SharedAudioManifest;
	} catch {
		manifest = null;
	}
	loaded.set(profile, manifest);
	return manifest;
}

/** The shared clip for a word in the manifest's voice, downloaded and kept; null when there is none. */
export async function sharedClip(
	profile: string,
	lang: string,
	voice: string,
	text: string,
): Promise<{ file: string } | null> {
	const manifest = load(profile);
	const clip = manifest?.voice === voice ? manifest.clips[text.normalize("NFC").trim()] : undefined;
	if (!manifest || !clip) return null;
	try {
		const res = await fetch(`${manifest.base}/${clip.object}`, { signal: AbortSignal.timeout(15_000) });
		if (!res.ok) return null;
		const data = Buffer.from(await res.arrayBuffer());
		if (data.length === 0) return null;
		const key = audioKey(lang, voice, text);
		const replaced = findAudioClip(key);
		if (replaced) setAsideAudioClip(replaced);
		const stored = storeAudioClip({ key, lang, voice, tier: "elevenlabs", model: clip.model, text, ext: "mp3", data });
		return { file: stored.absolute };
	} catch (err) {
		console.warn("[tts] shared clip failed, falling through:", err instanceof Error ? err.message : err);
		return null;
	}
}
