/**
 * EXAM PINS (LangHarness, phase 6a, E14): every chapter draws eight choose
 * items from its own word and drill units (three words, three forms, two
 * more; a pairs unit takes one form slot with a Dvojičky rep), the answer
 * is always among the options, the draw is deterministic per seed, the
 * scorer counts and misses, 80% passes, and a finished attempt is kept on
 * the record. Runs under an isolated LH_DATA_DIR, so every app-module
 * import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-exam-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { CHAPTERS } = await import("../src/core/curriculum.ts");
const { unitInfo } = await import("../src/core/lesson.ts");
const { EXAM_LENGTH, EXAM_PASS_MARK, bestAttempt, examItems, scoreExam } = await import("../src/core/exam.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { examFor, recordExam } = await import("../src/server/exam.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const entries = loadLexicon()?.entries ?? [];
// unitInfo().kind is undefined for the plain grammar drills — default here.
const kindOf = (unit: Parameters<typeof unitInfo>[0]) => unitInfo(unit).kind ?? "grammar";
// A chapter with no word or drill units at all: media (its units are the
// reading, listening and writing tutors plus the goal — nothing to draw from).
const NO_EXAM = new Set(["media"]);

describe("the draw", () => {
	it("gives every chapter with word or drill units eight choose items, answers among the options, no item twice", () => {
		for (const ch of CHAPTERS) {
			const draw = examItems(ch.id, 42, entries);
			assert.ok(draw, `${ch.id}: no draw`);
			if (NO_EXAM.has(ch.id)) {
				assert.equal(draw!.items.length, 0, `${ch.id}: has nothing to draw from`);
				continue;
			}
			assert.equal(draw!.items.length, EXAM_LENGTH, `${ch.id}: ${draw!.items.length} items`);
			const ids = new Set(draw!.items.map((i) => i.id));
			assert.equal(ids.size, EXAM_LENGTH, `${ch.id}: an item is drawn twice`);
			draw!.items.forEach((item, i) => {
				assert.equal(item.kind, "choose", `${ch.id} item ${i}: not a choose item`);
				assert.ok(item.options && item.options.length >= 2, `${ch.id} item ${i}: no options`);
				assert.ok(item.options!.includes(item.answer), `${ch.id} item ${i}: the answer is not among the options`);
			});
		}
	});

	it("is deterministic per seed: the same seed, the same eight items", () => {
		const a = examItems("cafe", 7, entries)!;
		const b = examItems("cafe", 7, entries)!;
		assert.deepEqual(b, a);
	});

	it("three items come from the chapter's word units, at least three from its form drill", () => {
		const draw = examItems("cafe", 42, entries)!;
		const words = draw.items.filter((i) => kindOf(i.unit) === "words" && !i.pair);
		assert.ok(words.length >= 3, `at least three word items, got ${words.length}`);
		const forms = draw.items.filter((i) => kindOf(i.unit) === "grammar" && !i.pair);
		assert.ok(forms.length >= 3, `at least three form items, got ${forms.length}`);
	});

	it("a chapter without a pairs unit draws three form items; with one, the Dvojičky rep takes a form slot", () => {
		const cafe = examItems("cafe", 42, entries)!;
		assert.equal(cafe.items.filter((i) => i.pair).length, 0, "cafe: no pair item");

		const town = examItems("town", 42, entries)!;
		const townForms = town.items.filter((i) => kindOf(i.unit) === "grammar" && !i.pair);
		const pairs = town.items.filter((i) => i.pair);
		assert.ok(townForms.length >= 2, `at least two form items, got ${townForms.length}`);
		assert.equal(pairs.length, 1, "town: one pair item replaces one form item");
		assert.ok(pairs[0]!.options!.length === 2, "the pair item is a choice between the two twins");
	});
});

describe("the score", () => {
	it("counts the right picks and lists the misses in exam order", () => {
		const draw = examItems("cafe", 42, entries)!;
		const right = draw.items.map((i) => i.options!.findIndex((o) => o === i.answer));
		const score = scoreExam(draw.items, right);
		assert.equal(score.correct, EXAM_LENGTH);
		assert.equal(score.total, EXAM_LENGTH);
		assert.ok(score.passed);
		assert.deepEqual(score.misses, []);

		const wrong = right.map((r, i) => (i < 2 ? (r === 0 ? 1 : 0) : r));
		const two = scoreExam(draw.items, wrong);
		assert.equal(two.correct, EXAM_LENGTH - 2);
		assert.deepEqual(two.misses, [draw.items[0]!.id, draw.items[1]!.id], "the misses are the missed items' ids, in exam order");
	});

	it("an out-of-range or missing pick is a miss, never a crash", () => {
		const draw = examItems("cafe", 42, entries)!;
		const score = scoreExam(draw.items, [99, ...draw.items.slice(1).map(() => -1)]);
		assert.equal(score.correct, 0);
		assert.equal(score.misses.length, EXAM_LENGTH);
	});

	it(`the pass rule is ${Math.round(EXAM_PASS_MARK * 100)}%: 7 of 8 passes, 6 of 8 does not`, () => {
		const draw = examItems("cafe", 42, entries)!;
		const right = draw.items.map((i) => i.options!.findIndex((o) => o === i.answer));
		assert.equal(scoreExam(draw.items, right.map((r, i) => (i === 0 ? -1 : r))).passed, true, "7 of 8 passes");
		assert.equal(scoreExam(draw.items, right.map((r, i) => (i < 2 ? -1 : r))).passed, false, "6 of 8 does not");
	});
});

describe("the record", () => {
	it("a finished attempt is kept per chapter: at, score, total, passed, misses (fenced temp data)", () => {
		const seed = 1234;
		const draw = examFor("cafe", seed);
		const right = draw.items.map((i) => i.options!.findIndex((o) => o === i.answer));
		const { attempt, best, attempts } = recordExam({ chapterId: "cafe", seed, answers: right });
		assert.equal(attempt.score, EXAM_LENGTH);
		assert.equal(attempt.total, EXAM_LENGTH);
		assert.equal(attempt.passed, true);
		assert.deepEqual(attempt.misses, []);
		assert.ok(attempt.at, "the attempt is stamped with the time");
		assert.equal(attempts, 1);
		assert.deepEqual(best, attempt);

		const kept = progressStore.read().exams["cafe"];
		assert.equal(kept?.length, 1, "the attempt is in progress.json");
		assert.deepEqual(kept?.[0], attempt);

		// A failed attempt records its misses too.
		const failed = recordExam({ chapterId: "cafe", seed, answers: right.map((r, i) => (i < 2 ? (r === 0 ? 1 : 0) : r)) });
		assert.equal(failed.attempt.passed, false);
		assert.equal(failed.attempt.misses.length, 2);
		assert.equal(progressStore.read().exams["cafe"]?.length, 2);
	});

	it("the passport's best line: the highest score, the more recent breaking a tie", () => {
		const t = (at: string, score: number) => ({ at, score, total: 8, passed: score >= 7 });
		assert.deepEqual(bestAttempt([t("2026-10-30T10:00:00Z", 5), t("2026-10-30T11:00:00Z", 7), t("2026-10-30T09:00:00Z", 6)]), t("2026-10-30T11:00:00Z", 7));
		assert.deepEqual(bestAttempt([t("2026-10-30T10:00:00Z", 7), t("2026-10-30T11:00:00Z", 7)].reverse()), { at: "2026-10-30T11:00:00Z", score: 7, total: 8, passed: true });
		assert.equal(bestAttempt([]), null);
	});
});
