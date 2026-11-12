import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupTokens, kindOf, sourceMeta, storyMeta } from "@/components/reading/reader";
import { ROBO_EPISODES } from "../scripts/fixtures/series-episodes.ts";

const tok = (text: string, word = /\p{L}/u.test(text)) => ({ text, word });

describe("the reader's text", () => {
	it("punctuation stays with the word before it and an opening quote with the word after it", () => {
		const tokens = [tok("Martin"), tok(" "), tok("hovorí"), tok(":"), tok(" "), tok("„"), tok("Dobrý"), tok(" "), tok("deň"), tok("!"), tok("“")];
		const groups = groupTokens(tokens).map((g) => g.indexes.map((i) => tokens[i]!.text).join(""));
		assert.deepEqual(groups, ["Martin", " ", "hovorí:", " ", "„Dobrý", " ", "deň!“"]);
	});

	it("a final full stop is never a group of its own", () => {
		const tokens = [tok("veľa"), tok(" "), tok("ľudí"), tok(".")];
		const groups = groupTokens(tokens).filter((g) => !g.space);
		assert.equal(groups.length, 2);
		assert.deepEqual(groups[1]!.indexes, [2, 3]);
	});

	it("the library line leaves out what does not exist", () => {
		assert.equal(storyMeta({ level: "A1", wordCount: 80, coverage: 0, newWords: [] }), "A1 · about 1 min");
		assert.equal(storyMeta({ level: "A2", wordCount: 160, coverage: 0.92, newWords: ["stanica", { sk: "lístok" }] }), "A2 · about 2 min · 2 new words · 92% of words counted as known");
	});

	it("the hand-made fixture episodes are complete: sentences with translations, three questions, glossed words", () => {
		assert.equal(ROBO_EPISODES.length, 4);
		for (const ep of ROBO_EPISODES) {
			assert.ok(ep.sentences.length >= 7, ep.id);
			assert.ok(ep.sentences.every((s) => s.sk.trim() && s.en.trim()), `${ep.id} has an untranslated sentence`);
			assert.equal(ep.questions.length, 3, ep.id);
			assert.ok(ep.questions.every((q) => q.answer >= 0 && q.answer < q.options.length), ep.id);
			assert.ok(ep.newWords.length >= 2 && ep.newWords.length <= 3, ep.id);
			const words = ep.sentences.flatMap((s) => s.sk.match(/\p{L}+/gu) ?? []);
			const glossed = words.filter((w) => ep.glossary[w.toLocaleLowerCase("sk-SK")]).length;
			assert.ok(glossed / words.length > 0.95, `${ep.id}: only ${glossed} of ${words.length} words glossed`);
		}
	});

	it("a text of your own says where it is from, how far it is read and how hard it is", () => {
		const entry = { id: "s1", title: "Test", parts: 3, written: 1, read: 0, nextPart: 1, addedAt: "2026-11-01T10:00:00Z", finished: false, shortened: false, difficulty: "level" as const };
		assert.equal(sourceMeta({ ...entry, site: "example.com" }), "example.com · 3 parts · not started");
		assert.equal(sourceMeta({ ...entry, read: 1, nextPart: 2 }), "part 2 of 3 is next");
		assert.equal(sourceMeta({ ...entry, read: 3, finished: true, difficulty: "full" }), "read · 3 parts · not simplified");
		assert.equal(sourceMeta({ ...entry, parts: 1, shortened: true, difficulty: "harder" }), "1 part · not started · a step up · a shorter version");
	});

	it("a part of your own text is named by its number", () => {
		assert.equal(kindOf({ episode: 2, genre: "own", source: { id: "s1", title: "Test", part: 2, parts: 3 } }), "Part 2 of 3");
		assert.equal(kindOf({ episode: 4 }), "Episode 4");
	});
});
