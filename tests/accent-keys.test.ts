/**
 * ACCENT KEYS (LangHarness, 2026-11-11): the special letters are grouped by
 * their plain letter, and a key changes the letter before the caret when it
 * is the same letter, so "c" then "č" gives "č".
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { letterFamilies, liveFamily, pressLetter } from "../src/core/accent-keys.ts";

const SLOVAK = ["á", "ä", "č", "ď", "é", "í", "ĺ", "ľ", "ň", "ó", "ô", "ŕ", "š", "ť", "ú", "ý", "ž"];
const RUSSIAN = ["ё", "й", "ъ", "ы", "ь", "э"];

test("Slovak letters fall into fourteen families, in the order they come", () => {
	const families = letterFamilies(SLOVAK, "sk-SK");
	assert.equal(families.length, 14);
	assert.deepEqual(families[0], { base: "a", letters: ["á", "ä"] });
	assert.deepEqual(families.find((f) => f.base === "l"), { base: "l", letters: ["ĺ", "ľ"] });
	assert.deepEqual(families.find((f) => f.base === "o"), { base: "o", letters: ["ó", "ô"] });
});

test("Cyrillic letters with a mark group under their plain letter; the rest stand alone", () => {
	const families = letterFamilies(RUSSIAN, "ru-RU");
	assert.deepEqual(families.map((f) => f.base), ["е", "и", "ъ", "ы", "ь", "э"]);
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
