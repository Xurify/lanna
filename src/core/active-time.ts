/**
 * Measured minutes (LangHarness, 2026-10-29) — how long the learner was
 * actually practicing, per activity, instead of one wall-clock number.
 *
 * Two rules, because the tasks behave differently:
 *   interactive  lesson, blitz, review, placement, speak, say-it-faster:
 *                the time between your actions, each gap capped (GAP_CAP_MS),
 *                so walking away stops the clock.
 *   passive      watch, read, listen: nothing to click for minutes at a
 *                time, so the clock runs while the tab is visible and
 *                focused.
 *
 * The clock hands out deltas (`take`): every send zeroes it, so a flush
 * when the learner leaves and the final send on finish can never count the
 * same seconds twice. Pure and browser-safe; the server side is `addMinutes`.
 */

export type TimedActivity = "lesson" | "blitz" | "review" | "placement" | "listen" | "read" | "watch" | "speak" | "reread" | "fast";

export const TIMED_ACTIVITIES: readonly TimedActivity[] = ["lesson", "blitz", "review", "placement", "listen", "read", "watch", "speak", "reread", "fast"];

export function isTimedActivity(v: unknown): v is TimedActivity {
	return typeof v === "string" && (TIMED_ACTIVITIES as readonly string[]).includes(v);
}

/** The most one send may add, in minutes: a safety net against a forgotten
 *  tab, not the measurement itself. */
/** Watch's cap is the longest video the app takes (90 min, MAX_VIDEO_SEC): a watching counts the
 *  video's playing time, so one send can never be longer than the video. */
export const ACTIVITY_CAP_MIN: Record<TimedActivity, number> = { lesson: 60, blitz: 60, review: 5, placement: 20, listen: 20, read: 20, watch: 90, speak: 20, reread: 10, fast: 10 };

/** What a day's ledger holds (src/store/progress.ts DayRecord). */
export interface MinutesLedger {
	minutes?: number;
	minutesBy?: Partial<Record<TimedActivity, number>>;
}

/** Add one session's time to a day: the total and the activity's own
 *  share, capped. Returns the minutes added. A non-number adds nothing and
 *  leaves no entry, so an activity with no timing falls back to its plan
 *  estimate in the strand balance; a measured 0 is kept as 0. */
export function addMinutes(day: MinutesLedger, activity: TimedActivity, ms: number | undefined): number {
	if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return 0;
	const minutes = Math.min(ACTIVITY_CAP_MIN[activity], ms / 60_000);
	day.minutes = (day.minutes ?? 0) + minutes;
	day.minutesBy = { ...day.minutesBy, [activity]: (day.minutesBy?.[activity] ?? 0) + minutes };
	return minutes;
}

/** The time a finished session adds to the day: the measured active time
 *  when the client sent it (a measured 0 counts), else the old wall-clock
 *  `ms` when that is a real duration, else nothing. */
export function sessionMs(input: { activeMs?: number; ms?: number }): number | undefined {
	if (typeof input.activeMs === "number" && Number.isFinite(input.activeMs) && input.activeMs >= 0) return input.activeMs;
	return typeof input.ms === "number" && Number.isFinite(input.ms) && input.ms > 0 ? input.ms : undefined;
}

/** The longest stretch with no action that still counts as practicing. */
export const GAP_CAP_MS = 90_000;
/** A send under this is noise (a page opened and closed). */
export const MIN_SEND_MS = 2_000;

/** How long one line may wait for the learner's decision and still count: a line
 *  is a few seconds of speech, so past this the learner has left the desk. */
export const LINE_DECISION_CAP_MS = 120_000;

/** Whether Watch's clock runs. Nothing counts before the video is loaded. A
 *  playing video counts. A line waiting for "Got it" counts up to its cap, then
 *  the gap rule applies. Questions and paused time count until the gap cap with
 *  no action. */
export function watchClockOn(s: { watching: boolean; questions: boolean; ready: boolean; playing: boolean; deciding: boolean; decideCapped: boolean; idle: boolean }): boolean {
	if (!s.watching && !s.questions) return false;
	if (s.watching && !s.ready) return false;
	if (s.playing) return true;
	if (s.watching && s.deciding && !s.decideCapped) return true;
	return !s.idle;
}

export interface ActiveClock {
	/** The learner did something: the time since the last action counts, up to the gap cap. */
	act(t?: number): void;
	/** Passive mode: the tab became (in)visible or (un)focused. */
	engage(engaged: boolean, t?: number): void;
	/** Active milliseconds not yet taken. */
	read(t?: number): number;
	/** Hand out what is unsent and start again from zero. */
	take(t?: number): number;
	/** Forget everything (a new rep, a new card). */
	reset(t?: number): void;
}

export function createActiveClock(mode: "interactive" | "passive", opts: { gapCapMs?: number; now?: () => number; engaged?: boolean } = {}): ActiveClock {
	const cap = opts.gapCapMs ?? GAP_CAP_MS;
	const clock = opts.now ?? Date.now;
	let total = 0;
	let lastAt = clock();
	let since: number | null = mode === "passive" && opts.engaged !== false ? lastAt : null;

	const pending = (t: number) => (mode === "interactive" ? Math.min(Math.max(0, t - lastAt), cap) : since === null ? 0 : Math.max(0, t - since));

	return {
		act(t = clock()) {
			if (mode !== "interactive") return;
			total += pending(t);
			lastAt = t;
		},
		engage(engaged, t = clock()) {
			if (mode !== "passive") return;
			if (engaged && since === null) since = t;
			else if (!engaged && since !== null) {
				total += Math.max(0, t - since);
				since = null;
			}
		},
		read(t = clock()) {
			return total + pending(t);
		},
		take(t = clock()) {
			const out = total + pending(t);
			total = 0;
			lastAt = t;
			if (since !== null) since = t;
			return Math.round(out);
		},
		reset(t = clock()) {
			total = 0;
			lastAt = t;
			if (since !== null) since = t;
		},
	};
}
