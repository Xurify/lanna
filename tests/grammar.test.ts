/**
 * GRAMMAR ATLAS PINS (LangHarness, phase 4; first tries 2026-10-31): the 6 × 3
 * table, the mapping (A-fem → acc-fem, A-masc → acc-people, one drill per
 * case for G, D, L, I), every mapped id a real unit, each cell's first-try
 * accuracy = right / tries from its gender column, and "not yet" with no
 * first tries or no drill.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ATLAS_CASES, ATLAS_GENDERS, atlasCellOf, atlasUnit, caseDrill, genderColumn, grammarAtlas, slipLine } from "../src/core/grammar.ts";
import { UNITS, unitInfo } from "../src/core/lesson.ts";

const cell = (atlas: ReturnType<typeof grammarAtlas>, row: string, col: string) => atlas.find((c) => c.row === row && c.col === col)!;

test("the atlas is six cases by three genders, in order", () => {
	assert.deepEqual(ATLAS_CASES.map((c) => c.case), ["N", "G", "D", "A", "L", "I"]);
	assert.deepEqual(ATLAS_GENDERS.map((g) => g.id), ["masc", "fem", "neut"]);
	assert.equal(grammarAtlas({}).length, 18);
});

test("the mapping, pinned cell by cell: A-fem → acc-fem, A-masc → acc-people, one drill per case for G, D, L, I", () => {
	assert.equal(atlasUnit("A", "fem"), "acc-fem");
	assert.equal(atlasUnit("A", "masc"), "acc-people");
	assert.equal(atlasUnit("A", "neut"), null);
	for (const [row, unit] of [["G", "gen"], ["D", "dat"], ["L", "loc"], ["I", "ins"]] as const) {
		for (const g of ATLAS_GENDERS) assert.equal(atlasUnit(row, g.id), unit, `${row} ${g.id}`);
	}
	for (const g of ATLAS_GENDERS) assert.equal(atlasUnit("N", g.id), null, `N ${g.id} has no drill`);
});

test("every mapped id exists in UNITS, so no mapped cell collapses to not-yet", () => {
	const ids = new Set(UNITS.map((u) => u.id));
	for (const row of ATLAS_CASES) {
		for (const g of ATLAS_GENDERS) {
			const unit = atlasUnit(row.case, g.id);
			if (unit) assert.ok(ids.has(unit), `${unit} (${row.case} ${g.id}) is not a unit`);
		}
	}
	assert.equal(grammarAtlas({}).filter((c) => c.unit === null).length, 4, "exactly N × 3 and A-neut are not yet");
});

test("a cell with no drill carries no record, and names no unit", () => {
	for (const c of grammarAtlas({})) {
		if (c.unit) assert.equal(unitInfo(c.unit).id, c.unit);
		else assert.equal(c.accuracy, null);
	}
});

test("each cell's accuracy is its first tries right / tries, from its own gender column", () => {
	const units = {
		"acc-fem": { byGender: { fem: { reps: 10, right: 8, accents: 1, slips: { "same-word": 2 } } } },
		gen: { byGender: { masc: { reps: 4, right: 1, accents: 0, slips: { base: 3 } }, neut: { reps: 2, right: 2, accents: 0, slips: {} } } },
	};
	const atlas = grammarAtlas(units);
	assert.equal(cell(atlas, "A", "fem").accuracy, 0.8);
	assert.equal(cell(atlas, "A", "fem").reps, 10);
	assert.equal(cell(atlas, "A", "fem").right, 8);
	assert.equal(cell(atlas, "A", "fem").accents, 1);
	assert.deepEqual(cell(atlas, "A", "fem").slips, { "same-word": 2 });
	assert.equal(cell(atlas, "G", "masc").accuracy, 0.25);
	assert.deepEqual(cell(atlas, "G", "masc").slips, { base: 3 });
	assert.equal(cell(atlas, "G", "neut").accuracy, 1);
	assert.equal(cell(atlas, "G", "fem").accuracy, null, "genitive feminine has no first tries yet");
});

test("zero first tries, a missing record, a gender with no column or a drill with no cell all read not yet", () => {
	const zero = grammarAtlas({ "acc-fem": { byGender: { fem: { reps: 0, right: 0, accents: 0, slips: {} } } } });
	assert.equal(cell(zero, "A", "fem").accuracy, null);
	assert.equal(cell(zero, "A", "fem").reps, 0);
	for (const c of grammarAtlas({})) assert.equal(c.accuracy, null);
	// acc-fem fills only the feminine A cell: its masculine tally has no cell.
	const wrongColumn = grammarAtlas({ "acc-fem": { byGender: { masc: { reps: 5, right: 5, accents: 0, slips: {} } } } });
	assert.equal(cell(wrongColumn, "A", "masc").accuracy, null, "A-masc is acc-people, not acc-fem");
	assert.equal(cell(wrongColumn, "N", "fem").accuracy, null, "nominative has no drill");
});

test("Speak slips show on their cell, apart from its accuracy", () => {
	const atlas = grammarAtlas({ gen: { byGender: { fem: { reps: 0, right: 0, accents: 0, slips: {}, spoken: { base: 2 } } } } });
	const c = cell(atlas, "G", "fem");
	assert.equal(c.accuracy, null);
	assert.deepEqual(c.spoken, { base: 2 });
});

test("a word's gender picks its column, and a drill with a gender picks the cell", () => {
	assert.equal(genderColumn("masculine-animate"), "masc");
	assert.equal(genderColumn("masculine-inanimate"), "masc");
	assert.equal(genderColumn("feminine"), "fem");
	assert.equal(genderColumn("neuter"), "neut");
	assert.equal(genderColumn("plural-only"), null);
	assert.equal(genderColumn(undefined), null);
	assert.deepEqual(atlasCellOf("gen", "feminine"), { row: "G", col: "fem" });
	assert.deepEqual(atlasCellOf("acc-people", "masculine-animate"), { row: "A", col: "masc" });
	assert.equal(atlasCellOf("acc-fem", "masculine-inanimate"), null, "acc-fem has no masculine cell");
	assert.equal(atlasCellOf("gen", undefined), null, "a word with no gender (a place) fills no cell");
	assert.equal(atlasCellOf("kam-kde", "feminine"), null, "a place or a direction is not one case");
	assert.equal(atlasCellOf("present", "feminine"), null);
});

test("a drill maps to its case, and only the case drills have one", () => {
	assert.equal(caseDrill("gen"), "G");
	assert.equal(caseDrill("acc-people"), "A");
	assert.equal(caseDrill("acc-fem"), "A");
	assert.equal(caseDrill("kam-kde"), null);
	assert.equal(caseDrill("present"), null);
});

test("the slip line names each slip with its count, most frequent first", () => {
	assert.equal(slipLine({}), "");
	assert.equal(slipLine({ "same-word": 1, base: 2 }), "dictionary form, no ending (2) · wrong ending (1)");
});

test("the core barrel exposes the atlas", async () => {
	const core = await import("../src/core/index.ts");
	assert.equal(core.grammarAtlas, grammarAtlas);
	assert.equal(core.atlasUnit, atlasUnit);
});
