/**
 * CURRICULUM PINS (LangHarness r5): the map's shape, its locks, the Continue
 * choice, the hours projection and the daily plan are all pure, so the
 * tests pin them from hand-made ledgers.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import {
	CHAPTERS,
	CURRICULUM,
	curriculumState,
	curriculumUnit,
	dailyPlan,
	hoursDone,
	nextLessonUnit,
	projection,
	TUTOR_SESSIONS,
	tutorUnitPrompt,
	type UnitEvidence,
} from "../src/core/curriculum.ts";
import { buildLesson, candidatesFor, UNITS } from "../src/core/lesson.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const lexicon = JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] };
const entries = lexicon.words;

const aced = (): UnitEvidence => ({ lessons: 1, reps: 12, correct: 12 });
const practised = (): UnitEvidence => ({ lessons: 3, reps: 36, correct: 32 });
const sessions = (n: number): UnitEvidence => ({ lessons: n, reps: 0, correct: 0 });

test("the map is well-formed: every chapter ends in a goal, every unit is on exactly one chapter, every lesson unit is on the map", () => {
	const seen = new Map<string, number>();
	for (const ch of CHAPTERS) {
		assert.ok(ch.units.length >= 4, `${ch.id} has ${ch.units.length} units`);
		assert.equal(curriculumUnit(ch.units[ch.units.length - 1]!)?.kind, "goal", `${ch.id} must end in a goal`);
		for (const id of ch.units) seen.set(id, (seen.get(id) ?? 0) + 1);
	}
	for (const u of CURRICULUM) assert.equal(seen.get(u.id), 1, `${u.id} appears ${seen.get(u.id) ?? 0} times`);
	for (const u of UNITS) assert.ok(curriculumUnit(u.id), `lesson unit ${u.id} is not on the map`);
	for (const u of CURRICULUM) {
		for (const r of u.requires ?? []) assert.ok(curriculumUnit(r), `${u.id} requires unknown ${r}`);
		if (u.kind === "tutor") assert.ok(u.brief && u.brief.length > 40, `${u.id} needs a brief`);
	}
});

test("every lesson unit on the map has material for a full lesson", () => {
	for (const u of UNITS) {
		const plan = buildLesson(entries, u.id, { seed: 11 });
		assert.ok(plan.items.length >= 10, `${u.id}: ${plan.items.length} items`);
		assert.ok(candidatesFor(entries, u.id).length >= 12, `${u.id}: too few candidates`);
	}
});

test("a fresh learner: only the first chapter is open, Continue is the first drill", () => {
	const s = curriculumState({}, "B2");
	assert.equal(s.current, "hello");
	assert.equal(s.level, "A1");
	assert.equal(s.chapters[0]!.open, true);
	assert.equal(s.chapters[1]!.open, false);
	assert.equal(s.chapters[1]!.units[0]!.status, "locked");
	// "First words" is a vocabulary unit; Continue starts on endings (the placement showed reading ahead of production).
	assert.equal(nextLessonUnit(s), "present");
	assert.equal(s.done, 0);
	assert.ok(s.total >= 100, `total ${s.total}`);
});

test("a chapter opens when the one before has at most two units left; a goal is reached when its chapter's units are done", () => {
	const hello = CHAPTERS[0]!;
	const evidence: Record<string, UnitEvidence> = {};
	// Everything but the goal and one more unit done: the next chapter opens, the goal is not reached.
	const open = hello.units.filter((id) => curriculumUnit(id)!.kind !== "goal");
	for (const id of open.slice(0, -1)) evidence[id] = curriculumUnit(id)!.kind === "tutor" ? sessions(TUTOR_SESSIONS) : practised();
	let s = curriculumState(evidence, "B2");
	assert.equal(s.chapters[1]!.open, true);
	assert.equal(s.chapters[0]!.units.at(-1)!.status, "locked");
	assert.equal(s.current, "hello");
	// The last one too: goal reached, chapter done, current moves on.
	evidence[open.at(-1)!] = curriculumUnit(open.at(-1)!)!.kind === "tutor" ? sessions(TUTOR_SESSIONS) : aced();
	s = curriculumState(evidence, "B2");
	assert.equal(s.chapters[0]!.done, true);
	assert.equal(s.chapters[0]!.units.at(-1)!.status, "done");
	assert.equal(s.current, "cafe");
});

test("acing one full lesson tests out of a unit; three lessons at 80% complete it; a tutor unit needs its sessions", () => {
	const s = curriculumState({ words: aced(), present: { lessons: 3, reps: 36, correct: 30 }, "lx-greetings": { lessons: 2, reps: 24, correct: 20 }, sounds: sessions(1) }, "B2");
	const by = Object.fromEntries(s.chapters[0]!.units.map((u) => [u.id, u]));
	assert.equal(by.words!.status, "done");
	assert.equal(by.present!.status, "done");
	assert.equal(by["lx-greetings"]!.status, "started");
	assert.equal(by.sounds!.status, "started");
	assert.equal(by.sounds!.progress, 0.5);
	assert.equal(nextLessonUnit(s), "lx-greetings");
});

test("a unit's own prerequisites lock it inside an open chapter", () => {
	const s = curriculumState({}, "B2");
	const cafe = s.chapters.find((c) => c.id === "cafe")!;
	// modal-inf requires present; the chapter itself is closed for a fresh learner, so test on the needs text once open.
	const evidence: Record<string, UnitEvidence> = {};
	for (const id of CHAPTERS[0]!.units) if (curriculumUnit(id)!.kind !== "goal" && id !== "present") evidence[id] = curriculumUnit(id)!.kind === "tutor" ? sessions(2) : aced();
	const s2 = curriculumState(evidence, "B2");
	const cafe2 = s2.chapters.find((c) => c.id === "cafe")!;
	assert.equal(cafe.open, false);
	assert.equal(cafe2.open, true);
	const modal = cafe2.units.find((u) => u.id === "modal-inf")!;
	assert.equal(modal.status, "locked");
	assert.match(modal.needs ?? "", /I, you, we/);
});

test("the target level bounds the count; hours and the projection move with progress", () => {
	const fresh = curriculumState({}, "B1");
	const toB2 = curriculumState({}, "B2");
	assert.ok(fresh.total < toB2.total);
	assert.equal(hoursDone(fresh), 0);
	const evidence: Record<string, UnitEvidence> = {};
	for (const ch of CHAPTERS.filter((c) => c.stage === "a1")) for (const id of ch.units) evidence[id] = curriculumUnit(id)!.kind === "tutor" ? sessions(2) : aced();
	const a1done = curriculumState(evidence, "B2");
	assert.equal(Math.round(hoursDone(a1done)), 90);
	const now = new Date("2026-10-28T12:00:00Z");
	const p = projection(a1done, { target: "B2", minutesPerDay: 30, recentMinutes: [], now });
	assert.equal(p.hoursDone, 90);
	assert.equal(p.hoursTarget, 650);
	assert.equal(p.etaPace, null);
	assert.ok(p.etaPlanned && p.etaPlanned > "2029-01-01", p.etaPlanned ?? "");
	const faster = projection(a1done, { target: "B2", minutesPerDay: 60, recentMinutes: [], now });
	assert.ok(faster.etaPlanned! < p.etaPlanned!);
});

test("the daily plan: review first, listen (input) before the lesson, strengthen the weakest, words, read, speak; it ticks off from the ledger", () => {
	const evidence: Record<string, UnitEvidence> = { present: { lessons: 2, reps: 30, correct: 24 }, "acc-fem": { lessons: 2, reps: 24, correct: 14 } };
	const state = curriculumState(evidence, "B2");
	const next = nextLessonUnit(state);
	const base = { state, evidence, review: { due: 12, newLeft: 10, available: true }, minutesPerDay: 30, next, dayOfYear: 301 };
	const plan = dailyPlan({ ...base, day: { units: {}, reviews: 0, blitz: 0, talks: 0, stories: 0, tutors: 0 } });
	assert.deepEqual(
		plan.tasks.map((t) => t.id),
		["review", "listen", "lesson", "strengthen", "words", "read", "speak"],
	);
	assert.equal(plan.tasks[1]!.href, "/listen");
	assert.equal(plan.tasks[2]!.unit, next);
	assert.equal(plan.tasks[3]!.unit, "acc-fem");
	assert.equal(plan.done, 0);
	// After the day's work the same plan is all ticked.
	const after = dailyPlan({
		...base,
		evidence: { ...evidence, [next]: { lessons: (evidence[next]?.lessons ?? 0) + 1, reps: 12, correct: 11 }, "acc-fem": { lessons: 3, reps: 36, correct: 25 }, "lx-greetings": { lessons: 1, reps: 12, correct: 12 } },
		review: { due: 0, newLeft: 0, available: true },
		day: { units: { [next]: 1, "acc-fem": 1, "lx-greetings": 1 }, reviews: 20, blitz: 0, talks: 0, stories: 0, tutors: 1, reads: 1, listens: 1 },
	});
	assert.equal(after.done, after.total);
	// A tight budget keeps review and the lesson.
	const tight = dailyPlan({ ...base, minutesPerDay: 5, day: { units: {}, reviews: 0, blitz: 0, talks: 0, stories: 0, tutors: 0 } });
	assert.deepEqual(
		tight.tasks.map((t) => t.id),
		["review", "lesson"],
	);
	// A middling budget keeps one task per strand (listen, speak) before a
	// second drill, so a short day is still balanced; the order on screen
	// stays the teaching order.
	const middling = dailyPlan({ ...base, minutesPerDay: 20, day: { units: {}, reviews: 0, blitz: 0, talks: 0, stories: 0, tutors: 0 } });
	assert.deepEqual(
		middling.tasks.map((t) => t.id),
		["review", "listen", "lesson", "speak"],
	);
	assert.ok(middling.minutes <= 20 + 1);
});

test("a tutor unit's prompt carries its brief and the answer-first doctrine", () => {
	const p = tutorUnitPrompt(curriculumUnit("aspect")!);
	assert.match(p, /robiť/);
	assert.match(p, /answer-first/);
	assert.match(p, /say: spans/);
});
