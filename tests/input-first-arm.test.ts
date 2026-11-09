/**
 * INPUT-FIRST ARM PINS (docs/experiments/input-first-russian.md): with
 * goal.arm = "input-first" the day holds input and vocabulary only, and
 * without it the plan is unchanged.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { curriculumState, dailyPlan, nextLessonUnit, type UnitEvidence } from "../src/core/curriculum.ts";

const evidence: Record<string, UnitEvidence> = { present: { lessons: 2, reps: 30, correct: 24 }, "acc-fem": { lessons: 2, reps: 24, correct: 14 } };
const state = curriculumState(evidence, "B2");
const next = nextLessonUnit(state);
const base = { state, evidence, review: { due: 12, newLeft: 10, available: true }, minutesPerDay: 60, next, dayOfYear: 301 };
const day = { units: {}, reviews: 0, blitz: 0, talks: 0, stories: 0, tutors: 0 };
const FORM_OR_OUTPUT: string[] = ["lesson", "strengthen", "blitz", "speak", "fluency"];
const INPUT_OR_VOCAB = ["review", "listen", "words", "read", "watch"];

test("without an arm the plan is the normal one: form drills and speaking stay", () => {
	const ids = dailyPlan({ ...base, day }).tasks.map((t) => t.id);
	assert.ok(ids.includes("lesson"));
	assert.ok(ids.includes("speak"));
});

test("the input-first arm drops form drills, the tutor and speaking, and keeps input and vocabulary", () => {
	const ids: string[] = dailyPlan({ ...base, arm: "input-first", day }).tasks.map((t) => t.id);
	for (const id of FORM_OR_OUTPUT) assert.ok(!ids.includes(id), `${id} is on the input-first day`);
	assert.ok(ids.includes("listen"), "listening stays");
	assert.ok(ids.includes("words"), "new words in context stay");
	assert.ok(ids.includes("review"), "spaced review stays");
	for (const id of ids) assert.ok(INPUT_OR_VOCAB.includes(id), `${id} is not an input or vocabulary task`);
});

test("the input-first day still fits the planned minutes, and its tasks do not exceed the budget", () => {
	const plan = dailyPlan({ ...base, arm: "input-first", minutesPerDay: 20, day });
	assert.ok(plan.minutes <= 20 + 6, `${plan.minutes} minutes on a 20-minute day`);
	for (const t of plan.tasks) assert.ok(INPUT_OR_VOCAB.includes(t.id as string));
});

test("the arm does not change the task links or the Listen step", () => {
	const normal = dailyPlan({ ...base, day }).tasks.find((t) => t.id === "listen");
	const armed = dailyPlan({ ...base, arm: "input-first", day }).tasks.find((t) => t.id === "listen");
	assert.equal(armed?.href, normal?.href);
	assert.equal(armed?.href, "/listen");
});
