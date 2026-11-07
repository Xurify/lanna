/**
 * WATCH LINES IN LISTEN (LangHarness, 2026-11-05; proposal 7 in
 * docs/research/creator-hooks.md): the scheduling table, the store round trip,
 * the lines a Watch save queues, the Listen session that serves the due ones,
 * and what a Listen answer does to them. No network and no model: the
 * better-options check counts calls on a scripted engine.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";
import { createFauxCore, fauxAssistantMessage } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-watch-reps-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

type WatchRep = import("../src/core/watch-reps.ts").WatchRep;
type VideoRecord = import("../src/core/watch.ts").VideoRecord;
type ListenRep = import("../src/server/listen.ts").ListenRep;
type ListenItem = import("../src/core/listen.ts").ListenItem;

const { PATHS } = await import("../config.ts");
const reps = await import("../src/core/watch-reps.ts");
const { LISTEN_COUNT } = await import("../src/core/listen.ts");
const { listenFor, recordListen } = await import("../src/server/listen.ts");
const { listenWithBetterOptions } = await import("../src/server/distractors.ts");
const { recordWatch } = await import("../src/server/watch.ts");
const { watchRepStore } = await import("../src/store/watch-reps.ts");
const { videoStore } = await import("../src/store/videos.ts");
const { readLessonLog } = await import("../src/store/corpus.ts");
const { reviewStore } = await import("../src/store/review.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const DAY = "2026-11-05";
const AT = "2026-11-05T10:00:00.000Z";
const NOW = new Date(AT);
const storeFile = () => path.join(PATHS.data, "watch-reps.json");
const resetStore = () => fs.rmSync(storeFile(), { force: true });

function line(over: Partial<WatchRep> = {}): WatchRep {
	return { id: "vid00000001:3", text: "Dobrý deň, ako sa máte?", en: "Good day, how are you?", videoId: "vid00000001", title: "Test video", added: "2026-11-04", step: 0, due: DAY, ...over };
}

function rep(itemId: string, over: Partial<ListenRep> = {}): ListenRep {
	return { itemId, slug: "", lemma: "", gloss: "", sentence: "", translation: "", given: "", verdict: "wrong", answer: "type", stretch: [], ...over };
}

describe("scheduling", () => {
	const now = { day: DAY, at: AT };

	test("a miss is shown again tomorrow, back at step 0", () => {
		const after = reps.scheduleWatchRep(line({ step: 2 }), { verdict: "wrong" }, now);
		assert.equal(after.step, 0);
		assert.equal(after.due, "2026-11-06");
		assert.equal(after.retiredAt, undefined);
	});

	test("three understood answers move the line 1 to 3 to 7 days and retire it", () => {
		let r = line();
		r = reps.scheduleWatchRep(r, { verdict: "exact" }, now);
		assert.equal(r.step, 1);
		assert.equal(r.due, "2026-11-08");
		r = reps.scheduleWatchRep(r, { verdict: "exact" }, { day: "2026-11-08", at: "2026-11-08T10:00:00.000Z" });
		assert.equal(r.step, 2);
		assert.equal(r.due, "2026-11-15");
		r = reps.scheduleWatchRep(r, { verdict: "exact" }, { day: "2026-11-15", at: "2026-11-15T10:00:00.000Z" });
		assert.equal(r.retiredAt, "2026-11-15T10:00:00.000Z");
	});

	test("an accents-only answer keeps the step and is due tomorrow", () => {
		const after = reps.scheduleWatchRep(line({ step: 1 }), { verdict: "accents" }, now);
		assert.equal(after.step, 1);
		assert.equal(after.due, "2026-11-06");
		assert.equal(after.retiredAt, undefined);
	});

	test("a peeked answer counts as a miss, even when it was right", () => {
		const right = reps.scheduleWatchRep(line({ step: 1 }), { verdict: "exact", peeked: true }, now);
		assert.equal(right.step, 0);
		assert.equal(right.due, "2026-11-06");
		const almost = reps.scheduleWatchRep(line({ step: 1 }), { verdict: "accents", peeked: true }, now);
		assert.equal(almost.step, 0);
	});

	test("a session offers at most three due lines, oldest due first", () => {
		const lines = [
			line({ id: "a:1", due: "2026-11-05", added: "2026-11-03" }),
			line({ id: "a:2", due: "2026-11-02", added: "2026-11-01" }),
			line({ id: "a:3", due: "2026-11-04", added: "2026-11-04" }),
			line({ id: "a:4", due: "2026-11-03", added: "2026-11-03" }),
			line({ id: "a:5", due: "2026-11-06" }),
			line({ id: "a:6", due: "2026-11-01", retiredAt: AT }),
		];
		assert.deepEqual(
			reps.dueWatchReps(lines, DAY).map((r) => r.id),
			["a:2", "a:4", "a:3"],
		);
	});

	test("the day after a date is counted across month ends", () => {
		assert.equal(reps.dayAfter("2026-10-31", 1), "2026-11-01");
		assert.equal(reps.dayAfter("2026-11-05", 7), "2026-11-12");
	});
});

describe("the lines a Watch save keeps", () => {
	const video = {
		id: "vid00000001",
		title: "Test video",
		segments: [
			{ i: 0, sk: "Ahoj, ako sa máš?", en: "Hi, how are you?" },
			{ i: 1, sk: "Dobrý deň.", en: "" },
			{ i: 2, sk: "   ", en: "Silence" },
			{ i: 3, sk: "Sme doma.", en: "We are home." },
		],
	};

	test("a line not understood on the first unaided listen is kept; one understood first time is not", () => {
		const out = reps.missedWatchReps(video, [
			{ i: 0, got: "first" },
			{ i: 1, got: "no" },
			{ i: 2, got: "after" },
			{ i: 3, got: "after" },
		], DAY);
		assert.deepEqual(out.map((r) => r.id), ["vid00000001:1", "vid00000001:3"]);
		assert.equal(out[0]!.en, undefined, "an empty translation is not kept");
		assert.equal(out[1]!.en, "We are home.");
		assert.equal(out[0]!.step, 0);
		assert.equal(out[0]!.added, DAY);
		assert.equal(out[0]!.due, "2026-11-06");
	});

	test("a watch line becomes a Listen item with no options, no stretch words and its own words counted", () => {
		const item = reps.watchListenItem(line({ id: "vid00000001:3", text: "Mám 2 deti, dve mačky.", en: "I have 2 kids, two cats." }));
		assert.equal(item.id, "watch:vid00000001:3");
		assert.equal(reps.isWatchItem(item.id), true);
		assert.equal(reps.watchRepOfItem(item.id), "vid00000001:3");
		assert.equal(item.sentence, "Mám 2 deti, dve mačky.");
		assert.equal(item.translation, "I have 2 kids, two cats.");
		assert.deepEqual(item.options, []);
		assert.deepEqual(item.stretch, []);
		assert.equal(item.coverage, 1);
		assert.equal(item.words, 4, "Mám, deti, dve, mačky: the numeral is not a word");
		assert.equal(reps.isWatchItem("hello#1"), false);
	});
});

describe("the store", () => {
	test("a line is queued once and comes back as written", () => {
		resetStore();
		const a = line({ id: "vid00000002:0", en: "Good day." });
		const b = line({ id: "vid00000002:1", text: "Ďakujem." });
		assert.deepEqual(watchRepStore.addNew([a, a, b]), ["vid00000002:0", "vid00000002:1"]);
		assert.deepEqual(watchRepStore.addNew([a]), [], "a line already on file is not queued again");
		assert.equal(path.dirname(storeFile()), PATHS.data);
		assert.ok(PATHS.data.endsWith(path.join("profiles", "slovak")));
		const back = watchRepStore.read().lines;
		assert.deepEqual(back, [a, b]);
	});

	test("a retired line leaves the active list and keeps its record", () => {
		resetStore();
		const a = line({ id: "vid00000002:0" });
		const b = line({ id: "vid00000002:1" });
		watchRepStore.addNew([a, b]);
		watchRepStore.replace([{ ...a, retiredAt: AT }]);
		assert.deepEqual(watchRepStore.active().map((l) => l.id), ["vid00000002:1"]);
		assert.equal(watchRepStore.read().lines.find((l) => l.id === "vid00000002:0")!.retiredAt, AT);
	});
});

describe("a Watch save queues its missed lines", () => {
	test("recordWatch keeps the line not understood on the first listen, once", () => {
		resetStore();
		const record: VideoRecord = {
			id: "vid00000003",
			lang: "sk",
			url: "https://www.youtube.com/watch?v=vid00000003",
			title: "Na trhu",
			durationSec: 60,
			source: { kind: "captions", trackLang: "sk", via: "test" },
			level: "A2",
			createdAt: "2026-11-04T09:00:00.000Z",
			segments: [
				{ i: 0, start: 0, end: 3, sk: "Dobrý deň, pani predavačka.", en: "Good day, shopkeeper.", tokens: [] },
				{ i: 1, start: 3, end: 6, sk: "Koľko stojí chlieb?", en: "How much is the bread?", tokens: [] },
				{ i: 2, start: 6, end: 9, sk: "", en: "", tokens: [] },
			],
			questions: [],
			preTeach: [],
			coverage: 0.9,
			wordCount: 8,
			unknownCount: 2,
			usage: { model: "faux:watch", steps: [] },
			translatedBy: "model",
		};
		videoStore.put(record);
		const stats = [
			{ i: 0, words: 4, sec: 3, replays: 0, slow: false, revealed: false, got: "first" as const },
			{ i: 1, words: 4, sec: 3, replays: 1, slow: false, revealed: false, got: "after" as const },
			{ i: 2, words: 0, sec: 3, replays: 0, slow: false, revealed: false, got: "no" as const },
		];
		const watchedAt = new Date("2026-11-05T09:00:00Z");
		recordWatch({ videoId: record.id, mode: "step", stats, answers: [], tapped: [], tz: 0 }, watchedAt);
		recordWatch({ videoId: record.id, mode: "step", stats, answers: [], tapped: [], tz: 0 }, watchedAt);
		const kept = watchRepStore.read().lines.filter((l) => l.videoId === record.id);
		assert.deepEqual(kept.map((l) => [l.id, l.text, l.en, l.added, l.step, l.due]), [["vid00000003:1", "Koľko stojí chlieb?", "How much is the bread?", DAY, 0, "2026-11-06"]]);
	});

	test("a Czech-caption video queues nothing, since its lines would be spoken in Slovak", () => {
		resetStore();
		const record: VideoRecord = {
			id: "vid00000004",
			lang: "sk",
			url: "https://www.youtube.com/watch?v=vid00000004",
			title: "Na trhu, česky",
			durationSec: 60,
			source: { kind: "auto-captions", trackLang: "cs", via: "test" },
			level: "A2",
			createdAt: "2026-11-04T09:00:00.000Z",
			segments: [
				{ i: 0, start: 0, end: 3, sk: "Dobrý den, paní prodavačko.", en: "Good day, shopkeeper.", tokens: [] },
				{ i: 1, start: 3, end: 6, sk: "Kolik stojí chléb?", en: "How much is the bread?", tokens: [] },
			],
			questions: [],
			preTeach: [],
			coverage: 0.9,
			wordCount: 8,
			unknownCount: 2,
			usage: { model: "faux:watch", steps: [] },
			translatedBy: "model",
		};
		videoStore.put(record);
		const stats = [
			{ i: 0, words: 4, sec: 3, replays: 0, slow: false, revealed: false, got: "no" as const },
			{ i: 1, words: 4, sec: 3, replays: 0, slow: false, revealed: false, got: "no" as const },
		];
		recordWatch({ videoId: record.id, mode: "step", stats, answers: [], tapped: [], tz: 0 }, new Date("2026-11-05T09:00:00Z"));
		assert.deepEqual(watchRepStore.read().lines.filter((l) => l.videoId === record.id), []);
	});

	test("a video with automatic captions queues nothing, since their text can be wrong", () => {
		resetStore();
		const record: VideoRecord = {
			id: "vid00000005",
			lang: "sk",
			url: "https://www.youtube.com/watch?v=vid00000005",
			title: "Na trhu, automaticky",
			durationSec: 60,
			source: { kind: "auto-captions", trackLang: "sk", via: "test" },
			level: "A2",
			createdAt: "2026-11-04T09:00:00.000Z",
			segments: [{ i: 0, start: 0, end: 3, sk: "Dobrý deň, pani predavačka.", en: "Good day, shopkeeper.", tokens: [] }],
			questions: [],
			preTeach: [],
			coverage: 0.9,
			wordCount: 4,
			unknownCount: 1,
			usage: { model: "faux:watch", steps: [] },
			translatedBy: "model",
		};
		videoStore.put(record);
		const stats = [{ i: 0, words: 4, sec: 3, replays: 0, slow: false, revealed: false, got: "no" as const }];
		recordWatch({ videoId: record.id, mode: "step", stats, answers: [], tapped: [], tz: 0 }, new Date("2026-11-05T09:00:00Z"));
		assert.deepEqual(watchRepStore.read().lines.filter((l) => l.videoId === record.id), []);
	});
});

describe("Listen serves the due watch lines", () => {
	test("up to three due lines go in with the sentences, which keep their order", () => {
		resetStore();
		const seed = 11;
		const before = listenFor(seed, NOW, 0);
		assert.equal(before.items.length, LISTEN_COUNT);
		assert.equal(before.items.some((i) => reps.isWatchItem(i.id)), false);

		watchRepStore.addNew([
			line({ id: "vid00000004:0", text: "Chcem kúpiť chlieb.", en: "I want to buy bread.", added: "2026-11-04", due: DAY }),
			line({ id: "vid00000004:1", text: "Je to drahé.", en: "It is expensive.", added: "2026-11-03", due: "2026-11-03" }),
			line({ id: "vid00000004:2", text: "Mám čas.", en: "I have time.", added: "2026-11-03", due: "2026-11-04" }),
			line({ id: "vid00000004:3", text: "Ďakujem pekne.", en: "Thank you kindly.", added: "2026-11-02", due: DAY }),
			line({ id: "vid00000004:4", text: "Nie som hladný.", en: "I am not hungry.", added: "2026-11-01", due: "2026-11-06" }),
			line({ id: "vid00000004:5", text: "Dnes je pekne.", en: "Today is nice.", added: "2026-11-01", due: DAY, retiredAt: AT }),
		]);
		const after = listenFor(seed, NOW, 0);
		const watch = after.items.filter((i) => reps.isWatchItem(i.id));
		assert.deepEqual(watch.map((i) => i.id).sort(), ["watch:vid00000004:1", "watch:vid00000004:2", "watch:vid00000004:3"]);
		assert.deepEqual(after.items.filter((i) => !reps.isWatchItem(i.id)), before.items, "the sentences are the same, in the same order");
		assert.equal(after.coverage, before.coverage, "watch lines are not counted in the coverage");
		const one = watch.find((i) => i.id === "watch:vid00000004:1") as ListenItem;
		assert.equal(one.sentence, "Je to drahé.");
		assert.equal(one.translation, "It is expensive.");
		assert.deepEqual(one.options, []);
		assert.deepEqual(one.stretch, []);
	});
});

describe("a Listen answer moves its watch line", () => {
	test("a typed answer is graded against the stored line; right moves it on, wrong resets it, a repeat does not move it twice", () => {
		resetStore();
		watchRepStore.addNew([
			line({ id: "vid00000005:0", text: "Chcem kúpiť chlieb.", en: "I want to buy bread.", added: "2026-11-04", due: DAY }),
			line({ id: "vid00000005:1", text: "Je to drahé.", en: "It is expensive.", added: "2026-11-04", due: DAY, step: 1 }),
			line({ id: "vid00000005:2", text: "Ďakujem.", en: "Thank you.", added: "2026-11-04", due: "2026-11-09" }),
		]);
		const answers = [
			rep("watch:vid00000005:0", { sentence: "something the client sent", given: "Chcem kúpiť chlieb.", answer: "type", verdict: "wrong" }),
			rep("watch:vid00000005:0", { sentence: "again", given: "Chcem kúpiť chlieb.", answer: "type", verdict: "exact" }),
			rep("watch:vid00000005:1", { given: "Je to lacné.", answer: "type", verdict: "exact" }),
			rep("watch:vid00000005:2", { given: "Ďakujem.", answer: "type", verdict: "exact" }),
			rep("watch:vid00000005:9", { given: "Nič.", answer: "type", verdict: "exact" }),
		];
		const out = recordListen({ reps: answers, tz: 0 }, NOW);
		assert.equal(out.total, 3, "a line not on file is not recorded");

		const byId = new Map(watchRepStore.read().lines.map((l) => [l.id, l]));
		assert.equal(byId.get("vid00000005:0")!.step, 1, "graded on the stored text, once");
		assert.equal(byId.get("vid00000005:0")!.due, "2026-11-08");
		assert.equal(byId.get("vid00000005:1")!.step, 0, "a wrong word resets the line");
		assert.equal(byId.get("vid00000005:1")!.due, "2026-11-06");
		assert.equal(byId.get("vid00000005:2")!.due, "2026-11-09", "a line not due is left as it is");

		const again = recordListen({ reps: [answers[0]!], tz: 0 }, NOW);
		assert.equal(again.total, 1);
		const repeated = watchRepStore.read().lines.find((l) => l.id === "vid00000005:0")!;
		assert.equal(repeated.step, 1, "a repeat of a right answer is not due, so it does not move the line on");
		assert.equal(repeated.due, "2026-11-08");
	});

	test("the review deck gets no watch id, and the log keeps the line with an empty stretch", () => {
		resetStore();
		watchRepStore.addNew([line({ id: "vid00000006:0", text: "Idem domov.", en: "I am going home.", due: DAY })]);
		recordListen({ reps: [rep("watch:vid00000006:0", { given: "Nejdem.", answer: "type", verdict: "exact" })], tz: 0 }, NOW);
		const deck = Object.values(reviewStore.readCards());
		assert.equal(deck.filter((c) => c.slug.includes(":")).length, 0);
		const logged = readLessonLog().filter((e) => e.mode === "listen").flatMap((e) => e.reps).find((r) => r.itemId === "watch:vid00000006:0");
		assert.ok(logged, "the answer is in the Listen log");
		assert.deepEqual(logged!.stretch, []);
		assert.equal(logged!.verdict, "wrong");
	});

	test("an answer that was not typed counts as a miss, whatever the client said", () => {
		resetStore();
		watchRepStore.addNew([line({ id: "vid00000007:0", text: "Idem domov.", en: "I am going home.", due: DAY, step: 2 })]);
		recordListen({ reps: [rep("watch:vid00000007:0", { answer: "pick", verdict: "exact" })], tz: 0 }, NOW);
		const r = watchRepStore.read().lines[0]!;
		assert.equal(r.step, 0);
		assert.equal(r.retiredAt, undefined);
	});
});

describe("a watch line gets no near-miss call", () => {
	test("listenWithBetterOptions leaves a watch line's options empty and never calls the model", async () => {
		let calls = 0;
		const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
		faux.setResponses([fauxAssistantMessage(JSON.stringify({ near: [["a", "b"]] }))]);
		const engine = {
			model: faux.getModel(),
			streamFn: (...args: Parameters<typeof faux.streamSimple>) => {
				calls++;
				return faux.streamSimple(...args);
			},
		};
		const plan = { items: [reps.watchListenItem(line({ id: "vid00000008:0", text: "Nemám čas.", en: "I have no time." }))], known: 0, coverage: 1 };
		await listenWithBetterOptions(plan, { engine, model: "faux:watch", waitMs: 50 });
		assert.equal(calls, 0);
		assert.deepEqual(plan.items[0]!.options, []);
	});

	test("the same call on a sentence with no close neighbor does reach the model", async () => {
		let calls = 0;
		const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
		faux.setResponses([fauxAssistantMessage(JSON.stringify({ near: [["A zebra ate the moon.", "The moon ate a zebra."]] }))]);
		const engine = {
			model: faux.getModel(),
			streamFn: (...args: Parameters<typeof faux.streamSimple>) => {
				calls++;
				return faux.streamSimple(...args);
			},
		};
		const sentence: ListenItem = { id: "x#0", slug: "x", lemma: "x", gloss: "x", sentence: "Nemám čas.", translation: "A zebra ate the moon last Tuesday.", options: ["a", "b", "c"], stretch: [], coverage: 1, words: 2 };
		await listenWithBetterOptions({ items: [sentence], known: 0, coverage: 1 }, { engine, model: "faux:watch", waitMs: 2000, seed: 4 });
		assert.ok(calls >= 1, "the check can see a call");
	});
});
