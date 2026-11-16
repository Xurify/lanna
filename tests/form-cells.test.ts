import assert from "node:assert/strict";
import { test } from "node:test";
import { cellsLabel, cellsOf, formContrast, formMismatch, numberByEnding, numberIn } from "../src/core/form-cells.ts";
import { describeForm } from "../src/core/lesson.ts";
import { missReason } from "../src/core/review-miss.ts";

const BYT = {
	singular: ["byt", "bytu", "bytu", "byt", "byte", "bytom"],
	plural: ["byty", "bytov", "bytom", "byty", "bytoch", "bytmi"],
};

const STANICA = {
	singular: ["stanica", "stanice", "stanici", "stanicu", "stanici", "stanicou"],
	plural: ["stanice", "staníc", "staniciam", "stanice", "staniciach", "stanicami"],
};

test("cellsOf: every cell a spelling fills, accents optional only when nothing matches exactly", () => {
	assert.deepEqual(cellsOf(BYT, "bytmi"), [{ grammarCase: "instrumental", number: "plural" }]);
	assert.deepEqual(cellsOf(BYT, "bytom"), [
		{ grammarCase: "instrumental", number: "singular" },
		{ grammarCase: "dative", number: "plural" },
	]);
	assert.deepEqual(cellsOf(STANICA, "stanic"), [{ grammarCase: "genitive", number: "plural" }]);
	assert.deepEqual(cellsOf(BYT, "domom"), []);
	assert.deepEqual(cellsOf(undefined, "bytom"), []);
});

test("cellsLabel and numberIn", () => {
	assert.equal(cellsLabel(cellsOf(BYT, "bytom")), "instrumental singular or dative plural");
	assert.equal(cellsLabel([]), undefined);
	assert.equal(numberIn(cellsOf(BYT, "bytmi"), "instrumental"), "plural");
	assert.equal(numberIn(cellsOf(BYT, "byty"), "instrumental"), undefined);
});

test("formMismatch: right case and wrong number (s bytom for s bytmi)", () => {
	assert.deepEqual(formMismatch(cellsOf(BYT, "bytom"), cellsOf(BYT, "bytmi"), "instrumental"), {
		kind: "number",
		grammarCase: "instrumental",
		given: "singular",
		needed: "plural",
	});
});

test("formMismatch: right number and wrong case (v byte for s bytom)", () => {
	assert.deepEqual(formMismatch(cellsOf(BYT, "byte"), cellsOf(BYT, "bytom"), "instrumental"), {
		kind: "case",
		number: "singular",
		given: ["locative"],
		needed: "instrumental",
	});
});

test("formMismatch: the drill's case picks the needed cell when the spelling fits several", () => {
	const needed = cellsOf(STANICA, "stanice");
	assert.equal(formMismatch(cellsOf(STANICA, "staníc"), needed), undefined, "three cells, no case to choose");
	assert.deepEqual(formMismatch(cellsOf(STANICA, "staníc"), needed, "genitive"), {
		kind: "number",
		grammarCase: "genitive",
		given: "plural",
		needed: "singular",
	});
});

test("formMismatch: nothing to say when neither case nor number is shared", () => {
	assert.equal(formMismatch(cellsOf(BYT, "bytoch"), cellsOf(BYT, "bytom"), "instrumental"), undefined);
});

test("describeForm names the number when the table settles it", () => {
	const entry = { sk: "byt", cat: "Nouns", gender: "masculine-inanimate", declension: BYT };
	assert.equal(describeForm(entry, "bytmi", "ins"), "instrumental plural of byt (masculine-inanimate)");
	assert.equal(
		describeForm({ ...entry, cat: "Verbs", pos: "noun", declension: undefined }, "bytmi", "ins"),
		undefined,
		"a verb is never named by a case",
	);
});

test("missReason names what was typed and what differs from the needed form", () => {
	const r = missReason({
		answer: "bytmi",
		lemma: "byt",
		gloss: "apartment",
		given: "bytom",
		forms: [...BYT.singular, ...BYT.plural],
		declension: BYT,
		neededCase: "instrumental",
	})!;
	assert.equal(r.slip, "same-word");
	assert.equal(r.givenForm, "instrumental singular or dative plural");
	assert.equal(r.mismatch?.kind, "number");
	const plain = missReason({
		answer: "bytmi",
		lemma: "byt",
		gloss: "apartment",
		given: "bytom",
		forms: [...BYT.singular, ...BYT.plural],
	})!;
	assert.equal(plain.slip, "same-word");
	assert.equal(plain.givenForm, undefined, "no table, no claim");
	assert.equal(plain.mismatch, undefined);
});

test("numberByEnding: the dative, locative and instrumental tell the number by their ending", () => {
	assert.equal(numberByEnding("bytmi", "instrumental"), "plural");
	assert.equal(numberByEnding("bytom", "instrumental"), "singular");
	assert.equal(numberByEnding("ženou", "instrumental"), "singular");
	assert.equal(numberByEnding("ženami", "instrumental"), "plural");
	assert.equal(numberByEnding("bytoch", "locative"), "plural");
	assert.equal(numberByEnding("byte", "locative"), "singular");
	assert.equal(numberByEnding("ženám", "dative"), "plural");
	assert.equal(numberByEnding("chlapovi", "dative"), "singular");
	assert.equal(numberByEnding("byty", "accusative"), undefined, "the accusative's endings overlap");
	assert.equal(numberByEnding("bytmi", "instrumental", "et-EE"), undefined, "Slovak endings only");
});

test("formContrast: a noun with only its forms list still names a wrong number (s bytom for s bytmi)", () => {
	const input = {
		given: "bytom",
		answer: "bytmi",
		lemma: "byt",
		neededCase: "instrumental" as const,
		isNoun: true,
		forms: ["bytu", "byte", "bytom", "byty", "bytov", "bytoch", "bytmi"],
	};
	assert.deepEqual(formContrast(input), {
		givenForm: "instrumental singular",
		mismatch: { kind: "number", grammarCase: "instrumental", given: "singular", needed: "plural" },
	});
	assert.deepEqual(formContrast({ ...input, given: "bytu" }), {}, "an ending of another case says nothing");
	assert.deepEqual(formContrast({ ...input, given: "bytomi" }), {}, "only a form the dictionary lists");
	assert.deepEqual(formContrast({ ...input, isNoun: false }), {});
});

test("describeForm reads the number from the ending when there is no table", () => {
	assert.equal(
		describeForm({ sk: "byt", cat: "Nouns", gender: "masculine-inanimate" }, "bytmi", "ins"),
		"instrumental plural of byt (masculine-inanimate)",
	);
});
