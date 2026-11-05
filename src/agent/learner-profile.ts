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
import { activeProfile, PATHS, shownProfiles, withProfile } from "../../config.ts";
import { curriculumState, STAGES, type UnitEvidence } from "../core/curriculum.ts";
import type { FirstTryStats } from "../core/first-try.ts";
import { LEARNER_FIELDS, learnerProfileText, withLearnerFields, type LearnerFields, type LearnerGoal, type StudiedLanguage } from "../core/onboarding.ts";
import { activeLanguage, profileLanguage } from "./profile-language.ts";
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

function readProgress(): ProgressFile | null {
	try {
		return JSON.parse(fs.readFileSync(path.join(PATHS.data, "progress.json"), "utf-8")) as ProgressFile;
	} catch {
		return null;
	}
}

/** What the learner knows, shared by every language (src/store/learner.ts
 *  writes it), laid over the language's goal. */
function withShared(goal: LearnerGoal | undefined): LearnerGoal | undefined {
	if (!goal) return goal;
	try {
		const raw = JSON.parse(fs.readFileSync(path.join(PATHS.base, "learner.json"), "utf-8")) as Record<string, unknown>;
		const fields = Object.fromEntries(LEARNER_FIELDS.filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]])) as LearnerFields;
		return withLearnerFields(goal, fields);
	} catch {
		return goal;
	}
}

/** The other languages in the learner's list, each where it stands on its
 *  own map, read by borrowing it (config.ts withProfile). */
function otherStudied(): StudiedLanguage[] {
	const running = activeProfile();
	return shownProfiles()
		.filter((id) => id !== running)
		.flatMap((id) => {
			const english = profileLanguage(id)?.english;
			if (!english) return [];
			return withProfile(id, (): StudiedLanguage[] => {
				const record = readProgress();
				const goal = record?.goal;
				if (!goal?.onboardedAt) return [{ english }];
				const state = curriculumState(record?.units ?? {}, goal.level, { startChapter: goal.startChapter });
				const stage = STAGES.find((s) => s.id === state.chapters.find((c) => c.id === state.current)?.stage);
				return [{ english, working: stage?.level ?? "A1", target: goal.level, ...(goal.placedLevel ? { placed: goal.placedLevel } : {}) }];
			});
		});
}

/** The profile block, or null when nothing is known yet (a fresh profile
 *  with no goal and no lesson evidence). Read fresh on every call: the
 *  prompt composes per turn, and a lesson between turns changes it. */
export function learnerProfileSegment(): string | null {
	const record = readProgress();
	if (!record) return null;
	const units = record.units ?? {};
	const goal = withShared(record.goal);
	const hasEvidence = Object.values(units).some((u) => u && u.reps > 0);
	if (!goal?.onboardedAt && !hasEvidence) return null;
	const state = curriculumState(units, goal?.level ?? "B2", { startChapter: goal?.startChapter });
	const tries = Object.fromEntries(Object.entries(units).map(([id, u]) => [id, u?.first]));
	return learnerProfileText(activeLanguage(), goal, state, units, record.weak, { dailyAverage: recentAverage(record.days), days: RECENT_DAYS }, tries, record.mixups, otherStudied());
}
