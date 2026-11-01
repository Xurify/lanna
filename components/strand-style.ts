import type { PlanTask, Strand } from "@/src/core";

/**
 * One ink per strand (Nation's four strands, src/core/strands.ts), used by
 * the plan's tasks, the practice groups and the week's balance alike, so a
 * color on Today always means the same kind of practice.
 */
export const STRAND_STYLE: Record<Strand, { text: string; bar: string; tile: string; soft: string; border: string }> = {
	input: { text: "text-sky", bar: "bg-sky", tile: "bg-sky/15 text-sky", soft: "bg-sky/5 hover:bg-sky/10", border: "border-sky/40" },
	output: { text: "text-xp", bar: "bg-xp", tile: "bg-xp/15 text-xp", soft: "bg-xp/5 hover:bg-xp/10", border: "border-xp/40" },
	form: { text: "text-go", bar: "bg-go", tile: "bg-go/15 text-go", soft: "bg-go/5 hover:bg-go/10", border: "border-go/40" },
	fluency: { text: "text-gold", bar: "bg-gold", tile: "bg-gold/15 text-gold", soft: "bg-gold/5 hover:bg-gold/10", border: "border-gold/40" },
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
