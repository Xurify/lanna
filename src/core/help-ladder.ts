import type { ItemKind } from "./lesson.ts";

export type HelpStep = "translation" | "form" | "first-letter";

export interface HelpRep {
	kind: ItemKind;
	vocabulary: boolean;
	pairs: boolean;
	hidesMeaning: boolean;
	hasForm: boolean;
	retyped: boolean;
	task: boolean;
}

export function helpSteps(rep: HelpRep): HelpStep[] {
	if (rep.task) return [];
	const cloze = rep.kind === "type" || rep.kind === "choose";
	if (!cloze) return [];
	const typed = rep.kind === "type" || rep.retyped;
	const steps: HelpStep[] = [];
	if (rep.hidesMeaning) steps.push("translation");
	if (rep.hasForm && !rep.vocabulary && !rep.pairs) steps.push("form");
	if (typed) steps.push("first-letter");
	return steps;
}

export type HelpPrice = "half XP" | "no extra cost" | "used";

export function helpPrice(step: HelpStep, used: readonly HelpStep[], missed: boolean): HelpPrice {
	if (used.includes(step)) return "used";
	return used.length > 0 || missed ? "no extra cost" : "half XP";
}

export function firstLetterOf(answer: string): string {
	return [...answer.trim()][0] ?? "";
}
