import assert from "node:assert/strict";
import { test } from "node:test";
import { fitPopoverTop, POPOVER_EDGE, POPOVER_GAP } from "../components/words/popover-fit.ts";

test("with room above the word the card goes above it", () => {
	assert.equal(fitPopoverTop(400, 430, 170, 800), 400 - POPOVER_GAP - 170);
});

test("room above wins even when there is room below too", () => {
	assert.equal(fitPopoverTop(500, 530, 170, 900), 500 - POPOVER_GAP - 170);
});

test("a card that only just fits above stays above, at the edge", () => {
	assert.equal(fitPopoverTop(170 + POPOVER_GAP + POPOVER_EDGE, 0, 170, 600), POPOVER_EDGE);
});

test("without room above, the card goes below the word", () => {
	assert.equal(fitPopoverTop(100, 130, 170, 600), 130 + POPOVER_GAP);
});

test("with room on neither side it goes where there is more, inside the window", () => {
	const top = fitPopoverTop(150, 180, 156, 300);
	assert.ok(top >= POPOVER_EDGE && top + 156 <= 300 - POPOVER_EDGE, `top ${top}`);
	assert.equal(fitPopoverTop(60, 90, 300, 320), POPOVER_EDGE, "a card taller than the window starts at the edge");
});
