/**
 * Stamps — turistické známky (LangHarness, 2026-11-02; docs/research/gamification.md, E31).
 *
 * On Slovak trails, every peak and hut sells a round wooden stamp, and
 * hikers collect them in a book. The app's stamps are the same idea: one
 * for every chapter finished and every level climbed, and one for each
 * real achievement on the way (a week of days, a thousand words you can recall, a
 * story read, a lesson without a miss). A stamp marks an outcome, never an
 * action: lessons started, buttons pressed and minutes alone earn nothing,
 * so there is nothing to game. Stamps carry no XP and unlock nothing; they
 * are a record, which is why they can be shown without becoming the reason
 * to practice (the overjustification problem).
 *
 * Pure functions: the catalog, each stamp's state against the evidence,
 * what was newly earned, what is closest. The server gathers the evidence
 * (src/server/stamps.ts) and keeps the days earned in progress.json.
 */

import { STAGES, type CurriculumState } from "./curriculum.ts";

export type StampKind = "first" | "chapter" | "summit" | "streak" | "words" | "reviews" | "perfect" | "comeback" | "balance" | "stories" | "scenes" | "listens" | "blitz" | "hours" | "exams";

export interface StampDef {
	id: string;
	kind: StampKind;
	/** The Slovak name pressed on the stamp. */
	name: string;
	/** What it marks, in English. */
	line: string;
	/** The count that earns it; 1 for a chapter, a summit or a first. */
	goal: number;
	/** The level, on a chapter or summit stamp. */
	level?: string;
	/** The stage, on a chapter or summit stamp (STAGES ids). */
	stage?: string;
}

/** What the stamps are judged on. Every number is an outcome on record. */
export interface StampEvidence {
	lessons: number;
	streakDays: number;
	wordsKnown: number;
	reviews: number;
	perfectLessons: number;
	/** Words once missed in review that are now known. */
	comebacks: number;
	/** The last seven days gave every kind of practice at least 15% of the time. */
	balancedWeek: boolean;
	storiesRead: number;
	scenesSpoken: number;
	listens: number;
	bestBlitz: number;
	/** Hours the map credits (src/core/curriculum.ts hoursDone). */
	hoursDone: number;
	examsPassed: number;
	/** Chapter id → 0..1 done (1 = done). */
	chapters: ReadonlyMap<string, number>;
	/** Stage id → 0..1 done (1 = every chapter done). */
	stages: ReadonlyMap<string, number>;
}

export interface StampState extends StampDef {
	/** The day it was earned (YYYY-MM-DD), or null. */
	earned: string | null;
	/** The count on record toward the goal. */
	have: number;
	/** 0..1 toward the goal. */
	progress: number;
}

const DEEDS: StampDef[] = [
	{ id: "first-step", kind: "first", name: "Prvý krok", line: "Your first lesson", goal: 1 },
	{ id: "streak-7", kind: "streak", name: "Týždeň na trati", line: "Seven days in a row", goal: 7 },
	{ id: "streak-30", kind: "streak", name: "Mesiac na trati", line: "Thirty days in a row", goal: 30 },
	{ id: "streak-100", kind: "streak", name: "Sto dní", line: "A hundred days in a row", goal: 100 },
	{ id: "streak-365", kind: "streak", name: "Rok na trati", line: "365 days in a row", goal: 365 },
	{ id: "words-50", kind: "words", name: "Prvé slová", line: "50 words you can recall", goal: 50 },
	{ id: "words-150", kind: "words", name: "Stopäťdesiat slov", line: "150 words you can recall", goal: 150 },
	{ id: "words-300", kind: "words", name: "Tristo slov", line: "300 words you can recall", goal: 300 },
	{ id: "words-600", kind: "words", name: "Šesťsto slov", line: "600 words you can recall", goal: 600 },
	{ id: "words-1000", kind: "words", name: "Tisíc slov", line: "1,000 words you can recall", goal: 1000 },
	{ id: "words-1500", kind: "words", name: "Tisícpäťsto slov", line: "1,500 words you can recall", goal: 1500 },
	{ id: "words-2000", kind: "words", name: "Dvetisíc slov", line: "2,000 words you can recall", goal: 2000 },
	{ id: "words-3000", kind: "words", name: "Tritisíc slov", line: "3,000 words you can recall", goal: 3000 },
	{ id: "reviews-100", kind: "reviews", name: "Sto opakovaní", line: "100 review answers", goal: 100 },
	{ id: "reviews-500", kind: "reviews", name: "Päťsto opakovaní", line: "500 review answers", goal: 500 },
	{ id: "reviews-1000", kind: "reviews", name: "Tisíc opakovaní", line: "1,000 review answers", goal: 1000 },
	{ id: "reviews-5000", kind: "reviews", name: "Päťtisíc opakovaní", line: "5,000 review answers", goal: 5000 },
	{ id: "perfect-1", kind: "perfect", name: "Bez chyby", line: "A lesson with every answer right", goal: 1 },
	{ id: "perfect-10", kind: "perfect", name: "Desať bez chyby", line: "Ten lessons without a miss", goal: 10 },
	{ id: "perfect-50", kind: "perfect", name: "Päťdesiat bez chyby", line: "Fifty lessons without a miss", goal: 50 },
	{ id: "comeback-10", kind: "comeback", name: "Návrat", line: "10 words once missed, now known", goal: 10 },
	{ id: "comeback-50", kind: "comeback", name: "Veľký návrat", line: "50 words once missed, now known", goal: 50 },
	{ id: "comeback-200", kind: "comeback", name: "Dvesto návratov", line: "200 words once missed, now known", goal: 200 },
	{ id: "balance-week", kind: "balance", name: "Štyri značky", line: "A week with all four kinds of practice", goal: 1 },
	{ id: "stories-1", kind: "stories", name: "Prvý príbeh", line: "Your first story read", goal: 1 },
	{ id: "stories-10", kind: "stories", name: "Čitateľ", line: "Ten stories read", goal: 10 },
	{ id: "stories-50", kind: "stories", name: "Knihomoľ", line: "Fifty stories read", goal: 50 },
	{ id: "scenes-1", kind: "scenes", name: "Prvé slová nahlas", line: "Your first scene said out loud", goal: 1 },
	{ id: "scenes-10", kind: "scenes", name: "Rečník", line: "Ten scenes said out loud", goal: 10 },
	{ id: "listens-10", kind: "listens", name: "Poslucháč", line: "Ten listening sessions", goal: 10 },
	{ id: "listens-50", kind: "listens", name: "Ostré uši", line: "Fifty listening sessions", goal: 50 },
	{ id: "blitz-20", kind: "blitz", name: "Blesk", line: "20 right in one Blitz", goal: 20 },
	{ id: "blitz-30", kind: "blitz", name: "Búrka", line: "30 right in one Blitz", goal: 30 },
	{ id: "hours-10", kind: "hours", name: "Desať hodín", line: "10 guided hours", goal: 10 },
	{ id: "hours-50", kind: "hours", name: "Päťdesiat hodín", line: "50 guided hours", goal: 50 },
	{ id: "hours-100", kind: "hours", name: "Sto hodín", line: "100 guided hours", goal: 100 },
	{ id: "hours-200", kind: "hours", name: "Dvesto hodín", line: "200 guided hours", goal: 200 },
	{ id: "hours-400", kind: "hours", name: "Štyristo hodín", line: "400 guided hours", goal: 400 },
	{ id: "hours-650", kind: "hours", name: "Šesťstopäťdesiat hodín", line: "650 guided hours", goal: 650 },
	{ id: "exams-1", kind: "exams", name: "Prvá skúška", line: "A chapter exam passed", goal: 1 },
	{ id: "exams-5", kind: "exams", name: "Päť skúšok", line: "Five chapter exams passed", goal: 5 },
	{ id: "exams-10", kind: "exams", name: "Desať skúšok", line: "Ten chapter exams passed", goal: 10 },
];

/** The fixed stamps: the deeds, in book order. */
export const DEED_STAMPS: readonly StampDef[] = DEEDS;

/** Every stamp there is for this learner: the deeds, a stamp per chapter
 *  and a summit stamp per level on the map. */
export function stampCatalog(curriculum: Pick<CurriculumState, "chapters"> | null): StampDef[] {
	const chapters = curriculum?.chapters ?? [];
	const stages = STAGES.filter((st) => chapters.some((ch) => ch.stage === st.id));
	const chapterStamps: StampDef[] = chapters.map((ch) => {
		const stage = STAGES.find((st) => st.id === ch.stage);
		return { id: `chapter:${ch.id}`, kind: "chapter", name: ch.title, line: `Chapter done · ${stage?.level ?? ""}`.trim(), goal: 1, level: stage?.level, stage: ch.stage };
	});
	const summitStamps: StampDef[] = stages.map((st) => ({ id: `summit:${st.id}`, kind: "summit", name: `${st.level} · ${st.title}`, line: `Every chapter of ${st.level} done`, goal: 1, level: st.level, stage: st.id }));
	return [...summitStamps, ...chapterStamps, ...DEEDS];
}

/** The number on record for a stamp's kind. */
export function stampCount(def: StampDef, e: StampEvidence): number {
	switch (def.kind) {
		case "first":
			return Math.min(1, e.lessons);
		case "chapter":
			return e.chapters.get(def.id.slice("chapter:".length)) ?? 0;
		case "summit":
			return e.stages.get(def.stage ?? "") ?? 0;
		case "streak":
			return e.streakDays;
		case "words":
			return e.wordsKnown;
		case "reviews":
			return e.reviews;
		case "perfect":
			return e.perfectLessons;
		case "comeback":
			return e.comebacks;
		case "balance":
			return e.balancedWeek ? 1 : 0;
		case "stories":
			return e.storiesRead;
		case "scenes":
			return e.scenesSpoken;
		case "listens":
			return e.listens;
		case "blitz":
			return e.bestBlitz;
		case "hours":
			return e.hoursDone;
		case "exams":
			return e.examsPassed;
	}
}

/**
 * Every stamp's state. `earned` holds the days on record; a stamp whose
 * goal the evidence meets but that is not on record yet is reported earned
 * `today`, so the caller can write it down (syncStamps). A stamp on record
 * stays earned even if the evidence later falls under its goal: a streak
 * broken does not un-earn the week it marked.
 */
export function stampStates(defs: readonly StampDef[], evidence: StampEvidence, earned: Readonly<Record<string, string>>, today: string): StampState[] {
	return defs.map((def) => {
		const have = stampCount(def, evidence);
		const met = have >= def.goal;
		const day = earned[def.id] ?? (met ? today : null);
		return { ...def, earned: day, have, progress: day ? 1 : Math.max(0, Math.min(1, def.goal > 0 ? have / def.goal : 0)) };
	});
}

/** The stamps earned now that were not on record before. */
export function newStamps(states: readonly StampState[], before: Readonly<Record<string, string>>): StampState[] {
	return states.filter((s) => s.earned && !(s.id in before));
}

/** The closest unearned stamps: the furthest along first, then the smaller goal. */
export function nextStamps(states: readonly StampState[], n = 3): StampState[] {
	return states
		.filter((s) => !s.earned)
		.sort((a, b) => b.progress - a.progress || a.goal - b.goal || a.name.localeCompare(b.name))
		.slice(0, n);
}

/** The stamps earned, newest first (ties keep book order: a summit before
 *  a chapter before a deed earned the same day). */
export function recentStamps(states: readonly StampState[], n = 3): StampState[] {
	return states
		.map((s, i) => ({ s, i }))
		.filter(({ s }) => s.earned)
		.sort((a, b) => (b.s.earned! < a.s.earned! ? -1 : b.s.earned! > a.s.earned! ? 1 : a.i - b.i))
		.map(({ s }) => s)
		.slice(0, n);
}

/** The longest run of consecutive practiced days on record. */
export function longestStreak(activeDays: ReadonlySet<string>): number {
	const days = [...activeDays].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
	let best = 0;
	let run = 0;
	let prev: number | null = null;
	for (const d of days) {
		const t = Date.parse(`${d}T00:00:00Z`);
		run = prev !== null && t - prev === 86_400_000 ? run + 1 : 1;
		prev = t;
		if (run > best) best = run;
	}
	return best;
}

/** The trail log: the totals a learner can be proud of, all outcomes. */
export interface TrailLog {
	/** Guided hours the map credits: a finished unit earns its share of its stage's hours, so this stays at 0 until the first unit is done. */
	hours: number;
	/** Minutes measured while the learner was active, all activities. */
	minutes: number;
	wordsKnown: number;
	daysActive: number;
	longestStreak: number;
	lessons: number;
	reviews: number;
	stories: number;
	scenes: number;
	listens: number;
	bestBlitz: number;
}
