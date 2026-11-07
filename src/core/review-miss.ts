/**
 * Why a review answer was wrong (LangHarness, 2026-11-07). The verdict said
 * "Not quite" and showed the answer, but never what the learner's word was
 * or what the sentence asked for, so "večer" for "večeri" (evening for
 * dinner, and the wrong case on top) read as a typo. Pure and browser-safe.
 */

import { foldDiacritics, normalizeAnswer } from "./language.ts";
import { formSlip, type FormSlip } from "./form-slip.ts";

/** Another dictionary word the learner's answer belongs to. */
export interface MissWord {
	lemma: string;
	gloss: string;
	/** The answer is this word's dictionary form, not one of its other forms. */
	isLemma: boolean;
}

export interface MissReason {
	slip: FormSlip;
	/** The card's word in its dictionary form, and what it means. */
	lemma: string;
	gloss: string;
	/** Set when the answer is a different word the dictionary knows. */
	other?: MissWord;
	/** The answer's form in plain words ("locative of večera (feminine)"). */
	form?: string;
	/** The preposition right before the blank, when one decides the case. */
	trigger?: string;
}

export interface MissInput {
	answer: string;
	lemma: string;
	gloss: string;
	given: string;
	/** The card word's other known forms (knownForms). */
	forms?: readonly string[];
	form?: string;
	trigger?: string;
	/** Dictionary words the given word is a form of, best match first. */
	others?: readonly MissWord[];
}

/** Undefined when the answer is right or only the accents are off. */
export function missReason(input: MissInput, tag = "sk-SK"): MissReason | undefined {
	const slip = formSlip({ answer: input.answer, lemma: input.lemma, given: input.given, forms: input.forms }, tag);
	if (!slip) return undefined;
	const key = (w: string) => foldDiacritics(normalizeAnswer(w, tag));
	const given = key(input.given);
	const own = [input.lemma, ...(input.forms ?? [])].some((f) => key(f) === given);
	// formSlip guesses a shared stem, and "večer" (evening) starts like
	// "večera" (dinner). A word the dictionary files under another lemma
	// is that word, whatever it shares with this one.
	const other = slip !== "blank" && !own ? input.others?.find((o) => key(o.lemma) !== key(input.lemma)) : undefined;
	return {
		slip: other ? "other" : slip,
		lemma: input.lemma,
		gloss: input.gloss,
		...(other ? { other } : {}),
		...(input.form ? { form: input.form } : {}),
		...(input.trigger ? { trigger: input.trigger } : {}),
	};
}
