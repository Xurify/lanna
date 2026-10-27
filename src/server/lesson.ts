/**
 * Lesson + progress service (LangHarness redesign) — behind /lesson,
 * /api/lesson and /api/progress. Lessons are built locally from the
 * lexicon (core/lesson.ts), so a rep never waits on a model. Finishing a
 * lesson records XP and the day, and every missed word goes into the
 * spaced-review deck, so the lesson and the review loop feed each other.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import {
	buildBlitz,
	buildLesson,
	LESSON_BONUS,
	levelProgress,
	PERFECT_BONUS,
	repXp,
	streakOf,
	unitLevel,
	UNITS,
	xpLevel,
	type ItemKind,
	type LessonPlan,
	type RepVerdict,
	type UnitId,
} from "../core/lesson.ts";
import { dayKey } from "../core/review.ts";
import { progressStore, type DayRecord, type ProgressRecord } from "../store/progress.ts";
import { enqueueWords, reviewStatus } from "./review.ts";

const RECENT_CAP = 240;

function entries() {
	return loadLexicon()?.entries ?? [];
}

export function lessonFor(unit: UnitId, seed = Date.now()): LessonPlan {
	const progress = progressStore.read();
	return buildLesson(entries(), unit, { seed, recent: new Set(progress.recent) });
}

/** Blitz runs over the units you have started (at least the first three). */
export function blitzFor(seed = Date.now()): LessonPlan {
	const progress = progressStore.read();
	const started = UNITS.filter((u) => u.id !== "words" && (progress.units[u.id]?.lessons ?? 0) > 0).map((u) => u.id);
	const units = started.length >= 2 ? started : (["present", "acc-fem", "loc"] as UnitId[]);
	return buildBlitz(entries(), units, seed);
}

export interface RepResult {
	itemId: string;
	slug: string;
	kind: ItemKind;
	verdict: RepVerdict;
}

export interface LessonResultInput {
	unit: UnitId;
	mode: "lesson" | "blitz";
	reps: RepResult[];
	ms?: number;
	tz?: number;
}

export interface LessonOutcome {
	xp: number;
	correct: number;
	total: number;
	perfect: boolean;
	/** Missed words now queued in the review deck. */
	queued: string[];
	newBest?: number;
	summary: ProgressSummary;
}

function today(tz?: number, now = new Date()) {
	return dayKey(now, tz);
}

function dayOf(p: ProgressRecord, key: string): DayRecord {
	p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 };
	return p.days[key]!;
}

export function recordLesson(input: LessonResultInput, now = new Date()): LessonOutcome {
	const p = progressStore.read();
	const day = dayOf(p, today(input.tz, now));
	let combo = 0;
	let xp = 0;
	let correct = 0;
	for (const r of input.reps) {
		if (r.verdict === "wrong") combo = 0;
		else {
			combo++;
			correct++;
		}
		xp += repXp(r.kind, r.verdict, combo);
	}
	const total = input.reps.length;
	const perfect = total > 0 && input.reps.every((r) => r.verdict === "exact");
	const unit = (p.units[input.unit] ??= { lessons: 0, reps: 0, correct: 0 });
	let newBest: number | undefined;
	if (input.mode === "lesson") {
		if (total > 0) xp += LESSON_BONUS + (perfect ? PERFECT_BONUS : 0);
		unit.lessons++;
		day.lessons++;
	} else {
		if (correct > (p.bestBlitz ?? 0)) {
			p.bestBlitz = correct;
			newBest = correct;
		}
	}
	unit.reps += total;
	unit.correct += correct;
	unit.lastAt = now.toISOString();
	day.reps += total;
	day.xp += xp;
	p.xp += xp;
	p.recent = [...p.recent, ...input.reps.map((r) => r.itemId)].slice(-RECENT_CAP);
	progressStore.write(p);
	// Every miss goes to the review deck — the lesson and the deck feed each other.
	const missed = [...new Set(input.reps.filter((r) => r.verdict !== "exact").map((r) => r.slug))];
	const queued = missed.length ? enqueueWords(missed, now) : [];
	return { xp, correct, total, perfect, queued, newBest, summary: progressSummary(input.tz, now) };
}

/** A review answer counts toward XP and the day (called by /api/review). */
export function recordReviewXp(verdict: RepVerdict, tz?: number, now = new Date()): number {
	const p = progressStore.read();
	const day = dayOf(p, today(tz, now));
	const xp = verdict === "exact" ? 8 : verdict === "accents" ? 4 : 1;
	day.xp += xp;
	day.reviews++;
	p.xp += xp;
	progressStore.write(p);
	return xp;
}

export interface UnitSummary {
	id: UnitId;
	title: string;
	tagline: string;
	glyph: string;
	rule: string;
	lessons: number;
	level: number;
	progress: number;
	accuracy: number | null;
}

export interface ProgressSummary {
	xp: number;
	level: { level: number; into: number; span: number };
	todayXp: number;
	dailyGoal: number;
	streak: { days: number; restUsed: boolean; activeToday: boolean };
	/** The last 7 days, oldest first, for the week strip. */
	week: Array<{ day: string; xp: number }>;
	units: UnitSummary[];
	/** The unit the Continue button opens. */
	next: UnitId;
	bestBlitz: number;
	review: { due: number; newLeft: number; total: number; available: boolean };
}

export function progressSummary(tz?: number, now = new Date()): ProgressSummary {
	const p = progressStore.read();
	const key = today(tz, now);
	const active = new Set(Object.entries(p.days).filter(([, d]) => d.xp > 0).map(([k]) => k));
	const week: Array<{ day: string; xp: number }> = [];
	for (let i = 6; i >= 0; i--) {
		const d = dayKey(new Date(now.getTime() - i * 86_400_000), tz);
		week.push({ day: d, xp: p.days[d]?.xp ?? 0 });
	}
	const units: UnitSummary[] = UNITS.map((u) => {
		const r = p.units[u.id];
		const lessons = r?.lessons ?? 0;
		return {
			id: u.id,
			title: u.title,
			tagline: u.tagline,
			glyph: u.glyph,
			rule: u.rule,
			lessons,
			level: unitLevel(lessons),
			progress: levelProgress(lessons),
			accuracy: r && r.reps > 0 ? r.correct / r.reps : null,
		};
	});
	// Continue = the first grammar unit below level 2, else the least-practised
	// one. "First words" stays on the path but is never the default: the
	// placement showed reading ahead of production, so the work is endings.
	const grammar = units.filter((u) => u.id !== "words");
	const next = (grammar.find((u) => u.level < 2) ?? [...grammar].sort((a, b) => a.lessons - b.lessons)[0]!).id;
	const rs = reviewStatus(now, tz, { mint: false });
	return {
		xp: p.xp,
		level: xpLevel(p.xp),
		todayXp: p.days[key]?.xp ?? 0,
		dailyGoal: p.dailyGoal,
		streak: streakOf(active, key),
		week,
		units,
		next,
		bestBlitz: p.bestBlitz ?? 0,
		review: {
			due: rs.counts.due + rs.counts.learning,
			newLeft: rs.counts.newLeft,
			total: rs.counts.total,
			available: rs.available,
		},
	};
}

export function setDailyGoal(goal: number): ProgressSummary {
	const p = progressStore.read();
	if (Number.isFinite(goal)) p.dailyGoal = Math.max(10, Math.min(500, Math.round(goal)));
	progressStore.write(p);
	return progressSummary();
}
