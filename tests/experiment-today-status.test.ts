import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-experiment-today-"));
process.env.LH_DATA_DIR = dir;

const { EXPERIMENT_CONSTANTS } = await import("../src/core/experiment.ts");
const { experimentDir, getTodayExperimentStatus } = await import("../src/server/experiment.ts");

const start = EXPERIMENT_CONSTANTS.START_DATE;
fs.mkdirSync(experimentDir(), { recursive: true });
fs.writeFileSync(
	path.join(experimentDir(), "experiment.json"),
	JSON.stringify({ id: EXPERIMENT_CONSTANTS.ID, startDate: start, endDate: "2026-12-22", days: 42, seed: 1, onsetDay: 15, onsetDate: "2026-11-25", languages: { treatment: "russian", control: "slovak" } }),
);
fs.writeFileSync(path.join(experimentDir(), "schedule.json"), "[]");
fs.writeFileSync(path.join(experimentDir(), "probe-pool.json"), "{}");

const typed = { kind: "dictation", answer: "type", replays: 0, peeked: false, verdict: "exact" };
const lessons = path.join(dir, "profiles", "russian", "lessons");
fs.mkdirSync(lessons, { recursive: true });
fs.writeFileSync(path.join(lessons, `${start}.jsonl`), `${JSON.stringify({ mode: "listen", reps: [typed, typed, typed, typed, typed] })}\n`);

const dayOne = new Date(`${start}T12:00:00`);

describe("today's study status", () => {
	it("counts the day by the treatment's reps, whatever language runs", () => {
		const fromSlovak = getTodayExperimentStatus(dayOne, "slovak");
		assert.equal(fromSlovak?.validDay, true, "five Russian sentences make the day count, even seen from Slovak");
		assert.equal(fromSlovak?.runningLanguageReps?.dictationReps, 0, "the running language's own count is Slovak's");
	});

	it("has no running-language count for a language outside the study", () => {
		const fromEstonian = getTodayExperimentStatus(dayOne, "estonian");
		assert.equal(fromEstonian?.runningLanguageReps, null, "Estonian Listen shows no study counter");
	});

	it("names the oldest open weekly check with its language", () => {
		const dayEight = new Date(`${start}T12:00:00`);
		dayEight.setDate(dayEight.getDate() + 7);
		assert.deepEqual(getTodayExperimentStatus(dayEight, "slovak")?.oldestOpenCheck, { week: 1, language: "russian" });
	});
});
