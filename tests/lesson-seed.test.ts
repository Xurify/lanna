import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-lesson-seed-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { lessonFor, lessonSeed } = await import("../src/server/lesson.ts");
const { progressStore } = await import("../src/store/progress.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const NOON = new Date("2026-11-09T12:00:00");

describe("the lesson a unit opens with", () => {
	test("is the same twelve reps until the unit is practiced", () => {
		const seed = lessonSeed("words", undefined, NOON);
		assert.equal(lessonSeed("words", undefined, NOON), seed);
		const first = lessonFor("words", seed).items.map((i) => i.id);
		assert.ok(first.length > 0);
		assert.deepEqual(
			lessonFor("words", lessonSeed("words", undefined, NOON)).items.map((i) => i.id),
			first,
		);
	});

	test("changes with the unit, the gender, the day and a finished lesson", () => {
		const seed = lessonSeed("words", undefined, NOON);
		assert.notEqual(lessonSeed("acc-fem", undefined, NOON), seed);
		assert.notEqual(lessonSeed("words", "fem", NOON), seed);
		assert.notEqual(lessonSeed("words", undefined, new Date("2026-11-10T12:00:00")), seed);
		const progress = progressStore.read();
		progress.units.words = {
			...progress.units.words,
			lessons: (progress.units.words?.lessons ?? 0) + 1,
			reps: (progress.units.words?.reps ?? 0) + 12,
			correct: (progress.units.words?.correct ?? 0) + 10,
		} as (typeof progress.units)[string];
		progressStore.write(progress);
		assert.notEqual(lessonSeed("words", undefined, NOON), seed);
	});
});
