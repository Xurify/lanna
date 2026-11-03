/**
 * Listen service (LangHarness, 2026-10-28) — behind /listen and
 * /api/listen. The session is built locally from the dictionary against
 * the learner's known words (the same estimate the Read task uses, so the
 * two input tasks agree on what "known" means), so no rep waits on a
 * model and nothing is paid for except the audio, which the TTS library
 * caches once per sentence, and a near-miss wrong meaning for the rare
 * sentence the dictionary has no close one for (distractors.ts, asked for
 * before the session starts, kept on disk). Finishing records the day's listening, XP and
 * minutes, sends the stretch words to the review deck (their next
 * meetings, spaced) and logs every sentence and answer to the corpus.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import { almostCount, judgeTyped, listenXp, pickListen, sessionCoverage, understood, type ListenAnswer, type ListenPlan, type ListenVerdict } from "../core/listen.ts";
import { addMinutes, sessionMs } from "../core/active-time.ts";
import { dayKey } from "../core/review.ts";
import { appendLessonLog } from "../store/corpus.ts";
import { progressStore } from "../store/progress.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { knownWords, resolveWord, STORY_NAMES } from "./reading.ts";
import { enqueueWords } from "./review.ts";
import { refreshSnapshotIfStale } from "./mistakes-snapshot.ts";

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
	/** The meaning picked, or the Slovak typed (type answers). */
	given: string;
	verdict: ListenVerdict;
	/** How it was answered (default "pick"). A typed answer is graded
	 *  again here from the sentence, never taken on the client's word. */
	answer?: ListenAnswer;
	options?: string[];
	/** Dictionary slugs of the sentence's stretch words. */
	stretch: string[];
	/** Timing, for the speed model (src/core/milestones.ts): sentence
	 *  shown → meaning picked, the first playback's length, plays after
	 *  it, whether the text was shown first, and the sentence's words. */
	ms?: number;
	heardMs?: number;
	replays?: number;
	peeked?: boolean;
	words?: number;
	/** The stretch words as they stand in the sentence (the slugs are `stretch`). */
	stretchText?: string[];
}

export interface ListenResultInput {
	reps: ListenRep[];
	ms?: number;
	/** Active milliseconds since the last send (src/core/active-time.ts). */
	activeMs?: number;
	tz?: number;
}

export interface ListenOutcome {
	xp: number;
	correct: number;
	/** Typed sentences with only a missing accent (half XP, not understood). */
	almost: number;
	total: number;
	/** Stretch words now in the review deck. */
	queued: string[];
	summary: ProgressSummary;
}

export function recordListen(input: ListenResultInput, now = new Date()): ListenOutcome {
	const p = progressStore.read();
	const key = dayKey(now, input.tz);
	const day = (p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	// Typed sentences are graded here, against the sentence this server
	// served; the client's verdict for them is ignored.
	const reps = input.reps.map((r) => (r.answer === "type" ? { ...r, verdict: judgeTyped(r.given, r.sentence) } : r));
	const total = reps.length;
	const correct = understood(reps);
	const almost = almostCount(reps);
	const xp = listenXp(correct, total, almost);
	day.listens = (day.listens ?? 0) + 1;
	day.reps += total;
	day.xp += xp;
	addMinutes(day, "listen", sessionMs(input));
	p.xp += xp;
	p.recent = [...p.recent, ...reps.map((r) => r.itemId)].slice(-RECENT_CAP);
	progressStore.write(p);
	// Every stretch word was met once in context; the deck schedules the
	// next meetings. A sentence whose meaning was missed queues its word too.
	const slugs = [...new Set([...reps.flatMap((r) => r.stretch), ...reps.filter((r) => r.verdict === "wrong").map((r) => r.slug)])].filter((s) => /^[a-z0-9-]+$/.test(s));
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
			reps: reps.map((r) => ({
				itemId: r.itemId,
				// A typed sentence is a dictation, so the speed model skips it
				// (typing time is not listening time; src/server/milestones.ts).
				kind: r.answer === "type" ? "dictation" : "meaning",
				unit: "listen",
				slug: r.slug,
				lemma: r.lemma,
				gloss: r.gloss,
				sentence: r.sentence,
				translation: r.translation,
				answer: r.answer === "type" ? r.sentence : r.translation,
				given: r.given,
				verdict: r.verdict,
				assisted: false,
				...(r.answer !== "type" && r.options ? { options: r.options } : {}),
				...(r.ms !== undefined ? { ms: r.ms } : {}),
				...(r.heardMs !== undefined ? { heardMs: r.heardMs } : {}),
				...(r.replays !== undefined ? { replays: r.replays } : {}),
				...(r.peeked !== undefined ? { peeked: r.peeked } : {}),
				...(r.words !== undefined ? { words: r.words } : {}),
				...(r.stretchText !== undefined ? { stretch: r.stretchText } : {}),
			})),
		});
	} catch (err) {
		console.warn("[listen] could not append the lesson log:", err instanceof Error ? err.message : err);
	}
	// The listening trends on My mistakes read the log, so the saved snapshot is renewed when it is old.
	refreshSnapshotIfStale(now);
	return { xp, correct, almost, total, queued, summary: progressSummary(input.tz, now) };
}
