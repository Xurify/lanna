/**
 * Listening outside the app (2026-11-07): the active profile's
 * data/profiles/<language>/outside-listening.json, one entry per stretch the
 * learner logged (src/core/outside.ts). Written through a temp file and a
 * rename, as the Watch reps file is (src/store/watch-reps.ts).
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { OutsideEntry } from "../core/outside.ts";

export interface OutsideFile {
	entries: OutsideEntry[];
}

const FILE = () => path.join(PATHS.data, "outside-listening.json");

export const outsideStore = {
	read(): OutsideFile {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<OutsideFile>;
			return { entries: Array.isArray(raw.entries) ? raw.entries : [] };
		} catch {
			return { entries: [] };
		}
	},
	write(file: OutsideFile): void {
		const target = FILE();
		fs.mkdirSync(path.dirname(target), { recursive: true });
		const tmp = `${target}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(file, null, 2), "utf-8");
		fs.renameSync(tmp, target);
	},
};
