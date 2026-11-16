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

import type { AiStatus } from "./ai-status.ts";
import type { ChatAnalysis } from "./chat-analysis.ts";
import type { ListenAnalysis } from "./listen-analysis.ts";
import type { ListenGuideRecord } from "./listen-guide.ts";
import type { PersonalPractice } from "./personal.ts";
import type { StoryUsage } from "./reading.ts";
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
		/** The sentence and what was given, for the wrong first tries the guide reads. */
		sentence?: string;
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
	/** Where the true first-try rate likely is (95% Wilson interval). Few
	 *  answers give a wide range; absent in snapshots from before it was kept. */
	low?: number;
	high?: number;
	/** The range lies under WEAK_BAR: weak with enough answers to say so. */
	weak?: boolean;
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

/** One wrong first try, kept so the guide can read what was really written. */
export interface WrongSample {
	at: string;
	unit: string;
	sentence: string;
	answer: string;
	given: string;
	slip?: FormSlip;
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
	/** The latest wrong first tries, newest first. Absent in snapshots from before it was kept. */
	samples?: WrongSample[];
	/** What the Listen task says about hearing (src/core/listen-analysis.ts). Absent in snapshots from before it was kept. */
	listening?: ListenAnalysis;
	chat?: ChatAnalysis;
}

/** The guide as saved: the model's reply, its structured read, and what it was written from. */
export interface GuideRecord {
	/** The model's reply as written; the page shows it when `data` could not be read from it. */
	text: string;
	/** The reply read as patterns, guesses and a plan (parseGuide). */
	data?: GuideData | null;
	/** The practice targets the lexicon backs, for the personal lesson. */
	practice?: PersonalPractice | null;
	/** When it was written (ISO). */
	at: string;
	/** Digest of the facts it was written from (guideFacts). */
	digest: string;
	/** "provider:id" of the model that wrote it. */
	model: string;
	usage: StoryUsage;
}

/** What the My mistakes page reads: the analysis, the guide if any, and whether AI is ready. */
export interface MistakesReport {
	analysis: MistakeAnalysis;
	guide: GuideRecord | null;
	/** The guide was written from the facts the analysis has now. */
	guideCurrent: boolean;
	/** The deep read of the listening (src/core/listen-guide.ts) and whether it was written from the facts the analysis has now. Absent in reports from before it existed. */
	listenGuide?: ListenGuideRecord | null;
	listenGuideCurrent?: boolean;
	/** Whether a model can be called (a slot is set and its key is there). */
	ai: AiStatus;
}

export const TREND_DAYS = 14;
/** First tries each window needs before the two are compared at all. */
export const TREND_MIN_REPS = 6;
/** How far apart the two windows must be, in standard errors, to call it a
 *  trend: a two-proportion z-test at the 5% level. Below that the change is
 *  as likely to be chance as real, and it reads "steady". */
export const TREND_Z = 1.96;
/** A unit is listed once it has this many first tries. */
const UNIT_MIN_REPS = 3;
/** A unit is called weak only when even the top of its likely range is
 *  under this (the lesson pass bar the weak spots use, 85%). */
export const WEAK_BAR = 0.85;
/** Below this many first tries the page shows a unit's range with its score. */
export const RANGE_SHOWN_UNDER = 20;
/** A word is listed among the most missed from its second miss: one miss is
 *  a slip; the review deck already has it. */
const WORD_MIN_MISSES = 2;
/** The guide is written only from enough evidence: patterns read from a
 *  handful of answers are guesses dressed as findings. */
export const GUIDE_MIN_REPS = 30;
export const GUIDE_MIN_WRONG = 5;
const WORDS_SHOWN = 8;
const WEEKS_SHOWN = 8;
/** Wrong first tries kept for the guide. */
export const SAMPLES_KEPT = 15;

const DAY_MS = 86_400_000;

/** Monday of the week a UTC instant is in. */
function weekOf(at: number): string {
	const d = new Date(at);
	const back = (d.getUTCDay() + 6) % 7;
	return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}

/** The 95% Wilson score interval of right / n: where the true rate likely
 *  is. It stays inside 0..1 and is honest with few answers (5 of 8 is
 *  "somewhere between 31% and 86%", not "63%"). */
export function wilson(right: number, n: number, z = 1.96): { low: number; high: number } {
	if (n <= 0) return { low: 0, high: 1 };
	const p = right / n;
	const z2 = z * z;
	const center = p + z2 / (2 * n);
	const spread = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
	const div = 1 + z2 / n;
	return { low: Math.max(0, (center - spread) / div), high: Math.min(1, (center + spread) / div) };
}

/** Better or worse only when the two windows differ by more than chance
 *  would (a two-proportion z-test); "new" when either has too few answers. */
export function trendOf(recent: { reps: number; right: number }, earlier: { reps: number; right: number }): Trend {
	if (recent.reps < TREND_MIN_REPS || earlier.reps < TREND_MIN_REPS) return "new";
	const p1 = recent.right / recent.reps;
	const p2 = earlier.right / earlier.reps;
	const pooled = (recent.right + earlier.right) / (recent.reps + earlier.reps);
	const se = Math.sqrt(pooled * (1 - pooled) * (1 / recent.reps + 1 / earlier.reps));
	if (se === 0) return "steady";
	const z = (p1 - p2) / se;
	return z >= TREND_Z ? "better" : z <= -TREND_Z ? "worse" : "steady";
}

/** Whether there is enough evidence to write the guide, and how far off. */
export function guideReadiness(a: Pick<MistakeAnalysis, "reps" | "wrong" | "chat">): {
	ready: boolean;
	reps: number;
	wrong: number;
	needReps: number;
	needWrong: number;
} {
	const reps = a.reps + (a.chat?.answers ?? 0);
	const wrong = a.wrong + (a.chat?.misses ?? 0);
	return {
		ready: reps >= GUIDE_MIN_REPS && wrong >= GUIDE_MIN_WRONG,
		reps,
		wrong,
		needReps: GUIDE_MIN_REPS,
		needWrong: GUIDE_MIN_WRONG,
	};
}

export function analyzeMistakes(
	lessons: readonly LoggedLesson[],
	mixups: MixupRecord | undefined,
	now: Date,
): MistakeAnalysis {
	const cut = now.getTime() - TREND_DAYS * DAY_MS;
	type Tally = {
		reps: number;
		right: number;
		recent: { reps: number; right: number };
		earlier: { reps: number; right: number };
		slips: Partial<Record<FormSlip, number>>;
	};
	const units = new Map<string, Tally>();
	const words = new Map<string, MissedWord & { right: number }>();
	const weeks = new Map<string, { reps: number; right: number }>();
	const slips: Partial<Record<FormSlip, number>> = {};
	const samples: WrongSample[] = [];
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
			const u = units.get(r.unit) ?? {
				reps: 0,
				right: 0,
				recent: { reps: 0, right: 0 },
				earlier: { reps: 0, right: 0 },
				slips: {},
			};
			const window = t >= cut ? u.recent : u.earlier;
			u.reps++;
			window.reps++;
			if (right) {
				u.right++;
				window.right++;
			} else {
				const slip = r.slip ?? "other";
				if (r.sentence)
					samples.push({
						at: lesson.at,
						unit: unitInfo(r.unit).title,
						sentence: r.sentence,
						answer: r.answer,
						given: first.given.trim(),
						...(r.slip ? { slip: r.slip } : {}),
					});
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
			const word = words.get(key) ?? {
				lemma: r.lemma,
				slug: r.slug,
				answer: r.answer,
				misses: 0,
				reps: 0,
				lastGiven: "",
				lastAt: "",
				right: 0,
			};
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
		.map(([unit, u]) => {
			const { low, high } = wilson(u.right, u.reps);
			return {
				unit,
				title: unitInfo(unit as Parameters<typeof unitInfo>[0]).title,
				reps: u.reps,
				wrong: u.reps - u.right,
				accuracy: u.right / u.reps,
				recent: u.recent.reps >= TREND_MIN_REPS ? u.recent.right / u.recent.reps : null,
				earlier: u.earlier.reps >= TREND_MIN_REPS ? u.earlier.right / u.earlier.reps : null,
				trend: trendOf(u.recent, u.earlier),
				slips: u.slips,
				low,
				high,
				weak: high < WEAK_BAR,
			};
		})
		.sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy);
	const missed: MissedWord[] = [...words.values()]
		.filter((w) => w.misses >= WORD_MIN_MISSES)
		.sort((a, b) => b.misses - a.misses || b.lastAt.localeCompare(a.lastAt))
		.slice(0, WORDS_SHOWN)
		.map(({ right: _right, ...w }) => w);
	const weekList = [...weeks.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(-WEEKS_SHOWN)
		.map(([week, w]) => ({ week, reps: w.reps, accuracy: w.right / w.reps }));
	return {
		at: now.toISOString(),
		reps,
		wrong,
		from,
		to,
		units: unitList,
		slips,
		words: missed,
		weeks: weekList,
		mixups: mixupList(mixups).filter((m) => m.status !== "cleared"),
		samples: samples.sort((a, b) => b.at.localeCompare(a.at)).slice(0, SAMPLES_KEPT),
	};
}

/** The facts the guide is written from, and what decides whether a saved
 *  guide is still current: the same facts give the same digest, so a guide
 *  is never paid for twice for the same evidence. */
export function guideFacts(a: MistakeAnalysis): string {
	const pct = (x: number) => `${Math.round(x * 100)}%`;
	const lines: string[] = [
		`First tries counted: ${a.reps}, wrong: ${a.wrong}${a.from ? ` (${a.from} to ${a.to})` : ""}.`,
	];
	const slipLine = FORM_SLIPS.filter((s) => a.slips[s]).map((s) => `${s} ${a.slips[s]}`);
	if (slipLine.length) lines.push(`Kinds of wrong answer: ${slipLine.join(", ")}.`);
	for (const u of a.units.slice(0, 6)) {
		const range =
			u.low !== undefined && u.high !== undefined
				? ` (likely ${pct(u.low)}–${pct(u.high)}${u.weak ? ", weak" : ", too few answers to call weak"})`
				: "";
		lines.push(
			`Unit ${u.title} [${u.unit}]: ${pct(u.accuracy)} of ${u.reps} first tries${u.accuracy < WEAK_BAR ? range : ""}; trend ${u.trend}${u.recent !== null && u.earlier !== null ? ` (${pct(u.earlier)} before, ${pct(u.recent)} lately)` : ""}.`,
		);
	}
	for (const x of a.samples ?? [])
		lines.push(
			`Wrong: "${x.sentence}" wanted "${x.answer}", wrote "${x.given || "nothing"}" (${x.unit}${x.slip ? `, ${x.slip}` : ""}).`,
		);
	for (const w of a.words)
		lines.push(`Missed ${w.misses}×: ${w.lemma} (wanted "${w.answer}", last wrote "${w.lastGiven}").`);
	for (const m of a.mixups.slice(0, 8))
		lines.push(
			m.status === "active"
				? `Mixes up ${m.words.join(" / ")} (${m.misses} misses).`
				: `Not tested yet but the same pattern: ${m.words.join(" / ")}.`,
		);
	if (a.chat?.answers) {
		lines.push(
			`In chats with the tutor: ${a.chat.answers} graded answers, ${a.chat.firstTryRight} right with no hint, ${a.chat.misses} wrong or given up.`,
		);
		for (const u of a.chat.units.slice(0, 4))
			lines.push(`In chats, unit ${u.title} [${u.unit}]: ${u.misses} wrong of ${u.answers}.`);
		for (const t of a.chat.topics.slice(0, 5))
			lines.push(
				`In chats, missed ${t.misses}× on "${t.focus}" (last wrote "${t.lastGiven || "nothing"}", wanted "${t.lastExpected}"${t.unit ? `, unit [${t.unit}]` : ""}).`,
			);
	}
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

/** What the guide says, as the model returns it (src/server/mistakes-guide.ts). */
export interface GuideData {
	/** What keeps going wrong: the pattern behind several misses. */
	patterns: Array<{ title: string; evidence: string; why: string; fix: string }>;
	/** What may trip the learner next: guesses, said as guesses. */
	next: Array<{ what: string; why: string }>;
	/** What to do this week, each tied to something the app can open. */
	plan: Array<{ step: string; kind: "mixups" | "unit" | "review" | "other"; unit?: string }>;
	/** What the personal lesson should drill, as the model named it; the
	 *  server keeps only what the lexicon can back (src/server/personal.ts). */
	practice?: { words: string[]; units: string[]; pairs: Array<[string, string]> };
}

const clip = (v: unknown, max: number): string =>
	typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** The guide's JSON from the model's text, or null when it is not one: a
 *  reply wrapped in prose or fences is cut to its outermost braces; every
 *  field is a bounded string and every list is capped, so a bad reply cannot
 *  fill the page. */
export function parseGuide(text: string): GuideData | null {
	const from = text.indexOf("{");
	const to = text.lastIndexOf("}");
	if (from < 0 || to <= from) return null;
	let raw: Record<string, unknown>;
	try {
		raw = JSON.parse(text.slice(from, to + 1)) as Record<string, unknown>;
	} catch {
		return null;
	}
	const list = (v: unknown): Array<Record<string, unknown>> =>
		Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
	const patterns = list(raw.patterns)
		.slice(0, 4)
		.map((p) => ({
			title: clip(p.title, 90),
			evidence: clip(p.evidence, 260),
			why: clip(p.why, 300),
			fix: clip(p.fix, 300),
		}))
		.filter((p) => p.title && p.why);
	if (!patterns.length) return null;
	const next = list(raw.next)
		.slice(0, 4)
		.map((n) => ({ what: clip(n.what, 90), why: clip(n.why, 240) }))
		.filter((n) => n.what);
	const plan = list(raw.plan)
		.slice(0, 4)
		.map((p) => {
			const unit = typeof p.unit === "string" && isUnitId(p.unit) ? p.unit : undefined;
			const kind: GuideData["plan"][number]["kind"] =
				p.kind === "mixups" || p.kind === "review" ? p.kind : p.kind === "unit" && unit ? "unit" : "other";
			return { step: clip(p.step, 200), kind, ...(kind === "unit" ? { unit } : {}) };
		})
		.filter((p) => p.step);
	const practiceRaw = raw.practice && typeof raw.practice === "object" ? (raw.practice as Record<string, unknown>) : {};
	const strings = (v: unknown, cap: number) =>
		Array.isArray(v)
			? v
					.map((x) => clip(x, 40))
					.filter(Boolean)
					.slice(0, cap)
			: [];
	const pairs = (Array.isArray(practiceRaw.pairs) ? practiceRaw.pairs : [])
		.filter((p): p is unknown[] => Array.isArray(p) && p.length === 2)
		.map((p) => [clip(p[0], 40), clip(p[1], 40)] as [string, string])
		.filter(([a, b]) => a && b && a !== b)
		.slice(0, 3);
	const practice = { words: strings(practiceRaw.words, 6), units: strings(practiceRaw.units, 3), pairs };
	return {
		patterns,
		next,
		plan,
		...(practice.words.length + practice.units.length + practice.pairs.length > 0 ? { practice } : {}),
	};
}
