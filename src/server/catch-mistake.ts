/**
 * Catch the mistake, served (LangHarness, 2026-11-06). The next item is the one
 * waiting for an answer; otherwise a new one is made when a pair the learner
 * mixes up qualifies (src/core/catch-pair.ts) and an AI key is set, and kept
 * in data/profiles/<language>/catch-mistake.json. Only one item waits at a
 * time, and two requests at once share one model call.
 */

import { randomUUID } from "node:crypto";
import { activeProfile } from "../../config.ts";
import { loadLexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import {
	buildCatchItem,
	catchBrief,
	catchMixupEvent,
	gradeTyped,
	isTapRight,
	parseCatchDraft,
	resultOf,
	viewOf,
	CATCH_SPEAKER,
	type CatchNext,
	type CatchResult,
} from "../core/catch-mistake.ts";
import { getPairsForLanguage } from "../core/pairs.ts";
import { chooseCatch, CATCH_RECENT_ITEMS } from "../core/catch-pair.ts";
import { catchStore } from "../store/catch-mistake.ts";
import { progressStore } from "../store/progress.ts";
import { activeLanguage } from "./active-language.ts";
import { noteMixups } from "./mixups.ts";
import { storyEngine } from "./reading.ts";

export interface CatchOptions {
	/** Test seam: a scripted engine replaces the cheap slot's. */
	engine?: PiEngine;
	model?: string;
	now?: Date;
}

let inFlight: Promise<CatchNext> | null = null;

/** The item to answer now: the one waiting, else a new one. */
export function nextCatchItem(opts: CatchOptions = {}): Promise<CatchNext> {
	if (!inFlight) inFlight = makeNext(opts).finally(() => (inFlight = null));
	return inFlight;
}

async function makeNext(opts: CatchOptions): Promise<CatchNext> {
	const waiting = catchStore.list().find((i) => !i.answer);
	if (waiting) return { view: viewOf(waiting) };
	const lexicon = loadLexicon();
	if (!lexicon) return { view: null, reason: "The dictionary for this language is not loaded." };
	const pairs = getPairsForLanguage(activeProfile());
	const target = chooseCatch({
		record: progressStore.read().mixups ?? {},
		lexicon,
		pairs,
		recentPairs: catchStore.list().slice(-CATCH_RECENT_ITEMS).map((i) => i.pair),
		speaker: CATCH_SPEAKER,
	});
	if (!target) return { view: null, reason: "No pair you mix up is ready yet. Keep practicing and check back." };
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "faux:catch" } : storyEngine();
	if (!resolved) return { view: null, reason: "New texts need an AI key. Add one in Settings → API keys." };
	const language = activeLanguage().english;
	const { text } = await runSubagent([], {
		role: "researcher",
		engine: resolved.engine,
		systemPrompt: `You write short practice sentences in ${language} for an adult learner. You answer with one JSON object and nothing else.`,
		prompt: catchBrief(target, language),
		maxTurns: 1,
	});
	const draft = parseCatchDraft(text);
	if (!draft) return { view: null, reason: "The model did not answer in the shape asked for. Try again." };
	const built = buildCatchItem({ id: randomUUID(), now: opts.now ?? new Date(), model: resolved.model, draft, target, lexicon, pairs });
	if ("reason" in built) return { view: null, reason: `The item was not kept (${built.reason}). Try again.` };
	catchStore.add(built.item);
	return { view: viewOf(built.item) };
}

export type CatchAnswerOutcome = { ok: true; result: CatchResult } | { ok: false; status: number; message: string };

/** Grade one answer: the tapped word and the typed word. An item takes one answer. */
export function answerCatch(id: string, input: { sentence: number; token: number; typed: string }, now = new Date()): CatchAnswerOutcome {
	const item = catchStore.find(id);
	if (!item) return { ok: false, status: 404, message: "That item is not here any more." };
	if (item.answer) return { ok: false, status: 409, message: "That item is already answered." };
	const tapOk = isTapRight(item, input);
	const verdict = gradeTyped(item.slip.right, input.typed, activeLanguage().tag);
	item.answer = { sentence: input.sentence, token: input.token, typed: input.typed, tapOk, verdict, at: now.toISOString() };
	catchStore.update(item);
	// The answer counts toward the pair like a lesson's first try, so a mended pair can reopen and a caught one can mend.
	try {
		const p = progressStore.read();
		const before = JSON.stringify(p.mixups ?? {});
		noteMixups(p, [catchMixupEvent(item, item.answer, item.answer.at)]);
		if (JSON.stringify(p.mixups ?? {}) !== before) progressStore.write(p);
	} catch (err) {
		console.warn("[catch] could not record the answer in the mix-ups:", err instanceof Error ? err.message : err);
	}
	return { ok: true, result: resultOf(item) };
}
