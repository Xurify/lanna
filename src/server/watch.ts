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
import { activeProfile, curriculumFile, shownProfiles } from "../../config.ts";
import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import type { Usage } from "@earendil-works/pi-ai";
import { captionLanguageName, type LanguageInfo } from "../core/language.ts";
import { FRAGMENT_PICK_MAX_SEC, FRAGMENT_PICK_MIN_SEC, FRAGMENT_SOURCE_MAX_SEC, type FragmentRange } from "../core/fragments.ts";
import { activeLanguage, profileLanguage } from "./active-language.ts";
import { QUESTION_PLAN, questionsFrom, type StoryQuestion, type StoryUsage } from "../core/reading.ts";
import { addMinutes, sessionMs } from "../core/active-time.ts";
import { dayKey } from "../core/review.ts";
import {
	foreignCaptions,
	MAX_SEGMENTS,
	MAX_VIDEO_SEC,
	MEASURE_VERSION,
	parseCaptions,
	parseTranslations,
	parseVideoUrl,
	PREPARE_STAGE_LINE,
	pickPreTeach,
	segmentCues,
	videoCoverage,
	videoExpected,
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
import { parseVerdict, SENTENCE_MAX_CHARS, SENTENCE_XP, sentenceProblems, type SentenceCheckEntry } from "../core/watch-sentences.ts";
import { missedWatchReps } from "../core/watch-reps.ts";
import { ensureReadmes } from "../store/corpus.ts";
import { discoverStore } from "../store/discover.ts";
import { progressStore } from "../store/progress.ts";
import { videoStore } from "../store/videos.ts";
import { watchRepStore } from "../store/watch-reps.ts";
import { keyValue } from "./keys.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { commonness, glossSentence, knownWords, questionLine, storyEngine, storyNames, type KnownWords } from "./reading.ts";
import { enqueueWords } from "./review.ts";
import { failTask, finishTask, startTask, updateTask } from "./tasks.ts";

const run = promisify(execFile);
const code = () => activeLanguage().code;
/** The caption languages taken, the learner's own first. */
const captionLangs = (): string[] => [code(), ...(activeLanguage().captionFallbacks ?? []).map((f) => f.code)];
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
	channelId?: string;
	/** The start of the uploader's description. */
	description?: string;
	/** A live stream or premiere, now or upcoming. */
	live?: boolean;
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
		videoDetails?: { videoId?: string; title?: string; author?: string; channelId?: string; shortDescription?: string; lengthSeconds?: string | number; isLive?: boolean; isUpcoming?: boolean };
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
	return {
		id,
		title: (d.title ?? "").trim() || `YouTube ${id}`,
		...(d.author ? { channel: d.author } : {}),
		...(d.channelId ? { channelId: d.channelId } : {}),
		...(d.shortDescription ? { description: d.shortDescription.slice(0, 600) } : {}),
		...(d.isLive || d.isUpcoming || status === "LIVE_STREAM_OFFLINE" ? { live: true } : {}),
		durationSec: Number(d.lengthSeconds) || 0,
		tracks,
		via,
	};
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

/** The track to use, in the order of `langs`: for each language a
 *  human-made track first, then YouTube's automatic one. Null when the
 *  video has none in any of them. */
export function pickTrack(tracks: readonly CaptionTrack[], langs: readonly string[] = captionLangs()): CaptionTrack | null {
	for (const lang of langs) {
		const of = (t: CaptionTrack) => t.languageCode.toLowerCase().split("-")[0] === lang;
		const track = tracks.find((t) => of(t) && t.kind !== "asr") ?? tracks.find((t) => of(t));
		if (track) return track;
	}
	return null;
}

/** A video's player data: YouTube's app client first, its watch page when
 *  that lists no captions. Null when neither answers. */
export async function fetchVideoMeta(id: string, signal?: AbortSignal): Promise<VideoMeta | null> {
	let meta: VideoMeta | null = null;
	try {
		meta = await metaFromInnertube(id, signal);
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") throw err;
	}
	if (meta && meta.tracks.length) return meta;
	try {
		return (await metaFromWatchPage(id, signal)) ?? meta;
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") throw err;
		return meta;
	}
}

export async function fetchTrack(track: CaptionTrack, signal?: AbortSignal): Promise<{ ext: "json" | "xml"; text: string; cues: CaptionCue[] } | null> {
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
	meta: { id: string; title: string; channel?: string; channelId?: string; durationSec: number };
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
 *  than any hand-written fetch. Subtitles only; nothing else is written.
 *  The first of `langs` the video has captions in wins. */
async function captionsViaYtDlp(id: string, langs: readonly string[], signal?: AbortSignal): Promise<FetchedCaptions | null> {
	const bin = ytDlpPath();
	if (!bin) return null;
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-captions-"));
	try {
		const subLangs = langs.map((lang) => `${lang},${lang}-orig,${lang}.*`).join(",");
		const { stdout } = await run(bin, ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", subLangs, "--sub-format", "json3/srv3/vtt/best", "--no-warnings", "--no-playlist", "--print-json", "-o", path.join(dir, "%(id)s.%(ext)s"), videoUrl(id)], { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, signal, windowsHide: true });
		const info = JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as { title?: string; channel?: string; uploader?: string; duration?: number; subtitles?: Record<string, unknown>; automatic_captions?: Record<string, unknown> };
		const files = fs.readdirSync(dir).filter((f) => f.startsWith(`${id}.`) && /\.(json3|srv3|xml|vtt)$/.test(f));
		for (const lang of langs) {
			const file = files.find((f) => f.startsWith(`${id}.${lang}.`) || f.startsWith(`${id}.${lang}-`));
			if (!file) continue;
			const text = fs.readFileSync(path.join(dir, file), "utf-8");
			const cues = parseCaptions(text);
			if (!cues.length) continue;
			const ext = file.endsWith(".json3") ? "json" : file.endsWith(".vtt") ? "vtt" : "xml";
			const manual = Object.keys(info.subtitles ?? {}).some((k) => k.split("-")[0] === lang);
			return {
				meta: { id, title: info.title?.trim() || `YouTube ${id}`, ...(info.channel || info.uploader ? { channel: (info.channel ?? info.uploader)! } : {}), durationSec: Number(info.duration) || 0 },
				cues,
				source: { kind: manual ? "captions" : "auto-captions", trackLang: lang, via: "yt-dlp" },
				raw: { ext, text },
			};
		}
		return null;
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
			meta: { id, title: meta?.title ?? info.title?.trim() ?? `YouTube ${id}`, ...(meta?.channel || info.channel || info.uploader ? { channel: (meta?.channel ?? info.channel ?? info.uploader)! } : {}), ...(meta?.channelId ? { channelId: meta.channelId } : {}), durationSec: meta?.durationSec || Number(info.duration) || 0 },
			cues,
			source: { kind: "transcription", trackLang: lang, via: "deepgram" },
			raw: { ext: "json", text: JSON.stringify({ events: cues.map((c) => ({ tStartMs: Math.round(c.start * 1000), dDurationMs: Math.round(c.dur * 1000), segs: [{ utf8: c.text }] })) }) },
		};
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

/** Another of the learner's languages that a video is spoken in. */
export interface ElsewhereProfile {
	profile: string;
	english: string;
}

export class NoCaptionsError extends Error {
	constructor(
		message: string,
		public readonly meta: { title: string; channel?: string; durationSec: number } | null,
		public readonly canTranscribe: boolean,
		public readonly elsewhere: ElsewhereProfile | null = null,
	) {
		super(message);
		this.name = "NoCaptionsError";
	}
}

/** The language a video is spoken in, from its caption tracks: YouTube's
 *  automatic track is made from the audio, so it names the spoken language.
 *  Without one, a single language among the tracks is taken; several human
 *  tracks could all be translations, so no guess is made. */
export function spokenLanguage(tracks: readonly CaptionTrack[]): string | null {
	const base = (t: CaptionTrack) => t.languageCode.toLowerCase().split("-")[0]!;
	const auto = tracks.find((t) => t.kind === "asr");
	if (auto) return base(auto);
	const all = new Set(tracks.map(base));
	return all.size === 1 ? [...all][0]! : null;
}

/** The learner's other language profile that `tracks` say a video is in, when
 *  it is ready to take it (it has its words). */
export function elsewhereProfile(tracks: readonly CaptionTrack[]): ElsewhereProfile | null {
	const spoken = spokenLanguage(tracks);
	if (!spoken) return null;
	for (const id of shownProfiles()) {
		if (id === activeProfile()) continue;
		const info = profileLanguage(id);
		if (info?.code === spoken && fs.existsSync(curriculumFile(id, "lexicon.json"))) return { profile: id, english: info.english };
	}
	return null;
}

/** The captions of a video in the first of the caption languages it has
 *  (Slovak, then Czech), from the first source that has them: YouTube's
 *  player API, the watch page, yt-dlp; then, only when asked, a
 *  transcription of the audio in the first language. A kept track is reused. */
export async function fetchCaptions(id: string, opts: { transcribe?: boolean; lang?: string; signal?: AbortSignal; onStage?: (s: PrepareStage) => void } = {}): Promise<FetchedCaptions> {
	const langs = opts.lang ? [opts.lang] : captionLangs();
	const lang = langs[0]!;
	let meta: VideoMeta | null = null;
	const errors: string[] = [];
	for (const get of [metaFromInnertube, metaFromWatchPage]) {
		try {
			meta = await get(id, opts.signal);
			if (meta) {
				const track = pickTrack(meta.tracks, langs);
				if (track) {
					const got = await fetchTrack(track, opts.signal);
					if (got) return { meta: { id, title: meta.title, ...(meta.channel ? { channel: meta.channel } : {}), ...(meta.channelId ? { channelId: meta.channelId } : {}), durationSec: meta.durationSec }, cues: got.cues, source: { kind: track.kind === "asr" ? "auto-captions" : "captions", trackLang: track.languageCode, ...(track.name ? { trackName: track.name } : {}), via: meta.via }, raw: { ext: got.ext, text: got.text } };
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
		const viaDlp = await captionsViaYtDlp(id, langs, opts.signal);
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
	const wanted = langs.map(captionLanguageName).join(" or ");
	// A caller that chose `lang` wants that language, so no other profile is suggested.
	const elsewhere = meta && !opts.lang ? elsewhereProfile(meta.tracks) : null;
	const why = elsewhere
		? `This video is in ${elsewhere.english}, not ${wanted}. It belongs in your ${elsewhere.english} profile.`
		: meta
			? meta.tracks.length
				? `This video has captions in ${[...new Set(meta.tracks.map((t) => t.languageCode))].join(", ")} but none in ${wanted}.`
				: `This video has no captions at all.`
			: `YouTube did not answer for this video${errors.length ? ` (${errors[errors.length - 1]})` : ""}.`;
	throw new NoCaptionsError(`${why}${!elsewhere && (!meta || meta.tracks.length === 0) ? (canTranscribe ? " The audio can be transcribed instead." : " Transcribing the audio needs yt-dlp on the PATH and a Deepgram key.") : ""}`, meta ? { title: meta.title, ...(meta.channel ? { channel: meta.channel } : {}), durationSec: meta.durationSec } : null, canTranscribe, elsewhere);
}

// ─── Translation and questions on the cheap slot ────────────────────────────

type PromptLang = Pick<LanguageInfo, "english" | "promptExamples">;

export function translateSystem(lang: PromptLang = activeLanguage()): string {
	const name = lang.english;
	const x = lang.promptExamples ?? {};
	return `You translate the lines of a ${name} video's subtitles into natural English for a learner who watches with both languages on screen. You answer with ONE JSON object and nothing else: {"t": ["...", "..."]} — exactly one English string per ${name} line, in the same order, the same count.

Rules:
- One English string per line, covering only that line's own words: never pull in words from the next line or repeat the previous one.
- Lines are cut by length, so a sentence often runs across lines. Read the lines around each one to see what it means, then write the line as natural English for its own words. A line that stops mid-sentence ends with "…", and the line that carries on starts with "…".
- Automatic captions have no punctuation, wrong words, false starts and repeats${x.captionNoise ? ` (${x.captionNoise})` : ""}: translate what the speaker most likely meant, and say a repeat or false start once.
- Keep names as they are. Keep it plain; no notes, no brackets, no alternatives.`;
}

export function renderSystem(name: string = activeLanguage().english): string {
	return `You rewrite the lines of a video's subtitles into ${name}, for a language app that measures how much of the video a ${name} learner already knows. The subtitles are in a closely related language (the ask names it). You answer with ONE JSON object and nothing else: {"t": ["...", "..."]} — exactly one ${name} string per line, in the same order, the same count.

Rules:
- Say each line the way a ${name} speaker would say it, with the same meaning and as close to the original words as ${name} allows: change a word only where the two languages differ (spelling, endings, vocabulary), and leave a word that is the same in both.
- Never summarize, add or drop words; a line that stops mid-sentence stays cut, and the lines around it are context only.
- Keep names as they are. Keep it plain; no notes, no brackets, no alternatives.`;
}

export function questionsSystem(name: string = activeLanguage().english): string {
	return `You write comprehension questions in ${name} about a video, for one learner inside a language app. You answer with ONE JSON object and nothing else: {"questions": [{"kind": "recall", "q": "...", "options": ["...", "...", "..."], "answer": 0}]}.

Rules:
- The questions test whether the video was understood: what was said, why, what someone meant. Never grammar, never trivia the video did not say.
- Write the questions and the options at the learner's level, in simple ${name} the learner can read; the options short and all the same shape; the wrong ones plausible (things the video mentions, or a near meaning), never silly. The right one at a different index each time. "answer" is the index of the right option.
- Follow the brief's plan: that many questions, of those kinds in that order, with that many options each; mark each question with its "kind".`;
}

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
	/** Prepare only this stretch of the video (src/core/fragments.ts): only its
	 *  lines are translated and questioned, whatever the video's length. The
	 *  library keeps one cut of a video; a different one replaces it. */
	range?: FragmentRange;
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

/** Most words one watching sends to the review deck: the app's own cap, so a long video does not flood it. */
export const WATCH_WORDS_MAX = 12;

/** What a chunked ask wants of the model: the English translation of the
 *  lines, or (foreign captions) their Slovak rendering. */
interface ChunkJob {
	system: () => string;
	/** The line before the lines to do, e.g. "Translate these 40 lines, one English string each". */
	ask: (n: number) => string;
	/** What the context lines are not asked for. */
	skip: string;
}
const TRANSLATE_JOB: ChunkJob = { system: () => translateSystem(), ask: (n) => `Translate these ${n} lines, one English string each, same order`, skip: "translate" };
const RENDER_JOB: ChunkJob = { system: () => renderSystem(), ask: (n) => `Rewrite these ${n} lines in ${activeLanguage().english}, one string each, same order`, skip: "rewrite" };

export async function translateLines(engine: PiEngine, lines: readonly string[], usage: StoryUsage, title: string, trackLang: string = code()): Promise<string[]> {
	const foreign = trackLang !== code() ? `These subtitles are in ${captionLanguageName(trackLang)}, not ${activeLanguage().english}: translate what is said.` : "";
	return askInChunks(engine, lines, usage, title, foreign, TRANSLATE_JOB);
}

/** Foreign captions only: each line said in Slovak, so the known-word share can
 *  be measured on Slovak words. One line per line; "" for a line the model
 *  could not count back. */
export async function renderInLanguage(engine: PiEngine, lines: readonly string[], usage: StoryUsage, title: string, trackLang: string): Promise<string[]> {
	return askInChunks(engine, lines, usage, title, `These subtitles are in ${captionLanguageName(trackLang)}.`, RENDER_JOB);
}

async function askInChunks(engine: PiEngine, lines: readonly string[], usage: StoryUsage, title: string, foreign: string, job: ChunkJob): Promise<string[]> {
	const out: string[] = [];
	for (let at = 0; at < lines.length; at += TRANSLATE_CHUNK) {
		const chunk = lines.slice(at, at + TRANSLATE_CHUNK);
		out.push(...(await translateChunk(engine, chunk, lines.slice(Math.max(0, at - 3), at), lines.slice(at + chunk.length, at + chunk.length + 3), at + 1, lines.length, title, usage, foreign, job)));
	}
	return out;
}

/** One chunk asked for as a whole, then once more. A chunk the model still
 *  miscounts is split in two, and each half is asked on its own with the
 *  lines around it as context: a shorter ask miscounts less often. */
async function translateChunk(engine: PiEngine, chunk: readonly string[], before: readonly string[], after: readonly string[], from: number, total: number, title: string, usage: StoryUsage, foreign: string, job: ChunkJob): Promise<string[]> {
	const prompt = [
		`Video: "${title}". Lines ${from}–${from + chunk.length - 1} of ${total}.`,
		foreign,
		before.length ? `For context, the lines just before (do not ${job.skip} these):\n${before.map((l) => `  ${l}`).join("\n")}` : "",
		after.length ? `For context, the lines just after (do not ${job.skip} these):\n${after.map((l) => `  ${l}`).join("\n")}` : "",
		`${job.ask(chunk.length)}:\n${JSON.stringify(chunk, null, 0)}`,
	]
		.filter(Boolean)
		.join("\n\n");
	let lastError: unknown;
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			return parseTranslations(await ask(engine, job.system(), attempt ? `${prompt}\n\nYour last answer had the wrong number of lines. Return exactly ${chunk.length}.` : prompt, usage), chunk.length);
		} catch (err) {
			lastError = err;
		}
	}
	const failed = lastError instanceof Error ? lastError : new Error(String(lastError));
	if (chunk.length < 2) {
		// A line the model cannot count back into its answer stays in the
		// video with no English, rather than refusing the whole video; the
		// blanks are counted and shown.
		if (/^(the model returned|the model's|no JSON)/.test(failed.message)) return chunk.map(() => "");
		throw failed;
	}
	const half = Math.ceil(chunk.length / 2);
	const first = await translateChunk(engine, chunk.slice(0, half), before, [...chunk.slice(half), ...after].slice(0, 3), from, total, title, usage, foreign, job);
	const second = await translateChunk(engine, chunk.slice(half), [...before, ...chunk.slice(0, half)].slice(-3), after, from + half, total, title, usage, foreign, job);
	return [...first, ...second];
}

export async function questionsFor(engine: PiEngine, segments: readonly { sk: string; en: string }[], k: KnownWords, title: string, usage: StoryUsage): Promise<StoryQuestion[]> {
	const plan = QUESTION_PLAN[k.level];
	// The whole transcript when it fits; the Slovak alone past that.
	const full = segments.map((s) => `${s.sk} — ${s.en}`).join("\n");
	const transcript = full.length <= 24_000 ? full : segments.map((s) => s.sk).join("\n").slice(0, 30_000);
	const prompt = [`Video: "${title}".`, `Learner level: ${k.level}.`, questionLine(k.level), `Transcript (${activeLanguage().english}${full.length <= 24_000 ? " — English" : ""}):\n${transcript}`].join("\n\n");
	const text = await ask(engine, questionsSystem(), prompt, usage);
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

/** Is the kept record the cut asked for: the whole video, or this stretch? */
function sameCut(kept: VideoRecord, range: FragmentRange | undefined): boolean {
	if (!range) return !kept.fragment;
	return !!kept.fragment && Math.abs(kept.fragment.startSec - range.startSec) < 1.5 && Math.abs(kept.fragment.endSec - range.endSec) < 1.5;
}

export function prepareStage(id: string): { stage: PrepareStage; error?: string } | null {
	const s = stages.get(id);
	return s ? { stage: s.stage, ...(s.error ? { error: s.error } : {}) } : null;
}

const taskIdOf = (id: string) => `video:${id}`;

function setStage(id: string, stage: PrepareStage, error?: string) {
	stages.set(id, { stage, ...(error ? { error } : {}), at: Date.now() });
	if (stage !== "done" && stage !== "error") updateTask(taskIdOf(id), { step: PREPARE_STAGE_LINE[stage] });
	// Finished entries fade after a minute, so the library's "preparing"
	// list stays honest.
	if (stage === "done" || stage === "error") setTimeout(() => stages.get(id)?.stage === stage && stages.delete(id), 60_000).unref?.();
}

/** Gloss every line against the lexicon and the learner's words: `fresh`
 *  is a word beyond what the level expects, `assumed` one the level expects
 *  but the learner has not studied. */
export function glossSegments(lines: readonly { start: number; end: number; sk: string }[], en: readonly string[], lexicon: Lexicon | null, k: KnownWords): VideoSegment[] {
	const names = storyNames(lines, lexicon);
	return lines.map((l, i) => {
		const g = glossSentence(l.sk, en[i] ?? "", lexicon, k.expected, [], names, k.met);
		return { i, start: l.start, end: l.end, sk: l.sk, en: g.en, tokens: g.tokens };
	});
}

/** Prepare a video from a pasted link: fetch, cut, translate, gloss,
 *  question, keep. One preparation per video at a time; a second caller
 *  waits for the first. */
export function prepareVideo(url: string, opts: PrepareOptions = {}): Promise<VideoRecord> {
	const id = parseVideoUrl(url);
	if (!id) return Promise.reject(new Error("That is not a YouTube link. Paste a youtube.com/watch, youtu.be or shorts link."));
	const range = opts.range;
	if (range && !(Number.isFinite(range.startSec) && Number.isFinite(range.endSec) && range.startSec >= 0 && range.endSec - range.startSec >= FRAGMENT_PICK_MIN_SEC && range.endSec - range.startSec <= FRAGMENT_PICK_MAX_SEC)) {
		return Promise.reject(new Error(`A fragment is between ${FRAGMENT_PICK_MIN_SEC} seconds and ${FRAGMENT_PICK_MAX_SEC / 60} minutes long.`));
	}
	const key = range ? `${id}@${Math.round(range.startSec)}-${Math.round(range.endSec)}` : id;
	const existing = inFlight.get(key);
	if (existing) return existing;
	const job = (async () => {
		const now = opts.now ?? new Date();
		if (!opts.force) {
			const kept = videoStore.get(id);
			if (kept && sameCut(kept, range)) return kept;
		}
		const task = startTask({ id: taskIdOf(id), kind: "video", title: videoStore.get(id)?.title ?? `Video ${id}`, step: PREPARE_STAGE_LINE.captions });
		const signal = opts.signal ? AbortSignal.any([opts.signal, task.signal]) : task.signal;
		setStage(id, "captions");
		const lexicon = loadLexicon();
		const k = knownWords(lexicon);
		const fetched = await (opts.captions ? opts.captions(id) : fetchCaptions(id, { transcribe: opts.transcribe, signal, onStage: (s) => setStage(id, s) }));
		if (range ? fetched.meta.durationSec > FRAGMENT_SOURCE_MAX_SEC : fetched.meta.durationSec > MAX_VIDEO_SEC) throw new Error(`This video is ${Math.round(fetched.meta.durationSec / 60)} minutes long. Pick one under ${MAX_VIDEO_SEC / 60} minutes; a session is one video.`);
		signal.throwIfAborted();
		updateTask(taskIdOf(id), { title: fetched.meta.title });
		const lines = range ? segmentCues(fetched.cues).filter((l) => l.start >= range.startSec - 0.5 && l.end <= range.endSec + 0.5) : segmentCues(fetched.cues).slice(0, MAX_SEGMENTS);
		if (lines.length === 0) throw new Error(range ? "The captions have no speech in that stretch." : "The captions are empty.");
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
			if (!resolved) throw new Error("No model is configured. Pick one in Settings → AI models.");
			engine = resolved.engine;
			model ??= resolved.model;
		}
		const usage: StoryUsage = { model: model ?? "faux:faux", steps: [] };
		setStage(id, "translating");
		const en = await translateLines(engine, lines.map((l) => l.sk), usage, fetched.meta.title, fetched.source.trackLang);
		signal.throwIfAborted();
		const untranslated = en.filter((t) => t === "").length;
		const segments = glossSegments(lines, en, lexicon, k);
		// Foreign captions (Czech): the known-word share is measured on a Slovak rendering of the lines,
		// since Czech spellings would read as unknown words. The lines shown stay as captioned. Without a
		// usable rendering the share is left out (coverageKind "none") instead of guessed low.
		let measured = segments;
		let estimated = false;
		if (fetched.source.trackLang !== code()) {
			try {
				const sk = await renderInLanguage(engine, lines.map((l) => l.sk), usage, fetched.meta.title, fetched.source.trackLang);
				signal.throwIfAborted();
				if (sk.filter(Boolean).length >= lines.length * 0.9) {
					measured = glossSegments(lines.map((l, i) => ({ ...l, sk: sk[i] || l.sk })), en, lexicon, k);
					estimated = true;
				}
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") throw err;
			}
		}
		setStage(id, "questions");
		const questions = opts.questions === false ? [] : await questionsFor(engine, segments, k, fetched.meta.title, usage);
		setStage(id, "saving");
		const rankOf = commonness(lexicon);
		const preTeach = pickPreTeach(measured, undefined, rankOf);
		const words = measured.flatMap((s) => s.tokens.filter((t) => t.word));
		const record: VideoRecord = {
			id,
			lang: code(),
			url: videoUrl(id),
			title: fetched.meta.title,
			...(fetched.meta.channel ? { channel: fetched.meta.channel } : {}),
			...(fetched.meta.channelId ? { channelId: fetched.meta.channelId } : {}),
			durationSec: range ? Math.ceil(lines[lines.length - 1]!.end - lines[0]!.start) : fetched.meta.durationSec || Math.ceil(lines[lines.length - 1]!.end),
			...(range ? { fragment: { startSec: lines[0]!.start, endSec: lines[lines.length - 1]!.end, ofSec: fetched.meta.durationSec || Math.ceil(fetched.cues[fetched.cues.length - 1]?.start ?? 0) } } : {}),
			source: fetched.source,
			level: k.level,
			createdAt: now.toISOString(),
			segments,
			questions,
			preTeach,
			coverage: Math.round(videoCoverage(measured) * 1000) / 1000,
			expected: Math.round(videoExpected(measured) * 1000) / 1000,
			measure: MEASURE_VERSION,
			wordCount: words.length,
			unknownCount: new Set(words.filter((t) => t.fresh || t.assumed).map((t) => t.slug ?? t.text.toLocaleLowerCase("sk-SK"))).size,
			usage,
			translatedBy: "model",
			...(untranslated ? { untranslated } : {}),
			...(estimated ? { coverageEstimated: true } : {}),
		};
		signal.throwIfAborted();
		videoStore.put(record);
		ensureReadmes();
		setStage(id, "done");
		finishTask(taskIdOf(id), { title: record.title, href: `/watch?id=${id}` });
		return record;
	})();
	inFlight.set(key, job);
	return job
		.catch((err) => {
			const message = err instanceof Error && err.name === "AbortError" ? "Stopped." : err instanceof Error ? err.message : String(err);
			setStage(id, "error", message);
			failTask(taskIdOf(id), message, err instanceof NoCaptionsError && err.canTranscribe ? { label: "Transcribe the audio", url, transcribe: true } : undefined);
			throw err;
		})
		.finally(() => inFlight.delete(key));
}

/** Start a preparation and answer as soon as it is safely under way: a kept
 *  video, or an error from the captions step (no captions, a video in another
 *  language, no model), comes back as before; once the lines are being
 *  translated, the rest runs as the task and this answers `background`.
 *  Before, the route ignored `background` and held the request through the
 *  whole translation, so the shelf showed its own "Adding" row next to the
 *  task's row for the same video until the end. */
export async function prepareVideoInBackground(url: string, opts: PrepareOptions & { pollMs?: number } = {}): Promise<VideoRecord | { background: true; id: string }> {
	const id = parseVideoUrl(url);
	const job = prepareVideo(url, opts);
	// A failure after the answer is on the task (failTask), not unhandled here.
	job.catch(() => undefined);
	if (!id) return job;
	let timer: ReturnType<typeof setInterval> | undefined;
	const underWay = new Promise<{ background: true; id: string }>((resolve) => {
		timer = setInterval(() => {
			const s = prepareStage(id)?.stage;
			if (s === "translating" || s === "questions" || s === "saving") resolve({ background: true, id });
		}, opts.pollMs ?? 200);
	});
	try {
		return await Promise.race([job, underWay]);
	} finally {
		clearInterval(timer);
	}
}

// ─── The library ────────────────────────────────────────────────────────────

/** A kept video measured by the current rule. One kept under an older rule is
 *  glossed again from its stored lines (local, no model call) and saved, so
 *  its shares match what the learner knows now. Foreign captions keep theirs:
 *  their share came from a model's rendering that is not kept. */
export function remeasureVideo(rec: VideoRecord): VideoRecord {
	if (rec.measure === MEASURE_VERSION || foreignCaptions({ lang: rec.lang, trackLang: rec.source.trackLang })) return rec;
	try {
		const lexicon = loadLexicon();
		const segments = glossSegments(rec.segments, rec.segments.map((s) => s.en), lexicon, knownWords(lexicon));
		const words = segments.flatMap((s) => s.tokens.filter((t) => t.word));
		const next: VideoRecord = {
			...rec,
			segments,
			coverage: Math.round(videoCoverage(segments) * 1000) / 1000,
			expected: Math.round(videoExpected(segments) * 1000) / 1000,
			wordCount: words.length,
			unknownCount: new Set(words.filter((t) => t.fresh || t.assumed).map((t) => t.slug ?? t.text.toLocaleLowerCase(activeLanguage().tag))).size,
			preTeach: pickPreTeach(segments, undefined, commonness(lexicon)),
			measure: MEASURE_VERSION,
		};
		videoStore.put(next);
		return next;
	} catch {
		return rec;
	}
}

/** A kept video as the page should show it. */
/** The channel a kept video belongs to, for a link to it. Videos kept before the id was kept take it from the picks' check of the same video, or from a saved creator of the same name. */
function channelIdOf(v: { id: string; channel?: string; channelId?: string }, scans: ReturnType<typeof discoverStore.scans>, creators: Array<{ id: string; name: string }>): string | undefined {
	return v.channelId ?? scans[v.id]?.channelId ?? (v.channel ? creators.find((c) => c.name === v.channel)?.id : undefined);
}

export function currentVideo(id: string): VideoRecord | null {
	const rec = videoStore.get(id);
	if (!rec) return null;
	const next = remeasureVideo(rec);
	const channelId = channelIdOf(next, discoverStore.scans(), discoverStore.creators().creators);
	return channelId ? { ...next, channelId } : next;
}

export function videoLibrary(): VideoLibraryEntry[] {
	for (const e of videoStore.list()) {
		if (e.measure === MEASURE_VERSION || e.estimated) continue;
		const rec = videoStore.get(e.id);
		if (rec) remeasureVideo(rec);
	}
	const watches = videoStore.watches();
	const scans = discoverStore.scans();
	const creators = discoverStore.creators().creators;
	return videoStore.list().map((v) => {
		const mine = watches.filter((w) => w.videoId === v.id);
		const last = mine[mine.length - 1];
		const channelId = channelIdOf(v, scans, creators);
		return {
			...v,
			...(channelId ? { channelId } : {}),
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
	// The words the learner asked about come first, so a long video cannot crowd them out.
	const slugs = [...new Set([...input.tapped.filter((s) => /^[a-z0-9-]+$/.test(s)), ...missedWords, ...video.preTeach.map((w) => w.slug).filter((s): s is string => !!s)])].slice(0, WATCH_WORDS_MAX);
	const queued = slugs.length ? enqueueWords(slugs, now) : [];
	const p = progressStore.read();
	const day = dayKey(now, input.tz);
	const d = (p.days[day] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	d.watches = (d.watches ?? 0) + 1;
	d.xp += xp;
	const counted = addMinutes(d, "watch", sessionMs(input));
	p.xp += xp;
	progressStore.write(p);
	const entry: WatchLogEntry = {
		videoId: video.id,
		at: now.toISOString(),
		day,
		...(input.ms ? { ms: input.ms } : {}),
		...(input.activeMs !== undefined ? { activeMs: input.activeMs } : {}),
		minutes: Math.round(counted * 100) / 100,
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
	// The lines not understood on the first listen come back in Listen (docs/research/creator-hooks.md, proposal 7).
	try {
		// Foreign captions (Czech for Slovak) would be played in another language, and automatic ones can misspell what was said, so their lines do not come back.
		if (!foreignCaptions({ lang: video.lang, trackLang: video.source.trackLang }) && video.source.kind !== "auto-captions") watchRepStore.addNew(missedWatchReps(video, stats, day));
	} catch (err) {
		console.warn("[watch] could not queue the missed lines:", err instanceof Error ? err.message : err);
	}
	return { xp, correct, total, gotFirst, gotAfter, missed, queued, rewatch, summary: progressSummary(input.tz, now) };
}

// ─── The sentence step ──────────────────────────────────────────────────────

export function sentenceSystem(name: string = activeLanguage().english): string {
	return `You check one ${name} sentence that a beginner wrote to use a given ${name} word. You answer with ONE JSON object and nothing else: {"ok": true, "corrected": "...", "why": "..."}.

Rules:
- ok is true when the sentence is correct, standard ${name} and uses the word in any form.
- Answer ok false only when you are sure the sentence is wrong or does not use the word. When you are unsure, answer ok true and say in "why" what to check.
- "corrected": the sentence with the smallest fix when ok is false; otherwise the sentence as written.
- "why": one plain English sentence for the learner, at most 25 words.
- Nothing outside the JSON.`;
}

export interface SentenceAnswer {
	ok: boolean;
	corrected: string;
	why: string;
	/** Answered from a verdict kept before: no model call. */
	cached: boolean;
	xp: number;
}

/** A learner's sentence for one word of a video's sentence step. The
 *  program checks what it can see for certain first; the cheap slot judges
 *  the rest and every verdict is kept. The same sentence for the same word
 *  is answered from the kept verdict. XP the first time a word is accepted
 *  for a video. */
export async function checkSentence(input: { videoId: string; lemma: string; sentence: string; tz?: number }, opts: { engine?: PiEngine; model?: string; now?: Date } = {}): Promise<SentenceAnswer> {
	const video = videoStore.get(input.videoId);
	if (!video) throw new Error(`unknown video ${input.videoId}`);
	if (video.source.trackLang !== video.lang) throw new Error("This video's captions are not in the language you learn, so it has no sentence step.");
	const lemma = input.lemma.trim();
	const sentence = input.sentence.trim();
	const isWord = video.preTeach.some((w) => w.lemma === lemma) || video.segments.some((s) => s.tokens.some((t) => t.lemma === lemma));
	if (!isWord) throw new Error(`"${lemma}" is not a word of this video`);
	if (!sentence || sentence.length > SENTENCE_MAX_CHARS) throw new Error(`Write one sentence, up to ${SENTENCE_MAX_CHARS} characters.`);
	const problems = sentenceProblems(sentence, lemma);
	if (problems.length) return { ok: false, corrected: sentence, why: problems[0]!, cached: false, xp: 0 };
	const earlier = videoStore.sentences().filter((s) => s.videoId === video.id && s.lemma === lemma);
	const same = earlier.find((s) => s.sentence === sentence);
	if (same) return { ok: same.ok, corrected: same.corrected, why: same.why, cached: true, xp: 0 };
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "test" } : storyEngine();
	if (!resolved) throw new Error("No model is configured. Pick one in Settings → AI models.");
	const gloss = video.preTeach.find((w) => w.lemma === lemma)?.gloss ?? video.segments.flatMap((s) => s.tokens).find((t) => t.lemma === lemma)?.gloss ?? "";
	const usage: StoryUsage = { model: resolved.model, steps: [] };
	const text = await ask(resolved.engine, sentenceSystem(), `The word: "${lemma}" (dictionary form; meaning: ${gloss || "not given"}).\nThe sentence: ${JSON.stringify(sentence)}`, usage);
	const verdict = parseVerdict(text, sentence);
	if (!verdict) throw new Error("The check did not answer in the form it should. Try again.");
	const now = opts.now ?? new Date();
	const entry: SentenceCheckEntry = { videoId: video.id, lemma, sentence, ok: verdict.ok, corrected: verdict.corrected, why: verdict.why, model: resolved.model, at: now.toISOString() };
	videoStore.appendSentence(entry);
	const xp = verdict.ok && !earlier.some((s) => s.ok) ? SENTENCE_XP : 0;
	if (xp) {
		const p = progressStore.read();
		const d = (p.days[dayKey(now, input.tz)] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
		d.xp += xp;
		p.xp += xp;
		progressStore.write(p);
	}
	return { ok: verdict.ok, corrected: verdict.corrected, why: verdict.why, cached: false, xp };
}
