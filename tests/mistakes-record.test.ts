/**
 * MY MISTAKES ON DISK (LangHarness, 2026-11-01): the first visit takes a
 * snapshot, "Analyze now" takes a new one with a later time and keeps the
 * guide, and a guide is reused while its facts stand. The model call itself
 * is not run here: a saved guide stands in for one. Runs under an isolated
 * LH_DATA_DIR, so every app-module import is dynamic.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-mistakes-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { recordLesson } = await import("../src/server/lesson.ts");
const { mistakesReport, analyzeNow, writeGuide } = await import("../src/server/mistakes.ts");
const { analysisStore } = await import("../src/store/analysis.ts");
const { digest, guideFacts } = await import("../src/core/mistakes.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const rep = (given: string, verdict: "exact" | "wrong") => ({
	itemId: "nikto#0",
	slug: "nikto",
	kind: "type" as const,
	verdict,
	first: { given, verdict },
	detail: {
		unit: "words",
		lemma: "nikto",
		gloss: "no one",
		sentence: "Nikto mi nezavolal.",
		translation: "Nobody called me.",
		answer: "Nikto",
		given,
	},
});

describe("my mistakes on disk", () => {
	it("without any answers the snapshot is empty, has its time, and no guide can be written", async () => {
		const r = mistakesReport(new Date("2026-11-01T08:00:00Z"));
		assert.equal(r.analysis.reps, 0);
		assert.equal(r.analysis.at, "2026-11-01T08:00:00.000Z");
		assert.equal(analysisStore.read().analysis?.at, r.analysis.at, "saved");
		assert.equal(r.guide, null);
		await assert.rejects(
			() => writeGuide({ now: new Date("2026-11-01T08:01:00Z") }),
			/needs at least 30 first tries with 5 mistakes among them; you have 0 and 0/,
		);
	});

	it("a visit shows the saved time, and Analyze now reads the log again", () => {
		recordLesson(
			{
				unit: "words",
				mode: "lesson",
				reps: [rep("Niekto", "wrong"), rep("Nikto", "exact"), rep("Nikto", "exact")],
				tz: 0,
			},
			new Date("2026-11-01T09:00:00Z"),
		);
		assert.equal(
			mistakesReport(new Date("2026-11-01T10:00:00Z")).analysis.at,
			"2026-11-01T08:00:00.000Z",
			"a visit does not re-read",
		);
		const r = analyzeNow(new Date("2026-11-01T10:00:00Z"));
		assert.equal(r.analysis.at, "2026-11-01T10:00:00.000Z");
		assert.equal(r.analysis.reps, 3);
		assert.equal(r.analysis.wrong, 1);
		assert.equal(r.analysis.samples?.[0]?.given, "Niekto");
		assert.equal(r.analysis.words.length, 0, "one miss is a slip, not a word you miss most");
		assert.equal(r.analysis.mixups[0]?.words.join("/"), "nikto/niekto");
	});

	it("a saved guide is reused for the same facts, kept by a new snapshot, and stale once the answers change", async () => {
		const analysis = analysisStore.read().analysis!;
		const guide = {
			text: "## Do this week\n- Practice nikto / niekto.",
			at: "2026-11-01T10:05:00.000Z",
			digest: digest(guideFacts(analysis)),
			model: "faux:faux",
			usage: { model: "faux:faux", steps: [] },
		};
		analysisStore.write({ analysis, guide });
		const again = await writeGuide({ now: new Date("2026-11-01T11:00:00Z") });
		assert.equal(again.guide?.at, guide.at, "the same facts reuse it at no cost");
		assert.equal(again.guideCurrent, true);
		const re = analyzeNow(new Date("2026-11-01T12:00:00Z"));
		assert.equal(re.guide?.text, guide.text, "a new snapshot keeps the guide");
		assert.equal(re.guideCurrent, true);
		recordLesson(
			{ unit: "words", mode: "lesson", reps: [rep("Niekto", "wrong")], tz: 0 },
			new Date("2026-11-01T12:30:00Z"),
		);
		assert.equal(analyzeNow(new Date("2026-11-01T13:00:00Z")).guideCurrent, false, "the answers changed since");
	});
});

describe("the plan reads the saved trends", () => {
	it("slippingUnits lists units whose trend is worse, worst first, and a stale snapshot is renewed after a lesson", async () => {
		const { slippingUnits, refreshSnapshotIfStale } = await import("../src/server/mistakes-snapshot.ts");
		const mk = (unit: string, recent: number) => ({
			unit,
			title: unit,
			reps: 20,
			wrong: 5,
			accuracy: 0.7,
			recent,
			earlier: 0.9,
			trend: "worse" as const,
			slips: {},
		});
		const analysis = {
			at: "2026-11-03T08:00:00.000Z",
			reps: 40,
			wrong: 10,
			from: null,
			to: null,
			units: [mk("loc", 0.6), mk("gen", 0.4), { ...mk("dat", 0.9), trend: "steady" as const }],
			slips: {},
			words: [],
			weeks: [],
			mixups: [],
		};
		analysisStore.write({ analysis, guide: null });
		assert.deepEqual(slippingUnits(), ["gen", "loc"]);
		refreshSnapshotIfStale(new Date("2026-11-03T09:00:00Z"));
		assert.equal(analysisStore.read().analysis?.at, analysis.at, "an hour old is fresh");
		refreshSnapshotIfStale(new Date("2026-11-03T15:00:00Z"));
		assert.equal(analysisStore.read().analysis?.at, "2026-11-03T15:00:00.000Z", "six hours old is renewed");
	});
});
