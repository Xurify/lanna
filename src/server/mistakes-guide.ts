/**
 * My mistakes service (src/core/mistakes.ts) — behind /mistakes and
 * /api/mistakes. The analysis (mistakes-snapshot.ts) is local and saved with
 * its time. The guide is optional:
 * one model call (the Strong slot, else Cheap) from the analysis's facts (including the latest wrong
 * answers, which the local figures do not show), written to disk and reused
 * until the facts change.
 */

import type { Usage } from "@earendil-works/pi-ai";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { loadLexicon } from "../agent/lexicon.ts";
import { digest, guideFacts, guideReadiness, parseGuide } from "../core/mistakes.ts";
import { addGuideProbes, mixupLexicon } from "../core/mixups.ts";
import { resolvePractice } from "../core/personal.ts";
import { progressStore } from "../store/progress.ts";
import { analysisStore, type GuideRecord } from "../store/analysis.ts";
import { aspectFrames } from "./aspect-frames.ts";
import { piEngineForSpec, type PiEngine } from "../agent/models.ts";
import { aiMissing, aiSlot, aiStatus, friendlyAiError } from "./ai-status.ts";
import { analyzeNow, mistakesReportOf, type MistakesReport } from "./mistakes-snapshot.ts";
import { activeLanguage } from "./active-language.ts";

function mistakesGuideSystem(name: string = activeLanguage().english): string {
	return `You are a ${name} teacher reading a learner's own answers. The facts below are their unit scores, trends, word mix-ups and the latest wrong first tries, each with the sentence, the form wanted and what they wrote. Find the patterns behind the mistakes and say what to do about them.

Rules:
- Use only the facts. Never invent a mistake, a number or a sentence. ${name} examples must come from the facts' own sentences.
- A pattern is a reason several misses share (for example: the ending after a preposition, a case mixed with another, one word taken for its look-alike). Name it, quote the evidence, say why it happens in plain words, and give one concrete fix. A pattern needs at least two misses behind it. A unit marked "too few answers to call weak" is not a pattern by itself; a single miss is a slip, not a pattern.
- "next" are guesses about what may trip them next, from pairs marked not tested yet and units whose trend is worse. Say they are guesses.
- "plan" is up to four steps the app can open: kind "mixups" (the Mix-ups lesson), "unit" (a lesson; put the unit's id, the word in [brackets] in the facts, in "unit"), "review", or "other".
- "practice" is what the learner's personal lesson will drill. The app builds it from its own checked sentences, so name targets, never sentences: "words" are up to 6 dictionary forms (lemmas) taken from the facts, "units" up to 3 unit ids from the [brackets], "pairs" up to 3 pairs of dictionary forms the learner confuses or is likely to confuse. Pick what the patterns point at, most useful first.
- Lines that start "In chats" come from the learner's talks with the tutor: the question the tutor asked is not in the facts, so quote only what is there, and treat them as evidence for the same patterns.
- Plain English, short sentences. Say what improved, if a trend says so.
- In every text field, name grammar in full words (feminine accusative, locative, 1st person singular) and units by their name. The ids in [brackets] go only in "unit" and "practice.units", never in a sentence.

Reply with one JSON object and nothing else:
{"patterns":[{"title":"","evidence":"","why":"","fix":""}],"next":[{"what":"","why":""}],"plan":[{"step":"","kind":"mixups"}],"practice":{"words":[],"units":[],"pairs":[["",""]]}}
At most 4 patterns, 4 guesses and 4 steps.`;
}

/** The Strong slot when set (finding the reason behind several misses is
 *  reasoning, and it runs a few times a week), else Cheap; with the slot's
 *  own thinking level. */
function guideEngine(): { engine: PiEngine; model: string } | null {
	const slot = aiSlot("strong");
	if (!slot?.model) return null;
	const spec = {
		provider: slot.model.provider,
		id: slot.model.id,
		...(slot.thinkingLevel ? { thinkingLevel: slot.thinkingLevel } : {}),
	};
	return { engine: piEngineForSpec(spec, true), model: `${spec.provider}:${spec.id}` };
}

function stepOf(u: Usage) {
	return {
		inputTokens: u.input,
		outputTokens: u.output,
		cacheReadTokens: u.cacheRead,
		cacheWriteTokens: u.cacheWrite,
		cacheWrite1hTokens: u.cacheWrite1h ?? 0,
		reasoningTokens: u.reasoning,
	};
}

/** Write the guide from the saved analysis. The same facts reuse the saved
 *  guide at no cost; `force` writes again. */
export async function writeGuide(
	opts: { force?: boolean; now?: Date; engine?: Parameters<typeof runSubagent>[1]["engine"]; model?: string } = {},
): Promise<MistakesReport> {
	const saved = analysisStore.read();
	const analysis = saved.analysis ?? analyzeNow(opts.now).analysis;
	const facts = guideFacts(analysis);
	const key = digest(facts);
	if (saved.guide?.digest === key && !opts.force)
		return mistakesReportOf(analysis, saved.guide, saved.listenGuide ?? null);
	const enough = guideReadiness(analysis);
	if (!enough.ready)
		throw new Error(
			`The guide needs at least ${enough.needReps} first tries with ${enough.needWrong} mistakes among them; you have ${enough.reps} and ${enough.wrong}. A few more lessons, then try again.`,
		);
	if (!opts.engine) {
		const status = aiStatus("strong");
		if (!status.ready) throw new Error(aiMissing(status));
	}
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "faux:faux" } : guideEngine();
	if (!resolved) throw new Error(aiMissing({ ready: false, reason: "no-model" }));
	const steps: ReturnType<typeof stepOf>[] = [];
	let text: string;
	try {
		({ text } = await runSubagent([], {
			role: "researcher",
			engine: resolved.engine,
			systemPrompt: mistakesGuideSystem(),
			prompt: `Facts:\n${facts}`,
			maxTurns: 1,
			onUsage: (u) => steps.push(stepOf(u)),
		}));
	} catch (err) {
		throw new Error(friendlyAiError(err));
	}
	const data = parseGuide(text);
	const at = (opts.now ?? new Date()).toISOString();
	const entries = loadLexicon()?.entries ?? [];
	const practice = resolvePractice(data?.practice, data?.patterns.map((p) => p.title) ?? [], entries, aspectFrames());
	// The pairs the guide named are tested before they are taught, like a family's.
	if (practice?.pairs.length) {
		const p = progressStore.read();
		p.mixups = addGuideProbes(p.mixups ?? {}, practice.pairs, mixupLexicon(entries, aspectFrames()), at);
		progressStore.write(p);
	}
	const guide: GuideRecord = {
		text: text.trim(),
		data,
		practice,
		at: (opts.now ?? new Date()).toISOString(),
		digest: key,
		model: resolved.model,
		usage: { model: resolved.model, steps },
	};
	const kept = analysisStore.update((latest) => ({ ...latest, analysis: latest.analysis ?? analysis, guide }));
	return mistakesReportOf(analysis, guide, kept.listenGuide ?? null);
}
