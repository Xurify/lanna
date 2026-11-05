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
	BRIDGE_LANGS,
	bridgeLanguages,
	KNOWN_LANGUAGES,
	explanationLanguages,
	knownLanguages,
	learnerProfileText,
	measuredWeak,
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
import { unitBridges, unitsBridgedIn } from "../src/core/unit-bridges.ts";
import type { LexiconEntry } from "../src/core/review.ts";
import { SPEAK_SCENES } from "../src/core/speak.ts";

/** The Slovak course these tests describe. */
const SLOVAK = { code: "sk", english: "Slovak" };

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
		for (const s of p.scenes) assert.ok(SPEAK_SCENES.some((x) => x.id === s), `${p.id}: no Speak scene ${s}`);
	}
	assert.equal(suggestedLevel([]), "A2");
	assert.equal(suggestedLevel(["daily"]), "A2");
	assert.equal(suggestedLevel(["daily", "family"]), "B1");
	assert.equal(suggestedLevel(["family", "work"]), "B2");
	assert.equal(suggestedLevel(["exam"], "B2"), "B2");
	assert.equal(suggestedLevel(["other"]), "A2", "a goal in the learner's own words sets no level; the chips do");
	assert.equal(suggestedLevel(["other", "work"]), "B2");
	assert.ok(purposeGoals(["family"]).has("can-family"));
	assert.deepEqual(purposeScenes(["daily", "family"]), ["cafe", "way", "shop", "doctor", "family", "colleague"]);
});

test("every placement tier has lesson material and stands for real chapters; B2 chapters re-check from the last tier", () => {
	for (const t of PLACEMENT_TIERS) {
		for (const u of t.units) {
			assert.ok(UNITS.some((x) => x.id === u), `${t.id}: ${u} is not a lesson unit`);
			const plan = buildLesson(entries, u, { seed: 3, length: 1, pattern: ["type"] });
			assert.equal(plan.items.length, 1, `${t.id}/${u}`);
			assert.equal(plan.items[0]!.kind, "type", "the check is production only");
		}
		for (const c of t.chapters) assert.ok(CHAPTERS.some((x) => x.id === c), `${t.id}: no chapter ${c}`);
	}
	assert.equal(tierForChapter("hello"), 0);
	assert.equal(tierForChapter("shopping"), 2);
	assert.equal(tierForChapter("nuance"), 3, "a B2 chapter re-checks from the B1 tier, not from the top");
	assert.equal(tierForChapter(undefined), 0);
});

test("the staircase outcome: a beginner stops on the first tier, a reader climbs to their edge, a re-check from a later tier holds the tiers below (the A1 demotion bug)", () => {
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
	assert.equal(reader.ceiling, false);

	// The bug: a re-check from tier 2 used to score nothing and place at A1/"hello".
	const recheck = placementOutcome([...tierReps("a2", 8), ...tierReps("b1", 8)], { from: 2 });
	assert.equal(recheck.tiers.filter((t) => t.held).length, 2, "the tiers below the start are held");
	assert.equal(recheck.startChapter, "nuance");
	assert.equal(recheck.level, "B2");
	assert.equal(recheck.ceiling, true, "every tier passed: the check ran out, the level is a floor");
	const fell = placementOutcome(tierReps("a2", 2), { from: 2 });
	assert.equal(fell.startChapter, "health", "a failed re-check never goes below the tier it started at");
	assert.equal(fell.level, "A2");
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
	assert.equal(learnerProfileText(SLOVAK, undefined, null, {}), null);
	const o = placementOutcome([...tierReps("a1a", 8), ...tierReps("a1b", 6)]);
	const goal = { level: "B1" as const, minutesPerDay: 20, daysPerWeek: 5, purposes: ["family" as const, "daily" as const], languages: ["et" as const, "ru" as const], languageLevels: { et: "native" as const, ru: "A2" as const }, otherLanguages: ["Swahili"], prior: "sentences" as const, onboardedAt: "2026-10-28T00:00:00Z", placedAt: "2026-10-28T00:10:00Z", placedLevel: o.level, startChapter: o.startChapter };
	const state = curriculumState(o.units, goal.level, { startChapter: goal.startChapter });
	const text = learnerProfileText(SLOVAK, goal, state, o.units)!;
	assert.ok(text.startsWith("# This learner"));
	assert.ok(text.includes("family and friends; daily life"), text);
	assert.ok(text.includes("Target: B1"));
	assert.ok(text.includes("Knows: Estonian (native), Russian (A2 on the CEFR), Swahili."), text);
	assert.ok(text.includes("Russian: Six cases, three genders and aspect"), text);
	assert.ok(text.includes("Explanations in English."));
	assert.ok(!text.includes("Do not lean on Estonian"));
	// A learner without Estonian who wants German explanations.
	const own = learnerProfileText(SLOVAK, { ...goal, purposes: ["other", "daily"], purposeNote: "a nursing job in Košice" }, state, o.units)!;
	assert.ok(own.includes('Slovak is for: daily life; in the learner\'s own words, "a nursing job in Košice".'), own);
	assert.ok(own.includes("Shape examples and scenes around those words"), own);
	const de = learnerProfileText(SLOVAK, { ...goal, languages: ["de", "en"], explainIn: ["de"] }, state, o.units)!;
	assert.ok(de.includes("Do not lean on Estonian bridges"), de);
	assert.ok(de.includes("Explain in German"), de);
	const two = learnerProfileText(SLOVAK, { ...goal, explainIn: ["en", "ru"] }, state, o.units)!;
	assert.ok(two.includes("Explanations in English. Also Russian, which the learner is still learning"), two);
	assert.ok(two.includes("key line and the grammar terms in Russian"), two);
	assert.ok(two.includes("knows Russian only at A2: keep those lines short"), two);
	assert.ok(text.includes("started with simple sentences"));
	assert.ok(text.includes("Placement check on 2026-10-28: works at A2; tested out of"));
	assert.ok(text.includes("missed"));
	assert.ok(text.includes('chapter "Health and body"'));
	assert.ok(text.includes("do not ask for either"));
});

test("measuredWeak: first tries once there are six, lesson answers labeled as the fallback, else nothing", () => {
	const unit = { title: "Genitive", reps: 20, accuracy: 0.9 };
	const m = measuredWeak(unit, { reps: 6, right: 2, accents: 1, slips: { base: 3, "same-word": 1 } })!;
	assert.equal(m.accuracy, 2 / 6);
	assert.equal(m.text, "Genitive 33% on first tries (2 of 6 right; wrong: dictionary form, no ending (3) · wrong ending (1))");
	assert.deepEqual(measuredWeak(unit, { reps: 3, right: 3, accents: 0, slips: {} }), { accuracy: 0.9, text: "Genitive 90% on lesson answers" }, "fewer than six first tries: the fallback, said as such");
	assert.deepEqual(measuredWeak(unit, undefined), { accuracy: 0.9, text: "Genitive 90% on lesson answers" });
	assert.equal(measuredWeak({ title: "Genitive", reps: 5, accuracy: 0.4 }, undefined), null);
	assert.equal(measuredWeak({ title: "Genitive", reps: 20, accuracy: null }, undefined), null);
});

test("the tutor's weak points read the first tries, with lesson answers labeled as the fallback", () => {
	// gen: the lesson answers look fine (23/24), the first tries do not (3/8);
	// the first tries govern. dat: no first tries yet, the lesson answers speak.
	const evidence = {
		gen: { lessons: 2, reps: 24, correct: 23 },
		dat: { lessons: 2, reps: 10, correct: 6 },
		present: { lessons: 1, reps: 3, correct: 1 },
	};
	const state = curriculumState(evidence, "B2");
	const goal = { level: "B2" as const, minutesPerDay: 20, daysPerWeek: 5, languages: ["en" as const], onboardedAt: "2026-10-31T00:00:00Z" };
	const text = learnerProfileText(SLOVAK, goal, state, evidence, undefined, undefined, { gen: { reps: 8, right: 3, accents: 0, slips: { base: 5 } } })!;
	const line = text.split("\n").find((l) => l.includes("Measured weak points"))!;
	assert.match(line, /38% on first tries \(3 of 8 right; wrong: dictionary form, no ending \(5\)\)/, line);
	assert.match(line, /60% on lesson answers/, line);
	assert.ok(line.indexOf("38%") < line.indexOf("60%"), "the weakest first");
	assert.ok(!line.includes("Present"), "three reps is no measure");
});

test("the server round trip: the wizard's PUT and the drill's POST land in progress.json and the summary", async () => {
	const { setGoal, recordPlacement, progressSummary } = await import("../src/server/lesson.ts");
	const { progressStore } = await import("../src/store/progress.ts");
	progressStore.write({ ...progressStore.read(), units: {}, goal: undefined });
	let s = progressSummary(0);
	assert.equal(s.goal.onboardedAt, undefined);
	s = setGoal({ level: "B1", minutesPerDay: 20, daysPerWeek: 5, purposes: ["family", "bogus" as never, "family"], languages: ["et", "ru", "xx" as never, "ru"], languageLevels: { et: "native", ru: "basic" as never, de: "C1", en: "nope" as never }, otherLanguages: [" Swahili ", "", "Swahili"], explainIn: ["ru", "et", "fi", "ru"], prior: "words", onboarded: true }, 0, new Date("2026-10-28T10:00:00Z"));
	assert.equal(s.goal.level, "B1");
	assert.deepEqual(s.goal.purposes, ["family"]);
	assert.equal(s.goal.daysPerWeek, 5);
	assert.deepEqual(s.goal.languages, ["et", "ru"]);
	assert.deepEqual(s.goal.languageLevels, { et: "native", ru: "A2" }, "levels only for known languages; a legacy level is read as CEFR");
	s = setGoal({ purposes: ["other"], purposeNote: "  for my in-laws in Žilina  " }, 0);
	assert.equal(s.goal.purposeNote, "for my in-laws in Žilina");
	s = setGoal({ purposeNote: "   " }, 0);
	assert.equal(s.goal.purposeNote, undefined, "an empty note is dropped");
	assert.deepEqual(s.goal.otherLanguages, ["Swahili"]);
	assert.deepEqual(s.goal.explainIn, ["ru", "et"], "two at most, known ones only, in order");
	assert.ok(s.goal.onboardedAt);
	// Dropping Russian from the list drops it as the explanation language too; English is never stored.
	s = setGoal({ languages: ["et"], explainIn: ["ru"] }, 0);
	assert.equal(s.goal.explainIn, undefined);
	assert.deepEqual(s.goal.languageLevels, { et: "native" }, "Russian's level left with it");
	s = setGoal({ languageLevels: { et: "B2" } }, 0);
	assert.deepEqual(s.goal.languageLevels, { et: "B2" }, "a pressed level is stored, B2 too: the picker shows what is saved");
	s = setGoal({ languages: ["et", "sv"] }, 0);
	assert.deepEqual(s.goal.languageLevels, { et: "B2" }, "a language added with no level stays unset");
	s = setGoal({ languages: ["et"], explainIn: ["en"] }, 0);
	assert.equal(s.goal.explainIn, undefined, "English alone is the default, not stored");
	s = setGoal({ languages: ["et", "ru"], explainIn: ["ru"] }, 0);
	const { lessonFor } = await import("../src/server/lesson.ts");
	assert.deepEqual(lessonFor("loc", 1).bridges, ["et", "ru"], "the lesson plan carries the bridge languages");
	s = setGoal({ languages: ["et", "ru"], languageLevels: { et: "A1", ru: "C2" } }, 0);
	assert.deepEqual(lessonFor("loc", 1).bridges, ["ru", "et"], "the better-known language leads");
	// The check's record: the outcome lands in progress.json; a re-check
	// from tier 2 replaces only the evidence of the tiers it asked again.
	const first = placementOutcome([...tierReps("a1a", 8), ...tierReps("a1b", 6)]);
	const r = recordPlacement({ outcome: first, reps: [], ms: 90_000, tz: 0 }, new Date("2026-10-28T10:05:00Z"));
	assert.equal(r.level, "A2");
	assert.equal(r.startChapter, "health");
	assert.equal(r.summary.goal.placedLevel, "A2");
	assert.equal(r.summary.curriculum.current, "health");
	assert.ok(r.summary.projection.hoursDone >= 85);
	const rec = progressStore.read();
	assert.ok(rec.units["present"]?.placed);
	assert.equal(rec.units["present"]?.lessons, 0);
	assert.equal(rec.xp, progressStore.read().xp, "no XP for a measurement");
	assert.ok(r.summary.plan.tasks.some((t) => t.id === "speak"));
	const again = recordPlacement({ outcome: placementOutcome(tierReps("a2", 8), { from: 2 }), reps: [], tz: 0, note: "Holds the A2 forms; aspect is the edge.", vocabulary: { size: 1850, at: "2026-10-29T10:05:00Z", reliable: true } }, new Date("2026-10-29T10:05:00Z"));
	assert.equal(again.startChapter, "stories");
	assert.ok(progressStore.read().units["present"]?.placed, "the first tiers' evidence stays: they were not asked again");
	assert.equal(progressStore.read().goal?.placedNote, "Holds the A2 forms; aspect is the edge.");
	assert.equal(progressStore.read().goal?.vocabulary?.size, 1850);
	const text = learnerProfileText(SLOVAK, progressStore.read().goal, null, progressStore.read().units)!;
	assert.match(text, /Vocabulary check on 2026-10-29: about 1,850 lemmas/);
	assert.match(text, /aspect is the edge/);
	// Today's ETA uses the learner's days a week like the setup's does (it hard-coded six).
	const three = setGoal({ daysPerWeek: 3 }, 0).projection.etaPlanned!;
	const six = setGoal({ daysPerWeek: 6 }, 0).projection.etaPlanned!;
	assert.ok(three > six, `${three} should be later than ${six}`);
});

test("every grammar unit has a bridge in each of the four languages, and the profile picks them", () => {
	const grammar = UNITS.filter((u) => u.kind !== "words" && u.kind !== "pairs" && !u.union).map((u) => u.id);
	for (const lang of BRIDGE_LANGS) {
		const have = unitsBridgedIn(lang);
		for (const u of grammar) assert.ok(have.includes(u), `${u} lacks a ${lang} line`);
	}
	assert.deepEqual(unitBridges("gen", ["ru", "et", "ru"]).map((b) => b.lang), ["ru", "et"], "the learner's order, once each");
	assert.ok(unitBridges("gen", ["de"])[0]!.text.includes("ohne Zucker"));
	assert.deepEqual(unitBridges("lx-greetings" as never, ["et"]), [], "a words unit has no bridge");
	// Reading a profile: the new list, the setup's old shape, and none at all.
	assert.deepEqual(knownLanguages({ languages: ["de", "en"] }), ["de", "en"]);
	assert.deepEqual(knownLanguages({ firstLanguage: "et", bridges: ["ru", "cs"] }), ["et", "ru", "cs", "en"]);
	assert.deepEqual(knownLanguages({ firstLanguage: "other" }), ["en"]);
	assert.deepEqual(knownLanguages(undefined), ["et", "en"]);
	assert.deepEqual(bridgeLanguages({ languages: ["en", "ru", "fi", "pl"] }), ["ru", "fi"]);
	assert.deepEqual(bridgeLanguages({ languages: ["ru", "fi", "et"], languageLevels: { ru: "A2", et: "native" } }), ["et", "fi", "ru"], "native, then the default B2, then A2");
	assert.deepEqual(bridgeLanguages({ languages: ["ru", "et"], languageLevels: { ru: "fluent" as never, et: "good" as never } }), ["ru", "et"], "legacy levels still order the bridges");
	assert.ok(KNOWN_LANGUAGES.filter((l) => l.primary).length === 21 && KNOWN_LANGUAGES.length >= 60, "twenty-one chips (the one being learned is left out), the rest in the panel");
	assert.equal(new Set(KNOWN_LANGUAGES.map((l) => l.id)).size, KNOWN_LANGUAGES.length, "no duplicate ids");
	assert.deepEqual(bridgeLanguages({ languages: [] }), []);
	assert.deepEqual(explanationLanguages({ explainIn: "et" }), ["et"], "the older single string still reads");
	assert.deepEqual(explanationLanguages({ explainIn: ["et", "ru", "de"] }), ["et", "ru"]);
	assert.deepEqual(explanationLanguages({}), ["en"]);
});

test("each target level says what it buys and which purposes it covers", async () => {
	const { LEVEL_CAN_DO, levelFit, levelFitLine, CEFR_ORDER } = await import("../src/core/index.ts");
	for (const lv of CEFR_ORDER) assert.ok(LEVEL_CAN_DO[lv].length > 40, `${lv} has a can-do line`);
	assert.equal(new Set(Object.values(LEVEL_CAN_DO)).size, CEFR_ORDER.length, "every level reads differently");
	const fit = levelFit("B1", ["family", "daily", "media", "other"]);
	assert.deepEqual(fit.covered, ["family", "daily"]);
	assert.deepEqual(fit.short, [{ purpose: "media", level: "B2" }]);
	assert.equal(levelFitLine("B1", ["family", "daily", "media"]), "Enough for family and friends, daily life. News, books and film needs B2: at B1 that part stays out of reach.");
	assert.equal(levelFitLine("C1", ["exam"], "B2"), "Enough for an exam or citizenship.");
	assert.equal(levelFitLine("A1", ["exam"], "B2"), "An exam or citizenship needs B2: at A1 that part stays out of reach.");
	assert.equal(levelFitLine("B2", ["other"]), "");
});

test("parallels name only the learner's languages and can be turned off", async () => {
	const { parallelsLine, parallelsOn, learnerProfileText, bridgeLanguages } = await import("../src/core/index.ts");
	assert.equal(parallelsLine({ languages: ["et", "cs", "en"] }, SLOVAK).startsWith("When a Slovak rule mirrors one in Estonian, the Why? panel"), true, parallelsLine({ languages: ["et", "cs", "en"] }, SLOVAK));
	assert.ok(parallelsLine({ languages: ["ru", "et"], languageLevels: { ru: "native", et: "A2" } }, SLOVAK).includes("in Russian and Estonian,"), "best-known first, only languages with lines");
	assert.ok(parallelsLine({ languages: ["en", "fr"] }, SLOVAK).startsWith("Explanations stay in English"));
	assert.equal(parallelsOn({}), true);
	assert.equal(parallelsOn({ showParallels: false }), false);
	assert.deepEqual(bridgeLanguages({ languages: ["et"] }), ["et"]);
	const { setGoal, lessonFor } = await import("../src/server/lesson.ts");
	let s = setGoal({ languages: ["et", "ru"], showParallels: false }, 0);
	assert.equal(s.goal.showParallels, false);
	assert.deepEqual(lessonFor("loc", 1).bridges, [], "no bridge lines when parallels are off");
	const off = learnerProfileText(SLOVAK, s.goal, null, {})!;
	assert.ok(off.includes("turned parallels off"), off);
	s = setGoal({ showParallels: true, languageLevels: {} }, 0);
	assert.equal(s.goal.showParallels, undefined, "on is the default, not stored");
	assert.deepEqual(lessonFor("loc", 1).bridges, ["et", "ru"]);
});

test("xpForPlan turns a plan's minutes into the XP those minutes earn at the learner's own rate", async () => {
	const { xpForPlan } = await import("../src/core/onboarding.ts");
	assert.equal(xpForPlan(90, 198), 300, "90 min at 198 XP an hour, to the nearest 10");
	assert.equal(xpForPlan(30, 198), 100);
	assert.equal(xpForPlan(5, 40), 10, "never under the 10 XP floor");
	assert.equal(xpForPlan(600, 400), 500, "never over the 500 XP cap");
	assert.equal(xpForPlan(90, null), 180, "no rate measured yet: a typical 120 XP an hour");
});

test("setup and the tutor's profile follow the language being learned, not Slovak", async () => {
	const { parallelsLine, learnerProfileText, priorsFor } = await import("../src/core/index.ts");
	const ESTONIAN = { code: "et", english: "Estonian" };
	// The lessons' parallels exist only for the lessons' own language.
	assert.ok(parallelsLine({ languages: ["sk", "ru", "en"] }, ESTONIAN).startsWith("Explanations stay in English"));
	assert.equal(priorsFor("Estonian").find((p) => p.id === "reading")?.title, "I read some Estonian");
	const goal = { level: "A2", minutesPerDay: 20, purposes: ["daily"], languages: ["et", "sk", "en"], onboardedAt: "2026-11-05T00:00:00Z" } as Parameters<typeof learnerProfileText>[1];
	const text = learnerProfileText(ESTONIAN, goal, null, {})!;
	assert.match(text, /^- Estonian is for:/m);
	assert.match(text, /Knows: Slovak/, "Slovak is a language the learner knows");
	assert.doesNotMatch(text, /Knows:[^\n]*Estonian \(/, "the target is not listed as a known language");
	assert.doesNotMatch(text, /Slovak is for|Slovak examples/);
});
