/**
 * The log of a day (Quiet tool, 2026-11-02): what the learner did on one day,
 * written from the records the app already keeps and nothing else: the lesson
 * log (a finished lesson, Blitz, Listen, a Speak scene, a Say it faster round,
 * each with its time), the review log (answers, grouped into sittings), the
 * cards minted that day, and the day's record (measured minutes per activity).
 * Adapted from the Notebook design's page builder (src/core/notebook.ts on its
 * branch). Pure: the server reads the stores and hands them here.
 */

import { UNITS } from "./lesson.ts";
import { strandParts, type StrandDay } from "./strands.ts";
import type { Strand } from "./strands.ts";

/** The slice of a logged lesson the log reads (src/store/corpus.ts LessonLogEntry). */
export interface DayLogLesson {
	at: string;
	day: string;
	unit: string;
	mode: string;
	ms?: number;
	correct: number;
	total: number;
	reps: Array<{ unit?: string; lemma?: string; gloss?: string; sentence?: string; answer: string; given?: string; verdict: string; again?: boolean; first?: { given: string; verdict: string } }>;
}

/** The slice of a review answer the log reads (src/core/review.ts ReviewLogEntry). */
export interface DayLogReview {
	cardId: string;
	given: string;
	verdict: string;
	reviewedAt: string;
	ms?: number;
}

/** A card, for the sentence behind a missed review answer and for "added to Review". */
export interface DayLogCard {
	id: string;
	lemma: string;
	gloss: string;
	sentence: string;
	answer: string;
	createdAt: string;
}

export interface DayEntry {
	at: string;
	/** Local time, HH:MM. */
	time: string;
	kind: string;
	title: string;
	/** What happened: "10 of 12 right, 3 min". */
	line: string;
}

export interface DayLog {
	day: string;
	entries: DayEntry[];
	rules: Array<{ time: string; unit: string; title: string; rule: string }>;
	words: Array<{ time: string; lemma: string; gloss: string }>;
	mistakes: Array<{ time: string; title: string; given: string; answer: string; sentence: string }>;
	strands: { minutes: Record<Strand, number>; total: number; estimated: number };
	/** Things the day's record counts without a time (a story read, a video watched). */
	also: string[];
}

export interface DayLogInput {
	lessons: readonly DayLogLesson[];
	reviews: readonly DayLogReview[];
	cards: readonly DayLogCard[];
	/** The day's record from progress.json, when the day has one. */
	record?: (StrandDay & { stories?: number; talks?: number; tutors?: number; reads?: number; watches?: number; rereads?: number }) | undefined;
	/** getTimezoneOffset(): minutes west of UTC. */
	tz: number;
}

const TASK_NAME: Record<string, string> = {
	blitz: "Blitz",
	mixups: "Mix-ups",
	personal: "From your guide",
	listen: "Listen",
	speak: "Speak",
	fluency: "Say it faster",
};

/** A gap this long between two review answers starts a new sitting. */
const SITTING_GAP_MS = 20 * 60_000;

export function localTime(iso: string, tz: number): string {
	const d = new Date(new Date(iso).getTime() - tz * 60_000);
	return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function localDay(iso: string, tz: number): string {
	return new Date(new Date(iso).getTime() - tz * 60_000).toISOString().slice(0, 10);
}

function titleOf(e: DayLogLesson): string {
	const info = UNITS.find((u) => u.id === e.unit);
	if (info && e.mode === "lesson") return `${info.kind === "words" ? "Words" : "Grammar"}: ${info.title}`;
	return info?.title ?? TASK_NAME[e.mode] ?? e.unit;
}

function minutesLabel(ms: number | undefined): string {
	if (ms === undefined) return "";
	if (ms < 45_000) return "under a minute";
	return `${Math.max(1, Math.round(ms / 60_000))} min`;
}

/** "1 story", "3 stories": the also-list phrases. */
function counted(n: number | undefined, one: string, many: string): string | null {
	if (!n) return null;
	return `${n} ${n === 1 ? one : many}`;
}

export function buildDayLog(day: string, input: DayLogInput): DayLog {
	const { tz } = input;
	const lessons = input.lessons.filter((e) => e.day === day && e.mode !== "placement").sort((a, b) => a.at.localeCompare(b.at));
	const reviews = input.reviews.filter((r) => localDay(r.reviewedAt, tz) === day).sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt));
	const cards = new Map(input.cards.map((c) => [c.id, c]));

	const entries: DayEntry[] = [];
	const rules: DayLog["rules"] = [];
	const mistakes: DayLog["mistakes"] = [];
	const met = new Set<string>();

	for (const e of lessons) {
		const time = localTime(e.at, tz);
		const info = UNITS.find((u) => u.id === e.unit);
		const parts = [e.total > 0 ? `${e.correct} of ${e.total} right` : "", minutesLabel(e.ms)].filter(Boolean);
		entries.push({ at: e.at, time, kind: e.mode, title: titleOf(e), line: parts.join(", ") || "Finished" });
		if (info && info.kind !== "words" && e.mode === "lesson" && !met.has(info.id)) {
			met.add(info.id);
			rules.push({ time, unit: info.id, title: info.title, rule: info.rule });
		}
		for (const r of e.reps) {
			// A repeat after the last rep is the same miss again; the first try is the one that counts.
			const wrongFirst = r.first ? r.first.verdict === "wrong" : r.verdict === "wrong" && !r.again;
			const given = (r.first?.given ?? r.given ?? "").trim();
			if (wrongFirst && !r.again && given && given !== r.answer) mistakes.push({ time, title: info?.title ?? titleOf(e), given, answer: r.answer, sentence: r.sentence ?? "" });
		}
	}

	// Review answers, grouped into sittings.
	let sitting: DayLogReview[] = [];
	const flush = () => {
		if (!sitting.length) return;
		const first = sitting[0]!;
		const right = sitting.filter((r) => r.verdict === "exact").length;
		const ms = sitting.reduce((n, r) => n + (r.ms ?? 0), 0);
		const parts = [`${sitting.length} ${sitting.length === 1 ? "answer" : "answers"}`, `${right} right`, ms > 0 ? minutesLabel(ms) : ""].filter(Boolean);
		entries.push({ at: first.reviewedAt, time: localTime(first.reviewedAt, tz), kind: "review", title: "Review", line: parts.join(", ") });
		sitting = [];
	};
	let last = 0;
	for (const r of reviews) {
		const t = new Date(r.reviewedAt).getTime();
		if (sitting.length && t - last > SITTING_GAP_MS) flush();
		sitting.push(r);
		last = t;
		const card = cards.get(r.cardId);
		const given = r.given.trim();
		if (r.verdict === "wrong" && card && given && given !== card.answer) mistakes.push({ time: localTime(r.reviewedAt, tz), title: "Review", given, answer: card.answer, sentence: card.sentence });
	}
	flush();
	entries.sort((a, b) => a.at.localeCompare(b.at));
	mistakes.sort((a, b) => a.time.localeCompare(b.time));

	const words = input.cards
		.filter((c) => c.createdAt && localDay(c.createdAt, tz) === day)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
		.map((c) => ({ time: localTime(c.createdAt, tz), lemma: c.lemma, gloss: c.gloss }));

	const parts = strandParts(input.record ?? {});
	const total = parts.minutes.input + parts.minutes.output + parts.minutes.form + parts.minutes.fluency;
	const rec = input.record;
	const also = [counted(rec?.reads, "episode read", "episodes read"), counted(rec?.watches, "video watched", "videos watched"), counted(rec?.stories, "story told", "stories told"), counted(rec?.talks, "talk in writing", "talks in writing"), counted(rec?.tutors, "tutor session", "tutor sessions"), counted(rec?.rereads, "timed re-read", "timed re-reads")].filter((x): x is string => x !== null);

	return { day, entries, rules, words, mistakes, strands: { minutes: parts.minutes, total, estimated: parts.estimated }, also };
}

/** Whether a day's log has anything to show. */
export function dayLogIsEmpty(log: DayLog): boolean {
	return log.entries.length === 0 && log.words.length === 0 && log.also.length === 0 && log.strands.total === 0;
}
