/**
 * REVIEW BLANK LENGTH (2026-11-11): a card that has been
 * answered once can hide up to three words: the card's word and other
 * words of the sentence, picked anew each rep (E102), one field each.
 *
 * Runs under an isolated LANNA_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-review-blank-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { blankAround, blankWordsFor, splitOnWords, targetWordOf, wordsOf } = await import("../src/core/review.ts");
const { answerReview, blankOf, reviewStatus, updateReviewSettings } = await import("../src/server/review.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
type ReviewCard = import("../src/core/review.ts").ReviewCard;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const NOW = new Date("2026-11-11T10:00:00Z");
const cardOn = (sentence: string, answer: string): Pick<ReviewCard, "sentence" | "answer" | "at"> => ({
	sentence,
	answer,
	at: sentence.indexOf(answer),
});

const sentenceOf = (b: { pieces: string[]; gaps: string[] }) => b.pieces.map((p, i) => p + (b.gaps[i] ?? "")).join("");
const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919);

test("a blank of one word is the word alone", () => {
	const blank = blankAround(cardOn("Ja som doma.", "som"), 1);
	assert.deepEqual(blank, {
		pieces: ["Ja ", " doma."],
		gaps: ["som"],
		spans: [[3, 6]],
		answer: "som",
		words: 1,
		target: 0,
	});
});

test("a longer blank hides other words from anywhere in the sentence, in sentence order, with the card's word at target", () => {
	const card = cardOn("Keď prší, ostanem doma, lebo je zima.", "ostanem");
	const blanks = SEEDS.map((seed) => blankAround(card, 3, seed));
	for (const b of blanks) {
		assert.equal(b.words, 3);
		assert.equal(b.gaps[b.target], "ostanem");
		assert.equal(sentenceOf(b), card.sentence);
		assert.equal(b.answer, b.gaps.join(" "));
		assert.deepEqual(
			[...b.spans].sort((x, y) => x[0] - y[0]),
			b.spans,
		);
	}
	const picked = new Set(blanks.flatMap((b) => b.gaps));
	for (const w of ["Keď", "prší", "doma", "lebo", "je", "zima"]) assert.ok(picked.has(w), `${w} is picked on some rep`);
	assert.ok(
		blanks.some((b) => b.pieces.slice(1, -1).some((p) => /\p{L}/u.test(p))),
		"some blanks are split by words left showing",
	);
});

test("the same seed gives the same blank, and other seeds give other blanks", () => {
	const card = cardOn("Ako ďaleko je to od stanice?", "stanice");
	assert.deepEqual(blankAround(card, 2, 42), blankAround(card, 2, 42));
	assert.ok(new Set(SEEDS.map((seed) => blankAround(card, 2, seed).answer)).size >= 4);
});

test("a one-word sentence has nothing more to hide", () => {
	assert.deepEqual(blankAround(cardOn("Ahoj!", "Ahoj"), 3), {
		pieces: ["", "!"],
		gaps: ["Ahoj"],
		spans: [[0, 4]],
		answer: "Ahoj",
		words: 1,
		target: 0,
	});
});

test("quotes, punctuation and numbers are never hidden", () => {
	for (const seed of SEEDS) {
		for (const g of blankAround(cardOn("Povedala „Dobrý deň“ potichu.", "Dobrý"), 3, seed).gaps)
			assert.match(g, /^\p{L}+$/u);
		assert.deepEqual(blankAround(cardOn("Mám 3 sestry.", "sestry"), 2, seed).gaps, ["Mám", "sestry"]);
	}
});

test("the day's list can hide exactly the words of the blank on screen", () => {
	const hide = new Set(wordsOf("Je záujem"));
	assert.deepEqual(splitOnWords("O kurz je veľký záujem, je to jasné.", hide), [
		{ text: "O kurz ", hidden: false },
		{ text: "je", hidden: true },
		{ text: " veľký ", hidden: false },
		{ text: "záujem", hidden: true },
		{ text: ", ", hidden: false },
		{ text: "je", hidden: true },
		{ text: " to jasné.", hidden: false },
	]);
	assert.deepEqual(splitOnWords("Jeho záujmy", hide), [{ text: "Jeho záujmy", hidden: false }]);
});

test("a card seen for the first time hides one word; after that the length varies up to the limit", () => {
	assert.deepEqual(
		[0, 1, 2, 3].map((seed) => blankWordsFor("new", 3, seed)),
		[1, 1, 1, 1],
	);
	assert.deepEqual(
		[0, 1, 2, 3].map((seed) => blankWordsFor("review", 3, seed)),
		[1, 2, 3, 1],
	);
	assert.deepEqual(
		[0, 1, 2, 3].map((seed) => blankWordsFor("learning", 2, seed)),
		[1, 2, 1, 2],
	);
	assert.deepEqual(
		[0, 1, 2, 3].map((seed) => blankWordsFor("review", 1, seed)),
		[1, 1, 1, 1],
	);
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

test("the whole blank is graded: every word right is right, and the log keeps where the words were", () => {
	const blank = blankOf(reviewStore.readCards()["stanica#both"]!, 3, 2);
	const out = answerReview({ cardId: "stanica#both", given: blank.answer, words: 2 }, NOW);
	assert.equal(out.verdict, "exact");
	assert.equal(reviewStore.readLog().at(-1)?.words, 2);
	assert.deepEqual(reviewStore.readLog().at(-1)?.spans, blank.spans);
});

test("a wrong other word misses the card but counts the card's word as right on its drill", () => {
	const blank = blankOf(reviewStore.readCards()["stanica#slip"]!, 3, 2);
	const given = blank.gaps.map((g, i) => (i === blank.target ? g : "xyz")).join(" ");
	const before = progressStore.read().units["gen"]?.first ?? { reps: 0, right: 0, accents: 0, slips: {} };
	const out = answerReview({ cardId: "stanica#slip", given, words: 2 }, NOW);
	assert.equal(out.verdict, "wrong");
	assert.equal(out.rating, 1);
	assert.deepEqual(progressStore.read().units["gen"]?.first, {
		...before,
		reps: before.reps + 1,
		right: before.right + 1,
	});
});

test("a new card is always one word, whatever length was asked for", () => {
	const out = answerReview({ cardId: "stanica#fresh", given: "stanice", words: 3 }, NOW);
	assert.equal(out.verdict, "exact");
	assert.equal(reviewStore.readLog().at(-1)?.words, undefined);
});

test("the prompt carries the blank: its words, the answer and the sentence around it", () => {
	reviewStore.writeCards({
		"stanica#due": { ...stanica("stanica#due", "review"), reps: 1, due: "2026-11-10T00:00:00Z" },
	});
	updateReviewSettings({ blankWords: 3 });
	const next = reviewStatus(NOW, 0, { mint: false }).next!;
	assert.ok(next.words >= 1 && next.words <= 3);
	assert.equal(sentenceOf(next), next.card.sentence);
	assert.equal(next.gaps[next.target], "stanice");
	assert.equal(next.answer, next.gaps.join(" "));
});
