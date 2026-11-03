/**
 * The pure rules of Watch's sentence step (docs/plans/watch-sentences.md):
 * which words it asks for, what a program refuses without a model, and how
 * a model's answer is read. The server part runs in tests/watch.test.ts.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseVerdict, SENTENCE_TARGETS, sentenceProblems, sentenceTargets, usesLemma } from "../src/core/watch-sentences.ts";
import type { VideoRecord } from "../src/core/watch.ts";

const tok = (text: string, lemma?: string, slug?: string, gloss?: string) => ({
	text,
	word: true,
	...(lemma ? { lemma } : {}),
	...(slug ? { slug } : {}),
	...(gloss ? { gloss } : {}),
});

function video(trackLang = "sk"): VideoRecord {
	return {
		id: "dQw4w9WgXcQ",
		lang: "sk",
		source: { kind: "captions", trackLang, via: "test" },
		segments: [
			{ i: 0, start: 0, end: 2, sk: "Ide do mesta.", en: "", tokens: [tok("Ide", "ísť", "ist", "goes"), tok("mesta", "mesto", "mesto", "city")] },
			{ i: 1, start: 2, end: 4, sk: "Mám knihu.", en: "", tokens: [tok("knihu", "kniha", "kniha", "book")] },
		],
		preTeach: [
			{ lemma: "dom", slug: "dom", gloss: "house", count: 2, at: 1, example: "Mám knihu." },
			{ lemma: "kniha", slug: "kniha", gloss: "book", count: 1, at: 1, example: "Mám knihu." },
			{ lemma: "voda", gloss: "water", count: 1, at: 0, example: "Ide do mesta." },
		],
	} as unknown as VideoRecord;
}

describe("sentenceTargets", () => {
	test("the tapped words come first, in the order of the video; then the pre-teach words; no repeats; at most three", () => {
		assert.deepEqual(sentenceTargets(video(), ["kniha", "mesto"]).map((t) => t.lemma), ["mesto", "kniha", "dom"]);
		assert.equal(SENTENCE_TARGETS, 3);
	});

	test("with nothing tapped, the pre-teach words", () => {
		assert.deepEqual(sentenceTargets(video()).map((t) => t.lemma), ["dom", "kniha", "voda"]);
	});

	test("each target carries its meaning and the Slovak line it was met in", () => {
		const [first] = sentenceTargets(video(), ["mesto"]);
		assert.equal(first!.gloss, "city");
		assert.equal(first!.line, "Ide do mesta.");
		assert.equal(first!.at, 0);
	});

	test("a video with captions in another language gives no words", () => {
		assert.deepEqual(sentenceTargets(video("cs"), ["mesto"]), []);
	});
});

describe("usesLemma", () => {
	test("a form matches by the first letters of the lemma", () => {
		assert.equal(usesLemma(["kávu"], "káva"), true);
		assert.equal(usesLemma(["kávy"], "káva"), true);
		assert.equal(usesLemma(["knihu"], "kniha"), true);
		assert.equal(usesLemma(["pes"], "auto"), false);
	});

	test("a phrase is left to the model", () => {
		assert.equal(usesLemma(["nič"], "nie je"), true);
	});
});

describe("sentenceProblems", () => {
	test("a single word is not a sentence", () => {
		assert.deepEqual(sentenceProblems("Kniha.", "kniha"), ["Write a whole sentence, not only the word."]);
	});

	test("a sentence without the word is refused", () => {
		assert.deepEqual(sentenceProblems("To je dom.", "kniha"), ['Use "kniha" in the sentence, in any form.']);
	});

	test("a sentence with the word and no certain problem passes the program", () => {
		assert.deepEqual(sentenceProblems("Mám knihu.", "kniha"), []);
	});

	test("a certain Slovak problem is named (a Czech letter)", () => {
		const problems = sentenceProblems("Mám kávu ů.", "káva");
		assert.ok(problems.length > 0);
		assert.ok(!problems.some((p) => p.startsWith("Use ")));
	});
});

describe("parseVerdict", () => {
	test("reads the JSON object, even inside a code fence", () => {
		const text = '```json\n{"ok": false, "corrected": "Mám knihu.", "why": "Use the accusative."}\n```';
		assert.deepEqual(parseVerdict(text, "Mám knihu"), { ok: false, corrected: "Mám knihu.", why: "Use the accusative." });
	});

	test("without a corrected sentence, the sentence as written stands", () => {
		assert.deepEqual(parseVerdict('{"ok": true, "why": "Looks right."}', "Mám knihu."), { ok: true, corrected: "Mám knihu.", why: "Looks right." });
	});

	test("anything else is no verdict", () => {
		assert.equal(parseVerdict("no json here", "x y"), null);
		assert.equal(parseVerdict('{"ok": "yes", "why": "x"}', "x y"), null);
		assert.equal(parseVerdict('{"ok": true, "why": ""}', "x y"), null);
	});
});
