/**
 * Spaced review — the cloze deck's pure model. Browser-safe.
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
	/** An added language's forms and the grammar cells each fills, as
	 *  space-joined Wiktionary tags ("genitive singular"); one string per cell. */
	formTags?: Record<string, string[]>;
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
	/** Words the blank hid, when more than one. */
	words?: number;
	/** Where those words sit in the sentence, so the day's list marks the same words. */
	spans?: Span[];
	/** A form card (2026-10-31, first tries): the drill its sentence
	 *  practices, the word's lexicon gender, and the slip a counted wrong
	 *  first try got (src/core/form-slip.ts). */
	unit?: string;
	gender?: string;
	slip?: FormSlip;
}

export const MAX_BLANK_WORDS = 3;

/** FSRS stability, in days, from which a word counts as proven: its memory holds for a week. */
export const SOLID_STABILITY_DAYS = 7;
/** From this stability a card hides a third word. */
const STRONG_STABILITY_DAYS = 30;

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

/** Where a hidden word sits in the sentence: [from, to). */
export type Span = [number, number];

export interface Blank {
	/** The sentence around and between the gaps: always one more piece than gaps. */
	pieces: string[];
	/** The hidden words, in sentence order. */
	gaps: string[];
	spans: Span[];
	/** What is graded: the gaps joined by single spaces. */
	answer: string;
	words: number;
	/** Which gap is the card's own word. */
	target: number;
}

const WORD = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;
const HAS_LETTER = /\p{L}/u;

/** How many words a card hides: the card's word alone until its memory is proven, more as it grows, and never more than a third of the sentence, so the rest still carries the meaning. */
export function blankSizeFor(card: Pick<ReviewCard, "state" | "memory" | "sentence">): number {
	if (card.state !== "review") return 1;
	const stability = card.memory?.stability ?? 0;
	const byMemory = stability >= STRONG_STABILITY_DAYS ? 3 : stability >= SOLID_STABILITY_DAYS ? 2 : 1;
	const letterWords = [...card.sentence.matchAll(WORD)].filter((m) => HAS_LETTER.test(m[0])).length;
	return Math.min(byMemory, Math.max(1, Math.floor(letterWords / 3)), MAX_BLANK_WORDS);
}

/** What the learner knows of a word as it stands in a sentence: its card's FSRS stability in days, `ASSUMED_KNOWN` for a word the level counts as known that the deck has not tested, or undefined. */
export type WordStrength = (word: string) => number | undefined;

/** Sorts a word the deck has not tested after every word it has proven. */
export const ASSUMED_KNOWN = 1000;

function nextSeed(seed: number): number {
	const s = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
	return Math.imul(s ^ (s >>> 13), 3266489909) >>> 0;
}

/** The sentence cut at the given spans, the card's own word at `target`. */
export function blankFromSpans(sentence: string, spans: Span[], target: number): Blank {
	const pieces = [sentence.slice(0, spans[0]?.[0] ?? sentence.length)];
	const gaps: string[] = [];
	spans.forEach(([from, to], i) => {
		gaps.push(sentence.slice(from, to));
		pieces.push(sentence.slice(to, spans[i + 1]?.[0] ?? sentence.length));
	});
	return { pieces, gaps, spans, answer: gaps.join(" "), words: gaps.length, target };
}

/** The words of a text, lowercased, to compare whole words. */
export function wordsOf(text: string): string[] {
	return [...text.matchAll(WORD)].map((m) => m[0].toLocaleLowerCase());
}

/** `text` cut so that every whole word in `hidden` (lowercased) is its own part. */
export function splitOnWords(text: string, hidden: ReadonlySet<string>): Array<{ text: string; hidden: boolean }> {
	const parts: Array<{ text: string; hidden: boolean }> = [];
	let last = 0;
	for (const m of text.matchAll(WORD)) {
		if (!hidden.has(m[0].toLocaleLowerCase())) continue;
		if (m.index > last) parts.push({ text: text.slice(last, m.index), hidden: false });
		parts.push({ text: m[0], hidden: true });
		last = m.index + m[0].length;
	}
	if (last < text.length) parts.push({ text: text.slice(last), hidden: false });
	return parts;
}

/** The card's word, and up to `words - 1` other words of the sentence the learner has proven. The weakest proven words go first, since a retrieval that takes effort and still succeeds strengthens memory most; the seed shuffles near ties, so a sentence does not hide the same words every rep. A sentence with fewer proven words hides fewer. */
export function blankAround(
	card: Pick<ReviewCard, "sentence" | "answer" | "at">,
	words: number,
	seed = 0,
	strengthOf: WordStrength = () => undefined,
): Blank {
	const own: Span = [card.at, card.at + card.answer.length];
	let s = seed;
	const others = [...card.sentence.matchAll(WORD)]
		.filter((m) => HAS_LETTER.test(m[0]))
		.map((m) => ({ span: [m.index, m.index + m[0].length] as Span, strength: strengthOf(m[0]) }))
		.filter(
			({ span: [from, to], strength }) =>
				(to <= own[0] || from >= own[1]) && strength !== undefined && strength >= SOLID_STABILITY_DAYS,
		)
		.map(({ span, strength }) => {
			s = nextSeed(s);
			return { span, order: strength! * (1 + (s % 1000) / 1000) };
		})
		.sort((a, b) => a.order - b.order);
	const spans: Span[] = [own, ...others.slice(0, Math.max(0, Math.min(words, MAX_BLANK_WORDS) - 1)).map((o) => o.span)];
	spans.sort((a, b) => a[0] - b[0]);
	return blankFromSpans(card.sentence, spans, spans.indexOf(own));
}

/** The blank cut at spans the screen sent back: whole words of the sentence, in order, one of them the card's word. Undefined when they are not. */
export function blankAtSpans(
	card: Pick<ReviewCard, "sentence" | "answer" | "at">,
	spans: readonly Span[] | undefined,
): Blank | undefined {
	if (!spans || spans.length === 0 || spans.length > MAX_BLANK_WORDS) return undefined;
	const wordAt = new Map([...card.sentence.matchAll(WORD)].map((m) => [m.index, m.index + m[0].length]));
	const whole = spans.every(
		([from, to], i) => Number.isInteger(from) && wordAt.get(from) === to && (i === 0 || spans[i - 1]![1] <= from),
	);
	const target = spans.findIndex(([from, to]) => from === card.at && to === card.at + card.answer.length);
	return whole && target >= 0 ? blankFromSpans(card.sentence, [...spans], target) : undefined;
}

export function targetWordOf(blank: Pick<Blank, "words" | "target">, given: string): string {
	if (blank.words <= 1) return given;
	const typed = given.trim().split(/\s+/);
	return typed.length === blank.words ? typed[blank.target]! : given;
}

export function applyGapInput(
	current: readonly string[],
	gapCount: number,
	index: number,
	value: string,
): { fields: string[]; advanceTo: number | null } {
	const next = Array.from({ length: gapCount }, (_, k) => current[k] ?? "");
	if (gapCount <= 1 || !/\s/.test(value)) {
		next[index] = value;
		return { fields: next, advanceTo: null };
	}
	const trimmedStart = value.replace(/^\s+/, "");
	const [head = "", ...rest] = trimmedStart.split(/\s+/);
	const spill = index < gapCount - 1 && head.length > 0 && rest.length > 0;
	next[index] = spill ? head : trimmedStart;
	if (spill && rest.join(" ")) next[index + 1] = rest.join(" ");
	return { fields: next, advanceTo: spill ? index + 1 : null };
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
function ratingCap(help?: ReviewHelp): Rating {
	if ((help?.hints ?? 0) >= 2) return 2;
	if ((help?.hints ?? 0) >= 1 || help?.picked) return 3;
	return 4;
}

/** The highest rating the learner can pick after the verdict: a wrong answer
 *  or "I don't know" is Again and nothing else, because a lucky Good after a
 *  miss would put the card too far out. Otherwise the help cap applies. */
export function ratingCeiling(verdict: "exact" | "accents" | "wrong", help?: ReviewHelp): Rating {
	return verdict === "wrong" ? 1 : ratingCap(help);
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
