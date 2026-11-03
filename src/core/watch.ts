/**
 * Watch (LangHarness, 2026-10-28; Xurify: "input YouTube videos in and the
 * app helps turn that into comprehensible input or like a guided video,
 * but video format (so like double subtitles — so I see both as I
 * watch)") — the pure model behind the Watch task: a YouTube video the
 * learner chose, its Slovak captions cut into lines a listener can hold,
 * every line translated and every word glossed against the lexicon, a
 * pre-watch pass that says how much of it the learner knows and teaches
 * the unknown words worth having first, a step mode that plays one line
 * at a time with the text hidden until asked for, a short comprehension
 * check at the end, and a log of what was understood on the first
 * unaided listen (the listening-speed signal the milestone page reads).
 *
 * Why this shape:
 *   - Real video is the input the learner actually wants (Slovak
 *     YouTube), and the one that was out of reach: the stated gap is
 *     catching the words but not assembling the meaning fast enough — a
 *     parsing-speed problem, not a vocabulary one. So the core of the
 *     task is "listen first, then reveal", one line at a time, with
 *     replay and slow-down before the text (Chang & Millett 2014: repeated
 *     listening with the text as support, not substitute).
 *   - Coverage still decides whether the video is input or noise (van
 *     Zeeland & Schmitt 2013: ~95% known for comfortable listening; the
 *     Listen task's LISTEN_FLOOR). The pre-watch pass measures it with the
 *     same known-words estimate the Read and Listen tasks use, says so
 *     plainly, and pre-teaches the unknown words that recur (Webb 2007:
 *     meeting a word before the text lifts comprehension of the text).
 *   - Dual subtitles while watching (L2 + L1) help comprehension and word
 *     learning more than L2-only for learners below the video's level
 *     (Danan 2004; Vanderplank 2016); hiding the L1 line in step mode
 *     keeps the task from becoming reading.
 *   - Nothing is downloaded: the video plays in YouTube's own embedded
 *     player; only the caption track (what YouTube serves to every
 *     viewer) is fetched, translated once and kept.
 *
 * Browser-safe: types, URL parsing, caption parsing, the line cutter, the
 * coverage and pre-teach rules, XP, the listening-speed summary. The
 * fetching, translation and files live in src/server/watch.ts and
 * src/store/videos.ts.
 */

import type { Cefr } from "./curriculum.ts";
import { LISTEN_FLOOR } from "./listen.ts";
import { wordTokens, type StoryQuestion, type StoryToken, type StoryUsage, type StoryWord } from "./reading.ts";

// ─── The video record ───────────────────────────────────────────────────────

/** One caption cue as YouTube serves it (seconds). */
export interface CaptionCue {
	start: number;
	dur: number;
	text: string;
}

/** One line of the guided video: a stretch of speech short enough to hold
 *  in the ear, with its times, translation and glossed words. */
export interface VideoSegment {
	i: number;
	start: number;
	end: number;
	sk: string;
	en: string;
	tokens: StoryToken[];
}

export type CaptionSource = "captions" | "auto-captions" | "transcription";

export interface VideoSourceInfo {
	kind: CaptionSource;
	/** The caption track's language code ("sk"). */
	trackLang: string;
	trackName?: string;
	/** How the track was obtained. */
	via: "watch-page" | "innertube" | "yt-dlp" | "deepgram" | "test";
}

/** An unknown word worth meeting before the video: it recurs, or it is
 *  common Slovak the learner has not met yet. */
export interface PreTeachWord extends StoryWord {
	/** Times it appears in the video. */
	count: number;
	rank?: number;
	cat?: string;
	/** The first line it appears in (segment index) and that line. */
	at: number;
	example: string;
}

export interface VideoRecord {
	/** The YouTube video id (11 characters). */
	id: string;
	lang: string;
	url: string;
	title: string;
	channel?: string;
	durationSec: number;
	source: VideoSourceInfo;
	/** The learner's level when the video was prepared (the questions'
	 *  plan follows it). */
	level: Cefr;
	createdAt: string;
	segments: VideoSegment[];
	questions: StoryQuestion[];
	preTeach: PreTeachWord[];
	/** Share of running words the learner is expected to know (0..1). */
	coverage: number;
	wordCount: number;
	/** Distinct dictionary words the learner has not met. */
	unknownCount: number;
	/** What the translation and the questions cost. */
	usage: StoryUsage;
	/** Where the English came from. */
	translatedBy: "model" | "none";
	/** Lines the model could not translate back into its answer: they keep
	 *  their Slovak and have an empty English line. Absent when none. */
	untranslated?: number;
}

export interface VideoIndexEntry {
	id: string;
	title: string;
	channel?: string;
	durationSec: number;
	level: Cefr;
	createdAt: string;
	coverage: number;
	wordCount: number;
	segments: number;
	preTeach: string[];
	source: CaptionSource;
	model: string;
}

/** How one line went in step mode. */
export interface SegmentStat {
	i: number;
	words: number;
	/** The line's length in seconds. */
	sec: number;
	replays: number;
	/** Played slowed down at least once. */
	slow: boolean;
	/** The Slovak text or the meaning was shown before the verdict. */
	revealed: boolean;
	/** "first": understood on the first unaided listen; "after": after a
	 *  replay, a slow-down or the text; "no": not understood. */
	got: "first" | "after" | "no";
}

export type WatchMode = "step" | "flow";

/** One watching (videos/watches.jsonl, append-only). The milestone page
 *  reads `stats` for its listening-speed estimate: words per second of
 *  the lines got on the first listen. Keep the shape stable. */
export interface WatchLogEntry {
	videoId: string;
	at: string;
	day: string;
	ms?: number;
	mode: WatchMode;
	/** Lines in the video, and how they went (step mode; zeros in flow). */
	segments: number;
	gotFirst: number;
	gotAfter: number;
	missed: number;
	replays: number;
	slowed: number;
	/** The comprehension check. */
	correct: number;
	total: number;
	answers: number[];
	/** Words tapped for a gloss (slugs; words the dictionary lacks by text). */
	tapped: string[];
	/** Words sent to the review deck by this watching. */
	queued: string[];
	xp: number;
	stats: SegmentStat[];
}

export interface VideoLibraryEntry extends VideoIndexEntry {
	watches: number;
	lastWatchedAt?: string;
	lastScore?: { correct: number; total: number };
	/** Share of lines got on the first listen, last time (step mode). */
	lastGotFirst?: number;
}

/** What GET /api/watch answers. */
export interface WatchState {
	library: VideoLibraryEntry[];
	/** A model is configured, so a video can be translated and questioned. */
	canPrepare: boolean;
	/** yt-dlp and a Deepgram key are available: a video without captions
	 *  can be transcribed from its audio. */
	canTranscribe: boolean;
	/** Videos being prepared right now, with the step they are at. */
	preparing: Array<{ id: string; stage: PrepareStage }>;
	/** Videos watched today. */
	watchedToday: number;
}

export type PrepareStage = "captions" | "transcribing" | "translating" | "questions" | "saving" | "done" | "error";

export const PREPARE_STAGE_LINE: Record<PrepareStage, string> = {
	captions: "Fetching the Slovak captions from YouTube",
	transcribing: "No captions — transcribing the audio",
	translating: "Translating every line (cheap model slot, once)",
	questions: "Writing the comprehension questions",
	saving: "Glossing every word and saving",
	done: "Ready",
	error: "Something went wrong",
};

// ─── URLs ───────────────────────────────────────────────────────────────────

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** The video id in a pasted YouTube link (watch, youtu.be, shorts, embed,
 *  live, a bare id), or null. */
export function parseVideoUrl(input: string): string | null {
	const s = input.trim();
	if (VIDEO_ID.test(s)) return s;
	let u: URL;
	try {
		u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
	} catch {
		return null;
	}
	const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
	const ok = (v: string | null | undefined) => (v && VIDEO_ID.test(v) ? v : null);
	if (host === "youtu.be") return ok(u.pathname.slice(1).split("/")[0]);
	if (host === "youtube.com" || host === "youtube-nocookie.com") {
		const v = ok(u.searchParams.get("v"));
		if (v) return v;
		const m = /^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/.exec(u.pathname);
		if (m) return m[1]!;
	}
	return null;
}

export function videoUrl(id: string): string {
	return `https://www.youtube.com/watch?v=${id}`;
}

// ─── Caption formats ────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
		if (e[0] === "#") {
			const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : m;
		}
		return ENTITIES[e.toLowerCase()] ?? m;
	});
}

/** Whitespace collapsed, YouTube's sound tags ([Hudba], [Music], [Applause])
 *  and speaker arrows dropped. */
export function cleanCaptionText(s: string): string {
	return decodeEntities(s)
		.replace(/<[^>]+>/g, " ")
		.replace(/\[[^\]]{1,40}\]/g, " ")
		.replace(/^>>\s*/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/** YouTube's json3 caption format ({"events":[{"tStartMs","dDurationMs",
 *  "segs":[{"utf8"}]}]}). Window-definition events (no segs) are skipped. */
export function parseJson3(text: string): CaptionCue[] {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return [];
	}
	const events = (raw as { events?: unknown })?.events;
	if (!Array.isArray(events)) return [];
	const cues: CaptionCue[] = [];
	for (const e of events as Array<{ tStartMs?: unknown; dDurationMs?: unknown; segs?: unknown; aAppend?: unknown }>) {
		if (!Array.isArray(e.segs)) continue;
		const txt = cleanCaptionText((e.segs as Array<{ utf8?: unknown }>).map((s) => (typeof s.utf8 === "string" ? s.utf8 : "")).join(""));
		if (!txt) continue;
		const start = typeof e.tStartMs === "number" ? e.tStartMs / 1000 : NaN;
		if (!Number.isFinite(start)) continue;
		const dur = typeof e.dDurationMs === "number" ? e.dDurationMs / 1000 : 0;
		// An "append" event continues the previous cue's text.
		if (e.aAppend === 1 && cues.length) {
			const prev = cues[cues.length - 1]!;
			prev.text = `${prev.text} ${txt}`.trim();
			prev.dur = Math.max(prev.dur, start + dur - prev.start);
			continue;
		}
		cues.push({ start, dur, text: txt });
	}
	return cues;
}

/** The two XML timedtext shapes: <text start="1.2" dur="3.4"> (srv1) and
 *  <p t="1200" d="3400"> (srv3, milliseconds). */
export function parseTimedTextXml(text: string): CaptionCue[] {
	const cues: CaptionCue[] = [];
	for (const m of text.matchAll(/<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g)) {
		const txt = cleanCaptionText(m[3]!);
		if (txt) cues.push({ start: parseFloat(m[1]!), dur: m[2] ? parseFloat(m[2]) : 0, text: txt });
	}
	if (cues.length) return cues;
	for (const m of text.matchAll(/<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g)) {
		const txt = cleanCaptionText(m[3]!);
		if (txt) cues.push({ start: parseInt(m[1]!, 10) / 1000, dur: m[2] ? parseInt(m[2], 10) / 1000 : 0, text: txt });
	}
	return cues;
}

/** WebVTT (what yt-dlp writes by default). Positioning cues and the
 *  rolling duplicates of auto-captions are handled by segmentCues. */
export function parseVtt(text: string): CaptionCue[] {
	const cues: CaptionCue[] = [];
	const time = (t: string) => {
		const parts = t.trim().split(":").map(Number);
		if (parts.some((n) => !Number.isFinite(n))) return NaN;
		return parts.length === 3 ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]! : parts.length === 2 ? parts[0]! * 60 + parts[1]! : NaN;
	};
	const blocks = text.replace(/\r/g, "").split(/\n\n+/);
	for (const b of blocks) {
		const lines = b.split("\n");
		const at = lines.findIndex((l) => l.includes("-->"));
		if (at < 0) continue;
		const [a, z] = lines[at]!.split("-->");
		const start = time(a!);
		const end = time(z!.trim().split(/\s+/)[0]!);
		if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
		const txt = cleanCaptionText(lines.slice(at + 1).join(" "));
		if (txt) cues.push({ start, dur: Math.max(0, end - start), text: txt });
	}
	return cues;
}

/** Whichever format the text is in. */
export function parseCaptions(text: string): CaptionCue[] {
	const t = text.trim();
	if (!t) return [];
	if (t.startsWith("{")) return parseJson3(t);
	if (t.startsWith("WEBVTT")) return parseVtt(t);
	if (t.startsWith("<")) return parseTimedTextXml(t);
	return [];
}

// ─── Cutting the captions into lines ────────────────────────────────────────

/** A line is at most this many words / seconds: what the ear can hold
 *  while parsing (working-memory span for L2 speech is short; the Listen
 *  task's sentences stop at twelve words). */
export const SEGMENT_MAX_WORDS = 14;
export const SEGMENT_MAX_SEC = 7;
/** A line shorter than this is joined to the next unless a pause follows. */
export const SEGMENT_MIN_WORDS = 3;
/** Silence longer than this between cues ends a line. */
export const SEGMENT_GAP_SEC = 1.6;
/** Videos longer than this are refused: the translation alone would be
 *  thousands of lines, and an hour of input is not one session. */
export const MAX_VIDEO_SEC = 75 * 60;
export const MAX_SEGMENTS = 900;

const wordsOf = (s: string) => s.split(/\s+/).filter(Boolean);

/** Auto-captions "roll": a cue often repeats the tail of the one before
 *  it. The repeated words are dropped. */
export function stripOverlap(prev: string, next: string): string {
	const a = wordsOf(prev);
	const b = wordsOf(next);
	if (!a.length || !b.length) return next;
	if (next === prev || prev.endsWith(next)) return "";
	const max = Math.min(a.length, b.length);
	for (let n = max; n > 0; n--) {
		if (a.slice(a.length - n).join(" ").toLowerCase() === b.slice(0, n).join(" ").toLowerCase()) return b.slice(n).join(" ");
	}
	return next;
}

/** Share of cues ending in sentence punctuation above which the track
 *  counts as punctuated (captions made by people). Automatic captions have
 *  none: there YouTube's own cue breaks are the phrase units. */
export const PUNCTUATED_SHARE = 0.2;

/** Cut the cues into lines: a line closes at sentence punctuation, at the
 *  word or time limits, or at a silence; in a track without punctuation
 *  (automatic captions) it closes at the cue boundary once it holds a few
 *  words. A line too short is carried into the next. Times are the cues'
 *  own; a line's end never passes the next line's start. */
export function segmentCues(cues: readonly CaptionCue[], opts: { maxWords?: number; maxSec?: number; minWords?: number; gapSec?: number } = {}): Array<{ start: number; end: number; sk: string }> {
	const maxWords = opts.maxWords ?? SEGMENT_MAX_WORDS;
	const maxSec = opts.maxSec ?? SEGMENT_MAX_SEC;
	const minWords = opts.minWords ?? SEGMENT_MIN_WORDS;
	const gapSec = opts.gapSec ?? SEGMENT_GAP_SEC;
	const sorted = [...cues].filter((c) => c.text.trim()).sort((a, b) => a.start - b.start);
	const punctuated = sorted.length > 0 && sorted.filter((c) => /[.!?…]["»”)]?\s*$/.test(c.text)).length / sorted.length >= PUNCTUATED_SHARE;
	const out: Array<{ start: number; end: number; sk: string }> = [];
	let buf: string[] = [];
	let bufStart = 0;
	let bufEnd = 0;
	const flush = () => {
		if (!buf.length) return;
		out.push({ start: round(bufStart), end: round(Math.max(bufEnd, bufStart + 0.4)), sk: buf.join(" ") });
		buf = [];
	};
	let prevText = "";
	for (let i = 0; i < sorted.length; i++) {
		const cue = sorted[i]!;
		const text = stripOverlap(prevText, cleanCaptionText(cue.text));
		prevText = cleanCaptionText(cue.text);
		if (!text) continue;
		const cueEnd = cue.start + Math.max(0, cue.dur);
		// A silence before this cue ends the open line.
		if (buf.length && cue.start - bufEnd > gapSec) flush();
		if (!buf.length) bufStart = cue.start;
		// The cue's words, one line at a time: punctuation inside a cue
		// closes a line too.
		for (const w of wordsOf(text)) {
			buf.push(w);
			bufEnd = cueEnd;
			const closes = /[.!?…]["»”)]?$/.test(w);
			if ((closes && buf.length >= minWords) || buf.length >= maxWords || cueEnd - bufStart >= maxSec) {
				flush();
				bufStart = cueEnd;
			}
		}
		// A line's end never passes the next cue's start.
		const nextStart = sorted[i + 1]?.start;
		if (nextStart !== undefined && bufEnd > nextStart && buf.length) bufEnd = Math.max(bufStart + 0.4, nextStart);
		// Without punctuation the cue break is the phrase break.
		if (!punctuated && buf.length >= minWords) {
			flush();
			bufStart = nextStart ?? cueEnd;
		}
	}
	flush();
	// Times inside a cue that was split: spread the cue's span over its
	// lines by word count, so a replay starts near the right word.
	for (let i = 1; i < out.length; i++) {
		const prev = out[i - 1]!;
		const cur = out[i]!;
		if (cur.start < prev.end) cur.start = prev.end;
		if (cur.end <= cur.start) cur.end = round(cur.start + Math.max(0.4, wordsOf(cur.sk).length * 0.35));
	}
	return out;
}

const round = (n: number) => Math.round(n * 100) / 100;

// ─── Coverage, pre-teaching ─────────────────────────────────────────────────

/** How many unknown words to teach before the video. */
export const PRE_TEACH_MAX = 8;

/** Share of word tokens the learner is expected to know. Grammar words
 *  and names are known (glossSentence never marks them fresh). */
export function videoCoverage(segments: readonly { tokens: readonly StoryToken[] }[]): number {
	const words = wordTokens(segments);
	if (words.length === 0) return 1;
	return words.filter((t) => !t.fresh).length / words.length;
}

/** The unknown words worth meeting before the video: the ones that recur
 *  (every meeting then counts), then the commonest. Only dictionary words
 *  with a gloss; one entry per word. */
export function pickPreTeach(segments: readonly VideoSegment[], max = PRE_TEACH_MAX, rankOf: (slug: string) => number | undefined = () => undefined): PreTeachWord[] {
	const seen = new Map<string, PreTeachWord & { score: number }>();
	segments.forEach((s) => {
		for (const t of s.tokens) {
			if (!t.word || !t.fresh || !t.slug || !t.gloss || !t.lemma) continue;
			const hit = seen.get(t.slug);
			if (hit) {
				hit.count++;
				continue;
			}
			const rank = rankOf(t.slug);
			seen.set(t.slug, { lemma: t.lemma, gloss: t.gloss, slug: t.slug, count: 1, ...(rank !== undefined ? { rank } : {}), ...(t.cat ? { cat: t.cat } : {}), at: s.i, example: s.sk, score: 0 });
		}
	});
	const ranked = [...seen.values()];
	for (const w of ranked) w.score = w.count * 2 + (w.rank !== undefined ? Math.max(0, 3000 - w.rank) / 3000 : 0);
	ranked.sort((a, b) => b.score - a.score || a.at - b.at);
	return ranked.slice(0, max).map(({ score: _score, ...w }) => w);
}

/** What the coverage means for the ear, in one word and one line. */
export function coverageBand(coverage: number): { band: "comfortable" | "stretch" | "hard" | "too-hard"; title: string; line: string } {
	const pct = Math.round(coverage * 100);
	if (coverage >= LISTEN_FLOOR) return { band: "comfortable", title: "Comfortable", line: `You know ${pct} of every 100 words — the range where listening works on its own.` };
	if (coverage >= 0.88) return { band: "stretch", title: "A stretch", line: `${pct} of every 100 words known. Below ${Math.round(LISTEN_FLOOR * 100)} the ear decodes instead of follows; the words below and the step mode close the gap.` };
	if (coverage >= 0.8) return { band: "hard", title: "Hard", line: `${pct} of every 100 words known. Expect to lean on the text; step mode, one line at a time.` };
	return { band: "too-hard", title: "Too hard for now", line: `Only ${pct} of every 100 words known. It will be noise at the moment; keep it for later, or watch with both subtitles on.` };
}

// ─── XP, the listening-speed summary ────────────────────────────────────────

/** A first watching earns a point a line; every line got on the first
 *  listen two more, after help one more; each question right five. A
 *  rewatch earns the lines' bonuses and the questions only. */
export function watchXp(segments: number, gotFirst: number, gotAfter: number, correct: number, rewatch: boolean): number {
	return (rewatch ? 0 : Math.min(60, segments)) + gotFirst * 2 + gotAfter + correct * 5;
}

/** Minutes the daily plan books for a video: its length plus a third for
 *  replays and the check, within reason. */
export function watchMinutes(durationSec: number): number {
	return Math.max(3, Math.min(20, Math.ceil((durationSec * 1.35) / 60) + 1));
}

export interface ListeningSpeed {
	/** Words per minute of speech in the lines got on the first listen. */
	wpmFirst: number | null;
	/** Words per minute over every line played. */
	wpmAll: number;
	/** Lines got first time over lines judged. */
	shareFirst: number;
}

export function listeningSpeed(stats: readonly SegmentStat[]): ListeningSpeed {
	const judged = stats.filter((s) => s.sec > 0 && s.words > 0);
	const first = judged.filter((s) => s.got === "first");
	const wpm = (list: readonly SegmentStat[]) => {
		const sec = list.reduce((n, s) => n + s.sec, 0);
		return sec > 0 ? Math.round((list.reduce((n, s) => n + s.words, 0) / sec) * 60) : 0;
	};
	return { wpmFirst: first.length ? wpm(first) : null, wpmAll: wpm(judged), shareFirst: judged.length ? first.length / judged.length : 0 };
}

// ─── The model's answers ────────────────────────────────────────────────────

/** The translations the model was asked for: a JSON object {"t": [...]}
 *  (or a bare array) with exactly one English line per Slovak line. */
export function parseTranslations(text: string, count: number): string[] {
	const start = Math.min(...[text.indexOf("{"), text.indexOf("[")].filter((i) => i >= 0));
	if (!Number.isFinite(start)) throw new Error("no JSON in the model's answer");
	const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
	let raw: unknown;
	try {
		raw = JSON.parse(text.slice(start, end + 1));
	} catch (err) {
		throw new Error(`the model's JSON does not parse: ${err instanceof Error ? err.message : String(err)}`);
	}
	const list = Array.isArray(raw) ? raw : (raw as { t?: unknown })?.t;
	if (!Array.isArray(list)) throw new Error("the model's answer has no list of translations");
	const out = list.map((v) => (typeof v === "string" ? v.trim() : typeof v === "object" && v && typeof (v as { en?: unknown }).en === "string" ? ((v as { en: string }).en).trim() : ""));
	if (out.length !== count) throw new Error(`the model returned ${out.length} translations for ${count} lines`);
	return out;
}

/** "ep" ids are the stories'; a video is keyed by its YouTube id. */
export function isVideoId(id: string): boolean {
	return VIDEO_ID.test(id);
}

export function formatClock(sec: number): string {
	const s = Math.max(0, Math.floor(sec));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const r = s % 60;
	return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}
