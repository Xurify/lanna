/**
 * Meaning questions with wrong answers worth reading (LangHarness,
 * 2026-10-30). A lesson's meaning reps come out of the
 * local builders with length-matched wrong meanings, which a learner can rule
 * out without knowing a word of the language. This swaps them for close ones:
 *
 *   cached near-miss → close dictionary neighbors → (the old options)
 *
 * and, only when a sentence has fewer than two close ones, asks the cheap
 * model once for two near-misses, in one batch for the whole plan, kept on
 * disk (src/store/distractors.ts). The wait is capped; past the cap the
 * plan goes out with what the dictionary gave and the model's answer is kept
 * for next time. No model configured: dictionary neighbors only.
 */

import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { buildNeighborIndex, chooseOptions, neighbors, type NeighborIndex } from "../core/distractors.ts";
import { rng } from "../core/lesson.ts";
import type { LessonPlan, UnitId } from "../core/lesson.ts";
import { distractorStore, type NearMiss } from "../store/distractors.ts";
import { storyEngine } from "./reading.ts";
import { activeLanguage } from "./active-language.ts";
import { lessonFor, lessonSeed } from "./lesson.ts";
import type { AtlasGender } from "../core/grammar.ts";

/** Close wrong options a sentence should have before the model is asked. */
const WANT_CLOSE = 2;
const BATCH_MAX = 16;
const DEFAULT_WAIT_MS = 6_000;

function distractorSystem(name: string = activeLanguage().english): string {
	return `You write wrong answers for a multiple-choice question inside a ${name} learning app. You answer with ONE JSON object and nothing else: {"near": [["...", "..."], ["...", "..."]]} — one pair per sentence, in the same order, the same count.

For each ${name} sentence you get its right English translation. Write exactly TWO wrong English translations that a learner who misread ONE thing would pick:
- Change a single detail that the ${name} carries in a word form or ending: who (I, you, he, we, they), number, tense, polarity (is, is not), question or statement, who does what to whom.
- Keep every other word the same, with the same length and style as the right one.
- Each must be clearly wrong for the ${name} sentence, never another valid translation of it.
- The two wrong ones must differ from each other.`;
}

let indexFor: { lexicon: Lexicon; index: NeighborIndex } | null = null;

function neighborIndex(lexicon: Lexicon): NeighborIndex {
	if (indexFor?.lexicon !== lexicon) {
		indexFor = {
			lexicon,
			index: buildNeighborIndex(
				lexicon.entries.flatMap((e) => e.examples.filter((x) => !x.rejected).map((x) => x.en ?? "")),
			),
		};
	}
	return indexFor.index;
}

interface BetterOptionsOptions {
	/** Test seam: a scripted engine replaces the cheap slot's. */
	engine?: PiEngine;
	model?: string;
	/** Longest the plan waits for the model; the answer is kept regardless. */
	waitMs?: number;
	seed?: number;
}

interface OptionItem {
	sentence: string;
	translation: string;
	options?: string[];
}

const inFlight = new Set<string>();

export function parseNearMisses(text: string, count: number): string[][] | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		const raw = (JSON.parse(text.slice(start, end + 1)) as { near?: unknown }).near;
		if (!Array.isArray(raw) || raw.length !== count) return null;
		return raw.map((p) =>
			Array.isArray(p)
				? p.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
				: [],
		);
	} catch {
		return null;
	}
}

async function writeNearMisses(
	need: readonly OptionItem[],
	resolved: { engine: PiEngine; model: string },
): Promise<void> {
	const input = { in: 0, out: 0 };
	const prompt = `Sentences (${activeLanguage().english} — right English translation):\n${JSON.stringify(need.map((n) => [n.sentence, n.translation]))}\n\nReturn {"near": [...]} with ${need.length} pairs.`;
	const { text } = await runSubagent([], {
		role: "researcher",
		engine: resolved.engine,
		systemPrompt: distractorSystem(),
		prompt,
		maxTurns: 1,
		onUsage: (u) => {
			input.in += u.input;
			input.out += u.output;
		},
	});
	const pairs = parseNearMisses(text, need.length);
	if (!pairs) return;
	const now = new Date().toISOString();
	const tokens = { input: Math.round(input.in / need.length), output: Math.round(input.out / need.length) };
	const kept: NearMiss[] = [];
	need.forEach((n, i) => {
		const own = n.translation.trim().toLowerCase();
		const near = [...new Set(pairs[i]!.filter((s) => s.toLowerCase() !== own))].slice(0, 2);
		if (near.length > 0)
			kept.push({ sk: n.sentence, en: n.translation, near, model: resolved.model, createdAt: now, tokens });
	});
	distractorStore.append(kept);
}

/** Replace the options of every item that has a translation to test. */
export async function betterOptions(items: readonly OptionItem[], opts: BetterOptionsOptions = {}): Promise<void> {
	const lexicon = loadLexicon();
	if (!lexicon || items.length === 0) return;
	const index = neighborIndex(lexicon);
	const rand = rng(opts.seed ?? Date.now());
	const choose = (item: OptionItem) => {
		const near = distractorStore.get(item.sentence)?.near ?? [];
		const wrong = (item.options ?? []).filter((o) => o.trim().toLowerCase() !== item.translation.trim().toLowerCase());
		return chooseOptions(item.translation, near, neighbors(index, item.translation), wrong, rand);
	};
	const weak = items.filter(
		(it) =>
			it.translation &&
			choose(it).close < WANT_CLOSE &&
			!distractorStore.get(it.sentence) &&
			!inFlight.has(it.sentence),
	);
	const resolved = opts.engine
		? { engine: opts.engine, model: opts.model ?? "faux:faux" }
		: weak.length > 0
			? storyEngine()
			: null;
	if (resolved && weak.length > 0) {
		const need = [...new Map(weak.map((w) => [w.sentence, w])).values()].slice(0, BATCH_MAX);
		for (const n of need) inFlight.add(n.sentence);
		const job = writeNearMisses(need, resolved)
			.catch((err) => console.warn("[distractors] near-misses failed:", err instanceof Error ? err.message : err))
			.finally(() => {
				for (const n of need) inFlight.delete(n.sentence);
			});
		await Promise.race([
			job,
			new Promise<void>((resolve) => setTimeout(resolve, opts.waitMs ?? DEFAULT_WAIT_MS).unref?.()),
		]);
	}
	for (const item of items) if (item.translation) item.options = choose(item).options;
}

export function unitLesson(unit: UnitId, opts: { gender?: AtlasGender } = {}): Promise<LessonPlan> {
	const seed = lessonSeed(unit, opts.gender);
	return lessonWithBetterOptions(lessonFor(unit, seed, opts), { seed });
}

/** A lesson plan with its meaning reps' options made close. */
export async function lessonWithBetterOptions(plan: LessonPlan, opts?: BetterOptionsOptions): Promise<LessonPlan> {
	await betterOptions(
		plan.items.filter((i) => i.kind === "meaning"),
		opts,
	);
	return plan;
}
