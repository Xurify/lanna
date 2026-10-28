/**
 * ONBOARDING PINS (LangHarness, 2026-10-28): the purposes → target
 * mapping, the placement staircase's outcome, how placement moves the
 * map (tested-out units, skipped chapters), the profile block the tutor
 * reads, and the server round trip into progress.json.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { CHAPTERS, curriculumState, hoursDone, nextLessonUnit } from "../src/core/curriculum.ts";
import { buildLesson, UNITS } from "../src/core/lesson.ts";
import {
	learnerProfileText,
	PLACEMENT_TIERS,
	placementOutcome,
	PURPOSES,
	purposeGoals,
	purposeScenes,
	REPS_PER_UNIT,
	suggestedLevel,
	tierForChapter,
	tierPassed,
	type PlacementRep,
} from "../src/core/onboarding.ts";
import { curriculumUnit } from "../src/core/curriculum.ts";
import type { LexiconEntry } from "../src/core/review.ts";
import { TALK_SCENES } from "../components/lesson/tutor.ts";

const lexicon = JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] };
const entries = lexicon.words;

const tierReps = (tierId: string, hits: number): PlacementRep[] => {
	const t = PLACEMENT_TIERS.find((x) => x.id === tierId)!;
	const reps: PlacementRep[] = [];
	let n = 0;
	for (const u of t.units) for (let i = 0; i < REPS_PER_UNIT; i++) reps.push({ tier: t.id, unit: u, verdict: n++ < hits ? "exact" : "wrong" });
	return reps;
};

test("purposes map onto real goals and scenes, and the target follows the most demanding one", () => {
	for (const p of PURPOSES) {
		for (const g of p.goals) assert.equal(curriculumUnit(g)?.kind, "goal", `${p.id}: ${g} is not a goal on the map`);
		for (const s of p.scenes) assert.ok(TALK_SCENES.some((x) => x.id === s), `${p.id}: no Talk scene ${s}`);
	}
	assert.equal(suggestedLevel([]), "A2");
	assert.equal(suggestedLevel(["daily"]), "A2");
	assert.equal(suggestedLevel(["daily", "family"]), "B1");
	assert.equal(suggestedLevel(["family", "work"]), "B2");
	assert.equal(suggestedLevel(["exam"], "B2"), "B2");
	assert.ok(purposeGoals(["family"]).has("can-family"));
	assert.deepEqual(purposeScenes(["daily", "family"]), ["cafe", "way", "shop", "doctor", "family", "colleague"]);
});

test("every placement tier has lesson material and stands for real chapters", () => {
	for (const t of PLACEMENT_TIERS) {
		for (const u of t.units) {
			assert.ok(UNITS.some((x) => x.id === u), `${t.id}: ${u} is not a lesson unit`);
			const plan = buildLesson(entries, u, { seed: 3, length: REPS_PER_UNIT });
			assert.equal(plan.items.length, REPS_PER_UNIT, `${t.id}/${u}`);
			assert.deepEqual(plan.items.map((i) => i.kind), ["choose", "type"]);
		}
		for (const c of t.chapters) assert.ok(CHAPTERS.some((x) => x.id === c), `${t.id}: no chapter ${c}`);
	}
	assert.equal(tierForChapter("hello"), 0);
	assert.equal(tierForChapter("shopping"), 2);
	assert.equal(tierForChapter("nuance"), 0);
});

test("the staircase: a beginner stops on the first tier, a reader climbs to their edge", () => {
	const beginner = placementOutcome(tierReps("a1a", 3));
	assert.equal(beginner.level, "A1");
	assert.equal(beginner.startChapter, "hello");
	assert.equal(beginner.tiers.length, 1);
	assert.equal(beginner.tiers[0]!.passed, false);
	assert.ok(beginner.testedOut.length >= 1, "the units it got both right are tested out");
	assert.ok(beginner.weak.length >= 1);
	assert.ok(!tierPassed(PLACEMENT_TIERS[0]!, tierReps("a1a", 5)), "5 of 8 is not 75%");
	assert.ok(tierPassed(PLACEMENT_TIERS[0]!, tierReps("a1a", 6)));

	const reader = placementOutcome([...tierReps("a1a", 8), ...tierReps("a1b", 7), ...tierReps("a2", 4)]);
	assert.equal(reader.level, "A2", "A1 is behind them: they work at A2 now");
	assert.equal(reader.startChapter, "health", "the first chapter after the tiers passed");
	assert.equal(reader.tiers.map((t) => t.passed).join(","), "true,true,false");
	assert.ok(reader.units["present"]?.placed);
	assert.equal(reader.units["present"]?.correct, 2);
	assert.ok(reader.testedOut.includes("present"));
	assert.ok(reader.weak.includes("motion"), "the A2 misses are the first strengthen tasks");
});

test("placement moves the map: tested-out units are done, chapters behind the start are skipped and credited, Continue starts in the new chapter", () => {
	const o = placementOutcome([...tierReps("a1a", 8), ...tierReps("a1b", 8), ...tierReps("a2", 5)]);
	const s = curriculumState(o.units, "B2", { startChapter: o.startChapter });
	assert.equal(s.current, "health");
	assert.equal(s.level, "A2");
	for (const ch of s.chapters.slice(0, 6)) {
		assert.ok(ch.open, `${ch.id} is open`);
		assert.ok(ch.done, `${ch.id} counts as done`);
		for (const u of ch.units) assert.ok(u.status === "done" || u.status === "skipped", `${u.id}: ${u.status}`);
	}
	assert.equal(s.chapters.find((c) => c.id === "hello")!.units.find((u) => u.id === "present")!.status, "done");
	assert.equal(s.chapters.find((c) => c.id === "hello")!.units.find((u) => u.id === "lx-greetings")!.status, "skipped");
	assert.ok(s.chapters.find((c) => c.id === "health")!.open);
	assert.ok(!s.chapters.find((c) => c.id === "plans")!.open, "chapters after the start still unlock in order");
	assert.ok(hoursDone(s) >= 90 && hoursDone(s) <= 110, `A1 is credited, plus the A2 units tested out: ${hoursDone(s)} h`);
	const next = nextLessonUnit(s);
	assert.ok(s.chapters.find((c) => c.id === "health")!.units.some((u) => u.id === next), `Continue is in the start chapter, got ${next}`);
	// Without a start chapter the same evidence opens nothing beyond the ledger.
	const plain = curriculumState(o.units, "B2");
	assert.equal(plain.current, "hello");
	assert.equal(plain.chapters[0]!.units.find((u) => u.id === "lx-greetings")!.status, "open");
});

test("the profile block says what the tutor must not ask, and is null on a fresh profile", () => {
	assert.equal(learnerProfileText(undefined, null, {}), null);
	const o = placementOutcome([...tierReps("a1a", 8), ...tierReps("a1b", 6)]);
	const goal = { level: "B1" as const, minutesPerDay: 20, daysPerWeek: 5, purposes: ["family" as const, "daily" as const], firstLanguage: "et" as const, bridges: ["ru" as const], prior: "sentences" as const, onboardedAt: "2026-10-28T00:00:00Z", placedAt: "2026-10-28T00:10:00Z", placedLevel: o.level, startChapter: o.startChapter };
	const state = curriculumState(o.units, goal.level, { startChapter: goal.startChapter });
	const text = learnerProfileText(goal, state, o.units)!;
	assert.ok(text.startsWith("# This learner"));
	assert.ok(text.includes("family and friends; daily life in Slovakia"), text);
	assert.ok(text.includes("Target: B1"));
	assert.ok(text.includes("First language: Estonian. Also knows Russian"));
	assert.ok(text.includes("started with simple sentences"));
	assert.ok(text.includes("Placement drill on 2026-10-28: A2; tested out of"));
	assert.ok(text.includes("missed"));
	assert.ok(text.includes('chapter "Health and body"'));
	assert.ok(text.includes("do not ask for either"));
});

test("the server round trip: the wizard's PUT and the drill's POST land in progress.json and the summary", async () => {
	const { setGoal, placementFor, recordPlacement, progressSummary } = await import("../src/server/lesson.ts");
	const { progressStore } = await import("../src/store/progress.ts");
	progressStore.write({ ...progressStore.read(), units: {}, goal: undefined });
	let s = progressSummary(0);
	assert.equal(s.goal.onboardedAt, undefined);
	s = setGoal({ level: "B1", minutesPerDay: 20, daysPerWeek: 5, purposes: ["family", "bogus" as never, "family"], firstLanguage: "et", bridges: ["ru"], prior: "words", onboarded: true }, 0, new Date("2026-10-28T10:00:00Z"));
	assert.equal(s.goal.level, "B1");
	assert.deepEqual(s.goal.purposes, ["family"]);
	assert.equal(s.goal.daysPerWeek, 5);
	assert.ok(s.goal.onboardedAt);
	const plan = placementFor();
	assert.equal(plan.from, 0);
	assert.equal(plan.tiers.length, PLACEMENT_TIERS.length);
	for (const t of plan.tiers) assert.equal(t.items.length, t.units.length * REPS_PER_UNIT, t.id);
	const reps = plan.tiers.slice(0, 2).flatMap((t) => t.items.map((it, i) => ({ tier: t.id, itemId: it.id, slug: it.slug, kind: it.kind, verdict: (t.id === "a1b" && i >= 6 ? "wrong" : "exact") as "exact" | "wrong", detail: { unit: it.unit, sentence: it.sentence, answer: it.answer, given: it.answer } })));
	const r = recordPlacement({ reps, ms: 90_000, tz: 0 }, new Date("2026-10-28T10:05:00Z"));
	assert.equal(r.level, "A2");
	assert.equal(r.startChapter, "health");
	assert.equal(r.summary.goal.placedLevel, "A2");
	assert.equal(r.summary.curriculum.current, "health");
	assert.ok(r.summary.projection.hoursDone >= 85);
	const rec = progressStore.read();
	assert.ok(rec.units["present"]?.placed);
	assert.equal(rec.units["present"]?.lessons, 0);
	assert.equal(rec.xp, progressStore.read().xp, "no XP for a measurement");
	// The speak task rotates the purposes' scenes in.
	assert.ok(r.summary.plan.tasks.some((t) => t.id === "speak"));
	// A re-check starts from the current chapter's tier and replaces placed evidence.
	assert.equal(placementFor({ recheck: true }).from, 2);
	const again = recordPlacement({ reps: reps.slice(0, 8), tz: 0 }, new Date("2026-10-29T10:05:00Z"));
	assert.equal(again.startChapter, "family");
	assert.equal(progressStore.read().units["acc-people"], undefined, "the earlier placement's evidence is gone");
});
