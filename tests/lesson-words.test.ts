import assert from "node:assert/strict";
import { test } from "node:test";
import { lessonWords, type LessonItem, type LessonPlan } from "../src/core/index.ts";
import { translationAroundPicture } from "../src/core/word-pictures.ts";

const item = (lemma: string, extra: Partial<LessonItem> = {}): LessonItem =>
	({
		id: `${lemma}#0`,
		kind: "type",
		unit: "lx-food",
		slug: lemma,
		lemma,
		gloss: `${lemma}-en`,
		...extra,
	}) as LessonItem;

test("a lesson's words come once each, in the order the reps ask them, without mixed-in words", () => {
	const plan = {
		unit: "lx-food",
		items: [
			item("syr"),
			item("chlieb"),
			item("syr"),
			item("pes", { mixed: true, unit: "lx-animals" }),
			item("jablko", { again: true }),
			item("ryža"),
		],
	} as unknown as LessonPlan;
	assert.deepEqual(
		lessonWords(plan).map((w) => w.lemma),
		["syr", "chlieb", "ryža"],
	);
	assert.equal(lessonWords(plan, 2).length, 2);
});

test("the English sentence loses the word its picture shows, with its ending", () => {
	const scene = { kind: "scene", set: "food", scene: "apple" } as const;
	assert.deepEqual(translationAroundPicture("Apples are on the table.", scene), ["", "Apples", " are on the table."]);
	assert.deepEqual(
		translationAroundPicture("I like rain, rain and more rain.", { kind: "scene", set: "weather", scene: "rain" }),
		["I like ", "rain", ", ", "rain", " and more ", "rain", "."],
	);
	assert.deepEqual(translationAroundPicture("The sky is light blue.", { kind: "paint", paint: "lightblue" }), [
		"The sky is ",
		"light blue",
		".",
	]);
	assert.deepEqual(translationAroundPicture("Her coat is grey.", { kind: "paint", paint: "grey" }), [
		"Her coat is ",
		"grey",
		".",
	]);
	assert.deepEqual(translationAroundPicture("Fred is tired.", { kind: "paint", paint: "red" }), ["Fred is tired."]);
	const sun = { kind: "scene", set: "weather", scene: "sun" } as const;
	assert.deepEqual(translationAroundPicture("It is sunny on Sunday.", sun), ["It is ", "sunny", " on Sunday."]);
	assert.deepEqual(translationAroundPicture("Cheese, please.", { kind: "scene", set: "food", scene: "cheese" }), [
		"",
		"Cheese",
		", please.",
	]);
	assert.deepEqual(translationAroundPicture("I love blueberries.", { kind: "paint", paint: "blue" }), [
		"I love blueberries.",
	]);
	assert.deepEqual(translationAroundPicture("Greenland is green.", { kind: "paint", paint: "green" }), [
		"Greenland is ",
		"green",
		".",
	]);
	assert.deepEqual(translationAroundPicture("The bluebird is blue.", { kind: "paint", paint: "blue" }), [
		"The bluebird is ",
		"blue",
		".",
	]);
});
