/**
 * Spaced-review persistence (LangHarness) — the active profile's
 * data/profiles/<language>/review/:
 *
 *   cards.json    every minted card by id (read-modify-write, atomic
 *                 rename — the card's memory state is mutable by design)
 *   log.jsonl     one line per review, append-only (the evidence: FSRS
 *                 parameters can be re-fitted from it later)
 *   meta.json     settings + how many new cards each local day introduced
 *
 * The only module that touches review/. Shapes: src/core/review.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import {
	DEFAULT_REVIEW_SETTINGS,
	type ReviewCard,
	type ReviewLogEntry,
	type ReviewSettings,
} from "../core/review.ts";

const CARDS_FILE = () => path.join(PATHS.review, "cards.json");
const LOG_FILE = () => path.join(PATHS.review, "log.jsonl");
const META_FILE = () => path.join(PATHS.review, "meta.json");

export interface ReviewMeta {
	settings: ReviewSettings;
	/** local day → new cards introduced that day */
	introduced: Record<string, number>;
}

function readJson<T>(file: string, fallback: T): T {
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
	} catch {
		return fallback;
	}
}

function writeJsonAtomic(file: string, value: unknown): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(value), "utf-8");
	fs.renameSync(tmp, file);
}

export const reviewStore = {
	readCards(): Record<string, ReviewCard> {
		return readJson<Record<string, ReviewCard>>(CARDS_FILE(), {});
	},
	writeCards(cards: Record<string, ReviewCard>): void {
		writeJsonAtomic(CARDS_FILE(), cards);
	},
	appendLog(entry: ReviewLogEntry): void {
		fs.mkdirSync(PATHS.review, { recursive: true });
		fs.appendFileSync(LOG_FILE(), `${JSON.stringify(entry)}\n`, "utf-8");
	},
	readLog(): ReviewLogEntry[] {
		try {
			return fs
				.readFileSync(LOG_FILE(), "utf-8")
				.split("\n")
				.filter(Boolean)
				.flatMap((line) => {
					try {
						return [JSON.parse(line) as ReviewLogEntry];
					} catch {
						return [];
					}
				});
		} catch {
			return [];
		}
	},
	readMeta(): ReviewMeta {
		const meta = readJson<Partial<ReviewMeta>>(META_FILE(), {});
		return {
			settings: { ...DEFAULT_REVIEW_SETTINGS, ...(meta.settings ?? {}) },
			introduced: meta.introduced ?? {},
		};
	},
	writeMeta(meta: ReviewMeta): void {
		writeJsonAtomic(META_FILE(), meta);
	},
};
