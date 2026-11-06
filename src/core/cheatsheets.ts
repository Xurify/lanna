/**
 * Cheatsheets (LangHarness, 2026-11-06) — pure parsing of an imported
 * phrase guide. A cheatsheet is a reference the learner wrote or chose
 * (a phrase guide for a game, a trip, a call), kept per language and read
 * under Words → Cheatsheets. It is the learner's own curated text, so its
 * words may go to Review, where they are drilled on the lexicon's verified
 * sentences (E27), never on the sheet's own lines.
 *
 * The import format is Markdown, the shape any chat assistant answers in:
 *   # Title                 the sheet's title (first one only)
 *   text before ## …        the intro
 *   ## Section              a section; ### starts one too
 *   | Russian | Say it | English | Note |   a table: one row per phrase
 *   - word — meaning        a list item with a dash, en dash or = is a row
 *   anything else           a note under its section
 */

export interface CheatRow {
	/** The phrase in the language being learned. */
	text: string;
	/** How to say it, as the sheet writes it ("pa-ZHAR"). */
	pron?: string;
	meaning?: string;
	note?: string;
}

export interface CheatSection {
	/** Stable within a sheet: the anchor the section jump links to. */
	id: string;
	title: string;
	notes: string[];
	rows: CheatRow[];
}

export interface CheatsheetDraft {
	title: string;
	intro: string[];
	sections: CheatSection[];
}

/** What the parser read, plus the lines it left out: a chat assistant's
 *  own lines ("I can turn this into a quiz…"). They stay in the kept
 *  Markdown; they are not shown on the sheet. */
export interface ParsedCheatsheet extends CheatsheetDraft {
	skipped: string[];
}

export interface Cheatsheet extends CheatsheetDraft {
	id: string;
	importedAt: string;
	/** Set once the sheet has been edited. */
	updatedAt?: string;
}

export interface CheatsheetSummary {
	id: string;
	title: string;
	sections: number;
	rows: number;
	importedAt: string;
}

export const CHEATSHEET_MAX_CHARS = 200_000;
export const CHEATSHEET_MAX_ROWS = 2_000;
export const CHEATSHEET_TITLE_MAX = 120;

type Column = "text" | "pron" | "meaning" | "note";

// Header words in English and the languages the learners explain in. A header
// that names the target language ("Russian", "Slovak") is the text column.
const HEADER_WORDS: Record<Exclude<Column, "text">, RegExp> = {
	pron: /pronunc|say it|how to say|sound|translit|výslov|hääld|произнош/i,
	meaning: /english|meaning|translat|význam|tähendus|angl|значени|перевод/i,
	note: /note|pozn|märk|gender|tip|when|usage|comment/i,
};

/** Bold, italics, code and links reduced to their text. */
export function plainText(s: string): string {
	return s
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/(\*\*|__)(.+?)\1/g, "$2")
		.replace(/(^|[^\p{L}\p{N}])[*_](?=\S)(.+?)(?<=\S)[*_](?=$|[^\p{L}\p{N}])/gu, "$1$2")
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function splitRow(line: string): string[] {
	let s = line.trim();
	if (s.startsWith("|")) s = s.slice(1);
	if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
	const cells: string[] = [];
	let cur = "";
	for (let i = 0; i < s.length; i++) {
		if (s[i] === "\\" && s[i + 1] === "|") {
			cur += "|";
			i++;
		} else if (s[i] === "|") {
			cells.push(cur);
			cur = "";
		} else cur += s[i];
	}
	cells.push(cur);
	return cells.map(plainText);
}

const isSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** Which column holds what, from the header when it says, else by position:
 *  the first column is the phrase, the last the meaning, a middle one of
 *  three or more the pronunciation, the rest notes. */
export function tableColumns(header: string[] | null, width: number): Column[] {
	const cols: (Column | null)[] = Array.from({ length: width }, () => null);
	if (header) {
		header.forEach((h, i) => {
			if (i >= width) return;
			for (const kind of ["pron", "meaning", "note"] as const) {
				if (!cols.includes(kind) && HEADER_WORDS[kind].test(h)) {
					cols[i] = kind;
					return;
				}
			}
		});
	}
	const known = cols.some((c) => c !== null);
	if (!known) {
		if (width === 1) return ["text"];
		if (width === 2) return ["text", "meaning"];
		return ["text", "pron", "meaning", ...Array.from({ length: width - 3 }, () => "note" as const)];
	}
	const firstFree = cols.indexOf(null);
	if (firstFree >= 0) cols[firstFree] = "text";
	return cols.map((c) => c ?? "note");
}

function rowFromCells(cells: string[], cols: Column[]): CheatRow | null {
	const row: CheatRow = { text: "" };
	const notes: string[] = [];
	cols.forEach((kind, i) => {
		const v = cells[i]?.trim();
		if (!v) return;
		if (kind === "note") notes.push(v);
		else if (kind === "text") row.text = v;
		else row[kind] = v;
	});
	if (notes.length) row.note = notes.join(" · ");
	return row.text ? row : null;
}

// "слово — word", "слово – word", "слово = word"; a hyphen alone is not a
// separator, since phrases and pronunciations use it.
const LIST_ROW = /^(.+?)\s+[—–=]\s+(.+)$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;

function rowFromListItem(item: string): CheatRow | null {
	const m = LIST_ROW.exec(item);
	if (!m) return null;
	let left = (m[1] ?? "").trim();
	let pron: string | undefined;
	const p = /^(.+?)\s*[([]([^)\]]+)[)\]]$/.exec(left);
	if (p) {
		left = (p[1] ?? "").trim();
		pron = (p[2] ?? "").trim();
	}
	const text = plainText(left);
	const meaning = plainText(m[2] ?? "");
	if (!text || !meaning) return null;
	return pron ? { text, pron: plainText(pron), meaning } : { text, meaning };
}

function sectionId(title: string, taken: Set<string>): string {
	const base =
		title
			.toLowerCase()
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/[^\p{L}\p{N}]+/gu, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40) || "section";
	let id = base;
	for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
	taken.add(id);
	return id;
}

// An assistant talking to the reader about itself or the chat, not about
// the phrases: "I put this together…", "Here are…", "Let me know…".
const CHATTER = /^(i|i'm|i’m|i've|i’ve|i'll|i’ll|i'd|i’d)\s|^(here's|here’s|here is|here are|let me|hope this|feel free|want me to|would you like|if you'd like|if you’d like|if you want me|happy to)\b/i;

export function isChatter(line: string): boolean {
	return CHATTER.test(line.trim());
}

/** "**Body words:** голова (head), лицо (face), уши (ears)." and
 *  "Numbers: 1 один, 2 два" as rows, under a section named by the label.
 *  Every item must read as a phrase with its meaning, and there must be
 *  at least two, so a prose line with a colon stays a note. */
export function inlineList(line: string): { label: string; rows: CheatRow[] } | null {
	const m = /^\s*(?:[-*+]\s+)?(?:\*\*|__)?([^*_:]{1,40}?)(?::\s*(?:\*\*|__)|(?:\*\*|__)?:)\s*(.+)$/.exec(line);
	if (!m) return null;
	const items = (m[2] ?? "").replace(/[.;]\s*$/, "").split(/\s*[,;]\s*/).map(plainText).filter(Boolean);
	if (items.length < 2) return null;
	const rows: CheatRow[] = [];
	for (const item of items) {
		const paren = /^(.+?)\s*\(([^()]+)\)$/.exec(item);
		const numbered = /^(\d+)\s+(\S.*)$/.exec(item);
		if (paren && (paren[1] ?? "").split(/\s+/).length <= 4) rows.push({ text: (paren[1] ?? "").trim(), meaning: (paren[2] ?? "").trim() });
		else if (numbered) rows.push({ text: (numbered[2] ?? "").trim(), meaning: numbered[1] ?? "" });
		else return null;
	}
	return { label: plainText(m[1] ?? ""), rows };
}

export class CheatsheetParseError extends Error {}

/** Parse an imported guide. Throws CheatsheetParseError when nothing in it
 *  reads as a phrase, or when it is over the size limits. */
export function parseCheatsheet(markdown: string, fallbackTitle = "Cheatsheet"): ParsedCheatsheet {
	if (markdown.length > CHEATSHEET_MAX_CHARS) throw new CheatsheetParseError(`The text is too long (over ${CHEATSHEET_MAX_CHARS.toLocaleString("en")} characters).`);
	const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
	let title = "";
	const intro: string[] = [];
	const sections: CheatSection[] = [];
	const ids = new Set<string>();
	let current: CheatSection | null = null;
	let rowCount = 0;
	const skipped: string[] = [];

	const target = (): CheatSection => {
		if (!current) {
			current = { id: sectionId("phrases", ids), title: "Phrases", notes: [], rows: [] };
			sections.push(current);
		}
		return current;
	};
	const addRow = (row: CheatRow) => {
		if (++rowCount > CHEATSHEET_MAX_ROWS) throw new CheatsheetParseError(`The guide has more than ${CHEATSHEET_MAX_ROWS} phrases. Split it into two cheatsheets.`);
		target().rows.push(row);
	};
	const addNote = (text: string) => {
		const t = plainText(text);
		if (!t) return;
		if (isChatter(t)) {
			skipped.push(t);
			return;
		}
		if (current) current.notes.push(t);
		else intro.push(t);
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const trimmed = line.trim();
		if (!trimmed || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed) || trimmed.startsWith("```")) continue;

		const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(trimmed);
		if (heading) {
			const level = (heading[1] ?? "").length;
			const text = plainText(heading[2] ?? "");
			if (!text) continue;
			if (level === 1 && !title) title = text;
			else if (level === 1 && !current && sections.length === 0) intro.push(text);
			else {
				current = { id: sectionId(text, ids), title: text, notes: [], rows: [] };
				sections.push(current);
			}
			continue;
		}

		if (trimmed.startsWith("|")) {
			const block: string[] = [];
			while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) block.push((lines[i++] ?? "").trim());
			i--;
			const hasHeader = block.length > 1 && isSeparator(block[1] ?? "");
			const header = hasHeader ? splitRow(block[0] ?? "") : null;
			const body = (hasHeader ? block.slice(2) : block).filter((l) => !isSeparator(l)).map(splitRow);
			const width = Math.max(header?.length ?? 0, ...body.map((r) => r.length));
			const cols = tableColumns(header, width);
			for (const cells of body) {
				const row = rowFromCells(cells, cols);
				if (row) addRow(row);
			}
			continue;
		}

		const list = inlineList(trimmed);
		if (list) {
			current = { id: sectionId(list.label, ids), title: list.label, notes: [], rows: [] };
			sections.push(current);
			for (const row of list.rows) addRow(row);
			continue;
		}

		const item = LIST_ITEM.exec(line);
		if (item) {
			const body = item[1] ?? "";
			const row = rowFromListItem(body);
			if (row) addRow(row);
			else addNote(body);
			continue;
		}

		const quote = /^>\s?(.*)$/.exec(trimmed);
		addNote(quote ? (quote[1] ?? "") : trimmed);
	}

	const kept = sections.filter((s) => s.rows.length || s.notes.length);
	if (rowCount === 0) throw new CheatsheetParseError("No phrases found. Put them in a table (phrase | meaning) or in a list (phrase — meaning).");
	return { title: (title || fallbackTitle).slice(0, CHEATSHEET_TITLE_MAX), intro, sections: kept, skipped };
}

export function cheatsheetRowCount(sheet: Pick<CheatsheetDraft, "sections">): number {
	return sheet.sections.reduce((n, s) => n + s.rows.length, 0);
}

export function cheatsheetSummary(sheet: Cheatsheet): CheatsheetSummary {
	return { id: sheet.id, title: sheet.title, sections: sheet.sections.filter((s) => s.rows.length).length, rows: cheatsheetRowCount(sheet), importedAt: sheet.importedAt };
}

/** The words of a sheet's phrases, lowercased in the language's own rules,
 *  each once, in the order they first appear. "Я не уверен. / Я не уверена."
 *  gives я, не, уверен, уверена. */
export function cheatsheetWords(sheet: Pick<CheatsheetDraft, "sections">, tag: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const section of sheet.sections) {
		for (const row of section.rows) {
			for (const raw of row.text.split(/[^\p{L}\p{M}'’-]+/u)) {
				const w = raw.replace(/^[-'’]+|[-'’]+$/g, "").toLocaleLowerCase(tag);
				if (!w || seen.has(w)) continue;
				seen.add(w);
				out.push(w);
			}
		}
	}
	return out;
}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isCheatsheetId(id: string): boolean {
	return ID_RE.test(id);
}

/** A file-safe id from the title and the time: "animal-hospital-mh3k2". */
export function cheatsheetId(title: string, now: Date, taken: (id: string) => boolean): string {
	const base =
		title
			.toLowerCase()
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40)
			.replace(/-+$/, "") || "sheet";
	const stamp = now.getTime().toString(36).slice(-5);
	let id = `${base}-${stamp}`;
	for (let n = 2; taken(id); n++) id = `${base}-${stamp}-${n}`;
	return id;
}

// ─── Overlap and merging ─────────────────────────────────────────────────────

/** A phrase as compared across sheets: case, ё, punctuation and spacing
 *  do not count, so "Пускаем!" and "пускаем." are the same phrase. */
export function phraseKey(text: string): string {
	return text
		.toLowerCase()
		.replace(/ё/g, "е")
		.replace(/[^\p{L}\p{N}\s/-]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** Every phrase of a sheet, whole and split at " / ", so "глаз / глаза"
 *  covers "глаза" too. */
export function phraseKeys(sheet: Pick<CheatsheetDraft, "sections">): Set<string> {
	const keys = new Set<string>();
	for (const s of sheet.sections)
		for (const r of s.rows) {
			keys.add(phraseKey(r.text));
			for (const part of r.text.split(/\s+\/\s+/)) keys.add(phraseKey(part));
		}
	return keys;
}

function covered(text: string, keys: Set<string>): boolean {
	if (keys.has(phraseKey(text))) return true;
	const parts = text.split(/\s+\/\s+/);
	return parts.length > 1 && parts.every((p) => keys.has(phraseKey(p)));
}

export interface CheatsheetOverlap {
	/** Phrases of the incoming guide the sheet already has. */
	shared: number;
	/** The rest, each once, with the section it came from. */
	fresh: Array<{ section: string; row: CheatRow }>;
}

export function cheatsheetOverlap(incoming: Pick<CheatsheetDraft, "sections">, existing: Pick<CheatsheetDraft, "sections">): CheatsheetOverlap {
	const keys = phraseKeys(existing);
	const seen = new Set<string>();
	let shared = 0;
	const fresh: CheatsheetOverlap["fresh"] = [];
	for (const s of incoming.sections)
		for (const row of s.rows) {
			const key = phraseKey(row.text);
			if (seen.has(key)) continue;
			seen.add(key);
			if (covered(row.text, keys)) shared++;
			else fresh.push({ section: s.title, row });
		}
	return { shared, fresh };
}

/** "2. Describing what you see" and "2. What we see" are the same section
 *  of two guides written to the same numbered list; without numbers the
 *  titles must match. */
function sameSection(a: string, b: string): boolean {
	const num = (t: string) => /^\s*(\d+)[.)]/.exec(t)?.[1];
	const bare = (t: string) => phraseKey(t.replace(/^\s*\d+[.)]\s*/, ""));
	const na = num(a);
	const nb = num(b);
	if (na && nb) return na === nb;
	return bare(a) === bare(b);
}

const cell = (v?: string) => (v ?? "").replace(/\|/g, "\\|");

function rowLine(row: CheatRow, cols: Column[]): string {
	const values = cols.map((c) => (c === "text" ? row.text : c === "pron" ? row.pron : c === "meaning" ? row.meaning : undefined));
	const noteAt = cols.indexOf("note");
	if (row.note && noteAt >= 0) values[noteAt] = row.note;
	return `| ${values.map(cell).join(" | ")} |`;
}

/** Add the incoming guide's new phrases to a sheet's Markdown: into the
 *  first table of the matching section, in that table's column order,
 *  else as a new section at the end. Returns the new text and how many
 *  phrases it added. */
export function mergeCheatsheetMarkdown(targetMarkdown: string, incoming: Pick<CheatsheetDraft, "sections">): { markdown: string; added: number } {
	const target = parseCheatsheet(targetMarkdown);
	const { fresh } = cheatsheetOverlap(incoming, target);
	if (!fresh.length) return { markdown: targetMarkdown, added: 0 };
	const lines = targetMarkdown.replace(/\r\n?/g, "\n").split("\n");
	const appended: string[] = [];
	const bySection = new Map<string, CheatRow[]>();
	for (const f of fresh) bySection.set(f.section, [...(bySection.get(f.section) ?? []), f.row]);

	for (const [title, rows] of bySection) {
		const headingAt = lines.findIndex((l) => {
			const h = /^#{2,6}\s+(.*?)\s*#*$/.exec(l.trim());
			return !!h && sameSection(plainText(h[1] ?? ""), title);
		});
		let inserted = false;
		if (headingAt >= 0) {
			let i = headingAt + 1;
			while (i < lines.length && !/^#{1,6}\s/.test((lines[i] ?? "").trim()) && !(lines[i] ?? "").trim().startsWith("|")) i++;
			if (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
				const start = i;
				while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) i++;
				const hasHeader = i - start > 1 && isSeparator(lines[start + 1] ?? "");
				const header = hasHeader ? splitRow(lines[start] ?? "") : null;
				const width = header?.length ?? splitRow(lines[start] ?? "").length;
				const cols = tableColumns(header, width);
				lines.splice(i, 0, ...rows.map((r) => rowLine(r, cols)));
				inserted = true;
			}
		}
		if (!inserted) {
			const cols: Column[] = ["text", "pron", "meaning", "note"];
			appended.push("", `## ${title}`, "", "| Phrase | Say it | Meaning | Note |", "|---|---|---|---|", ...rows.map((r) => rowLine(r, cols)));
		}
	}
	let text = lines.join("\n");
	if (appended.length) text = `${text.replace(/\s+$/, "")}\n${appended.join("\n")}\n`;
	return { markdown: text, added: fresh.length };
}
