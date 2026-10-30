/**
 * Lesson + progress service (LangHarness redesign) — behind /lesson,
 * /api/lesson and /api/progress. Lessons are built locally from the
 * lexicon (core/lesson.ts), so a rep never waits on a model. Finishing a
 * lesson records XP and the day, and every missed word goes into the
 * spaced-review deck, so the lesson and the review loop feed each other.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import {
	buildBlitz,
	buildLesson,
	CONTRAST,
	LESSON_BONUS,
	PERFECT_BONUS,
	repXp,
	streakOf,
	DAYS_IN_WEEK,
	unitDone,
	unitLevel,
	unitProgress,
	unitStage,
	UNITS,
	xpLevel,
	type ItemKind,
	type LessonPlan,
	type RepVerdict,
	type UnitId,
} from "../core/lesson.ts";
import { addMinutes, sessionMs, type TimedActivity } from "../core/active-time.ts";
import { dayKey } from "../core/review.ts";
import {
	CEFR_ORDER,
	curriculumState,
	curriculumUnit,
	dailyPlan,
	GUIDED_HOURS,
	hoursDone,
	nextLessonUnit,
	projection,
	STAGES,
	type Cefr,
	type CurriculumState,
	type DailyPlan,
	type Projection,
} from "../core/curriculum.ts";
import {
	DEFAULT_DAYS_PER_WEEK,
	bridgeLanguages,
	parallelsOn,
	DEFAULT_LANG_LEVEL,
	isLang,
	normalizeLangLevel,
	MAX_EXPLAIN,
	MAX_LANGUAGES,
	MAX_PURPOSE_NOTE,
	MAX_OTHER_LANGUAGE_LENGTH,
	MAX_OTHER_LANGUAGES,
	type Lang,
	type LangLevel,
	isPrior,
	isPurpose,
	MAX_MINUTES,
	MAX_PURPOSES,
	purposeScenes,
	placementTier,
	type PlacementOutcome,
} from "../core/onboarding.ts";
import { strandBalance, type StrandBalance } from "../core/strands.ts";
import type { TrajectoryDay, TrajectoryInput } from "../core/trajectory.ts";
import { carriedTasks, doneInLedger, RECENT_DAYS, type DayPlanSnapshot } from "../core/carry-over.ts";
import { appendLessonLog, type LessonLogRep } from "../store/corpus.ts";
import { clearWeak, flagWeak, lessonFlagsWeak, tallyWeak, weakSpotList, type WeakSpotSummary } from "../core/weak-spots.ts";
import { DEFAULT_GOAL, progressStore, type DayRecord, type GoalRecord, type ProgressRecord } from "../store/progress.ts";
import { reviewStore } from "../store/review.ts";
import { storyStore } from "../store/stories.ts";
import { videoStore } from "../store/videos.ts";
import { watchMinutes } from "../core/watch.ts";
import { enqueueWords, reviewStatus } from "./review.ts";

const RECENT_CAP = 240;
/** Days of history the trajectory draws. */
const TRAJECTORY_DAYS = 120;

function entries() {
	return loadLexicon()?.entries ?? [];
}

/**
 * The lesson for a unit, shaped by how far the learner is with it: a first
 * lesson recognises before it produces; once the unit holds (two lessons at
 * 60%+) almost every rep is typed. Either way some reps come from
 * neighbouring units the learner has reached (CONTRAST first), so the case
 * has to be chosen from the trigger rather than assumed from the lesson's
 * title — interleaving, which is what makes the choice stick.
 */
export function lessonFor(unit: UnitId, seed = Date.now()): LessonPlan {
	const progress = progressStore.read();
	const rec = progress.units[unit];
	const stage = unitStage(rec?.lessons ?? 0, rec && rec.reps > 0 ? rec.correct / rec.reps : null);
	const info = UNITS.find((u) => u.id === unit)!;
	const grammar = UNITS.filter((u) => u.kind !== "words" && !u.union && !u.pattern).map((u) => u.id);
	const reached = (u: UnitId) => (progress.units[u]?.lessons ?? 0) > 0 || grammar.indexOf(u) < grammar.indexOf(unit);
	const contrast = (CONTRAST[unit] ?? []).filter(reached);
	const others = grammar.filter((u) => u !== unit && !contrast.includes(u) && (progress.units[u]?.lessons ?? 0) > 0);
	// Vocabulary, word-order and mixed units are not interleaved with others:
	// the first two are a different kind of rep, the third is the mix itself.
	const mix = info.kind === "words" || info.union || info.pattern ? [] : [...contrast, ...others].slice(0, 3);
	return withKnown({ ...buildLesson(entries(), unit, { seed, recent: new Set(progress.recent), stage, mix }), bridges: parallelsOn(progress.goal) ? bridgeLanguages(progress.goal) : [] });
}

/** Attach what the review deck knows about each item's word: its own card,
 *  else the most-practised card of the same word, else null. */
function withKnown<T extends LessonPlan>(plan: T): T {
	const cards = Object.values(reviewStore.readCards());
	for (const item of plan.items) {
		const own = cards.find((c) => c.id === item.id);
		const card = own ?? cards.filter((c) => c.slug === item.slug).sort((a, b) => b.reps - a.reps)[0];
		item.known = card ? { state: card.state, due: card.due, reps: card.reps } : null;
	}
	return plan;
}

/** Blitz runs over the units you have started (at least the first three). */
export function blitzFor(seed = Date.now()): LessonPlan {
	const progress = progressStore.read();
	const started = UNITS.filter((u) => u.kind !== "words" && !u.union && !u.pattern && (progress.units[u.id]?.lessons ?? 0) > 0).map((u) => u.id);
	const units = started.length >= 2 ? started : (["present", "acc-fem", "loc"] as UnitId[]);
	return { ...buildBlitz(entries(), units, seed), bridges: parallelsOn(progress.goal) ? bridgeLanguages(progress.goal) : [] };
}

export interface RepResult {
	itemId: string;
	slug: string;
	kind: ItemKind;
	verdict: RepVerdict;
	/** Right on the second try, after the hint. */
	assisted?: boolean;
	/** What the learner saw and wrote — kept in the lesson log
	 *  (data/profiles/<language>/lessons/<day>.jsonl, store/corpus.ts) so a
	 *  lesson is a record, not just a score. Absent on old clients. */
	detail?: {
		unit?: string;
		lemma?: string;
		gloss?: string;
		sentence?: string;
		translation?: string;
		answer?: string;
		given?: string;
		hint?: string;
		trigger?: string;
		options?: string[];
		mixed?: boolean;
		again?: boolean;
	};
}

export interface LessonResultInput {
	unit: UnitId;
	mode: "lesson" | "blitz";
	reps: RepResult[];
	ms?: number;
	/** Active milliseconds since the last send (src/core/active-time.ts);
	 *  what the day's minutes count, `ms` stays the wall-clock for the log. */
	activeMs?: number;
	tz?: number;
}

export interface LessonOutcome {
	xp: number;
	correct: number;
	total: number;
	perfect: boolean;
	/** Missed words now queued in the review deck. */
	queued: string[];
	newBest?: number;
	summary: ProgressSummary;
}

function today(tz?: number, now = new Date()) {
	return dayKey(now, tz);
}

function dayOf(p: ProgressRecord, key: string): DayRecord {
	p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 };
	return p.days[key]!;
}

export function recordLesson(input: LessonResultInput, now = new Date()): LessonOutcome {
	const p = progressStore.read();
	const day = dayOf(p, today(input.tz, now));
	let combo = 0;
	let xp = 0;
	let correct = 0;
	for (const r of input.reps) {
		if (r.verdict === "wrong") combo = 0;
		else {
			combo++;
			correct++;
		}
		xp += repXp(r.kind, r.verdict, combo, r.assisted);
	}
	const total = input.reps.length;
	const perfect = total > 0 && input.reps.every((r) => r.verdict === "exact");
	const unit = (p.units[input.unit] ??= { lessons: 0, reps: 0, correct: 0 });
	let newBest: number | undefined;
	if (input.mode === "lesson") {
		if (total > 0) {
			xp += LESSON_BONUS + (perfect ? PERFECT_BONUS : 0);
			unit.lessons++;
			day.lessons++;
			day.units ??= {};
			day.units[input.unit] = (day.units[input.unit] ?? 0) + 1;
		}
	} else {
		day.blitz = (day.blitz ?? 0) + 1;
		if (correct > (p.bestBlitz ?? 0)) {
			p.bestBlitz = correct;
			newBest = correct;
		}
	}
	addMinutes(day, input.mode === "blitz" ? "blitz" : "lesson", sessionMs(input));
	unit.reps += total;
	unit.correct += correct;
	unit.lastAt = now.toISOString();
	// The weak-spots record (src/core/weak-spots.ts): every lesson rep counts
	// against a flagged unit, and a unit under the bar gets flagged.
	if (input.mode === "lesson" && total > 0) {
		const t = tallyWeak(p.weak ?? {}, input.unit, correct, total - correct, now);
		p.weak = t.weak;
		// This lesson under the bar flags the unit (a lesson just mended is not re-flagged by its own reps).
		if (!t.mended && !p.weak[input.unit] && lessonFlagsWeak(total, correct)) {
			p.weak = flagWeak(p.weak, input.unit, "lesson", `${Math.round((correct / total) * 100)}% right in lesson ${unit.lessons}`, now);
		}
	}
	day.reps += total;
	day.xp += xp;
	p.xp += xp;
	p.recent = [...p.recent, ...input.reps.map((r) => r.itemId.replace(/~again$/, ""))].slice(-RECENT_CAP);
	progressStore.write(p);
	// Every miss goes to the review deck — the lesson and the deck feed each other.
	const missed = [...new Set(input.reps.filter((r) => r.verdict !== "exact" || r.assisted).map((r) => r.slug))];
	const queued = missed.length ? enqueueWords(missed, now) : [];
	// The lesson itself — every sentence and answer — goes to the corpus
	// log; progress.json keeps only the totals.
	try {
		appendLessonLog({
			id: `lesson_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
			at: now.toISOString(),
			day: today(input.tz, now),
			unit: input.unit,
			mode: input.mode,
			ms: input.ms,
			xp,
			correct,
			total,
			perfect,
			queued,
			reps: input.reps.map(logRep),
		});
	} catch (err) {
		console.warn("[lesson] could not append the lesson log:", err instanceof Error ? err.message : err);
	}
	return { xp, correct, total, perfect, queued, newBest, summary: progressSummary(input.tz, now) };
}

function logRep(r: RepResult): LessonLogRep {
	const d = r.detail ?? {};
	return {
		itemId: r.itemId,
		kind: r.kind,
		unit: d.unit ?? "",
		slug: r.slug,
		lemma: d.lemma ?? "",
		gloss: d.gloss ?? "",
		sentence: d.sentence ?? "",
		translation: d.translation ?? "",
		answer: d.answer ?? "",
		given: d.given ?? "",
		verdict: r.verdict,
		assisted: r.assisted === true,
		...(d.hint ? { hint: d.hint } : {}),
		...(d.trigger ? { trigger: d.trigger } : {}),
		...(d.options ? { options: d.options } : {}),
		...(d.mixed ? { mixed: true } : {}),
		...(d.again ? { again: true } : {}),
	};
}

/** A review answer counts toward XP and the day (called by /api/review). */
export function recordReviewXp(verdict: RepVerdict, tz?: number, now = new Date(), ms?: number, activeMs?: number): number {
	const p = progressStore.read();
	const day = dayOf(p, today(tz, now));
	const xp = verdict === "exact" ? 8 : verdict === "accents" ? 4 : 1;
	day.xp += xp;
	day.reviews++;
	addMinutes(day, "review", sessionMs({ ms, activeMs }));
	p.xp += xp;
	progressStore.write(p);
	return xp;
}

/** Active time that no finished session carries: a lesson or card left
 *  unfinished, a tab closed mid-session (the client sends it on leaving).
 *  Adds minutes only; counts and XP wait for a session that finishes. */
export function recordActiveTime(activity: TimedActivity, ms: number, tz?: number, now = new Date()): number {
	const p = progressStore.read();
	const day = dayOf(p, today(tz, now));
	const added = addMinutes(day, activity, ms);
	progressStore.write(p);
	return added;
}

export type Activity = "talk" | "story" | "tutor";

/** A Talk, a Story or a tutor unit's session was started: the day's plan
 *  counts it as the speaking task; a tutor unit counts the session toward
 *  the unit (TUTOR_SESSIONS of them complete it). */
export function recordActivity(activity: Activity, unit?: string, tz?: number, now = new Date()): ProgressSummary {
	const p = progressStore.read();
	const day = dayOf(p, today(tz, now));
	if (activity === "talk") day.talks = (day.talks ?? 0) + 1;
	else if (activity === "story") day.stories = (day.stories ?? 0) + 1;
	else {
		day.tutors = (day.tutors ?? 0) + 1;
		if (unit && curriculumUnit(unit)?.kind === "tutor") {
			const u = (p.units[unit] ??= { lessons: 0, reps: 0, correct: 0 });
			u.lessons++;
			u.lastAt = now.toISOString();
		}
	}
	progressStore.write(p);
	return progressSummary(tz, now);
}

export interface UnitSummary {
	id: UnitId;
	title: string;
	tagline: string;
	glyph: string;
	rule: string;
	lessons: number;
	/** Reps answered in this unit, and the share right — the evidence the
	 *  path shows instead of a guessed level. */
	reps: number;
	level: number;
	/** 0..1 toward completion (see unitDone). */
	progress: number;
	done: boolean;
	accuracy: number | null;
}

export interface ProgressSummary {
	xp: number;
	level: { level: number; into: number; span: number };
	todayXp: number;
	dailyGoal: number;
	streak: { days: number; restUsed: boolean; activeToday: boolean };
	/** The last 7 days, oldest first, for the week strip. */
	week: Array<{ day: string; xp: number }>;
	units: UnitSummary[];
	/** The unit the Continue button opens. */
	next: UnitId;
	bestBlitz: number;
	review: { due: number; newLeft: number; total: number; available: boolean };
	/** The whole A1→B2 map and where the learner stands on it. */
	curriculum: CurriculumState;
	/** Today's tasks on that map. */
	plan: DailyPlan;
	goal: GoalRecord;
	projection: Projection;
	/** This week's minutes by Nation's four strands, against a quarter each. */
	balance: StrandBalance;
	/** What the projected graph draws from (src/core/trajectory.ts). */
	trajectory: TrajectoryInput;
	/** The units on record as weak spots (src/core/weak-spots.ts), most urgent first. */
	weakSpots: WeakSpotSummary[];
	/** The goal's daily minutes against what the last `windowDays` days logged. */
	pace: { goalMinutes: number; plannedMinutes: number; logged: number; windowDays: number; dailyAverage: number };
	/** Unfinished plan tasks from the last RECENT_DAYS days (src/core/carry-over.ts). */
	backlog: number;
}

/** The video the daily plan should show: the one watched today (so the
 *  task reads as done), else the newest added and not watched yet;
 *  undefined when neither exists. */
function pendingWatch(day: string): { id: string; title: string; minutes: number; coverage: number } | undefined {
	try {
		const watches = videoStore.watches();
		const library = videoStore.list();
		const todays = watches.filter((w) => w.day === day).at(-1);
		const watched = new Set(watches.map((w) => w.videoId));
		const v = (todays && library.find((e) => e.id === todays.videoId)) ?? [...library].reverse().find((e) => !watched.has(e.id));
		return v ? { id: v.id, title: v.title, minutes: watchMinutes(v.durationSec), coverage: v.coverage } : undefined;
	} catch {
		return undefined;
	}
}

/** Day of the year for a local YYYY-MM-DD key, so rotation turns at local midnight. */
function dayOfYearOf(key: string): number {
	const [y, m, d] = key.split("-").map(Number) as [number, number, number];
	return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
}

export function progressSummary(tz?: number, now = new Date()): ProgressSummary {
	const p = progressStore.read();
	const key = today(tz, now);
	const active = new Set(Object.entries(p.days).filter(([, d]) => d.xp > 0 || (d.talks ?? 0) + (d.stories ?? 0) + (d.tutors ?? 0) > 0).map(([k]) => k));
	const week: Array<{ day: string; xp: number }> = [];
	for (let i = 6; i >= 0; i--) {
		const d = dayKey(new Date(now.getTime() - i * 86_400_000), tz);
		week.push({ day: d, xp: p.days[d]?.xp ?? 0 });
	}
	const units: UnitSummary[] = UNITS.map((u) => {
		const r = p.units[u.id];
		const lessons = r?.lessons ?? 0;
		const accuracy = r && r.reps > 0 ? r.correct / r.reps : null;
		return {
			id: u.id,
			title: u.title,
			tagline: u.tagline,
			glyph: u.glyph,
			rule: u.rule,
			lessons,
			reps: r?.reps ?? 0,
			level: unitLevel(lessons),
			progress: unitProgress(lessons, accuracy),
			done: unitDone(lessons, accuracy),
			accuracy,
		};
	});
	// Continue = the first open drill on the map (then a words unit): the
	// curriculum's chapter order, with locks. Never dead-ends.
	const goal = p.goal ?? DEFAULT_GOAL;
	const curriculum = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	const next = nextLessonUnit(curriculum);
	const rs = reviewStatus(now, tz, { mint: false });
	const review = {
		due: rs.counts.due + rs.counts.learning,
		newLeft: rs.counts.newLeft,
		total: rs.counts.total,
		available: rs.available,
	};
	const d = p.days[key];
	const earlier: DayPlanSnapshot[] = [];
	for (let i = 1; i <= RECENT_DAYS; i++) {
		const day = dayKey(new Date(now.getTime() - i * 86_400_000), tz);
		const record = p.days[day];
		if (record?.planned) earlier.push({ day, tasks: record.planned.map((t) => ({ ...t, done: t.done || doneInLedger(t.id, record) })) });
	}
	const carried = carriedTasks(earlier, key, new Set());
	const plan = dailyPlan({
		state: curriculum,
		evidence: p.units,
		day: { units: d?.units ?? {}, reviews: d?.reviews ?? 0, blitz: d?.blitz ?? 0, talks: d?.talks ?? 0, stories: d?.stories ?? 0, tutors: d?.tutors ?? 0, reads: d?.reads ?? 0, listens: d?.listens ?? 0, watches: d?.watches ?? 0, speaks: d?.speaks ?? 0, rereads: d?.rereads ?? 0, fasts: d?.fasts ?? 0 },
		review,
		minutesPerDay: goal.minutesPerDay,
		next,
		dayOfYear: dayOfYearOf(key),
		scenes: purposeScenes(goal.purposes ?? []),
		weak: weakSpotList(p.weak).map((w) => w.unit),
		// A timed re-read needs an episode read on an earlier day.
		reread: storyStore.reads().some((r) => r.day < key),
		watch: pendingWatch(key),
		carried: carried.map((c) => ({ id: c.id, from: c.from })),
	});
	const snapshot = plan.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done }));
	const todayRecord = (p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	if (JSON.stringify(todayRecord.planned) !== JSON.stringify(snapshot)) {
		todayRecord.planned = snapshot;
		progressStore.write(p);
	}
	const backlog = plan.tasks.filter((t) => t.from).length;
	const recentMinutes: number[] = [];
	for (let i = 13; i >= 0; i--) recentMinutes.push(p.days[dayKey(new Date(now.getTime() - i * 86_400_000), tz)]?.minutes ?? 0);
	// The week by strand (src/core/strands.ts): the last seven days' ledgers.
	const balance = strandBalance(week.map((w) => p.days[w.day]).filter((x): x is DayRecord => !!x));
	const stageIds = new Set(STAGES.filter((s) => CEFR_ORDER.indexOf(s.level) <= CEFR_ORDER.indexOf(goal.level)).map((s) => s.id));
	const toTarget = curriculum.chapters.filter((c) => stageIds.has(c.stage));
	const wordsNow = Object.values(reviewStore.readCards()).filter((c) => !c.suspended).length;
	if (todayRecord.words !== wordsNow) {
		todayRecord.words = wordsNow;
		progressStore.write(p);
	}
	const trajectoryDays: TrajectoryDay[] = [];
	for (let i = TRAJECTORY_DAYS - 1; i >= 0; i--) {
		const day = dayKey(new Date(now.getTime() - i * 86_400_000), tz);
		const r = p.days[day];
		trajectoryDays.push({ day, minutes: r?.minutes ?? 0, lessons: Object.values(r?.units ?? {}).reduce((a, b) => a + b, 0), words: r?.words ?? null });
	}
	let loggedRecent = 0;
	for (let i = 0; i < RECENT_DAYS; i++) loggedRecent += p.days[dayKey(new Date(now.getTime() - i * 86_400_000), tz)]?.minutes ?? 0;
	return {
		xp: p.xp,
		level: xpLevel(p.xp),
		todayXp: p.days[key]?.xp ?? 0,
		dailyGoal: p.dailyGoal,
		streak: streakOf(active, key, Math.max(0, DAYS_IN_WEEK - (goal.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK))),
		week,
		units,
		next,
		bestBlitz: p.bestBlitz ?? 0,
		review,
		curriculum,
		plan,
		goal,
		projection: projection(curriculum, { target: goal.level, minutesPerDay: goal.minutesPerDay, daysPerWeek: goal.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK, recentMinutes, now }),
		balance,
		trajectory: {
			days: trajectoryDays,
			hoursDone: hoursDone(curriculum),
			hoursTarget: GUIDED_HOURS[goal.level],
			unitsDone: toTarget.reduce((n, c) => n + c.doneCount, 0),
			unitsTotal: toTarget.reduce((n, c) => n + c.total, 0),
			wordsNow,
			goalMinutes: goal.minutesPerDay,
			goalDays: goal.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK,
		},
		weakSpots: weakSpotList(p.weak),
		pace: { goalMinutes: goal.minutesPerDay, plannedMinutes: plan.minutes, logged: Math.round(loggedRecent), windowDays: RECENT_DAYS, dailyAverage: Math.round(loggedRecent / RECENT_DAYS) },
		backlog,
	};
}

/**
 * Change the goal: the target level and planned minutes (the old inline
 * form) or the whole profile the setup wizard writes (purposes, the
 * languages, prior knowledge, days a week). Every field is
 * validated here; unknown values keep what was there. `onboardedAt` is
 * stamped the first time the wizard saves (or is skipped), so the Today
 * page stops redirecting to it.
 */
export function setGoal(goal: Partial<GoalRecord> & { onboarded?: boolean }, tz?: number, now = new Date()): ProgressSummary {
	const p = progressStore.read();
	const cur = p.goal ?? DEFAULT_GOAL;
	const level = goal.level && CEFR_ORDER.includes(goal.level) ? (goal.level as Cefr) : cur.level;
	const minutesPerDay = typeof goal.minutesPerDay === "number" && Number.isFinite(goal.minutesPerDay) ? Math.max(5, Math.min(MAX_MINUTES, Math.round(goal.minutesPerDay))) : cur.minutesPerDay;
	const daysPerWeek = typeof goal.daysPerWeek === "number" && Number.isFinite(goal.daysPerWeek) ? Math.max(1, Math.min(7, Math.round(goal.daysPerWeek))) : (cur.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK);
	const next: GoalRecord = { ...cur, level, minutesPerDay, daysPerWeek };
	if (Array.isArray(goal.purposes)) next.purposes = [...new Set(goal.purposes.filter(isPurpose))].slice(0, MAX_PURPOSES);
	if (typeof goal.purposeNote === "string") {
		const note = goal.purposeNote.trim().slice(0, MAX_PURPOSE_NOTE);
		if (note) next.purposeNote = note;
		else delete next.purposeNote;
	}
	if (typeof goal.showParallels === "boolean") {
		if (goal.showParallels) delete next.showParallels;
		else next.showParallels = false;
	}
	if (Array.isArray(goal.languages)) {
		next.languages = [...new Set(goal.languages.filter(isLang))].slice(0, MAX_LANGUAGES);
		delete next.firstLanguage;
		delete next.bridges;
	}
	if (goal.languageLevels && typeof goal.languageLevels === "object") {
		const known = next.languages ?? [];
		const levels: Partial<Record<Lang, LangLevel>> = {};
		for (const [k, v] of Object.entries(goal.languageLevels)) {
			const lv = normalizeLangLevel(v);
			if (isLang(k) && known.includes(k) && lv && lv !== DEFAULT_LANG_LEVEL) levels[k] = lv;
		}
		if (Object.keys(levels).length) next.languageLevels = levels;
		else delete next.languageLevels;
	} else if (next.languageLevels && next.languages) {
		// Languages that left the list take their level with them.
		for (const k of Object.keys(next.languageLevels) as Lang[]) if (!next.languages.includes(k)) delete next.languageLevels[k];
	}
	if (Array.isArray(goal.otherLanguages)) {
		next.otherLanguages = [...new Set(goal.otherLanguages.filter((v): v is string => typeof v === "string").map((v) => v.trim().slice(0, MAX_OTHER_LANGUAGE_LENGTH)).filter(Boolean))].slice(0, MAX_OTHER_LANGUAGES);
	}
	if (goal.explainIn !== undefined) {
		const known = next.languages ?? [];
		const raw = Array.isArray(goal.explainIn) ? goal.explainIn : [goal.explainIn];
		const list = [...new Set(raw.filter((l): l is Lang => isLang(l) && (l === "en" || known.includes(l))))].slice(0, MAX_EXPLAIN);
		if (list.length === 0 || (list.length === 1 && list[0] === "en")) delete next.explainIn;
		else next.explainIn = list;
	}
	if (isPrior(goal.prior)) next.prior = goal.prior;
	if (goal.onboarded && !next.onboardedAt) next.onboardedAt = now.toISOString();
	p.goal = next;
	progressStore.write(p);
	return progressSummary(tz, now);
}

// ─── Placement: recording the check ─────────────────────────────────────────

export interface PlacementResultInput {
	/** The outcome the three stages folded into (src/server/placement.ts). */
	outcome: PlacementOutcome;
	/** Every ladder item answered, for the lesson log. */
	reps: Array<RepResult & { tier: string }>;
	ms?: number;
	activeMs?: number;
	tz?: number;
	/** The Socratic stage's closing line. */
	note?: string;
	/** The vocabulary-size estimate, when the learner did the word check. */
	vocabulary?: GoalRecord["vocabulary"];
	/** Why each missed unit was missed, in the tutor's or the judge's words
	 *  (src/server/placement.ts), for the weak-spots record. */
	weakNotes?: Partial<Record<UnitId, string>>;
}

export interface PlacementResult extends PlacementOutcome {
	summary: ProgressSummary;
}

/**
 * Record a finished placement: the outcome is written into the units
 * ledger as placed evidence (every rep right = tested out; a miss = a weak
 * unit the daily plan will strengthen), the goal remembers the level and
 * the chapter to start in, and every rep goes to the lesson log like a
 * lesson's. No XP: it is a measurement. A re-check replaces the earlier
 * placement's evidence only on the tiers it asked again (`outcome.from`);
 * a unit with lessons behind it keeps its lesson evidence untouched.
 */
export function recordPlacement(input: PlacementResultInput, now = new Date()): PlacementResult {
	const p = progressStore.read();
	const { outcome } = input;
	const asked = new Set(outcome.tiers.filter((t) => !t.held).flatMap((t) => placementTier(t.id)?.units ?? []));
	for (const [id, rec] of Object.entries(p.units)) if (rec.placed && rec.lessons === 0 && asked.has(id as UnitId)) delete p.units[id];
	let weak = p.weak ?? {};
	for (const [id, e] of Object.entries(outcome.units)) {
		// The check's word on a unit it asked about: a miss flags it, a clean
		// run clears it, whatever flagged it before.
		if (e.reps > 0 && e.correct < e.reps) weak = flagWeak(weak, id, "check", input.weakNotes?.[id as UnitId] ?? `${e.correct} of ${e.reps} right in the check`, now);
		else if (e.reps > 0) weak = clearWeak(weak, id);
		const rec = p.units[id];
		if (rec && rec.lessons > 0) continue;
		p.units[id] = { lessons: 0, reps: e.reps, correct: e.correct, placed: true, lastAt: now.toISOString() };
	}
	p.weak = weak;
	const goal = { ...(p.goal ?? DEFAULT_GOAL) };
	goal.placedAt = now.toISOString();
	goal.placedLevel = outcome.level;
	goal.startChapter = outcome.startChapter;
	if (input.note) goal.placedNote = input.note;
	else delete goal.placedNote;
	if (input.vocabulary) goal.vocabulary = input.vocabulary;
	p.goal = goal;
	const day = dayOf(p, today(input.tz, now));
	addMinutes(day, "placement", sessionMs(input));
	progressStore.write(p);
	try {
		appendLessonLog({
			id: `placement_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
			at: now.toISOString(),
			day: today(input.tz, now),
			unit: "placement",
			mode: "placement",
			ms: input.ms,
			xp: 0,
			correct: input.reps.filter((r) => r.verdict !== "wrong").length,
			total: input.reps.length,
			perfect: false,
			queued: [],
			reps: input.reps.map(logRep),
		});
	} catch (err) {
		console.warn("[placement] could not append the lesson log:", err instanceof Error ? err.message : err);
	}
	return { ...outcome, summary: progressSummary(input.tz, now) };
}

export function setDailyGoal(goal: number): ProgressSummary {
	const p = progressStore.read();
	if (Number.isFinite(goal)) p.dailyGoal = Math.max(10, Math.min(500, Math.round(goal)));
	progressStore.write(p);
	return progressSummary();
}
