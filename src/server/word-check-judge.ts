import { createFauxCore, fauxAssistantMessage, type Usage } from "@earendil-works/pi-ai";
import fs from "node:fs";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import type { LanguageInfo } from "../core/language.ts";
import type { StoryUsage } from "../core/reading.ts";
import { plainMeaning } from "../core/word-estimate.ts";
import { wordCheckStore } from "../store/word-check.ts";
import { activeLanguage } from "./active-language.ts";
import { storyEngine } from "./reading.ts";

export interface MeaningJudgement {
	accepted: boolean;
	note: string;
}

export interface MeaningToJudge {
	slug: string;
	word: string;
	glosses: readonly string[];
	typed: string;
}

const NOTE_LIMIT = 160;
const TYPED_LINE = "The learner typed: ";

export function meaningJudgeSystem(lang: Pick<LanguageInfo, "english"> = activeLanguage()): string {
	return `You mark one answer in a vocabulary test inside a language-learning app. The learner saw one ${lang.english} word with no sentence around it and typed what it means in English. You get the word, every meaning the dictionary gives for that written form, and what the learner typed. Decide whether the answer shows that the learner knows a meaning of the word.

Accept when the typed answer is:
- a synonym or close paraphrase of any listed meaning;
- the same meaning in another grammatical form ("smiling" or "smile" for "to smile");
- the same English word with a spelling slip that leaves no doubt which word was meant;
- a common translation of the word that the dictionary did not list, if you are sure of it.

Reject when the typed answer is:
- a different meaning, even a related one ("chair" for a word that means "table");
- the meaning of another ${lang.english} word that looks or sounds similar;
- so broad that it would fit many words ("thing", "to do something");
- several unrelated guesses;
- not English, or not a meaning at all.

When you are not sure, reject. A wrong reject costs the learner one word. A wrong accept makes their measured vocabulary too large.

Reply with only a JSON object: {"accept": true or false, "note": "at most 12 words for the learner, saying why"}`;
}

export function meaningJudgePrompt(m: MeaningToJudge): string {
	return [`Word: ${m.word}`, `The dictionary's meanings: ${m.glosses.join(" | ")}`, `${TYPED_LINE}${m.typed}`].join(
		"\n",
	);
}

export function parseMeaningJudgement(text: string): MeaningJudgement | null {
	const json = text.match(/\{[\s\S]*\}/);
	if (!json) return null;
	try {
		const reply = JSON.parse(json[0]) as { accept?: unknown; note?: unknown };
		if (typeof reply.accept !== "boolean") return null;
		return {
			accepted: reply.accept,
			note: typeof reply.note === "string" ? reply.note.trim().slice(0, NOTE_LIMIT) : "",
		};
	} catch {
		return null;
	}
}

let scripted: { file: string; engine: PiEngine } | null = null;

/** A scripted marker for screenshots and UI work without a key:
 *  LANNA_WORD_CHECK_SCRIPT=<path to JSON {"accept": ["typed answer", …], "note": "…"}>.
 *  Dev only; never set in the desktop app. */
function scriptedEngine(): PiEngine | null {
	const scriptPath = process.env.LANNA_WORD_CHECK_SCRIPT;
	if (!scriptPath || process.env.NODE_ENV === "production") return null;
	let file: string;
	try {
		file = `${scriptPath}@${fs.statSync(scriptPath).mtimeMs}`;
	} catch {
		return null;
	}
	if (scripted?.file === file) return scripted.engine;
	try {
		const script = JSON.parse(fs.readFileSync(scriptPath, "utf-8")) as { accept?: unknown; note?: unknown };
		const accepted = new Set(
			Array.isArray(script.accept)
				? script.accept.filter((a): a is string => typeof a === "string").map(plainMeaning)
				: [],
		);
		const faux = createFauxCore({ tokenSize: { min: 32, max: 32 } });
		const engine: PiEngine = {
			model: faux.getModel(),
			streamFn: (model, context, options) => {
				const last = context.messages[context.messages.length - 1];
				const prompt =
					last && typeof last.content === "string"
						? last.content
						: Array.isArray(last?.content)
							? last.content.map((c) => ("text" in c ? c.text : "")).join("")
							: "";
				const typed =
					prompt
						.split("\n")
						.find((line) => line.startsWith(TYPED_LINE))
						?.slice(TYPED_LINE.length) ?? "";
				const accept = accepted.has(plainMeaning(typed));
				faux.setResponses([
					fauxAssistantMessage(
						JSON.stringify({ accept, note: accept && typeof script.note === "string" ? script.note : "" }),
					),
				]);
				return faux.streamSimple(model, context, options);
			},
		};
		scripted = { file, engine };
		return engine;
	} catch {
		return null;
	}
}

function marker(given?: PiEngine): { engine: PiEngine; model: string } | null {
	if (given) return { engine: given, model: "given" };
	const script = scriptedEngine();
	return script ? { engine: script, model: "scripted" } : storyEngine();
}

export function canJudgeMeanings(engine?: PiEngine): boolean {
	return marker(engine) !== null;
}

export function wordCheckModel(engine?: PiEngine): string {
	return marker(engine)?.model ?? "none";
}

function stepOf(u: Usage): StoryUsage["steps"][number] {
	return {
		inputTokens: u.input,
		outputTokens: u.output,
		cacheReadTokens: u.cacheRead,
		cacheWriteTokens: u.cacheWrite,
		cacheWrite1hTokens: u.cacheWrite1h ?? 0,
		reasoningTokens: u.reasoning,
	};
}

export async function judgeMeaning(
	m: MeaningToJudge,
	usage: StoryUsage,
	opts: { engine?: PiEngine; now?: Date } = {},
): Promise<MeaningJudgement | null> {
	const key = `${m.slug}|${plainMeaning(m.typed)}`;
	const kept = wordCheckStore.judgements()[key];
	if (kept) return { accepted: kept.accepted, note: kept.note };
	const real = marker(opts.engine);
	if (!real) return null;
	try {
		const { text } = await runSubagent([], {
			role: "researcher",
			engine: real.engine,
			systemPrompt: meaningJudgeSystem(),
			prompt: meaningJudgePrompt(m),
			maxTurns: 1,
			onUsage: (u) => usage.steps.push(stepOf(u)),
		});
		const judged = parseMeaningJudgement(text);
		if (judged)
			wordCheckStore.putJudgement(key, { ...judged, model: real.model, at: (opts.now ?? new Date()).toISOString() });
		return judged;
	} catch {
		return null;
	}
}
