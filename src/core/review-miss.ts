import { foldDiacritics, normalizeAnswer } from "./language.ts";
import { formSlip, type FormSlip } from "./form-slip.ts";
import { exampleText, type LexiconExample } from "./review.ts";

export interface MissExample {
	text: string;
	en: string;
}

export interface MissWord {
	lemma: string;
	gloss: string;
	isLemma: boolean;
	alsoMeans?: string;
	example?: MissExample;
}

export interface MissReason {
	slip: FormSlip;
	lemma: string;
	gloss: string;
	inflects: boolean;
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
	inflects?: boolean;
	form?: string;
	trigger?: string;
	rankedEntriesOfGiven?: readonly MissWord[];
}

const senseHeads = (en: string): string[] =>
	en
		.split(";")
		.map((s) => s.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim())
		.filter(Boolean);

export function sharedMeaning(a: string, b: string): string | undefined {
	const theirs = new Set(senseHeads(b).map((s) => s.toLowerCase()));
	return senseHeads(a).find((s) => theirs.has(s.toLowerCase()));
}

export function contrastExample(examples: readonly Pick<LexiconExample, "text" | "sk" | "en" | "rejected">[], word: string, tag = "sk-SK"): MissExample | undefined {
	const key = (w: string) => foldDiacritics(normalizeAnswer(w, tag));
	const target = key(word);
	const usable: MissExample[] = examples.filter((e) => !e.rejected && e.en && exampleText(e)).map((e) => ({ text: exampleText(e), en: e.en }));
	const hasWord = (e: MissExample) => e.text.split(/[^\p{L}]+/u).some((t) => key(t) === target);
	const pool = usable.some(hasWord) ? usable.filter(hasWord) : usable;
	return [...pool].sort((a, b) => a.text.length - b.text.length)[0];
}

export function missReason(input: MissInput, tag = "sk-SK"): MissReason | undefined {
	const formSlipOfGiven = formSlip({ answer: input.answer, lemma: input.lemma, given: input.given, forms: input.forms }, tag);
	if (!formSlipOfGiven) return undefined;
	const inflects = input.inflects ?? true;
	const slip = !inflects && formSlipOfGiven === "same-word" ? "other" : formSlipOfGiven;
	const key = (w: string) => foldDiacritics(normalizeAnswer(w, tag));
	const given = key(input.given);
	const givenIsOwnForm = [input.lemma, ...(input.forms ?? [])].some((f) => key(f) === given);
	const anotherWord = slip !== "blank" && !givenIsOwnForm ? input.rankedEntriesOfGiven?.find((o) => key(o.lemma) !== key(input.lemma)) : undefined;
	return {
		slip: anotherWord ? "other" : slip,
		lemma: input.lemma,
		gloss: input.gloss,
		inflects,
		...(anotherWord ? { other: anotherWord } : {}),
		...(input.form ? { form: input.form } : {}),
		...(input.trigger ? { trigger: input.trigger } : {}),
	};
}
