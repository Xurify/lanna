/**
 * Zvuk, the sound step (docs/plans/chapter-arc.md phase 7). One vowel or
 * consonant contrast per chapter, taught the way the learner's ear is
 * trained first: a short listening check on the two twins, then shadowing —
 * the learner says each verified line after the model, and the line is
 * scored by the same clarity score Speak uses (src/core/pronounce.ts). The
 * data is curriculum/slovak/sounds.json (authored, not generated); this
 * module is the pure machinery on top of it.
 *
 * The timing comes from Kjellin's tutorial (docs/research/shadowing.md): a
 * model of about two seconds, a pause of 600 to 800 milliseconds for the
 * learner to answer, several rounds of the same line. The listening check
 * is the only place the twins meet, and it is capped at four items (Kjellin
 * warns against drilling look-alikes in pairs once they are automated).
 *
 * Pure and browser-safe: the JSON is bundled, no fs.
 */

import soundsJson from "../../curriculum/slovak/sounds.json";
import { LANGUAGE_IDS, type LanguageId } from "./language.ts";
import { PRON_CLEAR } from "./pronounce.ts";

export interface SoundTwin {
	/** The lexicon entry this form comes from (its examples are the verified lines). */
	slug: string;
	/** The Slovak form, as it is written. */
	sk: string;
	/** A short English gloss for the twin. */
	en: string;
}

export interface SoundDef {
	id: string;
	/** The chapter that teaches the sound (its last step before the exam). */
	chapter: string;
	title: string;
	/** One English line about what changes meaning, shown after a miss. */
	rule: string;
	/** One bridge line, shown after a miss. */
	bridge: string;
	twins: [SoundTwin, SoundTwin];
	/** Shadow lines: verified lexicon examples, each holding exactly one twin. */
	lines: string[];
}

/** How long the learner has to answer after the model line ends (Kjellin: 600–800 ms). */
export const SHADOW_GAP_MS = 700;
/** The most a single answer may run before the recorder stops by itself. */
export const SHADOW_MAX_MS = 6_000;
/** Tries at one line before it is left and marked "not yet". */
export const SHADOW_TRIES = 3;
/** The listening check: this many items, half on each twin. */
export const LISTEN_ITEMS = 4;
/** A line may have at most this many words: about two seconds of speech. */
export const SHADOW_MAX_WORDS = 6;

const SOUNDS_BY_LANGUAGE: Partial<Record<LanguageId, SoundDef[]>> = {
	slovak: (soundsJson as unknown as { sounds: SoundDef[] }).sounds,
};

export function getSoundsForLanguage(lang: string = "slovak"): SoundDef[] {
	const known = LANGUAGE_IDS.find((id) => id === lang);
	return known ? (SOUNDS_BY_LANGUAGE[known] ?? []) : [];
}

export function getSound(lang: string, id: string): SoundDef | undefined {
	return getSoundsForLanguage(lang).find((s) => s.id === id);
}

/** Levenshtein distance on lowercased characters. An accent counts as one
 *  character, so á against a is one step: the length of the vowel. */
export function soundDistance(a: string, b: string): number {
	const x = [...a.toLocaleLowerCase("sk-SK")];
	const y = [...b.toLocaleLowerCase("sk-SK")];
	let prev: number[] = Array.from({ length: y.length + 1 }, (_, j) => j);
	for (let i = 1; i <= x.length; i++) {
		const cur: number[] = [i];
		for (let j = 1; j <= y.length; j++) {
			const sub = (prev[j - 1] ?? 0) + (x[i - 1] === y[j - 1] ? 0 : 1);
			cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, sub);
		}
		prev = cur;
	}
	return prev[y.length] ?? 0;
}

/** The twin a line holds, when exactly one of the two forms appears in it
 *  (a line that holds both, or neither, teaches nothing about the sound). */
export function twinIn(line: string, def: SoundDef): SoundTwin | null {
	const low = line.toLocaleLowerCase("sk-SK");
	const hits = def.twins.filter((t) => low.includes(t.sk.toLocaleLowerCase("sk-SK")));
	return hits.length === 1 ? (hits[0] ?? null) : null;
}

/** The drop rule (as E11 and E24 use it): what is wrong with a sound, or
 *  nothing. `examplesOf` returns the verified example sentences of a lexicon
 *  entry, or undefined when the entry is missing. */
export function checkSound(def: SoundDef, examplesOf: (slug: string) => readonly string[] | undefined): string[] {
	const reasons: string[] = [];
	const [first, second] = def.twins;
	if (def.twins.length !== 2) reasons.push("needs exactly two twins");
	else if (soundDistance(first.sk, second.sk) !== 1) reasons.push(`${first.sk} and ${second.sk} do not differ in exactly one sound`);
	for (const t of def.twins) {
		if (examplesOf(t.slug) === undefined) reasons.push(`${t.slug} is not in the lexicon`);
	}
	if (def.lines.length < 2) reasons.push("needs at least two shadow lines");
	for (const line of def.lines) {
		const twin = twinIn(line, def);
		if (!twin) {
			reasons.push(`"${line}" does not hold exactly one of the twins`);
			continue;
		}
		if (line.split(/\s+/).length > SHADOW_MAX_WORDS) reasons.push(`"${line}" is longer than ${SHADOW_MAX_WORDS} words`);
		const verified = examplesOf(twin.slug);
		if (verified && !verified.includes(line)) reasons.push(`"${line}" is not a verified example of ${twin.slug}`);
	}
	return reasons;
}

/** The listening check's words: two of each twin, in an order the caller's
 *  random source decides (Fisher–Yates). */
export function listenOrder(def: SoundDef, rand: () => number = Math.random): string[] {
	const words: string[] = [];
	for (let i = 0; i < LISTEN_ITEMS; i++) words.push(i % 2 === 0 ? def.twins[0].sk : def.twins[1].sk);
	for (let i = words.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		const held = words[i] ?? "";
		words[i] = words[j] ?? "";
		words[j] = held;
	}
	return words;
}

/** A shadowed line counts when its clarity score reaches the same bar a
 *  Speak line does (PRON_CLEAR). The thresholds are not changed here. */
export function shadowVerdict(overall: number): "clear" | "again" {
	return overall >= PRON_CLEAR ? "clear" : "again";
}
