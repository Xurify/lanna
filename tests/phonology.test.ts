/**
 * PHONOLOGICAL ACQUISITION TESTS (LangHarness, 2026-11).
 *
 * Verifies the empirical phonology engine:
 * 1. Articulatory motor cues & diagnostic guidance
 * 2. Functional Load weighting in pronunciation scoring
 * 3. Cross-linguistic contrast prioritization (PAM-L2)
 * 4. Slovak voicing assimilation & orthographic de-biasing
 * 5. Minimal-pair dataset validity & Ear Gym 2AFC exercise generator
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	ARTICULATORY_CUES,
	createEarGymExercise,
	functionalLoadWeightedScore,
	getArticulatoryCue,
	getFunctionalWeight,
	getPamContrastPriority,
	getPhonologyPairs,
	getVoicingAssimilationNotes,
	PHONOLOGY_PAIRS,
	type PhonologyPair,
} from "../src/core/phonology.ts";

describe("Articulatory motor guidance catalog", () => {
	test("provides explicit motor positioning for core Slovak target sounds", () => {
		const targetSounds = ["ť", "ď", "ň", "ľ", "ô", "ä", "ŕ", "ĺ", "ch", "á", "í", "ú"];
		for (const s of targetSounds) {
			const cue = getArticulatoryCue(s);
			assert.ok(cue, `Cue exists for ${s}`);
			assert.ok(cue.motor.length > 20, `Motor description is detailed for ${s}`);
			assert.ok(cue.ipa.length > 0, `IPA symbol exists for ${s}`);
			assert.ok(cue.drillWord.length > 0, `Drill word exists for ${s}`);
		}
	});

	test("handles case-insensitivity and standard phoneme aliases", () => {
		const upper = getArticulatoryCue("Ť");
		assert.ok(upper, "Finds uppercase Ť");
		assert.equal(upper.symbol, "ť");

		const aliasC = getArticulatoryCue("c");
		assert.ok(aliasC, "Maps 'c' alias to palatal stop ť");
		assert.equal(aliasC.ipa, "c");
	});
});

describe("Functional Load (FL) weighting in pronunciation scoring", () => {
	test("assigns weights based on communicative impact", () => {
		// Vowel length and palatals alter word meanings and noun cases (High FL)
		assert.equal(getFunctionalWeight("á"), 1.5, "Long vowel á is high FL");
		assert.equal(getFunctionalWeight("ť"), 1.5, "Palatal stop ť is high FL");

		// Standard consonants have medium FL
		assert.equal(getFunctionalWeight("v"), 1.0, "Consonant v is medium FL");

		// Soft ľ is merged in Western Slovak without communicative breakdown (Low FL)
		assert.equal(getFunctionalWeight("ľ"), 0.3, "Soft ľ is low FL");
	});

	test("functionalLoadWeightedScore prevents over-penalizing benign mergers", () => {
		// Learner produces word with 2 phonemes:
		// Case A: misses soft ľ (score 20), but nails the vowel (score 100)
		const caseA = [
			{ p: "ľ", score: 20 },
			{ p: "a", score: 100 },
		];
		// Unweighted average would be 60.
		// Weighted: (20 * 0.3 + 100 * 1.5) / (0.3 + 1.5) = 156 / 1.8 ≈ 87!
		const weightedA = functionalLoadWeightedScore(caseA);
		assert.ok(weightedA > 80, `Soft ľ miss only drops score to ${weightedA}, preserving communicative credit`);

		// Case B: misses vowel length on á (score 20), but gets consonant right (score 100)
		const caseB = [
			{ p: "p", score: 100 },
			{ p: "á", score: 20 },
		];
		// Weighted: (100 * 1.0 + 20 * 1.5) / (1.0 + 1.5) = 130 / 2.5 = 52.
		const weightedB = functionalLoadWeightedScore(caseB);
		assert.ok(weightedB <= 55, `Vowel length miss severely drops score to ${weightedB} due to high communicative impact`);
	});

	test("returns 0 for empty phoneme array", () => {
		assert.equal(functionalLoadWeightedScore([]), 0);
	});
});

describe("Perceptual Assimilation Model (PAM-L2) contrast prioritization", () => {
	test("prioritizes vowel length for English/Russian learners (SC) but demotes for Estonian/Czech (TC)", () => {
		const englishLearner = getPamContrastPriority("vowel_length", ["en"]);
		assert.equal(englishLearner.category, "SC");
		assert.equal(englishLearner.priority, "high");

		const estonianLearner = getPamContrastPriority("vowel_length", ["en", "et"]);
		assert.equal(estonianLearner.category, "TC");
		assert.equal(estonianLearner.priority, "low");

		const czechLearner = getPamContrastPriority("vowel_length", ["cs"]);
		assert.equal(czechLearner.category, "TC");
		assert.equal(czechLearner.priority, "low");
	});

	test("differentiates palatal contrasts by background", () => {
		const englishLearner = getPamContrastPriority("palatals", ["en"]);
		assert.equal(englishLearner.category, "SC");
		assert.equal(englishLearner.priority, "high");

		const russianLearner = getPamContrastPriority("palatals", ["ru"]);
		assert.equal(russianLearner.category, "CG");
		assert.equal(russianLearner.priority, "medium");

		const hungarianLearner = getPamContrastPriority("palatals", ["hu"]);
		assert.equal(hungarianLearner.category, "TC");
		assert.equal(hungarianLearner.priority, "low");
	});
});

describe("Slovak voicing assimilation (*spodobovanie*) & orthographic rules", () => {
	test("identifies standard regressive voicing assimilation in common words", () => {
		const vcera = getVoicingAssimilationNotes("včera");
		assert.ok(vcera);
		assert.equal(vcera.phonetic, "ftʃɛra");
		assert.ok(vcera.rule.includes("Regressive devoicing"));

		const tazko = getVoicingAssimilationNotes("ťažko!");
		assert.ok(tazko);
		assert.equal(tazko.phonetic, "caskɔ");
	});

	test("returns null for regular non-assimilated words", () => {
		assert.equal(getVoicingAssimilationNotes("stôl"), null);
		assert.equal(getVoicingAssimilationNotes("voda"), null);
	});
});

describe("Slovak phonology minimal pairs dataset", () => {
	test("contains verified minimal pairs across all five key families", () => {
		assert.ok(PHONOLOGY_PAIRS.length >= 15, "At least 15 curated minimal pairs exist");
		const families = new Set(PHONOLOGY_PAIRS.map((p) => p.family));
		assert.ok(families.has("vowel_length"), "Covers vowel length");
		assert.ok(families.has("palatals"), "Covers palatal stops");
		assert.ok(families.has("syllabic_liquids"), "Covers syllabic liquids");
		assert.ok(families.has("diphthongs"), "Covers diphthong ô");
		assert.ok(families.has("voicing"), "Covers voicing");
	});

	test("every pair is distinct, well-formed, and carries examples", () => {
		for (const p of PHONOLOGY_PAIRS) {
			assert.ok(p.id, "Pair has id");
			assert.notEqual(p.a, p.b, `Twins '${p.a}' and '${p.b}' must differ`);
			assert.ok(p.ipaA && p.ipaB, `Pair ${p.id} must have IPA for both`);
			assert.ok(p.meaningA && p.meaningB, `Pair ${p.id} must have English meanings`);
			assert.ok(p.cue.length > 10, `Pair ${p.id} has descriptive cue`);
			assert.ok(p.exampleA.length > 5 && p.exampleB.length > 5, `Pair ${p.id} has example sentences`);
		}
	});

	test("filters pairs by family and functional load", () => {
		const vowelPairs = getPhonologyPairs({ family: "vowel_length" });
		assert.ok(vowelPairs.length > 0);
		assert.ok(vowelPairs.every((p) => p.family === "vowel_length"));

		const highFlPairs = getPhonologyPairs({ minFunctionalLoad: "high" });
		assert.ok(highFlPairs.length > 0);
		assert.ok(highFlPairs.every((p) => p.functionalLoad === "high"));
	});
});

describe("Ear Gym (HVPT) 2AFC exercise generator", () => {
	const samplePair: PhonologyPair = {
		id: "pas-vs-pas",
		family: "vowel_length",
		a: "pas",
		b: "pás",
		ipaA: "pas",
		ipaB: "paːs",
		meaningA: "passport",
		meaningB: "belt / strip",
		contrast: "/a/ vs /aː/",
		functionalLoad: "high",
		cue: "Hold /aː/ twice as long as /a/.",
		exampleA: "Môj pas je tu.",
		exampleB: "Zapnite si pás.",
	};

	test("generates 2AFC options with exactly one correct answer", () => {
		const ex0 = createEarGymExercise(samplePair, 0);
		assert.equal(ex0.targetWord, "pas");
		assert.equal(ex0.targetMember, "a");
		assert.equal(ex0.options.length, 2);
		assert.equal(ex0.options.filter((o) => o.isCorrect).length, 1);
		assert.equal(ex0.genderPrompt, "female");

		const ex1 = createEarGymExercise(samplePair, 1);
		assert.equal(ex1.targetWord, "pás");
		assert.equal(ex1.targetMember, "b");
		assert.equal(ex1.options.length, 2);
		assert.equal(ex1.options.filter((o) => o.isCorrect).length, 1);
		assert.equal(ex1.genderPrompt, "female");

		const ex2 = createEarGymExercise(samplePair, 2);
		assert.equal(ex2.genderPrompt, "male", "Alternates speaker gender for multi-talker HVPT variability");
	});
});
