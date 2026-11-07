/**
 * The four strands (LangHarness, 2026-10-28) — Paul Nation's balance for
 * a language course, and the app's week measured against it.
 *
 * Nation (2007): a well-balanced course gives roughly a quarter of its
 * time to each of
 *   input    — listening and reading for the message (Listen, Read, Story)
 *   output   — speaking and writing for the message (Speak, Talk)
 *   form     — deliberate study of words and rules, feedback on form
 *              (lessons, the review deck, tutor units, Why?)
 *   fluency  — going faster with what is already known (Blitz, a timed
 *              re-read, "say it faster")
 * and no more than a quarter to deliberate study. Before this module the
 * app gave form about three quarters of a day's plan and could not show
 * it. Pure and browser-safe. Since 2026-10-29 the minutes are measured
 * while the learner was active (src/core/active-time.ts); an activity with
 * no timer (Talk, Story, tutor) or a day before they were measured falls
 * back to the plan's own estimate per activity, ±10 points.
 */

import type { TimedActivity } from "./active-time.ts";

export type Strand = "input" | "output" | "form" | "fluency";

export const STRANDS: Array<{ id: Strand; title: string; line: string }> = [
	{ id: "input", title: "Input", line: "Listen, Read, Watch, Story — understanding the message" },
	{ id: "output", title: "Speaking", line: "Speak, Talk — saying it before you are sure" },
	{ id: "form", title: "Words & rules", line: "Lessons, Review, the tutor — deliberate study" },
	{ id: "fluency", title: "Speed", line: "Blitz, re-read, say it faster — fast with what you know" },
];

export const STRAND_TARGET = 0.25;

/** What a day's ledger counts (src/store/progress.ts DayRecord). */
export interface StrandDay {
	/** Measured minutes per activity (src/core/active-time.ts); an activity
	 *  with an entry is counted from it, the others from the plan estimate. */
	minutesBy?: Partial<Record<TimedActivity, number>>;
	lessons?: number;
	reviews?: number;
	blitz?: number;
	talks?: number;
	stories?: number;
	tutors?: number;
	reads?: number;
	listens?: number;
	/** Videos watched (the Watch task). */
	watches?: number;
	speaks?: number;
	rereads?: number;
	fasts?: number;
}

/** Minutes an activity is planned for (src/core/curriculum.ts TASK_MINUTES
 *  and the reading/listening modules), kept here so the balance never
 *  drifts from the plan. Reviews are per card. */
export const STRAND_MINUTES = { lesson: 3, review: 0.25, blitz: 1, talk: 6, story: 6, tutor: 6, read: 4, listen: 4, watch: 8, speak: 6, reread: 3, fast: 3 } as const;

export interface StrandBalance {
	minutes: Record<Strand, number>;
	total: number;
	/** Of `total`, the minutes counted from plan estimates rather than
	 *  measured: Talk, Story and tutor sessions have no timer, and days
	 *  before minutes were measured have none either. */
	estimated: number;
	/** 0..1 of the total, every strand (0 when nothing was done). */
	share: Record<Strand, number>;
	/** The strand furthest under the target, when anything was done. */
	behind: Strand | null;
	target: number;
}

/** One day's minutes per strand, and how many of them were estimated. A
 *  timed activity counts what was measured (even a measured 0) and only
 *  falls back to count × planned minutes when the day has no measurement
 *  for it; Talk, Story and tutor sessions are always estimated. Placement
 *  time is in the day's total but in no strand, as it always was. */
export function strandParts(day: StrandDay): { minutes: Record<Strand, number>; estimated: number } {
	let estimated = 0;
	const timed = (activity: TimedActivity, count: number | undefined, per: number): number => {
		const measured = day.minutesBy?.[activity];
		if (measured !== undefined) return measured;
		const guess = (count ?? 0) * per;
		estimated += guess;
		return guess;
	};
	const untimed = (count: number | undefined, per: number): number => {
		const guess = (count ?? 0) * per;
		estimated += guess;
		return guess;
	};
	return {
		minutes: {
			input: timed("listen", day.listens, STRAND_MINUTES.listen) + timed("read", day.reads, STRAND_MINUTES.read) + timed("watch", day.watches, STRAND_MINUTES.watch) + untimed(day.stories, STRAND_MINUTES.story),
			output: untimed(day.talks, STRAND_MINUTES.talk) + timed("speak", day.speaks, STRAND_MINUTES.speak),
			form: timed("lesson", day.lessons, STRAND_MINUTES.lesson) + timed("review", day.reviews, STRAND_MINUTES.review) + untimed(day.tutors, STRAND_MINUTES.tutor),
			fluency: timed("blitz", day.blitz, STRAND_MINUTES.blitz) + timed("reread", day.rereads, STRAND_MINUTES.reread) + timed("fast", day.fasts, STRAND_MINUTES.fast),
		},
		estimated,
	};
}

export function strandMinutes(day: StrandDay): Record<Strand, number> {
	return strandParts(day).minutes;
}

export function strandBalance(days: readonly StrandDay[]): StrandBalance {
	const minutes: Record<Strand, number> = { input: 0, output: 0, form: 0, fluency: 0 };
	let estimated = 0;
	for (const d of days) {
		const part = strandParts(d);
		for (const s of STRANDS) minutes[s.id] += part.minutes[s.id];
		estimated += part.estimated;
	}
	for (const s of STRANDS) minutes[s.id] = Math.round(minutes[s.id] * 10) / 10;
	const total = Math.round(STRANDS.reduce((n, s) => n + minutes[s.id], 0) * 10) / 10;
	const share: Record<Strand, number> = { input: 0, output: 0, form: 0, fluency: 0 };
	if (total > 0) for (const s of STRANDS) share[s.id] = minutes[s.id] / total;
	const behind = total > 0 ? STRANDS.map((s) => s.id).sort((a, b) => share[a] - share[b])[0]! : null;
	return { minutes, total, estimated: Math.min(total, Math.round(estimated * 10) / 10), share, behind: behind !== null && share[behind] < STRAND_TARGET ? behind : null, target: STRAND_TARGET };
}

/** How the minutes were counted, in one honest line: measured while the
 *  learner was active, with the estimated part named (Talk, Story and
 *  tutor sessions have no timer; older days were never measured). */
export function strandCaption(b: StrandBalance): string {
	const quarter = "The line marks a quarter.";
	if (b.total <= 0) return `Measured while you practice. ${quarter}`;
	const total = Math.round(b.total);
	const guessed = Math.round(b.estimated);
	if (guessed <= 0) return `${total} min this week, measured while you were active. ${quarter}`;
	if (guessed >= total) return `About ${total} min this week, counted from each activity's planned minutes. ${quarter}`;
	return `${total} min this week: ${total - guessed} measured while you were active, ${guessed} counted from planned minutes (tutor, Talk, Story and older days). ${quarter}`;
}

/** One line under the bars: what the week says to do next. */
export function strandAdvice(b: StrandBalance): string {
	if (b.total === 0) return "Nothing counted yet this week. Nation's four strands suggest about a quarter of the time in each.";
	const over = STRANDS.filter((s) => b.share[s.id] > 0.5).map((s) => s.title);
	const name = (s: Strand) => STRANDS.find((x) => x.id === s)!.title;
	if (!b.behind) return "Close to a quarter each, the balance Nation suggests for a course.";
	const pct = Math.round(b.share[b.behind] * 100);
	const where: Record<Strand, string> = {
		input: "Listen, Read or Watch",
		output: "A spoken scene",
		form: "A lesson or the review deck",
		fluency: "A Blitz, a timed re-read or Say it faster",
	};
	return `${name(b.behind)} is furthest behind at ${pct}%${over.length ? ` while ${over.join(" and ")} ${over.length > 1 ? "are" : "is"} over half` : ""}. ${where[b.behind]} is the quickest way to catch up.`;
}
