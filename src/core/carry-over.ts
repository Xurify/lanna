/**
 * Carry-over: the plan tasks left unfinished on earlier days. Each day keeps
 * a snapshot of its plan (id, title, done); a task counts as carried until a
 * later day or today finishes it. Pure, so the rules are tested directly.
 */

/** How many days back unfinished tasks are carried, and the window the
 *  "logged vs goal" pace is averaged over. */
export const RECENT_DAYS = 7;

export interface PlannedSnapshot {
	id: string;
	title: string;
	done: boolean;
}

export interface DayPlanSnapshot {
	/** Local day, YYYY-MM-DD. */
	day: string;
	tasks: PlannedSnapshot[];
}

/** The counters of a day's ledger that say a task was done. */
interface DayLedger {
	reviews?: number;
	blitz?: number;
	tutors?: number;
	reads?: number;
	listens?: number;
	watches?: number;
	speaks?: number;
	rereads?: number;
	fasts?: number;
}

/** A day's snapshot is only written when the plan is read, and some work
 *  (a review answer) never reads it: so the ledger has the last word on the
 *  tasks it counts one by one. Lessons, strengthen and words keep the snapshot. */
export function doneInLedger(id: string, day: DayLedger): boolean {
	switch (id) {
		case "review":
			return (day.reviews ?? 0) > 0;
		case "listen":
			return (day.listens ?? 0) > 0;
		case "read":
			return (day.reads ?? 0) > 0;
		case "watch":
			return (day.watches ?? 0) > 0;
		case "speak":
			return (day.speaks ?? 0) + (day.tutors ?? 0) > 0;
		case "fluency":
			return (day.rereads ?? 0) + (day.fasts ?? 0) > 0;
		case "blitz":
			return (day.blitz ?? 0) > 0;
		default:
			return false;
	}
}

interface CarriedTask {
	id: string;
	title: string;
	/** The latest day the task was planned and left unfinished. */
	from: string;
}

/** Unfinished tasks from the days before `today`, newest appearance per task.
 *  A task finished on a later day, or done today, is not carried. */
export function carriedTasks(days: readonly DayPlanSnapshot[], today: string, doneToday: ReadonlySet<string>): CarriedTask[] {
	const latest = new Map<string, CarriedTask>();
	const past = days.filter((d) => d.day < today).sort((a, b) => a.day.localeCompare(b.day));
	for (const d of past) {
		for (const t of d.tasks) {
			if (t.done) latest.delete(t.id);
			else latest.set(t.id, { id: t.id, title: t.title, from: d.day });
		}
	}
	for (const id of doneToday) latest.delete(id);
	return [...latest.values()];
}
