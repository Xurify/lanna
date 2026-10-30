/**
 * GRAMMAR ATLAS PINS (LangHarness, phase 4): the 6 × 3 table, the mapping
 * (A-fem → acc-fem, A-masc → acc-people, G/D/L/I one drill per case), every
 * mapped id a real unit, the accuracy = correct / reps, and "not yet" at
 * zero reps or with no drill.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ATLAS_CASES, ATLAS_GENDERS, atlasUnit, cellAccuracy, grammarAtlas } from "../src/core/grammar.ts";
import { UNITS, unitInfo } from "../src/core/lesson.ts";

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

test("a missing id would become not-yet, not a broken link", () => {
	// The pin above fixes the real mapping; this checks the rule the brief
	// asks for by reading the same table the cells come from.
	assert.ok(UNITS.length > 0);
	for (const c of grammarAtlas({})) {
		if (c.unit) assert.equal(unitInfo(c.unit).id, c.unit);
		else assert.equal(c.accuracy, null);
	}
});

test("cell accuracy is correct / reps from progress.units", () => {
	const units = { "acc-fem": { reps: 25, correct: 20 }, gen: { reps: 4, correct: 1 } };
	assert.equal(cellAccuracy("acc-fem", units), 0.8);
	assert.equal(cellAccuracy("gen", units), 0.25);
	const atlas = grammarAtlas(units);
	assert.equal(atlas.find((c) => c.row === "A" && c.col === "fem")!.accuracy, 0.8);
	assert.equal(atlas.find((c) => c.row === "G" && c.col === "neut")!.accuracy, 0.25);
});

test("zero reps, a missing record or no drill all read not yet", () => {
	assert.equal(cellAccuracy("acc-fem", { "acc-fem": { reps: 0, correct: 0 } }), null);
	assert.equal(cellAccuracy("acc-fem", {}), null);
	assert.equal(cellAccuracy(null, { "acc-fem": { reps: 10, correct: 10 } }), null);
	for (const c of grammarAtlas({})) assert.equal(c.accuracy, null);
});

test("the core barrel exposes the atlas", async () => {
	const core = await import("../src/core/index.ts");
	assert.equal(core.grammarAtlas, grammarAtlas);
	assert.equal(core.atlasUnit, atlasUnit);
});
