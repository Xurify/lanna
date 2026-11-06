/**
 * Cheatsheets on disk — the active profile's data/profiles/<language>/cheatsheets/:
 *
 *   <id>.json   the parsed sheet (title, intro, sections with rows)
 *   <id>.md     the text exactly as it was imported
 *   trash/      removed sheets, moved here rather than deleted (E1)
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { cheatsheetId, cheatsheetSummary, isCheatsheetId, parseCheatsheet, type Cheatsheet, type CheatsheetSummary } from "../core/cheatsheets.ts";
import { ensureReadmes } from "./corpus.ts";

const dir = () => PATHS.cheatsheets;
const fileFor = (id: string, ext: "json" | "md") => path.join(dir(), `${id}.${ext}`);

function writeAtomic(file: string, text: string): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, text, "utf-8");
	fs.renameSync(tmp, file);
}

function readSheet(id: string): Cheatsheet | null {
	if (!isCheatsheetId(id)) return null;
	try {
		return JSON.parse(fs.readFileSync(fileFor(id, "json"), "utf-8")) as Cheatsheet;
	} catch {
		return null;
	}
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

	/** Parse and keep a guide. Throws CheatsheetParseError on text with no phrases. */
	create(markdown: string, title?: string, now = new Date()): Cheatsheet {
		const draft = parseCheatsheet(markdown);
		const finalTitle = title?.trim() ? title.trim().slice(0, 120) : draft.title;
		const id = cheatsheetId(finalTitle, now, (candidate) => fs.existsSync(fileFor(candidate, "json")));
		const sheet: Cheatsheet = { id, importedAt: now.toISOString(), ...draft, title: finalTitle };
		writeAtomic(fileFor(id, "md"), markdown);
		writeAtomic(fileFor(id, "json"), JSON.stringify(sheet, null, "\t"));
		ensureReadmes();
		return sheet;
	},

	/** Move a sheet and its source to trash/. False when there is no such sheet. */
	remove(id: string): boolean {
		if (!readSheet(id)) return false;
		const trash = path.join(dir(), "trash");
		fs.mkdirSync(trash, { recursive: true });
		const suffix = fs.existsSync(path.join(trash, `${id}.json`)) ? `.${Date.now().toString(36)}` : "";
		for (const ext of ["json", "md"] as const) {
			const from = fileFor(id, ext);
			if (fs.existsSync(from)) fs.renameSync(from, path.join(trash, `${id}${suffix}.${ext}`));
		}
		return true;
	},
};
