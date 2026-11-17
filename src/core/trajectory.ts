/**
 * The trajectory (2026-10-29) — where the learner will be if
 * they keep this pace: the past drawn from the day records, the future
 * drawn forward at a pace, on one of three measures (hours toward the
 * level, units done, words met). Pure and browser-safe; the Today card and
 * the hours sheet only draw what this returns.
 *
 * Each day record keeps a snapshot of the three measures (hours the map
 * credits, units done, words met), so the past is what happened, jumps
 * included (a placement check credits a stretch of the map in one day).
 * Days from before the snapshots are reconstructed from the day's share of
 * the activity and scaled to meet the first real snapshot.
 *
 * The future uses the credited gain per practice hour, measured over the
 * recent days (minus the days of a placement check, which is a measurement,
 * not practice). Until there is enough history to measure it, hours assume
 * one credited hour per practice hour and units fall back to lessons per
 * hour; words wait for a week of snapshots.
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
/** The window the credited rate is measured over, before falling back to all history. */
const RATE_WINDOW_DAYS = 28;
/** A measured rate needs at least this many days between its first and last snapshot... */
const MIN_RATE_SPAN_DAYS = 7;
/** ...and at least this many practice hours inside them. */
const MIN_RATE_HOURS = 1;

export interface TrajectoryDay {
	day: string;
	minutes: number;
	/** Lessons finished that day, over all units. */
	lessons: number;
	/** Snapshots at the end of the day; null on days before they were kept. */
	hours: number | null;
	units: number | null;
	words: number | null;
	/** The day had a placement check: its jump is a measurement, not practice. */
	placed?: boolean;
}

export interface TrajectoryInput {
	/** Consecutive calendar days, oldest first, ending today. */
	days: readonly TrajectoryDay[];
	hoursDone: number;
	/** Hours the target level asks for (GUIDED_HOURS). */
	hoursTarget: number;
	/** Units done on the whole map, so a change of target never moves the past. */
	unitsDone: number;
	/** Units up to the target level. */
	unitsTotal: number;
	wordsNow: number | null;
	goalMinutes: number;
	goalDays: number;
}

interface TrajectoryPace {
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
	/** Gain per hour of practice: measured from the recent days, or assumed until they say. */
	perPracticeHour: number;
	basis: "measured" | "assumed";
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
		return {
			minutesPerDay: Math.max(1, Math.round(sum / active.length)),
			daysPerWeek: round1((active.length / recent.length) * 7),
			measured: true,
		};
	}
	return { minutesPerDay: goalMinutes, daysPerWeek: goalDays, measured: false };
}

function cumulative(days: readonly TrajectoryDay[], pick: (d: TrajectoryDay) => number): number[] {
	let c = 0;
	return days.map((d) => (c += pick(d)));
}

/** Each day's value, or the last one before it; null before the first. */
function carryForward(values: ReadonlyArray<number | null>): Array<number | null> {
	let last: number | null = null;
	return values.map((v) => (last = v ?? last));
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

/** The past: real snapshots (carried over days between them), reconstructed
 *  from the activity before the first one, or from the value now when there
 *  are none. Words are never reconstructed. */
function buildPast(
	days: readonly TrajectoryDay[],
	snaps: ReadonlyArray<number | null>,
	activity: (d: TrajectoryDay) => number,
	now: number,
	reconstruct: boolean,
	carry: boolean,
): TrajectoryPoint[] {
	const n = days.length;
	const at = (i: number) => i - (n - 1);
	const first = snaps.findIndex((v) => v !== null);
	const c = cumulative(days, activity);
	if (first < 0) {
		if (!reconstruct) return [];
		const total = c[n - 1] ?? 0;
		return total > 0 ? c.map((v, i) => ({ day: at(i), value: (now * v) / total })) : [{ day: 0, value: now }];
	}
	const points: TrajectoryPoint[] = [];
	const anchor = snaps[first]!;
	if (reconstruct && (c[first] ?? 0) > 0)
		for (let i = 0; i < first; i++) points.push({ day: at(i), value: (anchor * c[i]!) / c[first]! });
	const carried = carryForward(snaps);
	for (let i = first; i < n; i++) {
		const v = carry ? carried[i] : snaps[i];
		if (v !== null && v !== undefined) points.push({ day: at(i), value: v });
	}
	return points;
}

/** Gain per practice hour from `from` on: the rises between the snapshots,
 *  over the minutes practiced in the same days, placement days left out. */
function creditedRate(
	days: readonly TrajectoryDay[],
	snaps: ReadonlyArray<number | null>,
	from: number,
): number | null {
	const carried = carryForward(snaps);
	const a = carried.findIndex((v, i) => i >= from && v !== null);
	const b = days.length - 1;
	if (a < 0 || b - a < MIN_RATE_SPAN_DAYS) return null;
	let gain = 0;
	let hours = 0;
	for (let i = a + 1; i <= b; i++) {
		if (days[i]!.placed) continue;
		gain += Math.max(0, carried[i]! - carried[i - 1]!);
		hours += days[i]!.minutes / 60;
	}
	return hours >= MIN_RATE_HOURS ? gain / hours : null;
}

function measuredRate(days: readonly TrajectoryDay[], snaps: ReadonlyArray<number | null>): number | null {
	return creditedRate(days, snaps, Math.max(0, days.length - RATE_WINDOW_DAYS)) ?? creditedRate(days, snaps, 0);
}

export function trajectory(
	input: TrajectoryInput,
	metric: TrajectoryMetric,
	pace: Pick<TrajectoryPace, "minutesPerDay" | "daysPerWeek">,
	horizon?: number,
): Trajectory {
	const days = input.days;
	const hoursPerDay = (pace.minutesPerDay / 60) * (pace.daysPerWeek / 7);
	const recent = days.slice(-PACE_WINDOW_DAYS);
	const recentHours = recent.reduce((s, d) => s + d.minutes, 0) / 60;
	const totalHours = days.reduce((s, d) => s + d.minutes, 0) / 60;

	let now = 0;
	let ready = true;
	let perHour = 0;
	let basis: Trajectory["basis"] = "assumed";
	let past: TrajectoryPoint[] = [];
	let target: number | null = null;
	let cap = Number.POSITIVE_INFINITY;

	if (metric === "hours") {
		const snaps = days.map((d) => d.hours);
		now = input.hoursDone;
		target = input.hoursTarget;
		past = buildPast(days, snaps, (d) => d.minutes, now, true, true);
		const m = measuredRate(days, snaps);
		perHour = m ?? 1;
		basis = m === null ? "assumed" : "measured";
	} else if (metric === "units") {
		const snaps = days.map((d) => d.units);
		now = input.unitsDone;
		target = input.unitsTotal;
		cap = Math.max(input.unitsTotal, now);
		past = buildPast(days, snaps, (d) => d.lessons, now, true, true);
		const m = measuredRate(days, snaps);
		const totalLessons = days.reduce((s, d) => s + d.lessons, 0);
		if (m !== null) {
			perHour = m;
			basis = "measured";
		} else if (totalLessons > 0) {
			const recentLessons = recent.reduce((s, d) => s + d.lessons, 0);
			const lessonsPerHour =
				recentHours > 0 && recentLessons > 0
					? recentLessons / recentHours
					: totalHours > 0
						? totalLessons / totalHours
						: 0;
			perHour = (now / totalLessons) * lessonsPerHour;
		} else {
			ready = false;
		}
	} else {
		const snaps = days.map((d) => d.words);
		const count = snaps.filter((v) => v !== null).length;
		now = input.wordsNow ?? snaps.reduce<number>((last, v) => v ?? last, 0);
		past = buildPast(days, snaps, () => 0, now, false, false);
		if (count < MIN_WORD_SNAPSHOTS) {
			ready = false;
		} else {
			const m = measuredRate(days, snaps);
			perHour = m ?? 0;
			basis = m === null ? "assumed" : "measured";
		}
	}

	if (past.at(-1)?.day === 0) past[past.length - 1] = { day: 0, value: now };
	else past.push({ day: 0, value: now });

	const ratePerDay = ready ? perHour * hoursPerDay : 0;
	const daysTo = ready && target !== null ? daysToReach(now, ratePerDay, target) : null;
	const span = horizon ?? horizonDays(daysTo);
	const step = Math.max(1, Math.ceil(span / 120));
	const future: TrajectoryPoint[] = [];
	if (ready) {
		for (let t = 0; t < span; t += step) future.push({ day: t, value: Math.min(cap, now + ratePerDay * t) });
		future.push({ day: span, value: Math.min(cap, now + ratePerDay * span) });
	}
	return {
		metric,
		ready,
		now,
		past,
		future,
		ratePerDay,
		perPracticeHour: ready ? perHour : 0,
		basis,
		target,
		daysToTarget: daysTo,
	};
}
