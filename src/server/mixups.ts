/**
 * Mix-ups service (src/core/mixups.ts): reads lesson and review answers
 * into the `mixups` record in progress.json, builds the Mix-ups lesson
 * (/lesson?mode=mixups) and puts an open mix-up's rule on the regular
 * lesson reps of its words.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import type { LessonPlan, RepVerdict } from "../core/lesson.ts";
import { buildMixupLesson, isReviewRetry, mixupEventOf, mixupLexicon, mixupRule, openMixupFor, tallyMixups, type MixupEvent } from "../core/mixups.ts";
import type { ReviewCard } from "../core/review.ts";
import { progressStore, type ProgressRecord } from "../store/progress.ts";
import { aspectFrames } from "./aspect-frames.ts";

function entries() {
	return loadLexicon()?.entries ?? [];
}

/** A lesson rep as the mix-up rules read it, or null when it does not count. */
export function lessonMixupEvent(
	rep: { slug: string; kind: string; first?: { given: string; verdict: RepVerdict; peeked?: boolean }; detail?: { answer?: string; sentence?: string; again?: boolean; unit?: string; task?: string } },
	at: string,
): MixupEvent | null {
	const d = rep.detail;
	if (!d?.answer || d.task || !rep.first || !mixupEventOf({ kind: rep.kind, again: d.again, first: rep.first })) return null;
	// A Dvojičky pick shows both words: a miss on it counts even where the family cannot drill the pair yet.
	const visible = d.unit?.startsWith("pairs-") === true;
	return { slug: rep.slug, answer: d.answer, given: rep.first.given, verdict: rep.first.verdict, sentence: d.sentence ?? "", at, ...(visible ? { visible: true } : {}) };
}

/** Count events into a progress record in place (the caller writes it). */
export function noteMixups(p: ProgressRecord, events: readonly MixupEvent[]): string[] {
	if (events.length === 0) return [];
	const list = entries();
	if (list.length === 0) return [];
	const { record, found } = tallyMixups(p.mixups ?? {}, events, mixupLexicon(list, aspectFrames()));
	p.mixups = record;
	return found;
}

/** A review answer, unless a hint came first or the card is being relearned
 *  after a miss (the first-try rule): its answer was just shown. */
export function noteReviewMixup(card: ReviewCard, given: string, verdict: RepVerdict, hints: number | undefined, now: Date): void {
	if (hints || isReviewRetry(card)) return;
	try {
		const p = progressStore.read();
		const before = JSON.stringify(p.mixups ?? {});
		noteMixups(p, [{ slug: card.slug, answer: card.answer, given, verdict, sentence: card.sentence, at: now.toISOString() }]);
		if (JSON.stringify(p.mixups ?? {}) !== before) progressStore.write(p);
	} catch (err) {
		console.warn("[mixups] could not record the review answer:", err instanceof Error ? err.message : err);
	}
}

/** The Mix-ups lesson: the open mix-ups and the probes on record. */
export function mixupLessonFor(seed = Date.now()): LessonPlan {
	const p = progressStore.read();
	return buildMixupLesson(entries(), p.mixups, { seed, recent: new Set(p.recent), frames: aspectFrames() });
}

/** An open mix-up's rule on each regular rep of its words that has none, so
 *  the contrast shows after a miss, where the confusion happens. A rep that
 *  names its form (item.form) keeps the unit's rule: the pair is about
 *  words, not endings. */
export function withOpenMixups<T extends LessonPlan>(plan: T): T {
	const record = progressStore.read().mixups;
	if (!record || plan.focus === "mixups") return plan;
	const lex = mixupLexicon(entries(), aspectFrames());
	for (const item of plan.items) {
		if (item.pair || item.form) continue;
		const open = openMixupFor(record, item.slug);
		if (open) item.pair = { id: open.key, ...mixupRule(open, lex) };
	}
	return plan;
}
