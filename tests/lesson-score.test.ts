/**
 * THE END SCREEN'S SCORE (LangHarness, 2026-10-30): a finished lesson's XP,
 * correct count and perfect flag come from core's lessonScore, so the end
 * screen can show them the moment the last answer is given. The server
 * records the same score; this pins that the two agree.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-lesson-score-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { lessonScore } = await import("../src/core/lesson.ts");
const { lessonFor, recordLesson } = await import("../src/server/lesson.ts");
type RepVerdict = import("../src/core/lesson.ts").RepVerdict;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

interface Case {
	name: string;
	mode: "lesson" | "blitz";
	verdicts: string[];
	/** Indexes of the reps answered with help. */
	assisted?: number[];
}

const CASES: Case[] = [
	{ name: "a perfect lesson", mode: "lesson", verdicts: Array(12).fill("exact") },
	{ name: "misses, accents and a helped rep", mode: "lesson", verdicts: ["exact", "wrong", "accents", "exact", "exact", "wrong", "exact", "exact", "exact", "exact", "exact", "exact"], assisted: [3] },
	{ name: "a blitz gets no lesson bonus", mode: "blitz", verdicts: ["exact", "exact", "wrong", "exact", "accents"] },
	{ name: "nothing answered", mode: "lesson", verdicts: [] },
];

describe("lesson score", () => {
	for (const c of CASES) {
		it(`matches what the server records: ${c.name}`, () => {
			const items = lessonFor("loc", 7).items.slice(0, c.verdicts.length);
			const reps = items.map((item, i) => ({ item, verdict: c.verdicts[i] as RepVerdict, assisted: c.assisted?.includes(i) === true }));
			const local = lessonScore(
				reps.map((r) => ({ kind: r.item.kind, verdict: r.verdict, assisted: r.assisted })),
				c.mode,
			);
			const server = recordLesson({
				unit: "loc",
				mode: c.mode,
				reps: reps.map((r) => ({ itemId: r.item.id, slug: r.item.slug, kind: r.item.kind, verdict: r.verdict, assisted: r.assisted })),
				tz: -60,
			});
			assert.deepEqual(
				{ xp: local.xp, correct: local.correct, total: local.total, perfect: local.perfect },
				{ xp: server.xp, correct: server.correct, total: server.total, perfect: server.perfect },
			);
		});
	}
});
