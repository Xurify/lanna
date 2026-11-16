/**
 * Study sections (E62, docs/research/watch-sections.md): the model's answer
 * is kept only where it holds against the video's own lines, the gaps are
 * built from those lines, the answer is kept and not asked again, and a
 * practiced section pays XP and sends its misses to Review and Listen.
 * Runs under an isolated LANNA_DATA_DIR, so app modules are imported after it.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-watch-sections-"));
process.env.LANNA_DATA_DIR = TMP_DATA;

const core = await import("../src/core/watch-sections.ts");
const server = await import("../src/server/watch-sections.ts");
const { videoStore } = await import("../src/store/videos.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { watchRepStore } = await import("../src/store/watch-reps.ts");
type VideoRecord = import("../src/core/watch.ts").VideoRecord;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const w = (text: string, extra: Record<string, unknown> = {}) => ({ text, word: true, ...extra });
const sp = { text: " ", word: false };
const dot = { text: ".", word: false };

function line(i: number, words: Array<[string, Record<string, unknown>?]>, en: string) {
	const tokens = words.flatMap(([t, x], k) => (k ? [sp, w(t, x)] : [w(t, x)]));
	tokens.push(dot);
	return { i, start: i * 3, end: i * 3 + 3, sk: tokens.map((t) => t.text).join(""), en, tokens };
}

function video(id = "secsecsec01", trackLang = "sk"): VideoRecord {
	return {
		id,
		lang: "sk",
		url: `https://youtu.be/${id}`,
		title: "V kaviarni",
		durationSec: 30,
		source: { kind: "captions", trackLang, via: "test" },
		level: "A1",
		createdAt: "2026-11-07T08:00:00Z",
		segments: [
			line(0, [["Ahoj"]], "Hi."),
			line(
				1,
				[["Dám"], ["si"], ["kávu", { lemma: "káva", slug: "kava", gloss: "coffee", fresh: true }]],
				"I'll have a coffee.",
			),
			line(2, [["S"], ["mliekom", { lemma: "mlieko", slug: "mlieko", gloss: "milk", fresh: true }]], "With milk."),
			line(3, [["Koľko"], ["to"], ["stojí", { lemma: "stáť", slug: "stat", gloss: "to cost" }]], "How much is it?"),
			line(4, [["Dve"], ["eurá", { lemma: "euro", slug: "euro", gloss: "euro" }]], "Two euros."),
			line(5, [["Ďakujem"]], "Thank you."),
			line(6, [["Dovidenia"]], "Goodbye."),
		],
		questions: [],
		preTeach: [],
		coverage: 0.9,
		wordCount: 14,
		unknownCount: 2,
		usage: { model: "faux:watch", steps: [] },
		translatedBy: "model",
	} as unknown as VideoRecord;
}

function fauxEngine(steps: FauxResponseStep[]) {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(steps);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

const ANSWER = {
	sections: [
		{
			from: 1,
			to: 4,
			title: "Ordering a coffee",
			why: "Ordering and paying in a café.",
			focus: [
				{ line: 1, word: "kávu" },
				{ line: 2, word: "Mliekom" },
				{ line: 3, word: "stoji" },
				{ line: 9, word: "eurá" },
				{ line: 4, word: "eurá" },
			],
		},
	],
};

describe("the model's answer is held against the video", () => {
	test("words must be words of their line, as written; case does not count, accents do", () => {
		const [s] = core.parseSections(JSON.stringify(ANSWER), video());
		assert.ok(s);
		assert.equal(s.title, "Ordering a coffee");
		assert.deepEqual(
			s.focus.map((f) => [f.at, f.word, f.slug]),
			[
				[1, "kávu", "kava"],
				[2, "mliekom", "mlieko"],
				[4, "eurá", "euro"],
			],
		);
	});

	test("too short, out of range and overlapping sections are dropped; a long one is cut", () => {
		const text = `Here: ${JSON.stringify({
			sections: [
				{ from: 0, to: 1, title: "Too short", focus: [{ line: 0, word: "Ahoj" }] },
				{ from: 40, to: 45, title: "Out of range", focus: [] },
				{ from: 1, to: 4, title: "Kept", focus: [{ line: 2, word: "mliekom" }] },
				{ from: 3, to: 6, title: "Overlaps", focus: [{ line: 5, word: "Ďakujem" }] },
				{ from: 2, to: 99, title: "Also overlaps", focus: [{ line: 6, word: "Dovidenia" }] },
			],
		})}`;
		assert.deepEqual(
			core.parseSections(text, video()).map((s) => s.title),
			["Kept"],
		);
		assert.deepEqual(core.parseSections("no json at all", video()), []);
	});

	test("a section with no usable word is dropped", () => {
		assert.deepEqual(
			core.parseSections(
				JSON.stringify({ sections: [{ from: 1, to: 4, title: "x", focus: [{ line: 1, word: "čaj" }] }] }),
				video(),
			),
			[],
		);
	});

	test("the prompt numbers the lines and marks the words not studied", () => {
		const p = core.sectionsPrompt(video(), "A1");
		assert.match(p, /^1\. Dám si \[kávu\]\. — I'll have a coffee\.$/m);
		assert.match(p, /level: A1/);
	});
});

describe("the gaps come from the stored lines", () => {
	test("each focus word is a gap in its line, with the line's English and the word's meaning", () => {
		const [s] = core.parseSections(JSON.stringify(ANSWER), video());
		const reps = core.sectionReps(video(), s!);
		assert.equal(reps.length, 3);
		assert.deepEqual([reps[0]!.before, reps[0]!.answer, reps[0]!.after], ["Dám si ", "kávu", "."]);
		assert.equal(reps[0]!.en, "I'll have a coffee.");
		assert.equal(reps[0]!.gloss, "coffee");
		assert.equal(reps[0]!.id, "secsecsec01:1:4");
	});

	test("grading: case does not count, accents-only is its own verdict; the cue is the first letter", () => {
		assert.equal(core.gradeGap("kávu", "Kávu", "sk-SK"), "exact");
		assert.equal(core.gradeGap("kávu", "kavu", "sk-SK"), "accents");
		assert.equal(core.gradeGap("kávu", "čaj", "sk-SK"), "wrong");
		assert.equal(core.gapCue("kávu"), "k···");
	});
});

describe("finding and practicing sections", () => {
	test("one request, kept with its cost; asked again only when forced", async () => {
		videoStore.put(video());
		const engine = fauxEngine([
			fauxAssistantMessage(JSON.stringify(ANSWER)),
			fauxAssistantMessage(
				JSON.stringify({
					sections: [{ from: 4, to: 6, title: "Saying goodbye", why: "", focus: [{ line: 6, word: "Dovidenia" }] }],
				}),
			),
		]);
		const first = await server.findSections("secsecsec01", { engine, model: "faux:sections" });
		assert.equal(first.sections.length, 1);
		assert.equal(first.model, "faux:sections");
		assert.ok(first.usage.steps.length >= 1);
		const again = await server.findSections("secsecsec01", { engine, model: "faux:sections" });
		assert.equal(again.createdAt, first.createdAt, "kept, no second request");
		const forced = await server.findSections("secsecsec01", { engine, model: "faux:sections", force: true });
		assert.equal(forced.sections[0]!.title, "Saying goodbye");
		assert.equal(server.keptSections("secsecsec01")!.sections[0]!.title, "Saying goodbye");
	});

	test("captions in another language have no sections", async () => {
		videoStore.put(video("secsecsec02", "cs"));
		await assert.rejects(
			server.findSections("secsecsec02", { engine: fauxEngine([]), model: "x" }),
			/not in the language/,
		);
	});

	test("a finished section: XP per gap, misses to Review and back in Listen, unknown gaps ignored", async () => {
		videoStore.put(video("secsecsec03"));
		await server.findSections("secsecsec03", {
			engine: fauxEngine([fauxAssistantMessage(JSON.stringify(ANSWER))]),
			model: "faux:sections",
		});
		const xpBefore = progressStore.read().xp;
		const out = server.recordSection(
			{
				videoId: "secsecsec03",
				section: 0,
				results: [
					{ id: "secsecsec03:1:4", verdict: "exact", assisted: false },
					{ id: "secsecsec03:2:2", verdict: "wrong", assisted: true },
					{ id: "secsecsec03:4:2", verdict: "accents", assisted: false },
					{ id: "secsecsec03:9:9", verdict: "exact", assisted: false },
					{ id: "secsecsec03:1:4", verdict: "exact", assisted: false },
				],
				activeMs: 120_000,
				tz: 0,
			},
			new Date("2026-11-07T10:00:00Z"),
		);
		assert.equal(out.total, 3);
		assert.equal(out.right, 2);
		assert.equal(out.xp, 10 + 0 + 5);
		assert.equal(progressStore.read().xp - xpBefore, 15);
		assert.equal(out.lines, 1);
		assert.deepEqual(
			watchRepStore
				.read()
				.lines.filter((l) => l.videoId === "secsecsec03")
				.map((l) => l.text),
			["S mliekom."],
		);
		assert.throws(() => server.recordSection({ videoId: "secsecsec03", section: 5, results: [] }), /No such section/);
	});
});
