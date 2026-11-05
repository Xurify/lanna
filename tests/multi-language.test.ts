/**
 * Multi-Language architecture tests:
 * Tests the generalized language registry, diacritic folding across Slovak,
 * Czech, Romanian, and Russian, profile metadata, lexicon loading with
 * lemma/text normalization, and graceful asset fallback for curriculum.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LANGUAGE_PROFILES } from "../config.ts";
import { compareAnswer, diacriticSlips, foldDiacritics, LANGUAGES, LANGUAGE_CATALOG, LANGUAGE_IDS } from "../src/core/language.ts";
import { loadLexicon, lookupWord } from "../src/agent/lexicon.ts";
import { entryLemma, exampleText, pickClozeExample, mintCard } from "../src/core/review.ts";
import { getPairsForLanguage } from "../src/core/pairs.ts";
import { scriptFor } from "../src/core/speak-script.ts";

describe("multi-language architecture", () => {
	it("registers active language profiles in config and core", () => {
		const expected = ["slovak"];
		assert.deepEqual([...LANGUAGE_PROFILES].sort(), expected);
		assert.deepEqual([...LANGUAGE_IDS].sort(), expected);
		for (const id of LANGUAGE_PROFILES) {
			assert.ok(LANGUAGES[id], `Language info registered for ${id}`);
			assert.ok(LANGUAGES[id].code, `Code defined for ${id}`);
			assert.ok(LANGUAGES[id].tag, `Tag defined for ${id}`);
			assert.ok(LANGUAGES[id].endonym, `Endonym defined for ${id}`);
			assert.ok(LANGUAGES[id].edgeVoices.length > 0, `At least one Edge TTS voice defined for ${id}`);
		}
	});

	it("lists the languages the app can add, each with its sources and a voice", () => {
		const ids = LANGUAGE_CATALOG.map((l) => l.id);
		assert.deepEqual([...ids].sort(), ["bulgarian", "czech", "estonian", "norwegian", "polish", "romanian", "russian"]);
		assert.equal(new Set(ids).size, ids.length);
		for (const l of LANGUAGE_CATALOG) {
			assert.match(l.tag, /^[a-z]{2}-[A-Z]{2}$/, l.id);
			assert.equal(l.code, l.tag.split("-")[0]);
			assert.match(l.tatoeba, /^[a-z]{3}$/, l.id);
			assert.ok(l.wiktionary, l.id);
			assert.ok(l.edgeVoices.length > 0 && l.edgeVoices.every((v) => v.startsWith(`${l.tag}-`)), l.id);
			assert.ok(l.referenceSite?.wordUrl?.includes("{word}"), l.id);
		}
	});

	it("folds diacritics and letters across Czech, Romanian, Russian, and Slovak", () => {
		// Czech
		assert.equal(
			foldDiacritics("Příliš žluťoučký kůň úpěl ďábelské ódy"),
			"Prilis zlutoucky kun upel dabelske ody",
		);
		// Romanian
		assert.equal(
			foldDiacritics("Câinele mănâncă pâine în curte"),
			"Cainele mananca paine in curte",
		);
		assert.equal(
			foldDiacritics("o țară frumoasă cu școală"),
			"o tara frumoasa cu scoala",
		);
		// Slovak
		assert.equal(
			foldDiacritics("Môj dĺžeň a mäkčeň"),
			"Moj dlzen a makcen",
		);
		// Russian
		assert.equal(
			foldDiacritics("Ёлка и ёж"),
			"Елка и еж",
		);
	});

	it("identifies diacritic slips in Czech and Romanian", () => {
		// Czech: 'děkuji' vs 'dekuji' has slip at position 1 (ě -> e)
		assert.deepEqual(diacriticSlips("děkuji", "dekuji"), [1]);
		// Romanian: 'apă' vs 'apa' has slip at position 2 (ă -> a)
		assert.deepEqual(diacriticSlips("apă", "apa"), [2]);
	});

	it("evaluates answers with compareAnswer for multiple languages", () => {
		assert.equal(compareAnswer("děkuji", "děkuji", "cs-CZ"), "exact");
		assert.equal(compareAnswer("děkuji", "dekuji", "cs-CZ"), "accents");
		assert.equal(compareAnswer("děkuji", "prosím", "cs-CZ"), "wrong");

		assert.equal(compareAnswer("apă", "apă", "ro-RO"), "exact");
		assert.equal(compareAnswer("apă", "apa", "ro-RO"), "accents");
		assert.equal(compareAnswer("apă", "cafea", "ro-RO"), "wrong");
	});

	it("normalizes and mints cards from generic LexiconEntry with lemma and text", () => {
		const sampleEntry = {
			slug: "kava",
			lemma: "káva",
			cat: "Nouns",
			pos: "noun",
			related: [],
			en: "coffee",
			examples: [
				{
					text: "Mám rád černou kávu.",
					src: "curated",
					cloze: { answer: "kávu", at: 15 },
					en: "I like black coffee.",
				},
			],
		};

		assert.equal(entryLemma(sampleEntry), "káva");
		assert.equal(exampleText(sampleEntry.examples[0]!), "Mám rád černou kávu.");

		const exIndex = pickClozeExample(sampleEntry);
		assert.equal(exIndex, 0);
		const card = mintCard(sampleEntry, exIndex!, new Date("2026-11-01T00:00:00Z"))!;
		assert.equal(card.lemma, "káva");
		assert.equal(card.answer, "kávu");
		assert.equal(card.sentence, "Mám rád černou kávu.");
	});

	it("gracefully falls back when curriculum assets are not present", () => {
		// A language that is not added has no lexicon
		assert.equal(loadLexicon("russian"), null);
		assert.deepEqual(lookupWord("привет", "russian"), { query: "привет", match: "none", entries: [] });

		// Non-Slovak languages return empty pairs list without crashing
		assert.deepEqual(getPairsForLanguage("russian"), []);
		assert.deepEqual(getPairsForLanguage("czech"), []);

		// Slovak still has its pairs
		assert.ok(getPairsForLanguage("slovak").length > 0);

		// Non-Slovak languages return undefined for scenes without crashing
		assert.equal(scriptFor("cafe", "russian"), undefined);
		assert.equal(scriptFor("cafe", "czech"), undefined);
		assert.equal(scriptFor("cafe", "romanian"), undefined);

		// Slovak still has its scripts
		assert.ok(scriptFor("cafe", "slovak") !== undefined);
	});
});
