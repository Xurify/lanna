/**
 * REVIEW LOG CACHE (perf, 2026-11-02): the review log is parsed once and kept until the file
 * changes, so a sidebar load does not re-parse a year of reviews. The cache must never show
 * a log that differs from the file: appends update it, any other change to the file drops it.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-review-log-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { reviewStore } = await import("../src/store/review.ts");
const { reviewStatus } = await import("../src/server/review.ts");
const { PATHS } = await import("../config.ts");
type ReviewLogEntry = import("../src/core/review.ts").ReviewLogEntry;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const entry = (at: string): ReviewLogEntry => ({ cardId: "c", rating: 3, given: "x", verdict: "exact", elapsedDays: 0, reviewedAt: at });
const LOG = () => path.join(PATHS.review, "log.jsonl");

test("an append shows in the next read without a re-read of the file", () => {
	assert.equal(reviewStore.readLog().length, 0);
	reviewStore.appendLog(entry("2026-11-01T10:00:00.000Z"));
	reviewStore.appendLog(entry("2026-11-01T11:00:00.000Z"));
	const first = reviewStore.readLog();
	assert.equal(first.length, 2);
	assert.equal(reviewStore.readLog(), first, "the second read returns the same parse");
});

test("a change to the file from outside drops the cache", () => {
	const before = reviewStore.readLog().length;
	fs.appendFileSync(LOG(), `${JSON.stringify(entry("2026-11-01T12:00:00.000Z"))}\n`, "utf-8");
	assert.equal(reviewStore.readLog().length, before + 1);
	fs.writeFileSync(LOG(), "", "utf-8");
	assert.equal(reviewStore.readLog().length, 0);
});

test("reviewedToday counts only the learner's local day, from the newest lines", () => {
	const now = new Date("2026-11-02T15:00:00Z");
	// 2 November is "today" at UTC; the older lines and the one at 01:00Z on 1 November are not.
	for (const at of ["2026-10-01T08:00:00Z", "2026-10-30T10:00:00Z", "2026-11-01T01:00:00Z", "2026-11-02T09:00:00Z", "2026-11-02T10:00:00Z"]) reviewStore.appendLog(entry(at));
	assert.equal(reviewStatus(now, 0, { mint: false }).counts.reviewedToday, 2);
	// A learner five hours behind UTC (offset 300): 09:00Z and 10:00Z are 2 November for them too.
	assert.equal(reviewStatus(now, 300, { mint: false }).counts.reviewedToday, 2);
	// Seven hours ahead of UTC (offset -420), at 03:00 local on 2 November: the 09:00Z and 10:00Z lines are 2 November there too.
	assert.equal(reviewStatus(new Date("2026-11-01T20:00:00Z"), -420, { mint: false }).counts.reviewedToday, 2);
});

test("cardsToday counts a card once however often it was answered, so the day's bar does not grow when a card comes back", () => {
	fs.writeFileSync(LOG(), "", "utf-8");
	const now = new Date("2026-11-02T15:00:00Z");
	const at = (hour: number, cardId: string): ReviewLogEntry => ({ ...entry(`2026-11-02T${String(hour).padStart(2, "0")}:00:00Z`), cardId });
	for (const e of [at(8, "a"), at(9, "a"), at(10, "a"), at(11, "b")]) reviewStore.appendLog(e);
	const { counts } = reviewStatus(now, 0, { mint: false });
	assert.equal(counts.reviewedToday, 4, "four answers");
	assert.equal(counts.cardsToday, 2, "two cards");
});

test("the day's total holds still: unanswered new cards and cards due later today are counted from the morning", () => {
	fs.writeFileSync(LOG(), "", "utf-8");
	const card = (id: string, state: "new" | "review", due: string, extra: object = {}) => ({ id, slug: id, lemma: id, gloss: "", sentence: "x", translation: "", answer: "x", at: 0, state, due, reps: 0, lapses: 0, createdAt: "2026-11-01T00:00:00Z", ...extra });
	reviewStore.writeCards({
		queued: card("queued", "new", "2026-11-02T08:00:00Z"),
		now: card("now", "review", "2026-11-02T07:00:00Z"),
		afternoon: card("afternoon", "review", "2026-11-02T16:00:00Z"),
		tomorrow: card("tomorrow", "review", "2026-11-03T09:00:00Z"),
		parked: card("parked", "review", "2026-11-02T16:00:00Z", { suspended: true }),
	} as never);
	const { counts } = reviewStatus(new Date("2026-11-02T09:00:00Z"), 0, { mint: false });
	assert.equal(counts.dueUntouched, 1, "one is due now");
	assert.equal(counts.pendingNew, 1, "the card a lesson put in the deck");
	assert.equal(counts.dueLater, 1, "the afternoon card, not tomorrow's and not the suspended one");
	// Seen in the morning, a card is in the bar's done and no longer later work.
	reviewStore.appendLog({ ...entry("2026-11-02T08:30:00Z"), cardId: "afternoon" });
	assert.equal(reviewStatus(new Date("2026-11-02T09:00:00Z"), 0, { mint: false }).counts.dueLater, 0);
	// Five hours behind UTC the local day ends at 05:00Z on 3 November, so a card due at 04:00Z that day is still today's there and tomorrow's at 09:00Z is not.
	reviewStore.writeCards({ ...reviewStore.readCards(), lateNight: card("lateNight", "review", "2026-11-03T04:00:00Z") } as never);
	assert.equal(reviewStatus(new Date("2026-11-02T09:00:00Z"), 300, { mint: false }).counts.dueLater, 1);
	assert.equal(reviewStatus(new Date("2026-11-02T09:00:00Z"), 0, { mint: false }).counts.dueLater, 0);
});
