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
	classifyAll,
	classifyExample,
	formOptions,
	repXp,
	sameSentence,
	sentenceTokens,
	streakOf,
	triggerOf,
	unitDone,
	unitLevel,
	unitProgress,
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

test("classifyExample: places decline like nouns (od Košíc is the genitive), and the dictionary form drills nothing", () => {
	// Places carry no gender, so they drill the cases but fill no atlas cell.
	const place = (sk: string) => ({ slug: sk.toLowerCase(), sk, en: sk, cat: "Places" }) as LexiconEntry;
	assert.equal(classifyExample(place("Košice"), ex("Z Košíc do Bratislavy cestujeme vlakom.", "Košíc")), "gen");
	assert.equal(classifyExample(place("Praha"), ex("Do Prahy ideme vlakom cez Brno.", "Prahy")), "gen");
	assert.equal(classifyExample(place("Bratislava"), ex("V Bratislave býva už päť rokov.", "Bratislave")), "loc");
	assert.deepEqual(classifyAll(place("Bratislava"), ex("V Bratislave býva už päť rokov.", "Bratislave")), ["loc", "kam-kde"], "the place and the where/where-to choice");
	assert.equal(classifyExample(place("Bratislava"), ex("Bratislava je hlavné mesto Slovenska.", "Bratislava")), null, "the dictionary form drills nothing");
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
		if (u.kind === "pairs") continue; // Dvojičky build their own reps (tests/pairs.test.ts).
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
	// A six-day plan rests one day a week: that rest day keeps the streak.
	const sixDays = new Set(["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-25", "2026-10-26", "2026-10-27"]);
	assert.equal(streakOf(sixDays, "2026-10-27", 1).days, 9);
	// A seven-day plan has no rest day to spend.
	assert.equal(streakOf(sixDays, "2026-10-27", 0).days, 3);
});

// A unit is complete after 3 lessons at 80% right, or 6 lessons whatever
// the accuracy; the ring fills toward that, and holds short of full while
// the accuracy bar is unmet.
test("a unit completes after three good lessons, or six of any kind", () => {
	assert.equal(unitDone(0, null), false);
	assert.equal(unitDone(2, 1), false);
	assert.equal(unitDone(3, 0.8), true);
	assert.equal(unitDone(3, 0.7), false);
	assert.equal(unitDone(5, 0.5), false);
	assert.equal(unitDone(6, 0.5), true);
	assert.equal(unitProgress(0, null), 0);
	assert.ok(unitProgress(1, 1) > 0 && unitProgress(1, 1) < unitProgress(2, 1));
	assert.ok(unitProgress(3, 0.7) < 1);
	assert.equal(unitProgress(3, 0.9), 1);
});

test("levels climb with lessons and XP", () => {
	assert.equal(unitLevel(0), 0);
	assert.ok(unitLevel(15) > unitLevel(3));
	assert.equal(xpLevel(0).level, 1);
	assert.ok(xpLevel(1000).level > xpLevel(100).level);
});

// ─── The method (2026-10-27): production once a unit holds, interleaving,
// the trigger for the hint, half XP for the second try ────────────────────

test("a new unit's lesson opens with two meaning reps (input before output): the whole sentence, three meanings, the translation among them", () => {
	for (const unit of ["gen", "lx-greetings", "words"] as const) {
		const plan = buildLesson(entries, unit, { seed: 3 });
		assert.deepEqual(
			plan.items.slice(0, 2).map((i) => i.kind),
			["meaning", "meaning"],
			unit,
		);
		for (const item of plan.items.filter((i) => i.kind === "meaning")) {
			assert.equal(item.options?.length, 3);
			assert.ok(item.options!.includes(item.translation));
			assert.equal(new Set(item.options).size, 3);
			assert.ok(!item.mixed, "the opening reps come from the unit itself");
		}
	}
	// Once the unit holds, no meaning reps: production throughout.
	const held = buildLesson(entries, "gen", { seed: 3, stage: "practised" });
	assert.equal(held.items.filter((i) => i.kind === "meaning").length, 0);
	assert.ok(repXp("meaning", "exact", 1) < repXp("choose", "exact", 1), "understanding earns less than producing");
});

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

test("unitStage: two lessons at 60% make a unit practised; a complete unit is strong", () => {
	assert.equal(unitStage(1, 0.9), "new");
	assert.equal(unitStage(2, 0.5), "new");
	assert.equal(unitStage(2, 0.6), "practised");
	assert.equal(unitStage(3, 0.8), "strong");
	assert.equal(unitStage(6, 0.3), "strong");
});

// ─── Desirable difficulties (2026-10-28, docs/research/desirable-difficulties.md):
// difficulty rises with mastery ─────────────────────────────────────────────

test("a strong unit is production only, interleaved more, and the plan says so", () => {
	const held = buildLesson(entries, "gen", { seed: 5, stage: "practised", mix: ["loc", "acc-people"] });
	const strong = buildLesson(entries, "gen", { seed: 5, stage: "strong", mix: ["loc", "acc-people"] });
	assert.equal(strong.stage, "strong");
	assert.equal(held.stage, "practised");
	assert.equal(strong.items.filter((i) => i.kind === "choose" || i.kind === "meaning").length, 0, "no recognition reps");
	assert.ok(strong.items.filter((i) => i.mixed).length > held.items.filter((i) => i.mixed).length, "more of the contrast units");
	assert.ok(strong.items.filter((i) => i.kind === "type").length >= 7);
});

test("a right answer after the hint earns half", () => {
	assert.equal(repXp("type", "exact", 1, true), Math.ceil(repXp("type", "exact", 1) / 2));
	assert.equal(repXp("type", "wrong", 1, true), 0);
});

test("every grammar unit carries an Estonian bridge", () => {
	for (const u of UNITS) if (u.kind !== "words" && u.kind !== "pairs" && !u.union) assert.ok(u.bridge && u.bridge.length > 10, u.id);
});

test("formOptions always includes base lemma as distractor when inflected", () => {
	const entry = {
		slug: "stanica",
		sk: "stanica",
		en: "station",
		gender: "feminine",
		forms: ["stanice", "stanici", "stanicu", "staniciach", "staniciam"],
		examples: [],
	};
	const options = formOptions(entry as any, "stanice", ["vlak", "cesta"], () => 0.5);
	assert.ok(options.includes("stanica"), "base form 'stanica' must be included as distractor");
	assert.ok(options.includes("stanice"), "correct answer 'stanice' must be included");
});

test("buildLesson supports gender-targeted drilling", () => {
	const plan = buildLesson(entries, "gen", { seed: 12345, gender: "fem" });
	assert.equal(plan.gender, "fem");
	assert.ok(plan.items.length >= 10);
	const feminineItems = plan.items.filter((it) => it.gender === "feminine");
	assert.ok(feminineItems.length >= 8, `Expected mostly feminine items in gen-fem drill, got ${feminineItems.length}/${plan.items.length}`);
});
