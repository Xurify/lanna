/**
 * Fluency service (LangHarness, 2026-10-28) — behind /fluency and
 * /api/fluency. Two rounds at 100% known material, built locally with no
 * model call:
 *
 *   reread — an episode the learner has already read (src/store/
 *            stories.ts), timed; words a minute against their last time
 *            on it and the level's target; one of its own questions as
 *            the check.
 *   fast   — six sentences every word of which is known (the ones the
 *            learner answered right in lessons first), each said three
 *            times in a shrinking window (src/core/fluency.ts).
 *
 * Finishing records the day's fluency work, XP and minutes, and logs the
 * round to data/profiles/<lang>/fluency/log.jsonl.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import { FAST_PASSES, fastXp, pickKnown, rereadXp, wordsPerMinute, WPM_TARGET, type FastItem, type FastRep, type FluencyLogEntry, type RereadLogEntry } from "../core/fluency.ts";
import type { StoryQuestion, StoryRecord } from "../core/reading.ts";
import { dayKey } from "../core/review.ts";
import { appendLessonLog, ensureReadmes, readLessonLog } from "../store/corpus.ts";
import { progressStore } from "../store/progress.ts";
import { fluencyStore } from "../store/speak.ts";
import { storyStore } from "../store/stories.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { pronunciationReport, type PronReport } from "./pronounce.ts";
import { knownWords, resolveWord, STORY_NAMES } from "./reading.ts";

// ─── Re-read ────────────────────────────────────────────────────────────────

export interface RereadPlan {
	story: StoryRecord;
	words: number;
	/** Words a minute to beat: the last re-read of this episode, else the level's target. */
	targetWpm: number;
	previousWpm: number | null;
	/** The first reading's pace, when it was timed. */
	firstWpm: number | null;
	/** The check: one of the episode's questions. */
	question: StoryQuestion;
	questionIndex: number;
	/** Every re-read of this episode so far, oldest first. */
	history: Array<{ at: string; wpm: number }>;
}

function wordCount(story: StoryRecord): number {
	return story.wordCount || story.sentences.reduce((n, s) => n + s.tokens.filter((t) => t.word).length, 0);
}

/** The episode to re-read: the one read the longest ago (a fresh memory
 *  of the text is the point of the exercise, but not today's reading),
 *  or the id asked for. Null when nothing has been read. */
export function rereadFor(opts: { id?: string; tz?: number; now?: Date } = {}): RereadPlan | null {
	const now = opts.now ?? new Date();
	const today = dayKey(now, opts.tz);
	const reads = storyStore.reads();
	let id = opts.id;
	if (!id) {
		// Last-read time per episode; the oldest first, today's readings last.
		const last = new Map<string, string>();
		for (const r of reads) last.set(r.storyId, r.at);
		const rounds = fluencyStore.list().filter((e): e is RereadLogEntry => e.mode === "reread");
		const lastRound = new Map<string, string>();
		for (const r of rounds) lastRound.set(r.storyId, r.at);
		const candidates = [...last.entries()]
			.map(([storyId, at]) => ({ storyId, at: lastRound.get(storyId) && lastRound.get(storyId)! > at ? lastRound.get(storyId)! : at, today: reads.some((r) => r.storyId === storyId && r.day === today) }))
			.sort((a, b) => Number(a.today) - Number(b.today) || a.at.localeCompare(b.at));
		id = candidates[0]?.storyId;
	}
	if (!id) return null;
	const story = storyStore.get(id);
	if (!story || story.questions.length === 0) return null;
	const words = wordCount(story);
	const history = fluencyStore
		.list()
		.filter((e): e is RereadLogEntry => e.mode === "reread" && e.storyId === story.id)
		.map((e) => ({ at: e.at, wpm: e.wpm }));
	const previousWpm = history.length ? history[history.length - 1]!.wpm : null;
	const first = reads.find((r) => r.storyId === story.id && r.ms);
	const firstWpm = first?.ms ? wordsPerMinute(words, first.ms) : null;
	// A different question each time, in order.
	const questionIndex = history.length % story.questions.length;
	return {
		story,
		words,
		targetWpm: previousWpm ?? WPM_TARGET[story.level],
		previousWpm,
		firstWpm,
		question: story.questions[questionIndex]!,
		questionIndex,
		history,
	};
}

export interface RereadResultInput {
	storyId: string;
	ms: number;
	questionIndex: number;
	answer: number;
	tz?: number;
}

export interface RereadOutcome {
	xp: number;
	wpm: number;
	targetWpm: number;
	previousWpm: number | null;
	faster: boolean;
	right: boolean;
	summary: ProgressSummary;
}

export function recordReread(input: RereadResultInput, now = new Date()): RereadOutcome {
	const story = storyStore.get(input.storyId);
	if (!story) throw new Error(`unknown story ${input.storyId}`);
	const words = wordCount(story);
	const ms = Math.max(1000, Math.min(30 * 60_000, Math.round(input.ms)));
	const wpm = wordsPerMinute(words, ms);
	const history = fluencyStore.list().filter((e): e is RereadLogEntry => e.mode === "reread" && e.storyId === story.id);
	const previousWpm = history.length ? history[history.length - 1]!.wpm : null;
	const targetWpm = previousWpm ?? WPM_TARGET[story.level];
	const q = story.questions[input.questionIndex];
	const right = !!q && q.answer === input.answer;
	const xp = rereadXp(wpm, targetWpm, previousWpm, right);
	const key = dayKey(now, input.tz);
	const p = progressStore.read();
	const day = (p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	day.rereads = (day.rereads ?? 0) + 1;
	day.xp += xp;
	day.minutes = (day.minutes ?? 0) + Math.min(10, ms / 60_000);
	p.xp += xp;
	progressStore.write(p);
	fluencyStore.append({ mode: "reread", storyId: story.id, at: now.toISOString(), day: key, words, ms, wpm, question: input.questionIndex, right, xp });
	ensureReadmes();
	return { xp, wpm, targetWpm, previousWpm, faster: wpm > targetWpm, right, summary: progressSummary(input.tz, now) };
}

// ─── Say it faster ──────────────────────────────────────────────────────────

export interface FastPlan {
	items: FastItem[];
	known: number;
}

/** Item ids the learner answered right in a lesson (any mode): their
 *  own practised sentences. */
function practisedIds(): Set<string> {
	const out = new Set<string>();
	for (const entry of readLessonLog()) {
		if (entry.mode !== "lesson" && entry.mode !== "blitz" && entry.mode !== "placement") continue;
		for (const r of entry.reps) if (r.verdict !== "wrong" && r.itemId.includes("#")) out.add(r.itemId);
	}
	return out;
}

export function fastFor(seed = Date.now()): FastPlan {
	const lexicon = loadLexicon();
	if (!lexicon) return { items: [], known: 0 };
	const k = knownWords(lexicon);
	const progress = progressStore.read();
	const recent = new Set(fluencyStore.list().flatMap((e) => (e.mode === "fast" ? e.reps.map((r) => r.itemId) : [])).slice(-60));
	const items = pickKnown(
		lexicon.entries,
		{ resolve: (form) => resolveWord(lexicon, form, k.known), known: k.known, names: STORY_NAMES },
		{ seed, recent: new Set([...recent, ...progress.recent]), practised: practisedIds() },
	);
	return { items, known: k.known.size };
}

export interface FastResultInput {
	reps: FastRep[];
	ms?: number;
	tz?: number;
}

export interface FastOutcome {
	xp: number;
	passesMade: number;
	sentencesMade: number;
	total: number;
	summary: ProgressSummary;
	/** What to work on in pronunciation, across recent rounds and scenes. */
	report: PronReport;
}

export function recordFast(input: FastResultInput, now = new Date()): FastOutcome {
	const reps = input.reps.slice(0, 12);
	const passesMade = reps.reduce((n, r) => n + r.passes.filter((p) => p.made).length, 0);
	const sentencesMade = reps.filter((r) => r.passes.length >= FAST_PASSES && r.passes[r.passes.length - 1]!.made).length;
	const xp = fastXp(passesMade, sentencesMade, reps.length);
	const key = dayKey(now, input.tz);
	const p = progressStore.read();
	const day = (p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	day.fasts = (day.fasts ?? 0) + 1;
	day.reps += reps.length;
	day.xp += xp;
	if (input.ms && Number.isFinite(input.ms)) day.minutes = (day.minutes ?? 0) + Math.min(10, input.ms / 60_000);
	p.xp += xp;
	progressStore.write(p);
	const entry: FluencyLogEntry = { mode: "fast", at: now.toISOString(), day: key, ...(input.ms ? { ms: Math.round(input.ms) } : {}), reps, passesMade, sentencesMade, xp };
	fluencyStore.append(entry);
	try {
		appendLessonLog({
			id: `fast_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
			at: now.toISOString(),
			day: key,
			unit: "fast",
			mode: "fluency",
			ms: input.ms,
			xp,
			correct: sentencesMade,
			total: reps.length,
			perfect: reps.length > 0 && sentencesMade === reps.length,
			queued: [],
			reps: reps.map((r) => ({
				itemId: r.itemId,
				kind: "fast",
				unit: "fast",
				slug: r.slug,
				lemma: "",
				gloss: "",
				sentence: r.sentence,
				translation: r.translation,
				answer: r.sentence,
				given: r.passes.map((x) => x.heard ?? "").filter(Boolean).join(" / "),
				verdict: r.passes.length >= FAST_PASSES && r.passes[r.passes.length - 1]!.made ? "exact" : "wrong",
				assisted: false,
			})),
		});
	} catch (err) {
		console.warn("[fluency] could not append the lesson log:", err instanceof Error ? err.message : err);
	}
	return { xp, passesMade, sentencesMade, total: reps.length, summary: progressSummary(input.tz, now), report: pronunciationReport() };
}
