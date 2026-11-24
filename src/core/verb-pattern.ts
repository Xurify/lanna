import type { LexiconEntry } from "./review.ts";

export interface PatternForm {
	stem: string;
	ending: string;
	tail?: string;
	en?: string;
}

export interface PatternRow {
	who: string;
	en: string;
	forms: PatternForm[];
}

export interface VerbPattern {
	verb: string;
	gloss: string;
	tense: "present" | "past";
	rows: PatternRow[];
}

export const PATTERN_VERBS: Readonly<Record<string, readonly string[]>> = {
	present: ["čítať", "hovoriť"],
	"present-ujem": ["pracovať"],
	"present-em": ["písať"],
	past: ["robiť"],
};

const PERSONS: ReadonlyArray<[string, string]> = [
	["ja", "I"],
	["ty", "you"],
	["on, ona, ono", "he, she, it"],
	["my", "we"],
	["vy", "you all"],
	["oni, ony", "they"],
];

function commonPrefix(forms: readonly string[]): string {
	let prefix = forms[0] ?? "";
	for (const form of forms) while (!form.startsWith(prefix)) prefix = prefix.slice(0, -1);
	return prefix;
}

const split = (form: string, stem: string, tail?: string, en?: string): PatternForm => ({
	stem,
	ending: form.slice(stem.length),
	...(tail ? { tail } : {}),
	...(en ? { en } : {}),
});

function presentForms(forms: readonly string[]): string[] | undefined {
	const six = forms.slice(0, 6);
	if (six.length < 6) return undefined;
	const [ja, ty, , my, vy] = six;
	if (!ja!.endsWith("m") || !ty!.endsWith("š") || !my!.endsWith("me") || !vy!.endsWith("te")) return undefined;
	return six;
}

function pastForms(forms: readonly string[]): string[] | undefined {
	const four = forms.slice(-4);
	if (four.length < 4) return undefined;
	const [m, f, n, pl] = four;
	if (!/l$/.test(m!) || !f!.endsWith("la") || !n!.endsWith("lo") || !pl!.endsWith("li")) return undefined;
	return four;
}

function presentPattern(forms: readonly string[]): PatternRow[] | undefined {
	const six = presentForms(forms);
	if (!six) return undefined;
	const stem = commonPrefix(six);
	return six.map((form, i) => ({ who: PERSONS[i]![0], en: PERSONS[i]![1], forms: [split(form, stem)] }));
}

function pastPattern(forms: readonly string[]): PatternRow[] | undefined {
	const four = pastForms(forms);
	if (!four) return undefined;
	const [m, f, n, pl] = four as [string, string, string, string];
	const stem = commonPrefix(four).replace(/l$/, "");
	const of = (form: string, tail?: string, en?: string) => split(form, stem, tail, en);
	return [
		{ who: "ja", en: "I (man, woman)", forms: [of(m, "som", "I (man)"), of(f, "som", "I (woman)")] },
		{ who: "ty", en: "you (man, woman)", forms: [of(m, "si", "you (man)"), of(f, "si", "you (woman)")] },
		{ who: "on", en: "he", forms: [of(m)] },
		{ who: "ona", en: "she", forms: [of(f)] },
		{ who: "ono", en: "it", forms: [of(n)] },
		{ who: "my", en: "we", forms: [of(pl, "sme")] },
		{ who: "vy", en: "you all", forms: [of(pl, "ste")] },
		{ who: "oni, ony", en: "they", forms: [of(pl)] },
	];
}

export function verbPatterns(entries: readonly LexiconEntry[], unit: string): VerbPattern[] {
	const verbs = PATTERN_VERBS[unit];
	if (!verbs) return [];
	const out: VerbPattern[] = [];
	for (const verb of verbs) {
		const entry = entries.find((e) => (e.sk ?? e.lemma) === verb && e.forms?.length);
		if (!entry) continue;
		const tense = unit === "past" ? "past" : "present";
		const rows = tense === "past" ? pastPattern(entry.forms!) : presentPattern(entry.forms!);
		if (rows)
			out.push({
				verb,
				gloss: (entry.en ?? "")
					.split(";")[0]!
					.replace(/\s*\(.*\)\s*$/, "")
					.trim(),
				tense,
				rows,
			});
	}
	return out;
}

export interface TableBlank {
	row: number;
	form: number;
	answer: string;
}

const PRESENT_BLANKS: ReadonlyArray<[number, number]> = [
	[1, 0],
	[3, 0],
	[5, 0],
];
const PAST_BLANKS: ReadonlyArray<[number, number]> = [
	[0, 1],
	[4, 0],
	[5, 0],
];

export function tableBlanks(pattern: VerbPattern): TableBlank[] {
	return (pattern.tense === "past" ? PAST_BLANKS : PRESENT_BLANKS).flatMap(([row, form]) => {
		const cell = pattern.rows[row]?.forms[form];
		return cell ? [{ row, form, answer: cell.stem + cell.ending }] : [];
	});
}

export function givesAway(pattern: VerbPattern, blanks: readonly TableBlank[], row: number, form: number): boolean {
	const cell = pattern.rows[row]?.forms[form];
	if (!cell || blanks.some((b) => b.row === row && b.form === form)) return false;
	return blanks.some((b) => b.answer === cell.stem + cell.ending);
}
