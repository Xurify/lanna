import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, it } from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-sound-path-"));
process.env.LANNA_DATA_DIR = TMP;
process.env.LANNA_PROFILE = "slovak";

const { allChapters, curriculumState, curriculumUnit, getSoundsForLanguage, chapterArc, unitHref } =
	await import("../src/core/index.ts");
const { recordSound } = await import("../src/server/lesson.ts");
const { progressStore } = await import("../src/store/progress.ts");

after(() => fs.rmSync(TMP, { recursive: true, force: true }));

it("every sound sits in its chapter, right before the chapter's goal", () => {
	for (const sound of getSoundsForLanguage("slovak")) {
		const chapter = allChapters().find((c) => c.id === sound.chapter)!;
		const at = chapter.units.indexOf(sound.id);
		assert.ok(at >= 0, `${sound.id} is in ${sound.chapter}`);
		assert.equal(curriculumUnit(chapter.units[at + 1]!)?.kind, "goal", sound.id);
		assert.equal(curriculumUnit(sound.id)?.kind, "sound");
		assert.equal(unitHref({ id: sound.id, kind: "sound" }), `/sound?id=${sound.id}`);
		assert.deepEqual(chapterArc(sound.chapter)!.find((s) => s.step.id === "sound")!.units, [sound.id]);
	}
});

it("a played sound is done after one round, and only sound units are recorded", () => {
	const sound = getSoundsForLanguage("slovak")[0]!;
	const stateOf = () =>
		curriculumState(progressStore.read().units)
			.chapters.flatMap((c) => c.units)
			.find((u) => u.id === sound.id)!;
	const before = stateOf();
	assert.notEqual(before.status, "done");
	assert.equal(recordSound(sound.id, 3, 4, 90_000), true);
	const unit = progressStore.read().units[sound.id]!;
	assert.deepEqual([unit.lessons, unit.reps, unit.correct], [1, 4, 3]);
	assert.equal(stateOf().status, "done");
	assert.equal(recordSound("present", 1, 1, 0), false, "only sound units are recorded");
});

it("a round with nothing scored is practiced without a share, and a second round adds to the first", () => {
	const sound = getSoundsForLanguage("slovak")[1]!;
	assert.equal(recordSound(sound.id, 0, 0, 30_000), true);
	let unit = progressStore.read().units[sound.id]!;
	assert.deepEqual([unit.lessons, unit.reps, unit.correct], [1, 0, 0]);
	assert.equal(recordSound(sound.id, 2, 4, 30_000), true);
	unit = progressStore.read().units[sound.id]!;
	assert.deepEqual([unit.lessons, unit.reps, unit.correct], [2, 4, 2]);
});
