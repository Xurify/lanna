import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldUnmarkKnownWord } from "../src/core/known-word-review.ts";
import type { ReviewCard, ReviewLogEntry } from "../src/core/review.ts";

const card: ReviewCard = {
	id: "claim#0",
	slug: "claim",
	lemma: "claim",
	gloss: "assert",
	sentence: "They claim it works.",
	answer: "claim",
	at: 5,
	translation: "They assert it works.",
	state: "review",
	due: "2026-11-01T00:00:00Z",
	createdAt: "2026-10-01T00:00:00Z",
	reps: 20,
	lapses: 20,
};
const marked = "2026-11-01T00:00:00Z";
const now = new Date("2026-11-20T00:00:00Z");
const entry = (day: number, extra: Partial<ReviewLogEntry> = {}): ReviewLogEntry => ({
	cardId: card.id,
	rating: 1,
	given: "think",
	verdict: "wrong",
	elapsedDays: 1,
	reviewedAt: `2026-11-${String(day).padStart(2, "0")}T10:00:00Z`,
	...extra,
});
const check = (log: ReviewLogEntry[], cards = [card], since = marked) =>
	shouldUnmarkKnownWord(cards, log, card.slug, since, now, "en-US");

test("requires three misses, not one or two, and never falls back to FSRS lapses", () => {
	assert.equal(check([]), false);
	assert.equal(check([entry(2)]), false);
	assert.equal(check([entry(2), entry(3)]), false);
	assert.equal(check([entry(2), entry(3), entry(4)]), true);
});

test("both hints and recognition are excluded, including failures after the streak is established", () => {
	assert.equal(check([entry(2, { hints: 1 }), entry(3, { hints: 2 }), entry(4, { picked: true })]), false);
	assert.equal(check([entry(2), entry(3, { hints: 1 }), entry(4, { picked: true }), entry(5)]), false);
	assert.equal(check([entry(2), entry(3, { hints: 1 }), entry(4), entry(5)]), true);
});

test("unassisted exact and accent-only target answers reset the streak regardless of self-rating", () => {
	for (const verdict of ["exact", "accents"] as const) {
		const clean = entry(4, { verdict, given: "claim", rating: 1 });
		assert.equal(check([entry(2), entry(3), clean, entry(5), entry(6)]), false);
		assert.equal(check([entry(2), entry(3), clean, entry(5), entry(6), entry(7)]), true);
	}
	assert.equal(check([entry(2), entry(3), entry(4, { verdict: "exact", hints: 1 }), entry(5)]), true);
});

test("uses only evidence after the latest mark, up to now, with valid timestamps and distinct attempts", () => {
	const log = [entry(2), entry(3), entry(4)];
	assert.equal(check(log, [card], entry(2).reviewedAt), false);
	assert.equal(check(log, [card], entry(4).reviewedAt), false);
	assert.equal(check(log, [card], "bad date"), false);
	assert.equal(check([entry(2), entry(2), entry(3)]), false);
	assert.equal(check([entry(2), entry(2, { reviewedAt: "2026-11-02T10:00:00.000Z" }), entry(3)]), false);
	assert.equal(check([entry(2), entry(3), entry(4, { reviewedAt: "bad" })]), false);
	assert.equal(check([entry(2), entry(3), entry(21)]), false);
	const reversed = [...log].reverse();
	assert.equal(check(reversed), true);
	assert.deepEqual(reversed, [...log].reverse());
});

test("shares evidence between cards of the same word, excluding other words and suspended cards", () => {
	const other = { ...card, id: "claim#1" };
	const unrelated = { ...card, id: "other#0", slug: "other" };
	const log = [entry(2), entry(3, { cardId: other.id }), entry(4)];
	assert.equal(check(log, [card, other, unrelated]), true);
	assert.equal(check(log, [card, { ...other, suspended: true }]), false);
	assert.equal(check([entry(2), entry(3), entry(4, { cardId: unrelated.id })], [card, unrelated]), false);
	assert.equal(check([entry(2), entry(3), entry(4)], [{ ...card, suspended: true }]), false);
});

test("a neighboring blank never counts as a target miss, including accent-only target answers", () => {
	const multi = {
		words: 2,
		spans: [
			[5, 10],
			[14, 19],
		] as [number, number][],
	};
	const neighbor = (day: number) => entry(day, { ...multi, given: "claim fails" });
	assert.equal(check([neighbor(2), neighbor(3), neighbor(4)]), false);
	assert.equal(check([entry(2), entry(3), neighbor(4), entry(5), entry(6)]), false);
	const accented = { ...card, sentence: "They cláim it works.", answer: "cláim" };
	assert.equal(check([neighbor(2), neighbor(3), neighbor(4)], [accented]), false);
	assert.equal(check([2, 3, 4].map((day) => entry(day, { ...multi, given: "think works" }))), true);
});

test("ambiguous multi-word evidence cannot unmark a word", () => {
	const multi = {
		words: 2,
		spans: [
			[5, 10],
			[14, 19],
		] as [number, number][],
	};
	for (const extra of [
		{ words: 2 },
		{ words: 2, spans: [[0, 4]] as [number, number][] },
		{ ...multi, given: "claim really fails" },
		{ ...multi, given: "claim" },
		{ ...multi, words: 3 },
	])
		assert.equal(check([entry(2), entry(3), entry(4, extra)]), false);
	assert.equal(check([2, 3, 4].map((day) => entry(day, { ...multi, given: "" }))), true);
});
