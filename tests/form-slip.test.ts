/**
 * FORM SLIP PINS (LangHarness, 2026-10-31): a wrong answer on a form drill
 * is named from the word's dictionary form — "base" (the dictionary form
 * where an inflected one was needed: "stanica" for "stanice"), "same-word"
 * (another ending of the same word: "stanicu"), "other" (a different
 * word), "blank" (nothing typed). A right answer, or one short only of an
 * accent, is no slip. Pure core: no data dir, no network.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { FORM_SLIP_LABEL, FORM_SLIPS, formSlip, isFormOf, knownForms } from "../src/core/form-slip.ts";

/** The dictionary's stanica entry, as the lexicon carries it. */
const STANICA_FORMS = ["stanice", "stanici", "stanicu", "stanicou", "staniciam", "staniciach", "stanicami"];

test("knownForms: the verified forms and the declension, without the lemma or phrases", () => {
	const forms = knownForms({
		sk: "stanica",
		forms: ["stanice", "stanica", "na stanici", "stanice"],
		declension: { singular: ["stanica", "stanice", "stanici", "stanicu", "stanici", "stanicou"], plural: ["stanice", "staníc", "staniciam"] },
	});
	assert.ok(forms.includes("stanice") && forms.includes("staníc"), "the declension's forms count");
	assert.ok(!forms.includes("stanica"), "the lemma is not its own form");
	assert.ok(!forms.includes("na stanici"), "a phrase is not a form");
	assert.equal(new Set(forms).size, forms.length, "no duplicates");
});

test("isFormOf: the lemma, a verified form, or the stem with a short ending", () => {
	assert.equal(isFormOf("stanica", "stanica"), true, "the lemma itself");
	assert.equal(isFormOf("stanicami", "stanica", STANICA_FORMS), true, "a verified form");
	assert.equal(isFormOf("stanice", "stanica"), true, "the stem with one letter more, no list needed");
	assert.equal(isFormOf("stanicou", "stanica"), true, "stanic + ou");
	assert.equal(isFormOf("STANICE", "stanica"), true, "case never counts");
	assert.equal(isFormOf("zenou", "žena"), true, "a missing accent is not a different word");
	assert.equal(isFormOf("voda", "stanica"), false, "a different word");
	assert.equal(isFormOf("dome", "dom"), false, "a two-letter stem shares nothing (dom, pes)");
	assert.equal(isFormOf("stanicovych", "stanica"), false, "five letters past the stem is another word");
	assert.equal(isFormOf("", "stanica"), false);
});

test("formSlip: the dictionary form, another ending, another word, nothing", () => {
	const at = { answer: "stanice", lemma: "stanica", forms: STANICA_FORMS };
	assert.equal(formSlip({ ...at, given: "stanica" }), "base", "the case was never applied");
	assert.equal(formSlip({ ...at, given: "Stanica." }), "base", "case and punctuation never count");
	assert.equal(formSlip({ ...at, given: "stanicu" }), "same-word", "the wrong case");
	assert.equal(formSlip({ ...at, given: "stanicami" }), "same-word");
	assert.equal(formSlip({ ...at, given: "vlak" }), "other", "a different word");
	assert.equal(formSlip({ ...at, given: "" }), "blank", `"I don't know"`);
	assert.equal(formSlip({ ...at, given: "   " }), "blank");
	assert.equal(formSlip({ answer: "mäsa", lemma: "mäso", given: "mäso" }), "base", "the dictionary form, diacritics and all");
});

test("formSlip: a right answer — or one short only of an accent — is no slip", () => {
	assert.equal(formSlip({ answer: "stanice", lemma: "stanica", given: "stanice" }), undefined);
	assert.equal(formSlip({ answer: "ženou", lemma: "žena", given: "zenou" }), undefined, "accents-only is its own verdict");
	assert.equal(formSlip({ answer: "mäsa", lemma: "mäso", given: "maso" }), "base", "the dictionary form's letters, minus the accent, still read as the dictionary form");
});

test("every slip has a learner-facing label", () => {
	assert.deepEqual([...FORM_SLIPS], ["base", "same-word", "other", "blank"]);
	for (const s of FORM_SLIPS) assert.ok(FORM_SLIP_LABEL[s].length > 3, s);
});
