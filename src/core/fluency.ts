/**
 * Fluency (LangHarness, 2026-10-28) — Nation's fourth strand: getting
 * faster with what is ALREADY known. Nothing new is taught here; every
 * word is one the learner has met, and the only variable is time.
 *
 *   reread  — a timed re-reading of an episode already read in the Read
 *             task. Timed-reading studies (Chang 2010; Taguchi et al.
 *             2004) use easy texts, a clock, a running record of words
 *             per minute and a comprehension check, so speed does not
 *             come at the price of understanding. They show gains on the
 *             practiced texts; transfer to new ones is the open question.
 *   fast    — "say it faster": the 4/3/2 idea (Maurice 1983; Nation 1989)
 *             shrunk to a sentence. The same line is said three times,
 *             each time in a shorter window. What the studies support is
 *             the REPETITION of the same content (Lambert, Kormos & Minn
 *             2017; de Jong & Perfetti 2011; Thai & Boers 2016); the
 *             shrinking window is the app's design on top of it, kept on
 *             purpose, and Boers (2014) warns that pressure can cost
 *             accuracy, so a spoken pass also has to be clear to count.
 *   blitz   — the 60-second choose drill the app already had; counted
 *             into the strand by src/core/strands.ts.
 *
 * Pure and browser-safe. The server (src/server/fluency.ts) supplies the
 * episodes, the known-word lookup and the lesson history.
 */

import type { Cefr } from "./curriculum.ts";
import { rng, shuffle } from "./lesson.ts";
import { judgeSentence, type ListenLookup } from "./listen.ts";
import type { PronScore } from "./pronounce.ts";
import { entryLemma, exampleText, type LexiconEntry } from "./review.ts";// ─── Re-reading against the clock ───────────────────────────────────────────

/** First-run pace to beat, words a minute, by level. The app's own
 *  guess, not a published norm: the timed-reading studies report gains
 *  against the learner's own earlier pace, not level targets. From the
 *  second re-read of an episode the target is the learner's own pace
 *  (rereadTarget). */
export const WPM_TARGET: Readonly<Record<Cefr, number>> = { A1: 60, A2: 80, B1: 100, B2: 130, C1: 160 };

/** Above this the text was skimmed, not read; no speed bonus. */
export const REREAD_MAX_WPM = 450;

/** The pace to beat on a re-read: the middle of the last three, so one
 *  fluke run does not set the bar. With fewer than three, the last one;
 *  with none, the level's guess. */
export function rereadTarget(history: readonly number[], level: Cefr): number {
	if (history.length === 0) return WPM_TARGET[level];
	if (history.length < 3) return history[history.length - 1]!;
	return [...history.slice(-3)].sort((a, b) => a - b)[1]!;
}

export function wordsPerMinute(words: number, ms: number): number {
	if (ms <= 0 || words <= 0) return 0;
	return Math.round(words / (ms / 60_000));
}

const REREAD_XP = 12;
const REREAD_FASTER_XP = 6;
const REREAD_QUESTION_XP = 5;

/** XP for a re-read: the read itself, the check, and a bonus for beating
 *  the target that is paid only when the question was right and the pace
 *  is a plausible reading pace: speed that costs understanding earns
 *  nothing extra. */
export function rereadXp(wpm: number, target: number, questionRight: boolean): number {
	const beat = questionRight && wpm > target && wpm <= REREAD_MAX_WPM;
	return REREAD_XP + (beat ? REREAD_FASTER_XP : 0) + (questionRight ? REREAD_QUESTION_XP : 0);
}

/** A re-read log line (data/profiles/<lang>/fluency/log.jsonl). */
export interface RereadLogEntry {
	mode: "reread";
	storyId: string;
	at: string;
	day: string;
	words: number;
	ms: number;
	wpm: number;
	/** The check: the question index asked and whether it was right. */
	question: number;
	right: boolean;
	xp: number;
}

// ─── Say it faster ──────────────────────────────────────────────────────────

export interface FastItem {
	/** "<slug>#<exampleIndex>" */
	id: string;
	slug: string;
	lemma: string;
	sentence: string;
	translation: string;
	words: number;
	/** The sentence was answered right in a lesson before: truly known. */
	practiced: boolean;
}

export const FAST_COUNT = 6;
const FAST_MIN_WORDS = 3;
const FAST_MAX_WORDS = 9;
/** Three passes a sentence, each window a share of the first. */
export const FAST_PASSES = 3;

/** How long a pass allows, in ms: a base for the mouth to get going plus
 *  a share per word. The first pass gets 1.6 times the last window, the
 *  second 1.25 times. The last window asks for about 1.4 to 1.9 words a
 *  second: a brisk read-aloud, slower than conversation. The numbers are
 *  the app's design, not a study's. */
export function fastWindows(words: number): number[] {
	const base = 900 + words * 430;
	return [Math.round(base * 1.6), Math.round(base * 1.25), base];
}

const FAST_PASS_XP = 2;
const FAST_SENTENCE_XP = 4;
const FAST_BONUS = 8;

/** XP: each pass inside its window, each sentence whose last pass made
 *  it, and a bonus for finishing. */
export function fastXp(passesMade: number, sentencesMade: number, total: number): number {
	if (total === 0) return 0;
	return passesMade * FAST_PASS_XP + sentencesMade * FAST_SENTENCE_XP + FAST_BONUS;
}

export interface FastRep {
	itemId: string;
	slug: string;
	sentence: string;
	translation: string;
	/** Each pass: how long it took, the window it had, whether it was
	 *  inside it, the transcript heard and the pronunciation score (when
	 *  the microphone ran). `made` is the verdict: in the window AND clear
	 *  (src/core/pronounce.ts passMade). */
	passes: Array<{ ms: number; window: number; made: boolean; inWindow?: boolean; unchecked?: boolean; speechMs?: number; heard?: string; match?: number; pron?: PronScore }>;
}

/** Words a second, first pass and last pass, over the sentences whose
 *  first and last pass both counted. The comparison is within each
 *  sentence: it shows how much quicker the repetition got, and says
 *  nothing about new sentences. */
/** Faster than this is not speech (the quickest talkers reach about five words a second): a button pressed early. */
export const FAST_MAX_WPS = 5;

export interface FastPace {
	sentences: number;
	first: number;
	last: number;
}

export function fastPace(reps: readonly FastRep[]): FastPace | null {
	let words = 0;
	let firstSec = 0;
	let lastSec = 0;
	let sentences = 0;
	for (const r of reps) {
		const a = r.passes[0];
		const b = r.passes[r.passes.length - 1];
		if (!a || !b || r.passes.length < FAST_PASSES || !a.made || !b.made) continue;
		const n = r.sentence.split(/\s+/).filter(Boolean).length;
		const fs = (a.speechMs ?? a.ms) / 1000;
		const ls = (b.speechMs ?? b.ms) / 1000;
		if (n === 0 || fs <= 0 || ls <= 0 || n / fs > FAST_MAX_WPS || n / ls > FAST_MAX_WPS) continue;
		words += n;
		firstSec += fs;
		lastSec += ls;
		sentences++;
	}
	if (sentences === 0) return null;
	const round = (x: number) => Math.round(x * 10) / 10;
	return { sentences, first: round(words / firstSec), last: round(words / lastSec) };
}

export interface FastLogEntry {
	mode: "fast";
	at: string;
	day: string;
	ms?: number;
	reps: FastRep[];
	passesMade: number;
	sentencesMade: number;
	xp: number;
}

export type FluencyLogEntry = RereadLogEntry | FastLogEntry;

interface PickKnownOptions {
	seed: number;
	count?: number;
	/** Item ids used lately: skipped while fresher ones remain. */
	recent?: ReadonlySet<string>;
	/** Item ids the learner answered right in lessons: taken first. */
	practiced?: ReadonlySet<string>;
	scan?: number;
}

/**
 * Sentences for "say it faster": every word known (no stretch word at
 * all — fluency work is at 100% known material), three to nine words, a
 * translation on each, one per dictionary word. Sentences the learner
 * has answered right in a lesson come first; the rest are the ones made
 * of the commonest words.
 */
export function pickKnown(entries: readonly LexiconEntry[], lookup: ListenLookup, opts: PickKnownOptions): FastItem[] {
	const rand = rng(opts.seed);
	const count = opts.count ?? FAST_COUNT;
	const scan = opts.scan ?? 5000;
	type Found = { entry: LexiconEntry; index: number; hardest: number; words: number };
	const practiced: Found[] = [];
	const rest: Found[] = [];
	const usedSlug = new Set<string>();
	const usedText = new Set<string>();
	const textOf = (sk: string) => sk.toLocaleLowerCase("sk-SK").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
	/** A sentence that qualifies, or null. */
	const judge = (entry: LexiconEntry, i: number): Found | null => {
		const ex = entry.examples[i];
		if (!ex?.en || ex.rejected) return null;
		if (usedSlug.has(entry.slug) || usedText.has(textOf(exampleText(ex)))) return null;
		const judged = judgeSentence(exampleText(ex), lookup);
		if (judged.words < FAST_MIN_WORDS || judged.words > FAST_MAX_WORDS || judged.stretch.length > 0) return null;
		return { entry, index: i, hardest: judged.hardest, words: judged.words };
	};
	const take = (list: Found[], f: Found) => {
		list.push(f);
		usedSlug.add(f.entry.slug);
		usedText.add(textOf(exampleText(f.entry.examples[f.index]!)));
	};
	// The learner's own practiced sentences first: looked up by id, not
	// found by chance in the scan.
	if (opts.practiced?.size) {
		const bySlug = new Map(entries.map((e) => [e.slug, e]));
		for (const id of shuffle([...opts.practiced], rand)) {
			if (practiced.length >= count) break;
			const at = id.lastIndexOf("#");
			const entry = bySlug.get(id.slice(0, at));
			const i = Number(id.slice(at + 1));
			if (!entry || !Number.isInteger(i)) continue;
			const f = judge(entry, i);
			if (f) take(practiced, f);
		}
	}
	let looked = 0;
	outer: for (const entry of shuffle(
		entries.filter((e) => e.examples.some((x) => x.en)),
		rand,
	)) {
		if (usedSlug.has(entry.slug)) continue;
		for (const i of shuffle(
			entry.examples.map((_, k) => k),
			rand,
		)) {
			const id = `${entry.slug}#${i}`;
			if (opts.recent?.has(id)) continue;
			looked++;
			if (looked > scan) break outer;
			const f = judge(entry, i);
			if (!f) continue;
			take(rest, f);
			break;
		}
		if (rest.length >= count * 3) break;
	}
	rest.sort((a, b) => a.hardest - b.hardest || a.words - b.words);
	const chosen = [...practiced, ...rest].slice(0, count);
	return shuffle(chosen, rand).map((f) => {
		const ex = f.entry.examples[f.index]!;
		return {
			id: `${f.entry.slug}#${f.index}`,
			slug: f.entry.slug,
			lemma: entryLemma(f.entry),
			sentence: exampleText(ex),
			translation: ex.en,
			words: f.words,
			practiced: opts.practiced?.has(`${f.entry.slug}#${f.index}`) ?? false,
		};
	});
}
