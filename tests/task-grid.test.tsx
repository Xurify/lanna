import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { TaskGrid } from "../components/lesson/task-grid.tsx";
import { aspectTasks } from "../src/core/aspect-tasks.ts";
import { PAIRS } from "../src/core/pairs.ts";
import type { LessonTask, UnitId } from "../src/core/lesson.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const entries = (JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] }).words;

/** The first grid task of the plans chapter, with its cells. */
function firstGrid(): Extract<LessonTask, { kind: "grid" }> {
	const task = aspectTasks(entries, PAIRS, "pairs-plans" as UnitId, 5).find((i) => i.task?.kind === "grid")?.task;
	assert.ok(task && task.kind === "grid", "a grid task exists");
	return task;
}

describe("the grid task (N1): the forms are hidden until the rep is answered", () => {
	it("before the answer: the labels show, every cell is empty, and no form or note is in the page", () => {
		const task = firstGrid();
		const html = renderToStaticMarkup(<TaskGrid task={task} revealed={false} />);
		assert.ok(html.includes('data-revealed="false"'));
		for (const row of task.rows) assert.ok(html.includes(`>${row}<`), `the ${row} label shows`);
		for (const col of task.cols) assert.ok(html.includes(`>${col}<`), `the ${col} label shows`);
		assert.equal((html.match(/empty cell/g) ?? []).length, 6, "six empty cells");
		for (const cell of task.cells) {
			if (cell.form) assert.ok(!html.includes(cell.form), `${cell.form} is hidden before the answer`);
			if (cell.note) assert.ok(!html.includes(cell.note), `the note "${cell.note}" waits for the answer`);
		}
		assert.ok(!html.includes("data-asked"), "the asked cell is not marked before the answer");
	});

	it("after the answer: every cell shows its form and note, and the asked cell is marked", () => {
		const task = firstGrid();
		const html = renderToStaticMarkup(<TaskGrid task={task} revealed={true} />);
		assert.ok(html.includes('data-revealed="true"'));
		assert.ok(!html.includes("empty cell"));
		for (const cell of task.cells) {
			if (cell.form) assert.ok(html.includes(`>${cell.form}</span>`), `${cell.form} shows`);
			if (cell.note) assert.ok(html.includes(cell.note), `the note "${cell.note}" shows`);
		}
		assert.equal((html.match(/data-asked="true"/g) ?? []).length, 1, "exactly one cell is marked");
	});

	it("the perfective future is the one cell with no form, and it says so only once answered", () => {
		const task = firstGrid();
		const hidden = renderToStaticMarkup(<TaskGrid task={task} revealed={false} />);
		const shown = renderToStaticMarkup(<TaskGrid task={task} revealed={true} />);
		assert.ok(!hidden.includes("no such form"));
		assert.match(shown, /no such form: the perfective future is the present form/);
	});
});
