/**
 * REVIEW BLANKS (2026-11-17): how many words a card hides follows the card's
 * own memory (FSRS stability), and the extra words are ones the deck proves
 * the learner knows, weakest first. No setting.
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

const { ASSUMED_KNOWN, applyGapInput, blankAround, blankAtSpans, blankSizeFor, splitOnWords, targetWordOf, wordsOf } =
	await import("../src/core/review.ts");
const { answerReview, blankOf, reviewStatus, spansOf } = await import("../src/server/review.ts");
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
const strengths =
	(days: Record<string, number>) =>
	(word: string): number | undefined =>
		days[word.toLowerCase()];

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

test("only words the learner has proven are hidden next to the card's word, in sentence order", () => {
	const card = cardOn("Keď prší, ostanem doma, lebo je zima.", "ostanem");
	const know = strengths({ prší: 12, doma: 40, je: 3 });
	for (const seed of SEEDS) {
		const b = blankAround(card, 3, seed, know);
		assert.deepEqual(b.gaps, ["prší", "ostanem", "doma"]);
		assert.equal(b.gaps[b.target], "ostanem");
		assert.equal(sentenceOf(b), card.sentence);
		assert.equal(b.answer, b.gaps.join(" "));
	}
});

test("words the level assumes known come after every word the deck has proven", () => {
	const card = cardOn("Keď prší, ostanem doma, lebo je zima.", "ostanem");
	const know = strengths({ keď: ASSUMED_KNOWN, je: ASSUMED_KNOWN, zima: 400 });
	for (const seed of SEEDS) assert.deepEqual(blankAround(card, 2, seed, know).gaps, ["ostanem", "zima"]);
	assert.deepEqual(new Set(SEEDS.map((seed) => blankAround(card, 3, seed, know).gaps.join(" "))).size, 2);
});

test("a sentence with fewer proven words than asked for hides fewer", () => {
	const card = cardOn("Keď prší, ostanem doma, lebo je zima.", "ostanem");
	assert.deepEqual(blankAround(card, 3, 0, strengths({ zima: 20 })).gaps, ["ostanem", "zima"]);
	assert.deepEqual(blankAround(card, 3, 0).gaps, ["ostanem"]);
});

test("the weakest proven word goes first, and near ties change from rep to rep", () => {
	const card = cardOn("Keď prší, ostanem doma, lebo je zima.", "ostanem");
	const far = strengths({ prší: 8, zima: 200 });
	for (const seed of SEEDS) assert.deepEqual(blankAround(card, 2, seed, far).gaps, ["prší", "ostanem"]);
	const close = strengths({ prší: 10, zima: 11 });
	assert.deepEqual(blankAround(card, 2, 42, close), blankAround(card, 2, 42, close));
	assert.equal(new Set(SEEDS.map((seed) => blankAround(card, 2, seed, close).answer)).size, 2);
});

test("a one-word sentence has nothing more to hide", () => {
	assert.deepEqual(
		blankAround(cardOn("Ahoj!", "Ahoj"), 3, 0, () => 100),
		{
			pieces: ["", "!"],
			gaps: ["Ahoj"],
			spans: [[0, 4]],
			answer: "Ahoj",
			words: 1,
			target: 0,
		},
	);
});

test("quotes, punctuation and numbers are never hidden", () => {
	for (const seed of SEEDS) {
		for (const g of blankAround(cardOn("Povedala „Dobrý deň“ potichu.", "Dobrý"), 3, seed, () => 100).gaps)
			assert.match(g, /^\p{L}+$/u);
		assert.deepEqual(blankAround(cardOn("Mám 3 sestry.", "sestry"), 2, seed, () => 100).gaps, ["Mám", "sestry"]);
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

test("the blank grows with the card's own memory and stays within a third of the sentence", () => {
	const long = "Keď prší, ostanem celý deň doma, lebo je zima.";
	const at = (state: ReviewCard["state"], stability?: number, sentence = long) =>
		blankSizeFor({ state, sentence, ...(stability ? { memory: { stability, difficulty: 5 } } : {}) });
	assert.equal(at("new"), 1);
	assert.equal(at("learning", 90), 1);
	assert.equal(at("review", 3), 1);
	assert.equal(at("review", 7), 2);
	assert.equal(at("review", 29), 2);
	assert.equal(at("review", 30), 3);
	assert.equal(at("review", 300, "Na tom kšefte sme veľa zarobili."), 2);
	assert.equal(at("review", 300, "Ja som doma."), 1);
});

test("spans sent back are kept only when they are whole words of the sentence, in order, with the card's word", () => {
	const card = cardOn("Ako ďaleko je to od stanice?", "stanice");
	assert.deepEqual(
		blankAtSpans(card, [
			[11, 13],
			[20, 27],
		])?.gaps,
		["je", "stanice"],
	);
	assert.equal(blankAtSpans(card, [[11, 13]]), undefined);
	assert.equal(
		blankAtSpans(card, [
			[12, 13],
			[20, 27],
		]),
		undefined,
	);
	assert.equal(
		blankAtSpans(card, [
			[20, 27],
			[11, 13],
		]),
		undefined,
	);
	assert.equal(
		blankAtSpans(card, [
			[0, 3],
			[4, 10],
			[11, 13],
			[20, 27],
		]),
		undefined,
	);
	assert.deepEqual(spansOf([[1, 2]]), [[1, 2]]);
	assert.equal(spansOf([[1, "2"]]), undefined);
	assert.equal(spansOf("1-2"), undefined);
});

test("the word typed in the place of the card's word is found by position", () => {
	const blank = { words: 3, target: 1 };
	assert.equal(targetWordOf(blank, "ja som doma"), "som");
	assert.equal(targetWordOf(blank, "  ja   som  doma "), "som");
	assert.equal(targetWordOf(blank, "som"), "som");
	assert.equal(targetWordOf({ words: 1, target: 0 }, "som"), "som");
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

const { loadLexicon } = await import("../src/agent/lexicon.ts");
const dalekoSlug = loadLexicon()!.byForm.get("ďaleko")![0]!.slug;
const proven = (slug: string, stability: number): ReviewCard => ({
	...stanica(`${slug}#0`, "review"),
	slug,
	memory: { stability, difficulty: 5 },
	due: "2027-01-01T00:00:00Z",
});
const strong = (id: string): ReviewCard => ({ ...stanica(id, "review"), memory: { stability: 12, difficulty: 5 } });

reviewStore.writeCards({
	[`${dalekoSlug}#0`]: proven(dalekoSlug, 20),
	"stanica#both": strong("stanica#both"),
	"stanica#slip": strong("stanica#slip"),
	"stanica#fresh": stanica("stanica#fresh", "new"),
});

test("a card with a proven memory hides a word the deck proves, and the answer is graded on the blank sent back", () => {
	const blank = blankOf(reviewStore.readCards()["stanica#both"]!);
	assert.deepEqual(blank.gaps, ["ďaleko", "stanice"]);
	const out = answerReview({ cardId: "stanica#both", given: blank.answer, spans: blank.spans }, NOW);
	assert.equal(out.verdict, "exact");
	assert.equal(reviewStore.readLog().at(-1)?.words, 2);
	assert.deepEqual(reviewStore.readLog().at(-1)?.spans, blank.spans);
});

test("a wrong other word misses the card but counts the card's word as right on its drill", () => {
	const blank = blankOf(reviewStore.readCards()["stanica#slip"]!);
	const given = blank.gaps.map((g, i) => (i === blank.target ? g : "xyz")).join(" ");
	const before = progressStore.read().units["gen"]?.first ?? { reps: 0, right: 0, accents: 0, slips: {} };
	const out = answerReview({ cardId: "stanica#slip", given, spans: blank.spans }, NOW);
	assert.equal(out.verdict, "wrong");
	assert.equal(out.rating, 1);
	assert.deepEqual(progressStore.read().units["gen"]?.first, {
		...before,
		reps: before.reps + 1,
		right: before.right + 1,
	});
});

test("a new card is always one word, whatever blank is sent back", () => {
	const out = answerReview(
		{
			cardId: "stanica#fresh",
			given: "stanice",
			spans: [
				[4, 10],
				[20, 27],
			],
		},
		NOW,
	);
	assert.equal(out.verdict, "exact");
	assert.equal(reviewStore.readLog().at(-1)?.words, undefined);
});

test("the prompt carries the blank: its words, where they are, the answer and the sentence around it", () => {
	reviewStore.writeCards({
		[`${dalekoSlug}#0`]: proven(dalekoSlug, 20),
		"stanica#due": { ...strong("stanica#due"), reps: 1, due: "2026-11-10T00:00:00Z" },
	});
	const next = reviewStatus(NOW, 0, { mint: false }).next!;
	assert.equal(next.words, 2);
	assert.deepEqual(next.gaps, ["ďaleko", "stanice"]);
	assert.deepEqual(blankAtSpans(next.card, next.spans)?.gaps, next.gaps);
	assert.equal(sentenceOf(next), next.card.sentence);
	assert.equal(next.gaps[next.target], "stanice");
	assert.equal(next.answer, next.gaps.join(" "));
});

test("a word the deck holds but has not proven is never hidden, even when the level assumes it known", () => {
	reviewStore.writeCards({
		[`${dalekoSlug}#0`]: { ...proven(dalekoSlug, 20), state: "learning" },
		"stanica#shaky": strong("stanica#shaky"),
	});
	const blank = blankOf(reviewStore.readCards()["stanica#shaky"]!);
	assert.equal(blank.words, 2);
	assert.ok(!blank.gaps.includes("ďaleko"));
});

test("multi-gap typing ignores a stray space on an empty blank and advances after a typed word", () => {
	assert.deepEqual(applyGapInput(["", "doma"], 2, 0, " "), { fields: ["", "doma"], advanceTo: null });
	assert.deepEqual(applyGapInput(["", "doma"], 2, 0, "som "), { fields: ["som", "doma"], advanceTo: 1 });
	assert.deepEqual(applyGapInput(["", ""], 2, 0, "  ja doma"), { fields: ["ja", "doma"], advanceTo: 1 });
	assert.deepEqual(applyGapInput(["", ""], 1, 0, " "), { fields: [" "], advanceTo: null });
});
