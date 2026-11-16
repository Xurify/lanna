/**
 * Get ready (E70, docs/research/pre-listening.md): the model's briefing is
 * kept only where it holds against the video's own lines (real part ranges
 * in order, keys that are runs of words of their line), the summary is
 * glossed and measured and written again once when it is too hard, the
 * answer is kept and not asked again, and typing the keys pays XP and sends
 * the misses to Review and Listen. Runs under an isolated LANNA_DATA_DIR, so
 * app modules are imported after it.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-watch-prep-"));
process.env.LANNA_DATA_DIR = TMP_DATA;

const core = await import("../src/core/watch-prep.ts");
const server = await import("../src/server/watch-prep.ts");
const { videoStore } = await import("../src/store/videos.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { watchRepStore } = await import("../src/store/watch-reps.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
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

function video(id = "prepprepp01", trackLang = "sk"): VideoRecord {
	return {
		id,
		lang: "sk",
		url: `https://youtu.be/${id}`,
		title: "Od hudby k financiám",
		channel: "Bez extrémov",
		durationSec: 30,
		source: { kind: "auto-captions", trackLang, via: "test" },
		level: "A1",
		createdAt: "2026-11-07T08:00:00Z",
		segments: [
			line(0, [["Ahoj"], ["všetci"]], "Hi everyone."),
			line(
				1,
				[
					["Dnes"],
					["hovoríme"],
					["o"],
					["peniazoch", { lemma: "peniaze", slug: "peniaze", gloss: "money", fresh: true }],
				],
				"Today we talk about money.",
			),
			line(
				2,
				[["Robila"], ["som"], ["hudbu", { lemma: "hudba", slug: "hudba", gloss: "music", fresh: true }]],
				"I made music.",
			),
			line(
				3,
				[
					["Potom"],
					["som"],
					["začala"],
					["počítať", { lemma: "počítať", slug: "pocitat", gloss: "to count", fresh: true }],
					["financie", { lemma: "financie", slug: "financie", gloss: "finances", fresh: true }],
				],
				"Then I started counting finances.",
			),
			line(4, [["Bolo"], ["to"], ["ťažké", { lemma: "ťažký", slug: "tazky", gloss: "hard" }]], "It was hard."),
			line(
				5,
				[["Ale"], ["bavilo", { lemma: "baviť", slug: "bavit", gloss: "to enjoy", fresh: true }], ["ma"], ["to"]],
				"But I enjoyed it.",
			),
			line(
				6,
				[["Ďakujem"], ["za"], ["pozvanie", { lemma: "pozvanie", slug: "pozvanie", gloss: "invitation", fresh: true }]],
				"Thanks for the invitation.",
			),
		],
		questions: [],
		preTeach: [],
		coverage: 0.5,
		wordCount: 24,
		unknownCount: 6,
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
	about: "A podcast host talks with a musician who now works in finance.",
	parts: [
		{ from: 0, to: 1, what: "The host opens and names the topic: money." },
		{ from: 2, to: 3, what: "The guest says she made music and then started counting finances." },
		{ from: 4, to: 6, what: "It was hard, but she enjoyed it; she thanks the host." },
	],
	keys: [
		{ line: 1, words: "peniazoch", why: "money" },
		{ line: 3, words: "počítať financie", why: "to count finances" },
		{ line: 3, words: "začala", why: "started" },
		{ line: 5, words: "Bavilo ma", why: "I enjoyed" },
		{ line: 6, words: "pozvanie", why: "invitation" },
		{ line: 9, words: "nič", why: "nothing" },
		{ line: 2, words: "hudbu robila", why: "wrong order" },
		{ line: 4, words: "tazke", why: "accents missing" },
	],
	summary: [
		{ sk: "To je podcast.", en: "This is a podcast." },
		{ sk: "Hovoria o peniazoch.", en: "They talk about money." },
		{ sk: "Ona robila hudbu.", en: "She made music." },
		{ sk: "Teraz počíta financie.", en: "Now she counts finances." },
	],
};

describe("the model's briefing is held against the video", () => {
	test("parts must be real ranges in order that do not overlap, each with a statement", () => {
		const parts = core.parseParts(
			[
				{ from: 4, to: 6, what: "Ending" },
				{ from: 0, to: 1, what: "Opening" },
				{ from: 1, to: 3, what: "Overlaps the opening" },
				{ from: 2, to: 99, what: "Runs past the end" },
				{ from: 40, to: 45, what: "Out of range" },
				{ from: 2, to: 3 },
			],
			video(),
		);
		assert.deepEqual(
			parts.map((p) => [p.from, p.to, p.what]),
			[
				[0, 1, "Opening"],
				[2, 6, "Runs past the end"],
			],
		);
	});

	test("a key is a run of words of its line as written: order and accents count, case does not; one per line", () => {
		const keys = core.parseKeys(ANSWER.keys, video());
		assert.deepEqual(
			keys.map((k) => [k.at, k.text, k.span]),
			[
				[1, "peniazoch", 1],
				[3, "počítať financie", 2],
				[5, "bavilo ma", 2],
				[6, "pozvanie", 1],
			],
		);
		assert.equal(keys[0]!.slug, "peniaze");
		assert.equal(keys[0]!.gloss, "money");
		assert.equal(keys[1]!.slug, undefined, "a phrase carries no one dictionary entry");
		assert.equal(keys[1]!.why, "to count finances");
	});

	test("a phrase does not cross punctuation", () => {
		const tokens = [w("Dobre"), { text: ", ", word: false }, w("ďakujem"), dot];
		assert.equal(core.findSpan(tokens, ["dobre", "ďakujem"]), -1);
		assert.equal(core.findSpan(tokens, ["ďakujem"]), 2);
	});

	test("the whole answer: about, parts, keys and summary; nothing usable is null", () => {
		const p = core.parsePrep(`Here you go:\n${JSON.stringify(ANSWER)}`, video());
		assert.ok(p);
		assert.match(p.about, /podcast host/);
		assert.equal(p.parts.length, 3);
		assert.equal(p.keys.length, 4);
		assert.equal(p.summary.length, 4);
		assert.equal(core.parsePrep("no json", video()), null);
		assert.equal(core.parsePrep(JSON.stringify({ about: "x", parts: [], keys: [], summary: [] }), video()), null);
	});

	test("the prompt numbers the lines, marks the words not studied and names the level", () => {
		const p = core.prepPrompt(video(), "A1");
		assert.match(p, /^1\. Dnes hovoríme o \[peniazoch\]\. — Today we talk about money\.$/m);
		assert.match(p, /level: A1/);
		assert.match(core.prepSystem("Slovak", "A1"), /level A1/);
	});
});

describe("the gaps come from the stored lines", () => {
	test("each key is a gap in its line; a phrase is one gap", () => {
		const keys = core.parseKeys(ANSWER.keys, video());
		const reps = core.prepReps(video(), keys);
		assert.equal(reps.length, 4);
		assert.deepEqual(
			[reps[1]!.before, reps[1]!.answer, reps[1]!.after],
			["Potom som začala ", "počítať financie", "."],
		);
		assert.equal(reps[1]!.gloss, "to count finances");
		assert.equal(reps[0]!.id, "prepprepp01:1:6:key");
		assert.equal(reps[0]!.lemma, "peniaze");
	});
});

describe("making and finishing the briefing", () => {
	const EASIER = {
		summary: [
			{ sk: "To je dobre.", en: "That is good." },
			{ sk: "Ona je tu.", en: "She is here." },
			{ sk: "Má to rada.", en: "She likes it." },
		],
	};

	test("one request, the summary written again once when too hard, kept with its cost; asked again only when forced", async () => {
		videoStore.put(video());
		const engine = fauxEngine([
			fauxAssistantMessage(JSON.stringify(ANSWER)),
			fauxAssistantMessage(JSON.stringify(EASIER)),
			fauxAssistantMessage(JSON.stringify({ ...ANSWER, about: "Second time." })),
			fauxAssistantMessage(JSON.stringify(EASIER)),
		]);
		// No dictionary: every word is unknown, so the summary is under the floor and written again once.
		const first = await server.makePrep("prepprepp01", { engine, model: "faux:prep", lexicon: null });
		assert.equal(first.model, "faux:prep");
		assert.equal(first.parts.length, 3);
		assert.equal(first.keys.length, 4, "keys are held against the lines whatever the dictionary");
		assert.equal(first.drafts, 2);
		assert.equal(first.usage.steps.length, 2);
		// Neither draft is known without a dictionary; the first stays unless the second measures better.
		assert.ok(first.summary.length === 4 || first.summary.length === 3);
		assert.ok(first.summary.every((s) => s.tokens.some((t) => t.word)));
		assert.equal(first.linesShown, 7);
		const again = await server.makePrep("prepprepp01", { engine, model: "faux:prep", lexicon: null });
		assert.equal(again.createdAt, first.createdAt, "kept, no second request");
		const forced = await server.makePrep("prepprepp01", { engine, model: "faux:prep", force: true, lexicon: null });
		assert.equal(forced.about, "Second time.");
		assert.equal(server.keptPrep("prepprepp01")!.about, "Second time.");
	});

	test("the summary is glossed against the dictionary and measured with the video's own estimate", async () => {
		videoStore.put(video("prepprepp02"));
		const engine = fauxEngine([
			fauxAssistantMessage(JSON.stringify(ANSWER)),
			fauxAssistantMessage(JSON.stringify(EASIER)),
		]);
		const rec = await server.makePrep("prepprepp02", { engine, model: "faux:prep", lexicon: loadLexicon() });
		assert.ok(rec.drafts === 1 || rec.drafts === 2);
		assert.equal(rec.usage.steps.length, rec.drafts);
		const words = rec.summary.flatMap((s) => s.tokens.filter((t) => t.word));
		assert.ok(
			words.some((t) => t.slug && t.gloss),
			"the dictionary glosses the summary's words",
		);
		assert.ok(rec.summaryKnown >= 0 && rec.summaryKnown <= 1);
		assert.ok(rec.summaryExpected >= rec.summaryKnown, "the level expects at least what the learner studied");
	});

	test("foreign captions: briefed from the rendering kept on the lines, no second request; the gaps use the rendering", async () => {
		const v = video("prepprepp03", "cs");
		// Czech lines as captioned, each with its Slovak rendering kept at prepare time (E70).
		const czech = [
			"Ahoj všichni.",
			"Dnes mluvíme o penězích.",
			"Dělala jsem hudbu.",
			"Potom jsem začala počítat finance.",
			"Bylo to těžké.",
			"Ale bavilo mě to.",
			"Děkuji za pozvání.",
		];
		v.segments = v.segments.map((s, i) => ({ ...s, rendered: s.sk, sk: czech[i]! }));
		videoStore.put(v);
		const rec = await server.makePrep("prepprepp03", {
			engine: fauxEngine([fauxAssistantMessage(JSON.stringify(ANSWER)), fauxAssistantMessage(JSON.stringify(EASIER))]),
			model: "faux:prep",
			lexicon: loadLexicon(),
		});
		assert.ok(rec.lines, "the briefing keeps the lines it was built on");
		assert.equal(rec.lines!.length, 7);
		assert.equal(rec.lines![1]!.sk, "Dnes hovoríme o peniazoch.");
		assert.ok(
			rec.lines![1]!.tokens.some((t) => t.text === "peniazoch" && t.slug),
			"the rendering is glossed against the dictionary",
		);
		assert.deepEqual(
			rec.keys.map((k) => k.text),
			["peniazoch", "počítať financie", "bavilo ma", "pozvanie"],
		);
		const reps = core.prepReps(v, rec.keys, rec.lines);
		assert.equal(reps[1]!.line, "Potom som začala počítať financie.");
		assert.equal(
			core.prepReps(v, rec.keys)[1]!.line,
			"Potom jsem začala počítat finance.",
			"without the briefing's lines the gaps would fall on the Czech",
		);
		// No line goes back to Listen from foreign captions (E56); the words still go to Review.
		const out = server.recordPrep(
			{ videoId: "prepprepp03", results: [{ id: "prepprepp03:3:6:key", verdict: "wrong", assisted: true }], tz: 0 },
			new Date("2026-11-07T10:00:00Z"),
		);
		assert.equal(out.total, 1);
		assert.equal(out.lines, 0);
		assert.equal(watchRepStore.read().lines.filter((l) => l.videoId === "prepprepp03").length, 0);
	});

	test("foreign captions kept before the rendering was kept are rendered once more, on the briefing's cost", async () => {
		const v = video("prepprepp06", "cs");
		const czech = [
			"Ahoj všichni.",
			"Dnes mluvíme o penězích.",
			"Dělala jsem hudbu.",
			"Potom jsem začala počítat finance.",
			"Bylo to těžké.",
			"Ale bavilo mě to.",
			"Děkuji za pozvání.",
		];
		const slovak = v.segments.map((s) => s.sk);
		v.segments = v.segments.map((s, i) => ({ ...s, sk: czech[i]! }));
		videoStore.put(v);
		const engine = fauxEngine([
			fauxAssistantMessage(JSON.stringify({ t: slovak })),
			fauxAssistantMessage(JSON.stringify(ANSWER)),
			fauxAssistantMessage(JSON.stringify(EASIER)),
		]);
		const rec = await server.makePrep("prepprepp06", { engine, model: "faux:prep", lexicon: loadLexicon() });
		assert.equal(rec.lines![3]!.sk, "Potom som začala počítať financie.");
		assert.equal(rec.keys.length, 4);
		assert.ok(rec.usage.steps.length >= 2, "the rendering is on the briefing's cost");
	});

	test("the prompt says when the lines are a rendering", () => {
		const p = core.prepPrompt(video(), "A1", { captions: "Czech", language: "Slovak" });
		assert.match(p, /captions are Czech; the lines below are a Slovak rendering/);
	});

	test("typing the keys: XP per gap, misses to Review and back in Listen, unknown gaps ignored, the record marked done", async () => {
		videoStore.put(video("prepprepp04"));
		await server.makePrep("prepprepp04", {
			engine: fauxEngine([fauxAssistantMessage(JSON.stringify(ANSWER))]),
			model: "faux:prep",
			lexicon: loadLexicon(),
		});
		const xpBefore = progressStore.read().xp;
		const out = server.recordPrep(
			{
				videoId: "prepprepp04",
				results: [
					{ id: "prepprepp04:1:6:key", verdict: "exact", assisted: false },
					{ id: "prepprepp04:3:6:key", verdict: "wrong", assisted: true },
					{ id: "prepprepp04:5:2:key", verdict: "accents", assisted: false },
					{ id: "prepprepp04:6:4:key", verdict: "exact", assisted: false },
					{ id: "prepprepp04:9:9:key", verdict: "exact", assisted: false },
					{ id: "prepprepp04:1:6:key", verdict: "exact", assisted: false },
				],
				activeMs: 90_000,
				tz: 0,
			},
			new Date("2026-11-07T10:00:00Z"),
		);
		assert.equal(out.total, 4);
		assert.equal(out.right, 3);
		assert.equal(out.xp, 10 + 0 + 5 + 10);
		assert.equal(progressStore.read().xp - xpBefore, 25);
		assert.equal(
			out.lines,
			0,
			"automatic captions can misspell what was said, so their lines do not come back in Listen",
		);
		assert.equal(watchRepStore.read().lines.filter((l) => l.videoId === "prepprepp04").length, 0);
		const done = server.keptPrep("prepprepp04")!.done;
		assert.deepEqual(done, { at: "2026-11-07T10:00:00.000Z", right: 3, total: 4, xp: 25 });
		// Captions made by people: the missed line comes back in Listen.
		const made = video("prepprepp07");
		made.source = { kind: "captions", trackLang: "sk", via: "test" };
		videoStore.put(made);
		await server.makePrep("prepprepp07", {
			engine: fauxEngine([fauxAssistantMessage(JSON.stringify(ANSWER))]),
			model: "faux:prep",
			lexicon: loadLexicon(),
		});
		const again = server.recordPrep(
			{ videoId: "prepprepp07", results: [{ id: "prepprepp07:3:6:key", verdict: "wrong", assisted: true }], tz: 0 },
			new Date("2026-11-07T10:00:00Z"),
		);
		assert.equal(again.lines, 1);
		assert.deepEqual(
			watchRepStore
				.read()
				.lines.filter((l) => l.videoId === "prepprepp07")
				.map((l) => l.text),
			["Potom som začala počítať financie."],
		);
		videoStore.put(video("prepprepp05"));
		assert.throws(() => server.recordPrep({ videoId: "prepprepp05", results: [] }), /Get ready first/);
	});
});
