/**
 * TRAJECTORY PINS (LangHarness, 2026-10-29): the pace read from the last
 * 14 days, the past from the day snapshots (jumps kept, older days pieced
 * together to meet the first one), the credited rate measured per practice
 * hour with placement days left out, and the date the target lands.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysToReach, horizonDays, measuredPace, MIN_WORD_SNAPSHOTS, trajectory, type TrajectoryDay, type TrajectoryInput } from "../src/core/trajectory.ts";

function days(n: number, f: (i: number) => Partial<TrajectoryDay> = () => ({})): TrajectoryDay[] {
	return Array.from({ length: n }, (_, i) => ({ day: `d${i}`, minutes: 0, lessons: 0, hours: null, units: null, words: null, ...f(i) }));
}

function input(d: TrajectoryDay[], over: Partial<TrajectoryInput> = {}): TrajectoryInput {
	return { days: d, hoursDone: 10, hoursTarget: 100, unitsDone: 5, unitsTotal: 50, wordsNow: null, goalMinutes: 20, goalDays: 6, ...over };
}

const FULL = { minutesPerDay: 60, daysPerWeek: 7 };

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

describe("hours without snapshots (the days before they were kept)", () => {
	const d = days(14, () => ({ minutes: 60 }));
	it("spreads the value now over the days and assumes an hour counts as one", () => {
		const t = trajectory(input(d), "hours", FULL);
		assert.equal(t.ready, true);
		assert.equal(t.basis, "assumed");
		assert.equal(t.perPracticeHour, 1);
		assert.equal(t.past.at(-1)!.value, 10);
		assert.equal(t.past[0]!.day, -13);
		assert.equal(t.ratePerDay, 1);
		assert.equal(t.daysToTarget, 90);
	});
	it("a slower pace lands later, a flat one never", () => {
		assert.equal(trajectory(input(d), "hours", { minutesPerDay: 30, daysPerWeek: 7 }).daysToTarget, 180);
		assert.equal(trajectory(input(d), "hours", { minutesPerDay: 0, daysPerWeek: 7 }).daysToTarget, null);
	});
	it("has a flat past with no minutes on record", () => {
		assert.deepEqual(trajectory(input(days(14)), "hours", { minutesPerDay: 20, daysPerWeek: 6 }).past, [{ day: 0, value: 10 }]);
	});
});

describe("hours with snapshots", () => {
	// 30 days of an hour a day; the map credits half an hour a day from day 10,
	// and a placement check on day 20 credits 30 hours at once.
	const d = days(30, (i) => ({
		minutes: 60,
		hours: i < 10 ? null : 5 + (i - 10) * 0.5 + (i >= 20 ? 30 : 0),
		...(i === 20 ? { placed: true } : {}),
	}));
	const now = 5 + 19 * 0.5 + 30;
	const t = trajectory(input(d, { hoursDone: now }), "hours", FULL);

	it("measures the credited rate and leaves the placement jump out of it", () => {
		assert.equal(t.basis, "measured");
		assert.ok(Math.abs(t.perPracticeHour - 0.5) < 1e-9, String(t.perPracticeHour));
	});
	it("keeps the jump in the past line instead of smoothing it", () => {
		const before = t.past.find((p) => p.day === 20 - 29 - 1)!;
		const on = t.past.find((p) => p.day === 20 - 29)!;
		assert.equal(on.value - before.value, 30.5);
	});
	it("pieces the days before the first snapshot together to meet it", () => {
		const early = t.past.filter((p) => p.day < 10 - 29);
		assert.equal(early.length, 10);
		assert.ok(early.every((p, i) => i === 0 || p.value >= early[i - 1]!.value));
		assert.ok(early.at(-1)!.value <= 5);
	});
	it("needs a week and an hour of practice to measure, else assumes", () => {
		const short = days(30, (i) => ({ minutes: 60, hours: i >= 26 ? 5 + (i - 26) : null }));
		assert.equal(trajectory(input(short), "hours", FULL).basis, "assumed");
		const idle = days(30, (i) => ({ minutes: 0, hours: i >= 10 ? 5 : null }));
		assert.equal(trajectory(input(idle), "hours", FULL).basis, "assumed");
	});
});

describe("units", () => {
	it("is not ready before any lesson or snapshot", () => {
		assert.equal(trajectory(input(days(14, () => ({ minutes: 20 }))), "units", { minutesPerDay: 20, daysPerWeek: 6 }).ready, false);
	});
	it("falls back to lessons per hour until the rate can be measured", () => {
		const d = days(14, () => ({ minutes: 60, lessons: 2 }));
		const t = trajectory(input(d), "units", FULL);
		assert.equal(t.ready, true);
		assert.equal(t.basis, "assumed");
		assert.ok(Math.abs(t.ratePerDay - (5 / 28) * 2) < 1e-9);
		assert.ok(t.future.every((p) => p.value <= 50));
	});
	it("measures units per practice hour from the snapshots", () => {
		const d = days(30, (i) => ({ minutes: 60, lessons: 1, units: i < 10 ? null : 4 + Math.floor((i - 10) / 2) }));
		const t = trajectory(input(d, { unitsDone: 13 }), "units", FULL);
		assert.equal(t.basis, "measured");
		assert.ok(t.perPracticeHour > 0.4 && t.perPracticeHour < 0.55, String(t.perPracticeHour));
	});
	it("a lowered target never moves the past or the line below now", () => {
		const d = days(30, (i) => ({ minutes: 60, lessons: 1, units: 20 + i }));
		const t = trajectory(input(d, { unitsDone: 49, unitsTotal: 30 }), "units", FULL);
		assert.equal(t.daysToTarget, 0);
		assert.ok(t.future.every((p) => p.value >= 49));
	});
});

describe("words", () => {
	it("waits for a week of snapshots", () => {
		const d = days(14, (i) => ({ minutes: 30, words: i >= 10 ? 100 + i : null }));
		assert.equal(trajectory(input(d, { wordsNow: 114 }), "words", { minutesPerDay: 30, daysPerWeek: 7 }).ready, false);
	});
	it("draws the snapshots and projects the gain per practice hour", () => {
		const d = days(14, (i) => ({ minutes: 60, words: 100 + i * 10 }));
		assert.ok(d.filter((x) => x.words !== null).length >= MIN_WORD_SNAPSHOTS);
		const t = trajectory(input(d, { wordsNow: 230 }), "words", FULL);
		assert.equal(t.ready, true);
		assert.equal(t.past.length, 14);
		assert.equal(t.basis, "measured");
		assert.equal(t.ratePerDay, 10);
		assert.equal(t.target, null);
		assert.equal(t.daysToTarget, null);
	});
	it("uses the recent weeks, not the whole history", () => {
		// 60 days: 5 words an hour for 32 days, then 20 an hour for the last 28.
		const d = days(60, (i) => ({ minutes: 60, words: i < 32 ? 100 + i * 5 : 100 + 31 * 5 + (i - 31) * 20 }));
		const t = trajectory(input(d, { wordsNow: d.at(-1)!.words }), "words", FULL);
		assert.ok(Math.abs(t.perPracticeHour - 20) < 1e-9, String(t.perPracticeHour));
	});
});
