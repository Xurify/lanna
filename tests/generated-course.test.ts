/**
 * A GENERATED COURSE RUNS THE CORE (2026-11-05): with a language's course
 * set before the core loads, the lessons, the map, the chapters and the
 * placement tiers are that course's, and a grammar unit drills the
 * dictionary's sentences whose blank carries its tags.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Course } from "../src/core/course.ts";
import type { LexiconEntry } from "../src/core/review.ts";
import type { UnitId } from "../src/core/lesson.ts";

const COURSE: Course = {
	language: "czech",
	code: "cs",
	tag: "cs-CZ",
	version: 1,
	draft: true,
	units: [
		{
			id: "loc",
			kind: "grammar",
			title: "Where? v, na",
			tagline: "The locative",
			rule: "After v and na for a place, the locative: v kavárně.",
			glyph: "map-pin",
			grammarTerm: "Locative case",
			nativeTerm: "Lokál",
			cat: "Nouns",
			tags: ["locative", "singular"],
			after: ["v", "na"],
		},
		{
			id: "acc",
			kind: "grammar",
			title: "Objects",
			tagline: "What you have",
			rule: "The object takes the accusative: Piju kávu.",
			glyph: "coffee",
			grammarTerm: "Accusative case",
			cat: "Nouns",
			tags: ["accusative", "singular"],
		},
		{
			id: "lx-food",
			kind: "words",
			title: "Words: Food",
			tagline: "Coffee and school",
			rule: "Learn the word with its sentence.",
			glyph: "apple",
			lemmas: ["káva", "škola"],
		},
	],
	tutors: [{ id: "sounds", title: "Sounds", tagline: "ř and length", glyph: "ear", brief: "Teach the Czech sounds." }],
	goals: [
		{ id: "can-order", title: "Can order", tagline: "In a café", scene: "cafe" },
		{ id: "can-find", title: "Can find the way", tagline: "Where things are" },
	],
	chapters: [
		{
			id: "cafe",
			stage: "a1",
			title: "At the café",
			tagline: "Objects",
			units: ["acc", "lx-food", "sounds", "can-order"],
		},
		{ id: "town", stage: "a2", title: "In town", tagline: "Places", units: ["loc", "can-find"] },
	],
};

(globalThis as Record<string, unknown>).__lhCourse = COURSE;
const lesson = await import("../src/core/lesson.ts");
const curriculum = await import("../src/core/curriculum.ts");
const onboarding = await import("../src/core/onboarding.ts");

const entry = (
	slug: string,
	lemma: string,
	formTags: Record<string, string[]>,
	sentences: Array<[string, string]>,
): LexiconEntry => ({
	slug,
	lemma,
	en: slug,
	cat: "Nouns",
	gender: "feminine",
	rank: 10,
	forms: Object.keys(formTags).filter((f) => f !== lemma),
	formTags,
	related: [],
	examples: sentences.map(([text, answer]) => ({
		text,
		en: text,
		src: "tatoeba",
		cloze: { answer, at: text.indexOf(answer) },
	})),
});

const KAVA = entry(
	"kava",
	"káva",
	{ káva: ["nominative singular"], kávu: ["accusative singular"], kávě: ["dative singular", "locative singular"] },
	[
		["Piju kávu.", "kávu"],
		["Mám kávu.", "kávu"],
		["Chci kávu.", "kávu"],
		["Sedím v kávě.", "kávě"],
		["Dám to kávě.", "kávě"],
		["Káva je dobrá.", "Káva"],
	],
);
const SKOLA = entry(
	"skola",
	"škola",
	{ škola: ["nominative singular"], školu: ["accusative singular"], škole: ["dative singular", "locative singular"] },
	[
		["Vidím školu.", "školu"],
		["Jsem ve škole.", "škole"],
		["Jsem v škole.", "škole"],
		["Je na škole.", "škole"],
	],
);
const LEXICON = [KAVA, SKOLA];

describe("a generated course runs the core", () => {
	test("its units, map and chapters replace Slovak's, with First words first", () => {
		assert.deepEqual(
			lesson
				.allUnits()
				.slice(0, 4)
				.map((u) => u.id),
			["words", "loc", "acc", "lx-food"],
		);
		assert.ok(
			lesson.allUnits().some((u) => u.id === "words-300"),
			"the frequency bands come along",
		);
		assert.ok(!lesson.allUnits().some((u) => u.id === "acc-fem"), "no Slovak unit");
		assert.equal(lesson.lessonLanguage(), "cs");
		assert.equal(lesson.lessonsHaveBridges(), false);
		assert.deepEqual(
			curriculum.allChapters().map((c) => c.id),
			["cafe", "town"],
		);
		assert.deepEqual(curriculum.allChapters()[0]!.units, ["words", "acc", "lx-food", "sounds", "can-order"]);
		assert.deepEqual(
			curriculum.curriculumUnits().map((u) => `${u.kind}:${u.id}`),
			["words:words", "drill:acc", "words:lx-food", "tutor:sounds", "goal:can-order", "drill:loc", "goal:can-find"],
		);
		assert.equal(curriculum.curriculumUnit("sounds")?.brief, "Teach the Czech sounds.");
		assert.equal(lesson.unitInfo("loc" as UnitId).slovakTerm, "Lokál", "the native term rides the same field");
	});

	test("a grammar unit drills the sentences whose blank carries its tags, after its trigger words when it has them", () => {
		const acc = lesson.candidatesFor(LEXICON, "acc" as UnitId).map((c) => c.entry.examples[c.index]!.text);
		assert.deepEqual(acc.sort(), ["Chci kávu.", "Mám kávu.", "Piju kávu.", "Vidím školu."]);
		const loc = lesson.candidatesFor(LEXICON, "loc" as UnitId).map((c) => c.entry.examples[c.index]!.text);
		assert.deepEqual(
			loc.sort(),
			["Je na škole.", "Jsem v škole.", "Sedím v kávě."],
			"kávě after 'dám' is a dative, and 've' is not a listed trigger",
		);
		const plan = lesson.buildLesson(LEXICON, "acc" as UnitId, { seed: 1, length: 4 });
		assert.ok(plan.items.length > 0);
		const item = plan.items.find((i) => i.answer === "kávu")!;
		assert.equal(item.form, "accusative singular of káva");
		assert.equal(lesson.triggerOf("Sedím v kávě.", 8, "loc" as UnitId), "v");
	});

	test("the map's state and the placement tiers come from the course", () => {
		const state = curriculum.curriculumState({}, "B1");
		assert.equal(state.current, "cafe");
		assert.equal(curriculum.nextLessonUnit(state), "acc", "a drill before a word unit, as in Slovak");
		assert.deepEqual(
			onboarding.placementTiers().map((t) => [t.id, t.units, t.chapters]),
			[
				["a1a", ["words", "acc"], ["cafe"]],
				["a2", ["loc"], ["town"]],
			],
		);
	});
});
