import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AddingRow } from "../components/language-switcher.tsx";
import type { FeedTask } from "../components/activity-dock.tsx";

// A language still being added is listed in the language menu the way a
// set-up one is, with a loading mark and no build step. (2026-11-05)

function adding(over: Partial<FeedTask> = {}): FeedTask {
	return {
		id: "language:estonian",
		kind: "language",
		title: "Adding Estonian",
		step: "Writing the story world",
		status: "running",
		startedAt: Date.now(),
		language: { id: "estonian", english: "Estonian" },
		...over,
	};
}

describe("a language being added, in the language menu", () => {
	it("is listed like a set-up language, with a loading mark and no build step", () => {
		const html = renderToStaticMarkup(<AddingRow task={adding()} />);
		assert.match(html, /data-country-code="EE"/, "the flag is still there");
		assert.match(html, />Eesti</, "the endonym, as in the other rows");
		assert.match(html, />\(Estonian\)</, "the English name in brackets");
		assert.match(html, /animate-spin/, "a loading mark");
		assert.match(html, /Being added/, "a screen reader hears it is being added");
		assert.doesNotMatch(html, /Writing the story world/, "no build step on the row");
		assert.doesNotMatch(html, / · /, "no separator before a step");
	});

	it("falls back to the task title when the task names no language", () => {
		const html = renderToStaticMarkup(<AddingRow task={adding({ language: undefined, title: "Adding something" })} />);
		assert.match(html, /Adding something/);
	});
});
