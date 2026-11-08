import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { test } from "node:test";
import { SKETCH_UNITS, sketchStages, sketchSummary } from "@/components/lesson/case-sketch";

type CaseKey = "gen" | "dat" | "acc" | "loc" | "ins";

const CASE_OF_UNIT: Record<string, CaseKey> = { gen: "gen", dat: "dat", loc: "loc", ins: "ins", "acc-people": "acc", "acc-fem": "acc" };

/** Forms from the paradigm tables of English Wikipedia "Slovak declension" and the slovak.wiki case pages. */
const FORMS: Record<string, Partial<Record<CaseKey, string>>> = {
	pes: { gen: "psa", dat: "psovi", acc: "psa", loc: "psovi", ins: "psom" },
	brat: { dat: "bratovi", acc: "brata", loc: "bratovi", ins: "bratom" },
	dom: { gen: "domu", dat: "domu", acc: "dom", loc: "dome", ins: "domom" },
	škola: { gen: "školy", dat: "škole", acc: "školu", loc: "škole", ins: "školou" },
	noc: { gen: "noci", dat: "noci", acc: "noc", loc: "noci", ins: "nocou" },
	mesto: { gen: "mesta", dat: "mestu", acc: "mesto", loc: "meste", ins: "mestom" },
	lekár: { gen: "lekára" },
	práca: { gen: "práce" },
	mlieko: { gen: "mlieka" },
	stôl: { loc: "stole" },
	kamarát: { ins: "kamarátom" },
	autobus: { ins: "autobusom" },
	pero: { ins: "perom" },
	mama: { dat: "mame" },
	učiteľ: { acc: "učiteľa" },
	sestra: { acc: "sestru" },
	káva: { acc: "kávu" },
};

test("every sentence in a walk-through ends in the form the paradigm gives", () => {
	for (const unit of SKETCH_UNITS) {
		const grammarCase = CASE_OF_UNIT[unit]!;
		for (const stage of sketchStages(unit)) {
			const expected = FORMS[stage.dictionary]?.[grammarCase];
			assert.ok(expected, `${unit}: ${stage.dictionary} has no ${grammarCase} form in FORMS`);
			assert.equal(stage.base + stage.ending, expected, `${unit}: ${stage.dictionary}`);
		}
	}
});

test("every row of a summary table shows the form the paradigm gives", () => {
	for (const unit of SKETCH_UNITS) {
		const grammarCase = CASE_OF_UNIT[unit]!;
		for (const row of sketchSummary(unit)!.rows) {
			const expected = FORMS[row.from]?.[grammarCase];
			assert.ok(expected, `${unit}: ${row.from} has no ${grammarCase} form in FORMS`);
			assert.equal(row.stem + row.ending, expected, `${unit}: ${row.from}`);
		}
	}
});

test("a rule line names its case, and no learner-facing text uses a term the learner was not given", () => {
	for (const unit of ["gen", "loc", "ins", "dat"] as const) {
		assert.match(sketchSummary(unit)!.calls, /In the \w+, the ending depends on the word’s gender/, unit);
	}
	const texts = SKETCH_UNITS.flatMap((unit) => [...sketchStages(unit).map((s) => s.why), ...(sketchSummary(unit)?.exceptions ? [sketchSummary(unit)!.exceptions!] : [])]);
	for (const text of texts) assert.doesNotMatch(text, /\b(hard noun|soft stem|paradigm|declension pattern)\b|\bmen\b/i, text);
});
