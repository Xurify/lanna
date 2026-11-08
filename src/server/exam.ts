/**
 * The chapter exam, server side (Skúška, phase 6a, E14): the draw the
 * learner answers and the record of how it went. The exam draws eight
 * choose items from the chapter's own units (src/core/exam.ts, pure) and
 * is graded here from the seed — the client sends only its picks, never
 * its own verdict. Record only: the attempt lands in progress.json's
 * `exams` per chapter, and curriculumState is unchanged (the gate comes
 * with phase 6b).
 */

import { bestAttempt, examItems, scoreExam, type ExamDraw } from "../core/exam.ts";
import { loadLexicon } from "../agent/lexicon.ts";
import { progressStore, type ExamAttempt } from "../store/progress.ts";

function entries() {
	return loadLexicon()?.entries ?? [];
}

/** The draw for a chapter's exam. Throws for an unknown chapter; a chapter
 *  with nothing to draw from (media) comes back with an empty item list. */
export function examFor(chapterId: string, seed = Date.now()): ExamDraw {
	const draw = examItems(chapterId, seed, entries());
	if (!draw) throw new Error(`no such chapter: ${chapterId}`);
	return draw;
}

interface ExamRecordInput {
	chapterId: string;
	/** The draw's seed, so the server rebuilds the same eight items. */
	seed: number;
	/** The chosen option's index per item; missing or out of range misses. */
	answers: unknown[];
}

interface ExamRecord {
	attempt: ExamAttempt;
	/** The chapter's best attempt after this one (the path's line). */
	best: ExamAttempt | null;
	/** How many attempts the chapter now has. */
	attempts: number;
}

/** Grade a finished exam against the same seed's draw and keep the attempt
 *  on the record. An unknown chapter throws; the caller answers 404. */
export function recordExam(input: ExamRecordInput, now = new Date()): ExamRecord {
	const draw = examItems(input.chapterId, input.seed, entries());
	if (!draw) throw new Error(`no such chapter: ${input.chapterId}`);
	const score = scoreExam(draw.items, input.answers ?? []);
	const attempt: ExamAttempt = { at: now.toISOString(), score: score.correct, total: score.total, passed: score.passed, misses: score.misses };
	const p = progressStore.read();
	const attempts = [...(p.exams[input.chapterId] ?? []), attempt];
	p.exams = { ...p.exams, [input.chapterId]: attempts };
	progressStore.write(p);
	return { attempt, best: bestAttempt(attempts), attempts: attempts.length };
}
