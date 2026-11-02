/**
 * STAMPS (LangHarness, 2026-11-02; E31, docs/research/gamification.md):
 * the stamp book is pure. These pin the catalog (a summit per level, a
 * stamp per chapter, the deeds), the earning rule (met once, kept with its
 * day), what is new, what is closest and the longest streak.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { curriculumState, STAGES } from "../src/core/curriculum.ts";
import { DEED_STAMPS, longestStreak, newStamps, nextStamps, recentStamps, stampCatalog, stampCount, stampStates, type StampEvidence } from "../src/core/stamps.ts";

const empty = (): StampEvidence => ({
	lessons: 0,
	streakDays: 0,
	wordsKnown: 0,
	reviews: 0,
	perfectLessons: 0,
	comebacks: 0,
	balancedWeek: false,
	storiesRead: 0,
	scenesSpoken: 0,
	listens: 0,
	bestBlitz: 0,
	hoursDone: 0,
	examsPassed: 0,
	chapters: new Map(),
	stages: new Map(),
});

const curriculum = curriculumState({});

test("the catalog: one summit per level on the map, one stamp per chapter, then the deeds, every id unique", () => {
	const all = stampCatalog(curriculum);
	const summits = all.filter((s) => s.kind === "summit");
	const chapters = all.filter((s) => s.kind === "chapter");
	const deeds = all.filter((s) => s.kind !== "summit" && s.kind !== "chapter");
	const stagesOnMap = STAGES.filter((st) => curriculum.chapters.some((ch) => ch.stage === st.id));
	assert.equal(summits.length, stagesOnMap.length);
	assert.deepEqual(
		summits.map((s) => s.level),
		stagesOnMap.map((st) => st.level),
	);
	assert.equal(chapters.length, curriculum.chapters.length);
	assert.deepEqual(deeds, [...DEED_STAMPS]);
	assert.equal(new Set(all.map((s) => s.id)).size, all.length, "ids are unique");
	assert.ok(all.findIndex((s) => s.kind === "summit") < all.findIndex((s) => s.kind === "chapter"), "summits before chapters");
	assert.ok(all.findIndex((s) => s.kind === "chapter") < all.findIndex((s) => s.kind === "first"), "chapters before the deeds");
	for (const s of all) assert.ok(s.name && s.line && s.goal >= 1, s.id);
	assert.ok(DEED_STAMPS.length >= 40, `${DEED_STAMPS.length} deeds`);
});

test("with no curriculum the catalog is the deeds alone", () => {
	assert.deepEqual(stampCatalog(null), [...DEED_STAMPS]);
});

test("every kind counts the right number on record", () => {
	const e: StampEvidence = {
		...empty(),
		lessons: 3,
		streakDays: 9,
		wordsKnown: 120,
		reviews: 400,
		perfectLessons: 2,
		comebacks: 11,
		balancedWeek: true,
		storiesRead: 4,
		scenesSpoken: 1,
		listens: 12,
		bestBlitz: 21,
		hoursDone: 12.5,
		examsPassed: 1,
		chapters: new Map([["ch-a", 0.5]]),
		stages: new Map([["a1", 0.25]]),
	};
	const by = (id: string) => stampCount(stampCatalog(null).find((s) => s.id === id)!, e);
	assert.equal(by("first-step"), 1, "the first-step counts at most one lesson");
	assert.equal(by("streak-7"), 9);
	assert.equal(by("words-150"), 120);
	assert.equal(by("reviews-500"), 400);
	assert.equal(by("perfect-10"), 2);
	assert.equal(by("comeback-10"), 11);
	assert.equal(by("balance-week"), 1);
	assert.equal(by("stories-10"), 4);
	assert.equal(by("scenes-1"), 1);
	assert.equal(by("listens-10"), 12);
	assert.equal(by("blitz-20"), 21);
	assert.equal(by("hours-10"), 12.5);
	assert.equal(by("exams-1"), 1);
	assert.equal(stampCount({ id: "chapter:ch-a", kind: "chapter", name: "A", line: "", goal: 1 }, e), 0.5);
	assert.equal(stampCount({ id: "summit:a1", kind: "summit", name: "A1", line: "", goal: 1, stage: "a1" }, e), 0.25);
	assert.equal(stampCount({ id: "chapter:ch-z", kind: "chapter", name: "Z", line: "", goal: 1 }, e), 0, "a chapter not on record is 0");
});

test("a stamp whose goal is met is earned today unless it is on record, and a recorded stamp keeps its day even when the count falls", () => {
	const defs = DEED_STAMPS.filter((s) => s.id === "streak-7" || s.id === "streak-30" || s.id === "words-50");
	const states = stampStates(defs, { ...empty(), streakDays: 8, wordsKnown: 20 }, { "words-50": "2026-10-01" }, "2026-11-02");
	const by = Object.fromEntries(states.map((s) => [s.id, s]));
	assert.equal(by["streak-7"]!.earned, "2026-11-02", "met now, dated today");
	assert.equal(by["streak-7"]!.progress, 1);
	assert.equal(by["streak-30"]!.earned, null);
	assert.equal(by["streak-30"]!.have, 8);
	assert.ok(Math.abs(by["streak-30"]!.progress - 8 / 30) < 1e-9);
	assert.equal(by["words-50"]!.earned, "2026-10-01", "the record wins over today's count");
	assert.equal(by["words-50"]!.progress, 1, "an earned stamp is full even when the count fell under the goal");
});

test("newStamps is the difference against the record", () => {
	const defs = DEED_STAMPS.filter((s) => s.kind === "streak");
	const states = stampStates(defs, { ...empty(), streakDays: 31 }, { "streak-7": "2026-10-20" }, "2026-11-02");
	assert.deepEqual(
		newStamps(states, { "streak-7": "2026-10-20" }).map((s) => s.id),
		["streak-30"],
	);
	assert.deepEqual(newStamps(states, {}).map((s) => s.id), ["streak-7", "streak-30"]);
});

test("nextStamps puts the furthest along first, then the smaller goal; earned stamps are left out", () => {
	const defs = DEED_STAMPS.filter((s) => ["streak-7", "streak-30", "words-50", "words-150", "reviews-100"].includes(s.id));
	const states = stampStates(defs, { ...empty(), streakDays: 7, wordsKnown: 45, reviews: 90 }, {}, "2026-11-02");
	const next = nextStamps(states, 3).map((s) => s.id);
	assert.deepEqual(next, ["words-50", "reviews-100", "words-150"], `got ${next.join(", ")}`);
	assert.deepEqual(nextStamps(states, 10).map((s) => s.id).includes("streak-7"), false, "streak-7 is earned");
});

test("recentStamps is newest first, and ties keep book order", () => {
	const defs = DEED_STAMPS.filter((s) => ["first-step", "streak-7", "words-50", "stories-1"].includes(s.id));
	const states = stampStates(defs, empty(), { "first-step": "2026-10-01", "streak-7": "2026-10-08", "words-50": "2026-10-08", "stories-1": "2026-10-03" }, "2026-11-02");
	assert.deepEqual(
		recentStamps(states, 3).map((s) => s.id),
		["streak-7", "words-50", "stories-1"],
	);
	assert.deepEqual(recentStamps(states, 1).map((s) => s.id), ["streak-7"]);
});

test("the longest streak counts consecutive days, ignores junk keys and never exceeds the days on record", () => {
	assert.equal(longestStreak(new Set()), 0);
	assert.equal(longestStreak(new Set(["2026-10-30"])), 1);
	assert.equal(longestStreak(new Set(["2026-10-28", "2026-10-29", "2026-10-30", "2026-11-01", "2026-11-02", "junk"])), 3);
	assert.equal(longestStreak(new Set(["2026-02-27", "2026-02-28", "2026-03-01"])), 3, "runs cross a month boundary");
	assert.equal(longestStreak(new Set(["2026-11-02", "2026-11-01", "2026-10-31", "2026-10-30"])), 4, "order of insertion does not matter");
});
