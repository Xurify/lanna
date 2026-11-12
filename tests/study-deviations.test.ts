/**
 * STUDY DEVIATION LOG PINS: the app writes each deviation it can see once,
 * records the measure's files on the first day it looks, and logs a change
 * to them on a later day.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-study-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { EXPERIMENT_CONSTANTS, dateForDayNumber } = await import("../src/core/experiment.ts");
const { ensureExperimentInitialized, experimentDir, readDeviations, syncDailyExperimentData } = await import("../src/server/experiment.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const noonOf = (dayNumber: number) => new Date(`${dateForDayNumber(EXPERIMENT_CONSTANTS.START_DATE, dayNumber)}T12:00:00`);

test("the study's files are written under the scratch data folder", () => {
	ensureExperimentInitialized();
	assert.ok(experimentDir().startsWith(TMP_DATA));
});

test("days without Listen are logged once each, however often the page syncs", () => {
	syncDailyExperimentData(noonOf(3));
	syncDailyExperimentData(noonOf(3));
	const days = readDeviations().filter((d) => d.kind === "missed-day");
	assert.equal(days.length, 4, "days 1 and 2, in both languages");
	assert.equal(new Set(days.map((d) => d.key)).size, 4);
	assert.ok(days.every((d) => typeof d.at === "string"));
});

test("the measure's files are recorded on the first look and a later change is logged", () => {
	const file = path.join(experimentDir(), "measure.json");
	const first = JSON.parse(fs.readFileSync(file, "utf8")) as { checkedOn: string; files: Record<string, string> };
	assert.equal(first.checkedOn, dateForDayNumber(EXPERIMENT_CONSTANTS.START_DATE, 3));
	assert.ok(first.files["src/core/listen.ts"]?.match(/^[0-9a-f]{64}$/), "the grader is fingerprinted");
	assert.equal(readDeviations().filter((d) => d.kind === "measure-changed").length, 0, "the first look only records");

	fs.writeFileSync(file, JSON.stringify({ ...first, files: { ...first.files, "src/core/listen.ts": "an older grader" } }));
	syncDailyExperimentData(noonOf(4));
	const changed = readDeviations().filter((d) => d.kind === "measure-changed");
	assert.equal(changed.length, 1);
	assert.match(changed[0]!.note, /src\/core\/listen\.ts/);

	syncDailyExperimentData(noonOf(4));
	assert.equal(readDeviations().filter((d) => d.kind === "measure-changed").length, 1, "checked at most once a day");
});
