import type { PlanTask, Strand } from "@/src/core";

/**
 * One trail color per strand (Nation's four strands, src/core/strands.ts),
 * the four colors Slovak hiking trails are blazed in: input red, speaking
 * blue, words & rules green, speed yellow (trail design, 2026-11-02,
 * docs/research/trail-design.md). The plan's tasks, the practice groups,
 * the week's balance and the trail marks (components/trail.tsx) all read
 * these, so a color on Today always means the same kind of practice.
 */
export const STRAND_STYLE: Record<Strand, { text: string; bar: string; tile: string; soft: string; border: string; stripe: string }> = {
	input: { text: "text-trail-red", bar: "bg-trail-red", tile: "bg-trail-red/15 text-trail-red", soft: "bg-trail-red/5 hover:bg-trail-red/10", border: "border-trail-red/40", stripe: "var(--lh-trail-red)" },
	output: { text: "text-trail-blue", bar: "bg-trail-blue", tile: "bg-trail-blue/15 text-trail-blue", soft: "bg-trail-blue/5 hover:bg-trail-blue/10", border: "border-trail-blue/40", stripe: "var(--lh-trail-blue)" },
	form: { text: "text-trail-green", bar: "bg-trail-green", tile: "bg-trail-green/15 text-trail-green", soft: "bg-trail-green/5 hover:bg-trail-green/10", border: "border-trail-green/40", stripe: "var(--lh-trail-green)" },
	fluency: { text: "text-trail-yellow", bar: "bg-trail-yellow", tile: "bg-trail-yellow/15 text-trail-yellow", soft: "bg-trail-yellow/5 hover:bg-trail-yellow/10", border: "border-trail-yellow/40", stripe: "var(--lh-trail-yellow)" },
};

/** The strand a plan task counts toward, as the week's balance counts it. */
export function taskStrand(task: Pick<PlanTask, "id" | "via">): Strand {
	switch (task.id) {
		case "listen":
		case "read":
		case "watch":
			return "input";
		case "speak":
			return task.via === "tutor" ? "form" : "output";
		case "fluency":
		case "blitz":
			return "fluency";
		default:
			return "form";
	}
}
