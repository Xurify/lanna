/**
 * Listen (LangHarness, 2026-10-28) — the meaning-focused input strand,
 * built locally. Ten real sentences from the dictionary that the learner
 * can follow (95–98% of the words known), each heard first with the text
 * hidden, understood by picking its meaning, then read with its one
 * stretch word glossed. No typing, no grammar grading.
 *
 * Why (the comprehensible-input research the task comes from):
 *   - Comprehension precedes production (Lichtman & VanPatten 2021): the
 *     app's plan had no task where the learner only had to understand.
 *   - "i+1" cannot be measured, but word coverage can: comprehension
 *     rises in a straight line with the share of words known (Schmitt,
 *     Jiang & Grabe 2011); 95% is comfortable for listening (van Zeeland
 *     & Schmitt 2013), 98% for unassisted reading (Hu & Nation 2000). So
 *     each sentence carries at most one word the learner has not met, and
 *     the session as a whole stays above LISTEN_FLOOR.
 *   - Input alone leaves accuracy gaps (Swain 1985), so this is one strand
 *     of four (src/core/strands.ts), not a replacement for the lessons.
 *
 * Pure and browser-safe. The server (src/server/listen.ts) supplies the
 * known-word set and the form→entry lookup shared with the Read task.
 */

import type { LexiconEntry } from "./review.ts";
import { rng, shuffle } from "./lesson.ts";
import { grammarWord, tokenize } from "./reading.ts";

export interface StretchWord {
	/** The word as it stands in the sentence. */
	text: string;
	lemma: string;
	gloss: string;
	slug?: string;
	/** Frequency rank within its part of speech (lower = commoner). */
	rank?: number;
}

export interface ListenItem {
	/** "<slug>#<exampleIndex>" — the same id lessons and the deck use. */
	id: string;
	slug: string;
	lemma: string;
	gloss: string;
	sentence: string;
	translation: string;
	/** Three English meanings, the translation among them. */
	options: string[];
	/** The words the learner is not expected to know: the i+1. */
	stretch: StretchWord[];
	/** Share of the sentence's words that count as known (0..1). */
	coverage: number;
	words: number;
}

export interface ListenPlan {
	items: ListenItem[];
	/** How many dictionary words count as known for the learner. */
	known: number;
	/** Share of the session's running words that are known (0..1). */
	coverage: number;
}

/** The session's running-word coverage. */
export function sessionCoverage(items: readonly Pick<ListenItem, "words" | "stretch">[]): number {
	const words = items.reduce((n, i) => n + i.words, 0);
	if (words === 0) return 1;
	return (words - items.reduce((n, i) => n + i.stretch.length, 0)) / words;
}

export const LISTEN_COUNT = 10;
export const LISTEN_MINUTES = 4;
/** The session as a whole: at least this share of its running words known
 *  (van Zeeland & Schmitt 2013 put comfortable listening near 95%). A
 *  single short sentence cannot be held to a percentage — one new word in
 *  eight is 87% — so the rule is one stretch word a sentence, and the
 *  session trades stretch sentences for fully-known ones until the whole
 *  clears the floor. */
export const LISTEN_FLOOR = 0.93;
/** How many of the ten should carry a stretch word; the rest are fully
 *  known (fluency: hearing what you know at speed). */
export const STRETCH_SHARE = 0.5;
export const MIN_WORDS = 4;
export const MAX_WORDS = 12;
/** A sentence with a stretch word needs this many words around it. */
export const STRETCH_MIN_WORDS = 6;
/** At most this many unknown words in one sentence. */
export const STRETCH_MAX = 1;

export const LISTEN_XP = 4;
export const LISTEN_BONUS = 10;

export function listenXp(correct: number, total: number): number {
	return correct * LISTEN_XP + (total > 0 ? LISTEN_BONUS : 0);
}

/** A sentence counts as understood only by ear: right, and the text not
 *  shown before the pick. Peeking is allowed (after two listens) and
 *  priced: that sentence earns nothing and does not count (docs/research/
 *  desirable-difficulties.md). */
export function understood(reps: readonly { verdict: "exact" | "wrong"; peeked?: boolean }[]): number {
	return reps.filter((r) => r.verdict === "exact" && !r.peeked).length;
}

/** How many times a sentence must have been heard before its text may be
 *  shown: the first playback and one replay. */
export const PEEK_AFTER_REPLAYS = 1;

/** What the core needs from the server to judge a sentence: the entry a
 *  surface form belongs to (src/server/reading.ts resolveWord), the
 *  learner's known slugs, and names that are not vocabulary. */
export interface ListenLookup {
	resolve: (form: string) => LexiconEntry | undefined;
	known: ReadonlySet<string>;
	names?: ReadonlySet<string>;
}

export interface Judged {
	coverage: number;
	words: number;
	stretch: StretchWord[];
	/** The rarest known word's rank: how hard the sentence is for the ear
	 *  even when every word is known (lower = easier). */
	hardest: number;
}

const lower = (s: string) => s.toLocaleLowerCase("sk-SK");
/** A dictionary word with no frequency rank counts as fairly rare. */
const UNRANKED = 2000;

/** Judge one sentence: how much of it the learner knows, and which words
 *  are new. A capitalised word inside the sentence that no dictionary
 *  form claims is a name, not a stretch word; digits are not words. */
export function judgeSentence(sentence: string, lookup: ListenLookup): Judged {
	let words = 0;
	let known = 0;
	let hardest = 0;
	const stretch: StretchWord[] = [];
	let first = true;
	for (const t of tokenize(sentence)) {
		if (!t.word) continue;
		if (/^\p{N}+$/u.test(t.text)) continue;
		words++;
		const capital = t.text.charAt(0) !== lower(t.text).charAt(0);
		const entry = lookup.resolve(t.text);
		const isName = capital && !first && (!entry || lookup.names?.has(lower(t.text)) === true);
		first = false;
		if (isName) {
			known++;
			continue;
		}
		if (entry && lookup.known.has(entry.slug)) {
			known++;
			hardest = Math.max(hardest, entry.rank ?? UNRANKED);
			continue;
		}
		// Pronoun forms, particles and prepositions the dictionary lacks
		// (sa, jeho, tá…) are grammar, not vocabulary to learn.
		if (!entry && grammarWord(t.text)) {
			known++;
			continue;
		}
		stretch.push(entry ? { text: t.text, lemma: entry.sk, gloss: entry.en, slug: entry.slug, ...(entry.rank !== undefined ? { rank: entry.rank } : {}) } : { text: t.text, lemma: t.text, gloss: "" });
	}
	return { coverage: words === 0 ? 1 : known / words, words, stretch, hardest };
}

/** Three meanings: the sentence's own and two others of similar length,
 *  so length alone gives nothing away. */
export function meaningOptions(translation: string, pool: readonly string[], rand: () => number, count = 3): string[] {
	const own = translation.trim();
	const others = [...new Set(pool.map((p) => p.trim()).filter((p) => p && p.toLowerCase() !== own.toLowerCase()))];
	const byLength = shuffle(others, rand)
		.sort((a, b) => Math.abs(a.length - own.length) - Math.abs(b.length - own.length))
		.slice(0, Math.max(6, count * 2));
	const picked = shuffle(byLength, rand).slice(0, count - 1);
	return shuffle([own, ...picked], rand);
}

export interface PickOptions {
	seed: number;
	count?: number;
	/** Item ids heard lately; skipped while fresher sentences remain. */
	recent?: ReadonlySet<string>;
	/** How many sentences to look at before settling (speed cap). */
	scan?: number;
}

/**
 * Pick the session's sentences. Examples are scanned in a seeded random
 * order; a sentence qualifies when every word is known, or when exactly
 * one word is new and glossed in a sentence of six or more. One sentence
 * per dictionary word, never the same sentence twice, a translation on
 * every one. Among the stretch sentences the commonest new words come
 * first (the most useful i+1), then the shorter sentences; the session
 * takes STRETCH_SHARE of them and fills up with fully-known ones, trades
 * stretch for known until the whole clears LISTEN_FLOOR, then shuffles,
 * so the ear never knows which kind is next.
 */
export function pickListen(entries: readonly LexiconEntry[], lookup: ListenLookup, opts: PickOptions): ListenItem[] {
	const rand = rng(opts.seed);
	const count = opts.count ?? LISTEN_COUNT;
	const scan = opts.scan ?? 6000;
	const wantStretch = Math.round(count * STRETCH_SHARE);
	type Found = { entry: LexiconEntry; index: number; judged: Judged };
	const stretch: Found[] = [];
	const full: Found[] = [];
	const usedSlug = new Set<string>();
	const usedText = new Set<string>();
	const enough = () => stretch.length >= count * 3 && full.length >= count * 2;
	const order = shuffle(
		entries.filter((e) => e.examples.some((x) => x.en)),
		rand,
	);
	let looked = 0;
	outer: for (const entry of order) {
		if (usedSlug.has(entry.slug)) continue;
		const idx = shuffle(
			entry.examples.map((_, i) => i),
			rand,
		);
		for (const i of idx) {
			const ex = entry.examples[i]!;
			if (!ex.en) continue;
			const id = `${entry.slug}#${i}`;
			if (opts.recent?.has(id)) continue;
			looked++;
			if (looked > scan) break outer;
			const n = ex.sk.split(/\s+/).length;
			if (n < MIN_WORDS || n > MAX_WORDS) continue;
			const text = ex.sk.toLocaleLowerCase("sk-SK").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
			if (usedText.has(text)) continue;
			const judged = judgeSentence(ex.sk, lookup);
			if (judged.words < MIN_WORDS) continue;
			const found = { entry, index: i, judged };
			if (judged.stretch.length === 0) {
				if (full.length >= count * 2) continue;
				full.push(found);
			} else if (judged.stretch.length <= STRETCH_MAX && judged.words >= STRETCH_MIN_WORDS && judged.stretch.every((w) => w.gloss)) {
				if (stretch.length >= count * 3) continue;
				stretch.push(found);
			} else continue;
			usedSlug.add(entry.slug);
			usedText.add(text);
			break;
		}
		if (enough()) break;
	}
	// The most useful new words first: the commonest, then the shorter
	// sentence around them.
	stretch.sort((a, b) => (a.judged.stretch[0]!.rank ?? 1e9) - (b.judged.stretch[0]!.rank ?? 1e9) || a.judged.hardest - b.judged.hardest);
	// Fully-known sentences: the ones built from the commonest words first,
	// so a beginner hears "Bratislava je hlavné mesto", not legal phrasing
	// that happens to sit inside the frequency bound.
	full.sort((a, b) => a.judged.hardest - b.judged.hardest || a.judged.words - b.judged.words);
	let take = Math.min(wantStretch, stretch.length);
	let chosen: Found[] = [];
	for (;;) {
		chosen = [...stretch.slice(0, take), ...full.slice(0, count - take)];
		for (const extra of stretch.slice(take)) {
			if (chosen.length >= count) break;
			chosen.push(extra);
		}
		if (take === 0 || sessionCoverage(chosen.map((f) => ({ words: f.judged.words, stretch: f.judged.stretch }))) >= LISTEN_FLOOR || full.length <= count - take) break;
		take--;
	}
	const pool = [...stretch, ...full].map((f) => f.entry.examples[f.index]!.en);
	return shuffle(chosen, rand)
		.slice(0, count)
		.map((f) => {
			const ex = f.entry.examples[f.index]!;
			return {
				id: `${f.entry.slug}#${f.index}`,
				slug: f.entry.slug,
				lemma: f.entry.sk,
				gloss: f.entry.en,
				sentence: ex.sk,
				translation: ex.en,
				options: meaningOptions(ex.en, pool, rand),
				stretch: f.judged.stretch,
				coverage: Math.round(f.judged.coverage * 1000) / 1000,
				words: f.judged.words,
			};
		});
}
