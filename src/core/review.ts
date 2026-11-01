/**
 * Spaced review (LangHarness) — the cloze deck's pure model. Browser-safe.
 *
 * A card is one sentence from the lexicon with one word blanked out
 * (Clozemaster-style). Cards are minted lazily from the lexicon in
 * frequency order, a few new ones per day, and scheduled with FSRS
 * (core/fsrs.ts). The store (src/store/review.ts) persists cards and an
 * append-only review log per language profile.
 */

import type { FormSlip } from "./form-slip.ts";
import type { MemoryState, Rating } from "./fsrs.ts";

/** One lexicon example as exported from slovak.wiki
 *  (scripts/export-slovakwiki-lexicon.mjs). */
export interface LexiconExample {
	/** Primary target language sentence/text. */
	text?: string;
	/** Legacy Slovak text alias. */
	sk?: string;
	en: string;
	src: "curated" | "tatoeba" | string;
	tatoebaId?: number;
	/** The token that is a form of the entry's lemma, and where it starts. */
	cloze?: { answer: string; at: number };
	/** Reviewed and excluded from every feature. Kept in the file so the positions (and card ids) do not move. */
	rejected?: boolean;
}

export interface LexiconEntry {
	slug: string;
	/** Canonical target language lemma with diacritics. */
	lemma?: string;
	/** Legacy Slovak lemma alias for backwards compatibility. */
	sk?: string;
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

/** Target lemma helper honoring `entry.lemma` then `entry.sk`. */
export function entryLemma(entry: Pick<LexiconEntry, "lemma" | "sk">): string {
	return entry.lemma ?? entry.sk ?? "";
}

/** Target sentence text helper honoring `ex.text` then `ex.sk`. */
export function exampleText(example: Pick<LexiconExample, "text" | "sk">): string {
	return example.text ?? example.sk ?? "";
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
	/** Hints taken before answering (1 = the meaning, 2 = the word too). */
	hints?: number;
	/** The answer was picked from four, not typed. */
	picked?: boolean;
	/** A form card (2026-10-31, first tries): the drill its sentence
	 *  practises, the word's lexicon gender, and the slip a counted wrong
	 *  first try got (src/core/form-slip.ts). */
	unit?: string;
	gender?: string;
	slip?: FormSlip;
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
		if (!ex.cloze || ex.rejected) return;
		const words = exampleText(ex).split(/\s+/).length;
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
		lemma: entryLemma(entry),
		gloss: entry.en,
		sentence: exampleText(ex),
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

/** How the answer was helped: hints taken (1 = the meaning shown, 2 = the
 *  dictionary form too) and whether it was picked from four rather than
 *  typed. Help is allowed, and priced: it caps the rating (docs/research/
 *  desirable-difficulties.md). */
export interface ReviewHelp {
	hints?: number;
	picked?: boolean;
}

/** The highest rating an answer can earn with the help it had: with the
 *  meaning shown or picked from four, at most Good; with the word itself
 *  shown, at most Hard (the ending was produced, the word was not). */
export function ratingCap(help?: ReviewHelp): Rating {
	if ((help?.hints ?? 0) >= 2) return 2;
	if ((help?.hints ?? 0) >= 1 || help?.picked) return 3;
	return 4;
}

/** Map a typed answer's verdict (and speed) to an FSRS rating. A diacritic
 *  slip is Hard: the word came back, its spelling did not. Help lowers
 *  the ceiling (ratingCap). */
export function ratingFor(verdict: "exact" | "accents" | "wrong", ms?: number, help?: ReviewHelp): Rating {
	if (verdict === "wrong") return 1;
	const cap = ratingCap(help);
	if (verdict === "accents") return Math.min(2, cap) as Rating;
	if (ms !== undefined && ms < 4000) return Math.min(4, cap) as Rating;
	return Math.min(3, cap) as Rating;
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
