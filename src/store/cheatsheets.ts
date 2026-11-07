/**
 * Cheatsheets on disk: the active profile's data/profiles/<language>/cheatsheets/
 *
 *   <id>.json   the sheet: title, dates and its sections with their phrases
 *   trash/      every version an edit or an add replaced, and removed sheets,
 *               moved here rather than deleted (E1)
 *
 * and the sheets kept in the repo, curriculum/<language>/cheatsheets/<name>.txt
 * (repoCheatsheetsDir). Their id is "repo-<name>". Git is their history, so an
 * edit writes the file in place, and the app never deletes one.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PATHS, ROOT, repoCheatsheetsDir } from "../../config.ts";
import {
	CHEATSHEET_TITLE_MAX,
	cheatsheetId,
	cheatsheetSummary,
	formatRepoSheet,
	isCheatsheetId,
	mergeSections,
	parseRepoSheet,
	parseSheetText,
	searchSections,
	REPO_PREFIX,
	titleSlug,
	type Cheatsheet,
	type CheatsheetSummary,
} from "../core/cheatsheets.ts";
import { ensureReadmes } from "./corpus.ts";

const dir = () => PATHS.cheatsheets;
const fileFor = (id: string) => path.join(dir(), `${id}.json`);
const trashDir = () => path.join(dir(), "trash");

function writeAtomic(file: string, text: string): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, text, "utf-8");
	fs.renameSync(tmp, file);
}

function readSheet(id: string): Cheatsheet | null {
	if (!isCheatsheetId(id)) return null;
	try {
		return JSON.parse(fs.readFileSync(fileFor(id), "utf-8")) as Cheatsheet;
	} catch {
		return null;
	}
}

/** A name in trash/ that no earlier version already has. */
function trashName(id: string, now: Date): string {
	return `${id}.${now.getTime().toString(36)}-${crypto.randomBytes(2).toString("hex")}.json`;
}

function toTrash(id: string, now: Date): void {
	fs.mkdirSync(trashDir(), { recursive: true });
	fs.renameSync(fileFor(id), path.join(trashDir(), trashName(id, now)));
}

function keepVersion(id: string, now: Date): void {
	fs.mkdirSync(trashDir(), { recursive: true });
	fs.copyFileSync(fileFor(id), path.join(trashDir(), trashName(id, now)));
}

const repoFile = (name: string) => path.join(repoCheatsheetsDir(), `${name}.txt`);
const isRepoId = (id: string) => id.startsWith(REPO_PREFIX);

function readRepoSheet(id: string): Cheatsheet | null {
	if (!isRepoId(id) || !isCheatsheetId(id)) return null;
	const file = repoFile(id.slice(REPO_PREFIX.length));
	try {
		const { title, sections } = parseRepoSheet(fs.readFileSync(file, "utf-8"), id.slice(REPO_PREFIX.length));
		return { id, title, importedAt: fs.statSync(file).mtime.toISOString(), sections, repoFile: path.relative(ROOT, file).split(path.sep).join("/") };
	} catch {
		// Missing, or text with no phrase: not listed.
		return null;
	}
}

function repoIds(): string[] {
	try {
		return fs
			.readdirSync(repoCheatsheetsDir())
			.filter((n) => n.endsWith(".txt"))
			.map((n) => REPO_PREFIX + n.slice(0, -4))
			.filter(isCheatsheetId);
	} catch {
		return [];
	}
}

function writeRepoSheet(id: string, title: string, sections: Cheatsheet["sections"]): Cheatsheet | null {
	writeAtomic(repoFile(id.slice(REPO_PREFIX.length)), formatRepoSheet(title, sections));
	return readRepoSheet(id);
}

function titleOr(title: string | undefined, fallback: string): string {
	const t = title?.trim().slice(0, CHEATSHEET_TITLE_MAX);
	return t ? t : fallback;
}

export const cheatsheetStore = {
	list(): CheatsheetSummary[] {
		let names: string[] = [];
		try {
			names = fs.readdirSync(dir());
		} catch {
			// No local sheet yet; the repo may still have some.
		}
		const out: CheatsheetSummary[] = [];
		for (const name of names) {
			if (!name.endsWith(".json")) continue;
			const sheet = readSheet(name.slice(0, -5));
			if (sheet) out.push(cheatsheetSummary(sheet));
		}
		for (const id of repoIds()) {
			const sheet = readRepoSheet(id);
			if (sheet) out.push(cheatsheetSummary(sheet));
		}
		return out.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
	},

	/** The sheets whose title or any phrase holds the search, newest first. */
	search(query: string, tag: string): CheatsheetSummary[] {
		const out: CheatsheetSummary[] = [];
		for (const summary of this.list()) {
			const sheet = this.get(summary.id);
			if (sheet && (searchSections([{ id: "", title: sheet.title, rows: [] }], query, tag).length > 0 || searchSections(sheet.sections, query, tag).length > 0)) out.push(summary);
		}
		return out;
	},

	get(id: string): Cheatsheet | null {
		return isRepoId(id) ? readRepoSheet(id) : readSheet(id);
	},

	/** A new sheet from a title and its text. Throws CheatsheetParseError on text with no phrase, before writing. */
	create(title: string, text: string, now = new Date()): Cheatsheet {
		const sections = parseSheetText(text);
		const name = titleOr(title, "Cheatsheet");
		const id = cheatsheetId(name, now, (candidate) => fs.existsSync(fileFor(candidate)));
		const sheet: Cheatsheet = { id, title: name, importedAt: now.toISOString(), sections };
		writeAtomic(fileFor(id), JSON.stringify(sheet, null, "\t"));
		ensureReadmes();
		return sheet;
	},

	/** Replace a sheet's title and phrases with what the text says. The version before goes to trash/. Null when there is no such sheet. */
	update(id: string, input: { title?: string; text: string }, now = new Date()): Cheatsheet | null {
		if (isRepoId(id)) {
			const old = readRepoSheet(id);
			return old && writeRepoSheet(id, titleOr(input.title, old.title), parseSheetText(input.text));
		}
		const old = readSheet(id);
		if (!old) return null;
		const sections = parseSheetText(input.text);
		keepVersion(id, now);
		const sheet: Cheatsheet = { ...old, title: titleOr(input.title, old.title), updatedAt: now.toISOString(), sections };
		writeAtomic(fileFor(id), JSON.stringify(sheet, null, "\t"));
		return sheet;
	},

	/** Add the text's phrases that the sheet does not have yet. Nothing is written when none is new. Null when there is no such sheet. */
	add(id: string, text: string, now = new Date()): { sheet: Cheatsheet; added: number } | null {
		const old = this.get(id);
		if (!old) return null;
		const { sections, added } = mergeSections(old.sections, parseSheetText(text));
		if (!added) return { sheet: old, added };
		if (isRepoId(id)) {
			const sheet = writeRepoSheet(id, old.title, sections);
			return sheet && { sheet, added };
		}
		keepVersion(id, now);
		const sheet: Cheatsheet = { ...old, updatedAt: now.toISOString(), sections };
		writeAtomic(fileFor(id), JSON.stringify(sheet, null, "\t"));
		return { sheet, added };
	},

	/** Move a local sheet into the repo as curriculum/<language>/cheatsheets/<title>.txt. The local copy goes to trash/. Null when there is no such local sheet. */
	toRepo(id: string, now = new Date()): Cheatsheet | null {
		const old = readSheet(id);
		if (!old) return null;
		const base = titleSlug(old.title) || "sheet";
		let name = base;
		for (let n = 2; fs.existsSync(repoFile(name)); n++) name = `${base}-${n}`;
		const sheet = writeRepoSheet(REPO_PREFIX + name, old.title, old.sections);
		if (sheet) toTrash(id, now);
		return sheet;
	},

	/** Move a local sheet to trash/. False when there is no such sheet; a repo sheet is removed by deleting its file. */
	remove(id: string, now = new Date()): boolean {
		if (!readSheet(id)) return false;
		toTrash(id, now);
		return true;
	},
};
