/**
 * Placement checks on disk (LangHarness, 2026-10-28):
 *
 *   placement/<id>.json      the whole check: every ladder item with the
 *                            learner's answer and verdict, the model's
 *                            judgements of typed misses, the Socratic turns,
 *                            the vocabulary ticks and estimate, the outcome,
 *                            and the usage (cost)
 *   placement/index.jsonl    one line per finished check
 *
 * Written whole after every step, so a crash loses one answer at most.
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { LessonItem, RepVerdict, UnitId } from "../core/lesson.ts";
import type { PlacementOutcome, ProbeTurn, ProbeVerdict } from "../core/onboarding.ts";
import type { LadderState } from "../core/placement-ladder.ts";
import type { StoryUsage } from "../core/reading.ts";
import type { VocabAnswer, VocabEstimate, VocabItem } from "../core/vocab-probe.ts";

export interface Judgement {
	accepted: boolean;
	note: string;
	/** An earlier miss of this check that this one repeats, as the learner typed it. */
	repeat?: string;
}

export interface PlacementItemRecord {
	item: LessonItem;
	/** The ladder rung the item was asked for. A union unit (cases-mix,
	 *  verbs-mix) hands out items of its member units, so `item.unit` can
	 *  differ: the answer is scored on the rung. */
	rung: UnitId;
	at: string;
	given?: string;
	/** The verdict that counted (after the model's judgement, when asked). */
	verdict?: RepVerdict;
	/** The client's string verdict was "wrong" and the model was asked. */
	judged?: Judgement;
	ms?: number;
}

export interface PlacementSession {
	id: string;
	startedAt: string;
	endedAt?: string;
	recheck: boolean;
	from: number;
	seed: number;
	ladder: LadderState;
	items: PlacementItemRecord[];
	probe: {
		units: UnitId[];
		luck?: UnitId | null;
		turns: ProbeTurn[];
		verdicts: ProbeVerdict[];
		summary?: string;
		skipped?: boolean;
	};
	words?: {
		items: VocabItem[];
		answers?: VocabAnswer[];
		estimate?: VocabEstimate;
	};
	outcome?: PlacementOutcome;
	usage: StoryUsage;
	ms?: number;
}

export interface PlacementIndexEntry {
	id: string;
	startedAt: string;
	endedAt: string;
	recheck: boolean;
	items: number;
	probeTurns: number;
	level?: string;
	startChapter?: string;
	vocabulary?: number;
	model: string;
}

const ID = /^[a-z0-9][a-z0-9_-]*$/;
const INDEX = () => path.join(PATHS.placement, "index.jsonl");

function file(id: string): string {
	if (!ID.test(id)) throw new Error(`bad placement id ${id}`);
	return path.join(PATHS.placement, `${id}.json`);
}

function readJsonl<T>(f: string): T[] {
	let raw: string;
	try {
		raw = fs.readFileSync(f, "utf-8");
	} catch {
		return [];
	}
	const out: T[] = [];
	for (const line of raw.split("\n")) {
		const s = line.trim();
		if (!s) continue;
		try {
			out.push(JSON.parse(s) as T);
		} catch {
			// a torn line is skipped
		}
	}
	return out;
}

export const placementStore = {
	get(id: string): PlacementSession | null {
		try {
			return JSON.parse(fs.readFileSync(file(id), "utf-8")) as PlacementSession;
		} catch {
			return null;
		}
	},
	put(s: PlacementSession): void {
		const f = file(s.id);
		fs.mkdirSync(path.dirname(f), { recursive: true });
		const tmp = `${f}.${process.pid}.tmp`;
		fs.writeFileSync(tmp, JSON.stringify(s, null, "\t"), "utf-8");
		fs.renameSync(tmp, f);
	},
	index(s: PlacementSession): void {
		const entry: PlacementIndexEntry = {
			id: s.id,
			startedAt: s.startedAt,
			endedAt: s.endedAt ?? new Date().toISOString(),
			recheck: s.recheck,
			items: s.items.length,
			probeTurns: s.probe.turns.length,
			level: s.outcome?.level,
			startChapter: s.outcome?.startChapter,
			...(s.words?.estimate ? { vocabulary: s.words.estimate.size } : {}),
			model: s.usage.model,
		};
		fs.mkdirSync(PATHS.placement, { recursive: true });
		fs.appendFileSync(INDEX(), `${JSON.stringify(entry)}\n`, "utf-8");
	},
	list(): PlacementIndexEntry[] {
		return readJsonl<PlacementIndexEntry>(INDEX()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
	},
};
