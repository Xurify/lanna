import { foldDiacritics, normalizeAnswer } from "./language.ts";
import { formSlip, type FormSlip } from "./form-slip.ts";
import { shortGloss } from "./lesson.ts";
import { pairContrastRule } from "./mixups.ts";
import { entryLemma, exampleText, type LexiconEntry, type LexiconExample } from "./review.ts";

export interface MissExample {
	text: string;
	en: string;
	asks?: boolean;
}

export interface MissWord {
	lemma: string;
	gloss: string;
	isLemma: boolean;
	alsoMeans?: string;
	hereMeans?: string;
	partOfSpeech?: string;
	herePartOfSpeech?: string;
	rule?: string;
	example?: MissExample;
}

export interface MissReason {
	slip: FormSlip;
	lemma: string;
	gloss: string;
	inflects: boolean;
	asks?: boolean;
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
	asks?: boolean;
	form?: string;
	trigger?: string;
	rankedEntriesOfGiven?: readonly MissWord[];
}

const senses = (en: string): string[] =>
	en
		.split(";")
		.map((s) => s.trim())
		.filter(Boolean);
const senseHead = (sense: string) => sense.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const ENTRY_ASPECT = /\((im)?perfective\)\s*$/;

export function sharedMeaning(a: string, b: string): string | undefined {
	const theirs = new Set(senses(b).map(senseHead));
	const sense = senses(a).find((s) => senseHead(s) && theirs.has(senseHead(s)));
	const aspect = a.match(ENTRY_ASPECT)?.[0];
	return sense && aspect && !/perfective/.test(sense) ? `${sense} ${aspect}` : sense;
}

const PART_OF_SPEECH: Readonly<Record<string, string>> = { Nouns: "noun", Verbs: "verb", Adjectives: "adjective", Adverbs: "adverb" };

export function partsOfSpeechIfDifferent(a: string, b: string): [string, string] | undefined {
	const pa = PART_OF_SPEECH[a];
	const pb = PART_OF_SPEECH[b];
	return pa && pb && pa !== pb ? [pa, pb] : undefined;
}

export function startsQuestion(sentence: string, word: string, tag = "sk-SK"): boolean {
	const key = (w: string) => foldDiacritics(normalizeAnswer(w, tag));
	const first = sentence.split(/[^\p{L}]+/u).find(Boolean) ?? "";
	return sentence.trim().endsWith("?") && key(first) === key(word);
}

export function contrastExample(examples: readonly Pick<LexiconExample, "text" | "sk" | "en" | "rejected">[], word: string, tag = "sk-SK"): MissExample | undefined {
	const key = (w: string) => foldDiacritics(normalizeAnswer(w, tag));
	const target = key(word);
	const usable: MissExample[] = examples.filter((e) => !e.rejected && e.en && exampleText(e)).map((e) => ({ text: exampleText(e), en: e.en }));
	const hasWord = (e: MissExample) => e.text.split(/[^\p{L}]+/u).some((t) => key(t) === target);
	const pool = usable.some(hasWord) ? usable.filter(hasWord) : usable;
	const example = [...pool].sort((a, b) => a.text.length - b.text.length)[0];
	return example && startsQuestion(example.text, word, tag) ? { ...example, asks: true } : example;
}

export function missWordOf(
	card: { slug: string; lemma: string; entry?: Pick<LexiconEntry, "en" | "cat"> },
	other: LexiconEntry,
	opts: { typed: string; isLemma: boolean; language: string },
	tag = "sk-SK",
): MissWord {
	const alsoMeans = card.entry ? sharedMeaning(other.en, card.entry.en) : undefined;
	const hereMeans = card.entry ? sharedMeaning(card.entry.en, other.en) : undefined;
	const pos = card.entry ? partsOfSpeechIfDifferent(other.cat, card.entry.cat) : undefined;
	const rule = pairContrastRule(opts.language, { slug: card.slug, lemma: card.lemma }, { slug: other.slug, lemma: entryLemma(other) });
	const example = contrastExample(other.examples, opts.typed, tag);
	return {
		lemma: entryLemma(other),
		gloss: shortGloss(other.en),
		isLemma: opts.isLemma,
		...(alsoMeans ? { alsoMeans } : {}),
		...(hereMeans ? { hereMeans } : {}),
		...(pos ? { partOfSpeech: pos[0], herePartOfSpeech: pos[1] } : {}),
		...(rule ? { rule } : {}),
		...(example ? { example } : {}),
	};
}

export type ContrastSource = "rule" | "part of speech" | "meaning note" | "question" | "example" | "none";

export function contrastSource(word: MissWord, cardAsks: boolean): ContrastSource {
	if (word.rule) return "rule";
	if (word.partOfSpeech) return "part of speech";
	if (word.alsoMeans && word.hereMeans && word.alsoMeans !== word.hereMeans && /\(/.test(word.alsoMeans + word.hereMeans)) return "meaning note";
	if (word.example && Boolean(word.example.asks) !== cardAsks) return "question";
	return word.example ? "example" : "none";
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
		...(input.asks ? { asks: true } : {}),
		...(anotherWord ? { other: anotherWord } : {}),
		...(input.form ? { form: input.form } : {}),
		...(input.trigger ? { trigger: input.trigger } : {}),
	};
}
