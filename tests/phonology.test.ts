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
	contrastSpans,
	createEarGymExercise,
	EAR_GYM_ROUND,
	earGymRound,
	functionalLoadWeightedScore,
	getArticulatoryCue,
	getFunctionalWeight,
	getPamContrastPriority,
	getPhonologyData,
	getPhonologyPairs,
	getVoicingAssimilationNotes,
	type PhonologyPair,
} from "../src/core/phonology.ts";
import { hasRhythmPage } from "../src/core/rhythm.ts";

const PHONOLOGY_PAIRS = getPhonologyData("slovak")!.pairs;

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

	test("handles case-insensitivity and requires exact NFC match without plain consonant fallback", () => {
		const upper = getArticulatoryCue("Ť");
		assert.ok(upper, "Finds uppercase Ť");
		assert.equal(upper.symbol, "ť");

		assert.equal(getArticulatoryCue("t"), null, "Plain 't' returns null");
		assert.equal(getArticulatoryCue("d"), null, "Plain 'd' returns null");
		assert.notEqual(getArticulatoryCue("ť"), null, "Palatal 'ť' returns cue");
		assert.notEqual(getArticulatoryCue("ď"), null, "Palatal 'ď' returns cue");
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

		const czechLearner = getPamContrastPriority("palatals", ["cs"]);
		assert.equal(czechLearner.category, "TC");
		assert.equal(czechLearner.priority, "low");
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
		assert.equal(tazko.phonetic, "caʃkɔ");
	});

	test("returns null for regular non-assimilated words", () => {
		assert.equal(getVoicingAssimilationNotes("stôl"), null);
		assert.equal(getVoicingAssimilationNotes("voda"), null);
	});
});

describe("Bundled phonology datasets validation", () => {
	const bundledLangs = ["slovak", "russian"];

	for (const lang of bundledLangs) {
		describe(`${lang} dataset`, () => {
			test("loads dataset by language id", () => {
				const data = getPhonologyData(lang);
				assert.ok(data, `Dataset exists for ${lang}`);
				assert.equal(data.language, lang);
				assert.ok(data.pairs.length > 0, `${lang} has pairs`);
				assert.ok(data.families.length > 0, `${lang} has declared families`);
			});

			test("every pair is well-formed with distinct words, distinct IPAs, and unique IDs", () => {
				const data = getPhonologyData(lang);
				assert.ok(data);
				const ids = new Set<string>();
				for (const p of data.pairs) {
					assert.ok(p.id, `Pair has id in ${lang}`);
					assert.ok(!ids.has(p.id), `Duplicate pair id '${p.id}' in ${lang}`);
					ids.add(p.id);

					assert.notEqual(p.a, p.b, `Words '${p.a}' and '${p.b}' must differ in pair ${p.id}`);
					assert.notEqual(p.ipaA, p.ipaB, `IPAs '${p.ipaA}' and '${p.ipaB}' must differ in pair ${p.id}`);
					assert.ok(p.meaningA && p.meaningB, `Pair ${p.id} has meanings`);
					assert.ok(p.cue && p.cue.length > 5, `Pair ${p.id} has cue`);
					assert.ok(p.cue.length <= 100, `Pair ${p.id}: the cue is ${p.cue.length} characters; over 100 it runs past the three lines the card keeps for it on a phone`);
					assert.ok(p.exampleA && p.exampleB, `Pair ${p.id} has examples`);
				}
			});

			test("each example sentence holds its word in exactly that form", () => {
				const data = getPhonologyData(lang);
				assert.ok(data);
				const holds = (word: string, sentence: string) => sentence.toLowerCase().split(/[^\p{L}]+/u).includes(word.toLowerCase());
				for (const p of data.pairs) {
					assert.ok(holds(p.a, p.exampleA), `${p.id}: "${p.exampleA}" does not hold "${p.a}"`);
					assert.ok(holds(p.b, p.exampleB), `${p.id}: "${p.exampleB}" does not hold "${p.b}"`);
				}
			});

			test("the letters a contrast names are found in both words, where the words differ", () => {
				const data = getPhonologyData(lang);
				assert.ok(data);
				for (const p of data.pairs) {
					const spans = contrastSpans(p);
					assert.ok(spans, `${p.id}: no letters to mark for "${p.contrast}"`);
					const [left, right] = p.contrast.split(",")[0]!.split(" and ");
					assert.equal(p.a.slice(...spans.a).toLowerCase(), left);
					assert.equal(p.b.slice(...spans.b).toLowerCase(), right);
					assert.equal(p.a.slice(0, spans.a[0]), p.b.slice(0, spans.b[0]), `${p.id}: the words differ before the marked letters`);
					assert.equal(p.a.slice(spans.a[1]), p.b.slice(spans.b[1]), `${p.id}: the words differ after the marked letters`);
				}
			});

			test("every pair's family is declared in the file", () => {
				const data = getPhonologyData(lang);
				assert.ok(data);
				const declared = new Set(data.families.map((f) => f.id));
				for (const p of data.pairs) {
					assert.ok(declared.has(p.family), `Family '${p.family}' in pair ${p.id} must be declared in ${lang}`);
				}
			});

			test("every family has at least 3 pairs", () => {
				const data = getPhonologyData(lang);
				assert.ok(data);
				for (const f of data.families) {
					const count = data.pairs.filter((p) => p.family === f.id).length;
					assert.ok(count >= 3, `Family '${f.id}' in ${lang} must have at least 3 pairs, got ${count}`);
				}
			});
		});
	}

	test("returns null for unknown language id", () => {
		assert.equal(getPhonologyData("unknown"), null);
		assert.equal(getPhonologyData("estonian"), null);
		assert.equal(getPhonologyData(""), null);
		assert.equal(getPhonologyData(undefined), null);
		assert.equal(getPhonologyData("sk"), null);
		assert.deepEqual(getPhonologyPairs("estonian"), []);
	});

	test("hasRhythmPage is true for Slovak and false for Russian and other languages", () => {
		assert.equal(hasRhythmPage("slovak"), true);
		assert.equal(hasRhythmPage("russian"), false);
		assert.equal(hasRhythmPage("estonian"), false);
		assert.equal(hasRhythmPage(undefined), false);
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
			assert.notEqual(p.ipaA, p.ipaB, `Pair ${p.id} must have distinct IPAs: ${p.ipaA} vs ${p.ipaB}`);
			assert.ok(p.ipaA && p.ipaB, `Pair ${p.id} must have IPA for both`);
			assert.ok(p.meaningA && p.meaningB, `Pair ${p.id} must have English meanings`);
			assert.ok(p.cue.length > 10, `Pair ${p.id} has descriptive cue`);
			assert.ok(p.exampleA.length > 5 && p.exampleB.length > 5, `Pair ${p.id} has example sentences`);
		}
	});

	test("filters pairs by family and functional load", () => {
		const vowelPairs = getPhonologyPairs("slovak", { family: "vowel_length" });
		assert.ok(vowelPairs.length > 0);
		assert.ok(vowelPairs.every((p) => p.family === "vowel_length"));

		const highFlPairs = getPhonologyPairs("slovak", { minFunctionalLoad: "high" });
		assert.ok(highFlPairs.length > 0);
		assert.ok(highFlPairs.every((p) => p.functionalLoad === "high"));

		const russianHardSoft = getPhonologyPairs("russian", { family: "hard_soft" });
		assert.ok(russianHardSoft.length >= 5);
		assert.ok(russianHardSoft.every((p) => p.family === "hard_soft"));
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

describe("Ear Gym round", () => {
	test("a round has the round size, even from a pool smaller than it", () => {
		assert.equal(earGymRound(PHONOLOGY_PAIRS, 7).length, EAR_GYM_ROUND);
		const small = getPhonologyPairs("slovak", { family: "diphthongs" });
		assert.ok(small.length < EAR_GYM_ROUND);
		const round = earGymRound(small, 7);
		assert.equal(round.length, EAR_GYM_ROUND);
		assert.ok(round.every((trial) => small.some((p) => p.id === trial.pairId)));
	});

	test("the same seed gives the same round, another seed a different one", () => {
		const words = (seed: number) => earGymRound(PHONOLOGY_PAIRS, seed).map((trial) => trial.targetWord).join(" ");
		assert.equal(words(42), words(42));
		assert.notEqual(words(42), words(43));
	});

	test("the word played is not always the same member of the pair", () => {
		const members = new Set(earGymRound(PHONOLOGY_PAIRS, 3, 40).map((trial) => trial.targetMember));
		assert.deepEqual([...members].sort(), ["a", "b"]);
	});

	test("pickRoundPairs does not repeat the same pair consecutively when pool > 1", () => {
		const round = earGymRound(PHONOLOGY_PAIRS, 123, 30);
		for (let i = 1; i < round.length; i++) {
			assert.notEqual(round[i]!.pairId, round[i - 1]!.pairId, `Consecutive pairId must not match at index ${i}`);
		}
	});

	test("an empty pool gives no round", () => {
		assert.deepEqual(earGymRound([], 1), []);
	});
});

describe("contrastSpans", () => {
	test("marks one letter, a letter pair, and a letter that only one word has more of", () => {
		assert.deepEqual(contrastSpans({ a: "pas", b: "pás", contrast: "a and á" }), { a: [1, 2], b: [1, 2] });
		assert.deepEqual(contrastSpans({ a: "mesto", b: "miesto", contrast: "e and ie" }), { a: [1, 2], b: [1, 3] });
		assert.deepEqual(contrastSpans({ a: "мат", b: "мать", contrast: "т and ть" }), { a: [2, 3], b: [2, 4] });
		assert.deepEqual(contrastSpans({ a: "rad", b: "raď", contrast: "d and ď, heard as t and ť at the end of a word" }), { a: [2, 3], b: [2, 3] });
	});

	test("gives null when the contrast does not name letters of the words", () => {
		assert.equal(contrastSpans({ a: "pas", b: "pás", contrast: "/a/ vs /aː/" }), null);
		assert.equal(contrastSpans({ a: "pas", b: "pás", contrast: "o and ô" }), null);
	});
});
