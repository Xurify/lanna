/**
 * My mistakes service (src/core/mistakes.ts) — behind /mistakes and
 * /api/mistakes. The analysis is local (the lesson log and the mix-up
 * record, no model call) and saved with its time. The guide is optional:
 * one cheap-model call from the analysis's facts, written to disk and
 * reused until the facts change.
 */

import type { Usage } from "@earendil-works/pi-ai";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { analyseMistakes, digest, guideFacts, type MistakeAnalysis } from "../core/mistakes.ts";
import { readLessonLog } from "../store/corpus.ts";
import { analysisStore, type GuideRecord } from "../store/analysis.ts";
import { progressStore } from "../store/progress.ts";
import { readSettings } from "../store/settings.ts";
import { storyEngine } from "./reading.ts";

export interface MistakesReport {
	analysis: MistakeAnalysis;
	guide: GuideRecord | null;
	/** The guide was written from the facts the analysis has now. */
	guideCurrent: boolean;
	/** A model is set, so a guide can be written. */
	modelReady: boolean;
}

export function guideAvailable(): boolean {
	const models = readSettings()?.models;
	return !!(models?.cheap?.model || models?.strong?.model);
}

function report(analysis: MistakeAnalysis, guide: GuideRecord | null): MistakesReport {
	return { analysis, guide, guideCurrent: !!guide && guide.digest === digest(guideFacts(analysis)), modelReady: guideAvailable() };
}

/** The saved snapshot; the first visit takes one. */
export function mistakesReport(now = new Date()): MistakesReport {
	const saved = analysisStore.read();
	if (saved.analysis) return report(saved.analysis, saved.guide);
	return analyseNow(now);
}

/** Read the log again and save the snapshot with its time, keeping the guide. */
export function analyseNow(now = new Date()): MistakesReport {
	const analysis = analyseMistakes(readLessonLog(), progressStore.read().mixups, now);
	const { guide } = analysisStore.read();
	analysisStore.write({ analysis, guide });
	return report(analysis, guide);
}

const SYSTEM = `You write a short personal study guide for a learner of Slovak from the facts below, which come from their own lesson log. Rules:
- Use only the facts given. Never invent a mistake, a number or a rule the facts do not show.
- Plain English, short sentences, at most 220 words. Slovak only for the example words.
- Exactly three sections, each a line starting "## ": "What keeps going wrong", "What may trip you next", "Do this week".
- Under each, up to three lines starting "- ". Name the words and pairs. Say what improved, if a trend says so.
- "What may trip you next" uses the pairs marked not tested yet and any unit whose trend is worse; say they are guesses.
- "Do this week" gives three concrete steps the app can do: the Mix-ups lesson, a lesson on a named unit, Review.
No greeting, no sign-off.`;

function stepOf(u: Usage) {
	return { inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, cacheWrite1hTokens: u.cacheWrite1h ?? 0, reasoningTokens: u.reasoning };
}

/** Write the guide from the saved analysis. The same facts reuse the saved
 *  guide at no cost; `force` writes again. */
export async function writeGuide(opts: { force?: boolean; now?: Date; engine?: Parameters<typeof runSubagent>[1]["engine"]; model?: string } = {}): Promise<MistakesReport> {
	const saved = analysisStore.read();
	const analysis = saved.analysis ?? analyseNow(opts.now).analysis;
	const facts = guideFacts(analysis);
	const key = digest(facts);
	if (saved.guide?.digest === key && !opts.force) return report(analysis, saved.guide);
	if (analysis.reps === 0) throw new Error("There are no answers to learn from yet. Do a lesson first.");
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "faux:faux" } : storyEngine();
	if (!resolved) throw new Error("No model is configured. Set the cheap slot in Settings → Keys.");
	const steps: ReturnType<typeof stepOf>[] = [];
	const { text } = await runSubagent([], { role: "researcher", engine: resolved.engine, systemPrompt: SYSTEM, prompt: `Facts:\n${facts}`, maxTurns: 1, onUsage: (u) => steps.push(stepOf(u)) });
	const guide: GuideRecord = { text: text.trim(), at: (opts.now ?? new Date()).toISOString(), digest: key, model: resolved.model, usage: { model: resolved.model, steps } };
	analysisStore.write({ analysis, guide });
	return report(analysis, guide);
}
