/**
 * WHICH PAIR TO CATCH (2026-11-05; creator-hooks proposal 6): the
 * chooser and the checker for the deliberate wrong word in Catch the mistake
 * (src/core/catch-pair.ts). The item itself is covered in catch-mistake.test.ts.
 * Runs under an isolated LANNA_DATA_DIR (the scratch folder when one is set).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import type { Mixup, MixupRecord } from "../src/core/mixups.ts";
import { PAIRS } from "../src/core/pairs.ts";
import {
	chooseCatch,
	CATCH_MIN_MISSES,
	CATCH_RECENT_ITEMS,
	verifyCatch,
	type CatchLexicon,
	type CatchTarget,
} from "../src/core/catch-pair.ts";
import { tokenize, type StorySentence } from "../src/core/reading.ts";

const TMP_DATA = process.env.LANNA_DATA_DIR ? undefined : fs.mkdtempSync(path.join(os.tmpdir(), "lanna-slip-"));
if (TMP_DATA) process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { loadLexicon } = await import("../src/agent/lexicon.ts");

after(() => {
	if (TMP_DATA) fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const lexicon = loadLexicon()!;
const pairLexicon: CatchLexicon = { entries: lexicon.entries, bySlug: lexicon.bySlug };

/** A mix-up on record, with the last miss as evidence: what the sentence asked for and what was given. */
function mixup(
	a: string,
	b: string,
	misses: number,
	opts: { answer?: string; given?: string; hits?: number; lastAt?: string } = {},
): Mixup {
	const at = opts.lastAt ?? "2026-11-02T10:00:00.000Z";
	return {
		a,
		b,
		words: [a, b],
		since: "2026-11-01T10:00:00.000Z",
		lastAt: at,
		misses,
		hits: opts.hits ?? 0,
		seen: [{ at, sentence: "Kam ideš?", answer: opts.answer ?? "Kam", given: opts.given ?? "kde" }],
	};
}

const choice = (record: MixupRecord, recentPairs: string[] = [], speaker = "Martin") => ({
	record,
	lexicon: pairLexicon,
	pairs: PAIRS,
	recentPairs,
	speaker,
});

/** A sentence as the reader holds it: its word tokens, and who says it. */
function line(sk: string, who?: string): StorySentence {
	return { sk, en: "", tokens: tokenize(sk).map((t) => ({ text: t.text, word: t.word })), ...(who ? { who } : {}) };
}

/** A short Martin episode: the slip in sentence 1, the repair in sentence 2. */
function episode(mistakeSentence = "Kde ideme dnes?", repair = "Kam, nie kde! Ideme do centra."): StorySentence[] {
	return [
		line("Martin je v Bratislave.", "Martin"),
		line(mistakeSentence, "Martin"),
		line(repair, "Martin"),
		line("Super.", "Martin"),
	];
}

/** The kam/kde target, chosen from the record the chooser reads. */
function kamTarget(): CatchTarget {
	const target = chooseCatch(choice({ "kam~kde": mixup("kam", "kde", 2) }));
	assert.ok(target, "kam and kde qualify");
	return target;
}

describe("choosing the pair", () => {
	it("no candidate: nothing on record, one miss, a pair that is not verified, no lead, no evidence", () => {
		assert.equal(chooseCatch(choice({})), null);
		assert.equal(chooseCatch(choice({ "kam~kde": mixup("kam", "kde", 1) })), null);
		assert.equal(
			chooseCatch(
				choice({ "hovorit~oznamit": mixup("oznamit", "hovorit", 4, { answer: "Oznámil", given: "hovoril" }) }),
			),
			null,
		);
		assert.equal(chooseCatch(choice({ "kam~kde": mixup("kam", "kde", 2) }, [], "")), null);
		const noEvidence = { ...mixup("kam", "kde", 2), seen: undefined };
		assert.equal(chooseCatch(choice({ "kam~kde": noEvidence })), null);
	});

	it("one candidate: a pair missed twice, verified, with the sentence's form as the right word", () => {
		const target = kamTarget();
		assert.equal(CATCH_MIN_MISSES, 2);
		assert.equal(target.pair, "kam-vs-kde");
		assert.equal(target.speaker, "Martin");
		assert.equal(target.right.slug, "kam");
		assert.equal(target.wrong.slug, "kde");
		assert.equal(target.rule, PAIRS.find((p) => p.id === "kam-vs-kde")!.rule);
		assert.ok(target.wrong.forms.includes("kde"));
	});

	it("the direction is the learner's real mistake: the word they gave is the wrong one", () => {
		const target = chooseCatch(choice({ "kam~kde": mixup("kam", "kde", 2, { answer: "Kde", given: "kam" }) }));
		assert.equal(target?.wrong.slug, "kam");
		assert.equal(target?.right.slug, "kde");
	});

	it("five episodes: a pair one of the recent episodes used is left out, and the next candidate is taken", () => {
		assert.equal(CATCH_RECENT_ITEMS, 5);
		const record = {
			"kam~kde": mixup("kam", "kde", 2),
			"moj~svoj": mixup("moj", "svoj", 2, { answer: "svoj", given: "môj" }),
		};
		assert.equal(chooseCatch(choice(record, ["kam-vs-kde"]))?.pair, "svoj-vs-moj");
		assert.equal(chooseCatch(choice({ "kam~kde": mixup("kam", "kde", 2) }, ["kam-vs-kde"])), null);
	});

	it("open mix-ups come first, then the most misses, then the latest", () => {
		const open = mixup("kam", "kde", 2, { hits: 0 });
		const mended = {
			...mixup("moj", "svoj", 5, { answer: "svoj", given: "môj" }),
			hits: 3,
			days: ["2026-11-02", "2026-11-03"],
		};
		assert.equal(chooseCatch(choice({ "kam~kde": open, "moj~svoj": mended }))?.pair, "kam-vs-kde");
		const older = mixup("kam", "kde", 2, { lastAt: "2026-11-01T10:00:00.000Z" });
		const newer = mixup("moj", "svoj", 2, { answer: "svoj", given: "môj", lastAt: "2026-11-03T10:00:00.000Z" });
		assert.equal(chooseCatch(choice({ "kam~kde": older, "moj~svoj": newer }))?.pair, "svoj-vs-moj");
	});
});

describe("checking the mistake the model returned", () => {
	const target = kamTarget();

	it("accepts a correct slip and keeps what the record needs", () => {
		const check = verifyCatch({ sentence: 1, wrong: "Kde", right: "Kam" }, target, episode(), pairLexicon, PAIRS);
		assert.ok("slip" in check, "accepted");
		assert.deepEqual(check.slip, {
			pair: "kam-vs-kde",
			sentence: 1,
			wrong: "Kde",
			right: "Kam",
			wrongSlug: "kde",
			rightSlug: "kam",
			rule: target.rule,
			speaker: "Martin",
		});
	});

	it("rejects a wrong form that is not a token of the slip sentence", () => {
		const check = verifyCatch({ sentence: 1, wrong: "chodím", right: "Kam" }, target, episode(), pairLexicon, PAIRS);
		assert.ok("reason" in check);
		assert.match(check.reason, /not a form of kde/);
	});

	it("rejects the right twin's form given as the wrong word", () => {
		const check = verifyCatch(
			{ sentence: 1, wrong: "Kam", right: "Kam" },
			target,
			episode("Kam ideme dnes?"),
			pairLexicon,
			PAIRS,
		);
		assert.ok("reason" in check);
	});

	it("rejects a slip sentence that also holds the right word", () => {
		const check = verifyCatch(
			{ sentence: 1, wrong: "Kde", right: "Kam" },
			target,
			episode("Kde ideme, kam?"),
			pairLexicon,
			PAIRS,
		);
		assert.ok("reason" in check);
		assert.match(check.reason, /also holds the right word/);
	});

	it("rejects a missing repair: the slip is the last sentence, or the repair does not say the right word", () => {
		const last = verifyCatch({ sentence: 3, wrong: "Kde", right: "Kam" }, target, episode(), pairLexicon, PAIRS);
		assert.ok("reason" in last);
		const noRight = verifyCatch(
			{ sentence: 1, wrong: "Kde", right: "Kam" },
			target,
			episode("Kde ideme dnes?", "Ideme do centra, dobre."),
			pairLexicon,
			PAIRS,
		);
		assert.ok("reason" in noRight);
		assert.match(noRight.reason, /does not say a form of kam/);
	});

	it("rejects a slip whose index was dropped (-1) or that the model never gave", () => {
		assert.ok(
			"reason" in verifyCatch({ sentence: -1, wrong: "Kde", right: "Kam" }, target, episode(), pairLexicon, PAIRS),
		);
		assert.ok("reason" in verifyCatch(undefined, target, episode(), pairLexicon, PAIRS));
	});

	it("rejects a slip that is not Martin's lines", () => {
		const narrated = episode();
		narrated[1] = line("Kde ideme dnes?");
		assert.ok(
			"reason" in verifyCatch({ sentence: 1, wrong: "Kde", right: "Kam" }, target, narrated, pairLexicon, PAIRS),
		);
	});

	it("rejects a pair that is not one of the verified pairs", () => {
		const unverified: CatchTarget = { ...target, pair: "not-a-pair" };
		assert.ok(
			"reason" in verifyCatch({ sentence: 1, wrong: "Kde", right: "Kam" }, unverified, episode(), pairLexicon, PAIRS),
		);
		const other: CatchTarget = { ...target, right: { slug: "ist", lemma: "ísť", forms: [] } };
		assert.ok(
			"reason" in verifyCatch({ sentence: 1, wrong: "Kde", right: "Kam" }, other, episode(), pairLexicon, PAIRS),
		);
	});
});
