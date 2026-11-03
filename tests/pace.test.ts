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
	it("nudges a slow clip up and a fast one down toward the same pace", () => {
		// 4 syllables a second is the pace at 1x: a 6-syllable clip of 1.5 s is already there.
		assert.equal(paceRate(6, 6 / NORMAL_SYLLABLES_PER_SECOND, 1), 1);
		const slow = paceRate(6, 6 / 3.5, 1);
		const fast = paceRate(6, 6 / 4.6, 1);
		assert.ok(Math.abs(slow - NORMAL_SYLLABLES_PER_SECOND / 3.5) < 1e-9);
		assert.ok(Math.abs(fast - NORMAL_SYLLABLES_PER_SECOND / 4.6) < 1e-9);
		assert.ok(slow > 1 && fast < 1);
	});
	it("scales with the setting", () => {
		const base = paceRate(8, 2, 1);
		assert.ok(Math.abs(paceRate(8, 2, 0.75) - base * 0.75) < 1e-9);
		assert.ok(Math.abs(paceRate(8, 2, 1.25) - base * 1.25) < 1e-9);
	});
	it("never corrects a clip by more than 0.8-1.3x, so a slow recording is not made to sound rushed", () => {
		// 2.5 syllables a second would need 1.6x to reach the pace: the sentence that sounded "very very fast".
		assert.equal(paceRate(8, 3.16, 1), 1.3);
		// 5.4 syllables a second would need 0.74x.
		assert.equal(paceRate(18, 3.32, 1), 0.8);
		// The library's spread (2.3 to 5.4 syllables a second) is narrowed from 2.3x to about 1.4x (3.0 to 4.3).
		const played = [2.3, 5.4].map((pace) => pace * paceRate(pace * 2, 2, 1));
		assert.ok(played[1]! / played[0]! < 1.5);
	});
	it("keeps the final rate where the browser's stretch stays clean", () => {
		assert.equal(paceRate(18, 3.32, 0.6), 0.6); // 0.8 x 0.6 would be 0.48
	});
	it("uses the plain multiplier for a word, an unknown length or an unusable one", () => {
		assert.equal(paceRate(2, 0.6, 1.25), 1.25);
		assert.equal(paceRate(8, 0, 1), 1);
		assert.equal(paceRate(8, Number.NaN, 0.75), 0.75);
		assert.equal(paceRate(1, 2, 1), 1);
	});
});
