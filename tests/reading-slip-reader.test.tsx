/**
 * The reader's slip (creator-hooks proposal 6): a speaker's lines are cut
 * after the slip's line, so its card sits right under it, and the card says
 * what Robo wrote and what it needed (components/reading/reader.tsx).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cutAfter, SlipNote } from "@/components/reading/reader";
import type { StorySlip } from "@/src/core";

const slip: StorySlip = { pair: "kam-vs-kde", sentence: 1, wrong: "kde", right: "kam", wrongSlug: "kde", rightSlug: "kam", rule: "kam asks where TO; kde asks where AT.", speaker: "Robo" };

describe("the reader's slip", () => {
	it("a speaker's lines are cut after the slip's line, so the card follows it", () => {
		const lines = [0, 1, 2, 3].map((index) => ({ index, text: `line ${index}` }));
		assert.deepEqual(cutAfter(lines, 1).map((g) => g.map((l) => l.index)), [[0, 1], [2, 3]]);
	});

	it("nothing is cut when the slip is the speaker's last line, is not theirs, or the episode has none", () => {
		const lines = [0, 1, 2].map((index) => ({ index }));
		assert.deepEqual(cutAfter(lines, 2).map((g) => g.map((l) => l.index)), [[0, 1, 2]]);
		assert.deepEqual(cutAfter(lines, 7).map((g) => g.map((l) => l.index)), [[0, 1, 2]]);
		assert.deepEqual(cutAfter(lines, undefined).map((g) => g.map((l) => l.index)), [[0, 1, 2]]);
	});

	it("the card shows what Robo wrote struck through, what the line needs underlined, and the rule", () => {
		const html = renderToStaticMarkup(createElement(SlipNote, { slip }));
		assert.match(html, /data-testid="read-slip"/);
		assert.match(html, /<s[^>]*>kde<\/s>/);
		assert.match(html, /<u[^>]*>kam<\/u>/);
		assert.ok(html.includes("what Robo wrote"));
		assert.ok(html.includes("kam asks where TO; kde asks where AT."));
	});
});
