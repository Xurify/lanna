/**
 * The chapter arc (LangHarness, 2026-10-30): the seven steps every chapter
 * goes through, in the same order. Phase 1 says which units already provide
 * each step, computed from the map (CHAPTERS and CURRICULUM), so no unit
 * list is copied here. A step with no unit is "not yet". Tutor units stay
 * outside the seven steps. Pure and browser-safe.
 */

import { CHAPTERS, curriculumUnit } from "./curriculum.ts";
import type { Strand } from "./strands.ts";

export type ArcStepId = "story" | "words" | "forms" | "pairs" | "scene" | "sound" | "exam";

/** "all": the exam draws on every strand. */
export type ArcStrand = Strand | "all";

export interface ArcStep {
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

export interface ChapterArcStep {
	step: ArcStep;
	/** The units that provide the step, in chapter order; empty while "not yet". */
	units: string[];
}

/** A chapter's seven steps. Words: its word units. Forms: its first grammar
 *  drill. Pairs: its Dvojičky units. Scene: its goal unit, whose scene it
 *  opens. Story, sound and exam have no unit yet. Undefined for an unknown
 *  chapter. */
export function chapterArc(chapterId: string): ChapterArcStep[] | undefined {
	const chapter = CHAPTERS.find((c) => c.id === chapterId);
	if (!chapter) return undefined;
	const units = chapter.units.map((id) => curriculumUnit(id)!);
	const form = units.find((u) => u.kind === "drill" && !u.id.startsWith("lx-") && !u.id.startsWith("pairs-"));
	const goal = units.find((u) => u.kind === "goal");
	const provided: Record<ArcStepId, string[]> = {
		story: [],
		words: units.filter((u) => u.kind === "words" || u.id.startsWith("lx-")).map((u) => u.id),
		forms: form ? [form.id] : [],
		pairs: units.filter((u) => u.id.startsWith("pairs-")).map((u) => u.id),
		scene: goal?.scene ? [goal.id] : [],
		sound: [],
		exam: [],
	};
	return ARC_STEPS.map((step) => ({ step, units: provided[step.id] }));
}
