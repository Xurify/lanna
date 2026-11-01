/**
 * Dvojičky — contrast pairs (LangHarness, 2026-10-30): the twins a learner
 * mixes up, taught as a choice between two forms in real sentences. The
 * data lives in curriculum/slovak/pairs.json (authored, not generated);
 * this module is the pure machinery on top of it: which verified lexicon
 * sentences drill a pair, and the drop rule.
 *
 * A pair's sentences come from the lexicon's VERIFIED examples (ones with a
 * cloze, the token the sentence really has) of the two entries themselves,
 * and only when the sentence contains exactly one of the two forms — a
 * sentence that could be either twin teaches nothing. A pair with fewer
 * than three such sentences is dropped (there is nothing to drill).
 *
 * Pure and browser-safe: the JSON is bundled, no fs.
 */

import pairsJson from "../../curriculum/slovak/pairs.json";
import { entryLemma, exampleText, type LexiconEntry } from "./review.ts";
import { LANGUAGE_IDS, LANGUAGES, type LanguageId } from "./language.ts";

export interface PairDef {
	id: string;
	/** The twins, as lexicon lemmas (ísť, chodiť…). */
	a: string;
	b: string;
	/** One English line, shown after a second miss. */
	rule: string;
	/** One bridge line, shown after a second miss. */
	bridge: string;
	/** The chapter that teaches the pair (its unit sits after the forms step). */
	chapter: string;
}

const PAIRS_BY_LANGUAGE: Partial<Record<LanguageId, PairDef[]>> = {
	slovak: (pairsJson as { pairs: PairDef[] }).pairs,
};

export function getPairsForLanguage(lang: string = "slovak"): PairDef[] {
	const known = LANGUAGE_IDS.find((id) => id === lang);
	return known ? (PAIRS_BY_LANGUAGE[known] ?? []) : [];
}

export const PAIRS: PairDef[] = (pairsJson as { pairs: PairDef[] }).pairs;

/** Sentences a pair must have on the two sides together, or it is dropped. */
export const MIN_PAIR_SENTENCES = 3;

/** One verified sentence for a pair: which entry it came from, which twin
 *  it uses, and the form itself with where it starts. */
export interface PairSentence {
	entry: LexiconEntry;
	index: number;
	member: "a" | "b";
	/** The verified form the sentence really has (the cloze answer). */
	form: string;
	at: number;
}

/** Every string a lexicon entry attests as a form of itself: the lemma, the
 *  verified generated forms, the hand-checked paradigm, and the cloze
 *  answers of its own examples (attested in sentences). */
export function formsOfEntry(entry: LexiconEntry, tag = "sk-SK"): string[] {
	const out = new Set<string>();
	const lemma = entryLemma(entry);
	for (const form of [lemma, ...(entry.forms ?? []), ...(entry.declension?.singular ?? []), ...(entry.declension?.plural ?? [])]) {
		if (form) out.add(form.toLocaleLowerCase(tag));
	}
	for (const example of entry.examples) {
		if (example.cloze && !example.rejected) out.add(example.cloze.answer.toLocaleLowerCase(tag));
	}
	return [...out].filter(Boolean);
}

/** A whole-word matcher over the forms (case-insensitive — a sentence may
 *  open with the form; diacritics exact — ď is not d). Longest forms
 *  first, so a form that contains another can never shadow it. */
function formRegex(forms: readonly string[]): RegExp {
	const escaped = [...new Set(forms)]
		.map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.sort((a, b) => b.length - a.length);
	return new RegExp(`(?<![\\p{L}])(${escaped.join("|")})(?![\\p{L}])`, "iu");
}

const byLemma = (entries: readonly LexiconEntry[], lemma: string) =>
	entries.find((entry) => entryLemma(entry) === lemma || entry.sk === lemma);

/** The verified examples of the pair's two entries that contain exactly one
 *  of the two forms. The cloze answer is the target; the other twin must
 *  not appear anywhere in the sentence. */
export function pairSentences(entries: readonly LexiconEntry[], pair: PairDef): PairSentence[] {
	const entryA = byLemma(entries, pair.a);
	const entryB = byLemma(entries, pair.b);
	if (!entryA || !entryB) return [];
	return twinSentences(entryA, entryB);
}

/** The same rule for two entries already in hand (src/core/mixups.ts names
 *  its twins by slug, because a lemma such as domov has two entries). */
export function twinSentences(entryA: LexiconEntry, entryB: LexiconEntry): PairSentence[] {
	const regexA = formRegex(formsOfEntry(entryA));
	const regexB = formRegex(formsOfEntry(entryB));
	const out: PairSentence[] = [];
	for (const [entry, ownRegex, otherRegex, member] of [
		[entryA, regexA, regexB, "a"],
		[entryB, regexB, regexA, "b"],
	] as const) {
		entry.examples.forEach((example, index) => {
			if (!example.cloze || example.rejected) return;
			if (otherRegex.test(exampleText(example))) return;
			out.push({ entry, index, member, form: example.cloze.answer, at: example.cloze.at });
		});
	}
	return out;
}

/** The pairs that survive the drop rule, each with its sentences — pairs in
 *  file order, sentences in lexicon order. */
export function pairsWithSentences(
	entries: readonly LexiconEntry[],
	pairs: readonly PairDef[] = PAIRS,
): Array<{ pair: PairDef; sentences: PairSentence[] }> {
	const out: Array<{ pair: PairDef; sentences: PairSentence[] }> = [];
	for (const pair of pairs) {
		const sentences = pairSentences(entries, pair);
		if (sentences.length >= MIN_PAIR_SENTENCES) out.push({ pair, sentences });
	}
	return out;
}

/** A chapter's pairs, in file order (the unit id is `pairs-<chapter>`). */
export function chapterPairs(chapterId: string, pairs: readonly PairDef[] = PAIRS): PairDef[] {
	return pairs.filter((p) => p.chapter === chapterId);
}

/** The pair's two lexicon entries, in a / b order. */
export function pairMembers(entries: readonly LexiconEntry[], pair: PairDef): [LexiconEntry, LexiconEntry] | null {
	const ea = byLemma(entries, pair.a);
	const eb = byLemma(entries, pair.b);
	return ea && eb ? [ea, eb] : null;
}
