/**
 * WATCH PINS (LangHarness, 2026-10-28): a YouTube link becomes a guided
 * video — the link parsed, the caption formats read, the cues cut into
 * lines the ear can hold, the coverage and pre-teach pass, the record on
 * disk from a scripted engine (translation + questions), the watching
 * recorded (first-listen stats, XP, the deck), the daily plan and the
 * strand balance counting it.
 *
 * Runs under an isolated LH_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-watch-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { PATHS } = await import("../config.ts");
const core = await import("../src/core/watch.ts");
const { captionLanguageName } = await import("../src/core/language.ts");
const { dailyPlan, curriculumState } = await import("../src/core/curriculum.ts");
type UnitId = import("../src/core/lesson.ts").UnitId;
const { strandMinutes } = await import("../src/core/strands.ts");
const { QUESTION_PLAN } = await import("../src/core/reading.ts");
const watch = await import("../src/server/watch.ts");
const { videoStore } = await import("../src/store/videos.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { progressSummary } = await import("../src/server/lesson.ts");
const { usageReport } = await import("../src/server/usage-report.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const FIXTURE = fs.readFileSync(path.join(import.meta.dirname, "fixtures", "captions-sk.json3"), "utf-8");
const VTT = fs.readFileSync(path.join(import.meta.dirname, "fixtures", "captions-sk.vtt"), "utf-8");

function fauxEngine(steps: FauxResponseStep[]) {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(steps);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

// ─── Pure rules ─────────────────────────────────────────────────────────────

test("parseVideoUrl: watch, short, shorts, embed, bare id; nothing else", () => {
	for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "youtu.be/dQw4w9WgXcQ", "https://m.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0", "dQw4w9WgXcQ", " https://music.youtube.com/watch?v=dQw4w9WgXcQ "]) {
		assert.equal(core.parseVideoUrl(u), "dQw4w9WgXcQ", u);
	}
	for (const u of ["https://vimeo.com/12345", "https://www.youtube.com/", "not a link", "https://www.youtube.com/watch?v=short"]) assert.equal(core.parseVideoUrl(u), null, u);
});

test("the caption formats: json3 (rolling appends folded in), VTT, both XML shapes", () => {
	const json = core.parseJson3(FIXTURE);
	assert.equal(json.length, 20);
	assert.equal(json[0]!.text, "ahojte volám sa zuzana");
	assert.equal(json[0]!.start, 0);
	assert.equal(json[2]!.start, 6);
	const vtt = core.parseVtt(VTT);
	assert.equal(vtt.length, 3);
	assert.equal(vtt[1]!.start, 2.6);
	assert.equal(vtt[1]!.text, "A dnes vám ukážem Bratislavu!");
	const srv1 = core.parseTimedTextXml('<?xml version="1.0"?><transcript><text start="1.5" dur="2">Dobr&#253; de&#328; &amp; vitajte</text><text start="4" dur="1.5">[Hudba]</text></transcript>');
	assert.deepEqual(srv1, [{ start: 1.5, dur: 2, text: "Dobrý deň & vitajte" }]);
	const srv3 = core.parseTimedTextXml('<timedtext format="3"><body><p t="1500" d="2000">Ahoj <s>svet</s></p></body></timedtext>');
	assert.deepEqual(srv3, [{ start: 1.5, dur: 2, text: "Ahoj svet" }]);
	assert.equal(core.parseCaptions(FIXTURE).length, 20);
	assert.equal(core.parseCaptions(VTT).length, 3);
});

test("stripOverlap drops the tail a rolling caption repeats", () => {
	assert.equal(core.stripOverlap("ahoj ako sa máš", "ako sa máš dobre"), "dobre");
	assert.equal(core.stripOverlap("ahoj ako sa máš", "ahoj ako sa máš"), "");
	assert.equal(core.stripOverlap("ahoj", "svet"), "svet");
});

test("segmentCues: punctuation closes a line, the word and time limits cut long speech, a silence ends a line, times never run backwards", () => {
	const lines = core.segmentCues(core.parseJson3(FIXTURE));
	assert.ok(lines.length >= 18 && lines.length <= 22, `${lines.length} lines`);
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i]!;
		assert.ok(l.end > l.start, `line ${i} has length`);
		assert.ok(l.sk.split(" ").length <= core.SEGMENT_MAX_WORDS);
		if (i > 0) assert.ok(l.start >= lines[i - 1]!.end - 0.001, `line ${i} starts after the previous ends`);
	}
	// Automatic captions carry no punctuation: YouTube's own cue breaks are
	// the phrase units, so each cue is a line (a two-word tail stays its own).
	assert.equal(lines.length, 20);
	assert.equal(lines[0]!.sk, "ahojte volám sa zuzana");
	assert.equal(lines[1]!.start, 2.6);
	// Punctuated captions cut at the sentence.
	const vtt = core.segmentCues(core.parseVtt(VTT));
	assert.deepEqual(
		vtt.map((l) => l.sk),
		["Ahojte, volám sa Zuzana.", "A dnes vám ukážem Bratislavu!", "Bratislava je hlavné mesto Slovenska."],
	);
	// A long run without punctuation is cut by words/time.
	const run = core.segmentCues([{ start: 0, dur: 30, text: Array.from({ length: 40 }, (_, i) => `slovo${i}`).join(" ") }]);
	assert.ok(run.length >= 3);
	assert.ok(run.every((l) => l.sk.split(" ").length <= core.SEGMENT_MAX_WORDS));
	// A gap ends a line even without punctuation.
	const gap = core.segmentCues([{ start: 0, dur: 1, text: "ahoj svet tu" }, { start: 5, dur: 1, text: "a ešte raz ahoj" }]);
	assert.equal(gap.length, 2);
});

test("coverageBand, watchXp, watchMinutes, listeningSpeed, parseTranslations", () => {
	assert.equal(core.coverageBand(0.96).band, "comfortable");
	assert.equal(core.coverageBand(0.9).band, "stretch");
	assert.equal(core.coverageBand(0.83).band, "hard");
	assert.equal(core.coverageBand(0.5).band, "too-hard");
	assert.equal(core.watchXp(20, 10, 5, 3, false), 20 + 20 + 5 + 15);
	assert.equal(core.watchXp(20, 10, 5, 3, true), 20 + 5 + 15);
	assert.equal(core.watchMinutes(60), 3);
	assert.equal(core.watchMinutes(600), 15);
	assert.equal(core.watchMinutes(3600), 20);
	const speed = core.listeningSpeed([
		{ i: 0, words: 10, sec: 4, replays: 0, slow: false, revealed: false, got: "first" },
		{ i: 1, words: 8, sec: 4, replays: 1, slow: false, revealed: false, got: "after" },
		{ i: 2, words: 12, sec: 6, replays: 0, slow: false, revealed: false, got: "first" },
	]);
	assert.equal(speed.wpmFirst, 132);
	assert.equal(speed.wpmAll, 129);
	assert.equal(Math.round(speed.shareFirst * 100), 67);
	assert.deepEqual(core.parseTranslations('Sure: {"t": ["Hi", "Bye"]}', 2), ["Hi", "Bye"]);
	assert.deepEqual(core.parseTranslations('["Hi", "Bye"]', 2), ["Hi", "Bye"]);
	assert.throws(() => core.parseTranslations('{"t": ["Hi"]}', 2), /1 translations for 2/);
	assert.equal(core.formatClock(3725), "1:02:05");
	assert.equal(core.formatClock(65), "1:05");
});

test("dailyPlan: a waiting video is a Watch task; none when nothing waits", () => {
	const state = curriculumState({}, "B2");
	const base = { state, evidence: {}, day: { units: {}, reviews: 0, blitz: 0, talks: 0, stories: 0, tutors: 0 }, review: { due: 0, newLeft: 0, available: false }, minutesPerDay: 60, next: state.chapters[0]!.units[0]!.id as UnitId, dayOfYear: 1 };
	const without = dailyPlan(base);
	assert.ok(!without.tasks.some((t) => t.id === "watch"));
	const withVideo = dailyPlan({ ...base, watch: { id: "dQw4w9WgXcQ", title: "Bratislava", minutes: 4, coverage: 0.91 } });
	const task = withVideo.tasks.find((t) => t.id === "watch");
	assert.ok(task);
	assert.equal(task.href, "/watch?id=dQw4w9WgXcQ");
	assert.match(task.line, /91 of every 100/);
	assert.equal(task.done, false);
	const done = dailyPlan({ ...base, day: { ...base.day, watches: 1 }, watch: { id: "dQw4w9WgXcQ", title: "Bratislava", minutes: 4, coverage: 0.91 } });
	assert.equal(done.tasks.find((t) => t.id === "watch")!.done, true);
	assert.equal(strandMinutes({ watches: 2 }).input, 16);
});

test("extractJsonAfter reads a player response out of a watch page whole", () => {
	const html = `<script>var ytInitialPlayerResponse = {"videoDetails":{"title":"A \\"quoted\\" {title}","lengthSeconds":"61"},"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://x/?v=1","languageCode":"sk","kind":"asr"}]}}};var other = 1;</script>`;
	const got = watch.extractJsonAfter(html, /ytInitialPlayerResponse\s*=\s*/) as { videoDetails: { title: string } };
	assert.equal(got.videoDetails.title, 'A "quoted" {title}');
	assert.equal(watch.pickTrack([{ baseUrl: "a", languageCode: "en" }, { baseUrl: "b", languageCode: "sk", kind: "asr" }, { baseUrl: "c", languageCode: "sk-SK" }])!.baseUrl, "c");
	assert.equal(watch.pickTrack([{ baseUrl: "a", languageCode: "en" }]), null);
});

test("pickTrack: Slovak first, Czech only when there is no Slovak, a human track before an automatic one in each language", () => {
	const csHuman = { baseUrl: "cs", languageCode: "cs" };
	const csAsr = { baseUrl: "cs-asr", languageCode: "cs", kind: "asr" };
	const skAsr = { baseUrl: "sk-asr", languageCode: "sk", kind: "asr" };
	const en = { baseUrl: "en", languageCode: "en" };
	assert.equal(watch.pickTrack([csHuman, skAsr], ["sk", "cs"])!.baseUrl, "sk-asr");
	assert.equal(watch.pickTrack([csAsr, csHuman, en], ["sk", "cs"])!.baseUrl, "cs");
	assert.equal(watch.pickTrack([en, csAsr], ["sk", "cs"])!.baseUrl, "cs-asr");
	assert.equal(watch.pickTrack([csHuman]), csHuman, "the default list takes Czech after Slovak");
	assert.equal(watch.pickTrack([csHuman], ["sk"]), null);
});

test("captionLanguageName: the profile's language and its Czech fallback by name, anything else by code", () => {
	assert.equal(captionLanguageName("sk"), "Slovak");
	assert.equal(captionLanguageName("cs"), "Czech");
	assert.equal(captionLanguageName("de"), "de");
});

// ─── The record, on a scripted engine ───────────────────────────────────────

const lines = core.segmentCues(core.parseJson3(FIXTURE));
const TRANSLATIONS = lines.map((l, i) => `Line ${i + 1}: ${l.sk.split(" ").slice(0, 3).join(" ")}`);
const QUESTIONS = {
	questions: [
		{ kind: "recall", q: "Ako sa volá sprievodkyňa?", options: ["Zuzana", "Mária", "Eva"], answer: 0 },
		{ kind: "recall", q: "Kde bývajú jej rodičia?", options: ["V Petržalke", "Na hrade", "V Rakúsku"], answer: 0 },
		{ kind: "inference", q: "Prečo idú večer do divadla?", options: ["Hrá tam jej sestra", "Je tam kaviareň", "Je zima"], answer: 0 },
		{ kind: "vocab", q: "Čo znamená „sídlisko“?", options: ["Časť mesta s panelákmi", "Hrad", "Kaviareň"], answer: 0 },
	],
};

const captions = async (id: string) => ({
	meta: { id, title: "Bratislava za jeden deň", channel: "Zuzana vlogs", durationSec: 58 },
	cues: core.parseJson3(FIXTURE),
	source: { kind: "auto-captions" as const, trackLang: "sk", via: "test" as const },
	raw: { ext: "json" as const, text: FIXTURE },
});

describe("a video on a scripted engine", () => {
	const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

	test("prepareVideo: lines cut, translated in one call, glossed, pre-taught, questioned, kept", async () => {
		const engine = fauxEngine([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
		const v = await watch.prepareVideo(url, { engine, model: "faux:watch", captions, now: new Date("2026-10-28T10:00:00Z") });
		assert.equal(v.id, "dQw4w9WgXcQ");
		assert.equal(v.title, "Bratislava za jeden deň");
		assert.equal(v.segments.length, lines.length);
		assert.equal(v.segments[0]!.en, TRANSLATIONS[0]);
		assert.ok(v.segments.every((s, i) => s.i === i && s.tokens.length > 0));
		// Glossed against the lexicon: "mesto" is a dictionary word.
		const mesto = v.segments.flatMap((s) => s.tokens).find((t) => t.text === "mesto");
		assert.ok(mesto?.slug, "mesto resolves to a lexicon entry");
		assert.ok(v.coverage > 0.5 && v.coverage <= 1, `coverage ${v.coverage}`);
		assert.ok(v.wordCount > 60);
		// As many as the plan at the learner's level asks for (A1: three).
		assert.equal(v.questions.length, QUESTION_PLAN[v.level].count);
		assert.equal(v.questions[2]!.kind, "inference");
		assert.ok(v.preTeach.length <= core.PRE_TEACH_MAX);
		for (const w of v.preTeach) assert.ok(w.gloss && w.count >= 1 && w.example);
		// A word used twice comes before one used once.
		const counts = v.preTeach.map((w) => w.count);
		assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
		assert.equal(v.usage.model, "faux:watch");
		assert.equal(v.usage.steps.length, 2);
		assert.equal(v.source.kind, "auto-captions");
		// On disk: the record, the index line, the raw track, the README.
		assert.ok(fs.existsSync(path.join(PATHS.videos, "dQw4w9WgXcQ.json")));
		assert.ok(fs.existsSync(path.join(PATHS.videos, "captions", "dQw4w9WgXcQ.sk.json")));
		assert.ok(fs.existsSync(path.join(PATHS.videos, "README.md")));
		const index = videoStore.list();
		assert.equal(index.length, 1);
		assert.equal(index[0]!.segments, lines.length);
		assert.equal(index[0]!.model, "faux:watch");
	});

	test("a kept video is reused without a model call; the plan shows it as the Watch task", async () => {
		const engine = fauxEngine([]); // any call would fail
		const again = await watch.prepareVideo("youtu.be/dQw4w9WgXcQ", { engine, captions });
		assert.equal(again.title, "Bratislava za jeden deň");
		const state = watch.watchState();
		assert.equal(state.library.length, 1);
		assert.equal(state.library[0]!.watches, 0);
		assert.equal(watch.pendingVideo()!.id, "dQw4w9WgXcQ");
		const task = progressSummary().plan.tasks.find((t) => t.id === "watch");
		assert.ok(task, "the daily plan carries the waiting video");
		assert.equal(task.href, "/watch?id=dQw4w9WgXcQ");
		assert.equal(usageReport().videos.count, 1);
	});

	test("a translation with the wrong count is asked for once more", async () => {
		const engine = fauxEngine([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS.slice(1) })), fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
		const v = await watch.prepareVideo("https://youtu.be/AAAAAAAAAAA", { engine, model: "faux:watch", captions, now: new Date("2026-10-28T11:00:00Z") });
		assert.equal(v.usage.steps.length, 3);
		assert.equal(v.segments[0]!.en, TRANSLATIONS[0]);
	});

	test("recordWatch: the day's watching, XP, the first-listen stats, the words into the deck, the log the milestone page reads", () => {
		const v = videoStore.get("dQw4w9WgXcQ")!;
		const stats = v.segments.map((s, i) => ({ i, words: s.tokens.filter((t) => t.word).length, sec: Math.round((s.end - s.start) * 100) / 100, replays: i % 4 === 1 ? 1 : 0, slow: i % 5 === 2, revealed: i % 7 === 3, got: i % 4 === 1 || i % 5 === 2 || i % 7 === 3 ? ("after" as const) : i === 6 ? ("no" as const) : ("first" as const) }));
		const before = Object.keys(reviewStore.readCards()).length;
		const answers = v.questions.map((q, i) => (i === 1 ? (q.answer + 1) % q.options.length : q.answer));
		const out = watch.recordWatch({ videoId: v.id, mode: "step", stats, answers, tapped: [v.segments[1]!.tokens.find((t) => t.slug)!.slug!], ms: 6 * 60_000, tz: 0 }, new Date("2026-10-28T12:00:00Z"));
		assert.equal(out.total, v.questions.length);
		assert.equal(out.correct, v.questions.length - 1);
		assert.equal(out.gotFirst, stats.filter((s) => s.got === "first").length);
		assert.equal(out.missed, 1);
		assert.equal(out.rewatch, false);
		assert.equal(out.xp, core.watchXp(v.segments.length, out.gotFirst, out.gotAfter, out.correct, false));
		assert.ok(out.queued.length >= 1, "the pre-taught and tapped words went to the deck");
		assert.ok(Object.keys(reviewStore.readCards()).length > before);
		const p = progressStore.read();
		assert.equal(p.days["2026-10-28"]!.watches, 1);
		assert.equal(p.days["2026-10-28"]!.xp, out.xp);
		assert.equal(p.days["2026-10-28"]!.minutes, 6);
		const log = videoStore.watches();
		assert.equal(log.length, 1);
		assert.equal(log[0]!.videoId, v.id);
		assert.equal(log[0]!.mode, "step");
		assert.equal(log[0]!.stats.length, v.segments.length);
		assert.equal(log[0]!.stats[6]!.got, "no");
		assert.deepEqual(log[0]!.answers, answers);
		// The library knows, and the plan no longer asks.
		const lib = watch.videoLibrary().find((e) => e.id === v.id)!;
		assert.equal(lib.watches, 1);
		assert.equal(lib.lastScore!.correct, out.correct);
		assert.ok(lib.lastGotFirst! > 0);
		assert.equal(watch.pendingVideo()!.id, "AAAAAAAAAAA", "the other, unwatched video waits");
		assert.equal(out.summary.plan.tasks.find((t) => t.id === "watch")!.done, true);
		// The watching's own 6 measured minutes, not the plan's 8.
		assert.equal(out.summary.balance.minutes.input, 6);
		// A rewatch earns the bonuses only.
		const twice = watch.recordWatch({ videoId: v.id, mode: "flow", stats: [], answers: v.questions.map((q) => q.answer), tapped: [] }, new Date("2026-10-29T12:00:00Z"));
		assert.equal(twice.rewatch, true);
		assert.equal(twice.xp, v.questions.length * 5);
	});
});

test("a video with only Czech captions is prepared, kept as Czech, and the translator is told it is Czech", async () => {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
	const sent: string[] = [];
	const streamFn: typeof faux.streamSimple = (...args) => {
		sent.push(JSON.stringify(args[1]));
		return faux.streamSimple(...args);
	};
	const czech = async (id: string) => ({ ...(await captions(id)), source: { kind: "auto-captions" as const, trackLang: "cs", via: "test" as const } });
	const v = await watch.prepareVideo("https://youtu.be/CZCZCZCZCZC", { engine: { model: faux.getModel(), streamFn }, model: "faux:watch", captions: czech, now: new Date("2026-11-03T10:00:00Z") });
	assert.equal(v.lang, "sk", "the video belongs to the Slovak profile");
	assert.equal(v.source.trackLang, "cs");
	assert.equal(v.segments.length, lines.length);
	assert.ok(sent[0]!.includes("These subtitles are in Czech, not Slovak"), "the first call says the subtitles are Czech");
});

test("ensureThumbnail: fetched once from YouTube's image host, kept on disk, nothing kept when YouTube has none", async () => {
	const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
	const asked: string[] = [];
	const get = (async (url: string | URL | Request) => {
		asked.push(String(url));
		return new Response(jpeg, { headers: { "content-type": "image/jpeg" } });
	}) as typeof fetch;
	const file = await watch.ensureThumbnail("CZCZCZCZCZC", get);
	assert.ok(file && fs.existsSync(file), "the thumbnail is on disk");
	assert.deepEqual([...fs.readFileSync(file!)], [...jpeg]);
	assert.equal(asked[0], "https://i.ytimg.com/vi/CZCZCZCZCZC/hqdefault.jpg");
	assert.equal(await watch.ensureThumbnail("CZCZCZCZCZC", get), file);
	assert.equal(asked.length, 1, "a kept thumbnail is not fetched again");
	assert.deepEqual([...(await watch.thumbnailBytes("CZCZCZCZCZC"))!], [...jpeg]);
	const missing = (async () => new Response("not found", { status: 404 })) as typeof fetch;
	assert.equal(await watch.ensureThumbnail("MISSINGMIS1", missing), null);
	assert.equal(fs.existsSync(videoStore.thumbnailFile("MISSINGMIS1")!), false);
	assert.equal(await watch.ensureThumbnail("not an id", get), null);
});
