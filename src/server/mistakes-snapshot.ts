/**
 * The saved analysis of the learner's answers (src/core/mistakes.ts): read
 * from the lesson log and the mix-up record, saved with its time, no model.
 * Kept apart from the guide (mistakes-guide.ts) so the lesson service can
 * refresh it without pulling the model code in.
 */

import { analyzeChats } from "../core/chat-analysis.ts";
import { analyzeListening } from "../core/listen-analysis.ts";
import { listenGuideFacts, type ListenGuideRecord } from "../core/listen-guide.ts";
import { analyzeMistakes, digest, guideFacts, type MistakeAnalysis, type MistakesReport } from "../core/mistakes.ts";
import type { UnitId } from "../core/lesson.ts";
import { readChatAnswers } from "../store/chat-answers.ts";
import { readLessonLog } from "../store/corpus.ts";
import { analysisStore, type GuideRecord } from "../store/analysis.ts";
import { progressStore } from "../store/progress.ts";
import { aiStatus } from "./ai-status.ts";
import { activeSlippingWords } from "./slipping.ts";

export type { MistakesReport };

const SNAPSHOT_MAX_AGE_MS = 6 * 3_600_000;

export function mistakesReportOf(
	analysis: MistakeAnalysis,
	guide: GuideRecord | null,
	listenGuide: ListenGuideRecord | null = null,
): MistakesReport {
	const slipping = activeSlippingWords();
	const withSlipping: MistakeAnalysis = {
		...analysis,
		slipping: slipping.length,
		...(slipping.length ? { slippingSample: slipping.slice(0, 3).map((w) => w.lemma) } : {}),
	};
	return {
		analysis: withSlipping,
		guide,
		guideCurrent: !!guide && guide.digest === digest(guideFacts(analysis)),
		listenGuide,
		listenGuideCurrent:
			!!listenGuide && !!analysis.listening && listenGuide.digest === digest(listenGuideFacts(analysis.listening)),
		ai: aiStatus("strong"),
	};
}

/** The saved snapshot; the first visit takes one. */
export function mistakesReport(now = new Date()): MistakesReport {
	const saved = analysisStore.read();
	if (saved.analysis) return mistakesReportOf(saved.analysis, saved.guide, saved.listenGuide ?? null);
	return analyzeNow(now);
}

/** Read the log again and save the snapshot with its time, keeping the guide. */
export function analyzeNow(now = new Date()): MistakesReport {
	const log = readLessonLog();
	const analysis = {
		...analyzeMistakes(log, progressStore.read().mixups, now),
		listening: analyzeListening(log, now),
		chat: analyzeChats(readChatAnswers(), now),
	};
	const { guide, listenGuide } = analysisStore.read();
	analysisStore.write({ analysis, guide, listenGuide });
	return mistakesReportOf(analysis, guide, listenGuide ?? null);
}

export function refreshChatSnapshot(now = new Date()): void {
	const saved = analysisStore.read();
	if (!saved.analysis) return;
	analysisStore.write({ ...saved, analysis: { ...saved.analysis, chat: analyzeChats(readChatAnswers(), now) } });
}

/** After a lesson: take a new snapshot when the saved one is old, so the
 *  daily plan reads trends that are about today. A failure is not the
 *  lesson's. */
export function refreshSnapshotIfStale(now = new Date()): void {
	try {
		const saved = analysisStore.read().analysis;
		if (!saved || now.getTime() - Date.parse(saved.at) >= SNAPSHOT_MAX_AGE_MS) analyzeNow(now);
	} catch (err) {
		console.warn("[mistakes] could not refresh the snapshot:", err instanceof Error ? err.message : err);
	}
}

/** The units the saved snapshot says are slipping, worst first. */
export function slippingUnits(): UnitId[] {
	const units = analysisStore.read().analysis?.units ?? [];
	return units
		.filter((u) => u.trend === "worse")
		.sort((a, b) => (a.recent ?? 1) - (b.recent ?? 1))
		.map((u) => u.unit as UnitId);
}
