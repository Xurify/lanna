/**
 * Progress persistence (LangHarness redesign) — the active profile's
 * data/profiles/<language>/progress.json: XP, the days you practised,
 * each unit's lessons and best blitz, and the item ids of recent lessons
 * (so the next lesson picks fresh sentences). One small JSON file,
 * read-modify-write with an atomic rename like review/cards.json.
 *
 * The only module that touches progress.json. Pure math: src/core/lesson.ts.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { LearnerGoal } from "../core/onboarding.ts";

export interface DayRecord {
	xp: number;
	lessons: number;
	reps: number;
	reviews: number;
	/** Lessons finished that day, per unit (the daily plan's evidence). */
	units?: Record<string, number>;
	blitz?: number;
	talks?: number;
	stories?: number;
	/** Tutor-unit sessions started. */
	tutors?: number;
	/** Minutes spent in lessons and review (from the client's timers). */
	minutes?: number;
}

/** The learner's goal and profile: the target level and planned minutes
 *  (src/core/curriculum.ts) plus what the setup wizard learns
 *  (src/core/onboarding.ts: purposes, first language, prior knowledge,
 *  placement). */
export type GoalRecord = LearnerGoal;

export interface UnitRecord {
	lessons: number;
	reps: number;
	correct: number;
	bestBlitz?: number;
	lastAt?: string;
	/** Written by the placement drill; both reps right tests the unit out. */
	placed?: boolean;
}

export interface ProgressRecord {
	xp: number;
	dailyGoal: number;
	days: Record<string, DayRecord>;
	units: Record<string, UnitRecord>;
	/** Item ids of the last lessons, newest last (capped). */
	recent: string[];
	bestBlitz?: number;
	goal?: GoalRecord;
}

export const DEFAULT_DAILY_GOAL = 50;
export const DEFAULT_GOAL: GoalRecord = { level: "B2", minutesPerDay: 30 };

const FILE = () => path.join(PATHS.data, "progress.json");

export function emptyProgress(): ProgressRecord {
	return { xp: 0, dailyGoal: DEFAULT_DAILY_GOAL, days: {}, units: {}, recent: [] };
}

export const progressStore = {
	read(): ProgressRecord {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<ProgressRecord>;
			return { ...emptyProgress(), ...raw, days: raw.days ?? {}, units: raw.units ?? {}, recent: raw.recent ?? [] };
		} catch {
			return emptyProgress();
		}
	},
	write(record: ProgressRecord): void {
		const file = FILE();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		const tmp = `${file}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(record), "utf-8");
		fs.renameSync(tmp, file);
	},
};
