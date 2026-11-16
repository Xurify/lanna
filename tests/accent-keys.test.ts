/**
 * ACCENT KEYS (2026-11-11): the special letters are grouped by
 * their plain letter, and a key changes the letter before the caret when it
 * is the same letter, so "c" then "č" gives "č".
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { belongsToLayoutAccent, letterFamilies, liveFamily, pressLetter } from "../src/core/accent-keys.ts";

const SLOVAK = ["á", "ä", "č", "ď", "é", "í", "ĺ", "ľ", "ň", "ó", "ô", "ŕ", "š", "ť", "ú", "ý", "ž"];
const RUSSIAN = ["ё", "й", "ъ", "ы", "ь", "э"];

test("Slovak letters fall into fourteen families, in the order they come", () => {
	const families = letterFamilies(SLOVAK, "sk-SK");
	assert.equal(families.length, 14);
	assert.deepEqual(families[0], { base: "a", letters: ["á", "ä"] });
	assert.deepEqual(
		families.find((f) => f.base === "l"),
		{ base: "l", letters: ["ĺ", "ľ"] },
	);
	assert.deepEqual(
		families.find((f) => f.base === "o"),
		{ base: "o", letters: ["ó", "ô"] },
	);
});

test("Cyrillic letters with a mark group under their plain letter; the rest stand alone", () => {
	const families = letterFamilies(RUSSIAN, "ru-RU");
	assert.deepEqual(
		families.map((f) => f.base),
		["е", "и", "ъ", "ы", "ь", "э"],
	);
});

test("a key changes the plain letter before the caret, and keeps its case", () => {
	assert.deepEqual(pressLetter("c", 1, 1, "č", false, "sk-SK"), { value: "č", caret: 1 });
	assert.deepEqual(pressLetter("Zena", 1, 1, "ž", false, "sk-SK"), { value: "Žena", caret: 1 });
	assert.deepEqual(pressLetter("má", 2, 2, "ä", false, "sk-SK"), { value: "mä", caret: 2 });
});

test("a key types its letter when the letter before the caret is another one, or nothing", () => {
	assert.deepEqual(pressLetter("do", 2, 2, "č", false, "sk-SK"), { value: "doč", caret: 3 });
	assert.deepEqual(pressLetter("", 0, 0, "č", true, "sk-SK"), { value: "Č", caret: 1 });
	assert.deepEqual(pressLetter("a ", 2, 2, "á", false, "sk-SK"), { value: "a á", caret: 3 });
});

test("a selection is replaced by the letter, never merged with the letter before it", () => {
	assert.deepEqual(pressLetter("caxt", 2, 3, "č", false, "sk-SK"), { value: "cačt", caret: 3 });
});

test("the live family is the one of the letter just before the caret", () => {
	const families = letterFamilies(SLOVAK, "sk-SK");
	assert.equal(liveFamily(families, "zen", 1, 1, "sk-SK"), "z");
	assert.equal(liveFamily(families, "zen", 3, 3, "sk-SK"), "n");
	assert.equal(liveFamily(families, "dom", 3, 3, "sk-SK"), null);
	assert.equal(liveFamily(families, "c ", 2, 2, "sk-SK"), null);
	assert.equal(liveFamily(families, "cc", 0, 2, "sk-SK"), null);
});

test("the same letter twice is typed twice, so Estonian doubles stay possible", () => {
	assert.deepEqual(pressLetter("tö", 2, 2, "ö", false, "et-EE"), { value: "töö", caret: 3 });
	assert.deepEqual(pressLetter("jä", 2, 2, "ä", false, "et-EE"), { value: "jää", caret: 3 });
	assert.deepEqual(pressLetter("to", 2, 2, "ö", false, "et-EE"), { value: "tö", caret: 2 });
});

test("Cyrillic letters are never changed into one another: е then ё is её, и then й is ий", () => {
	assert.deepEqual(pressLetter("е", 1, 1, "ё", false, "ru-RU"), { value: "её", caret: 2 });
	assert.deepEqual(pressLetter("русски", 6, 6, "й", false, "ru-RU"), { value: "русский", caret: 7 });
	const families = letterFamilies(RUSSIAN, "ru-RU");
	assert.equal(liveFamily(families, "и", 1, 1, "ru-RU"), null);
});

test("a family lights up only when one of its keys would change the letter", () => {
	const families = letterFamilies(["ä", "ö", "õ", "ü", "š", "ž"], "et-EE");
	assert.equal(liveFamily(families, "o", 1, 1, "et-EE"), "o");
	assert.equal(liveFamily(families, "ö", 1, 1, "et-EE"), "o", "õ would change it");
	assert.equal(liveFamily(families, "ä", 1, 1, "et-EE"), null, "ä is the family's only letter");
});

test("a dead key or a key inside a composition belongs to the learner's layout", () => {
	assert.equal(belongsToLayoutAccent({ key: "Dead", isComposing: false, keyCode: 192 }), true, "Estonian ˇ left of 1");
	assert.equal(belongsToLayoutAccent({ key: "c", isComposing: true, keyCode: 67 }), true, "the letter after it");
	assert.equal(belongsToLayoutAccent({ key: "Process", isComposing: false, keyCode: 229 }), true);
	assert.equal(
		belongsToLayoutAccent({ key: "`", isComposing: false, keyCode: 192 }),
		false,
		"US ` still opens the Keyboard",
	);
	assert.equal(
		belongsToLayoutAccent({ key: ";", isComposing: false, keyCode: 192 }),
		false,
		"Slovak ; still opens the Keyboard",
	);
});
