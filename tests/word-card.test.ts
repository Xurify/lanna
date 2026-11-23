import assert from "node:assert/strict";
import { test } from "node:test";
import { cardsWithoutOtherSentences, isAnsweredForm, wordCardOf } from "../src/core/word-card.ts";
import { firstLetterOf, helpPrice, helpSteps, type HelpRep } from "../src/core/help-ladder.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const example = (text: string, answer: string, en = `${text} (en)`) => ({
	text,
	en,
	src: "tatoeba",
	cloze: { answer, at: text.indexOf(answer) },
});

const DAZD: LexiconEntry = {
	slug: "dazd",
	sk: "dážď",
	en: "rain",
	cat: "Nouns",
	pos: "noun",
	gender: "masculine-inanimate",
	forms: ["dažďa", "dažďu", "daždi", "dažde"],
	related: [],
	examples: [
		example("Jarný dážď oživil kvet.", "dážď"),
		example("Dážď mi zabránil ísť von.", "Dážď"),
		example("Jarný dážď oživil kvet.", "dážď"),
		example("Po daždi vždy príde slnko a celý svet je zrazu krajší, čistejší a jasnejší než predtým.", "daždi"),
		example("Bez dažďa niet úrody.", "dažďa"),
		example("Počúvam dážď.", "dážď"),
	],
};

test("the card names the part of speech and gender in full words", () => {
	const card = wordCardOf(DAZD, 0);
	assert.equal(card.partOfSpeech, "noun");
	assert.equal(card.gender, "masculine inanimate");
	assert.deepEqual(
		wordCardOf({ ...DAZD, pos: undefined, cat: "Adjectives", gender: undefined }, 0).partOfSpeech,
		"adjective",
	);
});

test("two other real sentences: never the rep's own, never a repeat, never an overlong one", () => {
	const card = wordCardOf(DAZD, 0);
	assert.deepEqual(
		card.examples.map((e) => e.before + e.word + e.after),
		["Dážď mi zabránil ísť von.", "Bez dažďa niet úrody."],
	);
	assert.equal(card.examples[1]!.word, "dažďa");
	assert.equal(card.examples[1]!.en, "Bez dažďa niet úrody. (en)");
});

test("unordered verified forms stay a list, dictionary form first, with no case names", () => {
	const card = wordCardOf(DAZD, 0);
	assert.equal(card.table, undefined);
	assert.deepEqual(card.forms, ["dážď", "dažďa", "dažďu", "daždi", "dažde"]);
});

test("a hand-checked paradigm becomes six case rows", () => {
	const dom = {
		...DAZD,
		sk: "dom",
		declension: {
			singular: ["dom", "domu", "domu", "dom", "dome", "domom"],
			plural: ["domy", "domov", "domom", "domy", "domoch", "domami"],
		},
	};
	const table = wordCardOf(dom, 0).table!;
	assert.deepEqual(
		table.map((r) => r.grammarCase),
		["nominative", "genitive", "dative", "accusative", "locative", "instrumental"],
	);
	assert.deepEqual(table[4], { grammarCase: "locative", singular: "dome", plural: "domoch" });
});

test("an added language's tagged forms become case rows; doublets share a cell, mixed tags are skipped", () => {
	const maja: LexiconEntry = {
		slug: "maja",
		lemma: "maja",
		en: "house",
		cat: "Nouns",
		related: [],
		examples: [example("Ma olen majas.", "majas")],
		formTags: {
			maja: ["nominative singular", "accusative nominative singular", "genitive singular"],
			majad: ["nominative plural"],
			majja: ["illative singular"],
			majasse: ["illative singular"],
			majas: ["inessive singular"],
		},
	};
	assert.deepEqual(wordCardOf(maja, 0).table, [
		{ grammarCase: "nominative", singular: "maja", plural: "majad" },
		{ grammarCase: "genitive", singular: "maja", plural: null },
		{ grammarCase: "illative", singular: "majja / majasse", plural: null },
		{ grammarCase: "inessive", singular: "majas", plural: null },
	]);
	assert.ok(isAnsweredForm("majja / majasse", "majasse", "et-EE"));
	assert.ok(!isAnsweredForm("majas", "majades", "et-EE"));
	assert.ok(!isAnsweredForm(null, "majas", "et-EE"));
});

const rep = (over: Partial<HelpRep>): HelpRep => ({
	kind: "type",
	vocabulary: false,
	pairs: false,
	hidesMeaning: false,
	hasForm: true,
	retyped: false,
	task: false,
	...over,
});

test("the help ladder runs from the meaning to the word's first letter", () => {
	assert.deepEqual(helpSteps(rep({ hidesMeaning: true })), ["translation", "form", "first-letter"]);
	assert.deepEqual(helpSteps(rep({ vocabulary: true })), ["first-letter"]);
	assert.deepEqual(helpSteps(rep({ kind: "choose" })), ["form"]);
	assert.deepEqual(helpSteps(rep({ kind: "choose", retyped: true })), ["form", "first-letter"]);
	assert.deepEqual(helpSteps(rep({ pairs: true, kind: "choose" })), []);
	assert.deepEqual(helpSteps(rep({ kind: "meaning", hidesMeaning: true })), []);
	assert.deepEqual(helpSteps(rep({ kind: "listen" })), []);
	assert.deepEqual(helpSteps(rep({ task: true })), []);
});

test("a missed choice in a new-stage words unit gets the first letter, though it had no ladder before", () => {
	const choice = rep({ kind: "choose", vocabulary: true, hidesMeaning: false });
	assert.deepEqual(helpSteps(choice), []);
	assert.deepEqual(helpSteps({ ...choice, retyped: true }), ["first-letter"]);
});

test("the first step costs half the XP, the rest nothing more", () => {
	assert.equal(helpPrice("form", [], false), "half XP");
	assert.equal(helpPrice("form", ["translation"], false), "no extra cost");
	assert.equal(helpPrice("form", [], true), "no extra cost");
	assert.equal(helpPrice("form", ["form"], false), "used");
	assert.equal(firstLetterOf(" dážď"), "d");
	assert.equal(firstLetterOf("Ёлка"), "Ё");
});

test("a card never shows a sentence another item in the same plan asks about", () => {
	const example = (before: string, word: string, after: string) => ({ before, word, after, en: "(en)" });
	const items = [
		{
			sentence: "Počúvam dážď.",
			card: { examples: [example("Bez ", "dažďa", " niet úrody."), example("Dážď mi zabránil ", "ísť", " von.")] },
		},
		{ sentence: "bez dažďa niet úrody", card: { examples: [] } },
	];
	const [first, second] = cardsWithoutOtherSentences(items);
	assert.deepEqual(
		first!.card.examples.map((ex) => ex.before + ex.word + ex.after),
		["Dážď mi zabránil ísť von."],
	);
	assert.deepEqual(second!.card.examples, []);
});
