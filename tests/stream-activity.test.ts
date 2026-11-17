import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toolActivityLabel } from "../src/core/pending.ts";

describe("toolActivityLabel (the live tool card's activity label)", () => {
	it("tools name their actual activity", () => {
		assert.equal(toolActivityLabel("read"), "Reading a file…");
		assert.equal(toolActivityLabel("research"), "Researching…");
	});

	it("the pdf reader has its own label; unknown tools stay generic", () => {
		assert.equal(toolActivityLabel("pdf"), "Reading a PDF…");
		assert.equal(toolActivityLabel("mystery_tool"), "Working…");
	});

	it("a retired question tool is an unknown tool, not a question-writing label", () => {
		assert.equal(toolActivityLabel("quiz"), "Working…");
	});
});
