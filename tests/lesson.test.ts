/**
 * LESSON CORE PINS (LangHarness redesign): the lesson screen builds every
 * rep locally from the lexicon, so the classifier, the builder's
 * determinism, the combo XP and the streak rule are the whole contract.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import {
	buildBlitz,
	buildLesson,
	classifyExample,
	repXp,
	sameSentence,
	sentenceTokens,
	streakOf,
	triggerOf,
	unitLevel,
	unitStage,
	UNITS,
	xpLevel,
} from "../src/core/lesson.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const lexicon = JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] };
const entries = lexicon.words;

const noun = (sk: string, gender: string): LexiconEntry => ({ slug: sk, sk, en: sk, cat: "Nouns", gender }) as LexiconEntry;
const ex = (sk: string, answer: string) => ({ sk, cloze: { answer, at: sk.indexOf(answer) } });

test("classifyExample: feminine accusative, locative and genitive by trigger", () => {
	const skola = noun("škola", "feminine");
	assert.equal(classifyExample(skola, ex("Mám rád školu.", "školu")), "acc-fem");
	assert.equal(classifyExample(skola, ex("Som v škole.", "škole")), "loc");
	assert.equal(classifyExample(skola, ex("Idem do školy.", "školy")), "gen");
	// The dictionary form drills nothing.
	assert.equal(classifyExample(skola, ex("Škola je veľká.", "Škola")), null);
});

test("classifyExample: verbs split past from present", () => {
	const verb = { slug: "robiť", sk: "robiť", en: "do", cat: "Verbs" } as LexiconEntry;
	assert.equal(classifyExample(verb, ex("Ja robím doma.", "robím")), "present");
	assert.equal(classifyExample(verb, ex("Včera som robil doma.", "robil")), "past");
});

test("buildLesson is deterministic per seed and never repeats a word", () => {
	const a = buildLesson(entries, "acc-fem", { seed: 42 });
	const b = buildLesson(entries, "acc-fem", { seed: 42 });
	assert.deepEqual(a, b);
	assert.equal(a.items.length, 12);
	const slugs = a.items.map((i) => i.slug);
	assert.equal(new Set(slugs).size, slugs.length);
	const c = buildLesson(entries, "acc-fem", { seed: 43 });
	assert.notDeepEqual(a.items.map((i) => i.id), c.items.map((i) => i.id));
});

test("every unit has enough material for a full lesson", () => {
	for (const u of UNITS) {
		const plan = buildLesson(entries, u.id, { seed: 7 });
		assert.ok(plan.items.length >= 10, `${u.id}: ${plan.items.length} items`);
	}
});

test("buildBlitz builds only choose reps", () => {
	const plan = buildBlitz(entries, ["present", "loc"], 1);
	assert.ok(plan.items.length > 20);
	assert.ok(plan.items.every((i) => i.kind === "choose"));
});

test("repXp: misses earn nothing, combos add a bonus, accents earn less", () => {
	assert.equal(repXp("type", "wrong", 0), 0);
	assert.ok(repXp("type", "exact", 5) > repXp("type", "exact", 1));
	assert.ok(repXp("type", "accents", 1) < repXp("type", "exact", 1));
});

test("sameSentence ignores case and punctuation, not word order", () => {
	assert.ok(sameSentence(sentenceTokens("Idem do školy."), sentenceTokens("idem do školy")));
	assert.ok(!sameSentence(sentenceTokens("Idem do školy."), sentenceTokens("do školy idem")));
});

test("streakOf counts back from today and forgives one rest day after six", () => {
	assert.deepEqual(streakOf(new Set(["2026-10-25", "2026-10-26", "2026-10-27"]), "2026-10-27"), {
		days: 3,
		restUsed: false,
		activeToday: true,
	});
	// Not active yet today: the streak from yesterday still stands.
	assert.equal(streakOf(new Set(["2026-10-26"]), "2026-10-27").days, 1);
	// Six days, a gap, then today and yesterday.
	const days = new Set(["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-25", "2026-10-26"]);
	const s = streakOf(days, "2026-10-26");
	assert.equal(s.restUsed, true);
	assert.equal(s.days, 8);
	assert.equal(streakOf(new Set(["2026-10-20"]), "2026-10-27").days, 0);
});

test("levels climb with lessons and XP", () => {
	assert.equal(unitLevel(0), 0);
	assert.ok(unitLevel(15) > unitLevel(3));
	assert.equal(xpLevel(0).level, 1);
	assert.ok(xpLevel(1000).level > xpLevel(100).level);
});

// ─── The method (2026-10-27): production once a unit holds, interleaving,
// the trigger for the hint, half XP for the second try ────────────────────

test("a practised unit is mostly typed; a new one recognises first", () => {
	const fresh = buildLesson(entries, "gen", { seed: 5 });
	const held = buildLesson(entries, "gen", { seed: 5, stage: "practised" });
	const typed = (items: { kind: string }[]) => items.filter((i) => i.kind === "type" || i.kind === "listen").length;
	assert.ok(typed(held.items) > typed(fresh.items));
	assert.ok(held.items.filter((i) => i.kind === "choose").length <= 2);
});

test("mixing pulls a few reps from neighbouring units, marked and graded by their own unit", () => {
	const plan = buildLesson(entries, "gen", { seed: 9, stage: "practised", mix: ["loc", "acc-people"] });
	const mixed = plan.items.filter((i) => i.mixed);
	assert.ok(mixed.length >= 2 && mixed.length <= 4, `mixed ${mixed.length}`);
	assert.ok(mixed.every((i) => i.unit !== "gen"));
	assert.ok(plan.items.filter((i) => !i.mixed).every((i) => i.unit === "gen"));
	assert.equal(new Set(plan.items.map((i) => i.slug)).size, plan.items.length, "still one sentence per word");
});

test("triggerOf names the case-picking preposition, nothing else", () => {
	assert.equal(triggerOf("Idem do školy.", "Idem do ".length), "do");
	assert.equal(triggerOf("Som v meste.", "Som v ".length), "v");
	assert.equal(triggerOf("Pijem kávu.", "Pijem ".length), undefined);
});

test("unitStage: two lessons at 60% make a unit practised", () => {
	assert.equal(unitStage(1, 0.9), "new");
	assert.equal(unitStage(2, 0.5), "new");
	assert.equal(unitStage(2, 0.6), "practised");
});

test("a right answer after the hint earns half", () => {
	assert.equal(repXp("type", "exact", 1, true), Math.ceil(repXp("type", "exact", 1) / 2));
	assert.equal(repXp("type", "wrong", 1, true), 0);
});

test("every grammar unit carries an Estonian bridge", () => {
	for (const u of UNITS) if (u.id !== "words") assert.ok(u.bridge && u.bridge.length > 10, u.id);
});
