/**
 * Fluency (LangHarness, 2026-10-28) — Nation's fourth strand: getting
 * faster with what is ALREADY known. Nothing new is taught here; every
 * word is one the learner has met, and the only variable is time.
 *
 *   reread  — a timed re-reading of an episode already read in the Read
 *             task. Speed-reading work (Nation 2009; Chang 2010) uses easy
 *             texts, a clock, a running record of words per minute and a
 *             light comprehension check, so speed never comes at the
 *             price of understanding.
 *   fast    — "say it faster": the 4/3/2 technique (Maurice 1983; Nation
 *             1989) shrunk to a sentence. The same line is said three
 *             times, each time in a shorter window; the repetition at
 *             rising speed is what makes retrieval automatic.
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
import type { LexiconEntry } from "./review.ts";

export type FluencyMode = "reread" | "fast";

export const FLUENCY_MINUTES = 3;

// ─── Re-reading against the clock ───────────────────────────────────────────

/** Silent-reading pace to aim for, words a minute, by level. Nation's
 *  speed-reading courses move intermediate learners from ~100 toward
 *  ~250 wpm on easy text; a beginner decoding a second script-free
 *  language sits well under 100. These are floors to beat, not norms. */
export const WPM_TARGET: Readonly<Record<Cefr, number>> = { A1: 60, A2: 80, B1: 100, B2: 130, C1: 160 };

export function wordsPerMinute(words: number, ms: number): number {
	if (ms <= 0 || words <= 0) return 0;
	return Math.round(words / (ms / 60_000));
}

export const REREAD_XP = 12;
export const REREAD_FASTER_XP = 6;
export const REREAD_QUESTION_XP = 5;

/** XP for a re-read: the read itself, a bonus for beating the last time
 *  (or the level's target on a first re-read), and the check. */
export function rereadXp(wpm: number, target: number, previousWpm: number | null, questionRight: boolean): number {
	const bar = previousWpm ?? target;
	return REREAD_XP + (wpm > bar ? REREAD_FASTER_XP : 0) + (questionRight ? REREAD_QUESTION_XP : 0);
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
	practised: boolean;
}

export const FAST_COUNT = 6;
export const FAST_MIN_WORDS = 3;
export const FAST_MAX_WORDS = 9;
/** Three passes a sentence, each window a share of the first. */
export const FAST_PASSES = 3;

/** How long a pass allows, in ms: a base for the mouth to get going plus
 *  a share per word, at a comfortable speaking rate on the first pass,
 *  then faster. The last window is close to a native pace for a learner
 *  (about 2.3 words a second). */
export function fastWindows(words: number): number[] {
	const base = 900 + words * 430;
	return [Math.round(base * 1.6), Math.round(base * 1.25), base];
}

export const FAST_PASS_XP = 2;
export const FAST_SENTENCE_XP = 4;
export const FAST_BONUS = 8;

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
	passes: Array<{ ms: number; window: number; made: boolean; inWindow?: boolean; heard?: string; match?: number; pron?: PronScore }>;
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

export interface PickKnownOptions {
	seed: number;
	count?: number;
	/** Item ids used lately: skipped while fresher ones remain. */
	recent?: ReadonlySet<string>;
	/** Item ids the learner answered right in lessons: taken first. */
	practised?: ReadonlySet<string>;
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
	const practised: Found[] = [];
	const rest: Found[] = [];
	const usedSlug = new Set<string>();
	const usedText = new Set<string>();
	const textOf = (sk: string) => sk.toLocaleLowerCase("sk-SK").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
	/** A sentence that qualifies, or null. */
	const judge = (entry: LexiconEntry, i: number): Found | null => {
		const ex = entry.examples[i];
		if (!ex?.en || ex.rejected) return null;
		if (usedSlug.has(entry.slug) || usedText.has(textOf(ex.sk))) return null;
		const judged = judgeSentence(ex.sk, lookup);
		if (judged.words < FAST_MIN_WORDS || judged.words > FAST_MAX_WORDS || judged.stretch.length > 0) return null;
		return { entry, index: i, hardest: judged.hardest, words: judged.words };
	};
	const take = (list: Found[], f: Found) => {
		list.push(f);
		usedSlug.add(f.entry.slug);
		usedText.add(textOf(f.entry.examples[f.index]!.sk));
	};
	// The learner's own practised sentences first: looked up by id, not
	// found by chance in the scan.
	if (opts.practised?.size) {
		const bySlug = new Map(entries.map((e) => [e.slug, e]));
		for (const id of shuffle([...opts.practised], rand)) {
			if (practised.length >= count) break;
			const at = id.lastIndexOf("#");
			const entry = bySlug.get(id.slice(0, at));
			const i = Number(id.slice(at + 1));
			if (!entry || !Number.isInteger(i)) continue;
			const f = judge(entry, i);
			if (f) take(practised, f);
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
	const chosen = [...practised, ...rest].slice(0, count);
	return shuffle(chosen, rand).map((f) => {
		const ex = f.entry.examples[f.index]!;
		return {
			id: `${f.entry.slug}#${f.index}`,
			slug: f.entry.slug,
			lemma: f.entry.sk,
			sentence: ex.sk,
			translation: ex.en,
			words: f.words,
			practised: opts.practised?.has(`${f.entry.slug}#${f.index}`) ?? false,
		};
	});
}
