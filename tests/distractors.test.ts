/**
 * DISTRACTORS (2026-10-30): the wrong meanings in a meaning
 * question are close to the right one. The neighbor index and the option
 * chooser (pure), then the server: a sentence with no close neighbor gets
 * two near-misses from a scripted cheap model, kept on disk and reused
 * without a second call; a plan never waits longer than the cap.
 *
 * Runs under an isolated LANNA_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-distractors-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { buildNeighborIndex, chooseOptions, neighbors, MIN_CLOSE } = await import("../src/core/distractors.ts");
const { rng } = await import("../src/core/lesson.ts");
const { betterOptions, parseNearMisses } = await import("../src/server/distractors.ts");
const { distractorStore } = await import("../src/store/distractors.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

function fauxEngine(steps: FauxResponseStep[]) {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(steps);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

const POOL = [
	"Do you look like an actor?",
	"I look like my father.",
	"I speak German.",
	"The train leaves at six.",
	"I'm starting a new life.",
	"I don't like Tom at all.",
	"Do I look like a doctor?",
	"Why is the sky blue?",
];

describe("neighbors", () => {
	it("finds close translations and never the sentence itself or its paraphrase", () => {
		const index = buildNeighborIndex(POOL);
		const near = neighbors(index, "Do I look like an actor?").map((n) => n.text);
		assert.ok(near.includes("Do you look like an actor?"));
		assert.ok(near.includes("Do I look like a doctor?"));
		assert.ok(!near.includes("Why is the sky blue?"));
		assert.ok(neighbors(index, "Do I look like an actor?").every((n) => n.score >= MIN_CLOSE));
		assert.deepEqual(neighbors(buildNeighborIndex(["Do I look like an actor?"]), "Do I look like an actor?"), []);
	});
});

describe("chooseOptions", () => {
	const own = "Do I look like an actor?";
	const index = buildNeighborIndex(POOL);

	it("uses cached near-misses first, then neighbors, then the old pool", () => {
		const r = chooseOptions(own, ["Did I look like an actor?"], neighbors(index, own), POOL, rng(1));
		assert.equal(r.options.length, 3);
		assert.ok(r.options.includes(own) && r.options.includes("Did I look like an actor?"));
		assert.equal(r.close, 2);
	});

	it("fills from the old pool when nothing is close, and says so", () => {
		const r = chooseOptions("Zorblax gadgets glow.", [], [], POOL, rng(2));
		assert.equal(r.options.length, 3);
		assert.equal(r.close, 0);
	});

	it("never repeats the right answer, in any case", () => {
		const r = chooseOptions(own, [own.toUpperCase(), "Do I look like an actor?"], [], POOL, rng(3));
		assert.equal(r.options.filter((o) => o.toLowerCase() === own.toLowerCase()).length, 1);
	});
});

describe("parseNearMisses", () => {
	it("needs one list per sentence", () => {
		assert.deepEqual(parseNearMisses('{"near": [["a", "b"], ["c", "d"]]}', 2), [
			["a", "b"],
			["c", "d"],
		]);
		assert.equal(parseNearMisses('{"near": [["a", "b"]]}', 2), null);
		assert.equal(parseNearMisses("sorry", 1), null);
	});
});

describe("betterOptions", () => {
	const item = () => ({
		sentence: "Mám zvláštny zorblaxový kúsok.",
		translation: "I own a peculiar zorblax gadget.",
		options: ["I own a peculiar zorblax gadget.", "He sold the car.", "The sky is blue today."],
	});

	it("asks the model once for a sentence with nothing close, keeps the answer, and never asks again", async () => {
		const near = ["I owned a peculiar zorblax gadget.", "You own a peculiar zorblax gadget."];
		const first = item();
		await betterOptions([first], {
			engine: fauxEngine([fauxAssistantMessage(JSON.stringify({ near: [near] }))]),
			seed: 1,
		});
		assert.deepEqual([...first.options].sort(), [first.translation, ...near].sort());
		const kept = distractorStore.get(first.sentence);
		assert.deepEqual(kept?.near, near);
		assert.ok(kept?.model);

		const again = item();
		await betterOptions([again], { engine: fauxEngine([]), seed: 2 }); // a second call would find no scripted answer
		assert.deepEqual([...again.options].sort(), [again.translation, ...near].sort());
		assert.equal(
			fs
				.readFileSync(path.join(TMP_DATA, "profiles", "slovak", "distractors", "near-misses.jsonl"), "utf-8")
				.trim()
				.split("\n").length,
			1,
		);
	});

	it("keeps going without a model: a bad answer leaves the old options and writes nothing", async () => {
		const odd = {
			sentence: "Nikto nevie, čo sa stalo včera večer.",
			translation: "Nobody knows what happened last night, quite honestly.",
			options: ["a", "b", "c"],
		};
		await betterOptions([odd], { engine: fauxEngine([fauxAssistantMessage("I cannot do that")]), seed: 3 });
		assert.equal(odd.options.length, 3);
		assert.equal(distractorStore.get(odd.sentence), undefined);
	});
});
