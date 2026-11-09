import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	analyzeRhythmicLaw,
	applyRhythmicLaw,
	findNuclei,
	formatStressCadence,
	isLongQuantity,
	segmentSyllables,
	shortenEnding,
} from "../src/core/rhythm.ts";

describe("Slovak Rhythmic Law & Rhythm Engine", () => {
	describe("findNuclei", () => {
		it("detects short and long vowels accurately", () => {
			const n1 = findNuclei("mama");
			assert.equal(n1.length, 2);
			assert.equal(n1[0]?.quantity, "short");
			assert.equal(n1[1]?.quantity, "short");

			const n2 = findNuclei("tráva");
			assert.equal(n2.length, 2);
			assert.equal(n2[0]?.nucleus, "á");
			assert.equal(n2[0]?.quantity, "long");
			assert.equal(n2[1]?.nucleus, "a");
			assert.equal(n2[1]?.quantity, "short");
		});

		it("detects diphthongs as single long nuclei", () => {
			const n1 = findNuclei("kôň");
			assert.equal(n1.length, 1);
			assert.equal(n1[0]?.nucleus, "ô");
			assert.equal(n1[0]?.quantity, "long");

			const n2 = findNuclei("chlieb");
			assert.equal(n2.length, 1);
			assert.equal(n2[0]?.nucleus, "ie");
			assert.equal(n2[0]?.quantity, "long");

			const n3 = findNuclei("čiara");
			assert.equal(n3.length, 2);
			assert.equal(n3[0]?.nucleus, "ia");
			assert.equal(n3[0]?.quantity, "long");
		});

		it("identifies syllabic liquids vs non-syllabic liquids", () => {
			// Syllabic r, l
			const krk = findNuclei("krk");
			assert.equal(krk.length, 1);
			assert.equal(krk[0]?.nucleus, "r");
			assert.equal(krk[0]?.quantity, "short");

			const vlk = findNuclei("vlk");
			assert.equal(vlk.length, 1);
			assert.equal(vlk[0]?.nucleus, "l");
			assert.equal(vlk[0]?.quantity, "short");

			// Long syllabic liquids ŕ, ĺ
			const vrba = findNuclei("vŕba");
			assert.equal(vrba.length, 2);
			assert.equal(vrba[0]?.nucleus, "ŕ");
			assert.equal(vrba[0]?.quantity, "long");

			const stlp = findNuclei("stĺp");
			assert.equal(stlp.length, 1);
			assert.equal(stlp[0]?.nucleus, "ĺ");
			assert.equal(stlp[0]?.quantity, "long");

			// Non-syllabic: ryba (y is vowel), les (e is vowel)
			const ryba = findNuclei("ryba");
			assert.equal(ryba.length, 2);
			assert.equal(ryba[0]?.nucleus, "y");
			assert.equal(ryba[1]?.nucleus, "a");
		});
	});

	describe("segmentSyllables", () => {
		it("segments words and assigns quantities", () => {
			const sylls = segmentSyllables("krásny");
			assert.equal(sylls.length, 2);
			assert.equal(sylls[0]?.quantity, "long");
			assert.equal(sylls[1]?.quantity, "short");

			const sylls2 = segmentSyllables("chváliť");
			assert.equal(sylls2.length, 2);
			assert.equal(sylls2[0]?.quantity, "long");
			assert.equal(sylls2[1]?.quantity, "short");
		});
	});

	describe("isLongQuantity", () => {
		it("returns true only for stems ending in long nucleus", () => {
			assert.equal(isLongQuantity("chvál"), true);
			assert.equal(isLongQuantity("rob"), false);
			assert.equal(isLongQuantity("krásn"), true);
			assert.equal(isLongQuantity("pekn"), false);
			assert.equal(isLongQuantity("vŕb"), true);
			assert.equal(isLongQuantity("biel"), true);
		});
	});

	describe("shortenEnding", () => {
		it("shortens all long vowels and diphthongs", () => {
			assert.equal(shortenEnding("ám"), "am");
			assert.equal(shortenEnding("ím"), "im");
			assert.equal(shortenEnding("ý"), "y");
			assert.equal(shortenEnding("ého"), "eho");
			assert.equal(shortenEnding("ých"), "ych");
			assert.equal(shortenEnding("ie"), "e");
			assert.equal(shortenEnding("ôv"), "ov");
		});
	});

	describe("applyRhythmicLaw", () => {
		it("shortens long suffixes after long stems", () => {
			// Verb -ím / -ám
			const r1 = applyRhythmicLaw("chvál", "ím");
			assert.equal(r1.form, "chválim");
			assert.equal(r1.shortened, true);

			const r2 = applyRhythmicLaw("rob", "ím");
			assert.equal(r2.form, "robím");
			assert.equal(r2.shortened, false);

			// Adjective -ý
			const r3 = applyRhythmicLaw("krásn", "ý");
			assert.equal(r3.form, "krásny");
			assert.equal(r3.shortened, true);

			const r4 = applyRhythmicLaw("pekn", "ý");
			assert.equal(r4.form, "pekný");
			assert.equal(r4.shortened, false);

			// Noun dative pl -ám
			const r5 = applyRhythmicLaw("tráv", "ám");
			assert.equal(r5.form, "trávam");
			assert.equal(r5.shortened, true);

			const r6 = applyRhythmicLaw("žen", "ám");
			assert.equal(r6.form, "ženám");
			assert.equal(r6.shortened, false);

			// Syllabic liquid stem
			const r7 = applyRhythmicLaw("vŕb", "ám");
			assert.equal(r7.form, "vŕbam");
			assert.equal(r7.shortened, true);

			// Diphthong stem
			const r8 = applyRhythmicLaw("biel", "ý");
			assert.equal(r8.form, "biely");
			assert.equal(r8.shortened, true);
		});
	});

	describe("analyzeRhythmicLaw", () => {
		it("recognizes compliant standard forms", () => {
			assert.equal(analyzeRhythmicLaw("krásny").hasViolation, false);
			assert.equal(analyzeRhythmicLaw("chválim").hasViolation, false);
			assert.equal(analyzeRhythmicLaw("volám").hasViolation, false);
			assert.equal(analyzeRhythmicLaw("ženám").hasViolation, false);
			assert.equal(analyzeRhythmicLaw("trávam").hasViolation, false);
		});

		it("flags consecutive long syllables as violations", () => {
			const res = analyzeRhythmicLaw("krásný");
			assert.equal(res.hasViolation, true);
			assert.equal(res.violations.length, 1);

			const res2 = analyzeRhythmicLaw("chválím");
			assert.equal(res2.hasViolation, true);
		});

		it("identifies standard lexical exceptions", () => {
			const res1 = analyzeRhythmicLaw("lístie");
			assert.equal(res1.hasViolation, false);
			assert.equal(res1.isException, true);

			const res2 = analyzeRhythmicLaw("páví");
			assert.equal(res2.hasViolation, false);
			assert.equal(res2.isException, true);
		});
	});

	describe("formatStressCadence", () => {
		it("marks initial stress on content words", () => {
			const res = formatStressCadence("Chválime Slovensko");
			assert.equal(res.includes("ˈChvá-li-me"), true);
			assert.equal(res.includes("ˈSlo-ven-sko"), true);
		});

		it("preserves prepositions without marking separate stress", () => {
			const res = formatStressCadence("na námestí");
			assert.equal(res.startsWith("na ˈná-mes-tí"), true);
		});
	});
});
