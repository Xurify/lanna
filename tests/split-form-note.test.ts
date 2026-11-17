import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splitFormNote, wordTypeLabel } from "../components/reading/word.tsx";

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
