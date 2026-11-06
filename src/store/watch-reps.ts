/**
 * Watch lines to hear again in Listen (LangHarness, 2026-11-05): the active
 * profile's data/profiles/<language>/watch-reps.json, one entry per line
 * (the scheduling is in src/core/watch-reps.ts). Written through a temp file
 * and a rename, as the milestones file is (src/store/milestones.ts).
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { WatchRep } from "../core/watch-reps.ts";

export interface WatchRepsFile {
	lines: WatchRep[];
}

const FILE = () => path.join(PATHS.data, "watch-reps.json");

export const watchRepStore = {
	read(): WatchRepsFile {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<WatchRepsFile>;
			return { lines: Array.isArray(raw.lines) ? raw.lines : [] };
		} catch {
			return { lines: [] };
		}
	},
	write(file: WatchRepsFile): void {
		const target = FILE();
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const tmp = `${target}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(file, null, 2), "utf-8");
		fs.renameSync(tmp, target);
	},
	/** Adds the lines whose id is not on file, waiting or retired: a line is
	 *  queued once. Returns the ids added. */
	addNew(lines: readonly WatchRep[]): string[] {
		const file = this.read();
		const have = new Set(file.lines.map((l) => l.id));
		const added: string[] = [];
		for (const line of lines) {
			if (have.has(line.id)) continue;
			have.add(line.id);
			file.lines.push(line);
			added.push(line.id);
		}
		if (added.length) this.write(file);
		return added;
	},
	replace(lines: readonly WatchRep[]): void {
		const next = new Map(lines.map((l) => [l.id, l]));
		const file = this.read();
		file.lines = file.lines.map((l) => next.get(l.id) ?? l);
		this.write(file);
	},
	active(): WatchRep[] {
		return this.read().lines.filter((l) => !l.retiredAt);
	},
};
