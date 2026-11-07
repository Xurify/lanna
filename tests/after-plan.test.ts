import assert from "node:assert/strict";
import test from "node:test";
import { afterPlan } from "../src/core/after-plan.ts";

test("after the plan, a video that waits comes first", () => {
	const a = afterPlan({ video: { id: "abc", title: "Učíme sa", minutes: 8 }, listensToday: 1, listenMinutes: 4 });
	assert.equal(a.step.kind, "watch");
	assert.equal(a.step.href, "/watch?id=abc");
	assert.equal(a.step.minutes, 8);
	assert.equal(a.find, null);
});

test("with no video waiting, ten more Listen sentences, and a way to find a video", () => {
	const a = afterPlan({ listensToday: 1, listenMinutes: 4 });
	assert.equal(a.step.kind, "listen");
	assert.equal(a.step.href, "/listen");
	assert.equal(a.step.title, "Listen: ten more sentences");
	assert.equal(a.find, "/watch");
	assert.equal(afterPlan({ listensToday: 0, listenMinutes: 4 }).step.title, "Listen: ten sentences");
});
