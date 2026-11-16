/**
 * Cheatsheets (LangHarness): the learner's own phrase lists, kept per language.
 *
 * The text format is one line per phrase, with up to four fields:
 *
 *   phrase | say it | meaning | note
 *
 * A line with no "|" starts a section, and the phrases below it belong to it.
 * Empty fields are allowed ("голова |  | head"). Phrases above the first
 * section go to "Phrases". A section with no phrases is dropped.
 *
 * A sheet kept in the repo is the same text in a .txt file, with the title on
 * its first line as "# Title".
 */

import { foldDiacritics } from "./language.ts";

export interface CheatRow {
	/** The phrase in the language being learned. */
	text: string;
	/** How to say it, as the learner writes it ("pa-ZHAR"). */
	pron?: string;
	meaning?: string;
	note?: string;
}

export interface CheatSection {
	/** Stable within a sheet. */
	id: string;
	title: string;
	rows: CheatRow[];
}

export interface Cheatsheet {
	id: string;
	title: string;
	importedAt: string;
	updatedAt?: string;
	sections: CheatSection[];
	/** Set for a sheet kept in the repo: its file, relative to the repo root. */
	repoFile?: string;
}

export interface CheatsheetSummary {
	id: string;
	title: string;
	sections: number;
	rows: number;
	importedAt: string;
	updatedAt?: string;
	repoFile?: string;
}

export const CHEATSHEET_MAX_CHARS = 200_000;
const CHEATSHEET_MAX_ROWS = 2_000;
export const CHEATSHEET_TITLE_MAX = 120;

export class CheatsheetParseError extends Error {}

// The first cell of a table header a chat assistant may paste above its rows.
const TABLE_HEADER = /^(russian|phrase|text|slovak|say it|sounds like|pronunciation)$/i;

/** Bold markers and the stray backticks a pasted answer carries. */
function stripMarks(s: string): string {
	return s.replace(/\*\*|__|`/g, "").trim();
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

/** Read a sheet's text. Throws CheatsheetParseError when there is no phrase or the text is too big. */
export function parseSheetText(text: string): CheatSection[] {
	if (text.length > CHEATSHEET_MAX_CHARS)
		throw new CheatsheetParseError(
			`The text is too long (over ${CHEATSHEET_MAX_CHARS.toLocaleString("en")} characters).`,
		);
	const groups: Array<{ title: string; rows: CheatRow[] }> = [];
	let current: { title: string; rows: CheatRow[] } | null = null;
	let count = 0;

	for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
		const line = raw.trim();
		if (!line) continue;

		if (!line.includes("|")) {
			const title = stripMarks(line.replace(/^#+\s*/, ""));
			if (!title) continue;
			current = { title, rows: [] };
			groups.push(current);
			continue;
		}

		// The "|---|---|" line under a pasted table header.
		if (/^[\s|:-]+$/.test(line)) continue;

		const cells = stripMarks(line)
			.replace(/^\|/, "")
			.replace(/\|$/, "")
			.split("|")
			.map((c) => c.trim());
		const [first = "", pron = "", meaning = "", ...rest] = cells;
		if (!first || TABLE_HEADER.test(first)) continue;

		if (!current) {
			current = { title: "Phrases", rows: [] };
			groups.push(current);
		}
		if (++count > CHEATSHEET_MAX_ROWS)
			throw new CheatsheetParseError(`More than ${CHEATSHEET_MAX_ROWS} phrases. Split it into two cheatsheets.`);
		const row: CheatRow = { text: first };
		if (pron) row.pron = pron;
		if (meaning) row.meaning = meaning;
		const note = rest.filter(Boolean).join(" · ");
		if (note) row.note = note;
		current.rows.push(row);
	}

	if (count === 0)
		throw new CheatsheetParseError("No phrases yet. Each phrase is one line: phrase | say it | meaning.");
	const taken = new Set<string>();
	return groups
		.filter((g) => g.rows.length > 0)
		.map((g) => ({ id: sectionId(g.title, taken), title: g.title, rows: g.rows }));
}

/** The text a sheet is edited as. Reading it back with parseSheetText gives the same sections. */
export function formatSheetText(sections: ReadonlyArray<Pick<CheatSection, "title" | "rows">>): string {
	const clean = (v?: string) => (v ?? "").replace(/\|/g, "/");
	const out: string[] = [];
	for (const s of sections) {
		if (!s.rows.length) continue;
		if (out.length) out.push("");
		out.push(s.title);
		for (const r of s.rows) {
			const fields = [clean(r.text), clean(r.pron), clean(r.meaning), clean(r.note)];
			while (fields.length > 1 && !fields[fields.length - 1]) fields.pop();
			// A phrase line must carry a "|", or it would read back as a section name.
			out.push(fields.length === 1 ? `${fields[0]} |` : fields.join(" | "));
		}
	}
	return out.join("\n");
}

/** A phrase as compared across sheets: case, ё, punctuation and spacing do not count. */
export function phraseKey(text: string): string {
	return text
		.toLowerCase()
		.replace(/ё/g, "е")
		.replace(/[^\p{L}\p{N}\s/-]+/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/** Every phrase of the sections, whole and split at " / ", so "глаз / глаза" covers "глаза". */
function phraseKeys(sections: ReadonlyArray<Pick<CheatSection, "rows">>): Set<string> {
	const keys = new Set<string>();
	for (const s of sections)
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

/** How many of the incoming phrases the sections already have, and how many are new. */
export function countOverlap(
	existing: ReadonlyArray<Pick<CheatSection, "rows">>,
	incoming: ReadonlyArray<Pick<CheatSection, "rows">>,
): { shared: number; fresh: number } {
	const keys = phraseKeys(existing);
	const seen = new Set<string>();
	let shared = 0;
	let fresh = 0;
	for (const s of incoming)
		for (const row of s.rows) {
			const key = phraseKey(row.text);
			if (seen.has(key)) continue;
			seen.add(key);
			if (covered(row.text, keys)) shared++;
			else fresh++;
		}
	return { shared, fresh };
}

/** "2. Describing what you see" and "2. What we see" are the same section; without numbers the titles must match. */
export function sameSection(a: string, b: string): boolean {
	const num = (t: string) => /^\s*(\d+)[.)]/.exec(t)?.[1];
	const bare = (t: string) => phraseKey(t.replace(/^\s*\d+[.)]\s*/, ""));
	const na = num(a);
	const nb = num(b);
	if (na && nb) return na === nb;
	return bare(a) === bare(b);
}

/** Add the incoming phrases that the sheet does not have. Each goes to the section it names, or to a new section at the end. */
export function mergeSections(
	existing: CheatSection[],
	incoming: CheatSection[],
): { sections: CheatSection[]; added: number } {
	const keys = phraseKeys(existing);
	const sections = existing.map((s) => ({ ...s, rows: [...s.rows] }));
	const taken = new Set(sections.map((s) => s.id));
	let added = 0;
	for (const inc of incoming)
		for (const row of inc.rows) {
			if (covered(row.text, keys)) continue;
			keys.add(phraseKey(row.text));
			let target = sections.find((s) => sameSection(s.title, inc.title));
			if (!target) {
				target = { id: sectionId(inc.title, taken), title: inc.title, rows: [] };
				sections.push(target);
			}
			target.rows.push(row);
			added++;
		}
	return { sections, added };
}

export function cheatsheetRowCount(sheet: Pick<Cheatsheet, "sections">): number {
	return sheet.sections.reduce((n, s) => n + s.rows.length, 0);
}

export function cheatsheetSummary(sheet: Cheatsheet): CheatsheetSummary {
	return {
		id: sheet.id,
		title: sheet.title,
		sections: sheet.sections.length,
		rows: cheatsheetRowCount(sheet),
		importedAt: sheet.importedAt,
		updatedAt: sheet.updatedAt,
		repoFile: sheet.repoFile,
	};
}

/** The words of a sheet's phrases, lowercased in the language's own rules, each once, in the order they first appear. */
export function cheatsheetWords(sheet: Pick<Cheatsheet, "sections">, tag: string): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const section of sheet.sections)
		for (const row of section.rows)
			for (const raw of row.text.split(/[^\p{L}\p{M}'’-]+/u)) {
				const w = raw.replace(/^[-'’]+|[-'’]+$/g, "").toLocaleLowerCase(tag);
				if (!w || seen.has(w)) continue;
				seen.add(w);
				out.push(w);
			}
	return out;
}

/** Lowercase and without accents, so "cas" finds "čas" and "ЕЖ" finds "ёж". */
function searchKey(text: string, tag: string): string {
	return foldDiacritics(text.toLocaleLowerCase(tag));
}

/** The sections of a sheet that match a search: the rows whose phrase, pronunciation, meaning or note hold every word of it, accents optional. A section whose title matches keeps all its rows. No sections left means nothing matched. */
export function searchSections(sections: CheatSection[], query: string, tag = "en"): CheatSection[] {
	const words = searchKey(query, tag).split(/\s+/).filter(Boolean);
	if (words.length === 0) return sections;
	const holdsAll = (text: string) => words.every((w) => text.includes(w));
	const out: CheatSection[] = [];
	for (const section of sections) {
		if (holdsAll(searchKey(section.title, tag))) {
			out.push(section);
			continue;
		}
		const rows = section.rows.filter((r) =>
			holdsAll(searchKey([r.text, r.pron, r.meaning, r.note].filter(Boolean).join(" "), tag)),
		);
		if (rows.length > 0) out.push({ ...section, rows });
	}
	return out;
}

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isCheatsheetId(id: string): boolean {
	return ID_RE.test(id);
}

/** A repo sheet's id is "repo-" and its file name; a local id never starts that way. */
export const REPO_PREFIX = "repo-";

/** The ASCII slug of a title: "Night shift: Ночь!" is "night-shift". */
export function titleSlug(title: string): string {
	return title
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40)
		.replace(/-+$/, "");
}

/** A file-safe id from the title and the time: "night-shift-mh3k2". */
export function cheatsheetId(title: string, now: Date, taken: (id: string) => boolean): string {
	let base = titleSlug(title) || "sheet";
	if (base === "repo" || base.startsWith(REPO_PREFIX)) base = `sheet-${base}`;
	const stamp = now.getTime().toString(36).slice(-5);
	let id = `${base}-${stamp}`;
	for (let n = 2; taken(id); n++) id = `${base}-${stamp}-${n}`;
	return id;
}

/** A repo file: an optional "# Title" first line, then the sheet's text. */
export function parseRepoSheet(raw: string, fallbackTitle: string): { title: string; sections: CheatSection[] } {
	const lines = raw.replace(/\r\n?/g, "\n").split("\n");
	const first = lines.findIndex((l) => l.trim() !== "");
	const heading = first >= 0 ? /^#\s+(.+)$/.exec(lines[first]!.trim()) : null;
	if (heading) lines.splice(first, 1);
	const title = heading?.[1]?.trim().slice(0, CHEATSHEET_TITLE_MAX) || fallbackTitle;
	return { title, sections: parseSheetText(lines.join("\n")) };
}

export function formatRepoSheet(title: string, sections: ReadonlyArray<Pick<CheatSection, "title" | "rows">>): string {
	return `# ${title.replace(/\s+/g, " ").trim()}\n\n${formatSheetText(sections)}\n`;
}
