/**
 * Today's line record (2026-11-05) — the active profile's
 * data/profiles/<language>/line/log.jsonl: one line per hearing, morning or
 * evening, with the sentence that was played and what was typed. Append-only,
 * like the fluency log (src/store/speak.ts); a torn line is skipped, never fatal.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { LineRecord } from "../core/line.ts";

const FILE = () => path.join(PATHS.line, "log.jsonl");

export const lineStore = {
	read(): LineRecord[] {
		let raw: string;
		try {
			raw = fs.readFileSync(FILE(), "utf-8");
		} catch {
			return [];
		}
		const out: LineRecord[] = [];
		for (const line of raw.split("\n")) {
			const s = line.trim();
			if (!s) continue;
			try {
				out.push(JSON.parse(s) as LineRecord);
			} catch {
				// a torn line (a crash mid-append) is skipped
			}
		}
		return out;
	},
	append(record: LineRecord): void {
		fs.mkdirSync(path.dirname(FILE()), { recursive: true });
		fs.appendFileSync(FILE(), `${JSON.stringify(record)}\n`, "utf-8");
	},
};
