import { foldDiacritics } from "./language.ts";

interface ReferenceClause {
	row: number;
	head: string;
	headWords: ReadonlySet<string>;
	text: string;
	words: ReadonlySet<string>;
}

export interface ReferenceUnit {
	chapter: string;
	clauses: ReferenceClause[];
}

export interface ReferenceContrast {
	chapter: string;
	lines: string[];
}

const MAX_CLAUSES = 3;
const MAX_WORDS_PER_CLAUSE = 8;
const MAX_ROWS_TO_PAIR_ACROSS = 10;
const NO_WORDS: ReadonlySet<string> = new Set();

const fold = (word: string, tag: string) => foldDiacritics(word.toLocaleLowerCase(tag));
const CASE_NAMES: Readonly<Record<string, string>> = {
	nom: "nominative",
	gen: "genitive",
	dat: "dative",
	acc: "accusative",
	loc: "locative",
	instr: "instrumental",
	N: "nominative",
	G: "genitive",
	D: "dative",
	A: "accusative",
	L: "locative",
	I: "instrumental",
};
const withCaseNames = (text: string) =>
	text.replace(/\+\s*(nom|gen|dat|acc|loc|instr)\.|\+\s*([NGDALI])\b/g, (_, short: string | undefined, letter: string | undefined) => `+ ${CASE_NAMES[(short ?? letter)!]}`);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lettersOf = (text: string) => text.split(/[^\p{L}]+/u).filter(Boolean);
const plain = (text: string) =>
	text
		.replace(/`/g, "")
		.replace(/\*\*/g, "")
		.replace(/\s+/g, " ")
		.trim();
const isSentence = (span: string) => /^\p{Lu}/u.test(span.trim()) && /\s/.test(span.trim());
const codeSpans = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
const REFLEXIVE = new Set(["sa", "si"]);
const VERSUS = /\svs\.?\s/;

function headWordOf(span: string, inVersusRow: boolean, tag: string): string | undefined {
	if (isSentence(span)) return undefined;
	const tokens = lettersOf(span.split("+")[0]!).map((w) => fold(w, tag));
	const [first, ...rest] = tokens;
	if (!first) return undefined;
	const standsAlone = rest.length === 0 || rest.every((t) => REFLEXIVE.has(t)) || span.includes("+") || span.includes("/") || inVersusRow;
	return standsAlone ? first : undefined;
}

const frameWords = (spans: readonly string[], tag: string, inVersusRow = false): ReadonlySet<string> =>
	new Set(
		spans
			.flatMap((s) => (s.includes("/") && !s.includes("+") ? s.split("/") : [s]))
			.map((s) => headWordOf(s, inVersusRow, tag))
			.filter((w): w is string => Boolean(w)),
	);

function clausesOf(row: number, head: string, body: string, tag: string): ReferenceClause[] {
	return body
		.split(/;\s+/)
		.filter((c) => c.includes("`"))
		.map((c) => ({ row, head, headWords: NO_WORDS, text: plain(c), words: frameWords(codeSpans(c), tag) }));
}

function tableClauses(row: number, line: string, tag: string): ReferenceClause[] {
	const cells = line
		.split("|")
		.slice(1, -1)
		.map((c) => c.trim());
	if (cells.length < 2 || cells.every((c) => /^:?-+:?$/.test(c))) return [];
	const [head, ...rest] = cells;
	const headWords = frameWords(codeSpans(head!), tag);
	if (headWords.size === 0) return clausesOf(row, plain(head!), rest.filter(Boolean).join(" — "), tag);
	const text = `${plain(head!)}: ${rest.map(plain).filter(Boolean).join(" — ")}`;
	return [{ row, head: "", headWords, text, words: frameWords(codeSpans(line), tag, VERSUS.test(head!)) }];
}

function codeClause(row: number, line: string, tag: string): ReferenceClause | null {
	const [frame, ...gloss] = line.trim().split(/\s{2,}/);
	if (!frame || gloss.length === 0) return null;
	return { row, head: "", headWords: NO_WORDS, text: `${frame}: ${gloss.join(" ")}`, words: frameWords([frame], tag) };
}

/** A reference chapter as units whose clauses can be set side by side: a table,
 *  a code block of "frame  gloss" lines, or one prose line, each cut at semicolons. */
export function referenceUnits(markdown: string, chapter: string, tag = "sk-SK"): ReferenceUnit[] {
	const units: ReferenceUnit[] = [];
	let table: ReferenceClause[] | null = null;
	let tableRows = 0;
	let code: ReferenceClause[] | null = null;
	const push = (clauses: ReferenceClause[] | null) => {
		if (clauses?.length) units.push({ chapter, clauses });
	};
	for (const line of markdown.split(/\r?\n/)) {
		if (line.startsWith("```")) {
			push(table);
			table = null;
			if (code) push(code);
			code = code ? null : [];
			continue;
		}
		if (code) {
			const clause = codeClause(code.length, line, tag);
			if (clause) code.push(clause);
			continue;
		}
		if (line.trimStart().startsWith("|")) {
			if (!table) {
				table = [];
				tableRows = 0;
			}
			table.push(...tableClauses(tableRows++, line, tag));
			continue;
		}
		push(table);
		table = null;
		if (line.includes("`")) push(clausesOf(0, "", line.replace(/^\s*(?:[-*]|\d+\.)\s+/, ""), tag));
	}
	push(table);
	return units;
}

export interface AspectPair {
	perfective: string;
	imperfective: string;
}

const aspectOfLabel = (label: string): "pf" | "ipf" | undefined => (/^(ipf|imperfective)\b/i.test(label) ? "ipf" : /^(pf|perfective)\b/i.test(label) ? "pf" : undefined);

/** The aspect pairs listed in tables whose columns are labeled perfective and
 *  imperfective, each cell read as one verb (with its sa or si). */
export function referenceAspectPairs(markdown: string): AspectPair[] {
	const pairs: AspectPair[] = [];
	let labels: Array<"pf" | "ipf" | undefined> | null = null;
	let inTable = false;
	for (const line of markdown.split(/\r?\n/)) {
		if (!line.trimStart().startsWith("|")) {
			inTable = false;
			labels = null;
			continue;
		}
		const cells = line
			.split("|")
			.slice(1, -1)
			.map((c) => c.trim());
		if (!inTable) {
			inTable = true;
			const read = cells.map(aspectOfLabel);
			labels = read.every(Boolean) ? read : null;
			continue;
		}
		if (!labels || cells.every((c) => /^:?-+:?$/.test(c))) continue;
		const oneVerb = (cell: string) => {
			if (!/^`[^`]+`$/.test(cell) || /[^\p{L}\s]/u.test(cell.slice(1, -1))) return false;
			const [, ...rest] = lettersOf(cell).map((w) => w.toLowerCase());
			return rest.length === 0 || (rest.length === 1 && REFLEXIVE.has(rest[0]!));
		};
		for (let i = 0; i + 1 < cells.length; i += 2) {
			if (!oneVerb(cells[i]!) || !oneVerb(cells[i + 1]!) || labels[i] === labels[i + 1]) continue;
			const [x, y] = [plain(cells[i]!), plain(cells[i + 1]!)];
			pairs.push(labels[i] === "pf" ? { perfective: x, imperfective: y } : { perfective: y, imperfective: x });
		}
	}
	return pairs;
}

export function aspectPairOf<P extends AspectPair>(pairs: readonly P[], a: string, b: string, tag = "sk-SK"): P | undefined {
	const verb = (cell: string) => fold(lettersOf(cell)[0] ?? "", tag);
	const [fa, fb] = [fold(a, tag), fold(b, tag)];
	return pairs.find((p) => (verb(p.perfective) === fa && verb(p.imperfective) === fb) || (verb(p.perfective) === fb && verb(p.imperfective) === fa));
}

/** The passage of the reference that best sets the two words side by side, cut
 *  down to the clauses that name one of them; undefined when none does. */
export function referenceContrast(units: readonly ReferenceUnit[], a: string, b: string, tag = "sk-SK"): ReferenceContrast | undefined {
	const fa = fold(a, tag);
	const fb = fold(b, tag);
	let best: (ReferenceContrast & { sideBySide: boolean; length: number }) | undefined;
	const namesBoth = (cs: readonly ReferenceClause[]) => cs.some((c) => c.words.has(fa)) && cs.some((c) => c.words.has(fb));
	for (const unit of units) {
		const naming = unit.clauses.filter((c) => c.words.has(fa) || c.words.has(fb));
		const wordListTable = unit.clauses.some((c) => c.headWords.size > 0);
		const bigTable = wordListTable || new Set(unit.clauses.map((c) => c.row)).size > MAX_ROWS_TO_PAIR_ACROSS;
		const rowsNamingBoth = new Set(naming.map((c) => c.row).filter((row) => namesBoth(naming.filter((c) => c.row === row))));
		const clauses = bigTable ? naming.filter((c) => rowsNamingBoth.has(c.row)) : naming;
		if (!namesBoth(clauses)) continue;
		const alternants = new RegExp(`(^|[^\\p{L}])(${escape(fa)}/${escape(fb)}|${escape(fb)}/${escape(fa)})([^\\p{L}]|$)`, "u");
		if (clauses.some((c) => alternants.test(fold(c.text, tag)))) continue;
		if (clauses.length > MAX_CLAUSES || clauses.some((c) => c.words.size > MAX_WORDS_PER_CLAUSE)) continue;
		if (clauses.some((c) => c.headWords.size > 0 && !c.headWords.has(fa) && !c.headWords.has(fb))) continue;
		const sideBySide = clauses.every((c) => c.words.has(fa) !== c.words.has(fb));
		const byHead = new Map<string, string[]>();
		for (const c of clauses) byHead.set(c.head, [...(byHead.get(c.head) ?? []), c.text]);
		const lines = [...byHead].flatMap(([head, texts]) => (head && texts.length === 1 ? [`${head}: ${texts[0]}`] : head ? [`${head}:`, ...texts] : texts)).map(withCaseNames);
		const length = lines.join(" ").length;
		const better = !best || (sideBySide && !best.sideBySide) || (sideBySide === best.sideBySide && length < best.length);
		if (better) best = { chapter: unit.chapter, lines, sideBySide, length };
	}
	return best && { chapter: best.chapter, lines: best.lines };
}
