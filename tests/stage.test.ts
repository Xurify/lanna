import assert from "node:assert/strict";
import { test } from "node:test";
import { nearestOpen, stageSentence } from "../src/core/stage.ts";
import type { MilestoneEstimate } from "../src/core/milestones.ts";

const noEta = { planned: null, pace: null, daysPlanned: null, daysPace: null };

/** A milestone estimate with only the fields the stage sentence reads. */
function estimate(title: string, over: Partial<MilestoneEstimate> = {}): MilestoneEstimate {
	return {
		def: { id: title, title } as MilestoneEstimate["def"],
		status: "far",
		binding: "speed",
		words: { have: 900, need: 1800, toGo: 900, coverageNow: 0.8, coverageTarget: 0.95, eta: noEta },
		speed: { have: 40, need: 100, basis: "listen", hoursToGo: 50, hoursBasis: "trend", eta: noEta },
		eta: { planned: "2027-03-01", pace: "2027-04-01", daysPlanned: 100, daysPace: 130 },
		verdict: "",
		missing: [],
		...over,
	} as MilestoneEstimate;
}

test("speed is the limit: the sentence names the milestone and both numbers, measured without a detail", () => {
	const view = stageSentence([estimate("A casual vlog")]);
	assert.equal(view.title, "A casual vlog");
	assert.equal(
		view.line,
		'Speed limits "A casual vlog": about 40 words a minute are understood, and this needs about 100.',
	);
	assert.match(view.detail ?? "", /grows with hours/);
});

test("speed from the level, not measured, says so in the detail line and on the meter", () => {
	const view = stageSentence([
		estimate("A film", {
			speed: { have: 60, need: 150, basis: "level", hoursToGo: 30, hoursBasis: "ladder", eta: noEta },
		}),
	]);
	assert.match(view.detail ?? "", /estimate/);
	assert.equal(view.speed?.estimated, true);
});

test("the meters carry the sentence's numbers; a milestone read at your own pace has no speed to meet", () => {
	const view = stageSentence([estimate("A casual vlog")]);
	assert.equal(view.binding, "speed");
	assert.deepEqual(view.words, { have: 900, need: 1800, estimated: false });
	assert.deepEqual(view.speed, { have: 40, need: 100, estimated: false });
	const read = stageSentence([
		estimate("The news", {
			binding: "words",
			speed: { have: 0, need: 0, basis: "level", hoursToGo: 0, hoursBasis: "ladder", eta: noEta },
		}),
	]);
	assert.equal(read.binding, "words");
	assert.equal(read.speed, null);
	assert.equal(stageSentence([]).words, null);
	assert.equal(stageSentence([]).binding, null);
});

test("words are the limit: the sentence gives the known and needed words, and what is still to go", () => {
	const view = stageSentence([estimate("The news", { binding: "words" })]);
	assert.equal(view.line, 'Words limit "The news": you know 900 of the 1800 the speech needs.');
	assert.equal(view.detail, "900 more to go.");
});

test("the milestone to talk about is the unreached one with the nearest date", () => {
	const far = estimate("Far", { eta: { planned: null, pace: "2028-01-01", daysPlanned: null, daysPace: 400 } });
	const near = estimate("Near", { eta: { planned: null, pace: "2027-01-01", daysPlanned: null, daysPace: 60 } });
	const reached = estimate("Done", {
		status: "reached",
		eta: { planned: null, pace: null, daysPlanned: 0, daysPace: 0 },
	});
	assert.equal(nearestOpen([far, near, reached])?.def.title, "Near");
	assert.equal(stageSentence([far, near]).title, "Near");
});

test("with every milestone reached, or none measured, the sentence says so and names nothing", () => {
	const done = stageSentence([estimate("Done", { status: "reached" })]);
	assert.equal(done.title, null);
	assert.equal(done.line, "Every milestone the app tracks is reached by this estimate.");
	assert.equal(stageSentence([]).line, "Nothing to measure yet.");
});
