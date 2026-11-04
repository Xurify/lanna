import assert from "node:assert/strict";
import { test } from "node:test";
import { FLOW_HIGH, FLOW_LOW, FLOW_MIN_REPS, easyUnits, flowSummary, flowTutorLine, flowZone, hardUnits, steppedStage, unitZone, unitZones, zoneLine } from "../src/core/flow.ts";
import { curriculumState, dailyPlan, nextLessonUnit, type PlanInput } from "../src/core/curriculum.ts";
import type { UnitId } from "../src/core/lesson.ts";

test("a unit with too few first tries is not placed", () => {
	assert.equal(flowZone(11, 11), "new");
	assert.equal(flowZone(0, FLOW_MIN_REPS - 1), "new");
});

test("the band: hard below it, easy above it, zone otherwise", () => {
	assert.equal(FLOW_LOW, 0.65);
	assert.equal(FLOW_HIGH, 0.85);
	assert.equal(flowZone(5, 20), "hard", "25% of 20 is clearly below");
	assert.equal(flowZone(15, 20), "zone", "75% of 20");
	assert.equal(flowZone(17, 20), "zone", "85% of 20 is the top of the band, not above it");
	assert.equal(flowZone(19, 20), "zone", "95% of 20: the range still reaches down into the band");
	assert.equal(flowZone(20, 20), "easy", "20 of 20 is clearly above");
});

test("a few answers never make a unit hard or easy, however extreme", () => {
	assert.equal(flowZone(0, 11), "new");
	assert.equal(flowZone(12, 12), "zone");
	assert.equal(flowZone(0, 12), "hard", "no first try right in twelve is clear enough");
});

test("a range straddling the band edge is in the zone", () => {
	// 9 of 12 is 75%; 6 of 12 is 50% but the range still reaches 65%.
	assert.equal(flowZone(9, 12), "zone");
	assert.equal(flowZone(6, 12), "zone");
});

test("the last two weeks decide when they hold enough first tries, else the history does", () => {
	const lately = unitZone({ reps: 60, wrong: 5, lately: { reps: 14, right: 5 } });
	assert.equal(lately.lately, true);
	assert.equal(lately.zone, "hard", "55 of 60 overall, but 5 of 14 lately");
	assert.equal(unitZone({ reps: 60, wrong: 5 }).zone, "zone", "92% of 60: the range still reaches into the band");
	assert.equal(lately.reps, 14);
	const thin = unitZone({ reps: 60, wrong: 1, lately: { reps: 4, right: 1 } });
	assert.equal(thin.lately, false);
	assert.equal(thin.reps, 60);
	assert.equal(thin.zone, "easy");
	const old = unitZone({ reps: 30, wrong: 9 });
	assert.equal(old.lately, false, "a snapshot from before the field was kept");
	assert.equal(old.accuracy, 21 / 30);
});

test("an accuracy is given only once the unit is placed", () => {
	assert.equal(unitZone({ reps: 5, wrong: 1 }).accuracy, null);
	assert.equal(unitZone({ reps: 20, wrong: 5 }).accuracy, 0.75);
});

test("the stage steps once, never past the ends", () => {
	assert.deepEqual(steppedStage("new", "easy"), { stage: "practiced", shift: "up" });
	assert.deepEqual(steppedStage("practiced", "easy"), { stage: "strong", shift: "up" });
	assert.deepEqual(steppedStage("strong", "easy"), { stage: "strong", shift: null });
	assert.deepEqual(steppedStage("strong", "hard"), { stage: "practiced", shift: "down" });
	assert.deepEqual(steppedStage("practiced", "hard"), { stage: "new", shift: "down" });
	assert.deepEqual(steppedStage("new", "hard"), { stage: "new", shift: null });
	for (const z of ["zone", "new", undefined] as const) assert.deepEqual(steppedStage("practiced", z), { stage: "practiced", shift: null });
});

test("the summary names one unit to act on: the hardest-hit below the zone first", () => {
	const zones = unitZones([
		{ unit: "loc", reps: 30, wrong: 20 },
		{ unit: "gen", reps: 30, wrong: 15 },
		{ unit: "present", reps: 60, wrong: 0 },
		{ unit: "dat", reps: 20, wrong: 5 },
		{ unit: "ins", reps: 6, wrong: 3 },
	]);
	const s = flowSummary(zones);
	assert.deepEqual(s.counts, { new: 1, easy: 1, zone: 1, hard: 2 });
	assert.equal(s.focus?.kind, "hard");
	assert.equal(s.focus?.unit, "loc", "10 of 30 is lower than 15 of 30");
	assert.deepEqual(hardUnits(zones), ["loc", "gen"]);
	assert.deepEqual(easyUnits(zones), ["present"]);
	assert.deepEqual(s.band, { low: FLOW_LOW, high: FLOW_HIGH });
});

test("with nothing below the zone the focus is the unit furthest above it, else none", () => {
	const above = flowSummary(unitZones([{ unit: "present", reps: 60, wrong: 0 }, { unit: "dat", reps: 20, wrong: 5 }]));
	assert.equal(above.focus?.kind, "easy");
	assert.equal(above.focus?.unit, "present");
	const level = flowSummary(unitZones([{ unit: "dat", reps: 20, wrong: 5 }]));
	assert.equal(level.focus, null);
	assert.equal(flowSummary({}).focus, null);
});

test("the evidence line says what was counted and where the zone is", () => {
	const line = zoneLine(unitZone({ reps: 20, wrong: 5 }));
	assert.match(line, /15 of 20 first tries right/);
	assert.match(line, /the zone is 65%–85%/);
	assert.match(zoneLine(unitZone({ reps: 5, wrong: 1 })), /5 of 12 first tries needed/);
	assert.match(zoneLine(unitZone({ reps: 60, wrong: 5, lately: { reps: 14, right: 5 } })), /lately/);
});

test("the tutor line names the units outside the zone, or says all are inside", () => {
	const title = (id: string) => id.toUpperCase();
	assert.equal(flowTutorLine({}, title), null);
	assert.equal(flowTutorLine(unitZones([{ unit: "ins", reps: 6, wrong: 3 }]), title), null, "nothing placed yet");
	const mixed = flowTutorLine(unitZones([{ unit: "loc", reps: 30, wrong: 20 }, { unit: "present", reps: 60, wrong: 0 }]), title)!;
	assert.match(mixed, /below the zone .*: LOC/);
	assert.match(mixed, /above the zone .*: PRESENT/);
	assert.match(flowTutorLine(unitZones([{ unit: "dat", reps: 20, wrong: 5 }]), title)!, /every unit with enough first tries \(1\) sits in the target band of 65–85%/);
});

// ─── The plan ───────────────────────────────────────────────────────────────

function planFor(extra: Partial<PlanInput>) {
	const drills = curriculumState({}, "B2").chapters.flatMap((c) => c.units).filter((u) => u.kind === "drill");
	const evidence = Object.fromEntries(drills.slice(0, 4).map((u) => [u.id, { lessons: 3, reps: 36, correct: 32 }]));
	const state = curriculumState(evidence, "B2");
	const next = nextLessonUnit(state);
	const started = state.chapters.flatMap((c) => c.units).filter((u) => u.kind === "drill" && u.status !== "locked" && u.id !== next).map((u) => u.id as UnitId);
	assert.ok(started.length >= 2, "the fixture needs two drillable units besides the Continue unit");
	return { state, next, started, plan: (input: Partial<PlanInput> = {}) => dailyPlan({ state, evidence, day: { units: {}, reviews: 0, blitz: 0, talks: 0, stories: 0, tutors: 0 }, review: { due: 0, newLeft: 0, available: false }, minutesPerDay: 60, next, dayOfYear: 1, ...extra, ...input }) };
}

test("Strengthen takes a unit below the zone after a weak spot, before one that is only slipping", () => {
	const { started, plan } = planFor({});
	const [a, b] = started;
	const hard = plan({ hard: [a!], worse: [b!] }).tasks.find((t) => t.id === "strengthen");
	assert.equal(hard?.unit, a);
	assert.match(hard?.line ?? "", /Below your zone/);
	const spot = plan({ hard: [a!], weak: [b!] }).tasks.find((t) => t.id === "strengthen");
	assert.equal(spot?.unit, b, "a weak spot on record still comes first");
});

test("the Continue lesson says when its unit is above or below the zone", () => {
	const { next, plan } = planFor({});
	assert.match(plan({ easy: [next] }).tasks.find((t) => t.id === "lesson")!.line, /above your zone, so it asks for more/);
	assert.match(plan({ hard: [next] }).tasks.find((t) => t.id === "lesson")!.line, /below your zone, so it starts easier/);
	assert.doesNotMatch(plan({}).tasks.find((t) => t.id === "lesson")!.line, /zone/);
});

test("one lesson's share is placed against the band, edges inside it", async () => {
	const { bandPosition } = await import("../src/core/flow.ts");
	assert.equal(bandPosition(0.64), "below");
	assert.equal(bandPosition(0.65), "in");
	assert.equal(bandPosition(0.85), "in");
	assert.equal(bandPosition(7 / 8), "above");
});
