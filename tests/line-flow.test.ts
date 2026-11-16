import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-line-flow-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const { lineState, recordLine } = await import("../src/server/line.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { lineStore } = await import("../src/store/line.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const now = new Date("2026-11-05T08:00:00Z");
const DAY = "2026-11-05";

test("the morning hearing keeps its sentence; the evening comes only after practice, and then once", () => {
	const before = lineState(now, 0);
	assert.ok(before.item, "the dictionary has a line for this day");
	assert.equal(before.morning, null);
	assert.equal(before.eveningOpen, false);

	const morning = recordLine({ phase: "morning", itemId: before.item!.id, typed: "" }, now, 0);
	assert.ok(morning.ok, "the morning hearing is recorded");
	assert.equal(morning.ok && morning.score.caught, 0, "nothing typed, nothing caught");

	const after1 = lineState(now, 0);
	assert.equal(after1.item!.id, before.item!.id, "the day keeps its sentence after the morning hearing");
	assert.equal(after1.item!.sentence, before.item!.sentence);
	assert.equal(after1.morning?.caught, 0);

	const early = recordLine({ phase: "evening", itemId: before.item!.id, typed: before.item!.sentence }, now, 0);
	assert.equal(early.ok, false, "no evening replay before the learner has practiced");

	const progress = progressStore.read();
	progress.days[DAY] = { xp: 12, lessons: 0, reps: 3, reviews: 0 };
	progressStore.write(progress);

	const evening = recordLine(
		{ phase: "evening", itemId: before.item!.id, typed: before.item!.sentence, activeMs: 4000 },
		now,
		0,
	);
	assert.ok(evening.ok, "the evening replay is recorded once practice is on record");
	assert.equal(
		evening.ok && evening.score.caught,
		evening.ok && evening.score.words,
		"a full answer catches every word",
	);

	const again = recordLine({ phase: "evening", itemId: before.item!.id, typed: "" }, now, 0);
	assert.equal(again.ok, false, "a second evening replay is refused");

	const after2 = lineState(now, 0);
	const today = after2.history[after2.history.length - 1]!;
	assert.equal(today.day, DAY);
	assert.equal(today.morning?.caught, 0);
	assert.equal(today.evening?.caught, today.evening?.words);
	assert.equal(after2.history.length, 14, "the record covers fourteen days");
});

test("a sentence that is not the day's line is refused, and a hearing counts its active time as listening", () => {
	const state = lineState(new Date("2026-11-06T08:00:00Z"), 0);
	assert.ok(state.item);
	const wrong = recordLine(
		{ phase: "morning", itemId: "not-the-line#0", typed: "x" },
		new Date("2026-11-06T08:00:00Z"),
		0,
	);
	assert.equal(wrong.ok, false);
	const right = recordLine(
		{ phase: "morning", itemId: state.item!.id, typed: "", activeMs: 6000 },
		new Date("2026-11-06T08:00:00Z"),
		0,
	);
	assert.ok(right.ok);
	assert.ok(
		(progressStore.read().days["2026-11-06"]?.minutesBy?.listen ?? 0) > 0,
		"the time on the page is kept as listening",
	);
});

test("the log is append-only and every hearing is in it with the sentence that was played", () => {
	const rows = lineStore.read();
	assert.ok(rows.length >= 3);
	for (const row of rows) {
		assert.ok(row.sentence.length > 0);
		assert.ok(row.caught <= row.words);
		assert.ok(["morning", "evening"].includes(row.phase));
	}
});
