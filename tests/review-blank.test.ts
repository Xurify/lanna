/**
 * REVIEW BLANK LENGTH (LangHarness, 2026-11-11): a card that has been
 * answered once can hide up to three words, the card's word and its
 * neighbors, so the learner produces the phrase and not only the ending.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-review-blank-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { blankAround, blankWordsFor, targetWordOf } = await import("../src/core/review.ts");
const { answerReview, reviewStatus, updateReviewSettings } = await import("../src/server/review.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
type ReviewCard = import("../src/core/review.ts").ReviewCard;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const NOW = new Date("2026-11-11T10:00:00Z");
const cardOn = (sentence: string, answer: string): Pick<ReviewCard, "sentence" | "answer" | "at"> => ({ sentence, answer, at: sentence.indexOf(answer) });

test("a blank of one word is the word alone", () => {
	const blank = blankAround(cardOn("Ja som doma.", "som"), 1);
	assert.deepEqual(blank, { before: "Ja ", answer: "som", after: " doma.", words: 1, target: 0 });
});

test("a longer blank grows to the right first on an even seed and to the left first on an odd one", () => {
	const card = cardOn("Ja som doma.", "som");
	assert.deepEqual(blankAround(card, 2, 0), { before: "Ja ", answer: "som doma", after: ".", words: 2, target: 0 });
	assert.deepEqual(blankAround(card, 2, 1), { before: "", answer: "Ja som", after: " doma.", words: 2, target: 1 });
	assert.deepEqual(blankAround(card, 3, 0), { before: "", answer: "Ja som doma", after: ".", words: 3, target: 1 });
});

test("a blank never crosses a comma, so a word beside one gets a shorter blank", () => {
	const card = cardOn("Keď prší, ostanem doma, lebo je zima.", "ostanem");
	const blank = blankAround(card, 3, 0);
	assert.equal(blank.answer, "ostanem doma");
	assert.equal(blank.words, 2);
	assert.equal(blank.before, "Keď prší, ");
	assert.equal(blank.after, ", lebo je zima.");
});

test("a one-word sentence has nothing to grow into", () => {
	assert.deepEqual(blankAround(cardOn("Ahoj!", "Ahoj"), 3), { before: "", answer: "Ahoj", after: "!", words: 1, target: 0 });
});

test("opening quotes and closing punctuation stay outside the blank", () => {
	const blank = blankAround(cardOn("Povedala „Dobrý deň“ potichu.", "Dobrý"), 2, 0);
	assert.equal(blank.answer, "Dobrý deň");
	assert.equal(blank.before, "Povedala „");
	assert.equal(blank.after, "“ potichu.");
});

test("a card seen for the first time hides one word; after that the length varies up to the limit", () => {
	assert.deepEqual([0, 1, 2, 3].map((seed) => blankWordsFor("new", 3, seed)), [1, 1, 1, 1]);
	assert.deepEqual([0, 1, 2, 3].map((seed) => blankWordsFor("review", 3, seed)), [1, 2, 3, 1]);
	assert.deepEqual([0, 1, 2, 3].map((seed) => blankWordsFor("learning", 2, seed)), [1, 2, 1, 2]);
	assert.deepEqual([0, 1, 2, 3].map((seed) => blankWordsFor("review", 1, seed)), [1, 1, 1, 1]);
});

test("the word typed in the place of the card's word is found by position", () => {
	const blank = { words: 3, target: 1 };
	assert.equal(targetWordOf(blank, "ja som doma"), "som");
	assert.equal(targetWordOf(blank, "  ja   som  doma "), "som");
	assert.equal(targetWordOf(blank, "som"), "som");
	assert.equal(targetWordOf({ words: 1, target: 0 }, "som"), "som");
});

test("the blank length setting is kept between one and three", () => {
	assert.equal(updateReviewSettings({ blankWords: 9 }).blankWords, 3);
	assert.equal(updateReviewSettings({ blankWords: 0 }).blankWords, 1);
	assert.equal(updateReviewSettings({ blankWords: 2 }).blankWords, 2);
});

const stanica = (id: string, state: ReviewCard["state"]): ReviewCard => ({
	id,
	slug: "stanica",
	lemma: "stanica",
	gloss: "station",
	sentence: "Ako ďaleko je to od stanice?",
	translation: "How far is it from the station?",
	answer: "stanice",
	at: 20,
	state,
	due: NOW.toISOString(),
	reps: state === "new" ? 0 : 2,
	lapses: 0,
	createdAt: NOW.toISOString(),
});

reviewStore.writeCards({
	"stanica#both": stanica("stanica#both", "review"),
	"stanica#slip": stanica("stanica#slip", "review"),
	"stanica#fresh": stanica("stanica#fresh", "new"),
});

test("the whole blank is graded: both words right is right", () => {
	const out = answerReview({ cardId: "stanica#both", given: "od stanice", words: 2 }, NOW);
	assert.equal(out.verdict, "exact");
	assert.equal(reviewStore.readLog().at(-1)?.words, 2);
});

test("a wrong neighbor misses the card but counts the card's word as right on its drill", () => {
	const before = progressStore.read().units["gen"]?.first ?? { reps: 0, right: 0, accents: 0, slips: {} };
	const out = answerReview({ cardId: "stanica#slip", given: "do stanice", words: 2 }, NOW);
	assert.equal(out.verdict, "wrong");
	assert.equal(out.rating, 1);
	assert.deepEqual(progressStore.read().units["gen"]?.first, { ...before, reps: before.reps + 1, right: before.right + 1 });
});

test("a new card is always one word, whatever length was asked for", () => {
	const out = answerReview({ cardId: "stanica#fresh", given: "stanice", words: 3 }, NOW);
	assert.equal(out.verdict, "exact");
	assert.equal(reviewStore.readLog().at(-1)?.words, undefined);
});

test("the prompt carries the blank: its words, the answer and the sentence around it", () => {
	reviewStore.writeCards({ "stanica#due": { ...stanica("stanica#due", "review"), reps: 1, due: "2026-11-10T00:00:00Z" } });
	updateReviewSettings({ blankWords: 3 });
	const next = reviewStatus(NOW, 0, { mint: false }).next!;
	assert.ok(next.words >= 1 && next.words <= 3);
	assert.equal(next.before + next.answer + next.after, next.card.sentence);
	assert.equal(next.answer.split(" ")[next.target], "stanice");
});
