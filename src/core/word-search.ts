/**
 * Ranked search over the word list. A learner who types "s" expects words that start with s, not
 * every word whose English meaning happens to contain the letter. Ranks, best first:
 *   1 the headword starts with the query     2 the headword contains it
 *   3 an inflected form matches              4 the English meaning has a word starting with it
 *   5 an example sentence has it (queries of 3 or more letters only)
 * A query of several words ("veľký záujem") finds a sentence that has them side by side; the last word
 * may still be unfinished. One letter matches headword starts only. Two letters never search examples. Case and diacritics are
 * ignored in both directions ("c" finds "čas", "cas" finds "čas").
 */

export type WordMatchKind = "start" | "contains" | "form" | "meaning" | "example";

export interface WordSearchMatch {
	rank: 1 | 2 | 3 | 4 | 5;
	kind: WordMatchKind;
	/** Where the query sits in the headword, for highlighting (kinds start and contains). */
	span?: [number, number];
	/** The matching meaning word, form or sentence, for the quiet "matches meaning: speak" line. */
	via?: string;
}

export interface SearchableWord {
	lemma: string;
	gloss: string;
	forms?: readonly string[];
	examples?: readonly { sk: string; en?: string }[];
}

/** Lowercase and strip accents one character at a time, so indexes still line up with the original text. */
export function fold(text: string): string {
	let out = "";
	for (const ch of text) {
		const f = ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
		out += f.length === ch.length ? f : ch.toLowerCase().slice(0, ch.length);
	}
	return out;
}

/** The letters-only words of `text`, folded and joined by single spaces. */
const wordsOf = (text: string): string => (fold(text).match(/\p{L}+/gu) ?? []).join(" ");

/** `q` sits in `text` at the start of a word: one word's beginning, or several words in a row. */
const startsAtWord = (text: string, q: string): boolean => {
	const words = wordsOf(text);
	const query = wordsOf(q);
	return !!query && (words.startsWith(query) || words.includes(` ${query}`));
};

const meaningWord = (gloss: string, q: string): string | undefined => {
	const f = fold(gloss);
	const words = gloss.match(/\p{L}+/gu) ?? [];
	let at = 0;
	for (const w of words) {
		const i = f.indexOf(fold(w), at);
		at = i + w.length;
		if (fold(w).startsWith(q)) return w;
	}
	return undefined;
};

export function matchWord(rawQuery: string, w: SearchableWord): WordSearchMatch | null {
	const q = fold(rawQuery.trim());
	if (!q) return null;
	const head = fold(w.lemma);
	if (head.startsWith(q)) return { rank: 1, kind: "start", span: [0, q.length] };
	if (q.length === 1) return null;
	const at = head.indexOf(q);
	if (at > 0) return { rank: 2, kind: "contains", span: [at, at + q.length] };
	const form = w.forms?.find((f) => fold(f).startsWith(q));
	if (form) return { rank: 3, kind: "form", via: form };
	const meaning = meaningWord(w.gloss, q);
	if (meaning) return { rank: 4, kind: "meaning", via: meaning };
	if (q.length >= 3) {
		const ex = w.examples?.find((e) => startsAtWord(e.sk, q));
		if (ex) return { rank: 5, kind: "example", via: ex.sk };
	}
	return null;
}

/** Best match first, then the commoner word (lower frequency rank). */
export function compareMatches(a: { match: WordSearchMatch; rank?: number }, b: { match: WordSearchMatch; rank?: number }): number {
	return a.match.rank - b.match.rank || (a.rank ?? 99999) - (b.rank ?? 99999);
}
