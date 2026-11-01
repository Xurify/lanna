import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareAnswer, isVariantMatch, knownVariants } from "../src/core/language.ts";

describe("word variants and doublets", () => {
	it("returns known Slovak variants for doublets and triplets", () => {
		const zasVariants = knownVariants("zas", "sk-SK");
		assert.ok(zasVariants.includes("zase"));
		assert.ok(zasVariants.includes("zasa"));

		const zaseVariants = knownVariants("Zase", "sk-SK");
		assert.ok(zaseVariants.includes("zas"));
		assert.ok(zaseVariants.includes("zasa"));

		const spatVariants = knownVariants("späť", "sk-SK");
		assert.deepEqual(spatVariants, ["naspäť"]);

		const unknownVariants = knownVariants("pes", "sk-SK");
		assert.deepEqual(unknownVariants, []);
	});

	it("grades valid variants as exact matches in compareAnswer", () => {
		// "Zas" vs "Zase" (the exact case from user feedback)
		assert.equal(compareAnswer("Zas", "Zase"), "exact");
		assert.equal(compareAnswer("Zas", "zasa"), "exact");
		assert.equal(compareAnswer("zas", "  zase. "), "exact");

		// Identical words are exact
		assert.equal(compareAnswer("zas", "zas"), "exact");

		// Non-matching words are still wrong
		assert.equal(compareAnswer("zas", "zasee"), "wrong");
		assert.equal(compareAnswer("zas", "pes"), "wrong");

		// Diacritic slips on a valid variant return accents
		assert.equal(compareAnswer("späť", "naspat"), "accents");
		assert.equal(compareAnswer("naspäť", "spat"), "accents");
	});

	it("supports custom explicit alternatives passed to compareAnswer", () => {
		assert.equal(compareAnswer("auto", "vozidlo", "sk-SK", ["vozidlo"]), "exact");
		assert.equal(compareAnswer("auto", "koleso", "sk-SK", ["vozidlo"]), "wrong");
	});

	it("distinguishes variant matches from primary expected matches with isVariantMatch", () => {
		// Variant matches
		assert.equal(isVariantMatch("Zas", "Zase"), true);
		assert.equal(isVariantMatch("Zas", "zasa"), true);

		// Primary expected match is NOT a variant match (it is the exact target word)
		assert.equal(isVariantMatch("Zas", "Zas"), false);
		assert.equal(isVariantMatch("zas", "  zas  "), false);

		// Wrong words are not variant matches
		assert.equal(isVariantMatch("Zas", "pes"), false);
		assert.equal(isVariantMatch("Zas", ""), false);
	});
});
