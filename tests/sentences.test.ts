import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-sentences-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { sentenceProblems, usesLemma } = await import("../src/core/sentences.ts");
const { checkPracticeSentence } = await import("../src/server/sentences.ts");
const { sentenceStore } = await import("../src/store/sentences.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

describe("usesLemma and sentenceProblems", () => {
	test("accepts irregular inflected forms supplied from the lexicon", () => {
		assert.equal(usesLemma(["idem", "domov"], "ísť", { langTag: "sk-SK", forms: ["idem", "ideš", "išiel"] }), true);
		assert.equal(usesLemma(["som", "tu"], "byť", { langTag: "sk-SK", forms: ["som", "si", "je"] }), true);
		assert.equal(usesLemma(["mám", "dom"], "ísť", { langTag: "sk-SK", forms: ["idem", "ideš"] }), false);
	});

	test("gates Slovak spell-check on sk language tag so Russian and Estonian are not rejected", () => {
		const ruProblems = sentenceProblems("Я иду домой сегодня.", "идти", {
			langTag: "ru-RU",
			forms: ["иду", "идёшь", "идёт"],
		});
		assert.deepEqual(ruProblems, []);

		const etProblems = sentenceProblems("Ma lähen täna koju.", "minema", {
			langTag: "et-EE",
			forms: ["lähen", "lähed", "läheb"],
		});
		assert.deepEqual(etProblems, []);
	});
});

describe("checkPracticeSentence caching and daily XP cap", () => {
	test("caches model verdict in sentences.jsonl and awards XP once per lemma per day", async () => {
		let calls = 0;
		const ask = async () => {
			calls++;
			return JSON.stringify({
				ok: true,
				corrected: "Dnes tvrdím, že je to správne.",
				why: "Natural sentence with the right verb form.",
			});
		};
		const now = new Date("2026-11-10T10:00:00Z");

		const first = await checkPracticeSentence(
			{
				lemma: "tvrdiť",
				slug: "tvrdit",
				gloss: "claim",
				sentence: "Dnes tvrdím, že je to správne.",
				source: "hardwords",
				tz: 0,
			},
			{ ask, now },
		);
		assert.equal(first.ok, true);
		assert.equal(first.cached, false);
		assert.ok(first.xp > 0);
		assert.equal(calls, 1);

		const second = await checkPracticeSentence(
			{
				lemma: "tvrdiť",
				slug: "tvrdit",
				gloss: "claim",
				sentence: "Dnes tvrdím, že je to správne.",
				source: "hardwords",
				tz: 0,
			},
			{ ask, now },
		);
		assert.equal(second.ok, true);
		assert.equal(second.cached, true);
		assert.equal(second.xp, 0);
		assert.equal(calls, 1);

		const differentSameDay = await checkPracticeSentence(
			{
				lemma: "tvrdiť",
				slug: "tvrdit",
				gloss: "claim",
				sentence: "On vždy tvrdí to isté.",
				source: "hardwords",
				tz: 0,
			},
			{ ask, now },
		);
		assert.equal(differentSameDay.ok, true);
		assert.equal(differentSameDay.cached, false);
		assert.equal(differentSameDay.xp, 0);
		assert.equal(calls, 2);
		assert.equal(sentenceStore.readAll().length, 2);
	});
});
