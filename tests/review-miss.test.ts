/**
 * REVIEW MISS (LangHarness, 2026-11-07): a wrong review answer says why —
 * another word the dictionary knows, the dictionary form, or another
 * ending — and which form the sentence needs.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-review-miss-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { missReason } = await import("../src/core/review-miss.ts");
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

reviewStore.writeCards({
	"vecera#2": card("vecera#2", "vecera", "večera", "Po večeri ideme na prechádzku.", "večeri"),
});

test("another dictionary word is named with its meaning, even when it shares the stem", () => {
	const r = reviewMiss("vecera#2", "večer")!;
	assert.equal(r.slip, "other");
	assert.deepEqual(r.other, { lemma: "večer", gloss: "evening", isLemma: true });
	assert.equal(r.lemma, "večera");
	assert.equal(r.gloss, "dinner");
	assert.equal(r.trigger, "po");
	assert.match(r.form ?? "", /^locative of večera/);
});

test("a form of another word says so", () => {
	const r = reviewMiss("vecera#2", "večerom")!;
	assert.equal(r.slip, "other");
	assert.deepEqual(r.other, { lemma: "večer", gloss: "evening", isLemma: false });
});

test("the card word's own forms are endings, not another word", () => {
	// "večera" is also večer's genitive; on this card it is the dictionary form.
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
