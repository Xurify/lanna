/**
 * Form slips (LangHarness, 2026-10-31): what a wrong answer on a form drill
 * got wrong, named from the word's dictionary form and its known forms. The
 * verdict does not change (exact, accents, wrong); a slip says what kind of
 * wrong it was, so the grammar atlas can show the pattern behind a cell.
 * Pure and browser-safe.
 *
 *   base       the dictionary form where an inflected form was needed:
 *              "stanica" for "stanice" (the case was never applied)
 *   same-word  another form of the same word, or the word with another
 *              ending: "stanicu" for "stanice" (the wrong case)
 *   other      a different word, or anything else
 *   blank      nothing typed ("I don't know")
 */

import { compareAnswer, foldDiacritics, normalizeAnswer } from "./language.ts";

export type FormSlip = "base" | "same-word" | "other" | "blank";

export const FORM_SLIPS: readonly FormSlip[] = ["base", "same-word", "other", "blank"];

export const FORM_SLIP_LABEL: Readonly<Record<FormSlip, string>> = {
	base: "dictionary form, no ending",
	"same-word": "wrong ending",
	other: "other word",
	blank: "no answer",
};

/** The longest ending a form may add to the lemma's stem (Slovak endings:
 *  -ovia, -iami, -ými are four letters). */
const MAX_ENDING = 4;

/** The word's other forms the dictionary vouches for: the lexicon's verified
 *  list and its noun declension, without the lemma and without phrases. */
export function knownForms(entry: { sk: string; forms?: readonly string[]; declension?: { singular: readonly string[]; plural: readonly string[] } }): string[] {
	const lemma = entry.sk.toLowerCase();
	const all = [...(entry.forms ?? []), ...(entry.declension?.singular ?? []), ...(entry.declension?.plural ?? [])];
	return [...new Set(all.map((f) => f.trim()).filter((f) => f && !/\s/.test(f) && f.toLowerCase() !== lemma))];
}

/** Whether a word is a form of the lemma: the lemma itself, one of its known
 *  forms, or the lemma's stem with a short ending (stanic + e, stanic + ou).
 *  Diacritics do not count: a missing accent is not a different word. The
 *  stem is the lemma without its last letter, and only when that leaves three
 *  letters (dom and pes have none to share). */
export function isFormOf(word: string, lemma: string, forms: readonly string[] = [], tag = "sk-SK"): boolean {
	const w = foldDiacritics(normalizeAnswer(word, tag));
	const l = foldDiacritics(normalizeAnswer(lemma, tag));
	if (!w || !l) return false;
	if (w === l) return true;
	if (forms.some((f) => foldDiacritics(normalizeAnswer(f, tag)) === w)) return true;
	const stem = l.slice(0, -1);
	return stem.length >= 3 && w.startsWith(stem) && w.length - stem.length <= MAX_ENDING;
}

export interface FormSlipInput {
	/** The form the sentence needs. */
	answer: string;
	/** The word's dictionary form. */
	lemma: string;
	/** What the learner wrote. */
	given: string;
	/** The word's other known forms (knownForms), when the lexicon has them. */
	forms?: readonly string[];
}

/** The slip behind a wrong answer. Undefined when the answer is right (exact,
 *  or only the accents missing): a slip names what a wrong answer got wrong. */
export function formSlip(input: FormSlipInput, tag = "sk-SK"): FormSlip | undefined {
	if (!normalizeAnswer(input.given, tag)) return "blank";
	if (compareAnswer(input.answer, input.given, tag) !== "wrong") return undefined;
	if (!isFormOf(input.given, input.lemma, input.forms, tag)) return "other";
	return foldDiacritics(normalizeAnswer(input.given, tag)) === foldDiacritics(normalizeAnswer(input.lemma, tag)) ? "base" : "same-word";
}
