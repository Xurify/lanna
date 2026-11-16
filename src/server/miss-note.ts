import { activeProfile } from "../../config.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import {
	enoughEvidence,
	judgeMissNoteBrief,
	missNoteBrief,
	missNoteEvidence,
	missNoteRecord,
	missNoteSettled,
	MISS_NOTE_JUDGE_SYSTEM,
	MISS_NOTE_SYSTEM,
	parseJudgement,
	parseMissNote,
	type MissNote,
} from "../core/miss-note.ts";
import { processWide } from "../core/process-wide.ts";
import { mixupKey } from "../core/mixups.ts";
import type { LexiconEntry } from "../core/review.ts";
import { missNoteStore } from "../store/miss-notes.ts";
import { activeLanguage } from "./active-language.ts";
import { storyEngine } from "./reading.ts";

interface MissNoteOptions {
	engine?: PiEngine;
	model?: string;
	judge?: boolean;
	now?: Date;
}

const inFlight = processWide("missNote.inFlight", () => new Map<string, Promise<MissNote | null>>());

export function cachedMissNote(a: Pick<LexiconEntry, "slug">, b: Pick<LexiconEntry, "slug">): MissNote | undefined {
	const note = missNoteStore.get(mixupKey(a.slug, b.slug));
	return note && missNoteSettled(note) ? note : undefined;
}

export function ensureMissNote(a: LexiconEntry, b: LexiconEntry, opts: MissNoteOptions = {}): Promise<MissNote | null> {
	const known = cachedMissNote(a, b);
	if (known) return Promise.resolve(known);
	const flightKey = `${activeProfile()}:${mixupKey(a.slug, b.slug)}`;
	let next = inFlight.get(flightKey);
	if (!next) {
		next = writeMissNote(a, b, opts).finally(() => inFlight.delete(flightKey));
		inFlight.set(flightKey, next);
	}
	return next;
}

async function ask(engine: PiEngine, systemPrompt: string, prompt: string): Promise<{ text: string; cost: number }> {
	let cost = 0;
	const { text } = await runSubagent([], { role: "researcher", engine, systemPrompt, prompt, maxTurns: 1, onUsage: (u) => (cost += u.cost?.total ?? 0) });
	return { text, cost };
}

async function writeMissNote(a: LexiconEntry, b: LexiconEntry, opts: MissNoteOptions): Promise<MissNote | null> {
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "faux:miss-note" } : storyEngine();
	if (!resolved) return null;
	const { english, tag } = activeLanguage();
	const evidence = missNoteEvidence(a, b, tag);
	if (!enoughEvidence(evidence)) return null;
	const started = Date.now();
	let written: { text: string; cost: number };
	try {
		written = await ask(resolved.engine, MISS_NOTE_SYSTEM(english), missNoteBrief(evidence, english));
	} catch (err) {
		console.warn("[miss-note] the model call failed:", err instanceof Error ? err.message : err);
		return null;
	}
	let note = missNoteRecord(evidence, parseMissNote(written.text), written.text, { model: resolved.model, now: opts.now ?? new Date(), cost: written.cost }, tag);
	if (note.status === "kept" && opts.judge !== false) {
		try {
			const judged = await ask(resolved.engine, MISS_NOTE_JUDGE_SYSTEM(english), judgeMissNoteBrief(evidence, note.note!, english));
			const judge = parseJudgement(judged.text) ?? { supported: false, problem: "the judge did not answer in the shape asked for" };
			note = { ...note, judge, cost: (note.cost ?? 0) + judged.cost, ...(judge.supported ? {} : { status: "rejected" as const, reason: `judge: ${judge.problem ?? "not supported"}` }) };
		} catch (err) {
			console.warn("[miss-note] the judge call failed:", err instanceof Error ? err.message : err);
			return null;
		}
	}
	const previous = missNoteStore.get(note.key);
	note = { ...note, ms: Date.now() - started, attempts: (previous ? (previous.attempts ?? 1) : 0) + 1 };
	missNoteStore.put(note);
	return note;
}
