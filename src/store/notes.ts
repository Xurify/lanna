/**
 * Notes (2026-11-17): the active profile's data/profiles/<language>/notes.json,
 * one entry per note (src/core/notes.ts); notes-trash.jsonl, every note as it
 * was when it was deleted; link-previews.json, the card shown for each link
 * ever added or mentioned, by its address; and notes-images/, the pictures and icons of the
 * pages a note links to, named by a hash of their bytes.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { Note, NoteLink } from "../core/notes.ts";

interface NotesFile {
	notes: Note[];
}

export const NOTE_IMAGE_TYPES: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
	"image/x-icon": "ico",
	"image/vnd.microsoft.icon": "ico",
};
const TYPE_OF_EXT: Record<string, string> = {
	...Object.fromEntries(Object.entries(NOTE_IMAGE_TYPES).map(([type, ext]) => [ext, type])),
	ico: "image/x-icon",
};
const IMAGE_FILE = /^[0-9a-f]{24}\.(jpg|png|webp|gif|avif|ico)$/;

const FILE = () => path.join(PATHS.data, "notes.json");
const PREVIEWS = () => path.join(PATHS.data, "link-previews.json");
const TRASH = () => path.join(PATHS.data, "notes-trash.jsonl");
const IMAGES = () => path.join(PATHS.data, "notes-images");

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
	previews(): Record<string, NoteLink & { at: string }> {
		try {
			const raw = JSON.parse(fs.readFileSync(PREVIEWS(), "utf-8")) as unknown;
			return raw && typeof raw === "object" ? (raw as Record<string, NoteLink & { at: string }>) : {};
		} catch {
			return {};
		}
	},
	putPreview(link: NoteLink, at: string): void {
		const all = this.previews();
		all[link.url] = { ...link, at };
		const target = PREVIEWS();
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const tmp = `${target}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(all, null, 2), "utf-8");
		fs.renameSync(tmp, target);
	},
	putImage(file: string, bytes: Buffer): void {
		if (!IMAGE_FILE.test(file)) throw new Error(`not a note image name: ${file}`);
		fs.mkdirSync(IMAGES(), { recursive: true });
		const target = path.join(IMAGES(), file);
		if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);
	},
	image(file: string): { bytes: Buffer; type: string } | null {
		const m = IMAGE_FILE.exec(file);
		if (!m) return null;
		try {
			return { bytes: fs.readFileSync(path.join(IMAGES(), file)), type: TYPE_OF_EXT[m[1]!]! };
		} catch {
			return null;
		}
	},
};
