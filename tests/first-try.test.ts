/**
 * FIRST-TRY PINS (LangHarness, 2026-10-31): what counts as a first try
 * (a form rep's first answer, unaided, the first ask of the sentence), how
 * a tally steps, and how a Speak correction becomes a slip on a case
 * drill. Pure core: no data dir, no network.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	addFirstTry,
	addSpokenSlip,
	countsAsFirstTry,
	emptyTally,
	firstTryAccuracy,
	firstTryOf,
	recordFirstTry,
	recordSpokenSlip,
	spokenSlip,
	type FirstTryStats,
} from "../src/core/first-try.ts";
import type { LexiconEntry } from "../src/core/review.ts";

/** The dictionary's stanica entry, as the lexicon carries it. */
const stanica: LexiconEntry = {
	slug: "stanica",
	sk: "stanica",
	en: "station",
	cat: "Nouns",
	gender: "feminine",
	forms: ["stanice", "stanici", "stanicu", "stanicou", "staniciam", "staniciach", "stanicami"],
	examples: [],
	related: [],
};

/** "Ako ďaleko je to od stanice?" as a typed genitive rep. */
const genRep = { kind: "type", unit: "gen", answer: "stanice", entry: stanica };

test("a tally steps by verdict; a wrong one without a slip counts as other", () => {
	let t = emptyTally();
	t = addFirstTry(t, "exact");
	t = addFirstTry(t, "accents");
	t = addFirstTry(t, "wrong", "base");
	t = addFirstTry(t, "wrong");
	assert.deepEqual(t, { reps: 4, right: 2, accents: 1, slips: { base: 1, other: 1 } });
	assert.equal(firstTryAccuracy(t), 0.5);
});

test("a spoken slip counts apart: no reps beside it, so no accuracy", () => {
	const t = addSpokenSlip(addSpokenSlip(emptyTally(), "base"), "same-word");
	assert.deepEqual(t.spoken, { base: 1, "same-word": 1 });
	assert.equal(t.reps, 0);
	assert.equal(firstTryAccuracy(t), null, "no first tries, never a percentage");
	assert.equal(firstTryAccuracy(undefined), null);
});

test("what counts: a form rep's first answer, unaided, the first ask of the sentence", () => {
	const first = { given: "x", verdict: "wrong" as const };
	assert.equal(countsAsFirstTry({ kind: "type", first }), true);
	assert.equal(countsAsFirstTry({ kind: "choose", first }), true);
	assert.equal(countsAsFirstTry({ kind: "listen", first }), true);
	assert.equal(countsAsFirstTry({ kind: "meaning", first }), false, "a meaning check tests the sentence");
	assert.equal(countsAsFirstTry({ kind: "build", first }), false, "a word bank tests the order");
	assert.equal(countsAsFirstTry({ kind: "type", first, again: true }), false, "the end-of-lesson retry is a second ask");
	assert.equal(countsAsFirstTry({ kind: "type", first: { ...first, peeked: true } }), false, "a peek is a priced hint");
	assert.equal(countsAsFirstTry({ kind: "type" }), false, "no first answer, nothing to count");
});

test("firstTryOf: the drill, the cell, the verdict, the slip", () => {
	const wrong = firstTryOf({ ...genRep, first: { given: "stanica", verdict: "wrong" } });
	assert.deepEqual(wrong, { unit: "gen", cell: { row: "G", col: "fem" }, verdict: "wrong", slip: "base" });
	const wrongCase = firstTryOf({ ...genRep, first: { given: "stanicu", verdict: "wrong" } });
	assert.equal(wrongCase?.slip, "same-word");
	assert.deepEqual(firstTryOf({ ...genRep, first: { given: "stanice", verdict: "exact" } }), { unit: "gen", cell: { row: "G", col: "fem" }, verdict: "exact" });
	assert.equal(firstTryOf({ ...genRep, kind: "meaning", first: { given: "x", verdict: "exact" } }), null);
	assert.equal(firstTryOf({ ...genRep, first: { given: "stanica", verdict: "wrong", peeked: true } }), null);
	assert.equal(firstTryOf({ ...genRep, again: true, first: { given: "stanica", verdict: "wrong" } }), null);
});

test("firstTryOf: a place has no gender — the try counts, but fills no atlas cell", () => {
	const bratislava: LexiconEntry = { slug: "bratislava", sk: "Bratislava", en: "Bratislava", cat: "Places", examples: [], related: [] };
	const p = firstTryOf({ kind: "type", unit: "loc", answer: "Bratislave", entry: bratislava, first: { given: "Bratislava", verdict: "wrong" } });
	assert.deepEqual(p, { unit: "loc", cell: null, verdict: "wrong", slip: "base" });
});

test("recordFirstTry steps the unit and its gender column; the input is left alone", () => {
	const start: FirstTryStats = {};
	const once = recordFirstTry(start, { unit: "gen", cell: { row: "G", col: "fem" }, verdict: "wrong", slip: "base" });
	assert.equal(start.first, undefined, "a new record, not a mutation");
	assert.deepEqual(once.first, { reps: 1, right: 0, accents: 0, slips: { base: 1 } });
	assert.deepEqual(once.byGender?.fem, { reps: 1, right: 0, accents: 0, slips: { base: 1 } });
	const twice = recordFirstTry(once, { unit: "gen", cell: { row: "G", col: "fem" }, verdict: "exact" });
	assert.equal(twice.first?.reps, 2);
	assert.equal(twice.byGender?.fem?.right, 1);
	// No cell (a place): the unit counts, the columns stay as they were.
	const noCell = recordFirstTry(once, { unit: "loc", cell: null, verdict: "exact" });
	assert.equal(noCell.first?.right, 1);
	assert.equal(noCell.byGender?.fem?.reps, 1, "untouched");
});

test("recordSpokenSlip steps the spoken tally on the unit and the cell", () => {
	const s = recordSpokenSlip<FirstTryStats>({}, { row: "A", col: "fem" }, "base");
	assert.deepEqual(s.first?.spoken, { base: 1 });
	assert.deepEqual(s.byGender?.fem?.spoken, { base: 1 });
	assert.equal(s.first?.reps ?? 0, 0, "no first tries beside it");
});

test("spokenSlip: the word of the corrected line the learner did not say, against the dictionary", () => {
	const hit = spokenSlip(stanica, "Ako ďaleko je to od stanica?", "Ako ďaleko je to od stanice?");
	assert.deepEqual(hit, { drill: "gen", slip: "base" });
	const wrongCase = spokenSlip(stanica, "Ako ďaleko je to od stanicu?", "Ako ďaleko je to od stanice?");
	assert.deepEqual(wrongCase, { drill: "gen", slip: "same-word" });
	assert.equal(spokenSlip(stanica, "Ako ďaleko je to od stanice?", "Ako ďaleko je to od stanice?"), undefined, "said right: no slip");
	// A word whose initial letter has a diacritic (škola -> školy, spoken without háček as skola).
	const skola: LexiconEntry = { slug: "skola", sk: "škola", en: "school", cat: "Nouns", gender: "feminine", forms: ["školy", "škole", "školu"], examples: [], related: [] };
	const diacriticSlip = spokenSlip(skola, "Idem do skola.", "Idem do školy.");
	assert.deepEqual(diacriticSlip, { drill: "gen", slip: "base" });
});

test("spokenSlip: a verb form is not a case slip", () => {
	const robit: LexiconEntry = { slug: "robit", sk: "robiť", en: "do", cat: "Verbs", forms: ["robím", "robíš", "robí"], examples: [], related: [] };
	assert.equal(spokenSlip(robit, "Ja robit doma.", "Ja robím doma."), undefined, "the present is a drill, but no case drill");
});
