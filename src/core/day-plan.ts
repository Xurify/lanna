/**
 * The day across languages (2026-11-05): each language in the learner's list
 * with its own plan for today. The split of the day is each language's own
 * minutes a day (goal.minutesPerDay); the server reads every language's plan
 * (src/server/day-plan.ts) and Today lists them, largest share first.
 */

import type { PlanTask } from "./curriculum.ts";

export interface DayLanguage {
	id: string;
	english: string;
	endonym: string;
	/** The language the app runs now. */
	running: boolean;
	/** Its minutes a day. */
	minutes: number;
	/** Minutes practiced in it today. */
	practiced: number;
	/** Set up (goal, level): until then its only step is the setup. */
	setUp: boolean;
	tasks: PlanTask[];
}

export interface LanguageDay {
	/** Minutes a day across every language. */
	minutes: number;
	/** Minutes practiced today across every language. */
	practiced: number;
	/** Largest share of the day first. */
	languages: DayLanguage[];
}

/** The least a language's day can hold (the goal's own floor). */
export const MIN_LANGUAGE_MINUTES = 5;

/** Whole percents that add up to 100, from each language's minutes now
 *  (largest remainder, so no language is rounded away). */
export function sharesFromMinutes(languages: ReadonlyArray<{ id: string; minutes: number }>): Record<string, number> {
	const total = languages.reduce((n, l) => n + l.minutes, 0);
	if (total <= 0) return Object.fromEntries(languages.map((l) => [l.id, Math.round(100 / languages.length)]));
	const raw = languages.map((l) => ({ id: l.id, exact: (l.minutes / total) * 100 }));
	const out: Record<string, number> = Object.fromEntries(raw.map((r) => [r.id, Math.floor(r.exact)]));
	let left = 100 - Object.values(out).reduce((n, v) => n + v, 0);
	for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
		if (left <= 0) break;
		out[r.id] = (out[r.id] ?? 0) + 1;
		left -= 1;
	}
	return out;
}

/** Each language's minutes from the day's minutes and the shares. The
 *  shares need not add up to 100: each language gets its part of the whole,
 *  and never less than MIN_LANGUAGE_MINUTES. */
export function minutesFromShares(total: number, shares: Record<string, number>): Record<string, number> {
	const ids = Object.keys(shares);
	const sum = ids.reduce((n, id) => n + (shares[id] ?? 0), 0);
	return Object.fromEntries(ids.map((id) => [id, Math.max(MIN_LANGUAGE_MINUTES, Math.round(sum > 0 ? (total * (shares[id] ?? 0)) / sum : total / ids.length))]));
}
