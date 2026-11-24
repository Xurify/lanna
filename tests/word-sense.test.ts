import assert from "node:assert/strict";
import { test } from "node:test";
import { candidatesFor, deedsIn, senseIn, translationNamesGloss } from "../src/core/index.ts";
import type { LexiconEntry } from "../src/core/review.ts";

test("a card shows the sense the sentence uses, without notes", () => {
	assert.equal(senseIn("road, way; tea", "I'd like some tea."), "tea");
	assert.equal(senseIn("road, way; tea", "Which way is it?"), "road, way");
	assert.equal(
		senseIn("lunch, dinner (the main meal of the day, which is served between noon and 3 p.m.); noon", "I'm at lunch."),
		"lunch, dinner",
	);
	assert.equal(senseIn("egg; ovum; testicle, ball, nut", "This is an egg."), "egg");
	assert.equal(senseIn("beer (alcoholic drink; a glass of it); ale", "Tom is drinking a beer."), "beer");
	assert.equal(senseIn("beer (verbal noun of пить (pitʹ) (nomen obiecti)); a beer", "Beer, please."), "beer");
});

test("a gloss with no word to look for never rules a sentence out", () => {
	assert.equal(translationNamesGloss("I (first-person singular subject pronoun)", "He came."), true);
	assert.equal(translationNamesGloss("white bread", "How did it get there?"), false);
	assert.equal(translationNamesGloss("road, way; tea", "Please do it."), false);
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
