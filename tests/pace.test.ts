import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countSyllables } from "../src/core/pace.ts";

describe("countSyllables", () => {
	it("counts Slovak vowels, diphthongs and syllabic r and l", () => {
		const cases: Array<[string, number]> = [
			["Ahoj, maj sa!", 4],
			["Na námestí je veľa ľudí.", 9],
			["chlieb", 1],
			["vlk", 1],
			["Prosím", 2],
			["Kde si môžem kúpiť lístok?", 8],
			["v", 0],
		];
		for (const [text, n] of cases) assert.equal(countSyllables(text), n, text);
	});
	it("counts Russian by vowel", () => {
		assert.equal(countSyllables("Привет, как дела?", "ru"), 5);
	});
});
