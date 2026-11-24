import assert from "node:assert/strict";
import { test } from "node:test";
import {
	candidatesFor,
	deedsIn,
	lessonWords,
	senseIn,
	translationNamesGloss,
	type LessonItem,
	type LessonPlan,
} from "../src/core/index.ts";
import type { LexiconEntry } from "../src/core/review.ts";

test("a card shows the sense the sentence uses, without notes", () => {
	assert.equal(senseIn("road, way; tea", "I'd like some tea."), "tea");
	assert.equal(senseIn("road, way; tea", "Which way is it?"), "road, way");
	assert.equal(
		senseIn("lunch, dinner (the main meal of the day, which is served between noon and 3 p.m.); noon", "I'm at lunch."),
		"lunch, dinner",
	);
	assert.equal(senseIn("egg; ovum; testicle, ball, nut", "This is an egg."), "egg");
	assert.equal(senseIn("road, way; tea", "The teacher is here."), "road, way");
	assert.equal(senseIn("don't, doesn't, not: used in negative forms; no", "We don't drink."), "don't, doesn't, not");
	assert.equal(senseIn("beer (alcoholic drink; a glass of it); ale", "Tom is drinking a beer."), "beer");
	assert.equal(senseIn("beer (verbal noun of пить (pitʹ) (nomen obiecti)); a beer", "Beer, please."), "beer");
});

test("a gloss with no word to look for never rules a sentence out", () => {
	assert.equal(translationNamesGloss("I (first-person singular subject pronoun)", "He came."), true);
	assert.equal(translationNamesGloss("white bread", "How did it get there?"), false);
	assert.equal(translationNamesGloss("road, way; tea", "Please do it."), false);
	assert.equal(translationNamesGloss("tea", "The teacher came."), false);
	assert.equal(translationNamesGloss("tea", "Two teas, please."), true);
	assert.equal(translationNamesGloss("apple", "I like apples."), true);
	assert.equal(translationNamesGloss("he; she", "What about him?"), true);
});

test("a word-unit sentence whose form is another word's, in another sense, is left out", () => {
	const example = (text: string, en: string, answer: string) => ({
		text,
		en,
		cloze: { answer, at: text.indexOf(answer) },
	});
	const entries = [
		{
			slug: "caj",
			lemma: "čaj",
			en: "tea",
			pos: "noun",
			forms: ["čaj", "čaju"],
			examples: [example("Daj mi čaj.", "Give me tea.", "čaj"), example("Rýchlo, čaj sa!", "Quick, hide!", "čaj")],
		},
		{ slug: "cajit", lemma: "čajiť sa", en: "to hide", pos: "verb", forms: ["čaj"], examples: [] },
	] as unknown as LexiconEntry[];
	const kept = candidatesFor(entries, "lx-drinks").map((c) => c.entry.examples[c.index]!.en);
	assert.deepEqual(kept, ["Give me tea."]);
});

test("stamps are named in the course language", () => {
	const first = (lang: string | undefined) => deedsIn(lang).find((d) => d.id === "first-step")!.name;
	assert.equal(first(undefined), "Prvý krok");
	assert.equal(first("ru"), "Первый шаг");
	assert.equal(first("et"), "Esimene samm");
	for (const lang of ["ru", "et"]) {
		const names = deedsIn(lang).map((d) => d.name);
		assert.deepEqual(
			deedsIn(lang)
				.filter((d, i) => d.name === deedsIn(undefined)[i]!.name && !/^\d/.test(d.name))
				.map((d) => d.id),
			[],
			`${lang}: every deed has its own name`,
		);
		assert.equal(new Set(names).size, names.length, `${lang}: names are unique`);
	}
});

test("two words of a lesson never show the same meaning", () => {
	const item = (lemma: string, gloss: string, hint: string) =>
		({
			id: `${lemma}#0`,
			kind: "type",
			unit: "lx-words-pronouns",
			slug: lemma,
			lemma,
			gloss,
			hint,
		}) as unknown as LessonItem;
	const plan = {
		unit: "lx-words-pronouns",
		items: [
			item("sina", "you (informal, singular)", "you"),
			item("teie", "you (plural or polite)", "you"),
			item("mina", "I (first person)", "I"),
			item("ma", "I (first person)", "I"),
		],
	} as unknown as LessonPlan;
	const words = lessonWords(plan);
	assert.deepEqual(
		words.map((w) => w.gloss),
		["you (informal, singular)", "you (plural or polite)", "I (first person)"],
	);
});
