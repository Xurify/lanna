import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHEER_LANGUAGES, cheersFor, praiseFor, type CheerKey } from "../src/core/cheers.ts";
import { LANGUAGES, LANGUAGE_CATALOG } from "../src/core/language.ts";

describe("exclamations in the learner's language", () => {
	it("are kept only for languages the app knows, each with every heading and some praise", () => {
		const codes = new Set([...Object.values(LANGUAGES), ...LANGUAGE_CATALOG].map((l) => l.code));
		for (const code of CHEER_LANGUAGES) {
			assert.ok(codes.has(code), `${code} is a language the app knows`);
			const own = cheersFor(code)!;
			assert.ok(own.praise.length >= 3, `${code} has praise to vary`);
			for (const key of ["done", "perfect", "timeUp", "newBest"] as CheerKey[]) {
				assert.match(own[key].text, /!$/, `${code}.${key} is an exclamation`);
				assert.match(own[key].gloss, /^[a-z' ]+$/, `${code}.${key} has a plain English gloss`);
			}
			for (const p of own.praise) assert.match(p, /!$/);
		}
	});

	it("cover the learner's three languages", () => {
		assert.deepEqual([...CHEER_LANGUAGES].sort(), ["et", "ru", "sk"]);
	});

	it("fall back to English, unmarked, for a language without its own", () => {
		assert.equal(cheersFor("ro"), null);
		assert.equal(cheersFor(undefined), null);
		const praise = praiseFor("ro", 0);
		assert.equal(praise.lang, undefined);
		assert.match(praise.text, /^[A-Za-z ,]+!$/);
	});

	it("mark praise in the learner's language with its code and cycle through the list", () => {
		const first = praiseFor("et", 0);
		assert.deepEqual(first, { text: "Tubli!", lang: "et" });
		const n = cheersFor("et")!.praise.length;
		assert.equal(praiseFor("et", n).text, first.text);
		assert.equal(praiseFor("et", -1).text, cheersFor("et")!.praise[1]);
	});
});
