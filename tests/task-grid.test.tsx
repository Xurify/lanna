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

/** The opening tags of every table cell and header, without the per-cell marker. */
function cellTags(html: string): string[] {
	return [...html.matchAll(/<(td|th)\b[^>]*>/g)].map((m) => m[0].replace(/ data-asked="true"/, ""));
}

describe("the grid task (N1, N7, N8): the forms are hidden until answered, and the layout does not move", () => {
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
		assert.ok(!html.includes("text-teal-2"), "no teal before the answer");
	});

	it("after the answer: every cell shows its form, the notes sit in the caption, and the asked cell is marked", () => {
		const task = firstGrid();
		const html = renderToStaticMarkup(<TaskGrid task={task} revealed={true} />);
		assert.ok(html.includes('data-revealed="true"'));
		assert.ok(!html.includes("empty cell"));
		for (const cell of task.cells) {
			if (cell.form) assert.ok(html.includes(`>${cell.form}</span>`), `${cell.form} shows`);
		}
		const caption = html.match(/data-testid="task-grid-caption"[^>]*>([^<]*)</)?.[1] ?? "";
		for (const cell of task.cells) if (cell.note) assert.ok(caption.includes(cell.note), `the note "${cell.note}" is in the caption`);
		assert.equal((html.match(/data-asked="true"/g) ?? []).length, 1, "exactly one cell is marked");
	});

	it("the asked cell is marked by weight, the teal token and an underline (E33), and by nothing else", () => {
		const task = firstGrid();
		const html = renderToStaticMarkup(<TaskGrid task={task} revealed={true} />);
		const askedForm = html.match(/<span class="([^"]*)" lang="sk">([^<]*)<\/span><\/td>/g)?.find((x) => x.includes("text-teal-2"));
		assert.ok(askedForm, "the asked form is teal");
		assert.match(askedForm!, /font-bold/, "bold");
		assert.match(askedForm!, /underline decoration-2 underline-offset-\[7px\]/, "a straight underline, offset 7 px");
		assert.equal((html.match(/text-teal-2/g) ?? []).length, 1, "only the asked form is teal");
	});

	it("the same table and cell classes in both states: nothing that is not content changes the layout", () => {
		const task = firstGrid();
		const hidden = cellTags(renderToStaticMarkup(<TaskGrid task={task} revealed={false} />));
		const shown = cellTags(renderToStaticMarkup(<TaskGrid task={task} revealed={true} />));
		assert.deepEqual(shown, hidden, "every td and th has the same classes");
		const html = renderToStaticMarkup(<TaskGrid task={task} revealed={false} />);
		assert.match(html, /table-fixed/, "a fixed table: the columns do not follow the content");
		assert.equal((html.match(/<col /g) ?? []).length, 3, "one label column and two equal aspect columns (the tenses are the rows)");
		for (const row of task.rows) assert.ok(html.includes(`>${row}</th>`), `the ${row} column header shows`);
		for (const col of task.cols) assert.ok(html.includes(`>${col}</th>`), `the ${col} row label shows`);
		assert.match(html, /<td class="h-14 /, "every cell is 56 px high");
	});

	it("the forms are 16 px on a phone, and the caption reserves its height in both states", () => {
		const task = firstGrid();
		const hidden = renderToStaticMarkup(<TaskGrid task={task} revealed={false} />);
		const shown = renderToStaticMarkup(<TaskGrid task={task} revealed={true} />);
		assert.match(shown, /text-\[16px\][^"]*sm:text-\[18px\]/, "16 px, 18 px from the small breakpoint");
		assert.match(hidden, /<p class="[^"]*min-h-10[^"]*" data-testid="task-grid-caption"/, "the caption has a reserved height");
		const caption = (html: string) => html.match(/<p class="([^"]*)" data-testid="task-grid-caption"/)?.[1];
		assert.equal(caption(hidden), caption(shown), "the caption has the same classes in both states");
	});

	it("the perfective future is the one cell with no form, and its note is in the caption only once answered", () => {
		const task = firstGrid();
		const hidden = renderToStaticMarkup(<TaskGrid task={task} revealed={false} />);
		const shown = renderToStaticMarkup(<TaskGrid task={task} revealed={true} />);
		assert.ok(!hidden.includes("no such form"));
		assert.match(shown, /no such form: the perfective future is the present form/);
	});
});
