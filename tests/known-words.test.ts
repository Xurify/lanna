/**
 * Words marked as known (E69): kept per profile, counted as met wherever
 * "known" is measured, a kept video measured again once the list changed,
 * and the word popover's lookup saying so. Runs under an isolated
 * LH_DATA_DIR, so app modules are imported after it.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-known-words-"));
process.env.LH_DATA_DIR = TMP_DATA;

const { knownWordStore } = await import("../src/store/known-words.ts");
const { knownWords } = await import("../src/server/reading.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const watch = await import("../src/server/watch.ts");
const { videoStore } = await import("../src/store/videos.ts");
const { lookupSelectionAsync } = await import("../src/server/word-bank.ts");
const { MEASURE_VERSION } = await import("../src/core/watch.ts");
type VideoRecord = import("../src/core/watch.ts").VideoRecord;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const lexicon = loadLexicon();
const slugOf = (form: string) => lexicon!.byForm.get(form)![0]!.slug;

describe("marking words as known", () => {
	test("a marked word is kept with its dictionary form and counts as met; unmarking takes it out", () => {
		const ze = slugOf("že");
		assert.equal(knownWordStore.has(ze), false);
		assert.equal(knownWords(lexicon).met.has(ze), false);
		assert.equal(knownWordStore.set(ze, "že", true, new Date("2026-11-07T12:00:00Z")), true);
		assert.equal(knownWordStore.has(ze), true);
		assert.equal(knownWordStore.updatedAt(), "2026-11-07T12:00:00.000Z");
		const k = knownWords(lexicon);
		assert.ok(k.met.has(ze) && k.known.has(ze) && k.expected.has(ze));
		assert.ok(k.sample.includes("že"), "the story brief may use it");
		assert.equal(knownWordStore.set(ze, "že", true, new Date("2026-11-07T12:01:00Z")), true, "marking again changes nothing");
		assert.equal(knownWordStore.updatedAt(), "2026-11-07T12:00:00.000Z");
		assert.equal(knownWordStore.set(ze, "že", false, new Date("2026-11-07T12:02:00Z")), false);
		assert.equal(knownWords(lexicon).met.has(ze), false);
		const saved = JSON.parse(fs.readFileSync(path.join(TMP_DATA, "profiles", "slovak", "known.json"), "utf-8")) as { updatedAt: string; words: Record<string, unknown> };
		assert.deepEqual(saved.words, {});
		assert.equal(saved.updatedAt, "2026-11-07T12:02:00.000Z");
	});

	test("the word popover's lookup says a word is known", async () => {
		const dobry = slugOf("dobrý");
		knownWordStore.set(dobry, "dobrý", true, new Date("2026-11-07T12:10:00Z"));
		const r = await lookupSelectionAsync("dobrý");
		assert.equal(r.known, true);
		knownWordStore.set(dobry, "dobrý", false, new Date("2026-11-07T12:11:00Z"));
		assert.equal((await lookupSelectionAsync("dobrý")).known, false);
	});

	test("a kept video measured before a word was marked is measured again when opened: the share rises and the word leaves the pre-teach list", async () => {
		const captions = async (id: string) => ({
			meta: { id, title: "Dobrý deň", durationSec: 20 },
			cues: [
				{ start: 0, dur: 4, text: "Dobrý deň, mám veľmi dobrú kávu." },
				{ start: 4, dur: 4, text: "Je dobrá a je lacná." },
				{ start: 8, dur: 4, text: "Dobrý obchod má dobrú kávu každý deň." },
			],
			source: { kind: "captions" as const, trackLang: "sk", via: "test" as const },
			raw: undefined,
		});
		const { createFauxCore, fauxAssistantMessage } = await import("@earendil-works/pi-ai");
		const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
		faux.setResponses([fauxAssistantMessage(JSON.stringify({ t: ["Hello, I have very good coffee.", "It is good and it is cheap.", "A good shop has good coffee every day."] }))]);
		const engine = { model: faux.getModel(), streamFn: faux.streamSimple };
		const before = await watch.prepareVideo("https://youtu.be/knownknown1", { engine, model: "faux:watch", captions, questions: false, now: new Date("2026-11-07T12:20:00Z") });
		assert.equal(before.measuredAt, "2026-11-07T12:20:00.000Z");
		const dobry = slugOf("dobrý");
		assert.ok(before.preTeach.some((w) => w.slug === dobry), "dobrý is not studied, so it is pre-taught");

		knownWordStore.set(dobry, "dobrý", true, new Date("2026-11-07T12:30:00Z"));
		const after1 = watch.remeasureVideo(videoStore.get("knownknown1")!, new Date("2026-11-07T12:31:00Z"));
		assert.ok(after1.coverage > before.coverage, `the share rises (${before.coverage} → ${after1.coverage})`);
		assert.ok(!after1.preTeach.some((w) => w.slug === dobry), "a known word is not pre-taught");
		assert.equal(after1.measuredAt, "2026-11-07T12:31:00.000Z");
		assert.equal(after1.measure, MEASURE_VERSION);
		assert.equal(videoStore.get("knownknown1")!.coverage, after1.coverage, "kept");
		assert.equal(watch.remeasureVideo(after1, new Date("2026-11-07T12:32:00Z")), after1, "measured after the mark: nothing to do");
		assert.equal(watch.currentVideo("knownknown1")!.coverage, after1.coverage);
	});

	test("a foreign-caption video is measured again on the rendering kept on its lines", () => {
		const rec: VideoRecord = {
			...videoStore.get("knownknown1")!,
			id: "knownknown2",
			source: { kind: "captions", trackLang: "cs", via: "test" },
			measuredAt: "2026-11-07T12:00:00Z",
			coverageEstimated: true,
		};
		rec.segments = rec.segments.map((s) => ({ ...s, rendered: s.sk, sk: s.sk.replace("deň", "den") }));
		videoStore.put(rec);
		const again = watch.remeasureVideo(rec, new Date("2026-11-07T12:40:00Z"));
		assert.equal(again.coverage, videoStore.get("knownknown1")!.coverage, "measured on the rendering, which is the Slovak");
		assert.equal(again.coverageEstimated, true);
		assert.equal(again.measuredAt, "2026-11-07T12:40:00.000Z");
		const noRendering: VideoRecord = { ...rec, id: "knownknown3", segments: rec.segments.map(({ rendered: _r, ...s }) => s) };
		assert.equal(watch.remeasureVideo(noRendering, new Date()), noRendering, "without a rendering the estimate is kept");
	});
});
