/**
 * THE ZONE ON DISK (LangHarness, 2026-11-03, E42): first tries recorded by
 * lessons, read back by the analysis, place a unit against the band; a unit
 * below it gets a lesson that starts one stage easier, a line in the
 * summary, and a line in the tutor's profile. Runs under an isolated
 * LH_DATA_DIR, so every app-module import is dynamic.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-flow-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { lessonFor, progressSummary, recordLesson } = await import("../src/server/lesson.ts");
const { analyzeNow, unitZoneMap } = await import("../src/server/mistakes-snapshot.ts");
const { learnerProfileSegment } = await import("../src/agent/learner-profile.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

/** A rep the learner got right in the end, after the cue, with the first try as given. */
const rep = (i: number, firstRight: boolean) => ({
	itemId: `nikto#${i}`,
	slug: `nikto-${i}`,
	kind: "type" as const,
	verdict: "exact" as const,
	first: { given: firstRight ? "Nikto" : "Niekto", verdict: (firstRight ? "exact" : "wrong") as "exact" | "wrong" },
	detail: { unit: "words", lemma: "nikto", gloss: "no one", sentence: "Nikto mi nezavolal.", translation: "Nobody called me.", answer: "Nikto", given: "Nikto" },
});

/** Twelve reps, `wrong` of them missed on the first try. */
const lesson = (wrong: number) => Array.from({ length: 12 }, (_, i) => rep(i, i >= wrong));

describe("the zone on disk", () => {
	it("a unit with no analysis yet is not placed, and its lesson keeps its stage", () => {
		assert.deepEqual(unitZoneMap(), {});
		const plan = lessonFor("words", 1);
		assert.equal(plan.flow, undefined);
		assert.equal(progressSummary(0, new Date("2026-11-03T09:00:00Z")).flow.focus, null);
	});

	it("first tries mostly wrong place a finished unit below the zone", () => {
		for (let day = 1; day <= 3; day++) recordLesson({ unit: "words", mode: "lesson", reps: lesson(9), tz: 0 }, new Date(`2026-11-0${day}T09:00:00Z`));
		analyzeNow(new Date("2026-11-03T10:00:00Z"));
		const z = unitZoneMap().words!;
		assert.equal(z.zone, "hard");
		assert.equal(z.reps, 36);
		assert.equal(z.right, 9);
		assert.equal(z.lately, true);
	});

	it("the lesson then starts one stage easier, and says so", () => {
		const plan = lessonFor("words", 1);
		assert.equal(plan.stage, "practiced", "a finished unit is strong; the zone steps it down once");
		assert.deepEqual(plan.flow, { zone: "hard", shift: "down", from: "strong" });
	});

	it("the summary and the daily plan name the unit", () => {
		const s = progressSummary(0, new Date("2026-11-03T11:00:00Z"));
		assert.equal(s.flow.units.words?.zone, "hard");
		assert.equal(s.flow.counts.hard, 1);
		assert.equal(s.flow.focus?.unit, "words");
		assert.deepEqual(s.flow.band, { low: 0.65, high: 0.85 });
	});

	it("the tutor is told which units sit outside the zone", () => {
		const text = learnerProfileSegment()!;
		assert.match(text, /Zone \(first tries against a 65–85% band\): below the zone/);
	});

	it("good first tries bring the unit back, and the stage stands", () => {
		for (let i = 0; i < 4; i++) recordLesson({ unit: "words", mode: "lesson", reps: lesson(2), tz: 0 }, new Date(`2026-11-0${4 + (i % 2)}T09:00:00Z`));
		for (let i = 0; i < 4; i++) recordLesson({ unit: "words", mode: "lesson", reps: lesson(2), tz: 0 }, new Date("2026-11-20T09:00:00Z"));
		analyzeNow(new Date("2026-11-21T10:00:00Z"));
		const z = unitZoneMap().words!;
		assert.notEqual(z.zone, "hard", "the last two weeks are mostly right");
		assert.equal(lessonFor("words", 1).flow, undefined);
	});
});
