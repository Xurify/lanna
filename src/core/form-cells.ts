import { foldDiacritics, normalizeAnswer } from "./language.ts";

/** The order of the six rows in the lexicon's `declension` lists, as the
 *  slovak.wiki export writes them (scripts/export-slovakwiki-lexicon.mjs). */
export const DECLENSION_CASES = ["nominative", "genitive", "dative", "accusative", "locative", "instrumental"] as const;

export type CaseName = (typeof DECLENSION_CASES)[number];
export type GrammarNumber = "singular" | "plural";

export interface FormCell {
	grammarCase: CaseName;
	number: GrammarNumber;
}

export interface Declension {
	singular: readonly string[];
	plural: readonly string[];
}

export type FormMismatch =
	| { kind: "number"; grammarCase: CaseName; given: GrammarNumber; needed: GrammarNumber }
	| { kind: "case"; number: GrammarNumber; given: readonly CaseName[]; needed: CaseName };

const NUMBERS: readonly GrammarNumber[] = ["singular", "plural"];

export function cellsOf(declension: Declension | undefined, word: string, tag = "sk-SK"): FormCell[] {
	if (!declension) return [];
	const key = (w: string) => normalizeAnswer(w, tag);
	const all = NUMBERS.flatMap((number) =>
		declension[number].flatMap((form, i) => {
			const grammarCase = DECLENSION_CASES[i];
			return grammarCase ? [{ key: key(form), cell: { grammarCase, number } }] : [];
		}),
	);
	const typed = key(word);
	if (!typed) return [];
	const exact = all.filter((x) => x.key === typed);
	const hits = exact.length > 0 ? exact : all.filter((x) => foldDiacritics(x.key) === foldDiacritics(typed));
	return hits.map((x) => x.cell);
}

export function cellsLabel(cells: readonly FormCell[]): string | undefined {
	if (cells.length === 0) return undefined;
	return cells.map((c) => `${c.grammarCase} ${c.number}`).join(" or ");
}

export function numberIn(cells: readonly FormCell[], grammarCase: CaseName): GrammarNumber | undefined {
	const numbers = new Set(cells.filter((c) => c.grammarCase === grammarCase).map((c) => c.number));
	return numbers.size === 1 ? [...numbers][0] : undefined;
}

export function formMismatch(
	given: readonly FormCell[],
	needed: readonly FormCell[],
	neededCase?: CaseName,
): FormMismatch | undefined {
	const candidates = neededCase ? needed.filter((c) => c.grammarCase === neededCase) : needed;
	if (candidates.length !== 1 || given.length === 0) return undefined;
	const target = candidates[0]!;
	const sameCase = given.find((c) => c.grammarCase === target.grammarCase && c.number !== target.number);
	if (sameCase)
		return { kind: "number", grammarCase: target.grammarCase, given: sameCase.number, needed: target.number };
	const sameNumber = given.filter((c) => c.number === target.number);
	if (sameNumber.length === 0) return undefined;
	return {
		kind: "case",
		number: target.number,
		given: [...new Set(sameNumber.map((c) => c.grammarCase))],
		needed: target.grammarCase,
	};
}

// Slovak noun endings from the declension patterns in Pravidlá slovenského
// pravopisu (chlap, hrdina, dub, stroj, žena, ulica, dlaň, kosť, mesto, srdce,
// vysvedčenie, dievča). Only the cases where no singular ending is also a
// plural ending of the same case.
const NUMBER_ENDINGS: Readonly<Record<string, Partial<Record<CaseName, Record<GrammarNumber, RegExp>>>>> = {
	sk: {
		dative: { singular: /(u|ovi|e|i)$/, plural: /(om|ám|am|iam)$/ },
		locative: { singular: /(e|i|u|ovi|í)$/, plural: /ch$/ },
		instrumental: { singular: /(om|ou|ím)$/, plural: /mi$/ },
	},
};

export function numberByEnding(word: string, grammarCase: CaseName, tag = "sk-SK"): GrammarNumber | undefined {
	const endings = NUMBER_ENDINGS[tag.split("-")[0]!.toLowerCase()]?.[grammarCase];
	const w = normalizeAnswer(word, tag);
	if (!endings || !w) return undefined;
	const numbers = NUMBERS.filter((n) => endings[n].test(w));
	return numbers.length === 1 ? numbers[0] : undefined;
}

export interface FormContrastInput {
	given: string;
	answer: string;
	lemma: string;
	neededCase?: CaseName;
	isNoun?: boolean;
	declension?: Declension;
	forms?: readonly string[];
}

export interface FormContrast {
	givenForm?: string;
	mismatch?: FormMismatch;
}

export function formContrast(input: FormContrastInput, tag = "sk-SK"): FormContrast {
	if (input.declension) {
		const given = cellsOf(input.declension, input.given, tag).sort(
			(a, b) => Number(b.grammarCase === input.neededCase) - Number(a.grammarCase === input.neededCase),
		);
		const givenForm = cellsLabel(given);
		const mismatch = formMismatch(given, cellsOf(input.declension, input.answer, tag), input.neededCase);
		return { ...(givenForm ? { givenForm } : {}), ...(mismatch ? { mismatch } : {}) };
	}
	const kase = input.neededCase;
	if (!kase || !input.isNoun) return {};
	const key = (w: string) => normalizeAnswer(w, tag);
	const known = [input.lemma, ...(input.forms ?? [])].some((f) => key(f) === key(input.given));
	if (!known) return {};
	const given = numberByEnding(input.given, kase, tag);
	const needed = numberByEnding(input.answer, kase, tag);
	if (!given || !needed || given === needed) return {};
	return {
		givenForm: `${kase} ${given}`,
		mismatch: { kind: "number", grammarCase: kase, given, needed },
	};
}
