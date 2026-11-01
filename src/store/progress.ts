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
import type { TimedActivity } from "../core/active-time.ts";
import type { FirstTryStats } from "../core/first-try.ts";
import type { MixupRecord } from "../core/mixups.ts";
import type { WeakRecord } from "../core/weak-spots.ts";
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
	/** Mix-ups lessons finished (src/core/mixups.ts). */
	mixups?: number;
	/** Personal lessons finished (src/core/personal.ts). */
	personal?: number;
	talks?: number;
	stories?: number;
	/** Tutor-unit sessions started. */
	tutors?: number;
	/** Story episodes read (the Read task, src/server/reading.ts). */
	reads?: number;
	/** Listening sessions finished (the Listen task). */
	listens?: number;
	/** YouTube videos watched (the Watch task, src/server/watch.ts). */
	watches?: number;
	/** Spoken scenes finished (the Speak task, src/server/speak.ts). */
	speaks?: number;
	/** Timed re-reads of an episode (the fluency strand). */
	rereads?: number;
	/** "Say it faster" rounds finished (the fluency strand). */
	fasts?: number;
	/** Minutes spent practising: the sum of `minutesBy` plus any older,
	 *  unattributed time (from the client's timers). */
	minutes?: number;
	/** The same minutes per activity, measured while the learner was
	 *  active (src/core/active-time.ts). Absent on days before it was kept. */
	minutesBy?: Partial<Record<TimedActivity, number>>;
	/** End-of-day snapshots the trajectory draws from (src/core/trajectory.ts):
	 *  hours the map credits, units done on the whole map, words met (the
	 *  review deck). Rewritten whenever the summary is built, so the last
	 *  one of the day stands, and kept from the day they were first written. */
	hoursDone?: number;
	unitsDone?: number;
	words?: number;
	/** The day's plan as last shown: each task and whether it was done (carry-over). */
	planned?: Array<{ id: string; title: string; done: boolean }>;
}

/** The learner's goal and profile: the target level and planned minutes
 *  (src/core/curriculum.ts) plus what the setup wizard learns
 *  (src/core/onboarding.ts: purposes, first language, prior knowledge,
 *  placement). */
export type GoalRecord = LearnerGoal;

export interface UnitRecord extends FirstTryStats {
	/** Every rep answered: the path's evidence, the final answers (accents
	 *  and help included). */
	lessons: number;
	reps: number;
	correct: number;
	bestBlitz?: number;
	lastAt?: string;
	/** Written by the placement drill; both reps right tests the unit out. */
	placed?: boolean;
	/** The unaided first tries (`first`), and on a case drill those split by
	 *  gender column (`byGender`): FirstTryStats, src/core/first-try.ts. */
}

/** One chapter-exam attempt (Skúška, phase 6a, E14): the score, whether it
 *  passed the 80% mark, and the item ids answered wrong. Record only —
 *  nothing is gated on it yet. */
export interface ExamAttempt {
	at: string;
	score: number;
	total: number;
	passed: boolean;
	/** The item ids answered wrong, in exam order. */
	misses: string[];
}

export interface ProgressRecord {
	xp: number;
	dailyGoal: number;
	days: Record<string, DayRecord>;
	units: Record<string, UnitRecord>;
	/** Chapter-exam attempts, per chapter id, oldest first (the path reads
	 *  the best one; src/core/exam.ts examSummaries). */
	exams: Record<string, ExamAttempt[]>;
	/** Item ids of the last lessons, newest last (capped). */
	recent: string[];
	bestBlitz?: number;
	goal?: GoalRecord;
	/** Units the learner struggles with, flagged by the level check, lessons
	 *  or review and dropped once mended (src/core/weak-spots.ts). */
	weak?: WeakRecord;
	/** Pairs of words the learner gives one for the other, and the pairs
	 *  predicted from them (src/core/mixups.ts). */
	mixups?: MixupRecord;
	/** The latest lesson saves by the id the client sent (src/server/lesson.ts):
	 *  a retry of one of them is answered from here, not recorded again. */
	lessonAcks?: Array<{ id: string; outcome: { xp: number; correct: number; total: number; perfect: boolean; queued: string[]; newBest?: number } }>;
}

export const DEFAULT_DAILY_GOAL = 50;
export const DEFAULT_GOAL: GoalRecord = { level: "B2", minutesPerDay: 30 };

const FILE = () => path.join(PATHS.data, "progress.json");

export function emptyProgress(): ProgressRecord {
	return { xp: 0, dailyGoal: DEFAULT_DAILY_GOAL, days: {}, units: {}, exams: {}, recent: [] };
}

export const progressStore = {
	read(): ProgressRecord {
		try {
			const raw = JSON.parse(fs.readFileSync(FILE(), "utf-8")) as Partial<ProgressRecord>;
			return { ...emptyProgress(), ...raw, days: raw.days ?? {}, units: raw.units ?? {}, exams: raw.exams ?? {}, recent: raw.recent ?? [] };
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
