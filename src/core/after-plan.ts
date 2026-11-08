/**
 * What Today offers once the day's plan is done (2026-11-07).
 *
 * The plan holds about 35 to 45 minutes, but a goal can be up to 600. The
 * time beyond the plan used to go to "One more lesson", which is
 * deliberate study, already the strand furthest over Nation's quarter
 * (DECISIONS.md P2). Input is the strand that scales with time: it stays
 * easy at the word level, costs no model call once a video is prepared,
 * and is what the milestones page's speed gap needs. So the step after the
 * plan is a video that waits, else ten more Listen sentences, and the
 * lesson stays one tap away as the second choice.
 */

interface AfterPlanVideo {
	id: string;
	title: string;
	minutes: number;
}

export interface AfterPlanStep {
	kind: "watch" | "listen";
	title: string;
	line: string;
	minutes: number;
	href: string;
}

export interface AfterPlan {
	/** The one step Today draws, and the one Enter starts. */
	step: AfterPlanStep;
	/** With no video waiting: the page that finds one at the learner's level. */
	find: string | null;
}

export function afterPlan(input: { video?: AfterPlanVideo; listensToday: number; listenMinutes: number }): AfterPlan {
	if (input.video) {
		return {
			step: { kind: "watch", title: `Watch: ${input.video.title}`, line: "A video you added, line by line: listen first, then reveal", minutes: input.video.minutes, href: `/watch?id=${input.video.id}` },
			find: null,
		};
	}
	return {
		step: { kind: "listen", title: input.listensToday > 0 ? "Listen: ten more sentences" : "Listen: ten sentences", line: "New sentences you can follow, heard first and typed", minutes: input.listenMinutes, href: "/listen" },
		find: "/watch",
	};
}
