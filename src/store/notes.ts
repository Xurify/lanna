/**
 * Notes (2026-11-17): the active profile's data/profiles/<language>/notes.json,
 * one entry per note (src/core/notes.ts), and notes-trash.jsonl, every note
 * as it was when it was deleted.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { Note } from "../core/notes.ts";

interface NotesFile {
	notes: Note[];
}

const FILE = () => path.join(PATHS.data, "notes.json");
const TRASH = () => path.join(PATHS.data, "notes-trash.jsonl");

export const notesStore = {
	read(): NotesFile {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<NotesFile>;
			return { notes: Array.isArray(raw.notes) ? raw.notes : [] };
		} catch {
			return { notes: [] };
		}
	},
	write(file: NotesFile): void {
		const target = FILE();
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const tmp = `${target}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(file, null, 2), "utf-8");
		fs.renameSync(tmp, target);
	},
	trash(note: Note, at: string): void {
		fs.mkdirSync(path.dirname(TRASH()), { recursive: true });
		fs.appendFileSync(TRASH(), `${JSON.stringify({ ...note, deletedAt: at })}\n`, "utf-8");
	},
};
