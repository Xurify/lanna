/**
 * Watch service (LangHarness, 2026-10-28) — behind /watch and /api/watch.
 * Turns a pasted YouTube link into a guided video: the Slovak caption
 * track is fetched (YouTube's own, through the player API or the watch
 * page; yt-dlp when the app cannot; a Deepgram transcription of the
 * audio only when the video has no captions and the learner asks), cut
 * into lines the ear can hold, translated once on the cheap model slot,
 * glossed against the lexicon with the same known-words estimate the
 * Read and Listen tasks use, given comprehension questions at the
 * learner's level, and kept on disk (src/store/videos.ts). A finished
 * watching is recorded: the lines got on the first listen, replays and
 * slow-downs, the check, the words tapped and queued, XP and minutes.
 *
 * The video itself is never downloaded or stored: it plays in YouTube's
 * embedded player, where YouTube's terms allow it.
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ACTIVE_PROFILE } from "../../config.ts";
import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import type { Usage } from "@earendil-works/pi-ai";
import { LANGUAGES } from "../core/language.ts";
import { QUESTION_PLAN, questionsFrom, type StoryQuestion, type StoryUsage } from "../core/reading.ts";
import { addMinutes, sessionMs } from "../core/active-time.ts";
import { dayKey } from "../core/review.ts";
import {
	MAX_SEGMENTS,
	MAX_VIDEO_SEC,
	parseCaptions,
	parseTranslations,
	parseVideoUrl,
	pickPreTeach,
	segmentCues,
	videoCoverage,
	videoUrl,
	watchXp,
	type CaptionCue,
	type PrepareStage,
	type SegmentStat,
	type VideoLibraryEntry,
	type VideoRecord,
	type VideoSegment,
	type VideoSourceInfo,
	type WatchLogEntry,
	type WatchMode,
	type WatchState,
} from "../core/watch.ts";
import { ensureReadmes } from "../store/corpus.ts";
import { progressStore } from "../store/progress.ts";
import { videoStore } from "../store/videos.ts";
import { keyValue } from "./keys.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { glossSentence, knownWords, questionLine, storyEngine, storyNames, type KnownWords } from "./reading.ts";
import { enqueueWords } from "./review.ts";

const run = promisify(execFile);
const code = () => LANGUAGES[ACTIVE_PROFILE].code;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const ANDROID_VERSION = "20.10.38";

// ─── Captions from YouTube ──────────────────────────────────────────────────

export interface CaptionTrack {
	baseUrl: string;
	languageCode: string;
	name?: string;
	/** "asr" for YouTube's automatic captions. */
	kind?: string;
}

export interface VideoMeta {
	id: string;
	title: string;
	channel?: string;
	durationSec: number;
	tracks: CaptionTrack[];
	via: "watch-page" | "innertube";
}

/** The JSON object that starts right after `marker` in a script: braces
 *  matched with strings respected, so a watch page's player response is
 *  read whole. */
export function extractJsonAfter(html: string, marker: RegExp): unknown {
	const m = marker.exec(html);
	if (!m) return null;
	let i = m.index + m[0].length;
	while (i < html.length && /\s/.test(html[i]!)) i++;
	if (html[i] !== "{") return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let j = i; j < html.length; j++) {
		const ch = html[j]!;
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') inString = true;
		else if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) {
				try {
					return JSON.parse(html.slice(i, j + 1));
				} catch {
					return null;
				}
			}
		}
	}
	return null;
}

function metaOf(player: unknown, id: string, via: VideoMeta["via"]): VideoMeta | null {
	const p = player as {
		videoDetails?: { videoId?: string; title?: string; author?: string; lengthSeconds?: string | number };
		captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string; kind?: string; name?: { simpleText?: string; runs?: Array<{ text?: string }> } }> } };
		playabilityStatus?: { status?: string; reason?: string };
	} | null;
	if (!p || typeof p !== "object") return null;
	const status = p.playabilityStatus?.status;
	if (status && status !== "OK" && !p.videoDetails?.title) throw new Error(p.playabilityStatus?.reason ? `YouTube says: ${p.playabilityStatus.reason}` : `YouTube will not serve this video (${status})`);
	const d = p.videoDetails ?? {};
	const tracks: CaptionTrack[] = (p.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [])
		.filter((t): t is { baseUrl: string; languageCode: string; kind?: string; name?: { simpleText?: string; runs?: Array<{ text?: string }> } } => typeof t.baseUrl === "string" && typeof t.languageCode === "string")
		.map((t) => ({ baseUrl: t.baseUrl, languageCode: t.languageCode, ...(t.kind ? { kind: t.kind } : {}), ...(t.name?.simpleText || t.name?.runs?.[0]?.text ? { name: t.name?.simpleText ?? t.name?.runs?.map((r) => r.text ?? "").join("") } : {}) }));
	return { id, title: (d.title ?? "").trim() || `YouTube ${id}`, ...(d.author ? { channel: d.author } : {}), durationSec: Number(d.lengthSeconds) || 0, tracks, via };
}

/** The player response through YouTube's own app client: plain JSON, no
 *  page to scrape. */
async function metaFromInnertube(id: string, signal?: AbortSignal): Promise<VideoMeta | null> {
	const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"user-agent": `com.google.android.youtube/${ANDROID_VERSION} (Linux; U; Android 11) gzip`,
			"x-youtube-client-name": "3",
			"x-youtube-client-version": ANDROID_VERSION,
		},
		body: JSON.stringify({ context: { client: { clientName: "ANDROID", clientVersion: ANDROID_VERSION, androidSdkVersion: 30, hl: "en", gl: "US", utcOffsetMinutes: 0 } }, videoId: id, contentCheckOk: true, racyCheckOk: true }),
		signal,
	});
	if (!res.ok) return null;
	return metaOf(await res.json(), id, "innertube");
}

/** The player response as the watch page embeds it. */
async function metaFromWatchPage(id: string, signal?: AbortSignal): Promise<VideoMeta | null> {
	const res = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en&bpctr=9999999999&has_verified=1`, {
		headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", cookie: "CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg" },
		signal,
	});
	if (!res.ok) return null;
	const html = await res.text();
	return metaOf(extractJsonAfter(html, /ytInitialPlayerResponse\s*=\s*/), id, "watch-page");
}

/** The Slovak track to use: a human-made one first, then YouTube's
 *  automatic one. Null when the video has none. */
export function pickTrack(tracks: readonly CaptionTrack[], lang: string = code()): CaptionTrack | null {
	const of = (t: CaptionTrack) => t.languageCode.toLowerCase().split("-")[0] === lang;
	return tracks.find((t) => of(t) && t.kind !== "asr") ?? tracks.find((t) => of(t)) ?? null;
}

async function fetchTrack(track: CaptionTrack, signal?: AbortSignal): Promise<{ ext: "json" | "xml"; text: string; cues: CaptionCue[] } | null> {
	const base = track.baseUrl.replace(/&fmt=[^&]*/g, "");
	for (const [fmt, ext] of [["json3", "json"], ["", "xml"]] as const) {
		try {
			const res = await fetch(fmt ? `${base}&fmt=${fmt}` : base, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }, signal });
			if (!res.ok) continue;
			const text = await res.text();
			const cues = parseCaptions(text);
			if (cues.length) return { ext, text, cues };
		} catch {
			// next format
		}
	}
	return null;
}

export interface FetchedCaptions {
	meta: { id: string; title: string; channel?: string; durationSec: number };
	cues: CaptionCue[];
	source: VideoSourceInfo;
	/** The raw track, kept next to the record. */
	raw?: { ext: "json" | "xml" | "vtt"; text: string };
}

/** yt-dlp on the PATH (or YTDLP_PATH), when it is. */
export function ytDlpPath(): string | null {
	const configured = process.env.YTDLP_PATH?.trim();
	if (configured && fs.existsSync(configured)) return configured;
	const exts = process.platform === "win32" ? ["yt-dlp.exe", "yt-dlp"] : ["yt-dlp"];
	for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
		for (const name of exts) {
			const file = path.join(dir, name);
			try {
				if (fs.statSync(file).isFile()) return file;
			} catch {
				// not here
			}
		}
	}
	return null;
}

/** The captions through yt-dlp: it keeps up with YouTube's changes better
 *  than any hand-written fetch. Subtitles only; nothing else is written. */
async function captionsViaYtDlp(id: string, lang: string, signal?: AbortSignal): Promise<FetchedCaptions | null> {
	const bin = ytDlpPath();
	if (!bin) return null;
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-captions-"));
	try {
		const { stdout } = await run(bin, ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", `${lang},${lang}-orig,${lang}.*`, "--sub-format", "json3/srv3/vtt/best", "--no-warnings", "--no-playlist", "--print-json", "-o", path.join(dir, "%(id)s.%(ext)s"), videoUrl(id)], { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, signal, windowsHide: true });
		const info = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as { title?: string; channel?: string; uploader?: string; duration?: number; subtitles?: Record<string, unknown>; automatic_captions?: Record<string, unknown> };
		const files = fs.readdirSync(dir).filter((f) => f.startsWith(`${id}.`) && /\.(json3|srv3|xml|vtt)$/.test(f));
		const file = files.find((f) => !/\.(?:[a-z]{2,3}(?:-[A-Za-z]+)?)\.(?:json3|srv3|xml|vtt)$/.test(f) || f.includes(`.${lang}`)) ?? files[0];
		if (!file) return null;
		const text = fs.readFileSync(path.join(dir, file), "utf-8");
		const cues = parseCaptions(text);
		if (!cues.length) return null;
		const ext = file.endsWith(".json3") ? "json" : file.endsWith(".vtt") ? "vtt" : "xml";
		const manual = Object.keys(info.subtitles ?? {}).some((k) => k.split("-")[0] === lang);
		return {
			meta: { id, title: info.title?.trim() || `YouTube ${id}`, ...(info.channel || info.uploader ? { channel: (info.channel ?? info.uploader)! } : {}), durationSec: Number(info.duration) || 0 },
			cues,
			source: { kind: manual ? "captions" : "auto-captions", trackLang: lang, via: "yt-dlp" },
			raw: { ext, text },
		};
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

/** The audio transcribed by Deepgram (Slovak, nova-2) when the video has
 *  no captions: yt-dlp pulls the audio to a temp folder, it goes to
 *  Deepgram, and the file is deleted; only the transcript is kept. */
async function captionsViaDeepgram(id: string, meta: VideoMeta | null, lang: string, signal?: AbortSignal): Promise<FetchedCaptions | null> {
	const bin = ytDlpPath();
	const key = keyValue("DEEPGRAM_API_KEY");
	if (!bin || !key) return null;
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-audio-"));
	try {
		const { stdout } = await run(bin, ["-x", "--audio-format", "mp3", "--audio-quality", "6", "--no-warnings", "--no-playlist", "--print-json", "-o", path.join(dir, "%(id)s.%(ext)s"), videoUrl(id)], { timeout: 300_000, maxBuffer: 64 * 1024 * 1024, signal, windowsHide: true });
		const info = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as { title?: string; channel?: string; uploader?: string; duration?: number };
		const file = fs.readdirSync(dir).find((f) => f.endsWith(".mp3"));
		if (!file) return null;
		const audio = fs.readFileSync(path.join(dir, file));
		const res = await fetch(`https://api.deepgram.com/v1/listen?model=nova-2&language=${encodeURIComponent(lang)}&smart_format=true&punctuate=true&utterances=true`, {
			method: "POST",
			headers: { authorization: `Token ${key}`, "content-type": "audio/mpeg" },
			body: new Uint8Array(audio),
			signal,
		});
		if (!res.ok) throw new Error(`Deepgram answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
		const body = (await res.json()) as { results?: { utterances?: Array<{ start: number; end: number; transcript: string }> } };
		const cues: CaptionCue[] = (body.results?.utterances ?? []).filter((u) => u.transcript?.trim()).map((u) => ({ start: u.start, dur: Math.max(0, u.end - u.start), text: u.transcript.trim() }));
		if (!cues.length) return null;
		return {
			meta: { id, title: meta?.title ?? info.title?.trim() ?? `YouTube ${id}`, ...(meta?.channel || info.channel || info.uploader ? { channel: (meta?.channel ?? info.channel ?? info.uploader)! } : {}), durationSec: meta?.durationSec || Number(info.duration) || 0 },
			cues,
			source: { kind: "transcription", trackLang: lang, via: "deepgram" },
			raw: { ext: "json", text: JSON.stringify({ events: cues.map((c) => ({ tStartMs: Math.round(c.start * 1000), dDurationMs: Math.round(c.dur * 1000), segs: [{ utf8: c.text }] })) }) },
		};
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

export class NoCaptionsError extends Error {
	constructor(
		message: string,
		public readonly meta: { title: string; channel?: string; durationSec: number } | null,
		public readonly canTranscribe: boolean,
	) {
		super(message);
		this.name = "NoCaptionsError";
	}
}

/** The Slovak captions of a video, from the first source that has them:
 *  YouTube's player API, the watch page, yt-dlp; then, only when asked,
 *  a transcription of the audio. A kept track is reused. */
export async function fetchCaptions(id: string, opts: { transcribe?: boolean; lang?: string; signal?: AbortSignal; onStage?: (s: PrepareStage) => void } = {}): Promise<FetchedCaptions> {
	const lang = opts.lang ?? code();
	let meta: VideoMeta | null = null;
	const errors: string[] = [];
	for (const get of [metaFromInnertube, metaFromWatchPage]) {
		try {
			meta = await get(id, opts.signal);
			if (meta) {
				const track = pickTrack(meta.tracks, lang);
				if (track) {
					const got = await fetchTrack(track, opts.signal);
					if (got) return { meta: { id, title: meta.title, ...(meta.channel ? { channel: meta.channel } : {}), durationSec: meta.durationSec }, cues: got.cues, source: { kind: track.kind === "asr" ? "auto-captions" : "captions", trackLang: track.languageCode, ...(track.name ? { trackName: track.name } : {}), via: meta.via }, raw: { ext: got.ext, text: got.text } };
					errors.push(`${meta.via}: the caption track came back empty`);
				} else if (meta.tracks.length === 0 && meta.via === "innertube") {
					// The app client sometimes lists no tracks at all: the
					// watch page knows better.
					continue;
				} else break;
			}
		} catch (err) {
			errors.push(`${get === metaFromInnertube ? "innertube" : "watch-page"}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	try {
		const viaDlp = await captionsViaYtDlp(id, lang, opts.signal);
		if (viaDlp) return viaDlp;
	} catch (err) {
		errors.push(`yt-dlp: ${err instanceof Error ? err.message : String(err)}`);
	}
	const canTranscribe = ytDlpPath() !== null && !!keyValue("DEEPGRAM_API_KEY");
	if (opts.transcribe && canTranscribe) {
		opts.onStage?.("transcribing");
		const got = await captionsViaDeepgram(id, meta, lang, opts.signal);
		if (got) return got;
		errors.push("deepgram: no speech found");
	}
	const name = LANGUAGES[ACTIVE_PROFILE].english;
	const why = meta ? (meta.tracks.length ? `This video has captions in ${[...new Set(meta.tracks.map((t) => t.languageCode))].join(", ")} but none in ${name}.` : `This video has no captions at all.`) : `YouTube did not answer for this video${errors.length ? ` (${errors[errors.length - 1]})` : ""}.`;
	throw new NoCaptionsError(`${why}${!meta || meta.tracks.length === 0 ? (canTranscribe ? " The audio can be transcribed instead." : " Transcribing the audio needs yt-dlp on the PATH and a Deepgram key.") : ""}`, meta ? { title: meta.title, ...(meta.channel ? { channel: meta.channel } : {}), durationSec: meta.durationSec } : null, canTranscribe);
}

// ─── Translation and questions on the cheap slot ────────────────────────────

const TRANSLATE_SYSTEM = `You translate the lines of a Slovak video's subtitles into natural English for a learner who watches with both languages on screen. You answer with ONE JSON object and nothing else: {"t": ["...", "..."]} — exactly one English string per Slovak line, in the same order, the same count.

Rules:
- Translate meaning, line by line; keep each line's own content on its own line even when a sentence runs across lines.
- Automatic captions have no punctuation and sometimes a wrong word: translate what was most likely said.
- Keep names as they are. Keep it plain; no notes, no brackets, no alternatives.`;

const QUESTIONS_SYSTEM = `You write comprehension questions in Slovak about a video, for one learner inside a language app. You answer with ONE JSON object and nothing else: {"questions": [{"kind": "recall", "q": "...", "options": ["...", "...", "..."], "answer": 0}]}.

Rules:
- The questions test whether the video was understood: what was said, why, what someone meant. Never grammar, never trivia the video did not say.
- Write the questions and the options at the learner's level, in simple Slovak the learner can read; the options short and all the same shape; the wrong ones plausible (things the video mentions, or a near meaning), never silly. The right one at a different index each time. "answer" is the index of the right option.
- Follow the brief's plan: that many questions, of those kinds in that order, with that many options each; mark each question with its "kind".`;

export interface PrepareOptions {
	/** Test seam: a scripted engine replaces the cheap slot's. */
	engine?: PiEngine;
	model?: string;
	/** Test seam: captions without YouTube. */
	captions?: (id: string) => Promise<FetchedCaptions>;
	/** Transcribe the audio when the video has no captions (yt-dlp + Deepgram). */
	transcribe?: boolean;
	now?: Date;
	/** Prepare again even when the video is already in the library. */
	force?: boolean;
	/** Skip the questions (no model call); tests only. */
	questions?: boolean;
	signal?: AbortSignal;
}

function stepOf(u: Usage): StoryUsage["steps"][number] {
	return { inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, cacheWrite1hTokens: u.cacheWrite1h ?? 0, reasoningTokens: u.reasoning };
}

async function ask(engine: PiEngine, system: string, prompt: string, usage: StoryUsage): Promise<string> {
	const { text } = await runSubagent([], { role: "researcher", engine, systemPrompt: system, prompt, maxTurns: 1, onUsage: (u) => usage.steps.push(stepOf(u)) });
	return text;
}

/** Lines per translation call: enough context to translate well, few
 *  enough that a miscount is cheap to redo. */
export const TRANSLATE_CHUNK = 40;

export async function translateLines(engine: PiEngine, lines: readonly string[], usage: StoryUsage, title: string): Promise<string[]> {
	const out: string[] = [];
	for (let at = 0; at < lines.length; at += TRANSLATE_CHUNK) {
		const chunk = lines.slice(at, at + TRANSLATE_CHUNK);
		const before = lines.slice(Math.max(0, at - 3), at);
		const prompt = [
			`Video: "${title}". Lines ${at + 1}–${at + chunk.length} of ${lines.length}.`,
			before.length ? `For context, the lines just before (do not translate these):\n${before.map((l) => `  ${l}`).join("\n")}` : "",
			`Translate these ${chunk.length} lines, one English string each, same order:\n${JSON.stringify(chunk, null, 0)}`,
		]
			.filter(Boolean)
			.join("\n\n");
		let got: string[] | null = null;
		let lastError: unknown;
		for (let attempt = 0; attempt < 2 && !got; attempt++) {
			try {
				got = parseTranslations(await ask(engine, TRANSLATE_SYSTEM, attempt ? `${prompt}\n\nYour last answer had the wrong number of lines. Return exactly ${chunk.length}.` : prompt, usage), chunk.length);
			} catch (err) {
				lastError = err;
			}
		}
		if (!got) throw lastError instanceof Error ? lastError : new Error(String(lastError));
		out.push(...got);
	}
	return out;
}

export async function questionsFor(engine: PiEngine, segments: readonly { sk: string; en: string }[], k: KnownWords, title: string, usage: StoryUsage): Promise<StoryQuestion[]> {
	const plan = QUESTION_PLAN[k.level];
	// The whole transcript when it fits; the Slovak alone past that.
	const full = segments.map((s) => `${s.sk} — ${s.en}`).join("\n");
	const transcript = full.length <= 24_000 ? full : segments.map((s) => s.sk).join("\n").slice(0, 30_000);
	const prompt = [`Video: "${title}".`, `Learner level: ${k.level}.`, questionLine(k.level), `Transcript (Slovak${full.length <= 24_000 ? " — English" : ""}):\n${transcript}`].join("\n\n");
	const text = await ask(engine, QUESTIONS_SYSTEM, prompt, usage);
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	let raw: unknown = null;
	try {
		raw = JSON.parse(text.slice(start, end + 1));
	} catch {
		return [];
	}
	return questionsFrom((raw as { questions?: unknown })?.questions)
		.slice(0, plan.count)
		.map((q, i) => (q.kind ? q : { ...q, kind: plan.kinds[i] ?? "recall" }));
}

// ─── Preparing a video ──────────────────────────────────────────────────────

const stages = new Map<string, { stage: PrepareStage; error?: string; at: number }>();
const inFlight = new Map<string, Promise<VideoRecord>>();

export function prepareStage(id: string): { stage: PrepareStage; error?: string } | null {
	const s = stages.get(id);
	return s ? { stage: s.stage, ...(s.error ? { error: s.error } : {}) } : null;
}

function setStage(id: string, stage: PrepareStage, error?: string) {
	stages.set(id, { stage, ...(error ? { error } : {}), at: Date.now() });
	// Finished entries fade after a minute, so the library's "preparing"
	// list stays honest.
	if (stage === "done" || stage === "error") setTimeout(() => stages.get(id)?.stage === stage && stages.delete(id), 60_000).unref?.();
}

/** Gloss every line against the lexicon and the learner's known words. */
export function glossSegments(lines: readonly { start: number; end: number; sk: string }[], en: readonly string[], lexicon: Lexicon | null, k: KnownWords): VideoSegment[] {
	const names = storyNames(lines, lexicon);
	return lines.map((l, i) => {
		const g = glossSentence(l.sk, en[i] ?? "", lexicon, k.known, [], names);
		return { i, start: l.start, end: l.end, sk: l.sk, en: g.en, tokens: g.tokens };
	});
}

/** Prepare a video from a pasted link: fetch, cut, translate, gloss,
 *  question, keep. One preparation per video at a time; a second caller
 *  waits for the first. */
export function prepareVideo(url: string, opts: PrepareOptions = {}): Promise<VideoRecord> {
	const id = parseVideoUrl(url);
	if (!id) return Promise.reject(new Error("That is not a YouTube link. Paste a youtube.com/watch, youtu.be or shorts link."));
	const existing = inFlight.get(id);
	if (existing) return existing;
	const job = (async () => {
		const now = opts.now ?? new Date();
		if (!opts.force) {
			const kept = videoStore.get(id);
			if (kept) return kept;
		}
		setStage(id, "captions");
		const lexicon = loadLexicon();
		const k = knownWords(lexicon);
		const fetched = await (opts.captions ? opts.captions(id) : fetchCaptions(id, { transcribe: opts.transcribe, signal: opts.signal, onStage: (s) => setStage(id, s) }));
		if (fetched.meta.durationSec > MAX_VIDEO_SEC) throw new Error(`This video is ${Math.round(fetched.meta.durationSec / 60)} minutes long. Pick one under ${MAX_VIDEO_SEC / 60} minutes; a session is one video.`);
		const lines = segmentCues(fetched.cues).slice(0, MAX_SEGMENTS);
		if (lines.length === 0) throw new Error("The captions are empty.");
		if (fetched.raw) {
			try {
				videoStore.putCaptions(id, fetched.source.trackLang, fetched.raw.ext, fetched.raw.text);
			} catch {
				// the raw track is a courtesy
			}
		}
		let engine = opts.engine;
		let model = opts.model;
		if (!engine) {
			const resolved = storyEngine();
			if (!resolved) throw new Error("No model is configured. Set the cheap slot in Settings → AI models.");
			engine = resolved.engine;
			model ??= resolved.model;
		}
		const usage: StoryUsage = { model: model ?? "faux:faux", steps: [] };
		setStage(id, "translating");
		const en = await translateLines(engine, lines.map((l) => l.sk), usage, fetched.meta.title);
		const segments = glossSegments(lines, en, lexicon, k);
		setStage(id, "questions");
		const questions = opts.questions === false ? [] : await questionsFor(engine, segments, k, fetched.meta.title, usage);
		setStage(id, "saving");
		const rankOf = (slug: string) => lexicon?.bySlug.get(slug)?.rank;
		const preTeach = pickPreTeach(segments, undefined, rankOf);
		const words = segments.flatMap((s) => s.tokens.filter((t) => t.word));
		const record: VideoRecord = {
			id,
			lang: code(),
			url: videoUrl(id),
			title: fetched.meta.title,
			...(fetched.meta.channel ? { channel: fetched.meta.channel } : {}),
			durationSec: fetched.meta.durationSec || Math.ceil(lines[lines.length - 1]!.end),
			source: fetched.source,
			level: k.level,
			createdAt: now.toISOString(),
			segments,
			questions,
			preTeach,
			coverage: Math.round(videoCoverage(segments) * 1000) / 1000,
			wordCount: words.length,
			unknownCount: new Set(words.filter((t) => t.fresh).map((t) => t.slug ?? t.text.toLocaleLowerCase("sk-SK"))).size,
			usage,
			translatedBy: "model",
		};
		videoStore.put(record);
		ensureReadmes();
		setStage(id, "done");
		return record;
	})();
	inFlight.set(id, job);
	return job
		.catch((err) => {
			setStage(id, "error", err instanceof Error ? err.message : String(err));
			throw err;
		})
		.finally(() => inFlight.delete(id));
}

// ─── The library ────────────────────────────────────────────────────────────

export function videoLibrary(): VideoLibraryEntry[] {
	const watches = videoStore.watches();
	return videoStore.list().map((v) => {
		const mine = watches.filter((w) => w.videoId === v.id);
		const last = mine[mine.length - 1];
		return {
			...v,
			watches: mine.length,
			...(last ? { lastWatchedAt: last.at, lastScore: { correct: last.correct, total: last.total }, ...(last.mode === "step" && last.segments ? { lastGotFirst: Math.round((last.gotFirst / last.segments) * 100) / 100 } : {}) } : {}),
		};
	});
}

export function watchState(tz?: number, now = new Date()): WatchState {
	const today = dayKey(now, tz);
	return {
		library: videoLibrary(),
		canPrepare: storyEngine() !== null,
		canTranscribe: ytDlpPath() !== null && !!keyValue("DEEPGRAM_API_KEY"),
		preparing: [...stages.entries()].filter(([, s]) => s.stage !== "done" && s.stage !== "error").map(([id, s]) => ({ id, stage: s.stage })),
		watchedToday: videoStore.watches().filter((w) => w.day === today).length,
	};
}

/** The newest video not yet watched (the daily plan's Watch task). */
export function pendingVideo(): VideoLibraryEntry | null {
	return [...videoLibrary()].reverse().find((v) => v.watches === 0) ?? null;
}

// ─── Recording a watching ───────────────────────────────────────────────────

export interface WatchResultInput {
	videoId: string;
	mode: WatchMode;
	stats: SegmentStat[];
	answers: number[];
	tapped: string[];
	ms?: number;
	/** Active milliseconds since the last send (src/core/active-time.ts). */
	activeMs?: number;
	tz?: number;
}

export interface WatchOutcome {
	xp: number;
	correct: number;
	total: number;
	gotFirst: number;
	gotAfter: number;
	missed: number;
	queued: string[];
	rewatch: boolean;
	summary: ProgressSummary;
}

/** A finished watching: the check is graded, the pre-taught words, the
 *  words looked up and the words of the lines not understood go to the
 *  review deck, the day gets its XP and minutes, and the watching goes to
 *  the log the milestone page reads. */
export function recordWatch(input: WatchResultInput, now = new Date()): WatchOutcome {
	const video = videoStore.get(input.videoId);
	if (!video) throw new Error(`unknown video ${input.videoId}`);
	const rewatch = videoStore.watches().some((w) => w.videoId === video.id);
	let correct = 0;
	video.questions.forEach((q, i) => {
		if (input.answers[i] === q.answer) correct++;
	});
	const total = video.questions.length;
	const stats = input.stats.filter((s) => Number.isInteger(s.i) && s.i >= 0 && s.i < video.segments.length);
	const gotFirst = stats.filter((s) => s.got === "first").length;
	const gotAfter = stats.filter((s) => s.got === "after").length;
	const missed = stats.filter((s) => s.got === "no").length;
	const xp = watchXp(video.segments.length, gotFirst, gotAfter, correct, rewatch);
	const missedWords = stats.filter((s) => s.got === "no").flatMap((s) => video.segments[s.i]!.tokens.filter((t) => t.fresh && t.slug).map((t) => t.slug!));
	const slugs = [...new Set([...video.preTeach.map((w) => w.slug).filter((s): s is string => !!s), ...input.tapped.filter((s) => /^[a-z0-9-]+$/.test(s)), ...missedWords])];
	const queued = slugs.length ? enqueueWords(slugs, now) : [];
	const p = progressStore.read();
	const day = dayKey(now, input.tz);
	const d = (p.days[day] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	d.watches = (d.watches ?? 0) + 1;
	d.xp += xp;
	addMinutes(d, "watch", sessionMs(input));
	p.xp += xp;
	progressStore.write(p);
	const entry: WatchLogEntry = {
		videoId: video.id,
		at: now.toISOString(),
		day,
		...(input.ms ? { ms: input.ms } : {}),
		mode: input.mode,
		segments: video.segments.length,
		gotFirst,
		gotAfter,
		missed,
		replays: stats.reduce((n, s) => n + s.replays, 0),
		slowed: stats.filter((s) => s.slow).length,
		correct,
		total,
		answers: video.questions.map((_, i) => (typeof input.answers[i] === "number" ? input.answers[i]! : -1)),
		tapped: input.tapped,
		queued,
		xp,
		stats,
	};
	videoStore.appendWatch(entry);
	return { xp, correct, total, gotFirst, gotAfter, missed, queued, rewatch, summary: progressSummary(input.tz, now) };
}
