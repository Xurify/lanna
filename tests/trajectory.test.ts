/**
 * TRAJECTORY PINS (LangHarness, 2026-10-29): the pace read from the last
 * 14 days, the past spread over the days, the line carried forward, and the
 * date the target lands.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysToReach, horizonDays, measuredPace, MIN_WORD_SNAPSHOTS, trajectory, type TrajectoryDay, type TrajectoryInput } from "../src/core/trajectory.ts";

function days(n: number, f: (i: number) => Partial<TrajectoryDay> = () => ({})): TrajectoryDay[] {
	return Array.from({ length: n }, (_, i) => ({ day: `d${i}`, minutes: 0, lessons: 0, words: null, ...f(i) }));
}

function input(d: TrajectoryDay[], over: Partial<TrajectoryInput> = {}): TrajectoryInput {
	return { days: d, hoursDone: 10, hoursTarget: 100, unitsDone: 5, unitsTotal: 50, wordsNow: null, goalMinutes: 20, goalDays: 6, ...over };
}

describe("measuredPace", () => {
	it("reads the last 14 days once a week of them has study", () => {
		const p = measuredPace(days(30, (i) => ({ minutes: i % 2 === 0 ? 30 : 0 })), 20, 6);
		assert.equal(p.measured, true);
		assert.equal(p.minutesPerDay, 30);
		assert.equal(p.daysPerWeek, 3.5);
	});
	it("falls back to the goal with too little study or history", () => {
		assert.deepEqual(measuredPace(days(30, (i) => ({ minutes: i > 25 ? 30 : 0 })), 20, 6), { minutesPerDay: 20, daysPerWeek: 6, measured: false });
		assert.equal(measuredPace(days(5, () => ({ minutes: 30 })), 20, 6).measured, false);
	});
});

describe("daysToReach and horizonDays", () => {
	it("is 0 at the target, null with no pace, and rounds up otherwise", () => {
		assert.equal(daysToReach(100, 1, 100), 0);
		assert.equal(daysToReach(10, 0, 100), null);
		assert.equal(daysToReach(10, 4, 100), 23);
	});
	it("draws a little past the target, bounded", () => {
		assert.equal(horizonDays(null), 90);
		assert.equal(horizonDays(10), 60);
		assert.equal(horizonDays(100), 115);
		assert.equal(horizonDays(5000), 730);
	});
});

describe("trajectory: hours", () => {
	const d = days(14, () => ({ minutes: 60 }));
	it("ends the past at hours done and carries the pace forward", () => {
		const t = trajectory(input(d), "hours", { minutesPerDay: 60, daysPerWeek: 7 });
		assert.equal(t.ready, true);
		assert.equal(t.now, 10);
		assert.equal(t.past.at(-1)!.value, 10);
		assert.equal(t.past.at(-1)!.day, 0);
		assert.equal(t.past[0]!.day, -13);
		assert.equal(t.ratePerDay, 1);
		assert.equal(t.daysToTarget, 90);
		assert.equal(t.future[0]!.value, 10);
	});
	it("a slower pace lands later, a flat one never", () => {
		const slow = trajectory(input(d), "hours", { minutesPerDay: 30, daysPerWeek: 7 });
		assert.equal(slow.daysToTarget, 180);
		assert.equal(trajectory(input(d), "hours", { minutesPerDay: 0, daysPerWeek: 7 }).daysToTarget, null);
	});
	it("has a flat past with no minutes on record", () => {
		const t = trajectory(input(days(14)), "hours", { minutesPerDay: 20, daysPerWeek: 6 });
		assert.deepEqual(t.past, [{ day: 0, value: 10 }]);
	});
});

describe("trajectory: units", () => {
	it("is not ready before any lesson", () => {
		assert.equal(trajectory(input(days(14, () => ({ minutes: 20 }))), "units", { minutesPerDay: 20, daysPerWeek: 6 }).ready, false);
	});
	it("scales lessons to units, caps at the total and reaches it", () => {
		const d = days(14, () => ({ minutes: 60, lessons: 2 }));
		const t = trajectory(input(d), "units", { minutesPerDay: 60, daysPerWeek: 7 });
		assert.equal(t.ready, true);
		assert.equal(t.past.at(-1)!.value, 5);
		// 28 lessons ≙ 5 units; 2 lessons an hour → 5/28·2 units an hour.
		assert.ok(Math.abs(t.ratePerDay - (5 / 28) * 2) < 1e-9);
		assert.ok(t.daysToTarget !== null && t.daysToTarget > 0);
		assert.ok(t.future.every((p) => p.value <= 50));
	});
});

describe("trajectory: words", () => {
	it("waits for a week of snapshots", () => {
		const d = days(14, (i) => ({ minutes: 30, words: i >= 10 ? 100 + i : null }));
		assert.equal(trajectory(input(d, { wordsNow: 114 }), "words", { minutesPerDay: 30, daysPerWeek: 7 }).ready, false);
	});
	it("draws the snapshots and projects their gain per hour", () => {
		const d = days(14, (i) => ({ minutes: 60, words: 100 + i * 10 }));
		assert.ok(d.filter((x) => x.words !== null).length >= MIN_WORD_SNAPSHOTS);
		const t = trajectory(input(d, { wordsNow: 230 }), "words", { minutesPerDay: 60, daysPerWeek: 7 });
		assert.equal(t.ready, true);
		assert.equal(t.past.length, 14);
		assert.equal(t.ratePerDay, 10);
		assert.equal(t.target, null);
		assert.equal(t.daysToTarget, null);
	});
});
