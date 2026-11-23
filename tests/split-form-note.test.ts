import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describesToken, splitFormNote, wordTypeLabel } from "../components/reading/word.tsx";

describe("splitFormNote", () => {
	it("cuts a case note around the dictionary form", () => {
		assert.deepEqual(splitFormNote("locative singular of stredný", "stredný"), {
			before: "locative singular of ",
			after: "",
		});
	});

	it("keeps what follows the dictionary form", () => {
		assert.deepEqual(splitFormNote("negative form of mať (to have)", "mať"), {
			before: "negative form of ",
			after: " (to have)",
		});
	});

	it("names the dictionary form when there is no note", () => {
		assert.deepEqual(splitFormNote(undefined, "mesto"), { before: "from ", after: "" });
	});

	it("puts a note that does not name the dictionary form after it", () => {
		assert.deepEqual(splitFormNote("je + to", "je to"), { before: "from ", after: " · je + to" });
	});
});

describe("wordTypeLabel", () => {
	it("names a part-of-speech category in the singular", () => {
		assert.equal(wordTypeLabel("Adjectives"), "adjective");
		assert.equal(wordTypeLabel("noun"), "noun");
		assert.equal(wordTypeLabel("Places"), "places");
	});
});

describe("describesToken", () => {
	it("keeps the lookup's form note and word type when it found the token's own word", () => {
		assert.equal(describesToken({ lemma: "tešiť" }, { lemma: "tešiť" }), true);
		assert.equal(describesToken({ lemma: "Tatry" }, { lemma: "tatry" }), true);
	});

	it("drops them when the story glossed the form as another word than the lookup found", () => {
		assert.equal(describesToken({ lemma: "ja" }, { lemma: "mať" }), false);
		assert.equal(describesToken({ lemma: "oco" }, { lemma: "oko" }), false);
	});

	it("trusts the lookup when either side names no word", () => {
		assert.equal(describesToken({}, { lemma: "mať" }), true);
		assert.equal(describesToken({ lemma: "ja" }, null), true);
	});
});
