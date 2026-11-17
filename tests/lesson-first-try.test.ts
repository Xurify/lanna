/**
 * LESSON FIRST TRIES ON THE SERVER (2026-10-31): a recorded
 * lesson counts each rep's first answer — the one before any cue — on the
 * drill the rep practiced, split by the word's gender column
 * (progress.json units: first, byGender), and the lesson log keeps the
 * gender, the first answer and the slip. Peeks, meaning and build reps,
 * and the end-of-lesson retry never count; a mixed lesson counts toward
 * the cases it drilled.
 *
 * Runs under an isolated LANNA_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-lesson-first-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { recordLesson } = await import("../src/server/lesson.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { readLessonLog } = await import("../src/store/corpus.ts");
type RepResult = import("../src/server/lesson.ts").RepResult;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

/** "Ako ďaleko je to od stanice?" — the gen drill's stanica rep. */
const stanica = (first?: RepResult["first"], detail: Partial<NonNullable<RepResult["detail"]>> = {}): RepResult => ({
	itemId: "stanica#3",
	slug: "stanica",
	kind: "type",
	verdict: "exact",
	assisted: true,
	...(first ? { first } : {}),
	detail: {
		unit: "gen",
		lemma: "stanica",
		sentence: "Ako ďaleko je to od stanice?",
		translation: "How far is it from the station?",
		answer: "stanice",
		given: "stanice",
		...detail,
	},
});

test("a wrong first try lands on its drill: the tally, the gender column, the log", () => {
	// "stanica" first (the dictionary form), then right after the cue.
	recordLesson({
		unit: "gen",
		mode: "lesson",
		reps: [stanica({ given: "stanica", verdict: "wrong" })],
		tz: 0,
		clientId: "first-0001-aaaa",
	});
	const gen = progressStore.read().units["gen"]!;
	assert.deepEqual(gen.first, { reps: 1, right: 0, accents: 0, slips: { base: 1 } });
	assert.deepEqual(gen.byGender?.fem, { reps: 1, right: 0, accents: 0, slips: { base: 1 } });
	assert.equal(gen.lessons, 1, "the lesson itself counts as before");
	assert.equal(gen.reps, 1, "the unit's XP record is the final answer, unchanged");
	const rep = readLessonLog().at(-1)!.reps[0]!;
	assert.equal(rep.gender, "feminine");
	assert.deepEqual(rep.first, { given: "stanica", verdict: "wrong" });
	assert.equal(rep.slip, "base");
});

test("a right first try counts as right", () => {
	recordLesson({
		unit: "gen",
		mode: "lesson",
		reps: [stanica({ given: "stanice", verdict: "exact" })],
		tz: 0,
		clientId: "first-0002-bbbb",
	});
	const gen = progressStore.read().units["gen"]!;
	assert.equal(gen.first?.reps, 2);
	assert.equal(gen.first?.right, 1);
	assert.equal(gen.byGender?.fem?.right, 1);
});

test("peeks, meaning and build reps, and the end-of-lesson retry never count", () => {
	const before = progressStore.read().units["gen"]!.first!.reps;
	const base = stanica({ given: "stanica", verdict: "wrong" });
	recordLesson({
		unit: "gen",
		mode: "lesson",
		reps: [
			stanica({ given: "stanica", verdict: "wrong", peeked: true }),
			{ ...base, kind: "meaning" },
			{ ...base, kind: "build" },
			{
				...stanica({ given: "stanice", verdict: "exact" }),
				itemId: "stanica#3~again",
				detail: { ...base.detail, again: true },
			},
		],
		tz: 0,
		clientId: "first-0003-cccc",
	});
	assert.equal(progressStore.read().units["gen"]!.first!.reps, before, "none of the four counts");
});

test("a rep without a first answer (an old client) counts nothing and still logs", () => {
	const before = progressStore.read().units["gen"]!.first!.reps;
	recordLesson({ unit: "gen", mode: "lesson", reps: [stanica()], tz: 0, clientId: "first-0004-dddd" });
	assert.equal(progressStore.read().units["gen"]!.first!.reps, before);
	const rep = readLessonLog().at(-1)!.reps[0]!;
	assert.equal(rep.gender, "feminine", "the dictionary still names the gender");
	assert.equal(rep.first, undefined);
	assert.equal(rep.slip, undefined);
});

test("a mixed lesson counts the rep toward the case it drilled, not the lesson's unit", () => {
	const genBefore = progressStore.read().units["gen"]!.first!.reps;
	recordLesson({
		unit: "gen",
		mode: "lesson",
		reps: [
			{ ...stanica({ given: "stanice", verdict: "exact" }), detail: { ...stanica().detail, unit: "loc", mixed: true } },
		],
		tz: 0,
		clientId: "first-0005-eeee",
	});
	const p = progressStore.read();
	assert.equal(p.units["gen"]!.first!.reps, genBefore, "not the lesson's unit");
	assert.equal(p.units["loc"]?.first?.reps, 1, "the locative tally");
	assert.equal(p.units["loc"]?.byGender?.fem?.right, 1, "the L × feminine cell");
});
