/**
 * Spaced review (LangHarness) — the cloze deck's pure model. Browser-safe.
 *
 * A card is one sentence from the lexicon with one word blanked out
 * (Clozemaster-style). Cards are minted lazily from the lexicon in
 * frequency order, a few new ones per day, and scheduled with FSRS
 * (core/fsrs.ts). The store (src/store/review.ts) persists cards and an
 * append-only review log per language profile.
 */

import type { MemoryState, Rating } from "./fsrs.ts";

/** One lexicon example as exported from slovak.wiki
 *  (scripts/export-slovakwiki-lexicon.mjs). */
export interface LexiconExample {
	sk: string;
	en: string;
	src: "curated" | "tatoeba";
	tatoebaId?: number;
	/** The token that is a form of the entry's lemma, and where it starts. */
	cloze?: { answer: string; at: number };
}

export interface LexiconEntry {
	slug: string;
	/** Lemma with diacritics. */
	sk: string;
	en: string;
	cat: "Nouns" | "Verbs" | "Adjectives" | "Adverbs" | "Phrases" | "Places" | string;
	topics?: string[];
	gender?: string;
	register?: string;
	/** Frequency rank within its part of speech (SNK), lower = commoner. */
	rank?: number;
	pos?: string;
	/** Hand-checked noun paradigm (JÚĽŠ), N G D A L I. */
	declension?: { singular: string[]; plural: string[] };
	/** Rule-generated forms that slovak.wiki marks as verified for this
	 *  paradigm (unordered). Absent = no trusted generated forms. */
	forms?: string[];
	origin?: string;
	examples: LexiconExample[];
	related: string[];
}

export type CardState = "new" | "learning" | "review";

export interface ReviewCard {
	/** "<slug>#<exampleIndex>" — stable across re-exports while the
	 *  example list keeps its order. */
	id: string;
	slug: string;
	lemma: string;
	gloss: string;
	sentence: string;
	translation: string;
	answer: string;
	at: number;
	state: CardState;
	memory?: MemoryState;
	due: string;
	reps: number;
	lapses: number;
	lastReview?: string;
	createdAt: string;
	/** Learner suspended it (bad sentence, already known…). */
	suspended?: boolean;
}

export interface ReviewLogEntry {
	cardId: string;
	rating: Rating;
	/** What the learner typed (or the option they picked). */
	given: string;
	verdict: "exact" | "accents" | "wrong";
	elapsedDays: number;
	reviewedAt: string;
	ms?: number;
}

export interface ReviewSettings {
	newPerDay: number;
	retention: number;
}

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = { newPerDay: 10, retention: 0.9 };

/** Rank order for minting new cards: curated beginner words first, then by
 *  frequency rank, then by slug for determinism. */
export function lexiconOrder(a: LexiconEntry, b: LexiconEntry): number {
	const ca = a.origin === "curated" ? 0 : 1;
	const cb = b.origin === "curated" ? 0 : 1;
	if (ca !== cb) return ca - cb;
	const ra = a.rank ?? Number.MAX_SAFE_INTEGER;
	const rb = b.rank ?? Number.MAX_SAFE_INTEGER;
	if (ra !== rb) return ra - rb;
	return a.slug.localeCompare(b.slug);
}

/** The best cloze example for an entry: a curated sentence beats Tatoeba;
 *  shorter beats longer (3–12 words is the Clozemaster sweet spot). */
export function pickClozeExample(entry: LexiconEntry): number | undefined {
	let best: number | undefined;
	let bestScore = Infinity;
	entry.examples.forEach((ex, i) => {
		if (!ex.cloze) return;
		const words = ex.sk.split(/\s+/).length;
		if (words < 2 || words > 16) return;
		const score = (ex.src === "curated" ? 0 : 100) + Math.abs(words - 7);
		if (score < bestScore) {
			bestScore = score;
			best = i;
		}
	});
	return best;
}

export function mintCard(entry: LexiconEntry, exampleIndex: number, now: Date): ReviewCard | undefined {
	const ex = entry.examples[exampleIndex];
	if (!ex?.cloze) return undefined;
	return {
		id: `${entry.slug}#${exampleIndex}`,
		slug: entry.slug,
		lemma: entry.sk,
		gloss: entry.en,
		sentence: ex.sk,
		translation: ex.en,
		answer: ex.cloze.answer,
		at: ex.cloze.at,
		state: "new",
		due: now.toISOString(),
		reps: 0,
		lapses: 0,
		createdAt: now.toISOString(),
	};
}

/** The sentence split around its blank. */
export function clozeParts(card: Pick<ReviewCard, "sentence" | "answer" | "at">): { before: string; after: string } {
	return { before: card.sentence.slice(0, card.at), after: card.sentence.slice(card.at + card.answer.length) };
}

/** Local-day key ("2026-10-26") for the new-cards-per-day budget. */
export function dayKey(d: Date, timeZoneOffsetMinutes = d.getTimezoneOffset()): string {
	return new Date(d.getTime() - timeZoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Map a typed answer's verdict (and speed) to an FSRS rating. A diacritic
 *  slip is Hard: the word came back, its spelling did not. */
export function ratingFor(verdict: "exact" | "accents" | "wrong", ms?: number): Rating {
	if (verdict === "wrong") return 1;
	if (verdict === "accents") return 2;
	if (ms !== undefined && ms < 4000) return 4;
	return 3;
}

export interface QueueCounts {
	due: number;
	learning: number;
	newToday: number;
	total: number;
}

/** Cards to show now, learning first, then due reviews (oldest first). */
export function dueCards(cards: ReviewCard[], now: Date): ReviewCard[] {
	const t = now.getTime();
	return cards
		.filter((c) => !c.suspended && c.state !== "new" && Date.parse(c.due) <= t)
		.sort((a, b) => (a.state === b.state ? Date.parse(a.due) - Date.parse(b.due) : a.state === "learning" ? -1 : 1));
}

/** Words the learner keeps missing — lapses weighted by how recent. For
 *  the tutor's context and the review page's "leeches" list. */
export function leeches(cards: ReviewCard[], min = 3): ReviewCard[] {
	return cards.filter((c) => c.lapses >= min).sort((a, b) => b.lapses - a.lapses);
}
