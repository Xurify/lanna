/**
 * Speaking reports (2026-11-17) — the active profile's
 * data/profiles/<language>/speaking/: one report per talk as
 * <id>.json, and index.jsonl with one line per talk, newest last. The
 * report is what /speak/live ends on and what the Speaking section of
 * Mistakes reads; the index is all the trend needs, so the list never
 * loads a whole talk.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { SpeakingIndexEntry, SpeakingReport } from "../core/speaking-trends.ts";

const ID = /^[a-z0-9][a-z0-9-]*$/;

function dir(): string {
	return path.join(PATHS.data, "speaking");
}

function reportFile(id: string): string {
	if (!ID.test(id)) throw new Error(`bad speaking report id ${id}`);
	return path.join(dir(), `${id}.json`);
}

export const speakingStore = {
	put(report: SpeakingReport): void {
		const file = reportFile(report.id);
		fs.mkdirSync(dir(), { recursive: true });
		const tmp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(report, null, 2), "utf-8");
		fs.renameSync(tmp, file);
	},
	get(id: string): SpeakingReport | null {
		try {
			return JSON.parse(fs.readFileSync(reportFile(id), "utf-8")) as SpeakingReport;
		} catch {
			return null;
		}
	},
	list(): SpeakingReport[] {
		let files: string[];
		try {
			files = fs.readdirSync(dir()).filter((f) => f.endsWith(".json") && f !== "index.json");
		} catch {
			return [];
		}
		return files
			.map((f) => f.slice(0, -5))
			.filter((id) => ID.test(id))
			.map((id) => this.get(id))
			.filter((r): r is SpeakingReport => !!r)
			.sort((a, b) => a.at.localeCompare(b.at));
	},
	index(): SpeakingIndexEntry[] {
		try {
			return fs
				.readFileSync(path.join(dir(), "index.jsonl"), "utf-8")
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line) as SpeakingIndexEntry);
		} catch {
			return [];
		}
	},
	addIndex(entry: SpeakingIndexEntry): void {
		const file = path.join(dir(), "index.jsonl");
		fs.mkdirSync(dir(), { recursive: true });
		const known = this.index().some((e) => e.id === entry.id);
		if (known) return;
		fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf-8");
	},
	latest(): SpeakingReport | null {
		return this.list().at(-1) ?? null;
	},
	remove(id: string): boolean {
		try {
			fs.unlinkSync(reportFile(id));
			return true;
		} catch {
			return false;
		}
	},
};
