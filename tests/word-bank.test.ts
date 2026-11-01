/**
 * Tests for Word Bank, Saved Phrases, and Word Favorites (LangHarness).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-word-bank-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { calculateRetention, classifyWordState } = await import("../src/core/saved-phrases.ts");
const { savedPhraseStore } = await import("../src/store/saved-phrases.ts");
const { getWordBank } = await import("../src/server/word-bank.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

describe("retention calculations (Lingvist/Speakly style)", () => {
	it("unreviewed or new cards have 0% retention", () => {
		assert.equal(calculateRetention(undefined), 0);
		assert.equal(calculateRetention({ state: "new", reps: 0 }), 0);
	});

	it("learning cards scale retention with reps up to 50%", () => {
		const r1 = calculateRetention({ state: "learning", reps: 1 });
		const r3 = calculateRetention({ state: "learning", reps: 3 });
		assert.ok(r1 > 0);
		assert.ok(r3 >= r1);
		assert.ok(r3 <= 50);
	});

	it("review cards scale retention with stability and penalize lapses", () => {
		const highStability = calculateRetention({
			state: "review",
			reps: 10,
			lapses: 0,
			memory: { stability: 25 },
		});
		assert.ok(highStability >= 90, `expected >= 90, got ${highStability}`);

		const moderateStability = calculateRetention({
			state: "review",
			reps: 5,
			lapses: 0,
			memory: { stability: 7 },
		});
		assert.ok(moderateStability < highStability);
		assert.ok(moderateStability >= 65);

		const withLapses = calculateRetention({
			state: "review",
			reps: 10,
			lapses: 3,
			memory: { stability: 25 },
		});
		assert.ok(withLapses < highStability);
	});

	it("classifies word state into unseen, new, learning, or mastered", () => {
		assert.equal(classifyWordState(undefined), "unseen");
		assert.equal(classifyWordState({ state: "new", reps: 0 }), "new");
		assert.equal(classifyWordState({ state: "learning", reps: 2 }), "learning");
		assert.equal(classifyWordState({ state: "review", reps: 10, memory: { stability: 25 } }), "mastered");
	});
});

describe("saved phrases store", () => {
	it("initializes with curated starter phrases if none exist", () => {
		const phrases = savedPhraseStore.readPhrases();
		assert.ok(phrases.length >= 5);
		assert.ok(phrases.some((p) => p.text.includes("chlieb")));
	});

	it("saves a new phrase and detects if saved", () => {
		const saved = savedPhraseStore.savePhrase({
			text: "Vysoké Tatry sú nádherné.",
			translation: "The High Tatras are beautiful.",
			source: "manual",
			context: "Test context",
		});
		assert.ok(saved.id.startsWith("sp_"));
		assert.equal(savedPhraseStore.isSaved("Vysoké Tatry sú nádherné."), true);
		assert.equal(savedPhraseStore.isSaved("Náhodná veta"), false);
	});

	it("does not create duplicate saved phrases for the same sentence", () => {
		const countBefore = savedPhraseStore.readPhrases().length;
		const second = savedPhraseStore.savePhrase({
			text: "Vysoké Tatry sú nádherné.",
			translation: "The High Tatras are beautiful.",
			source: "story",
		});
		const countAfter = savedPhraseStore.readPhrases().length;
		assert.equal(countAfter, countBefore);
		assert.equal(savedPhraseStore.isSaved("Vysoké Tatry sú nádherné."), true);
	});

	it("removes a phrase by id or text", () => {
		const p = savedPhraseStore.savePhrase({
			text: "Dočasná veta na zmazanie.",
			translation: "Temporary sentence to delete.",
			source: "lesson",
		});
		assert.equal(savedPhraseStore.isSaved("Dočasná veta na zmazanie."), true);
		const removed = savedPhraseStore.removePhrase(p.id);
		assert.equal(removed, true);
		assert.equal(savedPhraseStore.isSaved("Dočasná veta na zmazanie."), false);
	});
});

describe("word favorites", () => {
	it("toggles favorite status on and off", () => {
		const slug = "chlieb";
		assert.equal(savedPhraseStore.isFavorite(slug), false);

		const nowFav = savedPhraseStore.toggleFavorite(slug);
		assert.equal(nowFav, true);
		assert.equal(savedPhraseStore.isFavorite(slug), true);

		const unFav = savedPhraseStore.toggleFavorite(slug);
		assert.equal(unFav, false);
		assert.equal(savedPhraseStore.isFavorite(slug), false);
	});

	it("sets favorite explicitly", () => {
		const slug = "voda";
		savedPhraseStore.setFavorite(slug, true);
		assert.equal(savedPhraseStore.isFavorite(slug), true);

		savedPhraseStore.setFavorite(slug, false);
		assert.equal(savedPhraseStore.isFavorite(slug), false);
	});
});

describe("getWordBank", () => {
	it("returns paginated lexicon entries with summary metrics", () => {
		savedPhraseStore.setFavorite("chlieb", true);
		const res = getWordBank({ limit: 10 });
		assert.ok(res.total > 0);
		assert.equal(res.items.length, 10);
		assert.ok(res.summary.totalWords > 0);
		assert.ok(res.summary.wordsFavorited >= 1);
		assert.ok(res.items[0]?.favorite === true || res.items[0]?.inDeck === true);
	});

	it("filters by search term", () => {
		const res = getWordBank({ search: "chlieb" });
		assert.ok(res.items.length >= 1);
		assert.ok(res.items.some((i) => i.lemma.toLowerCase().includes("chlieb") || i.gloss.toLowerCase().includes("bread")));
	});

	it("filters by favorite status", () => {
		savedPhraseStore.setFavorite("mesto", true);
		const res = getWordBank({ status: "favorite" });
		assert.ok(res.items.length >= 1);
		assert.ok(res.items.every((i) => i.favorite === true));
	});
});
