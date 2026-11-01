/**
 * My mistakes service (src/core/mistakes.ts) — behind /mistakes and
 * /api/mistakes. The analysis (mistakes-snapshot.ts) is local and saved with
 * its time. The guide is optional:
 * one cheap-model call from the analysis's facts (including the latest wrong
 * answers, which the local figures do not show), written to disk and reused
 * until the facts change.
 */

import type { Usage } from "@earendil-works/pi-ai";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { digest, guideFacts, parseGuide } from "../core/mistakes.ts";
import { analysisStore, type GuideRecord } from "../store/analysis.ts";
import { storyEngine } from "./reading.ts";
import { aiMissing, aiStatus, friendlyAiError } from "./ai-status.ts";
import { analyseNow, mistakesReportOf, type MistakesReport } from "./mistakes-snapshot.ts";

const SYSTEM = `You are a Slovak teacher reading a learner's own answers. The facts below are their unit scores, trends, word mix-ups and the latest wrong first tries, each with the sentence, the form wanted and what they wrote. Find the patterns behind the mistakes and say what to do about them.

Rules:
- Use only the facts. Never invent a mistake, a number or a sentence. Slovak examples must come from the facts' own sentences.
- A pattern is a reason several misses share (for example: the ending after a preposition, a case mixed with another, one word taken for its look-alike). Name it, quote the evidence, say why it happens in plain words, and give one concrete fix.
- "next" are guesses about what may trip them next, from pairs marked not tested yet and units whose trend is worse. Say they are guesses.
- "plan" is up to four steps the app can open: kind "mixups" (the Mix-ups lesson), "unit" (a lesson, with the unit's title as given in the facts in "unit"), "review", or "other".
- Plain English, short sentences. Say what improved, if a trend says so.

Reply with one JSON object and nothing else:
{"patterns":[{"title":"","evidence":"","why":"","fix":""}],"next":[{"what":"","why":""}],"plan":[{"step":"","kind":"mixups"}]}
At most 4 patterns, 4 guesses and 4 steps.`;

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
	if (saved.guide?.digest === key && !opts.force) return mistakesReportOf(analysis, saved.guide);
	if (analysis.reps === 0) throw new Error("There are no answers to learn from yet. Do a lesson first.");
	if (!opts.engine) {
		const status = aiStatus();
		if (!status.ready) throw new Error(aiMissing(status));
	}
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "faux:faux" } : storyEngine();
	if (!resolved) throw new Error(aiMissing({ ready: false, reason: "no-model" }));
	const steps: ReturnType<typeof stepOf>[] = [];
	let text: string;
	try {
		({ text } = await runSubagent([], { role: "researcher", engine: resolved.engine, systemPrompt: SYSTEM, prompt: `Facts:\n${facts}`, maxTurns: 1, onUsage: (u) => steps.push(stepOf(u)) }));
	} catch (err) {
		throw new Error(friendlyAiError(err));
	}
	const guide: GuideRecord = { text: text.trim(), data: parseGuide(text), at: (opts.now ?? new Date()).toISOString(), digest: key, model: resolved.model, usage: { model: resolved.model, steps } };
	analysisStore.write({ analysis, guide });
	return mistakesReportOf(analysis, guide);
}
