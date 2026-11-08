/**
 * The vocabulary-size check (LangHarness, 2026-10-28): a yes/no test in
 * the X_Lex / Eurocentres Vocabulary Size Test tradition (Meara & Milton
 * 2003; Milton 2009). Forty real lemmas sampled across five frequency
 * bands of the dictionary plus eight pseudowords that look Slovak; the
 * learner ticks the words they know. The share ticked in each band,
 * corrected for over-claiming by the pseudowords ticked, times the band's
 * width, sums to a receptive vocabulary in lemmas.
 *
 * Why: the placement drill measures grammar only, and the words
 * calculator (src/core/milestones.ts) used to infer a vocabulary from the
 * grammar level — 2,400 words credited for passing two A1 tiers. Two
 * minutes of ticking measures it instead. Pure and browser-safe.
 */

interface VocabBand {
	id: string;
	/** Rank range in the dictionary's frequency order, half-open. */
	from: number;
	to: number;
}

/** Five bands of the 5,000 most frequent lemmas; the top is denser
 *  because the first thousand carry most of any text. */
export const VOCAB_BANDS: readonly VocabBand[] = [
	{ id: "b500", from: 0, to: 500 },
	{ id: "b1000", from: 500, to: 1000 },
	{ id: "b2000", from: 1000, to: 2000 },
	{ id: "b3500", from: 2000, to: 3500 },
	{ id: "b5000", from: 3500, to: 5000 },
];

export const WORDS_PER_BAND = 8;
export const PSEUDO_WORDS = 8;

export interface VocabItem {
	id: string;
	word: string;
	/** The band's id; null for a pseudoword (never shown to the learner). */
	band: string | null;
}

export interface VocabAnswer {
	id: string;
	yes: boolean;
}

export interface VocabBandScore extends VocabBand {
	n: number;
	hits: number;
	/** The share known after the correction for guessing. */
	share: number;
}

export interface VocabEstimate {
	/** Receptive vocabulary in lemmas, rounded to fifty. */
	size: number;
	bands: VocabBandScore[];
	pseudo: number;
	falseAlarms: number;
	falseAlarmRate: number;
	/** Fewer than half the pseudowords ticked: the figure can be trusted. */
	reliable: boolean;
}

/** Score the ticks. The correction is the classic one: a learner who
 *  ticks f of the pseudowords is assumed to tick f of the real words they
 *  do not know, so a band's true share is (h − f) / (1 − f). */
export function scoreVocab(items: readonly VocabItem[], answers: readonly VocabAnswer[]): VocabEstimate {
	const yes = new Set(answers.filter((a) => a.yes).map((a) => a.id));
	const pseudo = items.filter((i) => i.band === null);
	const falseAlarms = pseudo.filter((i) => yes.has(i.id)).length;
	const f = pseudo.length ? falseAlarms / pseudo.length : 0;
	const bands: VocabBandScore[] = VOCAB_BANDS.map((b) => {
		const mine = items.filter((i) => i.band === b.id);
		const hits = mine.filter((i) => yes.has(i.id)).length;
		const h = mine.length ? hits / mine.length : 0;
		const share = f >= 1 ? 0 : Math.max(0, (h - f) / (1 - f));
		return { ...b, n: mine.length, hits, share };
	});
	const raw = bands.reduce((n, b) => n + (b.to - b.from) * b.share, 0);
	return { size: Math.round(raw / 50) * 50, bands, pseudo: pseudo.length, falseAlarms, falseAlarmRate: f, reliable: f < 0.5 };
}

const VOWELS = "aáäeéiíoóuúyý";

/** Slovak-looking words that are not Slovak: the front of one real word
 *  spliced onto the back of another, kept only when the result is not in
 *  the dictionary (`isReal`) and reads like a word. Deterministic for a
 *  given `rand`. */
export function makePseudowords(words: readonly string[], count: number, rand: () => number, isReal: (w: string) => boolean): string[] {
	const pool = words.filter((w) => /^[a-záäčďéíĺľňóôŕšťúýž]{4,9}$/u.test(w));
	const out: string[] = [];
	const seen = new Set<string>();
	const cut = (w: string, after: number) => {
		// A cut point after the first vowel, leaving at least two letters on each side.
		let first = -1;
		for (let i = 0; i < w.length; i++)
			if (VOWELS.includes(w[i]!)) {
				first = i;
				break;
			}
		if (first < 0) return -1;
		const lo = Math.max(2, first + 1);
		const hi = w.length - 2;
		if (lo > hi) return -1;
		return lo + Math.floor(after * (hi - lo + 1));
	};
	for (let tries = 0; tries < count * 60 && out.length < count && pool.length >= 2; tries++) {
		const a = pool[Math.floor(rand() * pool.length)]!;
		const b = pool[Math.floor(rand() * pool.length)]!;
		if (a === b) continue;
		const i = cut(a, rand());
		const j = cut(b, rand());
		if (i < 0 || j < 0) continue;
		const w = a.slice(0, i) + b.slice(j);
		if (w.length < 4 || w.length > 10 || seen.has(w) || isReal(w)) continue;
		// No vowel-less stretches of four, no doubled vowels: it must read as Slovak.
		if (/[^aáäeéiíoóuúyý]{4}/u.test(w) || /[aáäeéiíoóuúyý]{2}/u.test(w)) continue;
		seen.add(w);
		out.push(w);
	}
	return out;
}
