/**
 * Today's line (LangHarness, 2026-11-05; docs/research/creator-hooks.md,
 * proposal 1). One real sentence, a little above the learner's level, is
 * played with no text in the morning. The learner types what they caught.
 * Once they have practiced that day, the same sentence plays again and the
 * second score is set beside the first: the change between the two is the
 * measure, and nothing is scored as a grade.
 *
 * "A little above the level" is one or two words the learner has not met,
 * each with a gloss, in a sentence of five to twelve words. Nothing here
 * calls a model: the sentence comes from the dictionary's verified examples,
 * and the audio is the shared Listen audio (src/server/line.ts).
 *
 * Pure and browser-safe.
 */

import { exampleText, type LexiconEntry } from "./review.ts";
import { rng, shuffle } from "./lesson.ts";
import { judgeSentence, type ListenLookup } from "./listen.ts";
import { alignWords, listenWords } from "./listen-analysis.ts";

export const LINE_MIN_WORDS = 5;
export const LINE_MAX_WORDS = 12;
export const LINE_NEW_MIN = 1;
export const LINE_NEW_MAX = 2;
/** The same sentence is not picked again within this many days. */
export const LINE_REPEAT_DAYS = 14;

export interface LineWord {
	text: string;
	gloss: string;
}

export interface LineItem {
	/** "<slug>#<exampleIndex>", the same id Listen and the deck use. */
	id: string;
	slug: string;
	sentence: string;
	translation: string;
	/** Words counted the way Listen counts them (numbers are not words). */
	words: number;
	newWords: LineWord[];
}

/** One hearing as the log keeps it (src/store/line.ts). */
export interface LineRecord {
	day: string;
	phase: "morning" | "evening";
	itemId: string;
	sentence: string;
	translation: string;
	newWords: LineWord[];
	typed: string;
	words: number;
	caught: number;
	/** Times the sentence was played, the first play included. */
	plays: number;
	/** Active milliseconds on the page, capped by the client. */
	activeMs?: number;
	at: string;
}

export type LineHearing = LineHearingSummary;

export interface LineDay {
	day: string;
	morning: LineHearing | null;
	evening: LineHearing | null;
}

/** What the line page and the Today card read: the day's sentence (played, and
 *  not shown until answered), both hearings, and the last fourteen days. */
export interface LineState {
	day: string;
	item: { id: string; sentence: string; translation: string; words: number; newWords: LineWord[] } | null;
	morning: LineRecord | null;
	evening: LineRecord | null;
	/** The learner has practiced today, so the evening replay may be heard. */
	eveningOpen: boolean;
	/** The last fourteen days, oldest first. */
	history: LineDay[];
}

/** A stable seed for a language and a day, so the day's line does not change
 *  when the page is reloaded (FNV-1a over the key). */
export function lineSeed(language: string, day: string): number {
	let h = 2166136261;
	for (const ch of `${language}|${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
	return h >>> 0;
}

/** The first sentence, in a seeded order, that has a translation, five to
 *  twelve words and one or two glossed words the learner does not know.
 *  Returns null when the dictionary has none (the page then says so). */
export function pickLine(entries: readonly LexiconEntry[], lookup: ListenLookup, opts: { seed: number; recent?: ReadonlySet<string>; scan?: number }): LineItem | null {
	const rand = rng(opts.seed);
	const scan = opts.scan ?? 4000;
	const order = shuffle(
		entries.filter((e) => e.examples.some((x) => x.en)),
		rand,
	);
	let looked = 0;
	for (const entry of order) {
		const indexes = shuffle(
			entry.examples.flatMap((x, i) => (x.en && !x.rejected ? [i] : [])),
			rand,
		);
		for (const i of indexes) {
			const id = `${entry.slug}#${i}`;
			if (opts.recent?.has(id)) continue;
			if (++looked > scan) return null;
			const ex = entry.examples[i]!;
			const sentence = exampleText(ex);
			const judged = judgeSentence(sentence, lookup);
			if (judged.words < LINE_MIN_WORDS || judged.words > LINE_MAX_WORDS) continue;
			if (judged.stretch.length < LINE_NEW_MIN || judged.stretch.length > LINE_NEW_MAX) continue;
			if (!judged.stretch.every((w) => w.gloss)) continue;
			return {
				id,
				slug: entry.slug,
				sentence,
				translation: ex.en!,
				words: judged.words,
				newWords: judged.stretch.map((w) => ({ text: w.text, gloss: w.gloss })),
			};
		}
	}
	return null;
}

export interface LineMark {
	word: string;
	caught: boolean;
	/** Right word, missing accent: shown apart, not counted as caught. */
	almost: boolean;
}

export interface LineScore {
	words: number;
	caught: number;
	marks: LineMark[];
}

const unaccented = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

/** Score what was typed against the sentence that was played. A word is caught
 *  when it is typed exactly (case and punctuation are not graded). A word typed
 *  without its accents is marked "almost" and is not counted as caught. */
export function scoreLine(sentence: string, typed: string): LineScore {
	const target = listenWords(sentence);
	const given = listenWords(typed);
	const marks: LineMark[] = [];
	for (const op of alignWords(target, given)) {
		if (op.op === "match") marks.push({ word: op.target!, caught: true, almost: false });
		else if (op.op === "sub") marks.push({ word: op.target!, caught: false, almost: unaccented(op.target!) === unaccented(op.given!) });
		else if (op.op === "del") marks.push({ word: op.target!, caught: false, almost: false });
	}
	return { words: target.length, caught: marks.filter((m) => m.caught).length, marks };
}

/** The first day of the window a repeat is checked against: LINE_REPEAT_DAYS
 *  days ending on the day given, inclusive. */
export function repeatWindowStart(day: string): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - (LINE_REPEAT_DAYS - 1));
	return d.toISOString().slice(0, 10);
}

export interface LineHearingSummary {
	caught: number;
	words: number;
}

export interface LineCardInput {
	hasLine: boolean;
	morning: LineHearingSummary | null;
	evening: LineHearingSummary | null;
	eveningOpen: boolean;
}

/** How the row on Today reads: idle before the morning hearing or while the
 *  evening waits for practice, open when the evening replay can be heard,
 *  done once both hearings are in, none when no sentence fits. */
export type LineRowTone = "idle" | "open" | "done" | "none";

export interface LineRow {
	/** The one line under the row's title. */
	line: string;
	/** The short state on the right. */
	pill: string;
	tone: LineRowTone;
}

/** What the row on Today says about the line. Counts only; the learner's own
 *  numbers, never called a score. */
export function lineRow(input: LineCardInput): LineRow {
	if (!input.hasLine) return { line: "The dictionary has no sentence that fits yet.", pill: "No line today", tone: "none" };
	const m = input.morning;
	if (!m) return { line: "One sentence, no text. Listen, then type what you caught.", pill: "Not heard yet", tone: "idle" };
	const first = `This morning ${m.caught} of ${m.words} words`;
	if (input.evening) {
		const e = input.evening;
		return { line: `${first}, this evening ${e.caught} of ${e.words}.`, pill: "Both heard", tone: "done" };
	}
	if (input.eveningOpen) return { line: `${first}. Hear it again, now that you have practiced.`, pill: "Hear it again", tone: "open" };
	return { line: `${first}. It comes back once you have practiced today.`, pill: "Back tonight", tone: "idle" };
}
