/**
 * slovak.wiki's own clips (curriculum/<profile>/wiki-audio.json, exported by
 * scripts/export-slovakwiki-audio.mjs). A dictionary word or example
 * sentence is fetched from audio.slovak.wiki once, kept under
 * <data>/audio/sk/slovak-wiki/ like any other clip, and never paid for.
 * Text with no wiki clip falls through to the synthesis cascade (tts.ts).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { PATHS } from "../../config.ts";
import { foldDiacritics } from "../core/language.ts";
import { audioKey, findAudioClip, storeAudioClip } from "../store/corpus.ts";

const WIKI_VOICE = "slovak-wiki";

interface WikiAudio {
	base: string;
	clips: Map<string, { kind: string; hash: string }>;
	/** diacritic-folded text → clip, only where the fold is unambiguous. */
	folded: Map<string, { kind: string; hash: string } | null>;
}

const loaded = new Map<string, WikiAudio | null>();

function load(profile: string): WikiAudio | null {
	if (loaded.has(profile)) return loaded.get(profile)!;
	let wiki: WikiAudio | null = null;
	try {
		const raw = JSON.parse(fs.readFileSync(path.join(PATHS.curriculum, profile, "wiki-audio.json"), "utf-8")) as { base: string; clips: Record<string, { kind: string; hash: string }> };
		const clips = new Map(Object.entries(raw.clips));
		const folded = new Map<string, { kind: string; hash: string } | null>();
		for (const [text, clip] of clips) {
			const key = foldDiacritics(text).toLowerCase();
			folded.set(key, folded.has(key) ? null : clip);
		}
		wiki = { base: raw.base, clips, folded };
	} catch {
		wiki = null;
	}
	loaded.set(profile, wiki);
	return wiki;
}

/** The wiki clip for a text: exact first, then ignoring accents (a sentence
 *  that lost its diacritics on the way still finds its recording). */
function find(wiki: WikiAudio, text: string) {
	const t = text.normalize("NFC").trim();
	return wiki.clips.get(t) ?? wiki.folded.get(foldDiacritics(t).toLowerCase()) ?? null;
}

function wikiAudioKey(lang: string, text: string): string {
	return audioKey(lang, WIKI_VOICE, text);
}

/** A kept wiki clip, downloading it on first use; null when the wiki has no
 *  clip for this text or the download fails. */
export async function wikiClip(profile: string, lang: string, text: string): Promise<{ file: string } | null> {
	const wiki = load(profile);
	if (!wiki) return null;
	const key = wikiAudioKey(lang, text);
	const hit = findAudioClip(key);
	if (hit) return { file: hit.absolute };
	const clip = find(wiki, text);
	if (!clip) return null;
	try {
		const res = await fetch(`${wiki.base}/${clip.kind}/${clip.hash}.mp3`, { signal: AbortSignal.timeout(15_000) });
		if (!res.ok) return null;
		const data = Buffer.from(await res.arrayBuffer());
		if (data.length === 0) return null;
		const stored = storeAudioClip({ key, lang, voice: WIKI_VOICE, tier: "slovak-wiki", text, ext: "mp3", data });
		return { file: stored.absolute };
	} catch (err) {
		console.warn("[tts] wiki clip failed, falling through:", err instanceof Error ? err.message : err);
		return null;
	}
}
