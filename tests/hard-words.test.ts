import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import type { ReviewCard, ReviewLogEntry } from "../src/core/review.ts";
import { hardWords, reviewEntryWordVerdict } from "../src/core/hard-words.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-hard-words-"));
process.env.LANNA_DATA_DIR = dir;
process.env.LANNA_PROFILE = "slovak";
after(() => fs.rmSync(dir, { recursive: true, force: true }));

const card: ReviewCard = {
	id: "claim#0",
	slug: "claim",
	lemma: "claim",
	gloss: "assert",
	sentence: "They claim it works.",
	answer: "claim",
	at: 5,
	translation: "They assert it works.",
	state: "learning",
	due: "2026-11-01T10:00:00Z",
	reps: 2,
	lapses: 0,
	createdAt: "2026-11-01T10:00:00Z",
};
const entry = (day: number, extra: Partial<ReviewLogEntry> = {}): ReviewLogEntry => ({
	cardId: card.id,
	reviewedAt: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z`,
	rating: 1,
	given: "",
	verdict: "wrong",
	elapsedDays: 1,
	...extra,
});
const misses = [entry(1), entry(2)];
const clean = (day: number, extra: Partial<ReviewLogEntry> = {}) =>
	entry(day, {
		given: "claim",
		verdict: "exact",
		rating: 3,
		...extra,
	});
const detect = (cards: ReviewCard[], log: ReviewLogEntry[]) => hardWords(cards, log, { langTag: "en-US", tz: 0 });

test("finds repeated new/learning misses without FSRS lapses, ignoring one miss and suspended cards", () => {
	assert.equal(detect([card], misses).length, 1);
	assert.equal(detect([card], [entry(1)]).length, 0);
	assert.equal(detect([{ ...card, suspended: true }], misses).length, 0);
	assert.equal(detect([{ ...card, lapses: 3 }], [])[0]!.wrongs, 3);
});

test("collates cards by word and sorts history without changing caller inputs", () => {
	const other = { ...card, id: "claim#1" };
	const log = [entry(2, { cardId: other.id }), entry(1)];
	const before = JSON.stringify(log);
	const found = detect([card, other], log);
	assert.equal(found.length, 1);
	assert.equal(found[0]!.wrongs, 2);
	assert.equal(JSON.stringify(log), before);
});

test("requires two delayed, distinct-day, unassisted exact recalls even for a stable card", () => {
	const stable = { ...card, state: "review" as const, memory: { stability: 9.5, difficulty: 5 } };
	assert.equal(detect([stable], [...misses, clean(3)]).length, 1);
	assert.equal(detect([stable], [...misses, clean(3), clean(3)]).length, 1);
	assert.equal(detect([stable], [...misses, clean(3, { hints: 1 }), clean(4, { picked: true })]).length, 1);
	assert.equal(detect([stable], [...misses, clean(3, { verdict: "accents" }), clean(4, { rating: 2 })]).length, 1);
	assert.equal(detect([stable], [...misses, clean(3), clean(4)]).length, 0);
	assert.equal(detect([stable], [...misses, clean(3), clean(4), entry(5)]).length, 1);
});

test("a new local day alone is not enough, and the 12-hour boundary is inclusive", () => {
	const lateMiss = entry(2, { reviewedAt: "2026-11-02T23:00:00Z" });
	const early = clean(3, { reviewedAt: "2026-11-03T10:59:59Z" });
	assert.equal(detect([card], [entry(1), lateMiss, early, clean(4)]).length, 1);
	const boundary = { ...early, reviewedAt: "2026-11-03T11:00:00Z" };
	assert.equal(detect([card], [entry(1), lateMiss, boundary, clean(4)]).length, 0);
	const sameLocalDay = clean(3, { reviewedAt: "2026-11-03T23:00:00Z" });
	assert.equal(hardWords([card], [...misses, clean(3), sameLocalDay], { tz: 0 }).length, 1);
});

test("does not blame the target word for a neighboring blank", () => {
	const multiple = {
		words: 2,
		spans: [
			[5, 10],
			[14, 19],
		] as [number, number][],
	};
	const neighbor = entry(1, { ...multiple, given: "claim fails" });
	assert.equal(reviewEntryWordVerdict(card, neighbor, "en-US"), "exact");
	assert.equal(detect([card], [neighbor, { ...neighbor, reviewedAt: entry(2).reviewedAt }]).length, 0);
	assert.equal(
		detect([{ ...card, lapses: 2 }], [neighbor, { ...neighbor, reviewedAt: entry(2).reviewedAt }]).length,
		0,
	);
	assert.equal(reviewEntryWordVerdict(card, { ...neighbor, given: "think works" }, "en-US"), "wrong");
});

test("ranks by misses then latest miss, ignoring invalid timestamps", () => {
	const other = { ...card, id: "other#0", slug: "other" };
	const log = [
		...misses,
		entry(4, { cardId: other.id }),
		entry(5, { cardId: other.id }),
		entry(6, { reviewedAt: "bad" }),
	];
	assert.deepEqual(
		detect([card, other], log).map((word) => word.slug),
		["other", "claim"],
	);
});

test("review detection and answers leave explicit known marks alone", async () => {
	const { reviewStore } = await import("../src/store/review.ts");
	const { knownWordStore } = await import("../src/store/known-words.ts");
	const { answerReview, reviewStatus } = await import("../src/server/review.ts");
	reviewStore.writeCards({ [card.id]: card });
	knownWordStore.set(card.slug, card.lemma, true);
	answerReview({ cardId: card.id, given: "", rating: 1 }, new Date(entry(1).reviewedAt));
	answerReview({ cardId: card.id, given: "", rating: 1 }, new Date(entry(2).reviewedAt));
	assert.equal(knownWordStore.has(card.slug), true);
	assert.ok(reviewStatus(new Date(entry(3).reviewedAt), 0).leeches.some((word) => word.slug === card.slug));
	assert.equal(knownWordStore.has(card.slug), true);
});
