/**
 * EXPERIMENT CORE TESTS (docs/experiments/input-first-russian.md).
 *
 * Verifies:
 * - Deterministic PRNG and onset day draw from candidate set [12..22].
 * - Full 42-day schedule generation (Day 1 Mon 9 Nov to Day 42 Sun 20 Dec 2026).
 * - Weekly check scheduled on every Sunday (days 7, 14, 21, 28, 35, 42).
 * - First-play understood rule accuracy.
 * - Compliance calculation for input-first arm.
 * - Interrupted time series OLS regression & randomization test logic.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	buildSchedule,
	calculateCompliance,
	createRng,
	dateForDayNumber,
	dayNumberForDate,
	drawOnsetDay,
	EXPERIMENT_CONSTANTS,
	fitInterruptedTimeSeries,
	isFirstPlayUnderstood,
	runRandomizationTest,
	weeklyCheckRows,
	type CheckItemRecord,
	type DailyExperimentRecord,
	type ExperimentConfig,
} from "../src/core/experiment.ts";

test("PRNG is deterministic and draws onset within candidate range [12..22]", () => {
	const rng1 = createRng(20261108);
	const rng2 = createRng(20261108);
	for (let i = 0; i < 10; i++) {
		assert.equal(rng1(), rng2());
	}

	const onset = drawOnsetDay(20261108);
	assert.ok(EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS.includes(onset as any), `Onset ${onset} not in candidate set`);
	assert.equal(onset, 15, "Seed 20261108 draws Day 15 (2026-11-23)");
});

test("Date and day number arithmetic handles 42-day span correctly", () => {
	assert.equal(dateForDayNumber("2026-11-09", 1), "2026-11-09");
	assert.equal(dateForDayNumber("2026-11-09", 42), "2026-12-20");
	assert.equal(dayNumberForDate("2026-11-09", "2026-11-09"), 1);
	assert.equal(dayNumberForDate("2026-11-09", "2026-12-20"), 42);
	assert.equal(dayNumberForDate("2026-11-09", "2026-11-23"), 15);
});

test("Schedule generation properly assigns arms, phases and weekly check days", () => {
	const schedule = buildSchedule("2026-11-09", 15, 42);
	assert.equal(schedule.length, 42);

	// Baseline days 1..14
	for (let d = 1; d <= 14; d++) {
		const s = schedule[d - 1]!;
		assert.equal(s.phase, "baseline");
		assert.equal(s.russianArm, "normal");
		assert.equal(s.slovakArm, "normal");
	}

	// Intervention days 15..42
	for (let d = 15; d <= 42; d++) {
		const s = schedule[d - 1]!;
		assert.equal(s.phase, "intervention");
		assert.equal(s.russianArm, "input-first");
		assert.equal(s.slovakArm, "normal");
	}

	// Weekly checks on Sundays (7, 14, 21, 28, 35, 42)
	const checkDays = schedule.filter((s) => s.weeklyCheckDue).map((s) => s.dayNumber);
	assert.deepEqual(checkDays, [7, 14, 21, 28, 35, 42]);
});

test("isFirstPlayUnderstood checks dictation, zero replays, not peeked, exact or accents verdict", () => {
	assert.ok(isFirstPlayUnderstood({ kind: "dictation", verdict: "exact", replays: 0, peeked: false }));
	assert.ok(isFirstPlayUnderstood({ answer: "type", verdict: "accents", peeked: false }));
	// Fail cases:
	assert.ok(!isFirstPlayUnderstood({ kind: "dictation", verdict: "exact", replays: 1 }));
	assert.ok(!isFirstPlayUnderstood({ kind: "dictation", verdict: "exact", peeked: true }));
	assert.ok(!isFirstPlayUnderstood({ kind: "dictation", verdict: "wrong" }));
	assert.ok(!isFirstPlayUnderstood({ answer: "pick", verdict: "exact" })); // meaning selection does not qualify
});

test("calculateCompliance counts only allowed input and vocab minutes", () => {
	// 100% compliant
	assert.equal(calculateCompliance({ listen: 10, words: 5, read: 10, review: 5 }), 100);
	// Disallowed task (speak: 10, fluency: 10, listen: 20) -> 20/40 = 50%
	assert.equal(calculateCompliance({ speak: 10, fluency: 10, listen: 20 }), 50);
});

test("fitInterruptedTimeSeries estimates positive level shift b2 accurately", () => {
	const onset = 15;
	const records: DailyExperimentRecord[] = [];

	// Synthesize 42 days: baseline at 0.50, post at 0.70 (+0.20 level shift)
	for (let d = 1; d <= 42; d++) {
		const isPost = d >= onset;
		const baseShare = 0.5;
		const shift = isPost ? 0.2 : 0.0;
		records.push({
			date: dateForDayNumber("2026-11-09", d),
			dayNumber: d,
			language: "russian",
			phase: isPost ? "intervention" : "baseline",
			arm: isPost ? "input-first" : "normal",
			firstPlayShare: baseShare + shift,
			dictationReps: 10,
			understoodReps: Math.round((baseShare + shift) * 10),
			covariates: { meanWordsPerSentence: 5 },
			minutes: 20,
			minutesBy: { listen: 20 },
			compliance: 100,
			compliant: true,
		});
	}

	const fit = fitInterruptedTimeSeries(records, onset);
	assert.ok(fit !== null);
	assert.ok(Math.abs(fit.b2 - 0.2) < 0.01, `Expected b2 ~0.20, got ${fit.b2}`);

	const analysis = runRandomizationTest(records, onset);
	assert.equal(analysis.verdictStatus, "confirmed_benefit");
	assert.ok(analysis.pValue <= 1 / 11 + 1e-4, `Expected p-value <= 1/11, got ${analysis.pValue}`);
});

test("weeklyCheckRows opens a check on its day and counts a repeated item once", () => {
	const config: ExperimentConfig = {
		id: "input-first-russian",
		title: "t",
		version: "3",
		startDate: "2026-11-09",
		endDate: "2026-12-20",
		days: 42,
		seed: 20261108,
		onsetDay: 15,
		onsetDate: "2026-11-23",
		languages: { treatment: "russian", control: "slovak" },
		protocolHash: "",
		gitCommit: "",
		decisionRule: "",
	};
	const item = (type: "probe" | "production", n: number, score: number): CheckItemRecord => ({ date: "2026-11-15", week: 1, dayNumber: 7, language: "russian", type, itemId: `${type}-${n}`, prompt: "", expected: "", response: "", score, verdict: "" });
	const firstTry = [...Array.from({ length: 10 }, (_, n) => item("probe", n, n < 6 ? 1 : 0)), ...Array.from({ length: 5 }, (_, n) => item("production", n, 0.8))];
	const secondTry = [item("probe", 9, 1)];

	const beforeTheDay = weeklyCheckRows(config, [], 6);
	assert.equal(beforeTheDay.length, 12);
	assert.ok(beforeTheDay.every((r) => r.state === "ahead"));

	const onTheDay = weeklyCheckRows(config, [], 7);
	assert.deepEqual(onTheDay.filter((r) => r.state === "open").map((r) => `${r.week}:${r.language}`), ["1:russian", "1:slovak"]);
	assert.equal(onTheDay[0]!.date, "2026-11-15");

	const answered = weeklyCheckRows(config, [...firstTry, ...secondTry], 7);
	const russian = answered[0]!;
	assert.equal(russian.state, "done");
	assert.equal(russian.probesAnswered, 10);
	assert.equal(russian.probesUnderstood, 7);
	assert.ok(Math.abs(russian.productionMatch! - 0.8) < 1e-9);
	assert.equal(answered[1]!.state, "open");
	assert.equal(answered[1]!.productionMatch, null);
});

test("the study's server code names no folder outside the data root", () => {
	const source = readFileSync(new URL("../src/server/experiment.ts", import.meta.url), "utf8");
	assert.doesNotMatch(source, /[A-Za-z]:[\/]Users|Projects\/langharness/, "a sandbox or a test must never read or write the real data folder");
});
