/**
 * The Plan page's what-if (LangHarness, 2026-10-28): drag the minutes a day
 * or the days a week and every date moves. The sums are the app's usual
 * ones (guided hours at planned hours a week; src/core/milestones.ts for the
 * milestones), run again on the client with the slider's values in place of
 * the saved plan, so nothing waits on the server.
 */

import { CEFR_ORDER, GUIDED_HOURS, type Cefr } from "./curriculum.ts";
import { weeklyHours } from "./onboarding.ts";
import type { LearnerFacts } from "./milestones.ts";

interface LevelDate {
	level: Cefr;
	/** Guided hours from zero to the top of this level. */
	hours: number;
	/** Days from now to reach it at the pace; 0 when already there; null at 0 hours a week. */
	days: number | null;
	/** ISO date, or null with `days`. */
	date: string | null;
}

function addDaysIso(from: Date, days: number): string {
	return new Date(from.getTime() + Math.round(days) * 86_400_000).toISOString().slice(0, 10);
}

/** When each level, up to the goal, lands at `minutesPerDay` × `daysPerWeek`. */
export function levelDates(opts: {
	goal: Cefr;
	hoursDone: number;
	minutesPerDay: number;
	daysPerWeek: number;
	now: Date;
}): LevelDate[] {
	const weekly = weeklyHours(opts.minutesPerDay, opts.daysPerWeek);
	return CEFR_ORDER.slice(0, CEFR_ORDER.indexOf(opts.goal) + 1).map((level) => {
		const hours = GUIDED_HOURS[level];
		const left = Math.max(0, hours - opts.hoursDone);
		const days = left === 0 ? 0 : weekly > 0 ? (left / weekly) * 7 : null;
		return { level, hours, days, date: days === null ? null : addDaysIso(opts.now, days) };
	});
}

/** The learner's facts with the slider's pace in place of the saved plan. */
export function withPlan(facts: LearnerFacts, minutesPerDay: number, daysPerWeek: number): LearnerFacts {
	return { ...facts, minutesPerDay, daysPerWeek };
}

/** "3 months sooner", "2 weeks later", or null when the dates are within a week. */
export function shiftLine(fromDays: number | null, toDays: number | null): string | null {
	if (fromDays === null || toDays === null) return null;
	const diff = toDays - fromDays;
	if (Math.abs(diff) < 7) return null;
	const a = Math.abs(diff);
	const span =
		a < 60
			? `${Math.round(a / 7)} week${Math.round(a / 7) === 1 ? "" : "s"}`
			: a < 700
				? `${Math.round(a / 30.4)} months`
				: `${Math.round((a / 365.25) * 2) / 2} years`;
	return `${span} ${diff < 0 ? "sooner" : "later"} than your saved plan`;
}
