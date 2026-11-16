/**
 * The personal lesson service (src/core/personal.ts): the targets the guide
 * named, kept with the guide in analysis.json, built into a lesson from the
 * lexicon's verified sentences (/lesson?mode=personal), and offered by the
 * daily plan while the guide is recent.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import type { LessonPlan } from "../core/lesson.ts";
import { buildPersonalLesson, type PersonalPractice } from "../core/personal.ts";
import { analysisStore } from "../store/analysis.ts";
import { progressStore } from "../store/progress.ts";
import { aspectFrames } from "./aspect-frames.ts";

/** The daily plan offers the personal lesson this long after the guide was written. */
const PERSONAL_PLAN_DAYS = 7;

/** The targets of the latest guide, or null. */
function personalPractice(): PersonalPractice | null {
	return analysisStore.read().guide?.practice ?? null;
}

/** The plan's view: the guide's first pattern, while the guide is recent. */
export function personalPlanEntry(now = new Date()): { focus: string } | null {
	const guide = analysisStore.read().guide;
	if (!guide?.practice || now.getTime() - Date.parse(guide.at) > PERSONAL_PLAN_DAYS * 86_400_000) return null;
	return { focus: guide.practice.focus[0] ?? "Your plan" };
}

export function personalLessonFor(seed = Date.now()): LessonPlan {
	const p = progressStore.read();
	return buildPersonalLesson(loadLexicon()?.entries ?? [], personalPractice(), p.mixups, {
		seed,
		recent: new Set(p.recent),
		frames: aspectFrames(),
	});
}
