import { DECLENSION_CASES, type GrammarNumber } from "./form-cells.ts";
import { normalizeAnswer } from "./language.ts";
import { exampleText, type LexiconEntry } from "./review.ts";

export interface WordCardExample {
	before: string;
	word: string;
	after: string;
	en: string;
}

export interface WordCardRow {
	grammarCase: string;
	singular: string | null;
	plural: string | null;
}

export interface WordCard {
	partOfSpeech?: string;
	gender?: string;
	table?: WordCardRow[];
	forms?: string[];
	examples: WordCardExample[];
}

const CASE_ORDER = [
	"nominative",
	"genitive",
	"partitive",
	"dative",
	"accusative",
	"locative",
	"prepositional",
	"instrumental",
	"illative",
	"inessive",
	"elative",
	"allative",
	"adessive",
	"ablative",
	"translative",
	"terminative",
	"essive",
	"abessive",
	"comitative",
	"vocative",
];

const NUMBERS: readonly GrammarNumber[] = ["singular", "plural"];

const PART_OF_SPEECH: Readonly<Record<string, string>> = {
	Nouns: "noun",
	Verbs: "verb",
	Adjectives: "adjective",
	Adverbs: "adverb",
	Phrases: "phrase",
	Places: "place name",
	Pronouns: "pronoun",
	Numbers: "number",
	Prepositions: "preposition",
	Conjunctions: "conjunction",
};

const MAX_EXAMPLES = 2;
const MAX_EXAMPLE_LENGTH = 72;

type CardEntry = Pick<
	LexiconEntry,
	"lemma" | "sk" | "cat" | "pos" | "gender" | "declension" | "forms" | "formTags" | "examples"
>;

function tableFromDeclension(declension: NonNullable<LexiconEntry["declension"]>): WordCardRow[] {
	return DECLENSION_CASES.map((grammarCase, i) => ({
		grammarCase,
		singular: declension.singular[i] ?? null,
		plural: declension.plural[i] ?? null,
	}));
}

function tableFromTags(formTags: Record<string, string[]>): WordCardRow[] | undefined {
	const cells = new Map<string, Record<GrammarNumber, string[]>>();
	for (const [form, tags] of Object.entries(formTags)) {
		for (const tag of tags) {
			const words = tag.split(" ");
			if (words.length !== 2) continue;
			const [grammarCase, number] = words as [string, GrammarNumber];
			if (!CASE_ORDER.includes(grammarCase) || !NUMBERS.includes(number)) continue;
			const row = cells.get(grammarCase) ?? { singular: [], plural: [] };
			if (!row[number].includes(form)) row[number].push(form);
			cells.set(grammarCase, row);
		}
	}
	if (cells.size < 2) return undefined;
	return CASE_ORDER.filter((c) => cells.has(c)).map((grammarCase) => {
		const row = cells.get(grammarCase)!;
		return {
			grammarCase,
			singular: row.singular.join(" / ") || null,
			plural: row.plural.join(" / ") || null,
		};
	});
}

function otherExamples(entry: CardEntry, index: number): WordCardExample[] {
	const own = exampleText(entry.examples[index] ?? {}).trim();
	const seen = new Set([own]);
	const picked: WordCardExample[] = [];
	for (const [i, ex] of entry.examples.entries()) {
		if (picked.length >= MAX_EXAMPLES) break;
		const text = exampleText(ex).trim();
		if (i === index || !ex.cloze || !ex.en || seen.has(text) || text.length > MAX_EXAMPLE_LENGTH) continue;
		seen.add(text);
		const { answer, at } = ex.cloze;
		picked.push({
			before: exampleText(ex).slice(0, at),
			word: answer,
			after: exampleText(ex).slice(at + answer.length),
			en: ex.en,
		});
	}
	return picked;
}

export function wordCardOf(entry: CardEntry, index: number): WordCard {
	const card: WordCard = { examples: otherExamples(entry, index) };
	const partOfSpeech = entry.pos ?? PART_OF_SPEECH[entry.cat];
	if (partOfSpeech) card.partOfSpeech = partOfSpeech.replace(/-/g, " ");
	if (entry.gender) card.gender = entry.gender.replace(/-/g, " ");
	const table = entry.declension
		? tableFromDeclension(entry.declension)
		: entry.formTags && entry.cat === "Nouns"
			? tableFromTags(entry.formTags)
			: undefined;
	if (table) card.table = table;
	else if (entry.forms?.length) {
		const lemma = entry.lemma ?? entry.sk ?? "";
		card.forms = [...new Set([lemma, ...entry.forms].filter(Boolean))];
	}
	return card;
}

export function sentenceKey(text: string): string {
	return text
		.normalize("NFC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function wholeWordPattern(answer: string): RegExp {
	const word = answer
		.normalize("NFC")
		.trim()
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(?<!\\p{L})${word}(?!\\p{L})`, "iu");
}

export function cardsWithoutOtherSentences<T extends { sentence: string; answer: string; card?: WordCard }>(
	items: readonly T[],
): T[] {
	const keys = items.map((item) => sentenceKey(item.sentence));
	return items.map((item, i) => {
		if (!item.card) return item;
		const elsewhere = new Set(keys.filter((_, j) => j !== i));
		const otherAnswers = items
			.filter((other, j) => j !== i && other.answer.trim() !== "")
			.map((other) => wholeWordPattern(other.answer));
		const examples = item.card.examples.filter((ex) => {
			const text = ex.before + ex.word + ex.after;
			return !elsewhere.has(sentenceKey(text)) && !otherAnswers.some((pattern) => pattern.test(text.normalize("NFC")));
		});
		return { ...item, card: { ...item.card, examples } };
	});
}

export function isAnsweredForm(cell: string | null, answer: string, tag: string): boolean {
	if (!cell) return false;
	const want = normalizeAnswer(answer, tag);
	return cell.split(" / ").some((form) => normalizeAnswer(form, tag) === want);
}
