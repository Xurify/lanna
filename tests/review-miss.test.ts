import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-review-miss-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

// ESM evaluates static imports before this module's body, so the app modules are imported after the env is set.

const { contrastExample, contrastSource, missReason, partsOfSpeechIfDifferent, sharedMeaning, startsQuestion } =
	await import("../src/core/review-miss.ts");
const { pairContrastRule } = await import("../src/core/mixups.ts");
const { reviewMiss } = await import("../src/server/review.ts");
const { reviewStore } = await import("../src/store/review.ts");
type ReviewCard = import("../src/core/review.ts").ReviewCard;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const NOW = "2026-11-07T10:00:00Z";
const card = (id: string, slug: string, lemma: string, sentence: string, answer: string): ReviewCard => ({
	id,
	slug,
	lemma,
	gloss: "",
	sentence,
	translation: "",
	answer,
	at: sentence.indexOf(answer),
	state: "new",
	due: NOW,
	reps: 0,
	lapses: 0,
	createdAt: NOW,
});

const learning = (c: ReviewCard): ReviewCard => ({ ...c, state: "learning", reps: 2 });

reviewStore.writeCards({
	"vecera#2": card("vecera#2", "vecera", "večera", "Po večeri ideme na prechádzku.", "večeri"),
	"kseft#0": learning(card("kseft#0", "kseft", "kšeft", "Na tom kšefte.", "kšefte")),
	"ist#0": learning(card("ist#0", "ist", "ísť", "Ideme na dovolenku.", "Ideme")),
	"kseftovat#2": learning(card("kseftovat#2", "kseftovat", "kšeftovať", "Kšeftuje s bytmi v centre.", "Kšeftuje")),
});

test("with several gaps, a miss on another hidden word is the one explained", () => {
	const r = reviewMiss("ist#0", "Ideme na dovolenka", 3)!;
	assert.equal(r.slip, "base");
	assert.equal(r.lemma, "dovolenka");
	assert.equal(r.answer, "dovolenku");
	assert.equal(r.given, "dovolenka");
});

test("the right case in the wrong number says so: s bytom for s bytmi", () => {
	const r = reviewMiss("kseftovat#2", "Kšeftuje bytom v", 3)!;
	assert.equal(r.lemma, "byt");
	assert.equal(r.slip, "same-word");
	assert.equal(r.givenForm, "instrumental singular");
	assert.deepEqual(r.mismatch, { kind: "number", grammarCase: "instrumental", given: "singular", needed: "plural" });
	assert.match(r.form ?? "", /^instrumental plural/);
});

test("a missed grammar word the dictionary has no entry for is named from the grammar-word table", () => {
	const r = reviewMiss("kseft#0", "Na toto kšefte", 3)!;
	assert.equal(r.lemma, "ten");
	assert.equal(r.answer, "tom");
	assert.equal(r.other?.lemma, "tento");
	assert.equal(r.other?.gloss, "this");
});

test("with several gaps, the card's own word still comes first, and all right explains nothing", () => {
	assert.equal(reviewMiss("kseft#0", "Na toto kšeft", 3)!.answer, "kšefte");
	assert.equal(reviewMiss("kseft#0", "Na tom kšefte", 3), null);
});

test("another dictionary word is named with its meaning, even when it shares the stem", () => {
	const r = reviewMiss("vecera#2", "večer")!;
	assert.equal(r.slip, "other");
	assert.deepEqual(
		{ ...r.other, example: undefined },
		{ lemma: "večer", gloss: "evening", isLemma: true, example: undefined },
	);
	assert.match(r.other?.example?.text ?? "", /večer/i);
	assert.equal(r.lemma, "večera");
	assert.equal(r.gloss, "dinner");
	assert.equal(r.trigger, "po");
	assert.match(r.form ?? "", /^locative singular of večera/);
});

test("a form of another word says so", () => {
	const r = reviewMiss("vecera#2", "večerom")!;
	assert.equal(r.slip, "other");
	assert.equal(r.other?.lemma, "večer");
	assert.equal(r.other?.isLemma, false);
});

test("another word typed without its accents is still its dictionary form", () => {
	const r = reviewMiss("vecera#2", "vecer")!;
	assert.equal(r.other?.lemma, "večer");
	assert.equal(r.other?.isLemma, true);
});

test("the card word's own forms are endings, even when another word shares them (večera is večer's genitive)", () => {
	assert.equal(reviewMiss("vecera#2", "večera")!.slip, "base");
	const r = reviewMiss("vecera#2", "večeru")!;
	assert.equal(r.slip, "same-word");
	assert.equal(r.other, undefined);
});

test("no answer still names the form the sentence needs", () => {
	const r = reviewMiss("vecera#2", "")!;
	assert.equal(r.slip, "blank");
	assert.equal(r.trigger, "po");
});

test("a right answer, or one off by accents only, has nothing to explain", () => {
	assert.equal(reviewMiss("vecera#2", "večeri"), null);
	assert.equal(reviewMiss("vecera#2", "veceri"), null);
	assert.equal(reviewMiss("nope#0", "x"), null);
});

test("missReason keeps the stem guess when the dictionary knows no other word", () => {
	const r = missReason({ answer: "stanice", lemma: "stanica", gloss: "station", given: "stanicou" })!;
	assert.equal(r.slip, "same-word");
	const o = missReason({ answer: "stanice", lemma: "stanica", gloss: "station", given: "xyz" })!;
	assert.equal(o.slip, "other");
	assert.equal(o.other, undefined);
});

test("a word that never takes an ending gets no stem guess", () => {
	const r = missReason({ answer: "potom", lemma: "potom", gloss: "then", given: "potomx", inflects: false })!;
	assert.equal(r.slip, "other");
	assert.equal(r.inflects, false);
});

test("sharedMeaning finds a sense both glosses have, matching without notes in brackets and keeping the first gloss's note", () => {
	assert.equal(sharedMeaning("when", "when (conjunction); if"), "when");
	assert.equal(sharedMeaning("when (conjunction); if", "when"), "when (conjunction)");
	assert.equal(sharedMeaning("only", "only; just"), "only");
	assert.equal(sharedMeaning("here (to)", "here (location — for motion use sem)"), "here (to)");
	assert.equal(sharedMeaning("where to", "where"), undefined);
	assert.equal(sharedMeaning("evening", "dinner"), undefined);
});

test("sharedMeaning carries an aspect the lexicon marks on the whole entry", () => {
	assert.equal(sharedMeaning("to get; to receive (imperfective)", "to get; to receive"), "to get (imperfective)");
	assert.equal(sharedMeaning("to begin (imperfective)", "to begin; to start"), "to begin (imperfective)");
	assert.equal(sharedMeaning("to get; to receive", "to get; to receive (imperfective)"), "to get");
});

test("startsQuestion: the word opens the sentence and the sentence asks", () => {
	assert.equal(startsQuestion("Kedy prídeš?", "kedy"), true);
	assert.equal(startsQuestion("„Kedy prídeš?“", "kedy"), false);
	assert.equal(startsQuestion("Keď prídeš, zavolaj.", "keď"), false);
	assert.equal(startsQuestion("Neviem, kedy príde?", "kedy"), false);
	assert.equal(startsQuestion("Ked prides?", "keď"), true);
});

test("partsOfSpeechIfDifferent names two open classes only when they differ", () => {
	assert.deepEqual(partsOfSpeechIfDifferent("Adjectives", "Nouns"), ["adjective", "noun"]);
	assert.equal(partsOfSpeechIfDifferent("Nouns", "Nouns"), undefined);
	assert.equal(partsOfSpeechIfDifferent("Phrases", "Nouns"), undefined);
});

test("pairContrastRule: the pair's own rule first, then its family's, and none for another language", () => {
	assert.match(
		pairContrastRule("slovak", { slug: "ist", lemma: "ísť" }, { slug: "chodit", lemma: "chodiť" }) ?? "",
		/^ísť is one trip/,
	);
	assert.match(
		pairContrastRule("slovak", { slug: "tu", lemma: "tu" }, { slug: "sem", lemma: "sem" }) ?? "",
		/^After a verb of motion/,
	);
	assert.equal(pairContrastRule("slovak", { slug: "len", lemma: "len" }, { slug: "iba", lemma: "iba" }), undefined);
	assert.equal(pairContrastRule("russian", { slug: "tu", lemma: "tu" }, { slug: "sem", lemma: "sem" }), undefined);
});

test("contrastSource ranks a curated rule, then parts of speech, a meaning note, a question, an example", () => {
	const base = { lemma: "kedy", gloss: "when", isLemma: true };
	const example = { text: "Kedy prídeš?", en: "When will you come?", asks: true };
	assert.equal(contrastSource({ ...base, rule: "r", partOfSpeech: "noun" }, false), "rule");
	assert.equal(
		contrastSource({ ...base, partOfSpeech: "adjective", herePartOfSpeech: "noun" }, false),
		"part of speech",
	);
	assert.equal(contrastSource({ ...base, alsoMeans: "when (conjunction)", hereMeans: "when" }, false), "meaning note");
	assert.equal(contrastSource({ ...base, example }, false), "question");
	assert.equal(contrastSource({ ...base, example }, true), "example");
	assert.equal(contrastSource(base, false), "none");
});

test("contrastExample prefers a sentence with the typed word, then the shortest, and skips rejected or untranslated ones", () => {
	const examples = [
		{ text: "Dobrý večer!", en: "Good evening." },
		{ text: "Večer pozerám televíziu.", en: "In the evening I watch TV." },
		{ text: "Stretneme sa večerom.", en: "We meet in the evening." },
		{ text: "Bez prekladu.", en: "" },
		{ text: "Večer.", en: "Evening.", rejected: true },
	];
	assert.equal(contrastExample(examples, "vecerom")?.text, "Stretneme sa večerom.");
	assert.equal(contrastExample(examples, "večer")?.text, "Dobrý večer!");
	assert.equal(contrastExample(examples, "xyz")?.text, "Dobrý večer!");
	assert.equal(contrastExample([{ text: "Bez prekladu.", en: "" }], "bez"), undefined);
});

test("contrastExample prefers a sentence whose translation shows the word's first meaning", () => {
	const examples = [
		{ text: "Veľký rešpekt!", en: "Much respect." },
		{ text: "Zajtra je veľký deň.", en: "Tomorrow is a big day." },
		{ text: "Každý veľký úspech bol nemožný.", en: "Every great achievement was impossible." },
	];
	assert.equal(contrastExample(examples, "veľký", "sk-SK", "big; large; great")?.text, "Zajtra je veľký deň.");
	assert.equal(contrastExample(examples, "veľký", "sk-SK", "huge")?.text, "Veľký rešpekt!");
});
