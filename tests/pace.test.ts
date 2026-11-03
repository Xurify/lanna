import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countSyllables, NORMAL_SYLLABLES_PER_SECOND, paceRate } from "../src/core/pace.ts";

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

describe("paceRate", () => {
	it("brings a slow clip up and a fast one down to the same pace", () => {
		// 4 syllables a second is the target at 1x: a 6-syllable clip of 1.5 s is already there.
		assert.equal(paceRate(6, 6 / NORMAL_SYLLABLES_PER_SECOND, 1), 1);
		const slow = paceRate(6, 6 / 3, 1); // 3 syl/s
		const fast = paceRate(6, 6 / 5, 1); // 5 syl/s
		assert.ok(slow > 1 && fast < 1);
		assert.ok(Math.abs(6 / (6 / 3) * slow - NORMAL_SYLLABLES_PER_SECOND) < 1e-9);
		assert.ok(Math.abs(6 / (6 / 5) * fast - NORMAL_SYLLABLES_PER_SECOND) < 1e-9);
	});
	it("scales with the setting", () => {
		const base = paceRate(8, 2, 1);
		assert.ok(Math.abs(paceRate(8, 2, 0.75) - base * 0.75) < 1e-9);
		assert.ok(Math.abs(paceRate(8, 2, 1.25) - base * 1.25) < 1e-9);
	});
	it("stays inside the range the browser can stretch cleanly", () => {
		assert.equal(paceRate(4, 1.72, 1), 1.6); // 2.3 syl/s would need 1.72x
		assert.equal(paceRate(18, 3.32, 0.6), 0.6); // 5.4 syl/s at the slow button would need 0.44x
	});
	it("uses the plain multiplier for a word, an unknown length or an unusable one", () => {
		assert.equal(paceRate(2, 0.6, 1.25), 1.25);
		assert.equal(paceRate(8, 0, 1), 1);
		assert.equal(paceRate(8, Number.NaN, 0.75), 0.75);
		assert.equal(paceRate(1, 2, 1), 1);
	});
});
