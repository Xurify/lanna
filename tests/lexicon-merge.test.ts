/**
 * THE LEXICON MERGE (LangHarness, 2026-10-30): a fresh slovak.wiki export
 * is merged into the shipped lexicon without moving any example, because
 * card and lesson ids are word#position. Pins: every shipped example keeps
 * its position; new examples are appended; examples the wiki dropped stay;
 * new words are added at the end.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeLexicon } from "../scripts/merge-lexicon.mjs";

const ex = (sk: string, en = sk) => ({ sk, en, src: "curated" });

describe("lexicon merge", () => {
	it("keeps every shipped example at its position and appends the new ones", () => {
		const shipped = { words: [{ slug: "kava", sk: "káva", examples: [ex("Káva je horúca."), ex("Chcem kávu.")] }] };
		const fresh = { words: [{ slug: "kava", sk: "káva", examples: [ex("Chcem kávu."), ex("Káva je horúca."), ex("Pijem kávu ráno.")] }] };
		const { lexicon, stats } = mergeLexicon(shipped, fresh);
		assert.deepEqual(lexicon.words[0].examples.map((e: { sk: string }) => e.sk), ["Káva je horúca.", "Chcem kávu.", "Pijem kávu ráno."]);
		assert.equal(stats.examplesAdded, 1);
		assert.equal(stats.examplesKept, 2);
	});

	it("keeps an example the wiki has dropped, so its card still means what it did", () => {
		const shipped = { words: [{ slug: "pes", sk: "pes", examples: [ex("Pes šteká."), ex("Pes spí.")] }] };
		const fresh = { words: [{ slug: "pes", sk: "pes", examples: [ex("Pes spí.")] }] };
		const { lexicon, stats } = mergeLexicon(shipped, fresh);
		assert.deepEqual(lexicon.words[0].examples.map((e: { sk: string }) => e.sk), ["Pes šteká.", "Pes spí."]);
		assert.equal(stats.examplesDroppedByWiki, 1);
	});

	it("adopts a cloze the fresh export finds for a shipped example that had none, and changes nothing else", () => {
		const sentence = "Teplota dnes dosiahne dvadsať stupňov.";
		const shipped = { words: [{ slug: "dosiahnut", sk: "dosiahnuť", examples: [ex(sentence)] }] };
		const cloze = { answer: "dosiahne", at: 13 };
		const fresh = { words: [{ slug: "dosiahnut", sk: "dosiahnuť", examples: [{ ...ex(sentence), cloze }] }] };
		const { lexicon, stats } = mergeLexicon(shipped, fresh);
		assert.deepEqual(lexicon.words[0].examples[0], { ...ex(sentence), cloze });
		assert.equal(stats.clozesAdopted, 1);
	});

	it("gives no blank to a rejected example", () => {
		const sentence = "Ponúkli mi prácu.";
		const shipped = { words: [{ slug: "ponuknut", sk: "ponúknuť", examples: [{ ...ex(sentence), rejected: true }] }] };
		const fresh = { words: [{ slug: "ponuknut", sk: "ponúknuť", examples: [{ ...ex(sentence), cloze: { answer: "Ponúkli", at: 0 } }] }] };
		const { lexicon, stats } = mergeLexicon(shipped, fresh);
		assert.equal(lexicon.words[0].examples[0].cloze, undefined);
		assert.equal(stats.clozesAdopted, 0);
	});

	it("adds new words at the end and takes the fresh export's header", () => {
		const shipped = { source: "old", words: [{ slug: "a", sk: "a", examples: [] }] };
		const fresh = { source: "new", exportedAt: "2026-10-30", words: [{ slug: "a", sk: "a", examples: [] }, { slug: "dzus", sk: "dzus", examples: [ex("Dzus je dobrý.")] }] };
		const { lexicon, stats } = mergeLexicon(shipped, fresh);
		assert.equal(lexicon.source, "new");
		assert.deepEqual(lexicon.words.map((w: { slug: string }) => w.slug), ["a", "dzus"]);
		assert.equal(stats.wordsAdded, 1);
	});
});
