/**
 * Catch the mistake items (2026-11-06): the active profile's
 * data/profiles/<language>/catch-mistake.json, one entry per item. An item is
 * kept once it is made, so a visit before the answer does not call the model
 * again. Written through a temp file and a rename, as watch-reps is.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { CatchItem } from "../core/catch-mistake.ts";

interface CatchMistakeFile {
	items: CatchItem[];
}

const FILE = () => path.join(PATHS.data, "catch-mistake.json");

export const catchStore = {
	read(): CatchMistakeFile {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<CatchMistakeFile>;
			return { items: Array.isArray(raw.items) ? raw.items : [] };
		} catch {
			return { items: [] };
		}
	},
	write(file: CatchMistakeFile): void {
		const target = FILE();
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const tmp = `${target}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(file, null, 2), "utf-8");
		fs.renameSync(tmp, target);
	},
	list(): CatchItem[] {
		return this.read().items;
	},
	find(id: string): CatchItem | undefined {
		return this.read().items.find((i) => i.id === id);
	},
	add(item: CatchItem): void {
		const file = this.read();
		file.items.push(item);
		this.write(file);
	},
	update(item: CatchItem): void {
		const file = this.read();
		file.items = file.items.map((i) => (i.id === item.id ? item : i));
		this.write(file);
	},
};
