import { foldDiacritics, normalizeAnswer } from "./language.ts";
import { formSlip, type FormSlip } from "./form-slip.ts";

export interface MissWord {
	lemma: string;
	gloss: string;
	isLemma: boolean;
}

export interface MissReason {
	slip: FormSlip;
	lemma: string;
	gloss: string;
	other?: MissWord;
	form?: string;
	trigger?: string;
}

interface MissInput {
	answer: string;
	lemma: string;
	gloss: string;
	given: string;
	forms?: readonly string[];
	form?: string;
	trigger?: string;
	rankedEntriesOfGiven?: readonly MissWord[];
}

export function missReason(input: MissInput, tag = "sk-SK"): MissReason | undefined {
	const slip = formSlip({ answer: input.answer, lemma: input.lemma, given: input.given, forms: input.forms }, tag);
	if (!slip) return undefined;
	const key = (w: string) => foldDiacritics(normalizeAnswer(w, tag));
	const given = key(input.given);
	const givenIsOwnForm = [input.lemma, ...(input.forms ?? [])].some((f) => key(f) === given);
	const anotherWord = slip !== "blank" && !givenIsOwnForm ? input.rankedEntriesOfGiven?.find((o) => key(o.lemma) !== key(input.lemma)) : undefined;
	return {
		slip: anotherWord ? "other" : slip,
		lemma: input.lemma,
		gloss: input.gloss,
		...(anotherWord ? { other: anotherWord } : {}),
		...(input.form ? { form: input.form } : {}),
		...(input.trigger ? { trigger: input.trigger } : {}),
	};
}
