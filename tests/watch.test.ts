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
const sentences = await import("../src/core/watch-sentences.ts");
const { dailyPlan, curriculumState } = await import("../src/core/curriculum.ts");
type UnitId = import("../src/core/lesson.ts").UnitId;
const { strandMinutes } = await import("../src/core/strands.ts");
const { QUESTION_PLAN } = await import("../src/core/reading.ts");
const watch = await import("../src/server/watch.ts");
const { videoStore } = await import("../src/store/videos.ts");
const { storyStore } = await import("../src/store/stories.ts");
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

test("parseVideoUrl and isVideoId: a Spotify track is its own id, kept apart from YouTube's", () => {
	const spotifyId = "sp_0rgXffrQ2Fj9kCDotdURKQ";
	for (const u of ["https://open.spotify.com/track/0rgXffrQ2Fj9kCDotdURKQ?si=aa12017500d7499b", "open.spotify.com/intl-de/track/0rgXffrQ2Fj9kCDotdURKQ", "spotify:track:0rgXffrQ2Fj9kCDotdURKQ", spotifyId]) {
		assert.equal(core.parseVideoUrl(u), spotifyId, u);
	}
	assert.equal(core.parseVideoUrl("https://open.spotify.com/album/0rgXffrQ2Fj9kCDotdURKQ"), null);
	assert.equal(core.isVideoId(spotifyId), true);
	assert.equal(core.isSpotifyId(spotifyId), true);
	assert.equal(core.isSpotifyId("dQw4w9WgXcQ"), false);
	assert.equal(core.videoUrl(spotifyId), "https://open.spotify.com/track/0rgXffrQ2Fj9kCDotdURKQ");
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

test("segmentCues: a line cut inside a cue starts at its first word, from the track's word times or spread over the cue", () => {
	const timed = JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: "a" }, { utf8: " b", tOffsetMs: 200 }, { utf8: " c", tOffsetMs: 400 }, { utf8: " d", tOffsetMs: 2000 }, { utf8: " e.", tOffsetMs: 2400 }] }] });
	const withTimes = core.segmentCues(core.parseJson3(timed), { maxWords: 3, minWords: 2 });
	assert.deepEqual(withTimes.map((l) => [l.sk, l.start]), [["a b c", 0], ["d e.", 2]]);
	const spread = core.segmentCues([{ start: 0, dur: 4, text: "a b c d e f g h" }], { maxWords: 4, minWords: 2 });
	assert.deepEqual(spread.map((l) => l.start), [0, 2]);
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
	const foreign = dailyPlan({ ...base, watch: { id: "CZCZCZCZCZC", title: "Česky", minutes: 4, captionLang: "Czech" } });
	assert.match(foreign.tasks.find((t) => t.id === "watch")!.line, /^Czech captions/, "no known-word share for foreign captions that were not measured");
	const estimate = dailyPlan({ ...base, watch: { id: "CZCZCZCZCZC", title: "Česky", minutes: 4, coverage: 0.84, estimated: true } });
	assert.match(estimate.tasks.find((t) => t.id === "watch")!.line, /^About 84 of every 100 words known/);
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

test("spokenLanguage: the automatic track names the spoken language; human tracks alone only when they agree", () => {
	const ru = { baseUrl: "ru", languageCode: "ru" };
	const ruAsr = { baseUrl: "ru-asr", languageCode: "ru", kind: "asr" };
	const en = { baseUrl: "en", languageCode: "en" };
	assert.equal(watch.spokenLanguage([ruAsr]), "ru");
	assert.equal(watch.spokenLanguage([en, ruAsr, { baseUrl: "sk", languageCode: "sk" }]), "ru", "a translated human track does not change what is spoken");
	assert.equal(watch.spokenLanguage([ru, { baseUrl: "ru-RU", languageCode: "ru-RU" }]), "ru");
	assert.equal(watch.spokenLanguage([ru, en]), null, "two human languages could be a translation");
	assert.equal(watch.spokenLanguage([]), null);
});

test("elsewhereProfile: a video spoken in another ready profile of the learner's, never the running one", () => {
	const languages = path.join(TMP_DATA, "languages");
	const make = (id: string, tag: string, english: string, lexicon: boolean) => {
		fs.mkdirSync(path.join(languages, id), { recursive: true });
		fs.writeFileSync(path.join(languages, id, "language.json"), JSON.stringify({ id, tag, code: tag.split("-")[0], endonym: english, english }));
		fs.writeFileSync(path.join(languages, id, "course.json"), JSON.stringify({ language: id }));
		if (lexicon) fs.writeFileSync(path.join(languages, id, "lexicon.json"), "{}");
	};
	make("russian", "ru-RU", "Russian", true);
	make("estonian", "et-EE", "Estonian", false);
	const asr = (languageCode: string) => [{ baseUrl: languageCode, languageCode, kind: "asr" }];
	assert.deepEqual(watch.elsewhereProfile(asr("ru")), { profile: "russian", english: "Russian" });
	assert.equal(watch.elsewhereProfile(asr("et")), null, "a profile without its words is not offered");
	assert.equal(watch.elsewhereProfile(asr("sk")), null, "the running language is not elsewhere");
	assert.equal(watch.elsewhereProfile(asr("de")), null, "a language the learner does not study");
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
		assert.ok(v.expected! <= 1 && v.coverage >= 0 && v.coverage < v.expected!, `an empty deck knows less (${v.coverage}) than the beginner set adds (${v.expected})`);
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

	test("a video kept under an older measuring rule is measured again from its stored lines, with no model call", () => {
		const fresh = videoStore.get("dQw4w9WgXcQ")!;
		assert.equal(fresh.measure, core.MEASURE_VERSION);
		const old = { ...fresh, coverage: 0.99, expected: undefined, measure: undefined, segments: fresh.segments.map((s) => ({ ...s, tokens: s.tokens.map(({ fresh: _f, assumed: _a, ...t }) => t) })) };
		videoStore.put(old as typeof fresh);
		assert.equal(videoStore.list().find((e) => e.id === fresh.id)!.measure, undefined);
		const lib = watch.videoLibrary();
		const entry = lib.find((e) => e.id === fresh.id)!;
		assert.equal(entry.measure, core.MEASURE_VERSION);
		assert.equal(entry.coverage, fresh.coverage, "the share is back to what the rule gives");
		const again = watch.currentVideo(fresh.id)!;
		assert.equal(again.expected, fresh.expected);
		assert.ok(again.segments.flatMap((s) => s.tokens).some((t) => t.fresh || t.assumed), "the words are marked again");
	});

	test("a kept video's channel links to its id: from the record, else the picks' check of the same video, else a saved creator of the same name", async () => {
		const { discoverStore } = await import("../src/store/discover.ts");
		const id = "dQw4w9WgXcQ";
		const kept = videoStore.get(id)!;
		const CH = "UC" + "a".repeat(22);
		const CH2 = "UC" + "b".repeat(22);
		videoStore.put({ ...kept, channel: "Rick", channelId: undefined });
		assert.equal(watch.videoLibrary().find((e) => e.id === id)!.channelId, undefined, "nothing says whose it is");
		discoverStore.putCreators({ creators: [{ id: CH2, name: "Rick", addedAt: "2026-11-07T00:00:00Z", from: "link" }], keepReady: true });
		assert.equal(watch.videoLibrary().find((e) => e.id === id)!.channelId, CH2, "a saved creator of the same name");
		discoverStore.putScans({ [id]: { id, title: "t", channelId: CH, durationSec: 100, scannedAt: "2026-11-07T00:00:00Z", tracks: [], spoken: "yes", sources: [] } });
		assert.equal(watch.currentVideo(id)!.channelId, CH, "the check of the same video wins");
		videoStore.put({ ...kept, channel: "Rick", channelId: CH2 });
		assert.equal(watch.videoLibrary().find((e) => e.id === id)!.channelId, CH2, "the record's own id wins over both");
		discoverStore.putScans({});
		discoverStore.putCreators({ creators: [], keepReady: true });
		videoStore.put(kept);
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

test("recordWatch counts the measured playing time, and the log keeps the minutes the day counted", () => {
	const v = videoStore.get("dQw4w9WgXcQ")!;
	const answers = v.questions.map((q) => q.answer);
	watch.recordWatch({ videoId: v.id, mode: "flow", stats: [], answers, tapped: [], ms: 60 * 60_000, activeMs: 5 * 60_000, tz: 0 }, new Date("2026-11-04T12:00:00Z"));
	watch.recordWatch({ videoId: v.id, mode: "flow", stats: [], answers, tapped: [], ms: 4 * 3_600_000, activeMs: 3 * 3_600_000, tz: 0 }, new Date("2026-11-04T13:00:00Z"));
	const log = videoStore.watches().filter((w) => w.day === "2026-11-04");
	assert.deepEqual(log.map((w) => [w.activeMs, w.ms, w.minutes]), [
		[5 * 60_000, 60 * 60_000, 5],
		[3 * 3_600_000, 4 * 3_600_000, 90],
	]);
	assert.equal(progressStore.read().days["2026-11-04"]!.minutesBy!.watch, 95);
});

const czechCaptions = async (id: string) => ({ ...(await captions(id)), source: { kind: "auto-captions" as const, trackLang: "cs", via: "test" as const } });

test("Prepare in the background answers once the lines are being translated, and the task finishes the video", async () => {
	// A slow model: the translation streams for a moment, and the answer must not wait for it.
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 }, tokensPerSecond: 200 });
	faux.setResponses([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
	const engine = { model: faux.getModel(), streamFn: faux.streamSimple };
	const id = "BGBGBGBGBG1";
	const out = await watch.prepareVideoInBackground(`https://youtu.be/${id}`, { engine, model: "faux:watch", captions, pollMs: 5 });
	assert.deepEqual(out, { background: true, id });
	assert.equal(videoStore.get(id), null, "not kept yet when the answer comes");
	for (let i = 0; i < 400 && !["done", "error"].includes(watch.prepareStage(id)?.stage ?? ""); i++) await new Promise((r) => setTimeout(r, 25));
	assert.equal(watch.prepareStage(id)?.error, undefined);
	assert.equal(videoStore.get(id)?.title, "Bratislava za jeden deň");

	const kept = await watch.prepareVideoInBackground(`https://youtu.be/${id}`, { engine: fauxEngine([]), captions });
	assert.ok("segments" in kept, "a kept video comes back whole");

	const noCaptions = async () => {
		throw new Error("The captions are empty.");
	};
	await assert.rejects(watch.prepareVideoInBackground("https://youtu.be/BGBGBGBGBG2", { engine: fauxEngine([]), captions: noCaptions }), /captions are empty/, "a captions error is the answer, not a silent task");
});

test("a video with only Czech captions is prepared, kept as Czech, and the translator is told it is Czech", async () => {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS })), fauxAssistantMessage(JSON.stringify({ t: lines.map(() => "Ahoj") })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
	const sent: string[] = [];
	const streamFn: typeof faux.streamSimple = (...args) => {
		sent.push(JSON.stringify(args[1]));
		return faux.streamSimple(...args);
	};
	const v = await watch.prepareVideo("https://youtu.be/CZCZCZCZCZC", { engine: { model: faux.getModel(), streamFn }, model: "faux:watch", captions: czechCaptions, now: new Date("2026-11-03T10:00:00Z") });
	assert.equal(v.lang, "sk", "the video belongs to the Slovak profile");
	assert.equal(v.source.trackLang, "cs");
	assert.equal(v.segments.length, lines.length);
	assert.ok(sent[0]!.includes("These subtitles are in Czech, not Slovak"), "the first call says the subtitles are Czech");
	assert.ok(sent[1]!.includes("Rewrite these") && sent[1]!.includes("These subtitles are in Czech"), "the second call asks for a Slovak rendering");
	assert.equal(v.segments[0]!.sk, lines[0]!.sk, "the lines shown stay as captioned");
	assert.equal(v.coverageEstimated, true);
	assert.equal(v.wordCount, lines.length, "the share is measured on the rendering (one word a line here), not on the Czech text");
	const entry = videoStore.list().find((e) => e.id === v.id)!;
	assert.deepEqual({ lang: entry.lang, trackLang: entry.trackLang, estimated: entry.estimated }, { lang: "sk", trackLang: "cs", estimated: true });
	assert.equal(core.coverageKind(entry), "estimated");
	assert.equal(core.coverageKind({ lang: "sk", trackLang: "cs" }), "none", "Czech kept before the rendering existed has no share until it is regenerated");
	assert.equal(core.coverageKind({ lang: "sk", trackLang: "sk" }), "exact");
	assert.equal(core.coverageKind({}), "exact", "an old line with no caption language is not foreign until it is filled in");
});

test("when the Slovak rendering cannot be had, Czech captions keep no share instead of a low guess", async () => {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
	const streamFn: typeof faux.streamSimple = (...args) => {
		if (JSON.stringify(args[1]).includes("Rewrite these")) throw new Error("boom");
		return faux.streamSimple(...args);
	};
	const v = await watch.prepareVideo("https://youtu.be/CZNORENDER1", { engine: { model: faux.getModel(), streamFn }, model: "faux:watch", captions: czechCaptions, now: new Date("2026-11-05T10:00:00Z") });
	assert.equal(v.coverageEstimated, undefined);
	assert.equal(core.coverageKind({ lang: v.lang, trackLang: v.source.trackLang, estimated: v.coverageEstimated }), "none");
	assert.equal(v.segments.length, lines.length, "the video is still prepared");
});

test("an index line written before the caption language was kept gets it from the record, once", () => {
	const v = videoStore.get("CZCZCZCZCZC")!;
	const index = path.join(PATHS.videos, "index.jsonl");
	const stripped = videoStore.list().map(({ lang: _l, trackLang: _t, ...old }) => old);
	fs.writeFileSync(index, `${stripped.map((e) => JSON.stringify(e)).join("\n")}\n`);
	assert.equal(videoStore.list().find((e) => e.id === v.id)!.trackLang, "cs");
	assert.match(fs.readFileSync(index, "utf-8"), /"trackLang":"cs"/, "written back, so the record is not read again");
});

test("the sentence step: a model verdict is kept and reused, XP once per accepted word, the program refuses without a model, a Czech video has no step", async () => {
	const v = videoStore.get("dQw4w9WgXcQ")!;
	const target = v.segments.flatMap((s) => s.tokens).find((t) => t.word && t.lemma && sentences.usesLemma([t.text], t.lemma));
	assert.ok(target, "the fixture has a word whose form the stem finds");
	const lemma = target.lemma!;
	const sentence = `Mám ${target.text}.`;
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses([fauxAssistantMessage(JSON.stringify({ ok: true, corrected: sentence, why: "Correct." })), fauxAssistantMessage(JSON.stringify({ ok: true, corrected: "x", why: "Fine." }))]);
	let calls = 0;
	const streamFn: typeof faux.streamSimple = (...args) => {
		calls++;
		return faux.streamSimple(...args);
	};
	const engine = { model: faux.getModel(), streamFn };
	const xpBefore = progressStore.read().xp;
	const first = await watch.checkSentence({ videoId: v.id, lemma, sentence }, { engine, model: "faux:sentence", now: new Date("2026-11-03T12:00:00Z") });
	assert.equal(first.ok, true);
	assert.equal(first.cached, false);
	assert.equal(first.xp, sentences.SENTENCE_XP);
	assert.equal(progressStore.read().xp, xpBefore + sentences.SENTENCE_XP);
	assert.equal(calls, 1);
	const again = await watch.checkSentence({ videoId: v.id, lemma, sentence }, { engine });
	assert.equal(again.cached, true, "the same sentence is answered from the kept verdict");
	assert.equal(again.xp, 0);
	assert.equal(calls, 1, "no second model call for the same sentence");
	const other = await watch.checkSentence({ videoId: v.id, lemma, sentence: `${sentence} Ďakujem.` }, { engine });
	assert.equal(other.ok, true);
	assert.equal(other.xp, 0, "a word is worth XP once per video");
	assert.equal(calls, 2);
	const short = await watch.checkSentence({ videoId: v.id, lemma, sentence: lemma }, { engine });
	assert.equal(short.ok, false);
	assert.equal(short.cached, false);
	assert.equal(calls, 2, "a sentence the program refuses never reaches the model");
	await assert.rejects(watch.checkSentence({ videoId: "CZCZCZCZCZC", lemma, sentence }, { engine }), /not in the language you learn/);
	assert.ok(videoStore.sentences().filter((s) => s.videoId === v.id && s.lemma === lemma).length >= 2, "the verdicts are kept on disk");
});

test("a translation the model miscounts twice is split in halves, each half asked on its own", async () => {
	const half = Math.ceil(TRANSLATIONS.length / 2);
	const engine = fauxEngine([
		fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS.slice(1) })),
		fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS.slice(1) })),
		fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS.slice(0, half) })),
		fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS.slice(half) })),
		fauxAssistantMessage(JSON.stringify(QUESTIONS)),
	]);
	const v = await watch.prepareVideo("https://youtu.be/BBBBBBBBBBB", { engine, model: "faux:watch", captions, now: new Date("2026-10-28T13:00:00Z") });
	assert.deepEqual(v.segments.map((s) => s.en), TRANSLATIONS);
	assert.equal(v.usage.steps.length, 5, "two asks for the whole, one each for the halves, one for the questions");
});

test("a kept video is prepared again when forced, and removing it leaves its watchings", async () => {
	const url = "https://youtu.be/DDDDDDDDDDD";
	const engine = fauxEngine([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
	const first = await watch.prepareVideo(url, { engine, model: "faux:watch", captions, now: new Date("2026-11-04T09:00:00Z") });
	const redo = fauxEngine([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS.map((t) => `${t} (again)`) })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
	const again = await watch.prepareVideo(url, { engine: redo, model: "faux:watch", captions, force: true, now: new Date("2026-11-04T09:30:00Z") });
	assert.equal(again.segments[0]!.en, `${TRANSLATIONS[0]} (again)`, "forcing asks the model again instead of reusing the kept video");
	assert.equal(videoStore.list().filter((e) => e.id === first.id).length, 1, "one index line per video");
	videoStore.putCaptions(first.id, "sk", "json", "{}");
	videoStore.appendWatch({ id: "w-keep", videoId: first.id } as never);
	assert.equal(videoStore.remove(first.id), true);
	assert.equal(videoStore.get(first.id), null);
	assert.equal(videoStore.list().some((e) => e.id === first.id), false);
	assert.equal(videoStore.captions(first.id, "sk"), null);
	assert.ok(videoStore.watches().some((w) => w.videoId === first.id), "the watchings stay");
	assert.equal(videoStore.remove(first.id), false, "a second removal finds nothing");
	assert.throws(() => videoStore.remove("not an id"));
});

test("a translation chunk is asked with the lines on both sides as context", async () => {
	const many = Array.from({ length: 43 }, (_, i) => `riadok${i + 1}`);
	const base = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	const asks: string[] = [];
	const streamFn: typeof base.streamSimple = (...args) => {
		const asked = JSON.stringify(args[1]);
		asks.push(asked);
		const [, from, to] = asked.match(/Lines (\d+)–(\d+) of/)!;
		const one = createFauxCore({ tokenSize: { min: 64, max: 64 } });
		one.setResponses([fauxAssistantMessage(JSON.stringify({ t: Array.from({ length: Number(to) - Number(from) + 1 }, (_, i) => `line ${Number(from) + i}`) }))]);
		return one.streamSimple(...args);
	};
	const out = await watch.translateLines({ model: base.getModel(), streamFn }, many, { model: "faux:watch", steps: [] }, "Test");
	assert.equal(out.length, 43);
	assert.equal(asks.length, 2);
	assert.match(asks[0]!, /lines just after[\s\S]*riadok41[\s\S]*riadok43/);
	assert.doesNotMatch(asks[0]!, /lines just before/);
	assert.match(asks[1]!, /lines just before[\s\S]*riadok38[\s\S]*riadok40/);
	assert.doesNotMatch(asks[1]!, /lines just after/);
});

test("a line the model never translates stays in the video with no English, and is counted", async () => {
	const bad = 2;
	const missing = lines[bad]!.sk;
	const base = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	const streamFn: typeof base.streamSimple = (...args) => {
		const asked = JSON.stringify(args[1]);
		const one = createFauxCore({ tokenSize: { min: 64, max: 64 } });
		if (!asked.includes("exactly one English string")) {
			one.setResponses([fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
			return one.streamSimple(...args);
		}
		const [, from, to] = asked.match(/Lines (\d+)–(\d+) of/)!;
		const out: string[] = [];
		for (let i = Number(from); i <= Number(to); i++) if (lines[i - 1]!.sk !== missing) out.push(TRANSLATIONS[i - 1]!);
		one.setResponses([fauxAssistantMessage(JSON.stringify({ t: out }))]);
		return one.streamSimple(...args);
	};
	const v = await watch.prepareVideo("https://youtu.be/CCCCCCCCCCC", { engine: { model: base.getModel(), streamFn }, model: "faux:watch", captions, now: new Date("2026-10-28T14:00:00Z") });
	assert.equal(v.segments.length, lines.length);
	assert.equal(v.segments[bad]!.sk, missing);
	assert.equal(v.segments[bad]!.en, "", "the line keeps its Slovak and has no English");
	assert.deepEqual(v.segments.filter((_, i) => i !== bad).map((s) => s.en), TRANSLATIONS.filter((_, i) => i !== bad));
	assert.equal(v.untranslated, 1);
});

test("a preparation is a background task: running with its step, done with where to open it, failed with why", async () => {
	const { listTasks, resetTasks, abortTask } = await import("../src/server/tasks.ts");
	resetTasks();
	const url = "https://youtu.be/EEEEEEEEEEE";
	const engine = fauxEngine([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
	const slow = watch.prepareVideo(url, { engine, model: "faux:watch", captions: async (id) => ({ ...(await captions(id)), meta: { id, title: "Slow one", durationSec: 58 } }), now: new Date("2026-11-05T09:00:00Z") });
	const [running] = listTasks();
	assert.equal(running!.id, "video:EEEEEEEEEEE");
	assert.equal(running!.status, "running");
	const v = await slow;
	const [done] = listTasks();
	assert.deepEqual({ status: done!.status, title: done!.title, href: done!.href }, { status: "done", title: "Slow one", href: `/watch?id=${v.id}` });

	const failing = watch.prepareVideo("https://youtu.be/FFFFFFFFFFF", { engine: fauxEngine([]), model: "faux:watch", captions: async () => Promise.reject(new Error("YouTube said no.")) });
	await assert.rejects(failing, /YouTube said no/);
	const failed = listTasks().find((t) => t.id === "video:FFFFFFFFFFF")!;
	assert.deepEqual({ status: failed.status, error: failed.error }, { status: "error", error: "YouTube said no." });

	const stopped = watch.prepareVideo("https://youtu.be/GGGGGGGGGGG", {
		engine: fauxEngine([]),
		model: "faux:watch",
		captions: async (id) => {
			assert.equal(abortTask(`video:${id}`), true);
			return captions(id);
		},
	});
	await assert.rejects(stopped);
	assert.equal(listTasks().find((t) => t.id === "video:GGGGGGGGGGG")!.error, "Stopped.");
	assert.equal(videoStore.get("GGGGGGGGGGG"), null, "a stopped preparation keeps nothing");
});

test("a prepared track becomes one Read episode: its lines, questions and words, once", async () => {
	const engine = fauxEngine([fauxAssistantMessage(JSON.stringify({ t: TRANSLATIONS })), fauxAssistantMessage(JSON.stringify(QUESTIONS))]);
	const v = await watch.prepareVideo("https://open.spotify.com/track/0rgXffrQ2Fj9kCDotdURKQ", { engine, model: "faux:watch", captions, now: new Date("2026-11-10T10:00:00Z") });
	const story = watch.importVideoToRead(v.id, new Date("2026-11-10T10:05:00Z"));
	assert.equal(story.id, "watch-sp-0rgxffrq2fj9kcdotdurkq");
	assert.equal(story.lang, v.lang);
	assert.equal(story.theme, "spotify");
	assert.equal(story.sentences.length, v.segments.length);
	assert.equal(story.questions.length, v.questions.length);
	assert.equal(story.newWords.length, v.preTeach.length);
	assert.equal(storyStore.get(story.id)?.title, v.title);
	assert.equal(watch.importVideoToRead(v.id, new Date("2026-11-11T10:00:00Z")).createdAt, story.createdAt, "asking again returns the episode already made");
	assert.throws(() => watch.importVideoToRead("sp_AAAAAAAAAAAAAAAAAAAAAA"), /unknown video/);
	videoStore.remove(v.id);
});
