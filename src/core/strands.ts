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
 * it. Pure and browser-safe; the minutes are the plan's own estimates
 * per activity, so the share is honest to about ±10 points.
 */

export type Strand = "input" | "output" | "form" | "fluency";

export const STRANDS: Array<{ id: Strand; title: string; line: string }> = [
	{ id: "input", title: "Input", line: "Listen, Read, Story — understanding the message" },
	{ id: "output", title: "Speaking", line: "Speak, Talk — saying it before you are sure" },
	{ id: "form", title: "Words & rules", line: "Lessons, Review, the tutor — deliberate study" },
	{ id: "fluency", title: "Speed", line: "Blitz, re-read, say it faster — fast with what you know" },
];

export const STRAND_TARGET = 0.25;

/** What a day's ledger counts (src/store/progress.ts DayRecord). */
export interface StrandDay {
	lessons?: number;
	reviews?: number;
	blitz?: number;
	talks?: number;
	stories?: number;
	tutors?: number;
	reads?: number;
	listens?: number;
	speaks?: number;
	rereads?: number;
	fasts?: number;
}

/** Minutes an activity is planned for (src/core/curriculum.ts TASK_MINUTES
 *  and the reading/listening modules), kept here so the balance never
 *  drifts from the plan. Reviews are per card. */
export const STRAND_MINUTES = { lesson: 3, review: 0.25, blitz: 1, talk: 6, story: 6, tutor: 6, read: 4, listen: 4, speak: 6, reread: 3, fast: 3 } as const;

export interface StrandBalance {
	minutes: Record<Strand, number>;
	total: number;
	/** 0..1 of the total, every strand (0 when nothing was done). */
	share: Record<Strand, number>;
	/** The strand furthest under the target, when anything was done. */
	behind: Strand | null;
	target: number;
}

export function strandMinutes(day: StrandDay): Record<Strand, number> {
	return {
		input: (day.listens ?? 0) * STRAND_MINUTES.listen + (day.reads ?? 0) * STRAND_MINUTES.read + (day.stories ?? 0) * STRAND_MINUTES.story,
		output: (day.talks ?? 0) * STRAND_MINUTES.talk + (day.speaks ?? 0) * STRAND_MINUTES.speak,
		form: (day.lessons ?? 0) * STRAND_MINUTES.lesson + (day.reviews ?? 0) * STRAND_MINUTES.review + (day.tutors ?? 0) * STRAND_MINUTES.tutor,
		fluency: (day.blitz ?? 0) * STRAND_MINUTES.blitz + (day.rereads ?? 0) * STRAND_MINUTES.reread + (day.fasts ?? 0) * STRAND_MINUTES.fast,
	};
}

export function strandBalance(days: readonly StrandDay[]): StrandBalance {
	const minutes: Record<Strand, number> = { input: 0, output: 0, form: 0, fluency: 0 };
	for (const d of days) {
		const m = strandMinutes(d);
		for (const s of STRANDS) minutes[s.id] += m[s.id];
	}
	for (const s of STRANDS) minutes[s.id] = Math.round(minutes[s.id] * 10) / 10;
	const total = Math.round(STRANDS.reduce((n, s) => n + minutes[s.id], 0) * 10) / 10;
	const share: Record<Strand, number> = { input: 0, output: 0, form: 0, fluency: 0 };
	if (total > 0) for (const s of STRANDS) share[s.id] = minutes[s.id] / total;
	const behind = total > 0 ? STRANDS.map((s) => s.id).sort((a, b) => share[a] - share[b])[0]! : null;
	return { minutes, total, share, behind: behind !== null && share[behind] < STRAND_TARGET ? behind : null, target: STRAND_TARGET };
}

/** One line under the bars: what the week says to do next. */
export function strandAdvice(b: StrandBalance): string {
	if (b.total === 0) return "Nothing counted yet this week. A quarter each is the aim; the plan above is built that way.";
	const over = STRANDS.filter((s) => b.share[s.id] > 0.5).map((s) => s.title.toLowerCase());
	const name = (s: Strand) => STRANDS.find((x) => x.id === s)!.title.toLowerCase();
	if (!b.behind) return "Close to a quarter each — the balance Nation's four strands ask for.";
	const pct = Math.round(b.share[b.behind] * 100);
	const where: Record<Strand, string> = {
		input: "Listen, Read and Story are where it grows",
		output: "a spoken scene is where it grows",
		form: "a lesson or the review deck is where it grows",
		fluency: "a Blitz, a timed re-read or \"say it faster\" is where it grows",
	};
	return `${name(b.behind)[0]!.toUpperCase()}${name(b.behind).slice(1)} is furthest behind at ${pct}% of the week${over.length ? `, ${over.join(" and ")} over half` : ""}; ${where[b.behind]}.`;
}
