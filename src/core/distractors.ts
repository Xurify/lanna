/**
 * Wrong answers worth reading (LangHarness, 2026-10-30, from "a lot of these
 * questions are very easy"). A meaning question is only a test when the
 * wrong meanings are close to the right one: the same sentence with the
 * person, tense or polarity changed. Three sources, best first:
 *
 *   1. near-misses the cheap model wrote for this exact sentence, kept on
 *      disk (src/server/distractors.ts), so a sentence is paid for once;
 *   2. neighbors: other dictionary translations that share most of their
 *      words with the right one ("Do you look like an actor?" next to "Do I
 *      look like an actor?"), found with an inverted index, free;
 *   3. the old length-matched pool, only to fill a short list.
 *
 * Pure: the server decides what to ask the model for.
 */

import { shuffle } from "./lesson.ts";

/** Jaccard overlap below which a neighbor is just another sentence. */
export const MIN_CLOSE = 0.3;
/** At or above it a neighbor is a paraphrase, which could also be right. */
export const MAX_CLOSE = 0.85;

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;

export function tokens(text: string): string[] {
	return (text.toLowerCase().match(WORD) ?? []).map((w) => w.replace(/’/g, "'"));
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
	let inter = 0;
	for (const x of a) if (b.has(x)) inter++;
	const union = a.size + b.size - inter;
	return union === 0 ? 0 : inter / union;
}

export interface NeighborIndex {
	sentences: string[];
	sets: Array<Set<string>>;
	byWord: Map<string, number[]>;
}

/** Index translations by word. Words in more than 4% of them (the, I, a)
 *  find nothing specific and are left out of the candidate lookup. */
export function buildNeighborIndex(translations: readonly string[]): NeighborIndex {
	const sentences = [...new Set(translations.map((t) => t.trim()).filter(Boolean))];
	const sets = sentences.map((s) => new Set(tokens(s)));
	const byWord = new Map<string, number[]>();
	sets.forEach((set, i) => {
		for (const w of set) {
			const list = byWord.get(w);
			if (list) list.push(i);
			else byWord.set(w, [i]);
		}
	});
	const common = Math.max(50, sentences.length * 0.04);
	for (const [w, list] of byWord) if (list.length > common) byWord.delete(w);
	return { sentences, sets, byWord };
}

export interface Neighbor {
	text: string;
	score: number;
}

/** Translations close to `own`, closest first, never `own` itself nor a
 *  paraphrase of it. */
export function neighbors(index: NeighborIndex, own: string, limit = 12): Neighbor[] {
	const mine = new Set(tokens(own));
	const hits = new Map<number, number>();
	for (const w of mine) for (const i of index.byWord.get(w) ?? []) hits.set(i, (hits.get(i) ?? 0) + 1);
	const ownKey = own.trim().toLowerCase();
	const scored: Neighbor[] = [];
	for (const [i] of [...hits].sort((a, b) => b[1] - a[1]).slice(0, 80)) {
		const text = index.sentences[i]!;
		if (text.toLowerCase() === ownKey) continue;
		const score = jaccard(mine, index.sets[i]!);
		if (score >= MIN_CLOSE && score < MAX_CLOSE) scored.push({ text, score });
	}
	return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface OptionChoice {
	options: string[];
	/** How many wrong options came from near-misses or close neighbors. */
	close: number;
}

/**
 * The right meaning plus `count - 1` wrong ones. Cached near-misses first,
 * then close neighbors (a random few of the closest, so a repeat differs),
 * then the length-matched pool to fill. `close` tells the caller whether a
 * model near-miss is still worth asking for.
 */
export function chooseOptions(own: string, near: readonly string[], close: readonly Neighbor[], fallback: readonly string[], rand: () => number, count = 3): OptionChoice {
	const key = (s: string) => s.trim().toLowerCase();
	const seen = new Set([key(own)]);
	const picked: string[] = [];
	const take = (list: readonly string[]) => {
		for (const s of list) {
			if (picked.length >= count - 1) return;
			if (!s.trim() || seen.has(key(s))) continue;
			seen.add(key(s));
			picked.push(s.trim());
		}
	};
	take(near);
	take(shuffle(close.slice(0, 5).map((n) => n.text), rand));
	const closeCount = picked.length;
	const ownLen = own.trim().length;
	take(shuffle([...new Set(fallback)], rand).sort((a, b) => Math.abs(a.length - ownLen) - Math.abs(b.length - ownLen)).slice(0, 6));
	return { options: shuffle([own.trim(), ...picked], rand), close: closeCount };
}
