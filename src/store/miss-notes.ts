import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { MissNote } from "../core/miss-note.ts";

interface MissNotesFile {
	notes: Record<string, MissNote>;
}

const FILE = () => path.join(PATHS.data, "miss-notes.json");

export const missNoteStore = {
	read(): MissNotesFile {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<MissNotesFile>;
			return { notes: raw.notes && typeof raw.notes === "object" ? raw.notes : {} };
		} catch {
			return { notes: {} };
		}
	},
	write(file: MissNotesFile): void {
		const target = FILE();
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const tmp = `${target}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(file, null, 2), "utf-8");
		fs.renameSync(tmp, target);
	},
	get(key: string): MissNote | undefined {
		return this.read().notes[key];
	},
	put(note: MissNote): void {
		const file = this.read();
		file.notes[note.key] = note;
		this.write(file);
	},
};
