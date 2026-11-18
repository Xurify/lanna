/**
 * Story voices (reading, 2026-10-28): which TTS voice reads
 * which part of a story, so a dialogue sounds like two people and not
 * one flat narrator. Xurify: "the voice for these stories should be
 * based on the story — it doesn't flow correctly because of the way the
 * speaker sounds."
 *
 * ElevenLabs (tier 1) can read Slovak with any multilingual voice, so a
 * story's cast is drawn from a small palette of its premade voices by
 * gender and age; the narrator keeps the slovak.wiki voice, which no
 * character uses. A recurring name (Martin) always gets the same voice: the
 * choice hashes the name. The palette is checked against the account's
 * voice list once an hour, so a voice the account cannot use falls back
 * to the narrator rather than failing the clip. Edge (tier 2) has one
 * Slovak voice per gender, so there characters only differ by gender.
 *
 * The audio cache key stays (language, voice, text): a line read by a
 * voice is paid for once and kept under data/audio/sk/<voice>/.
 */

import { createHash } from "node:crypto";
import type { StoryCharacter } from "../core/reading.ts";
import { keyValue } from "./keys.ts";

interface VoiceInfo {
	id: string;
	label: string;
	gender: "f" | "m";
	age: "child" | "young" | "adult" | "old";
}

/** The slovak.wiki narrator ("Slovak Wiki Dictionary Neutral"). */
export const NARRATOR_VOICE = "YJsJ2Mt3VRr0gCiTY6DA";

/** ElevenLabs premade voices that read Slovak well with the multilingual
 *  models: the default set every account lists (read from /v1/voices on
 *  2026-11-17; the older Rachel, Josh, Elli set was retired and answers
 *  404). `availableVoiceIds` trims the palette to what the account lists. */
export const VOICE_PALETTE: readonly VoiceInfo[] = [
	{ id: "cgSgspJ2msm6clMCkdW9", label: "Jessica", gender: "f", age: "young" },
	{ id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura", gender: "f", age: "young" },
	{ id: "hpp4J3VqNfWAUOO0d1Us", label: "Bella", gender: "f", age: "adult" },
	{ id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice", gender: "f", age: "adult" },
	{ id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily", gender: "f", age: "adult" },
	{ id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah", gender: "f", age: "old" },
	{ id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda", gender: "f", age: "old" },
	{ id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam", gender: "m", age: "young" },
	{ id: "bIHbv24MWmeRgasZH58o", label: "Will", gender: "m", age: "young" },
	{ id: "pNInz6obpgDQGcFmaJgB", label: "Adam", gender: "m", age: "adult" },
	{ id: "iP95p4xoKVk53GoZ742B", label: "Chris", gender: "m", age: "adult" },
	{ id: "cjVigY5qzO86Huf0OWal", label: "Eric", gender: "m", age: "adult" },
	{ id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel", gender: "m", age: "adult" },
	{ id: "pqHfZKP75CvOlQylNhV4", label: "Bill", gender: "m", age: "old" },
	{ id: "JBFqnCBsd6RMkjVDRZzb", label: "George", gender: "m", age: "old" },
	{ id: "SOYHLrjzK2X1ezoPC6cr", label: "Harry", gender: "m", age: "child" },
];

let listed: { at: number; ids: Set<string> | null } | null = null;

/** The ids the ElevenLabs account can use, cached an hour; null when the
 *  list could not be fetched (no key, offline), which means "trust the
 *  palette". */
export async function availableVoiceIds(): Promise<Set<string> | null> {
	if (listed && Date.now() - listed.at < 3_600_000) return listed.ids;
	const key = keyValue("ELEVENLABS_API_KEY");
	if (!key) return null;
	try {
		const res = await fetch("https://api.elevenlabs.io/v1/voices", {
			headers: { "xi-api-key": key },
			signal: AbortSignal.timeout(8_000),
		});
		if (!res.ok) throw new Error(String(res.status));
		const body = (await res.json()) as { voices?: Array<{ voice_id?: string }> };
		const ids = new Set((body.voices ?? []).map((v) => v.voice_id).filter((v): v is string => !!v));
		listed = { at: Date.now(), ids };
		return ids;
	} catch {
		listed = { at: Date.now(), ids: null };
		return null;
	}
}

function hashOf(name: string): number {
	return createHash("sha1").update(name.normalize("NFC").toLocaleLowerCase()).digest().readUInt32BE(0);
}

/** The voice for a character: same gender and age when the palette has
 *  one, else same gender; chosen by the name's hash so Martin is always
 *  Martin. Two characters of a story never share a voice while the palette
 *  allows. */
export function assignVoices(
	cast: readonly StoryCharacter[],
	available: ReadonlySet<string> | null = null,
): StoryCharacter[] {
	const palette = available ? VOICE_PALETTE.filter((v) => available.has(v.id)) : [...VOICE_PALETTE];
	const used = new Set<string>();
	return cast.map((c) => {
		const same = palette.filter((v) => v.gender === c.gender && v.age === c.age && !used.has(v.id));
		const gender = palette.filter((v) => v.gender === c.gender && !used.has(v.id));
		const any = palette.filter((v) => !used.has(v.id));
		const pool = same.length ? same : gender.length ? gender : any;
		if (pool.length === 0) return { ...c, voice: NARRATOR_VOICE };
		const pick = pool[hashOf(c.name) % pool.length]!;
		used.add(pick.id);
		return { ...c, voice: pick.id };
	});
}
