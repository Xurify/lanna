/**
 * Guided Self-Talk Server Handler (LangHarness, 2026-11-12)
 *
 * Records finished self-talk sessions into the day's ledger, counting
 * active speaking time toward the Speaking strand (P9 & P2), awarding XP,
 * and logging the practice session.
 */

import {
	calculateSelfTalkXp,
	findUsedSuggestedWords,
	getSelfTalkPromptById,
	type UsefulChunk,
	addMinutes,
	dayKey,
} from "../core/index.ts";
import { progressStore } from "../store/progress.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { appendLessonLog } from "../store/corpus.ts";

export interface SelfTalkCompleteInput {
	promptId: string;
	activeSec: number;
	transcript?: string;
	tz?: number;
}

export interface SelfTalkOutcome {
	promptId: string;
	xp: number;
	metTarget: boolean;
	activeSec: number;
	usedWords: UsefulChunk[];
	summary: ProgressSummary;
}

export function completeSelfTalk(input: SelfTalkCompleteInput, now = new Date()): SelfTalkOutcome {
	const prompt = getSelfTalkPromptById(input.promptId);
	if (!prompt) {
		throw new Error(`Unknown self-talk prompt: ${input.promptId}`);
	}

	const activeSec = Math.max(0, Math.round(input.activeSec));
	const activeMs = activeSec * 1000;
	const { xp, metTarget } = calculateSelfTalkXp(activeSec, prompt.targetSec);
	const transcript = (input.transcript ?? "").trim();
	const usedWords = findUsedSuggestedWords(transcript, prompt.suggestedWords);

	const p = progressStore.read();
	const key = dayKey(now, input.tz);
	const day = (p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });

	day.speaks = (day.speaks ?? 0) + 1;
	day.xp += xp;
	addMinutes(day, "speak", activeMs);
	p.xp += xp;
	progressStore.write(p);

	try {
		appendLessonLog({
			id: `self-talk-${Date.now()}`,
			at: now.toISOString(),
			day: key,
			unit: `self-talk:${prompt.id}`,
			mode: "speak",
			ms: activeMs,
			xp,
			correct: metTarget ? 1 : 0,
			total: 1,
			perfect: metTarget,
			queued: [],
			reps: [],
		});
	} catch (err) {
		console.warn("[self-talk] could not append lesson log:", err instanceof Error ? err.message : err);
	}

	return {
		promptId: prompt.id,
		xp,
		metTarget,
		activeSec,
		usedWords,
		summary: progressSummary(input.tz, now),
	};
}
