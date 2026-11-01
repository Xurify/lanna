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
import type { FirstTryStats } from "../core/first-try.ts";
import { learnerProfileText, type LearnerGoal } from "../core/onboarding.ts";
import { RECENT_DAYS } from "../core/carry-over.ts";
import { dayKey } from "../core/review.ts";
import type { MixupRecord } from "../core/mixups.ts";
import type { WeakRecord } from "../core/weak-spots.ts";

interface ProgressFile {
	units?: Record<string, (UnitEvidence & FirstTryStats) | undefined>;
	goal?: LearnerGoal;
	weak?: WeakRecord;
	mixups?: MixupRecord;
	days?: Record<string, { minutes?: number } | undefined>;
}

/** Minutes a day actually logged over the last RECENT_DAYS days. */
function recentAverage(days: ProgressFile["days"], now = new Date()): number {
	let total = 0;
	for (let i = 0; i < RECENT_DAYS; i++) total += days?.[dayKey(new Date(now.getTime() - i * 86_400_000))]?.minutes ?? 0;
	return Math.round(total / RECENT_DAYS);
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
	const tries = Object.fromEntries(Object.entries(units).map(([id, u]) => [id, u?.first]));
	return learnerProfileText(goal, state, units, record.weak, { dailyAverage: recentAverage(record.days), days: RECENT_DAYS }, tries, record.mixups);
}
