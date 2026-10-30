/**
 * The chapter exam (Skúška, phase 6a, E14) — eight choose items drawn from
 * the chapter's own word and drill units: three words, three forms, two
 * more. Every item is built by the lesson item builders (src/core/lesson.ts)
 * — there is no second generator — and the pair item, when the chapter has
 * a Dvojičky unit, is one rep of buildPairsLesson in place of a form item.
 *
 * Record only (6a): the score is correct / total, the pass mark is 80%,
 * and nothing opens or closes — curriculumState is unchanged. The draw is
 * deterministic per seed, so the server can re-grade the learner's picks
 * from the seed alone; a retry draws a fresh mix.
 *
 * Pure and browser-safe: the lexicon's entries are handed in, as lesson.ts
 * expects. A chapter with no word or drill units (media) has no exam yet —
 * an empty draw, never a broken page.
 */

import { CHAPTERS } from "./curriculum.ts";
import { chapterArc } from "./arc.ts";
import { buildItem, buildPairsLesson, candidatesFor, rng, shuffle, unitInfo, type Candidate, type LessonItem, type UnitId } from "./lesson.ts";
import { foldDiacritics } from "./language.ts";
import type { LexiconEntry } from "./review.ts";

/** Items per exam. */
export const EXAM_LENGTH = 8;
/** Pass mark: 80% of the items right (7 of 8). */
export const EXAM_PASS_MARK = 0.8;

export interface ExamDraw {
	chapter: string;
	seed: number;
	items: LessonItem[];
}

const fold = (s: string) => foldDiacritics(s.toLowerCase());

/**
 * The exam's eight items for a chapter, deterministic per seed. Three from
 * the chapter's word units, three from its first drill unit (the forms
 * step) — two when a pairs unit takes one slot with a Dvojičky rep — and
 * the rest from whatever the chapter's word and drill units still hold, so
 * a chapter without a forms step (work, offices, world, nuance, register)
 * fills up from its words instead. Undefined for an unknown chapter; an
 * empty item list for one with nothing to draw from (media).
 */
export function examItems(chapterId: string, seed: number, entries: readonly LexiconEntry[]): ExamDraw | undefined {
	const chapter = CHAPTERS.find((c) => c.id === chapterId);
	if (!chapter) return undefined;
	const rand = rng(seed);
	const arc = chapterArc(chapterId)!;
	const stepUnits = (i: number) => arc[i]!.units as UnitId[];
	const wordUnits = stepUnits(1);
	const formUnits = stepUnits(2);
	const pairsUnit = stepUnits(3)[0];

	const used = new Set<string>();
	// Choose reps only, newest drawn last: a vocabulary blank must be the
	// dictionary form (a choice between words), a form rep any real form.
	const drawFrom = (units: readonly UnitId[], n: number): LessonItem[] => {
		const out: LessonItem[] = [];
		for (const unit of shuffle(units, rand)) {
			if (out.length >= n) break;
			const info = unitInfo(unit);
			const top = candidatesFor(entries, unit).slice(0, info.kind === "words" ? 400 : 160);
			const fits = (c: Candidate) => info.kind !== "words" || fold(c.entry.examples[c.index]!.cloze!.answer) === fold(c.entry.sk);
			const pool = info.kind === "words" ? [...new Set(top.map((c) => c.entry.sk))] : top.map((c) => c.entry.examples[c.index]!.cloze!.answer);
			for (const c of shuffle(top.filter(fits), rand)) {
				if (out.length >= n) break;
				const id = `${c.entry.slug}#${c.index}`;
				if (used.has(id)) continue;
				used.add(id);
				out.push(buildItem(c, "choose", pool, rand));
			}
		}
		return out;
	};

	const words = drawFrom(wordUnits, 3);
	const forms = drawFrom(formUnits, pairsUnit ? 2 : 3);
	const pair = pairsUnit ? buildPairsLesson(entries, pairsUnit, { seed, length: 1 }).items.filter((i) => !used.has(i.id)).slice(0, 1) : [];
	if (pair[0]) used.add(pair[0].id);
	const more = drawFrom([...wordUnits, ...formUnits], Math.max(0, EXAM_LENGTH - words.length - forms.length - pair.length));
	return { chapter: chapterId, seed, items: shuffle([...words, ...forms, ...pair, ...more], rand) };
}

/** How an exam went: the score, whether it passes, and what was missed. */
export interface ExamScore {
	correct: number;
	total: number;
	/** correct / total, 0 for an empty exam. */
	ratio: number;
	passed: boolean;
	/** The item ids answered wrong, in exam order. */
	misses: string[];
}

/** Grade a draw against the learner's picks (the chosen option's index per
 * item). A pick that is out of range or missing is a miss, never a crash. */
export function scoreExam(items: readonly LessonItem[], answers: readonly unknown[]): ExamScore {
	let correct = 0;
	const misses: string[] = [];
	items.forEach((item, i) => {
		const pick = answers[i];
		const given = typeof pick === "number" ? item.options?.[pick] : undefined;
		if (given !== undefined && fold(given) === fold(item.answer)) correct++;
		else misses.push(item.id);
	});
	const total = items.length;
	const ratio = total > 0 ? correct / total : 0;
	return { correct, total, ratio, passed: total > 0 && ratio >= EXAM_PASS_MARK, misses };
}

/** A chapter's best attempt: the highest score first, the more recent one
 *  breaking a tie. Null before any attempt. */
export function bestAttempt<T extends { at: string; score: number; total: number; passed: boolean }>(attempts: readonly T[]): T | null {
	return [...attempts].sort((a, b) => b.score - a.score || (a.at < b.at ? 1 : -1))[0] ?? null;
}

/** One attempt as the path reads it (src/store/progress.ts keeps more). */
export interface ExamResult {
	at: string;
	score: number;
	total: number;
	passed: boolean;
}

/** A chapter's exam on record: how many attempts, and the best one. */
export interface ExamSummary {
	attempts: number;
	best: ExamResult | null;
}

/** Whether a chapter has an exam: its arc gives it word units or a form
 *  drill to draw from. Media has neither, so it has no exam row. */
export function chapterHasExam(chapterId: string): boolean {
	const steps = chapterArc(chapterId) ?? [];
	return steps.some((s) => (s.step.id === "words" || s.step.id === "forms") && s.units.length > 0);
}

/** The record of every chapter that has an exam, by chapter id. A chapter
 *  with no attempt still gets an entry (the path says "Not taken yet"). */
export function examSummaries(exams: Record<string, readonly ExamResult[]>): Record<string, ExamSummary> {
	const out: Record<string, ExamSummary> = {};
	for (const ch of CHAPTERS) {
		if (!chapterHasExam(ch.id)) continue;
		const attempts = exams[ch.id] ?? [];
		const best = bestAttempt(attempts);
		out[ch.id] = { attempts: attempts.length, best: best ? { at: best.at, score: best.score, total: best.total, passed: best.passed } : null };
	}
	return out;
}

/** The path's line under a chapter's exam: where it stands, and the mark. */
export function examLine(summary: ExamSummary): string {
	const mark = `pass mark ${Math.round(EXAM_PASS_MARK * 100)}%`;
	const best = summary.best;
	if (!best) return `Not taken yet · ${mark}`;
	if (best.passed) return `Passed · best ${best.score} of ${best.total}`;
	return `Best ${best.score} of ${best.total} · ${mark}`;
}
