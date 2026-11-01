/**
 * My mistakes (LangHarness, 2026-11-01): what the lesson log says about
 * where the learner goes wrong and whether it is getting better. Pure and
 * browser-safe: it reads the logged reps and the mix-up record and returns
 * plain numbers, no model call. The page (`/mistakes`) saves the result as
 * a snapshot with its time, and the optional guide is written from it.
 *
 * Only first tries count (src/core/first-try.ts: the answer before any cue
 * or peek, never the retry at the end of the lesson, never a meaning check
 * or a word bank), so a miss that came back right on the second try still
 * shows. A Mix-ups lesson is kept out of the unit figures: its reps are
 * pairs of words, picked because they were already missed.
 */

import { countsAsFirstTry } from "./first-try.ts";
import { FORM_SLIPS, type FormSlip } from "./form-slip.ts";
import { isUnitId, unitInfo } from "./lesson.ts";
import { mixupList, type MixupRecord, type MixupSummary } from "./mixups.ts";

/** The part of a logged lesson the analysis reads. */
export interface LoggedLesson {
	at: string;
	mode: string;
	reps: Array<{
		kind: string;
		unit: string;
		slug: string;
		lemma: string;
		answer: string;
		again?: boolean;
		first?: { given: string; verdict: "exact" | "accents" | "wrong"; peeked?: boolean };
		slip?: FormSlip;
	}>;
}

export type Trend = "better" | "worse" | "steady" | "new";

export interface UnitTrend {
	unit: string;
	title: string;
	reps: number;
	wrong: number;
	accuracy: number;
	/** The last TREND_DAYS days against the days before, when both have enough reps. */
	recent: number | null;
	earlier: number | null;
	trend: Trend;
	slips: Partial<Record<FormSlip, number>>;
}

export interface MissedWord {
	lemma: string;
	slug: string;
	/** The form the sentences wanted, as last missed. */
	answer: string;
	misses: number;
	reps: number;
	lastGiven: string;
	lastAt: string;
}

export interface WeekPoint {
	/** Monday of the week, YYYY-MM-DD. */
	week: string;
	reps: number;
	accuracy: number;
}

export interface MistakeAnalysis {
	/** When this was computed (ISO). */
	at: string;
	/** First tries counted, and how many were wrong. */
	reps: number;
	wrong: number;
	/** The first and last day the counted reps cover. */
	from: string | null;
	to: string | null;
	units: UnitTrend[];
	slips: Partial<Record<FormSlip, number>>;
	words: MissedWord[];
	weeks: WeekPoint[];
	mixups: MixupSummary[];
}

export const TREND_DAYS = 14;
/** First tries a window needs before its accuracy is compared. */
export const TREND_MIN_REPS = 5;
/** The accuracy change that counts as a trend (ten points). */
export const TREND_STEP = 0.1;
/** A unit is listed once it has this many first tries. */
export const UNIT_MIN_REPS = 3;
export const WORDS_SHOWN = 8;
export const WEEKS_SHOWN = 8;

const DAY_MS = 86_400_000;

/** Monday of the week a UTC instant is in. */
function weekOf(at: number): string {
	const d = new Date(at);
	const back = (d.getUTCDay() + 6) % 7;
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

export function trendOf(recent: { reps: number; right: number }, earlier: { reps: number; right: number }): Trend {
	if (recent.reps < TREND_MIN_REPS || earlier.reps < TREND_MIN_REPS) return "new";
	const diff = recent.right / recent.reps - earlier.right / earlier.reps;
	return diff >= TREND_STEP ? "better" : diff <= -TREND_STEP ? "worse" : "steady";
}

export function analyseMistakes(lessons: readonly LoggedLesson[], mixups: MixupRecord | undefined, now: Date): MistakeAnalysis {
	const cut = now.getTime() - TREND_DAYS * DAY_MS;
	type Tally = { reps: number; right: number; recent: { reps: number; right: number }; earlier: { reps: number; right: number }; slips: Partial<Record<FormSlip, number>> };
	const units = new Map<string, Tally>();
	const words = new Map<string, MissedWord & { right: number }>();
	const weeks = new Map<string, { reps: number; right: number }>();
	const slips: Partial<Record<FormSlip, number>> = {};
	let reps = 0;
	let wrong = 0;
	let from: string | null = null;
	let to: string | null = null;
	for (const lesson of lessons) {
		if (lesson.mode !== "lesson" && lesson.mode !== "blitz") continue;
		const t = Date.parse(lesson.at);
		if (!Number.isFinite(t)) continue;
		for (const r of lesson.reps) {
			if (!countsAsFirstTry(r) || !isUnitId(r.unit)) continue;
			const first = r.first!;
			const right = first.verdict !== "wrong";
			reps++;
			if (!right) wrong++;
			const day = lesson.at.slice(0, 10);
			if (!from || day < from) from = day;
			if (!to || day > to) to = day;
			const u = units.get(r.unit) ?? { reps: 0, right: 0, recent: { reps: 0, right: 0 }, earlier: { reps: 0, right: 0 }, slips: {} };
			const window = t >= cut ? u.recent : u.earlier;
			u.reps++;
			window.reps++;
			if (right) {
				u.right++;
				window.right++;
			} else {
				const slip = r.slip ?? "other";
				u.slips[slip] = (u.slips[slip] ?? 0) + 1;
				slips[slip] = (slips[slip] ?? 0) + 1;
			}
			units.set(r.unit, u);
			const wk = weekOf(t);
			const w = weeks.get(wk) ?? { reps: 0, right: 0 };
			w.reps++;
			if (right) w.right++;
			weeks.set(wk, w);
			const key = r.slug;
			const word = words.get(key) ?? { lemma: r.lemma, slug: r.slug, answer: r.answer, misses: 0, reps: 0, lastGiven: "", lastAt: "", right: 0 };
			word.reps++;
			if (right) word.right++;
			else if (!word.lastAt || lesson.at >= word.lastAt) {
				word.misses++;
				word.answer = r.answer;
				word.lastGiven = first.given.trim();
				word.lastAt = lesson.at;
			} else word.misses++;
			words.set(key, word);
		}
	}
	const unitList: UnitTrend[] = [...units.entries()]
		.filter(([, u]) => u.reps >= UNIT_MIN_REPS)
		.map(([unit, u]) => ({
			unit,
			title: unitInfo(unit as Parameters<typeof unitInfo>[0]).title,
			reps: u.reps,
			wrong: u.reps - u.right,
			accuracy: u.right / u.reps,
			recent: u.recent.reps >= TREND_MIN_REPS ? u.recent.right / u.recent.reps : null,
			earlier: u.earlier.reps >= TREND_MIN_REPS ? u.earlier.right / u.earlier.reps : null,
			trend: trendOf(u.recent, u.earlier),
			slips: u.slips,
		}))
		.sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy);
	const missed: MissedWord[] = [...words.values()]
		.filter((w) => w.misses > 0)
		.sort((a, b) => b.misses - a.misses || b.lastAt.localeCompare(a.lastAt))
		.slice(0, WORDS_SHOWN)
		.map(({ right: _right, ...w }) => w);
	const weekList = [...weeks.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(-WEEKS_SHOWN)
		.map(([week, w]) => ({ week, reps: w.reps, accuracy: w.right / w.reps }));
	return { at: now.toISOString(), reps, wrong, from, to, units: unitList, slips, words: missed, weeks: weekList, mixups: mixupList(mixups).filter((m) => m.status !== "cleared") };
}

/** The facts the guide is written from, and what decides whether a saved
 *  guide is still current: the same facts give the same digest, so a guide
 *  is never paid for twice for the same evidence. */
export function guideFacts(a: MistakeAnalysis): string {
	const pct = (x: number) => `${Math.round(x * 100)}%`;
	const lines: string[] = [`First tries counted: ${a.reps}, wrong: ${a.wrong}${a.from ? ` (${a.from} to ${a.to})` : ""}.`];
	const slipLine = FORM_SLIPS.filter((s) => a.slips[s]).map((s) => `${s} ${a.slips[s]}`);
	if (slipLine.length) lines.push(`Kinds of wrong answer: ${slipLine.join(", ")}.`);
	for (const u of a.units.slice(0, 6)) {
		lines.push(`Unit ${u.title}: ${pct(u.accuracy)} of ${u.reps} first tries; trend ${u.trend}${u.recent !== null && u.earlier !== null ? ` (${pct(u.earlier)} before, ${pct(u.recent)} lately)` : ""}.`);
	}
	for (const w of a.words) lines.push(`Missed ${w.misses}×: ${w.lemma} (wanted "${w.answer}", last wrote "${w.lastGiven}").`);
	for (const m of a.mixups.slice(0, 8)) lines.push(m.status === "active" ? `Mixes up ${m.words.join(" / ")} (${m.misses} misses).` : `Not tested yet but the same pattern: ${m.words.join(" / ")}.`);
	return lines.join("\n");
}

/** A short stable digest of the facts (FNV-1a), for the guide's cache. */
export function digest(text: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(16).padStart(8, "0");
}
