/**
 * STUDY PROTOCOL PINS (docs/experiments/input-first-russian.md, v3): the
 * analysis does what the protocol fixed before day 1. The model holds the
 * day covariates level, the verdict needs five weeks of checks, the three
 * flags and the speaking comparison are printed beside it, a check closes
 * after its make-up days, and the deviations the schedule can see are found.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	analyzeStudy,
	dateForDayNumber,
	EXPERIMENT_CONSTANTS,
	runRandomizationTest,
	scheduleDeviations,
	buildSchedule,
	weeklyCheckRows,
	type CheckItemRecord,
	type DailyExperimentRecord,
	type ExperimentConfig,
} from "../src/core/experiment.ts";

const START = "2026-11-10";
const ONSET = 15;
const config: ExperimentConfig = {
	id: "input-first-russian",
	title: "t",
	version: "v3",
	startDate: START,
	endDate: dateForDayNumber(START, 42),
	days: 42,
	seed: 1,
	onsetDay: ONSET,
	onsetDate: dateForDayNumber(START, ONSET),
	languages: { treatment: "russian", control: "slovak" },
	protocolHash: "",
	gitCommit: "",
	decisionRule: "",
};

function day(language: string, d: number, share: number | null, extra: Partial<DailyExperimentRecord> = {}): DailyExperimentRecord {
	const post = d >= ONSET;
	return {
		date: dateForDayNumber(START, d),
		dayNumber: d,
		language,
		phase: post ? "intervention" : "baseline",
		arm: language === "russian" && post ? "input-first" : "normal",
		firstPlayShare: share,
		dictationReps: share === null ? 0 : 10,
		understoodReps: share === null ? 0 : Math.round(share * 10),
		covariates: { meanWordsPerSentence: 6 },
		minutes: 20,
		minutesBy: { listen: 20 },
		compliance: 100,
		compliant: true,
		...extra,
	};
}

const days = (language: string, share: (d: number) => number, extra: (d: number) => Partial<DailyExperimentRecord> = () => ({})) => Array.from({ length: 42 }, (_, i) => day(language, i + 1, share(i + 1), extra(i + 1)));

function weekChecks(language: string, week: number, probesRight: number, production: number): CheckItemRecord[] {
	const base = { date: dateForDayNumber(START, week * 7), week, dayNumber: week * 7, language, prompt: "", expected: "", response: "x", verdict: "" };
	return [
		...Array.from({ length: 10 }, (_, n) => ({ ...base, type: "probe" as const, itemId: `p${week}-${n}`, score: n < probesRight ? 1 : 0 })),
		...Array.from({ length: 5 }, (_, n) => ({ ...base, type: "production" as const, itemId: `w${week}-${n}`, score: production, engine: "stt:deepgram" })),
	];
}

const allWeeks = (language: string, production: (week: number) => number) => Array.from({ length: 6 }, (_, i) => weekChecks(language, i + 1, 6, production(i + 1))).flat();

test("the model holds sentence length level: harder sentences after the switch no longer hide the jump", () => {
	// After the switch the sentences are two words longer, and each extra word costs 5 points.
	const words = (d: number) => 6 + (d >= ONSET ? 2 : 0) + (d % 3);
	const russian = days("russian", (d) => 0.5 + (d >= ONSET ? 0.2 : 0) - 0.05 * (words(d) - 6), (d) => ({ covariates: { meanWordsPerSentence: words(d) } }));

	const result = runRandomizationTest(russian, ONSET);
	assert.deepEqual(result.covariatesUsed, ["meanWordsPerSentence"]);
	assert.ok(Math.abs(result.b2 - 0.2) < 1e-6, `the jump is +20 points once length is held level, got ${result.b2}`);

	const unadjusted = runRandomizationTest(russian.map((r) => ({ ...r, covariates: { meanWordsPerSentence: 6 } })), ONSET);
	assert.deepEqual(unadjusted.covariatesUsed, [], "a constant covariate is left out");
	assert.ok(unadjusted.b2 < 0.15, `without the covariate the jump reads smaller (${unadjusted.b2})`);
});

test("a covariate missing on a counted day is left out instead of guessed", () => {
	const russian = days("russian", (d) => (d >= ONSET ? 0.7 : 0.5), (d) => ({ covariates: { meanWordsPerSentence: 6, ...(d === 3 ? {} : { meanFrequencyRank: 400 + d }) } }));
	assert.deepEqual(runRandomizationTest(russian, ONSET).covariatesUsed, []);
});

test("the verdict needs five weeks of checks even when the jump is clear", () => {
	const daily = [...days("russian", (d) => (d >= ONSET ? 0.7 : 0.5)), ...days("slovak", () => 0.5)];
	const fourWeeks = allWeeks("russian", () => 0.8).filter((c) => c.week <= 4);
	const early = analyzeStudy(config, daily, fourWeeks, 43);
	assert.equal(early.regression.verdictStatus, "confirmed_benefit");
	assert.equal(early.checkWeeksDone, 4);
	assert.equal(early.verdictStatus, "insufficient_data");

	const done = analyzeStudy(config, daily, allWeeks("russian", () => 0.8), 43);
	assert.equal(done.checkWeeksDone, 6);
	assert.equal(done.verdictStatus, "confirmed_benefit");
});

test("the time-trend flag goes up when the control jumps on the same day by half or more", () => {
	const russian = days("russian", (d) => (d >= ONSET ? 0.7 : 0.5));
	const calendar = analyzeStudy(config, [...russian, ...days("slovak", (d) => (d >= ONSET ? 0.62 : 0.5))], [], 43);
	assert.ok(calendar.flags.timeTrend.flagged, `control moved ${calendar.flags.timeTrend.controlB2}`);
	const flat = analyzeStudy(config, [...russian, ...days("slovak", () => 0.5)], [], 43);
	assert.equal(flat.flags.timeTrend.flagged, false);
	assert.ok(Math.abs(flat.flags.timeTrend.controlB2!) < 1e-6);
});

test("compliance and balance read the treatment's minutes on listening-first days", () => {
	const russian = days(
		"russian",
		(d) => (d >= ONSET ? 0.7 : 0.5),
		(d): Partial<DailyExperimentRecord> => (d >= ONSET ? { minutes: 8, minutesBy: { listen: 6, speak: 2 } } : { minutes: 20, minutesBy: { listen: 10, lesson: 10 } }),
	);
	const study = analyzeStudy(config, [...russian, ...days("slovak", () => 0.5)], [], 43);
	assert.equal(study.flags.compliance.share, 75);
	assert.ok(study.flags.compliance.flagged, "a lesson-free day with speaking on it is under 90%");
	assert.equal(study.flags.balance.ratio, 40);
	assert.ok(study.flags.balance.flagged, "8 minutes a day against 20 before is under 70%");

	const kept = analyzeStudy(config, [...days("russian", (d) => (d >= ONSET ? 0.7 : 0.5)), ...days("slovak", () => 0.5)], [], 43);
	assert.equal(kept.flags.compliance.flagged, false);
	assert.equal(kept.flags.balance.ratio, 100);
});

test("speaking is compared before and after the switch, and a drop of ten points is named a cost", () => {
	const daily = [...days("russian", () => 0.5), ...days("slovak", () => 0.5)];
	// The switch is day 15, so the checks of weeks 1 and 2 (days 7 and 14) come before it.
	const study = analyzeStudy(config, daily, allWeeks("russian", (w) => (w <= 2 ? 0.8 : 0.7)), 43);
	assert.equal(study.speaking.baselineWeeks, 2);
	assert.equal(study.speaking.armWeeks, 4);
	assert.ok(Math.abs(study.speaking.baselineProduction! - 0.8) < 1e-9);
	assert.ok(Math.abs(study.speaking.armProduction! - 0.7) < 1e-9);
	assert.ok(study.speaking.cost);

	const steady = analyzeStudy(config, daily, allWeeks("russian", (w) => (w <= 2 ? 0.8 : 0.75)), 43);
	assert.equal(steady.speaking.cost, false);
});

test("a weekly check stays open through its two make-up days, then counts as missed", () => {
	const state = (today: number) => weeklyCheckRows(config, [], today).find((r) => r.week === 1 && r.language === "russian")!;
	assert.equal(state(6).state, "ahead");
	assert.equal(state(7).state, "open");
	assert.equal(state(7 + EXPERIMENT_CONSTANTS.MAKE_UP_DAYS).state, "open");
	assert.equal(state(7 + EXPERIMENT_CONSTANTS.MAKE_UP_DAYS).lastDate, dateForDayNumber(START, 9));
	assert.equal(state(10).state, "missed");
	assert.equal(weeklyCheckRows(config, weekChecks("russian", 1, 5, 0.5), 10).find((r) => r.week === 1 && r.language === "russian")!.state, "done");
});

test("the schedule's deviations: a past day short in a language, and a check whose window closed; today is not judged yet", () => {
	const schedule = buildSchedule(START, ONSET, 42);
	const daily = [day("russian", 1, 0.5), day("slovak", 1, null, { dictationReps: 3 }), day("russian", 2, 0.5), day("slovak", 2, 0.5)];
	const found = scheduleDeviations(config, schedule, daily, weekChecks("slovak", 1, 5, 0.5), 10);
	const keys = found.map((d) => d.key);
	assert.ok(keys.includes(`missed-day:${dateForDayNumber(START, 1)}:slovak`));
	assert.ok(!keys.includes(`missed-day:${dateForDayNumber(START, 1)}:russian`), "a day with ten sentences counts");
	assert.ok(!keys.some((k) => k.includes(dateForDayNumber(START, 10))), "today can still be finished");
	assert.ok(keys.includes("missed-check:1:russian"));
	assert.ok(!keys.includes("missed-check:1:slovak"), "a finished check is not missed");
	assert.match(found.find((d) => d.key.endsWith(`${dateForDayNumber(START, 1)}:slovak`))!.note, /3 of the 5/);
});
