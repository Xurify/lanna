/**
 * LangHarness additions: answer comparison, the FSRS scheduler, the cloze
 * card model, the lexicon lookup, the seed file's integrity, the language
 * prompt composition, and the review service over a throwaway data dir.
 * Deterministic: no LLM, no network.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-lang-"));
process.env.LH_DATA_DIR = dataDir;
delete process.env.LH_PROFILE;

const { compareAnswer, diacriticSlips, foldDiacritics, LANGUAGES, LANGUAGE_IDS } = await import("../src/core/language.ts");
const { review, intervalDays, retrievability, initialState, nextDue, formatInterval, FSRS5_WEIGHTS } = await import("../src/core/fsrs.ts");
const { pickClozeExample, mintCard, clozeParts, ratingFor, dueCards, lexiconOrder } = await import("../src/core/review.ts");
const { LANGUAGE_PROFILES, ACTIVE_PROFILE, PATHS } = await import("../config.ts");
const { lookupWord, loadLexicon, formatEntry } = await import("../src/agent/lexicon.ts");
const { listSourceSegments } = await import("../src/agent/prompt-segments.ts");
const { isValidSegmentPath } = await import("../src/core/prompt-segments.ts");
const { spokenText } = await import("../components/speech.tsx");

describe("answer comparison", () => {
	it("separates exact, accents-only and wrong", () => {
		assert.equal(compareAnswer("ženou", "ženou"), "exact");
		assert.equal(compareAnswer("ženou", "  Ženou. "), "exact", "case, spaces and end punctuation never count");
		assert.equal(compareAnswer("ženou", "zenou"), "accents");
		assert.equal(compareAnswer("vína", "vina"), "accents", "a length slip is a spelling slip, not a different answer");
		assert.equal(compareAnswer("ženou", "žene"), "wrong");
		assert.equal(compareAnswer("ženou", ""), "wrong");
	});
	it("folds Slovak and Russian marks", () => {
		assert.equal(foldDiacritics("ďakujem, mäkčeň, ľúbiť"), "dakujem, makcen, lubit");
		assert.equal(foldDiacritics("ёж"), "еж");
	});
	it("locates the letters that slipped", () => {
		assert.deepEqual(diacriticSlips("človek", "clovek"), [0]);
		assert.deepEqual(diacriticSlips("dĺžeň", "dlzen"), [1, 2, 4]);
	});
	it("config and core agree on the profiles", () => {
		assert.deepEqual([...LANGUAGE_PROFILES].sort(), [...LANGUAGE_IDS].sort());
		assert.ok(LANGUAGES.slovak.specialLetters.includes("ô"));
	});
});

describe("FSRS-5", () => {
	it("R(S, S) = 0.9 and the interval at 90% equals stability", () => {
		assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
		assert.equal(intervalDays(10, 0.9), 10);
		assert.ok(intervalDays(10, 0.8) > 10, "lower retention, longer interval");
	});
	it("first ratings use the published initial stabilities", () => {
		assert.equal(initialState(3).stability, FSRS5_WEIGHTS[2]);
		assert.ok(initialState(1).difficulty > initialState(4).difficulty);
	});
	it("Good grows stability, Again shrinks it", () => {
		const s0 = initialState(3);
		const good = review(s0, 3, 3);
		const again = review(s0, 1, 3);
		assert.ok(good.stability > s0.stability);
		assert.ok(again.stability <= s0.stability);
		assert.ok(again.difficulty > s0.difficulty);
	});
	it("Again comes back within the session, Good waits days", () => {
		const now = new Date("2026-10-26T12:00:00Z");
		const s = review(initialState(3), 3, 3);
		assert.ok(nextDue(now, s, 1).getTime() - now.getTime() < 3_600_000);
		assert.ok(nextDue(now, s, 3).getTime() - now.getTime() >= 86_400_000);
		assert.equal(formatInterval(10 / 1440), "10m");
		assert.equal(formatInterval(45), "2mo");
	});
});

describe("the lexicon", () => {
	const lexicon = loadLexicon("slovak");
	it("loads the bundled Slovak dictionary", () => {
		assert.ok(lexicon && lexicon.entries.length > 5000);
	});
	it("finds inflected forms, unaccented spellings and English glosses", () => {
		assert.equal(lookupWord("ženou", "slovak").entries[0]?.sk, "žena");
		const folded = lookupWord("zena", "slovak");
		assert.equal(folded.match, "folded");
		assert.equal(lookupWord("bread", "slovak").match, "english");
		assert.equal(lookupWord("qqqq", "slovak").match, "none");
	});
	it("says when a form is checked and when it is not", () => {
		const zena = lexicon!.bySlug.get("zena")!;
		assert.match(formatEntry(zena), /JÚĽŠ/);
		const noForms = lexicon!.entries.find((e) => !e.declension && !e.forms)!;
		assert.match(formatEntry(noForms), /not in the dictionary/);
	});
	it("Russian has no lexicon yet", () => {
		assert.equal(loadLexicon("russian"), null);
	});
});

describe("cloze cards", () => {
	const lexicon = loadLexicon("slovak")!;
	it("every exported cloze points at its answer", () => {
		for (const e of lexicon.entries.slice(0, 500)) {
			for (const ex of e.examples) {
				if (!ex.cloze) continue;
				assert.equal(ex.sk.slice(ex.cloze.at, ex.cloze.at + ex.cloze.answer.length), ex.cloze.answer, `${e.slug}: ${ex.sk}`);
			}
		}
	});
	it("mints a card from the best sentence and splits it around the blank", () => {
		const entry = lexicon.bySlug.get("zena")!;
		const i = pickClozeExample(entry);
		assert.notEqual(i, undefined);
		const card = mintCard(entry, i!, new Date())!;
		const { before, after } = clozeParts(card);
		assert.equal(before + card.answer + after, card.sentence);
	});
	it("maps verdicts to ratings and orders the queue", () => {
		assert.equal(ratingFor("wrong"), 1);
		assert.equal(ratingFor("accents"), 2);
		assert.equal(ratingFor("exact", 2000), 4);
		assert.equal(ratingFor("exact", 9000), 3);
		const sorted = [...lexicon.entries].sort(lexiconOrder);
		assert.equal(sorted[0]!.origin, "curated", "beginner words come first");
		const now = new Date();
		const base = mintCard(lexicon.bySlug.get("zena")!, pickClozeExample(lexicon.bySlug.get("zena")!)!, now)!;
		const due = dueCards(
			[
				{ ...base, id: "a", state: "review", due: new Date(now.getTime() - 1000).toISOString() },
				{ ...base, id: "b", state: "learning", due: new Date(now.getTime() - 10).toISOString() },
				{ ...base, id: "c", state: "review", due: new Date(now.getTime() + 60_000).toISOString() },
				{ ...base, id: "d", state: "new" },
			],
			now,
		);
		assert.deepEqual(
			due.map((c) => c.id),
			["b", "a"],
		);
	});
});

describe("the Slovak seed", () => {
	const seed = JSON.parse(fs.readFileSync(path.join(PATHS.curriculum, "slovak", "seed.json"), "utf-8")) as {
		nodes: Array<{ key: string; statement: string; kind: string }>;
		chains: Array<{ premises: string[]; conclusion: string }>;
	};
	it("is built and internally consistent", () => {
		const keys = new Set(seed.nodes.map((n) => n.key));
		assert.equal(keys.size, seed.nodes.length);
		assert.ok(seed.nodes.filter((n) => n.kind === "grammar").length >= 50);
		assert.ok(seed.nodes.filter((n) => n.kind === "vocabulary").length >= 40);
		for (const c of seed.chains) for (const k of [...c.premises, c.conclusion]) assert.ok(keys.has(k), k);
		assert.ok(!seed.nodes.some((n) => n.statement.includes("'?'")), "every vocabulary word has an English gloss");
	});
	it("prerequisites form no cycle", () => {
		const next = new Map<string, string[]>();
		for (const c of seed.chains) for (const p of c.premises) next.set(p, [...(next.get(p) ?? []), c.conclusion]);
		const state = new Map<string, 1 | 2>();
		const visit = (k: string): void => {
			if (state.get(k) === 2) return;
			assert.notEqual(state.get(k), 1, `cycle through ${k}`);
			state.set(k, 1);
			for (const n of next.get(k) ?? []) visit(n);
			state.set(k, 2);
		};
		for (const n of seed.nodes) visit(n.key);
	});
});

describe("language prompts", () => {
	it("compose the active language into every agent", () => {
		assert.equal(ACTIVE_PROFILE, "slovak");
		for (const agent of ["prober", "teacher", "practice"] as const) {
			const paths = listSourceSegments(agent).map((s) => s.path);
			assert.ok(paths.includes("language/10-slovak.md"), agent);
			assert.ok(!paths.includes("language/10-russian.md"), agent);
		}
		assert.ok(isValidSegmentPath("language/10-slovak.md"));
	});
	it("say: spans are recognized", () => {
		assert.equal(spokenText("say: Dobrý deň!"), "Dobrý deň!");
		assert.equal(spokenText("const x = 1"), null);
	});
});

describe("the review service", () => {
	it("mints, grades and schedules in the profile's data dir", async () => {
		const { reviewStatus, answerReview, enqueueWords, reviewDigest } = await import("../src/server/review.ts");
		const now = new Date("2026-10-26T09:00:00Z");
		const first = reviewStatus(now, 0);
		assert.ok(first.available);
		assert.ok(first.next, "a new card is minted");
		assert.equal(first.counts.newToday, 1);
		const card = first.next!.card;
		assert.equal(new Set(first.next!.options).size, first.next!.options.length);
		assert.ok(first.next!.options.includes(card.answer));
		const outcome = answerReview({ cardId: card.id, given: foldDiacritics(card.answer), ms: 6000 }, now);
		assert.equal(outcome.verdict, foldDiacritics(card.answer) === card.answer ? "exact" : "accents");
		assert.equal(outcome.card.reps, 1);
		assert.ok(Date.parse(outcome.card.due) > now.getTime());
		assert.ok(fs.existsSync(path.join(dataDir, "profiles", "slovak", "review", "log.jsonl")));
		assert.deepEqual(enqueueWords(["chlieb"], now), ["chlieb"]);
		assert.deepEqual(enqueueWords(["chlieb"], now), [], "a word is queued once");
		assert.match(reviewDigest(now), /words in the deck/);
	});
});
