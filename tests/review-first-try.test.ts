/**
 * REVIEW FIRST TRIES (2026-10-31): a review answer on a form
 * card counts as a first try on the drill its sentence practices — unless
 * a hint came before the answer — and the log line carries the drill, the
 * word's gender and the slip. A card whose cloze is the dictionary form
 * drills nothing and counts toward nothing.
 *
 * Runs under an isolated LANNA_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-review-first-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { answerReview } = await import("../src/server/review.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
type ReviewCard = import("../src/core/review.ts").ReviewCard;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const NOW = new Date("2026-10-31T10:00:00Z");

/** A card on the genitive example of stanica: "Ako ďaleko je to od stanice?" */
const genCard = (id: string): ReviewCard => ({
	id,
	slug: "stanica",
	lemma: "stanica",
	gloss: "station",
	sentence: "Ako ďaleko je to od stanice?",
	translation: "How far is it from the station?",
	answer: "stanice",
	at: 20,
	state: "new",
	due: NOW.toISOString(),
	reps: 0,
	lapses: 0,
	createdAt: NOW.toISOString(),
});

reviewStore.writeCards({
	"stanica#3": genCard("stanica#3"),
	"stanica#hint": genCard("stanica#hint"),
	"stanica#pick": genCard("stanica#pick"),
	// The dictionary form in the nominative: no drill.
	"stanica#0": { ...genCard("stanica#0"), sentence: "Stanica je blízko.", answer: "Stanica", at: 0 },
});

test("a typed wrong answer counts on the drill, with the slip, and the log carries it", () => {
	const out = answerReview({ cardId: "stanica#3", given: "stanica" }, NOW);
	assert.equal(out.verdict, "wrong");
	const gen = progressStore.read().units["gen"]!;
	assert.deepEqual(gen.first, { reps: 1, right: 0, accents: 0, slips: { base: 1 } });
	assert.deepEqual(gen.byGender?.fem, { reps: 1, right: 0, accents: 0, slips: { base: 1 } });
	const entry = reviewStore.readLog().at(-1)!;
	assert.equal(entry.unit, "gen");
	assert.equal(entry.gender, "feminine");
	assert.equal(entry.slip, "base");
});

test("a hint before the answer prices the try away: the log keeps the drill, nothing counts", () => {
	answerReview({ cardId: "stanica#hint", given: "stanica", hints: 1 }, NOW);
	assert.equal(progressStore.read().units["gen"]!.first!.reps, 1, "still the one from the typed try");
	const entry = reviewStore.readLog().at(-1)!;
	assert.equal(entry.unit, "gen");
	assert.equal(entry.gender, "feminine");
	assert.equal(entry.slip, undefined, "no counted wrong, no slip");
});

test("a picked wrong answer counts too (a choice is still a first try)", () => {
	answerReview({ cardId: "stanica#pick", given: "stanicu", picked: true }, NOW);
	const gen = progressStore.read().units["gen"]!;
	assert.equal(gen.first!.reps, 2);
	assert.deepEqual(gen.first!.slips, { base: 1, "same-word": 1 });
});

test("a right answer counts right; the dictionary form drills nothing", () => {
	answerReview({ cardId: "stanica#3", given: "stanice" }, NOW);
	assert.equal(progressStore.read().units["gen"]!.first!.right, 1);
	const before = JSON.stringify(progressStore.read().units);
	answerReview({ cardId: "stanica#0", given: "Stanica" }, NOW);
	assert.equal(JSON.stringify(progressStore.read().units), before, "a nominative card changes nothing");
	const entry = reviewStore.readLog().at(-1)!;
	assert.equal(entry.unit, undefined);
	assert.equal(entry.slip, undefined);
});
