/**
 * WHAT ADDING A LANGUAGE WILL COST (2026-11-05): priced on the model and
 * thinking level that would write the course, from earlier calls on that
 * same model and level when there are any, and capped so the most is known.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-language-estimate-"));
process.env.LH_DATA_DIR = dir;
fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify({ models: { strong: { model: { provider: "anthropic", id: "claude-opus-5-5" }, thinkingLevel: "medium" } } }));

const { addEstimate, capPlan } = await import("../src/server/language-add.ts");
const { callCost } = await import("../src/server/pricing.ts");

const MODEL = "anthropic:claude-opus-5-5";
const draft = (lang: string, kind: string, level: string, input: number, output: number) => {
	const build = path.join(dir, "languages", lang, "build");
	fs.mkdirSync(build, { recursive: true });
	fs.writeFileSync(path.join(build, `${kind}-draft.json`), JSON.stringify({ calls: [{ model: MODEL, level, usage: { model: MODEL, steps: [{ inputTokens: input, outputTokens: output }] }, createdAt: "2026-11-05T00:00:00Z" }] }));
};

test("before any course: a first guess for that thinking level, and a most fixed by the caps", () => {
	const e = addEstimate()!;
	assert.equal(e.model, MODEL);
	assert.match(e.name, /Opus/);
	assert.equal(e.level, "medium");
	assert.equal(e.measured, 0);
	assert.ok(e.typicalUsd! > 0 && e.typicalUsd! < e.mostUsd!);
	const course = capPlan("course");
	const world = capPlan("world");
	// Medium thinking: 1.5 × the answer plus twice the thinking; a cut answer gets twice that.
	assert.deepEqual(course, { first: 28_000, second: 56_000 });
	assert.deepEqual(world, { first: 20_500, second: 41_000 });
	const most = callCost({ inputTokens: 2 * 3_500, outputTokens: course.first + course.second }, MODEL)! + callCost({ inputTokens: 2 * 1_500, outputTokens: world.first + world.second }, MODEL)!;
	assert.equal(e.mostUsd!.toFixed(6), most.toFixed(6));
});

test("after a course on the same model and level, the typical cost is what it really took; another level does not count", () => {
	draft("czech", "course", "medium", 3_000, 10_000);
	draft("czech", "world", "medium", 1_200, 4_000);
	draft("polish", "course", "high", 9_000, 30_000);
	const e = addEstimate()!;
	assert.equal(e.measured, 1);
	const typical = callCost({ inputTokens: 3_000, outputTokens: 10_000 }, MODEL)! + callCost({ inputTokens: 1_200, outputTokens: 4_000 }, MODEL)!;
	assert.equal(e.typicalUsd!.toFixed(6), typical.toFixed(6));
});

test("a model that once wrote a long answer gets at least twice that room", () => {
	draft("estonian", "course", "medium", 3_000, 30_000);
	assert.deepEqual(capPlan("course"), { first: 60_000, second: 120_000 }, "twice the longest answer, under Opus 5.5's 128,000");
});
