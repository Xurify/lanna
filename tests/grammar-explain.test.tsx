import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { GrammarExplain } from "../components/lesson/grammar-explain.tsx";
import type { LessonExplain } from "../src/core/lesson.ts";

/** The explanations as curriculum/slovak/mixups.json holds them (the shipped data). */
const families = (
	JSON.parse(fs.readFileSync("curriculum/slovak/mixups.json", "utf-8")) as {
		families: Array<{ id: string; explain?: LessonExplain }>;
	}
).families;
const aspect = families.find((f) => f.id === "aspect")!.explain!;
const thisThat = families.find((f) => f.id === "this-vs-that")!.explain!;

describe("the grammar explanation (static, worked examples; never a drill)", () => {
	it("shows the contrast with its form in bold, and the note", () => {
		const html = renderToStaticMarkup(<GrammarExplain explain={aspect} />);
		assert.ok(html.includes('data-testid="explain-contrast"'));
		assert.ok(html.includes(`>${aspect.contrast.first.form}</b>`), "the imperfective form is bold in its sentence");
		assert.ok(html.includes(aspect.contrast.note));
	});

	it("draws the aspect timeline with its text equivalent beside it, and hides the drawing from screen readers", () => {
		const html = renderToStaticMarkup(<GrammarExplain explain={aspect} />);
		assert.ok(html.includes('data-testid="explain-timeline"'));
		assert.ok(html.includes('aria-hidden="true"'), "the SVG is decorative");
		assert.ok(html.includes(aspect.timeline!.imperfective));
		assert.ok(html.includes(aspect.timeline!.perfective));
	});

	it("lists the three cue points", () => {
		const html = renderToStaticMarkup(<GrammarExplain explain={aspect} />);
		assert.equal((html.match(/<li>/g) ?? []).length, 3);
	});

	it("renders a case grid's 'not yet' cells as text, never filled in; the shipped tento grid has none", () => {
		const gap = {
			...thisThat,
			tables: [{ title: "gap", cols: ["m. sg."], rows: [{ case: "N", cells: ["not yet"] }] }],
		};
		const html = renderToStaticMarkup(<GrammarExplain explain={gap} />);
		assert.ok(html.includes('data-testid="explain-table"'));
		assert.ok(html.includes("not yet"));
		assert.ok(html.includes('<th scope="col"'), "the columns are headers");
		assert.ok(html.includes('<th scope="row"'), "the cases are row headers");
		assert.equal(renderToStaticMarkup(<GrammarExplain explain={thisThat} />).includes("not yet"), false);
	});

	it("links only to an allowlisted slovak.wiki page or section", () => {
		const html = renderToStaticMarkup(<GrammarExplain explain={aspect} />);
		assert.ok(html.includes('href="https://www.slovak.wiki/grammar/aspect#contrasts"'));
		assert.ok(html.includes('rel="noopener noreferrer"'));
		const other = renderToStaticMarkup(<GrammarExplain explain={{ ...aspect, wiki: "https://example.com/aspect" }} />);
		assert.equal(other.includes("href="), false, "a link off the allowlist is not rendered");
	});

	it("marks the Slovak as pending verifier until the verifier signs it off", () => {
		const html = renderToStaticMarkup(<GrammarExplain explain={aspect} />);
		assert.ok(html.includes('data-checked="pending verifier"'));
	});

	it("uses the app's color tokens and no pills, all caps or blur", () => {
		const src = fs.readFileSync("components/lesson/grammar-explain.tsx", "utf-8");
		assert.equal(/backdrop-blur|blur-|rounded-full|uppercase/.test(src), false);
	});
});
