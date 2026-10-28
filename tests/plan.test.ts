import assert from "node:assert/strict";
import test from "node:test";
import { levelDates, MIN_PACE_DAYS, paceEta, shiftLine } from "../src/core/index.ts";

const NOW = new Date("2026-10-28T12:00:00Z");

test("a real pace is quoted only after seven study days of the last fourteen", () => {
	assert.equal(MIN_PACE_DAYS, 7);
	// One minute a day for a week: the old rule dated the goal in 2144.
	assert.equal(paceEta(400, 1, 6, NOW), null);
	assert.equal(paceEta(400, 0, 14, NOW), null);
	assert.ok(paceEta(400, 30, 7, NOW));
});

test("levelDates: every level up to the goal, later at a slower pace, reached levels are today", () => {
	const fast = levelDates({ goal: "B1", hoursDone: 100, minutesPerDay: 60, daysPerWeek: 7, now: NOW });
	assert.deepEqual(fast.map((l) => l.level), ["A1", "A2", "B1"]);
	assert.equal(fast[0]!.days, 0);
	assert.equal(fast[0]!.date, "2026-10-28");
	const slow = levelDates({ goal: "B1", hoursDone: 100, minutesPerDay: 20, daysPerWeek: 3, now: NOW });
	assert.ok(slow[2]!.days! > fast[2]!.days!);
	assert.equal(levelDates({ goal: "A2", hoursDone: 0, minutesPerDay: 0, daysPerWeek: 5, now: NOW })[1]!.date, null);
});

test("shiftLine says how far a slider moved the date, and nothing for a small move", () => {
	assert.equal(shiftLine(400, 100), "10 months sooner than your saved plan");
	assert.match(shiftLine(100, 400)!, /later than your saved plan/);
	assert.equal(shiftLine(100, 103), null);
	assert.equal(shiftLine(null, 100), null);
});
