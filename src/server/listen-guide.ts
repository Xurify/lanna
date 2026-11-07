/**
 * The deep read of the learner's listening (src/core/listen-guide.ts), behind
 * /api/mistakes {action: "listen-guide"}. One model call (the Strong slot, else
 * Cheap) over the figures the local analysis already holds, written to disk and
 * reused until those figures change, so the same evidence is paid for once. The
 * model explains and connects; it adds no figure.
 */

import type { Usage } from "@earendil-works/pi-ai";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { listenGuideFacts, parseListenGuide, type ListenGuideRecord } from "../core/listen-guide.ts";
import { digest } from "../core/mistakes.ts";
import { LISTEN_MIN_MISSED, LISTEN_MIN_SESSIONS, LISTEN_MIN_TYPED } from "../core/listen-analysis.ts";
import { analysisStore } from "../store/analysis.ts";
import { piEngineForSpec, type PiEngine } from "../agent/models.ts";
import { aiMissing, aiSlot, aiStatus, friendlyAiError } from "./ai-status.ts";
import { analyzeNow, mistakesReportOf, type MistakesReport } from "./mistakes-snapshot.ts";
import { activeLanguage } from "./active-language.ts";
import type { LanguageInfo } from "../core/language.ts";

export function listenGuideSystem(lang: Pick<LanguageInfo, "english" | "promptExamples"> = activeLanguage()): string {
	const name = lang.english;
	const spelling = lang.promptExamples?.spellingSlips ?? "A letter written as it is said rather than as the spelling has it is a spelling rule";
	return `You are a ${name} teacher reading a learner's Listen results: they heard a sentence, typed what they heard, and the app compared the two word by word and gave every difference one cause. The facts below are the app's own figures, with every trend already called, or not, by a statistical test.

Rules:
- Use only the facts. Never invent a number, a sentence, a cause or a trend. ${name} examples must come from the facts' own misses.
- A trend is "less often" or "more often" only where the facts say it was called. "No clear change" means the figures show nothing either way: never write "stable", "the same" or "no problem" for it. Weekly counts are small and noisy: describe them, never call a trend from them.
- Keep the kinds apart. A word the learner had not met is vocabulary. The right word with the wrong ending is grammar, not hearing. ${spelling}, not the ear. A one-letter slip may be typing. Say which a pattern is, and where it is not hearing, say so and point to grammar or spelling practice instead of Listen.
- A pattern is something several misses share. Name it, quote the evidence from the misses, say why it happens in plain words and give one concrete fix. A single miss is a slip. At most four patterns.
- "noticed" is the part the learner could not have worked out alone: up to three things that no single figure says. A link between two figures, one of the app's findings explained, or a contrast (something better than they would expect). Say why it matters. A link the facts do not state is a guess: begin it "This may be". Do not repeat what a pattern already says.
- "tips" are up to four things to try, each tied to a pattern, a cause or a finding, and saying which one in "why". They may use ordinary listening technique (type as you hear instead of after the clip, write the first word before replaying, replay once only for the ending, say the sentence under your breath) but must not promise a result or quote a number the facts do not hold.
- Connect the figures where they agree: for example short words dropped, and a worse second half of the session, or fast clips typed correctly less often. Say when two figures point the same way and when they do not.
- What to practice is in the app's own terms: Listen (typed), the snail button for slow play, replaying a sentence, Review, a Learn unit. Do not invent features.
- "limits" is one honest sentence on what these figures cannot show yet (sample size, typing against hearing).
- Plain English, short sentences. Name grammar in full words (accusative, locative, 1st person singular).

Reply with one JSON object and nothing else:
{"summary":"","patterns":[{"title":"","evidence":"","why":"","fix":""}],"noticed":[{"what":"","why":""}],"tips":[{"tip":"","why":""}],"trends":[{"what":"","read":""}],"next":[""],"limits":""}
At most 4 patterns, 3 noticed, 4 tips, 4 trends and 4 next steps.`;
}

function readEngine(): { engine: PiEngine; model: string } | null {
	const slot = aiSlot("strong");
	if (!slot?.model) return null;
	const spec = { provider: slot.model.provider, id: slot.model.id, ...(slot.thinkingLevel ? { thinkingLevel: slot.thinkingLevel } : {}) };
	return { engine: piEngineForSpec(spec, true), model: `${spec.provider}:${spec.id}` };
}

function stepOf(u: Usage) {
	return { inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, cacheWrite1hTokens: u.cacheWrite1h ?? 0, reasoningTokens: u.reasoning };
}

/** Write the deep read from the saved analysis. The same facts reuse the saved read at no cost; `force` writes again. `say` stands in for the model in tests. */
export async function writeListenGuide(opts: { force?: boolean; now?: Date; say?: (system: string, prompt: string) => Promise<string> } = {}): Promise<MistakesReport> {
	const saved = analysisStore.read();
	const analysis = saved.analysis ?? analyzeNow(opts.now).analysis;
	const l = analysis.listening;
	if (!l || !l.ready) {
		throw new Error(
			`The deep read needs ${LISTEN_MIN_TYPED} typed Listen sentences, ${LISTEN_MIN_MISSED} of them with a miss, over ${LISTEN_MIN_SESSIONS} sessions; you have ${l?.readable ?? 0}, ${l?.read ?? 0} and ${l?.readSessions ?? 0}. A few more Listen sessions, then try again.`,
		);
	}
	const facts = listenGuideFacts(l);
	const key = digest(facts);
	if (saved.listenGuide?.digest === key && !opts.force) return mistakesReportOf(analysis, saved.guide, saved.listenGuide);
	const at = (opts.now ?? new Date()).toISOString();
	const steps: ReturnType<typeof stepOf>[] = [];
	let text: string;
	let model = "faux:faux";
	if (opts.say) {
		text = await opts.say(listenGuideSystem(), `Facts:\n${facts}`);
	} else {
		const status = aiStatus("strong");
		if (!status.ready) throw new Error(aiMissing(status));
		const resolved = readEngine();
		if (!resolved) throw new Error(aiMissing({ ready: false, reason: "no-model" }));
		model = resolved.model;
		try {
			({ text } = await runSubagent([], { role: "researcher", engine: resolved.engine, systemPrompt: listenGuideSystem(), prompt: `Facts:\n${facts}`, maxTurns: 1, onUsage: (u) => steps.push(stepOf(u)) }));
		} catch (err) {
			throw new Error(friendlyAiError(err));
		}
	}
	const listenGuide: ListenGuideRecord = { text: text.trim(), data: parseListenGuide(text), at, digest: key, model, usage: { model, steps } };
	analysisStore.write({ analysis, guide: saved.guide, listenGuide });
	return mistakesReportOf(analysis, saved.guide, listenGuide);
}
