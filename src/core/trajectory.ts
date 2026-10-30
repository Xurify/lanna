/**
 * The trajectory (LangHarness, 2026-10-29) — where the learner will be if
 * they keep this pace: the past drawn from the day records, the future
 * drawn forward at a pace, on one of three measures (hours toward the
 * level, units done, words met). Pure and browser-safe; the Today card and
 * the hours sheet only draw what this returns.
 *
 * The past is reconstructed, not stored: the value now is spread over the
 * days by each day's share of the activity (minutes for hours, lessons for
 * units). Words are the exception: only real daily snapshots count, so the
 * line is "not ready" until a week of them exists.
 */

import { MIN_PACE_DAYS, PACE_WINDOW_DAYS } from "./curriculum.ts";

export type TrajectoryMetric = "hours" | "units" | "words";

export const TRAJECTORY_METRICS: ReadonlyArray<{ id: TrajectoryMetric; title: string; unit: string }> = [
	{ id: "hours", title: "Hours", unit: "h" },
	{ id: "units", title: "Units", unit: "units" },
	{ id: "words", title: "Words", unit: "words" },
];

/** Snapshots a words line needs before it is drawn. */
export const MIN_WORD_SNAPSHOTS = 7;

export interface TrajectoryDay {
	day: string;
	minutes: number;
	/** Lessons finished that day, over all units. */
	lessons: number;
	/** Words met at the end of the day, null before snapshots were kept. */
	words: number | null;
}

export interface TrajectoryInput {
	/** Consecutive calendar days, oldest first, ending today. */
	days: readonly TrajectoryDay[];
	hoursDone: number;
	/** Hours the target level asks for (GUIDED_HOURS). */
	hoursTarget: number;
	unitsDone: number;
	unitsTotal: number;
	wordsNow: number | null;
	goalMinutes: number;
	goalDays: number;
}

export interface TrajectoryPace {
	/** On a day the learner studies. */
	minutesPerDay: number;
	daysPerWeek: number;
	/** From the last 14 days (true) or from the saved goal (false). */
	measured: boolean;
}

export interface TrajectoryPoint {
	/** Days from today: negative is the past. */
	day: number;
	value: number;
}

export interface Trajectory {
	metric: TrajectoryMetric;
	/** False while there is not enough history to draw this measure. */
	ready: boolean;
	now: number;
	past: TrajectoryPoint[];
	future: TrajectoryPoint[];
	/** Gain per calendar day at the pace. */
	ratePerDay: number;
	target: number | null;
	/** Days from today until the target, 0 when already there, null when never at this pace. */
	daysToTarget: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The pace of the last 14 days, or the goal's until a week of study is on record. */
export function measuredPace(days: readonly TrajectoryDay[], goalMinutes: number, goalDays: number): TrajectoryPace {
	const recent = days.slice(-PACE_WINDOW_DAYS);
	const active = recent.filter((d) => d.minutes > 0);
	if (recent.length >= PACE_WINDOW_DAYS && active.length >= MIN_PACE_DAYS) {
		const sum = active.reduce((n, d) => n + d.minutes, 0);
		return { minutesPerDay: Math.max(1, Math.round(sum / active.length)), daysPerWeek: round1((active.length / recent.length) * 7), measured: true };
	}
	return { minutesPerDay: goalMinutes, daysPerWeek: goalDays, measured: false };
}

function cumulative(days: readonly TrajectoryDay[], pick: (d: TrajectoryDay) => number): number[] {
	let c = 0;
	return days.map((d) => (c += pick(d)));
}

/** Days until `target` at `ratePerDay`: 0 when already there, null when it never gets there. */
export function daysToReach(now: number, ratePerDay: number, target: number): number | null {
	if (now >= target) return 0;
	if (ratePerDay <= 0) return null;
	return Math.ceil((target - now) / ratePerDay);
}

/** How far to draw: a little past the target, bounded; a flat pace draws a quarter. */
export function horizonDays(daysToTarget: number | null): number {
	if (daysToTarget === null) return 90;
	return Math.min(730, Math.max(60, Math.ceil(daysToTarget * 1.15)));
}

export function trajectory(input: TrajectoryInput, metric: TrajectoryMetric, pace: Pick<TrajectoryPace, "minutesPerDay" | "daysPerWeek">, horizon?: number): Trajectory {
	const days = input.days;
	const n = days.length;
	const hoursPerDay = (pace.minutesPerDay / 60) * (pace.daysPerWeek / 7);
	const recent = days.slice(-PACE_WINDOW_DAYS);
	const recentHours = recent.reduce((s, d) => s + d.minutes, 0) / 60;
	const totalHours = days.reduce((s, d) => s + d.minutes, 0) / 60;

	let now = 0;
	let perHour = 0;
	let ready = true;
	let past: TrajectoryPoint[] = [];
	let target: number | null = null;
	let cap = Number.POSITIVE_INFINITY;

	if (metric === "hours") {
		now = input.hoursDone;
		perHour = 1;
		target = input.hoursTarget;
		const c = cumulative(days, (d) => d.minutes);
		const total = c[n - 1] ?? 0;
		past = total > 0 ? c.map((v, i) => ({ day: i - (n - 1), value: (now * v) / total })) : [{ day: 0, value: now }];
	} else if (metric === "units") {
		now = input.unitsDone;
		target = input.unitsTotal;
		cap = input.unitsTotal;
		const c = cumulative(days, (d) => d.lessons);
		const total = c[n - 1] ?? 0;
		if (total <= 0) {
			ready = false;
			past = [{ day: 0, value: now }];
		} else {
			past = c.map((v, i) => ({ day: i - (n - 1), value: (now * v) / total }));
			const recentLessons = recent.reduce((s, d) => s + d.lessons, 0);
			const lessonsPerHour = recentHours > 0 && recentLessons > 0 ? recentLessons / recentHours : totalHours > 0 ? total / totalHours : 0;
			perHour = (now / total) * lessonsPerHour;
		}
	} else {
		const snaps = days.map((d, i) => ({ i, d })).filter((x): x is { i: number; d: TrajectoryDay & { words: number } } => x.d.words !== null);
		now = input.wordsNow ?? snaps.at(-1)?.d.words ?? 0;
		past = snaps.map((x) => ({ day: x.i - (n - 1), value: x.d.words }));
		if (snaps.length < MIN_WORD_SNAPSHOTS) {
			ready = false;
		} else {
			const first = snaps[0]!;
			const last = snaps.at(-1)!;
			const spanHours = days.slice(first.i + 1, last.i + 1).reduce((s, d) => s + d.minutes, 0) / 60;
			perHour = spanHours > 0 ? Math.max(0, (last.d.words - first.d.words) / spanHours) : 0;
		}
	}

	const ratePerDay = ready ? perHour * hoursPerDay : 0;
	const daysTo = ready && target !== null ? daysToReach(now, ratePerDay, target) : null;
	const span = horizon ?? horizonDays(daysTo);
	const step = Math.max(1, Math.ceil(span / 120));
	const future: TrajectoryPoint[] = [];
	if (ready) {
		for (let t = 0; t < span; t += step) future.push({ day: t, value: Math.min(cap, now + ratePerDay * t) });
		future.push({ day: span, value: Math.min(cap, now + ratePerDay * span) });
	}
	return { metric, ready, now, past, future, ratePerDay, target, daysToTarget: daysTo };
}
