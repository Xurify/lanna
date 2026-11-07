/**
 * Get ready for a video (docs/research/pre-listening.md, E68). One cheap-slot
 * request writes the briefing (src/core/watch-prep.ts): what the video is
 * about, its parts, the keys to hear for, and a short version in the
 * language at the learner's level. The summary is glossed against the
 * lexicon with the same known-words estimate as the video's lines and,
 * when under the floor, written again once with the hard words named, like
 * a Read episode. Kept with its cost in videos/prep/<id>.json (E1).
 * Typing the keys into their real lines earns XP like a lesson's typed reps;
 * misses go to Review and their lines come back in Listen (E56).
 */

import type { Usage } from "@earendil-works/pi-ai";
import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { addMinutes } from "../core/active-time.ts";
import { repXp } from "../core/lesson.ts";
import { knownCoverage, type StoryUsage } from "../core/reading.ts";
import { dayKey } from "../core/review.ts";
import { captionLanguageName } from "../core/language.ts";
import { foreignCaptions, videoCoverage, type VideoRecord } from "../core/watch.ts";
import { keyWords, parsePrep, parsePrepSummary, prepPrompt, prepReps, prepSystem, PREP_PROMPT_LINES, PREP_SUMMARY_FLOOR, PREP_SUMMARY_MIN, summaryAgainPrompt, summaryAgainSystem, type PrepKey, type PrepLine, type PrepRecord, type PrepSentence } from "../core/watch-prep.ts";
import { missedWatchReps } from "../core/watch-reps.ts";
import type { GapResult } from "../core/watch-sections.ts";
import { progressStore } from "../store/progress.ts";
import { videoStore } from "../store/videos.ts";
import { watchRepStore } from "../store/watch-reps.ts";
import { activeLanguage } from "./active-language.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { glossSentence, knownWords, storyEngine, storyNames, type KnownWords } from "./reading.ts";
import { enqueueWords } from "./review.ts";
import { glossSegments, renderInLanguage } from "./watch.ts";

function stepOf(u: Usage): StoryUsage["steps"][number] {
	return { inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, cacheWrite1hTokens: u.cacheWrite1h ?? 0, reasoningTokens: u.reasoning };
}

function videoFor(id: string) {
	const video = videoStore.get(id);
	if (!video) throw new Error(`unknown video ${id}`);
	return video;
}

const isForeign = (video: VideoRecord) => foreignCaptions({ lang: video.lang, trackLang: video.source.trackLang });

/** The lines the briefing is built on. Captions in the language: the video's
 *  own lines. Foreign captions (Czech): their rendering in the language, kept
 *  on the lines since E68 and glossed here with no model call; a video kept
 *  before that is rendered once more (one chunked request, on the briefing's
 *  cost) and the rendering kept in the record. */
async function linesFor(video: VideoRecord, engine: PiEngine, usage: StoryUsage, lexicon: Lexicon | null, k: KnownWords): Promise<{ lines: PrepLine[]; rendered: boolean }> {
	if (!isForeign(video)) return { lines: video.segments, rendered: false };
	let sk = video.segments.map((s) => s.rendered ?? "");
	if (sk.filter(Boolean).length < video.segments.length * 0.9) {
		sk = await renderInLanguage(engine, video.segments.map((s) => s.sk), usage, video.title, video.source.trackLang);
		if (sk.filter(Boolean).length < video.segments.length * 0.9) throw new Error(`The ${captionLanguageName(video.source.trackLang)} captions could not be rendered in ${activeLanguage().english}. Try again.`);
	}
	const glossed = glossSegments(video.segments.map((s, i) => ({ start: s.start, end: s.end, sk: sk[i] || s.sk })), video.segments.map((s) => s.en), lexicon, k);
	return { lines: glossed.map((g, i) => ({ ...g, i: video.segments[i]!.i })), rendered: true };
}

/** The kept briefing, or null when none was made yet. */
export function keptPrep(id: string): PrepRecord | null {
	return videoStore.prep(id);
}

export interface PrepOptions {
	force?: boolean;
	engine?: PiEngine;
	model?: string;
	now?: Date;
	/** Tests: gloss against this lexicon (null for none) instead of the profile's. */
	lexicon?: Lexicon | null;
}

/** The summary glossed and measured: the words the learner knows, the words
 *  the level expects (the keys counted as taught, so a summary that uses
 *  them is not punished for it). */
export function measureSummary(sentences: readonly { sk: string; en: string }[], lexicon: Lexicon | null, k: KnownWords, keys: readonly PrepKey[], videoLines: readonly { sk: string }[]): { summary: PrepSentence[]; known: number; expected: number } {
	const names = storyNames([...videoLines, ...sentences], lexicon);
	const taught = keyWords(keys);
	const summary = sentences.map((s) => {
		const g = glossSentence(s.sk, s.en, lexicon, k.expected, taught, names, k.met);
		return { sk: s.sk, en: s.en, tokens: g.tokens };
	});
	const round = (n: number) => Math.round(n * 1000) / 1000;
	return { summary, known: round(videoCoverage(summary)), expected: round(knownCoverage(summary, taught)) };
}

/** The briefing: the kept one, or one cheap-slot request (two when the
 *  summary needs a redraft) when there is none or `force` asks again.
 *  Throws when no model is set or nothing in the answer held against the
 *  video. */
export async function makePrep(id: string, opts: PrepOptions = {}): Promise<PrepRecord> {
	const video = videoFor(id);
	const kept = videoStore.prep(id);
	if (kept && !opts.force) return kept;
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "test" } : storyEngine();
	if (!resolved) throw new Error("No model is configured. Pick one in Settings → AI models.");
	const name = activeLanguage().english;
	const usage: StoryUsage = { model: resolved.model, steps: [] };
	const ask = async (system: string, prompt: string) => {
		const { text } = await runSubagent([], { role: "researcher", engine: resolved.engine, systemPrompt: system, prompt, maxTurns: 1, onUsage: (u) => usage.steps.push(stepOf(u)) });
		return text;
	};
	const lexicon = opts.lexicon !== undefined ? opts.lexicon : loadLexicon();
	const k = knownWords(lexicon);
	const { lines, rendered } = await linesFor(video, resolved.engine, usage, lexicon, k);
	const on = { title: video.title, ...(video.channel ? { channel: video.channel } : {}), segments: lines };
	const parsed = parsePrep(await ask(prepSystem(name, video.level), prepPrompt(on, video.level, rendered ? { captions: captionLanguageName(video.source.trackLang), language: name } : undefined)), on);
	if (!parsed) throw new Error("The model's briefing did not hold against the video's own lines. Try again.");
	let measured = measureSummary(parsed.summary, lexicon, k, parsed.keys, lines);
	let drafts = parsed.summary.length ? 1 : 0;
	if (parsed.summary.length >= PREP_SUMMARY_MIN && measured.expected < PREP_SUMMARY_FLOOR) {
		// Written again once with the hard words named; the better draft stays.
		const taught = new Set(keyWords(parsed.keys).map((w) => w.lemma.toLocaleLowerCase()));
		const hard = [...new Set(measured.summary.flatMap((s) => s.tokens.filter((t) => t.word && t.fresh && !(t.lemma && taught.has(t.lemma.toLocaleLowerCase()))).map((t) => t.lemma ?? t.text)))].slice(0, 20);
		try {
			const raw = JSON.parse(firstObject(await ask(summaryAgainSystem(name, video.level), summaryAgainPrompt(video, parsed.summary, hard, [...taught])))) as { summary?: unknown };
			const again = parsePrepSummary(raw.summary);
			drafts = 2;
			if (again.length >= PREP_SUMMARY_MIN) {
				const second = measureSummary(again, lexicon, k, parsed.keys, lines);
				if (second.expected >= measured.expected) measured = second;
			}
		} catch {
			// the first draft stays: a summary a little hard beats none
		}
	}
	const rec: PrepRecord = {
		videoId: id,
		level: video.level,
		createdAt: (opts.now ?? new Date()).toISOString(),
		model: resolved.model,
		about: parsed.about,
		parts: parsed.parts,
		keys: parsed.keys,
		summary: measured.summary,
		summaryKnown: measured.known,
		summaryExpected: measured.expected,
		drafts,
		linesShown: Math.min(lines.length, PREP_PROMPT_LINES),
		...(rendered ? { lines } : {}),
		usage,
	};
	videoStore.putPrep(rec);
	return rec;
}

function firstObject(text: string): string {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end < start) throw new Error("no JSON object in the model's answer");
	return text.slice(start, end + 1);
}

export interface PrepOutcome {
	xp: number;
	right: number;
	total: number;
	/** Words put into the Review deck. */
	queued: string[];
	/** Lines that will come back in Listen. */
	lines: number;
	summary: ProgressSummary;
}

/** The keys typed into their lines: XP per gap (a typed rep; half when
 *  accents only or helped), the day's reps and minutes, missed words to
 *  Review, missed lines to the Watch lines in Listen (as for a watching: not
 *  from foreign or automatic captions), and the record marked done. Only the
 *  briefing's own gaps count. */
export function recordPrep(input: { videoId: string; results: readonly GapResult[]; activeMs?: number; tz?: number }, now = new Date()): PrepOutcome {
	const video = videoFor(input.videoId);
	const kept = videoStore.prep(input.videoId);
	if (!kept) throw new Error("No briefing for this video. Get ready first.");
	const reps = new Map(prepReps(video, kept.keys, kept.lines ?? video.segments).map((r) => [r.id, r]));
	const seen = new Set<string>();
	const results = input.results.filter((r) => reps.has(r.id) && !seen.has(r.id) && seen.add(r.id));
	let combo = 0;
	let xp = 0;
	for (const r of results) {
		const clean = r.verdict === "exact" && !r.assisted;
		combo = clean ? combo + 1 : 0;
		xp += repXp("type", r.verdict, combo, r.assisted);
	}
	const missed = results.filter((r) => r.verdict === "wrong" || r.assisted).map((r) => reps.get(r.id)!);
	const slugs = [...new Set(missed.map((r) => r.slug).filter((s): s is string => !!s))];
	const queued = slugs.length ? enqueueWords(slugs, now) : [];
	const day = dayKey(now, input.tz);
	const toListen = !isForeign(video) && video.source.kind !== "auto-captions";
	const lines = toListen ? watchRepStore.addNew(missedWatchReps(video, [...new Set(missed.map((r) => r.at))].map((i) => ({ i, got: "no" as const })), day)).length : 0;
	const p = progressStore.read();
	const d = (p.days[day] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	d.xp += xp;
	d.reps += results.length;
	if (input.activeMs !== undefined) addMinutes(d, "watch", Math.max(0, input.activeMs));
	p.xp += xp;
	progressStore.write(p);
	const right = results.filter((r) => r.verdict !== "wrong" && !r.assisted).length;
	videoStore.putPrep({ ...kept, done: { at: now.toISOString(), right, total: results.length, xp } });
	return { xp, right, total: results.length, queued, lines, summary: progressSummary(input.tz, now) };
}
