/**
 * Listening outside the app (2026-11-07): podcasts, TV, YouTube in another
 * player, logged by hand as focused or background. The app cannot see that
 * time, so it is kept apart from the measured minutes (P9): it never enters
 * `minutes`, the strand balance, the streak or XP. The milestones page shows
 * it in its own row, at the weights below. Research:
 * docs/research/outside-listening.md.
 */

export type Attention = "focused" | "background";

export interface OutsideEntry {
	id: string;
	/** Local day the listening happened, YYYY-MM-DD. */
	day: string;
	/** When it was logged. */
	at: string;
	minutes: number;
	attention: Attention;
	/** What it was, in the learner's words. */
	what?: string;
}

/**
 * How much of an outside minute counts toward the hours a speed needs,
 * against a measured minute in the app. Focused: half, an assumption — no
 * study gives a weight, and the app does not know how much of it was
 * understood, how much was replayed, or whether the minutes are right
 * (self-reported media time correlates with logged time at only r ≈ 0.38,
 * Parry et al. 2021). Background: none, the conservative end: a concurrent
 * task wipes out word learning from speech (Toro et al. 2005), though two
 * weeks of podcasts in the background did help recognize word forms
 * (Alexander et al. 2023).
 */
export const OUTSIDE_WEIGHT: Record<Attention, number> = { focused: 0.5, background: 0 };

/** One entry at most; a longer stretch is two entries. */
export const MAX_ENTRY_MINUTES = 600;
/** A day's outside minutes past this are not counted (16 waking hours). */
export const MAX_DAY_MINUTES = 960;
export const MAX_WHAT = 120;
/** An entry can be dated back this far, to catch up on a few days. */
export const BACKDATE_DAYS = 7;

export type ParsedEntry = { ok: true; minutes: number; attention: Attention; what?: string } | { ok: false; message: string };

export function parseEntry(body: { minutes?: unknown; attention?: unknown; what?: unknown } | null): ParsedEntry {
	if (!body) return { ok: false, message: "minutes and attention are required" };
	const minutes = typeof body.minutes === "number" && Number.isFinite(body.minutes) ? Math.round(body.minutes) : NaN;
	if (!(minutes >= 1 && minutes <= MAX_ENTRY_MINUTES)) return { ok: false, message: `minutes must be 1 to ${MAX_ENTRY_MINUTES}` };
	if (body.attention !== "focused" && body.attention !== "background") return { ok: false, message: "attention must be focused or background" };
	const what = typeof body.what === "string" ? body.what.replace(/\s+/g, " ").trim().slice(0, MAX_WHAT) : "";
	return { ok: true, minutes, attention: body.attention, ...(what ? { what } : {}) };
}

export interface OutsideSummary {
	/** Minutes a day over the window, all days counted (the pace's own rule). */
	focusedPerDay: number;
	backgroundPerDay: number;
	/** focusedPerDay × its weight + backgroundPerDay × its weight. */
	creditedPerDay: number;
	/** Every entry on file. */
	focusedHours: number;
	backgroundHours: number;
	entries: number;
}

/** Per-day minutes by attention, each day capped at MAX_DAY_MINUTES (focused first). */
function byDay(entries: readonly OutsideEntry[]): Map<string, Record<Attention, number>> {
	const days = new Map<string, Record<Attention, number>>();
	for (const e of entries) {
		const d = days.get(e.day) ?? { focused: 0, background: 0 };
		d[e.attention] += e.minutes;
		days.set(e.day, d);
	}
	for (const d of days.values()) {
		d.focused = Math.min(d.focused, MAX_DAY_MINUTES);
		d.background = Math.min(d.background, MAX_DAY_MINUTES - d.focused);
	}
	return days;
}

/** `windowDays` are the day keys of the pace window (the last 14 local days). */
export function outsideSummary(entries: readonly OutsideEntry[], windowDays: readonly string[]): OutsideSummary {
	const days = byDay(entries);
	let focused = 0;
	let background = 0;
	for (const key of windowDays) {
		focused += days.get(key)?.focused ?? 0;
		background += days.get(key)?.background ?? 0;
	}
	const n = Math.max(1, windowDays.length);
	const focusedPerDay = focused / n;
	const backgroundPerDay = background / n;
	let allFocused = 0;
	let allBackground = 0;
	for (const d of days.values()) {
		allFocused += d.focused;
		allBackground += d.background;
	}
	const r1 = (x: number) => Math.round(x * 10) / 10;
	return {
		focusedPerDay: r1(focusedPerDay),
		backgroundPerDay: r1(backgroundPerDay),
		creditedPerDay: r1(focusedPerDay * OUTSIDE_WEIGHT.focused + backgroundPerDay * OUTSIDE_WEIGHT.background),
		focusedHours: r1(allFocused / 60),
		backgroundHours: r1(allBackground / 60),
		entries: entries.length,
	};
}
