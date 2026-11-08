/**
 * The stamp book's evidence and record (LangHarness, 2026-11-02; E31).
 * Gathers what the stamps are judged on from the progress record, the
 * review deck and the story log, judges every stamp (src/core/stamps.ts)
 * and writes the newly earned ones into progress.json with the day, so a
 * stamp keeps its date and is never earned twice.
 */

import { classifyWordState, examSummaries, hoursDone, longestStreak, newStamps, nextStamps, recentStamps, stampCatalog, stampStates, STRANDS, type CurriculumState, type StampEvidence, type StampState, type StrandBalance, type TrailLog } from "../core/index.ts";
import type { ProgressRecord } from "../store/progress.ts";
import { reviewStore } from "../store/review.ts";
import { storyStore } from "../store/stories.ts";

/** A week counts as balanced from this many minutes, each strand at this share. */
const BALANCED_WEEK_MINUTES = 60;
const BALANCED_STRAND_SHARE = 0.15;

export interface StampReport {
	/** Every stamp, book order: summits, chapters, then the deeds. */
	all: StampState[];
	earned: number;
	total: number;
	/** The last three earned, newest first. */
	recent: StampState[];
	/** The three closest to being earned. */
	next: StampState[];
}

/** The evidence and the trail log, from what is on record. */
export function stampEvidence(p: ProgressRecord, curriculum: CurriculumState, balance: StrandBalance, streakDays: number, activeDays: ReadonlySet<string>): { evidence: StampEvidence; log: TrailLog } {
	const days = Object.values(p.days);
	const sum = (pick: (d: (typeof days)[number]) => number | undefined) => days.reduce((n, d) => n + (pick(d) ?? 0), 0);
	let cards: Array<{ state: "new" | "learning" | "review"; reps?: number; lapses?: number; memory?: { stability?: number }; suspended?: boolean }> = [];
	try {
		cards = Object.values(reviewStore.readCards()).filter((c) => !c.suspended);
	} catch {
		cards = [];
	}
	let wordsKnown = 0;
	let comebacks = 0;
	for (const c of cards) {
		if (classifyWordState(c) !== "mastered") continue;
		wordsKnown++;
		if ((c.lapses ?? 0) > 0) comebacks++;
	}
	let storiesRead = 0;
	try {
		storiesRead = storyStore.reads().length;
	} catch {
		storiesRead = 0;
	}
	const chapters = new Map<string, number>();
	const perStage = new Map<string, { done: number; total: number }>();
	for (const ch of curriculum.chapters) {
		chapters.set(ch.id, ch.done ? 1 : ch.total > 0 ? Math.min(0.99, ch.doneCount / ch.total) : 0);
		const st = perStage.get(ch.stage) ?? { done: 0, total: 0 };
		st.total++;
		if (ch.done) st.done++;
		perStage.set(ch.stage, st);
	}
	const stages = new Map<string, number>();
	for (const [id, st] of perStage) stages.set(id, st.total > 0 ? st.done / st.total : 0);
	const hours = Math.round(hoursDone(curriculum) * 100) / 100;
	const evidence: StampEvidence = {
		lessons: sum((d) => d.lessons),
		streakDays,
		wordsKnown,
		reviews: sum((d) => d.reviews),
		perfectLessons: sum((d) => d.perfect),
		comebacks,
		balancedWeek: balance.total >= BALANCED_WEEK_MINUTES && STRANDS.every((s) => balance.share[s.id] >= BALANCED_STRAND_SHARE),
		storiesRead,
		scenesSpoken: sum((d) => d.speaks),
		listens: sum((d) => d.listens),
		bestBlitz: p.bestBlitz ?? 0,
		hoursDone: hours,
		examsPassed: Object.values(examSummaries(p.exams)).filter((s) => s.best?.passed).length,
		chapters,
		stages,
	};
	const log: TrailLog = {
		hours,
		minutes: Math.round(sum((d) => d.minutes)),
		wordsKnown,
		daysActive: activeDays.size,
		longestStreak: Math.max(longestStreak(activeDays), streakDays),
		lessons: evidence.lessons,
		reviews: evidence.reviews,
		stories: storiesRead,
		scenes: evidence.scenesSpoken,
		listens: evidence.listens,
		bestBlitz: evidence.bestBlitz,
	};
	return { evidence, log };
}

/** Judge every stamp and put the newly earned ones on record (in `p`,
 *  which the caller writes). */
export function syncStamps(p: ProgressRecord, curriculum: CurriculumState, evidence: StampEvidence, today: string): { report: StampReport; minted: StampState[] } {
	const before = p.stamps ?? {};
	const all = stampStates(stampCatalog(curriculum), evidence, before, today);
	const minted = newStamps(all, before);
	if (minted.length) p.stamps = { ...before, ...Object.fromEntries(minted.map((s) => [s.id, today])) };
	const earned = all.filter((s) => s.earned).length;
	return { report: { all, earned, total: all.length, recent: recentStamps(all), next: nextStamps(all) }, minted };
}
