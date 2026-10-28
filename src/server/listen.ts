/**
 * Listen service (LangHarness, 2026-10-28) — behind /listen and
 * /api/listen. The session is built locally from the dictionary against
 * the learner's known words (the same estimate the Read task uses, so the
 * two input tasks agree on what "known" means), so no rep waits on a
 * model and nothing is paid for except the audio, which the TTS library
 * caches once per sentence. Finishing records the day's listening, XP and
 * minutes, sends the stretch words to the review deck (their next
 * meetings, spaced) and logs every sentence and answer to the corpus.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import { listenXp, pickListen, sessionCoverage, type ListenPlan } from "../core/listen.ts";
import { dayKey } from "../core/review.ts";
import { appendLessonLog } from "../store/corpus.ts";
import { progressStore } from "../store/progress.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { knownWords, resolveWord, STORY_NAMES } from "./reading.ts";
import { enqueueWords } from "./review.ts";

const RECENT_CAP = 240;

export function listenFor(seed = Date.now()): ListenPlan {
	const lexicon = loadLexicon();
	if (!lexicon) return { items: [], known: 0, coverage: 1 };
	const k = knownWords(lexicon);
	const progress = progressStore.read();
	const items = pickListen(
		lexicon.entries,
		{
			resolve: (form) => resolveWord(lexicon, form, k.known),
			known: k.known,
			names: STORY_NAMES,
		},
		{ seed, recent: new Set(progress.recent) },
	);
	return { items, known: k.known.size, coverage: Math.round(sessionCoverage(items) * 1000) / 1000 };
}

export interface ListenRep {
	itemId: string;
	slug: string;
	lemma: string;
	gloss: string;
	sentence: string;
	translation: string;
	/** The meaning picked. */
	given: string;
	verdict: "exact" | "wrong";
	options?: string[];
	/** Dictionary slugs of the sentence's stretch words. */
	stretch: string[];
}

export interface ListenResultInput {
	reps: ListenRep[];
	ms?: number;
	tz?: number;
}

export interface ListenOutcome {
	xp: number;
	correct: number;
	total: number;
	/** Stretch words now in the review deck. */
	queued: string[];
	summary: ProgressSummary;
}

export function recordListen(input: ListenResultInput, now = new Date()): ListenOutcome {
	const p = progressStore.read();
	const key = dayKey(now, input.tz);
	const day = (p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	const total = input.reps.length;
	const correct = input.reps.filter((r) => r.verdict === "exact").length;
	const xp = listenXp(correct, total);
	day.listens = (day.listens ?? 0) + 1;
	day.reps += total;
	day.xp += xp;
	if (input.ms && Number.isFinite(input.ms)) day.minutes = (day.minutes ?? 0) + Math.min(20, input.ms / 60_000);
	p.xp += xp;
	p.recent = [...p.recent, ...input.reps.map((r) => r.itemId)].slice(-RECENT_CAP);
	progressStore.write(p);
	// Every stretch word was met once in context; the deck schedules the
	// next meetings. A sentence whose meaning was missed queues its word too.
	const slugs = [...new Set([...input.reps.flatMap((r) => r.stretch), ...input.reps.filter((r) => r.verdict === "wrong").map((r) => r.slug)])].filter((s) => /^[a-z0-9-]+$/.test(s));
	const queued = slugs.length ? enqueueWords(slugs, now) : [];
	try {
		appendLessonLog({
			id: `listen_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
			at: now.toISOString(),
			day: key,
			unit: "listen",
			mode: "listen",
			ms: input.ms,
			xp,
			correct,
			total,
			perfect: total > 0 && correct === total,
			queued,
			reps: input.reps.map((r) => ({
				itemId: r.itemId,
				kind: "meaning",
				unit: "listen",
				slug: r.slug,
				lemma: r.lemma,
				gloss: r.gloss,
				sentence: r.sentence,
				translation: r.translation,
				answer: r.translation,
				given: r.given,
				verdict: r.verdict,
				assisted: false,
				...(r.options ? { options: r.options } : {}),
			})),
		});
	} catch (err) {
		console.warn("[listen] could not append the lesson log:", err instanceof Error ? err.message : err);
	}
	return { xp, correct, total, queued, summary: progressSummary(input.tz, now) };
}
