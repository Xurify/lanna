/**
 * The learner profile block (LangHarness onboarding, 2026-10-28): the
 * goal, the pace, the first language, placement and the lesson ledger,
 * composed into every agent's system prompt so a session never has to
 * ask what the app already knows. The text is pure (src/core/
 * onboarding.ts learnerProfileText); this module only reads the profile's
 * progress.json — a config-anchored file, the same discipline as the
 * prompt-override reads in prompt-segments.ts (the agent layer never
 * imports the store adapters).
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { curriculumState, type UnitEvidence } from "../core/curriculum.ts";
import { learnerProfileText, type LearnerGoal } from "../core/onboarding.ts";
import type { WeakRecord } from "../core/weak-spots.ts";

interface ProgressFile {
	units?: Record<string, UnitEvidence | undefined>;
	goal?: LearnerGoal;
	weak?: WeakRecord;
}

/** The profile block, or null when nothing is known yet (a fresh profile
 *  with no goal and no lesson evidence). Read fresh on every call: the
 *  prompt composes per turn, and a lesson between turns changes it. */
export function learnerProfileSegment(): string | null {
	let record: ProgressFile;
	try {
		record = JSON.parse(fs.readFileSync(path.join(PATHS.data, "progress.json"), "utf-8")) as ProgressFile;
	} catch {
		return null;
	}
	const units = record.units ?? {};
	const goal = record.goal;
	const hasEvidence = Object.values(units).some((u) => u && u.reps > 0);
	if (!goal?.onboardedAt && !hasEvidence) return null;
	const state = curriculumState(units, goal?.level ?? "B2", { startChapter: goal?.startChapter });
	return learnerProfileText(goal, state, units, record.weak);
}
