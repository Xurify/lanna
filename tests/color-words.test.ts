import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { paintFor } from "../src/core/color-words.ts";
import { WORD_CLUSTERS } from "../src/core/word-clusters.ts";

const courseColors = (language: string): string[] =>
	(
		JSON.parse(fs.readFileSync(`curriculum/${language}/course.json`, "utf-8")) as {
			units: Array<{ id: string; lemmas?: string[] }>;
		}
	).units.find((u) => u.id === "lx-words-colors")!.lemmas!;

test("every color word in the three Colors units has its paint; the word for color itself keeps the English", () => {
	for (const lemma of WORD_CLUSTERS["lx-colours"]!.lemmas)
		assert.equal(paintFor("lx-colours", lemma) === undefined, lemma === "farba", lemma);
	for (const language of ["russian", "estonian"])
		for (const lemma of courseColors(language)) assert.ok(paintFor("lx-words-colors", lemma), `${language} ${lemma}`);
});

test("Russian blue is two colors, and a color word outside a Colors unit keeps the English", () => {
	assert.equal(paintFor("lx-words-colors", "синий"), "darkblue");
	assert.equal(paintFor("lx-words-colors", "голубой"), "lightblue");
	assert.equal(paintFor("lx-words-colors", "Красный"), "red");
	assert.equal(paintFor("lx-words-describing", "красный"), undefined);
});
