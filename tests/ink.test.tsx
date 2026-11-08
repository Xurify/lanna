import React from "react";
(globalThis as Record<string, unknown>).React = React;

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseSketch, sketchStages, sketchSummary } from "@/components/lesson/case-sketch";
import { PenUnderline } from "@/components/lesson/ink";
import { arrowD, boxD, inkRandom, lineD, loopD, patchD, smoothD } from "@/components/lesson/ink-paths";

const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("ink paths", () => {
	it("the same seed draws the same stroke, a new seed a different one", () => {
		assert.equal(lineD([0, 0], [100, 0], 4), lineD([0, 0], [100, 0], 4));
		assert.notEqual(lineD([0, 0], [100, 0], 4), lineD([0, 0], [100, 0], 5));
		const first = inkRandom(9);
		const second = inkRandom(9);
		assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
	});

	it("every builder returns finite numbers only", () => {
		const paths = [
			lineD([10, 10], [200, 90], 1),
			boxD(10, 10, 60, 40, 2),
			loopD(100, 60, 30, 20, 3),
			patchD(100, 60, 30, 20, 4),
			smoothD([[0, 0], [10, 20], [30, 10]]),
			smoothD([[0, 0], [10, 20], [30, 10]], true),
			arrowD([10, 10], [200, 90], 5, 8).shaft,
			arrowD([10, 10], [200, 90], 5, 8).head,
		];
		for (const d of paths) {
			assert.ok(d.startsWith("M"), d);
			assert.ok(numbers(d).every(Number.isFinite), d);
		}
	});

	it("a straight stroke stays near the line it was asked for", () => {
		const [x1, y1, , , x2, y2] = numbers(lineD([0, 50], [200, 50], 6));
		assert.ok(Math.abs(x1!) < 4 && Math.abs(x2! - 200) < 4);
		assert.ok(Math.abs(y1! - 50) < 2 && Math.abs(y2! - 50) < 2);
	});

	it("an arrow is a shaft and a two-stroke head", () => {
		const { shaft, head } = arrowD([0, 0], [100, 0], 7);
		assert.equal((shaft.match(/M/g) ?? []).length, 1);
		assert.equal((head.match(/Q/g) ?? []).length, 2);
	});
});

describe("case sketches in ink", () => {
	const units = ["gen", "loc", "ins", "dat", "acc-people", "acc-fem"] as const;

	it("every stage of every unit draws strokes that animate and a sheet with the ink filter", () => {
		for (const unit of units) {
			const stages = sketchStages(unit);
			assert.ok(stages.length > 0, unit);
			stages.forEach((_, stage) => {
				const html = renderToStaticMarkup(<CaseSketch unit={unit} stage={stage} />);
				assert.match(html, /<svg[^>]*viewBox="0 0 340 132"/, `${unit} ${stage}`);
				assert.match(html, /<feDisplacementMap/, `${unit} ${stage}`);
				assert.ok((html.match(/class="ink-draw/g) ?? []).length >= 1, `${unit} ${stage} has pen strokes`);
				assert.ok(html.includes("pathLength=\"1\""), `${unit} ${stage}`);
				assert.ok(!/NaN|undefined/.test(html), `${unit} ${stage}`);
			});
		}
	});

	it("the drawing is the same markup every time, so the server and the client agree", () => {
		const draw = () => renderToStaticMarkup(<CaseSketch unit="gen" stage={0} />);
		assert.equal(draw().replace(/ink-[a-zA-Z0-9_]+/g, "ink-id"), draw().replace(/ink-[a-zA-Z0-9_]+/g, "ink-id"));
	});

	it("an unknown stage draws nothing", () => {
		assert.equal(renderToStaticMarkup(<CaseSketch unit="gen" stage={99} />), "");
	});

	it("the pen underline stretches to the word and draws itself", () => {
		const html = renderToStaticMarkup(<PenUnderline />);
		assert.match(html, /preserveAspectRatio="none"/);
		assert.match(html, /class="ink-draw/);
	});
});

describe("what the walk-through teaches", () => {
	const units = ["gen", "loc", "ins", "dat", "acc-people", "acc-fem"] as const;
	const WHO = ["masculine person or animal", "masculine thing", "feminine", "feminine, ends in a consonant", "neuter"];

	it("every case with all three genders shows each gender in its steps", () => {
		for (const unit of ["gen", "loc", "ins", "dat"] as const) {
			const genders = new Set(sketchStages(unit).map((s) => s.gender));
			assert.deepEqual([...genders].sort(), ["feminine", "masculine", "neuter"], unit);
		}
	});

	it("each step changes its word: the form after the cue is not the dictionary form", () => {
		for (const unit of units) {
			for (const s of sketchStages(unit)) {
				assert.ok(s.ending.length > 0, s.dictionary);
				assert.notEqual(s.base + s.ending, s.dictionary, s.dictionary);
				assert.ok(s.meaning.length > 0 && s.cue.length > 0 && s.why.length > 0, s.dictionary);
			}
		}
	});

	it("the summary is a table with one row for each kind of word", () => {
		for (const unit of units) {
			const summary = sketchSummary(unit)!;
			assert.deepEqual(summary.rows.map((r) => r.who), WHO, unit);
			for (const row of summary.rows) assert.ok(row.stem.length > 0 && row.from.length > 0, `${unit} ${row.who}`);
		}
	});
});
