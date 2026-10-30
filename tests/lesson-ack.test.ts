/**
 * THE LESSON OUTBOX ON THE SERVER (LangHarness, 2026-10-30): a lesson saved
 * twice with the same id is recorded once. The retry gets the first answer
 * back and the progress is not counted again. A save without an id is always
 * recorded, as before.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-lesson-ack-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { lessonFor, recordLesson } = await import("../src/server/lesson.ts");
const { progressStore } = await import("../src/store/progress.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const reps = () =>
	lessonFor("loc", 7)
		.items.slice(0, 4)
		.map((item) => ({ itemId: item.id, slug: item.slug, kind: item.kind, verdict: "exact" as const }));

describe("lesson saves with an id", () => {
	it("a retry with the same id is answered, not counted again", () => {
		const first = recordLesson({ unit: "loc", mode: "lesson", reps: reps(), tz: -60, clientId: "lesson-0001-aaaa" });
		const before = progressStore.read();
		const second = recordLesson({ unit: "loc", mode: "lesson", reps: reps(), tz: -60, clientId: "lesson-0001-aaaa" });
		const after = progressStore.read();
		assert.equal(second.duplicate, true);
		assert.equal(second.xp, first.xp);
		assert.deepEqual(second.queued, first.queued);
		assert.equal(after.xp, before.xp);
		assert.equal(after.units.loc?.lessons, before.units.loc?.lessons);
	});

	it("a different id is a different lesson", () => {
		const before = progressStore.read().xp;
		const again = recordLesson({ unit: "loc", mode: "lesson", reps: reps(), tz: -60, clientId: "lesson-0002-bbbb" });
		assert.equal(again.duplicate, undefined);
		assert.ok(progressStore.read().xp > before);
	});

	it("a save without an id is recorded every time", () => {
		const before = progressStore.read().xp;
		const a = recordLesson({ unit: "loc", mode: "lesson", reps: reps(), tz: -60 });
		assert.equal(a.duplicate, undefined);
		assert.ok(progressStore.read().xp >= before + a.xp);
	});
});
