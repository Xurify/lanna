import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Climb } from "@/components/climb";
import { CLIMB_VIEWS, CLIMB_VIEW_COOKIE, resolveClimbView } from "@/lib/climb-view";
import { curriculumState } from "@/src/core";

const noop = () => {};
const render = (view: "chapters" | "mountain", state: ReturnType<typeof curriculumState> | null) =>
	renderToStaticMarkup(
		createElement(Climb, { view, mode: "full", state, goalLevel: "B2", onTutor: noop, onScene: noop }),
	);

describe("the climb's two views", () => {
	it("has two real-word options and Chapters is the default", () => {
		assert.deepEqual(
			CLIMB_VIEWS.map((v) => v.label),
			["Chapters", "Mountain"],
		);
		assert.equal(resolveClimbView(undefined, undefined), "chapters");
	});

	it("the URL wins over the saved choice, and a bad value falls back", () => {
		assert.equal(resolveClimbView("mountain", "chapters"), "mountain");
		assert.equal(resolveClimbView(["chapters"], "mountain"), "chapters");
		assert.equal(resolveClimbView(undefined, "mountain"), "mountain");
		assert.equal(resolveClimbView("nonsense", "nonsense"), "chapters");
	});

	it("an old saved value still works: path was the list", () => {
		assert.equal(resolveClimbView("path", undefined), "chapters");
		assert.equal(resolveClimbView(undefined, "path"), "chapters");
	});

	it("the choice is saved in a cookie the server reads, with a safe fallback", () => {
		const src = fs.readFileSync("lib/climb-view.ts", "utf8");
		assert.ok(src.includes(CLIMB_VIEW_COOKIE));
		assert.ok(/try\s*{[\s\S]*document\.cookie[\s\S]*catch/.test(src));
		assert.ok(fs.readFileSync("app/curriculum/page.tsx", "utf8").includes("resolveClimbView"));
	});

	it("both views draw the same chapters and the same unit actions from the same data", () => {
		const state = curriculumState({});
		const path = render("chapters", state);
		const chapters = render("mountain", state);
		assert.ok(path.includes('data-view="chapters"'));
		assert.ok(chapters.includes('data-view="mountain"'));
		for (const ch of state.chapters) {
			assert.ok(path.includes(`data-testid="chapter-${ch.id}"`), `path lacks ${ch.id}`);
			assert.ok(chapters.includes(`data-testid="chapter-${ch.id}"`), `chapters lacks ${ch.id}`);
			assert.ok(chapters.includes(`data-testid="climb-stage-${ch.stage}"`), `the mountain lacks ${ch.stage}`);
		}
		const current = state.chapters.find((c) => c.id === state.current)!;
		assert.ok(path.includes(`climb-units-${current.id}`));
		assert.ok(chapters.includes(`climb-units-${current.id}`));
	});

	it("the mountain view lists the highest level first", () => {
		const html = render("mountain", curriculumState({}));
		assert.ok(html.indexOf('data-testid="stage-b2"') < html.indexOf('data-testid="stage-a1"'));
	});

	it("loading and empty states keep the shape of the page", () => {
		assert.ok(render("chapters", null).includes("climb-loading"));
		assert.ok(render("mountain", null).includes("climb-loading"));
		assert.ok(render("mountain", { ...curriculumState({}), chapters: [] }).includes("climb-empty"));
	});

	it("the switcher is a tab list with arrow-key support", () => {
		const src = fs.readFileSync("components/curriculum-page.tsx", "utf8");
		for (const needle of [
			'role="tablist"',
			'role="tab"',
			"aria-selected",
			'role="tabpanel"',
			"ArrowRight",
			"ArrowLeft",
			"saveClimbView",
		])
			assert.ok(src.includes(needle), needle);
	});
});
