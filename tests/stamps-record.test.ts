/**
 * STAMPS ON RECORD (LangHarness, 2026-11-02; E31): finishing a lesson mints
 * the stamps it earns, hands them to the end screen once, and writes their
 * day into progress.json, where they stay. Runs under an isolated
 * LH_DATA_DIR, so every app-module import is dynamic.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-stamps-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { progressSummary, recordLesson } = await import("../src/server/lesson.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { syncStamps } = await import("../src/server/stamps.ts");
const { curriculumState } = await import("../src/core/curriculum.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const rep = (slug: string, verdict: "exact" | "wrong") => ({
	itemId: `${slug}#0`,
	slug,
	kind: "type" as const,
	verdict,
	first: { given: slug, verdict },
	detail: { unit: "words", lemma: slug, gloss: slug, sentence: `${slug}.`, translation: `${slug}.`, answer: slug, given: slug },
});

test("a fresh learner has no stamps; the first lesson without a miss earns the first step and 'Bez chyby', dated that day, once", () => {
	const before = progressSummary(0, new Date("2026-11-02T08:00:00Z"));
	assert.equal(before.stamps.earned, 0);
	assert.ok(before.stamps.total > 60, `${before.stamps.total} stamps in the book`);
	assert.equal(before.stamps.next.length, 3, "three stamps to aim for from the start");
	assert.equal(progressStore.read().stamps, undefined, "nothing on record yet");

	const out = recordLesson({ unit: "words", mode: "lesson", reps: ["dom", "pes", "voda", "chlieb", "mesto", "ruka"].map((w) => rep(w, "exact")), tz: 0 }, new Date("2026-11-02T09:00:00Z"));
	assert.ok(out.perfect, "every answer right");
	const ids = (out.newStamps ?? []).map((s) => s.id).sort();
	assert.deepEqual(ids, ["first-step", "perfect-1"]);
	for (const s of out.newStamps ?? []) assert.equal(s.earned, "2026-11-02");
	assert.equal(out.summary.stamps.earned, 2);
	assert.equal(out.summary.stamps.recent[0]!.id, "first-step", "the recent list keeps book order on the same day");
	assert.equal(out.summary.log.lessons, 1);
	assert.equal(out.summary.todayMinutes >= 0, true);

	const onDisk = progressStore.read();
	assert.deepEqual(onDisk.stamps, { "first-step": "2026-11-02", "perfect-1": "2026-11-02" });
	assert.equal(onDisk.days["2026-11-02"]?.perfect, 1, "the day counts the perfect lesson");

	const again = recordLesson({ unit: "words", mode: "lesson", reps: [rep("dom", "exact"), rep("pes", "wrong")], tz: 0 }, new Date("2026-11-02T10:00:00Z"));
	assert.equal(again.perfect, false);
	assert.equal(again.newStamps, undefined, "nothing new the second time");
	assert.equal(again.summary.stamps.earned, 2);
	assert.equal(progressStore.read().days["2026-11-02"]?.perfect, 1, "a lesson with a miss does not count as perfect");
});

test("a stamp on record keeps its day when judged again, and syncStamps only writes what is new", () => {
	const p = progressStore.read();
	const curriculum = curriculumState({});
	const evidence = {
		lessons: 0,
		streakDays: 0,
		wordsKnown: 0,
		reviews: 0,
		perfectLessons: 0,
		comebacks: 0,
		balancedWeek: false,
		storiesRead: 1,
		scenesSpoken: 0,
		listens: 0,
		bestBlitz: 0,
		hoursDone: 0,
		examsPassed: 0,
		chapters: new Map<string, number>(),
		stages: new Map<string, number>(),
	};
	const { report, minted } = syncStamps(p, curriculum, evidence, "2026-11-09");
	assert.deepEqual(minted.map((s) => s.id), ["stories-1"]);
	assert.equal(p.stamps?.["stories-1"], "2026-11-09");
	assert.equal(p.stamps?.["first-step"], "2026-11-02", "the earlier day stays");
	const first = report.all.find((s) => s.id === "first-step")!;
	assert.equal(first.earned, "2026-11-02", "earned even though this evidence shows no lessons");
	assert.equal(report.earned, 3);
	assert.equal(report.recent[0]!.id, "stories-1", "newest first");
});
