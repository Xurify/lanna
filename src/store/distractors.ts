/**
 * Near-miss wrong answers — the active profile's
 * data/profiles/<language>/distractors/near-misses.jsonl: one line per Slovak
 * sentence, the English meanings the cheap model wrote that differ from the
 * right one in a single detail. Append-only; the last line for a sentence
 * wins. The only module that touches distractors/. Rule E1: paid for once.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { ensureReadmes } from "./corpus.ts";

export interface NearMiss {
	sk: string;
	en: string;
	near: string[];
	model: string;
	createdAt: string;
	/** What writing it cost (the batch it came from, shared out by sentence). */
	tokens?: { input: number; output: number };
}

const FILE = () => path.join(PATHS.distractors, "near-misses.jsonl");

const key = (sk: string) => sk.normalize("NFC").trim();

let cache: { file: string; mtime: number; size: number; map: Map<string, NearMiss> } | null = null;

function read(): Map<string, NearMiss> {
	const file = FILE();
	let stat: fs.Stats;
	try {
		stat = fs.statSync(file);
	} catch {
		cache = null;
		return new Map();
	}
	if (cache && cache.file === file && cache.mtime === stat.mtimeMs && cache.size === stat.size) return cache.map;
	const map = new Map<string, NearMiss>();
	for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
		if (!line.trim()) continue;
		try {
			const e = JSON.parse(line) as NearMiss;
			if (e && typeof e.sk === "string" && Array.isArray(e.near)) map.set(key(e.sk), e);
		} catch {
			// a torn line (crash mid-append) is skipped, never fatal
		}
	}
	cache = { file, mtime: stat.mtimeMs, size: stat.size, map };
	return map;
}

export const distractorStore = {
	get(sk: string): NearMiss | undefined {
		return read().get(key(sk));
	},
	append(entries: readonly NearMiss[]): void {
		if (entries.length === 0) return;
		fs.mkdirSync(PATHS.distractors, { recursive: true });
		fs.appendFileSync(FILE(), entries.map((e) => `${JSON.stringify({ ...e, sk: key(e.sk) })}\n`).join(""), "utf-8");
		cache = null;
		ensureReadmes();
	},
	/** Test seam. */
	reset(): void {
		cache = null;
	},
};
