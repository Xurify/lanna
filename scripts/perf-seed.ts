/**
 * A heavy scratch profile for scripts/perf-check.mjs (LangHarness, 2026-11-02).
 *
 *   LH_DATA_DIR=<an empty folder> tsx scripts/perf-seed.ts [cards] [logLines]
 *
 * The demo week has a handful of days and no review deck, so every read is
 * instant and the app looks fast. A learner a year in has thousands of cards
 * and tens of thousands of review-log lines, and the server re-reads them on
 * most requests. This fills the folder with that: `cards` cards (default 1500),
 * answered through the real service so every file has its real shape, and
 * `logLines` log lines (default 20000) by repeating the real ones. Refuses
 * without LH_DATA_DIR and refuses a folder that already has review data.
 */

import fs from "node:fs";
import path from "node:path";

const dir = process.env.LH_DATA_DIR;
if (!dir) {
	console.error("Set LH_DATA_DIR to an empty folder first: this script writes a profile and must not touch your real data.");
	process.exit(1);
}
process.env.LH_PROFILE = "slovak";
const cards = Number(process.argv[2] ?? 1500);
const logLines = Number(process.argv[3] ?? 20000);

const { PATHS } = await import("../config.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { answerReview, reviewStatus } = await import("../src/server/review.ts");

if (fs.existsSync(path.join(PATHS.review, "cards.json"))) {
	console.error(`${dir} already has review data; use a new folder.`);
	process.exit(1);
}

const meta = reviewStore.readMeta();
meta.settings = { ...meta.settings, newPerDay: 100_000 };
reviewStore.writeMeta(meta);

// Spread the answers over the past year so the deck has a due spread, not one wave.
const YEAR = 365 * 86_400_000;
const start = Date.now() - YEAR;
for (let i = 0; i < cards; i++) {
	const now = new Date(start + (YEAR * i) / cards);
	const status = reviewStatus(now, 0, { mint: true });
	if (!status.next) break;
	answerReview({ cardId: status.next.card.id, given: status.next.card.answer, ms: 4000, rating: i % 9 === 0 ? 1 : 3 }, now);
}
meta.settings = { ...meta.settings, newPerDay: 20 };
reviewStore.writeMeta({ ...reviewStore.readMeta(), settings: meta.settings });

const log = reviewStore.readLog();
if (log.length) {
	const lines: string[] = [];
	for (let i = 0; i < logLines; i++) {
		const e = log[i % log.length];
		lines.push(JSON.stringify({ ...e, reviewedAt: new Date(start + (YEAR * i) / logLines).toISOString() }));
	}
	fs.appendFileSync(path.join(PATHS.review, "log.jsonl"), `${lines.join("\n")}\n`, "utf-8");
}
const size = (f: string) => `${Math.round(fs.statSync(path.join(PATHS.review, f)).size / 1024)} kB`;
console.log(`heavy profile: ${Object.keys(reviewStore.readCards()).length} cards (${size("cards.json")}), ${reviewStore.readLog().length} log lines (${size("log.jsonl")})`);
