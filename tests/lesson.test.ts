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
	unheardWord,
	unstatedPerson,
	unitDone,
	unitLevel,
	unitProgress,
	unitStage,
	allUnits,
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
	for (const u of allUnits()) {
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

test("unheardWord names the first typed word the sentence does not contain", () => {
	const sentence = "Ona tiež rozumie.";
	assert.equal(unheardWord(sentence, "Ona tiež nerozumije"), "nerozumije");
	assert.equal(unheardWord(sentence, "Ona tiež rozumije"), "rozumije");
	assert.equal(unheardWord(sentence, "Ona tiez rozumie"), undefined);
	assert.equal(unheardWord(sentence, "rozumie tiež ona"), undefined);
	assert.equal(unheardWord(sentence, "Ona tiež rozumie"), undefined);
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
	// The morning after a forgiven rest day: yesterday was missed, today is still open, the streak through the day before stands.
	const afterRest = new Set(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"]);
	assert.deepEqual(streakOf(afterRest, "2026-10-28", 1), { days: 6, restUsed: true, activeToday: false });
	assert.equal(streakOf(afterRest, "2026-10-28", 0).days, 0, "a seven-day plan has no rest day to forgive");
	assert.equal(streakOf(afterRest, "2026-10-29", 1).days, 0, "two missed days in a row end the streak");
	assert.deepEqual(streakOf(new Set<string>(), "2026-10-28", 6), { days: 0, restUsed: false, activeToday: false });
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

test("a new lesson opens on the input its unit needs: vocabulary on meaning, a grammar lesson on the form", () => {
	for (const unit of ["lx-greetings", "words"] as const) {
		const plan = buildLesson(entries, unit, { seed: 3 });
		assert.deepEqual(
			plan.items.slice(0, 2).map((i) => i.kind),
			["meaning", "meaning"],
			unit,
		);
	}
	// A grammar unit's lesson opens on the case (it follows the sketch which
	// just taught it), with the two meaning reps later in the lesson.
	const grammar = buildLesson(entries, "gen", { seed: 3 });
	assert.deepEqual(
		grammar.items.slice(0, 3).map((i) => i.kind),
		["choose", "type", "meaning"],
		"the case comes first",
	);
	for (const item of grammar.items.filter((i) => i.kind === "meaning")) {
		assert.equal(item.options?.length, 3);
		assert.ok(item.options!.includes(item.translation));
		assert.equal(new Set(item.options).size, 3);
		assert.ok(!item.mixed, "the opening reps come from the unit itself");
	}
	// Once the unit holds, no meaning reps: production throughout.
	const held = buildLesson(entries, "gen", { seed: 3, stage: "practiced" });
	assert.equal(held.items.filter((i) => i.kind === "meaning").length, 0);
	assert.ok(repXp("meaning", "exact", 1) < repXp("choose", "exact", 1), "understanding earns less than producing");
});

test("a practiced unit is mostly typed; a new one recognizes first", () => {
	const fresh = buildLesson(entries, "gen", { seed: 5 });
	const held = buildLesson(entries, "gen", { seed: 5, stage: "practiced" });
	const typed = (items: { kind: string }[]) => items.filter((i) => i.kind === "type" || i.kind === "listen").length;
	assert.ok(typed(held.items) > typed(fresh.items));
	assert.ok(held.items.filter((i) => i.kind === "choose").length <= 2);
});

test("mixing pulls a few reps from neighboring units, marked and graded by their own unit", () => {
	const plan = buildLesson(entries, "gen", { seed: 9, stage: "practiced", mix: ["loc", "acc-people"] });
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

test("unitStage: two lessons at 60% make a unit practiced; a complete unit is strong", () => {
	assert.equal(unitStage(1, 0.9), "new");
	assert.equal(unitStage(2, 0.5), "new");
	assert.equal(unitStage(2, 0.6), "practiced");
	assert.equal(unitStage(3, 0.8), "strong");
	assert.equal(unitStage(6, 0.3), "strong");
});

// ─── Desirable difficulties (2026-10-28, docs/research/desirable-difficulties.md):
// difficulty rises with mastery ─────────────────────────────────────────────

test("a strong unit is production only, interleaved more, and the plan says so", () => {
	const held = buildLesson(entries, "gen", { seed: 5, stage: "practiced", mix: ["loc", "acc-people"] });
	const strong = buildLesson(entries, "gen", { seed: 5, stage: "strong", mix: ["loc", "acc-people"] });
	assert.equal(strong.stage, "strong");
	assert.equal(held.stage, "practiced");
	assert.equal(strong.items.filter((i) => i.kind === "choose" || i.kind === "meaning").length, 0, "no recognition reps");
	assert.ok(strong.items.filter((i) => i.mixed).length > held.items.filter((i) => i.mixed).length, "more of the contrast units");
	assert.ok(strong.items.filter((i) => i.kind === "type").length >= 7);
});

test("a right answer after the hint earns half", () => {
	assert.equal(repXp("type", "exact", 1, true), Math.ceil(repXp("type", "exact", 1) / 2));
	assert.equal(repXp("type", "wrong", 1, true), 0);
});

test("every grammar unit carries an Estonian bridge", () => {
	for (const u of allUnits()) if (u.kind !== "words" && u.kind !== "pairs" && !u.union) assert.ok(u.bridge && u.bridge.length > 10, u.id);
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

test("buildLesson prioritizes weakGender candidates when unit is practiced", () => {
	const standardPlan = buildLesson(entries, "gen", { seed: 54321 });
	const weakPlan = buildLesson(entries, "gen", { seed: 54321, weakGender: "fem" });

	const standardFemCount = standardPlan.items.filter((it) => it.gender === "feminine").length;
	const weakFemCount = weakPlan.items.filter((it) => it.gender === "feminine").length;

	assert.ok(weakFemCount >= standardFemCount, `Weak plan feminine items (${weakFemCount}) should be >= standard (${standardFemCount})`);
	assert.ok(weakFemCount >= 6, `Expected at least 6 feminine items when weakGender is fem, got ${weakFemCount}`);
});


test("a dropped subject pronoun is named; a stated subject is not", () => {
	const at = (s: string, w: string) => s.indexOf(w);
	assert.equal(unstatedPerson("Bývam v Groningene.", 0, "I form of bývať"), "I");
	assert.equal(unstatedPerson("Kde bývaš?", at("Kde bývaš?", "bývaš"), "you form of bývať"), "you");
	assert.equal(unstatedPerson("Ja bývam v Groningene.", 3, "I form of bývať"), undefined);
	assert.equal(unstatedPerson("Mama býva v Košiciach.", 5, "he / she / it form of bývať"), undefined);
	assert.equal(unstatedPerson("Býva v Košiciach.", 0, "he / she / it form of bývať"), "he / she / it");
	assert.equal(unstatedPerson("Bývala v Košiciach.", 0, "she (past) form of bývať"), undefined);
	assert.equal(unstatedPerson("Vidím mamu.", 6, "accusative of mama (feminine)"), undefined);
});
