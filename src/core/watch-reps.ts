/**
 * Watch lines that come back in Listen (LangHarness, 2026-11-05; proposal 7
 * in docs/research/creator-hooks.md). A line the learner did not understand
 * on the first unaided listen in Watch is kept, and Listen plays it again
 * over the next days until it has been understood three times.
 *
 * A new line is at step 0, due tomorrow. An understood answer (exact and not
 * peeked, as understood() in listen.ts counts it) moves the line to the next
 * step, due in 3 days and then in 7; the understood answer at the 7-day check
 * retires it. An accents-only answer keeps the step and is due tomorrow. A
 * miss, or a peeked answer, resets the line to step 0, due tomorrow.
 *
 * Pure. The store is src/store/watch-reps.ts; the session is built in
 * src/server/listen.ts.
 */

import { tokenize } from "./reading.ts";
import { understood, type ListenItem, type ListenVerdict } from "./listen.ts";

/** Days until a line is due at each step: the miss is shown tomorrow (step 0),
 *  and each understood answer moves it to the next step's gap. */
const WATCH_REP_GAPS = [1, 3, 7] as const;
export type WatchStep = 0 | 1 | 2;
const LAST_STEP = (WATCH_REP_GAPS.length - 1) as WatchStep;
const TOMORROW = WATCH_REP_GAPS[0];
/** Most watch lines in one Listen session. */
export const WATCH_REP_PER_SESSION = 3;
const ITEM_PREFIX = "watch:";

export interface WatchRep {
	/** `<videoId>:<segment index>`: one entry per line. */
	id: string;
	/** The line in the video's language, as captioned. */
	text: string;
	/** The English translation, when the video has one. */
	en?: string;
	videoId: string;
	title: string;
	/** The day key the line was missed. */
	added: string;
	step: WatchStep;
	/** The day key the line is next due. */
	due: string;
	/** ISO time the line was understood for the last time. */
	retiredAt?: string;
}

function watchRepId(videoId: string, segment: number): string {
	return `${videoId}:${segment}`;
}

function watchItemId(repId: string): string {
	return `${ITEM_PREFIX}${repId}`;
}

export function isWatchItem(itemId: string): boolean {
	return itemId.startsWith(ITEM_PREFIX);
}

export function watchRepOfItem(itemId: string): string {
	return itemId.slice(ITEM_PREFIX.length);
}

/** The day key `days` after `day` (both YYYY-MM-DD). */
export function dayAfter(day: string, days: number): string {
	return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The lines of a finished watching not understood on the first unaided
 *  listen. Watch's `got` is "first" only for a line heard once with no help;
 *  "after" needed a replay, a slow play or the text, and "no" was not
 *  understood. A line with no text is skipped. */
export function missedWatchReps(
	video: { id: string; title: string; segments: readonly { i: number; sk: string; en: string }[] },
	stats: readonly { i: number; got: "first" | "after" | "no" }[],
	day: string,
): WatchRep[] {
	const out: WatchRep[] = [];
	for (const s of stats) {
		if (s.got === "first") continue;
		const seg = video.segments.find((x) => x.i === s.i);
		const text = seg?.sk.trim();
		if (!seg || !text) continue;
		const en = seg.en.trim();
		out.push({
			id: watchRepId(video.id, seg.i),
			text,
			...(en ? { en } : {}),
			videoId: video.id,
			title: video.title,
			added: day,
			step: 0,
			due: dayAfter(day, TOMORROW),
		});
	}
	return out;
}

/** The line after one answer. A peeked answer is a miss, as understood() does
 *  not count it; an accents-only answer keeps the step. */
export function scheduleWatchRep(
	rep: WatchRep,
	answer: { verdict: ListenVerdict; peeked?: boolean },
	now: { day: string; at: string },
): WatchRep {
	if (understood([answer]) > 0) {
		if (rep.step >= LAST_STEP) return { ...rep, retiredAt: now.at };
		const step = (rep.step + 1) as WatchStep;
		return { ...rep, step, due: dayAfter(now.day, WATCH_REP_GAPS[step]) };
	}
	if (answer.verdict === "accents" && !answer.peeked) return { ...rep, due: dayAfter(now.day, TOMORROW) };
	return { ...rep, step: 0, due: dayAfter(now.day, TOMORROW) };
}

const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

export function dueWatchReps(reps: readonly WatchRep[], day: string, max = WATCH_REP_PER_SESSION): WatchRep[] {
	return reps
		.filter((r) => !r.retiredAt && r.due <= day)
		.sort((a, b) => cmp(a.due, b.due) || cmp(a.added, b.added) || cmp(a.id, b.id))
		.slice(0, max);
}

/** Coverage is assumed, not measured: a missed line may hold words the learner does not know. */
export function watchListenItem(rep: WatchRep): ListenItem {
	const words = tokenize(rep.text).filter((t) => t.word && !/^\p{N}+$/u.test(t.text)).length;
	return {
		id: watchItemId(rep.id),
		slug: "",
		lemma: "",
		gloss: "",
		sentence: rep.text,
		translation: rep.en ?? "",
		options: [],
		stretch: [],
		coverage: 1,
		words,
		source: { kind: "watch", title: rep.title },
	};
}
