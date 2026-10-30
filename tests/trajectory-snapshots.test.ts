/**
 * TRAJECTORY SNAPSHOT PINS (LangHarness, 2026-10-29): the progress summary
 * writes the day's hours, units and words snapshots, rewrites them as a
 * lesson moves them, and hands the days to the trajectory with the
 * placement day flagged.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-trajectory-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { progressSummary, recordLesson } = await import("../src/server/lesson.ts");
const { emptyProgress, progressStore } = await import("../src/store/progress.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const NOW = new Date("2026-10-28T10:00:00Z");
const DAY = "2026-10-28";
const rep = { itemId: "x#0", slug: "x", kind: "choose" as const, verdict: "exact" as const };

beforeEach(() => progressStore.write(emptyProgress()));

describe("progressSummary: the day's snapshots", () => {
	it("writes hours, units and words for today and hands the days over, oldest first", () => {
		const s = progressSummary(0, NOW);
		const today = progressStore.read().days[DAY]!;
		assert.equal(today.hoursDone, 0);
		assert.equal(today.unitsDone, 0);
		assert.equal(today.words, 0);
		assert.equal(s.trajectory.days.length, 120);
		assert.equal(s.trajectory.days.at(-1)!.day, DAY);
		assert.equal(s.trajectory.days.at(-1)!.hours, 0);
		assert.equal(s.trajectory.days[0]!.hours, null);
	});

	it("rewrites them when a lesson moves them, in the same day", () => {
		progressSummary(0, NOW);
		for (let i = 0; i < 3; i++) recordLesson({ unit: "words", mode: "lesson", reps: [rep, rep, rep, rep, rep, rep, rep, rep, rep, rep], tz: 0 }, NOW);
		const today = progressStore.read().days[DAY]!;
		assert.equal(today.lessons, 3);
		assert.equal(today.hoursDone, progressSummary(0, NOW).trajectory.hoursDone);
	});

	it("flags a day with a placement check", () => {
		progressSummary(0, NOW);
		const p = progressStore.read();
		p.days[DAY]!.minutesBy = { placement: 4 };
		p.days[DAY]!.minutes = 4;
		progressStore.write(p);
		assert.equal(progressSummary(0, NOW).trajectory.days.at(-1)!.placed, true);
	});
});
