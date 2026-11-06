/**
 * Cheatsheets on disk: the active profile's data/profiles/<language>/cheatsheets/
 *
 *   <id>.json   the sheet: title, dates and its sections with their phrases
 *   trash/      every version an edit or an add replaced, and removed sheets,
 *               moved here rather than deleted (E1)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import {
	CHEATSHEET_TITLE_MAX,
	cheatsheetId,
	cheatsheetSummary,
	isCheatsheetId,
	mergeSections,
	parseSheetText,
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
			return [];
		}
		const out: CheatsheetSummary[] = [];
		for (const name of names) {
			if (!name.endsWith(".json")) continue;
			const sheet = readSheet(name.slice(0, -5));
			if (sheet) out.push(cheatsheetSummary(sheet));
		}
		return out.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
	},

	get(id: string): Cheatsheet | null {
		return readSheet(id);
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
		const old = readSheet(id);
		if (!old) return null;
		const { sections, added } = mergeSections(old.sections, parseSheetText(text));
		if (!added) return { sheet: old, added };
		keepVersion(id, now);
		const sheet: Cheatsheet = { ...old, updatedAt: now.toISOString(), sections };
		writeAtomic(fileFor(id), JSON.stringify(sheet, null, "\t"));
		return { sheet, added };
	},

	/** Move a sheet to trash/. False when there is no such sheet. */
	remove(id: string, now = new Date()): boolean {
		if (!readSheet(id)) return false;
		toTrash(id, now);
		return true;
	},
};
