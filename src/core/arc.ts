/**
 * The chapter arc (2026-10-30): the seven steps every chapter
 * goes through, in the same order. Phase 1 says which units already provide
 * each step, computed from the map (allChapters() and curriculumUnits()), so no unit
 * list is copied here. A step with no unit is "not yet". Tutor units stay
 * outside the seven steps. Pure and browser-safe.
 */

import { allChapters, curriculumUnit } from "./curriculum.ts";
import type { Strand } from "./strands.ts";

type ArcStepId = "story" | "words" | "forms" | "pairs" | "scene" | "sound" | "exam";

/** "all": the exam draws on every strand. */
type ArcStrand = Strand | "all";

interface ArcStep {
	id: ArcStepId;
	/** The Slovak name the step is known by (Príbeh, Slová…). */
	slovak: string;
	english: string;
	strand: ArcStrand;
}

export const ARC_STEPS: ArcStep[] = [
	{ id: "story", slovak: "Príbeh", english: "Story", strand: "input" },
	{ id: "words", slovak: "Slová", english: "Words", strand: "form" },
	{ id: "forms", slovak: "Tvary", english: "Forms", strand: "form" },
	{ id: "pairs", slovak: "Dvojičky", english: "Pairs", strand: "form" },
	{ id: "scene", slovak: "Scéna", english: "Scene", strand: "output" },
	{ id: "sound", slovak: "Zvuk", english: "Sound", strand: "fluency" },
	{ id: "exam", slovak: "Skúška", english: "Exam", strand: "all" },
];

interface ChapterArcStep {
	step: ArcStep;
	/** The units that provide the step, in chapter order; empty while "not yet". */
	units: string[];
}

/** A chapter's seven steps. Words: its word units. Forms: its first grammar
 *  drill. Pairs: its Dvojičky units. Scene: its goal unit, whose scene it
 *  opens. Story: its chapter stories. Sound and exam have no unit yet. Undefined for an unknown
 *  chapter. */
export function chapterArc(chapterId: string): ChapterArcStep[] | undefined {
	const chapter = allChapters().find((c) => c.id === chapterId);
	if (!chapter) return undefined;
	const units = chapter.units.map((id) => curriculumUnit(id)!);
	const form = units.find((u) => u.kind === "drill" && !u.id.startsWith("lx-") && !u.id.startsWith("pairs-"));
	const goal = units.find((u) => u.kind === "goal");
	const provided: Record<ArcStepId, string[]> = {
		story: units.filter((u) => u.kind === "story").map((u) => u.id),
		words: units.filter((u) => u.kind === "words" || u.id.startsWith("lx-")).map((u) => u.id),
		forms: form ? [form.id] : [],
		pairs: units.filter((u) => u.id.startsWith("pairs-")).map((u) => u.id),
		scene: goal?.scene ? [goal.id] : [],
		sound: [],
		exam: [],
	};
	return ARC_STEPS.map((step) => ({ step, units: provided[step.id] }));
}
