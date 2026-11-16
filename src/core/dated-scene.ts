/**
 * A scene with a date (2026-11-05; creator-hooks proposal 3).
 * The learner writes one scene in their own words and the day it should
 * work. The app says how far off the day is and whether the learner's
 * measured pace gets them there, and asks how it went once the day has
 * passed. Pure and browser-safe. Dates are ISO days (YYYY-MM-DD), so month
 * ends, leap years and year changes are plain arithmetic; "today" is the
 * learner's day key, passed in by the caller.
 */

export interface DatedOutcome {
	/** When the line was written (ISO time). */
	at: string;
	text: string;
}

type DatedChoice = "2w" | "1m" | "2m" | "3m" | "6m";

/** The quick choices above the stepper, in reading order. */
export const DATED_CHOICES: Array<{ id: DatedChoice; label: string }> = [
	{ id: "2w", label: "2 weeks" },
	{ id: "1m", label: "1 month" },
	{ id: "2m", label: "2 months" },
	{ id: "3m", label: "3 months" },
	{ id: "6m", label: "6 months" },
];

const CHOICE_MONTHS: Record<Exclude<DatedChoice, "2w">, number> = { "1m": 1, "2m": 2, "3m": 3, "6m": 6 };

/** How far ahead a scene can be dated; past it no measured pace says anything. */
const DATED_HORIZON_YEARS = 10;

const DAY_MS = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A real calendar date written YYYY-MM-DD: 2027-02-30 and 2026-1-01 are not. */
export function isIsoDate(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const ms = toMs(value);
	return Number.isFinite(ms) && fromMs(ms) === value;
}

/** The date `days` after `iso`; negative goes back. */
export function isoAddDays(iso: string, days: number): string {
	return fromMs(toMs(iso) + days * DAY_MS);
}

/** The same day `months` later. The day is held and clamped to the length of
 *  the month reached: 31 January plus one month is 28 or 29 February. */
export function isoAddMonths(iso: string, months: number): string {
	const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
	const index = y * 12 + (m - 1) + months;
	const year = Math.floor(index / 12);
	const month = index - year * 12 + 1;
	const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
	return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** A year later or earlier, clamped the same way: 29 February 2028 plus one year is 28 February 2029. */
export function isoAddYears(iso: string, years: number): string {
	return isoAddMonths(iso, years * 12);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function isoDaysBetween(from: string, to: string): number {
	return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

/** The date a quick choice means, counted from today. */
export function dateForChoice(choice: DatedChoice, today: string): string {
	if (choice === "2w") return isoAddDays(today, 14);
	return isoAddMonths(today, CHOICE_MONTHS[choice]);
}

const WORDS = new Intl.DateTimeFormat("en-US", {
	weekday: "long",
	month: "long",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

/** "Saturday, December 5, 2026". */
export function dateInWords(iso: string): string {
	return WORDS.format(new Date(toMs(iso)));
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** "12 days left", "1 day left", "today", "passed 3 days ago". */
export function daysLeftWords(daysLeft: number): string {
	if (daysLeft > 1) return `${daysLeft} days left`;
	if (daysLeft === 1) return "1 day left";
	if (daysLeft === 0) return "today";
	if (daysLeft === -1) return "passed yesterday";
	return `passed ${days(-daysLeft)} ago`;
}

/** Why a date cannot be a scene's date, or null when it can. */
export function datedDateProblem(date: unknown, today: string): string | null {
	if (!isIsoDate(date)) return "Pick a date from the calendar.";
	if (date < today) return "Pick today or a later date.";
	if (date > isoAddYears(today, DATED_HORIZON_YEARS)) return `Pick a date within ${DATED_HORIZON_YEARS} years.`;
	return null;
}

export type DatedStatus = "on-track" | "behind" | "no-speed" | "no-pace" | "passed";

interface DatedScene {
	id: string;
	title: string;
	/** The scene in the learner's own words, when they wrote it themselves. */
	words?: string | null;
	date: string;
	outcome?: DatedOutcome;
}

/** What a date needs from a milestone estimate: the real-pace days to go
 *  (null until the pace is measured), and the speed the scene asks for with
 *  where that speed came from. "level" is the guided-hours ladder, an
 *  assumption, not a measurement. */
interface DatedEstimate {
	eta: { daysPace: number | null };
	speed: { need: number; basis: "listen" | "watch" | "both" | "level" };
}

export interface DatedSceneView {
	id: string;
	title: string;
	/** The learner's own words for the scene, or null when only the title is known. */
	words: string | null;
	date: string;
	/** "Saturday, December 5, 2026". */
	dateWords: string;
	/** Days from today; negative once the date has passed. */
	daysLeft: number;
	status: DatedStatus;
	/** One sentence: the status, with its number and its date. */
	line: string;
	/** The day the estimate reaches the scene at the measured pace (ISO), when it does. */
	reach: string | null;
	/** Days after the date the estimate falls, when behind. */
	daysLater: number | null;
	outcome: DatedOutcome | null;
	/** The date has passed and no line is written yet. */
	outcomeDue: boolean;
}

/** A scene read against its estimate on today's day. The verdict uses the
 *  pace the learner measured, rounded to whole days the way the milestone
 *  date is. A speed the ladder assumed, or a pace nobody has measured, gives
 *  no date at all rather than an invented one. */
export function datedSceneView(scene: DatedScene, estimate: DatedEstimate, today: string): DatedSceneView {
	const daysLeft = isoDaysBetween(today, scene.date);
	const base = {
		id: scene.id,
		title: scene.title,
		words: scene.words ?? null,
		date: scene.date,
		dateWords: dateInWords(scene.date),
		daysLeft,
		outcome: scene.outcome ?? null,
		reach: null,
		daysLater: null,
	};
	if (daysLeft < 0) return { ...base, status: "passed", line: "The date has passed.", outcomeDue: !scene.outcome };
	const open = { ...base, outcomeDue: false };
	if (estimate.speed.need > 0 && estimate.speed.basis === "level")
		return {
			...open,
			status: "no-speed",
			line: "Speed is not measured yet, so the app gives no date. Six timed sentences in Listen or Watch measure it.",
		};
	if (estimate.eta.daysPace === null)
		return {
			...open,
			status: "no-pace",
			line: "Your pace is not measured yet, so the app gives no date. Seven study days in the last fourteen, and two weeks in the deck, measure it.",
		};
	const reachDays = Math.max(0, Math.round(estimate.eta.daysPace));
	const reach = isoAddDays(today, reachDays);
	const reachWords = dateInWords(reach);
	if (reachDays <= daysLeft) {
		const spare = daysLeft - reachDays;
		const margin = spare > 0 ? `${days(spare)} to spare` : "just in time";
		return {
			...open,
			status: "on-track",
			reach,
			line: `At your pace of the last 14 days you reach it by ${reachWords}, ${margin}. A projection, not a promise.`,
		};
	}
	const daysLater = reachDays - daysLeft;
	return {
		...open,
		status: "behind",
		reach,
		daysLater,
		line: `Later than the date: at your pace of the last 14 days you reach it on ${reachWords}, ${days(daysLater)} after.`,
	};
}
