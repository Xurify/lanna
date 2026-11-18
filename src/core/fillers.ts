/**
 * Fillers and reactions: the little words that buy time, rephrase, agree
 * and show listening. Fluent listeners judge a speaker partly by them
 * (Hasselgren 2002), and buying time is a teachable communication strategy
 * (Dörnyei 1995). The kits are per language in curriculum/<language>/fillers.json,
 * each entry quoted from that language's own reference file. Pure and
 * browser-safe.
 */

import type { Cefr } from "./curriculum.ts";
import { foldDiacritics } from "./language.ts";

export type FillerJob = "time" | "rephrase" | "agree" | "react";

export const FILLER_JOBS: ReadonlyArray<{ id: FillerJob; label: string; line: string }> = [
	{ id: "time", label: "Buying time", line: "Hold the floor while you find the next word." },
	{ id: "rephrase", label: "Rephrasing", line: "Start again or sum up when a sentence goes wrong." },
	{ id: "agree", label: "Agreeing", line: "Answer without a full sentence." },
	{ id: "react", label: "Reacting while listening", line: "Show you are following while the other person talks." },
];

export interface FillerEntry {
	sk: string;
	en: string;
	job: FillerJob;
	/** The earliest level the app teaches it at. */
	level: Cefr;
	register: "neutral" | "colloquial" | "casual";
}

export interface FillerKit {
	language: string;
	source: string;
	entries: FillerEntry[];
}

const LEVEL_RANK: Record<Cefr, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4 };

export interface FillerFinding {
	/** The filler the learner used, and how often. */
	used: Array<{ sk: string; count: number }>;
	/** English fillers said instead, folded. */
	english: Array<{ word: string; count: number }>;
	/** Distinct target-language fillers used. */
	variety: number;
	/** One filler in more than a third of the learner's turns. */
	overused: string[];
	/** A casual filler in a formal scene. */
	register: Array<{ sk: string; reason: string }>;
}

const ENGLISH_FILLERS = ["um", "uh", "er", "erm", "like", "you know", "so", "well", "anyway", "basically"];

export function findFillers(
	learnerTurns: readonly string[],
	kit: FillerKit,
	opts: { formal?: boolean } = {},
): FillerFinding {
	const fold = (text: string) => ` ${foldDiacritics(text.toLocaleLowerCase()).replace(/[^\p{L}\p{N}\s]/gu, " ")} `;
	const turns = learnerTurns.map(fold);
	const used: Array<{ sk: string; count: number }> = [];
	for (const entry of kit.entries) {
		const key = fold(entry.sk).trim();
		const count = turns.reduce((n, text) => n + (text.includes(` ${key} `) ? 1 : 0), 0);
		if (count > 0) used.push({ sk: entry.sk, count });
	}
	const english: Array<{ word: string; count: number }> = [];
	for (const word of ENGLISH_FILLERS) {
		const key = foldDiacritics(word);
		const count = turns.reduce((n, text) => n + (text.includes(` ${key} `) ? 1 : 0), 0);
		if (count > 0) english.push({ word, count });
	}
	const overused = turns.length ? used.filter((u) => u.count > turns.length / 3).map((u) => u.sk) : [];
	const register = opts.formal
		? kit.entries
				.filter((e) => e.register === "casual" && used.some((u) => u.sk === e.sk))
				.map((e) => ({ sk: e.sk, reason: `"${e.sk}" is casual; a formal scene wants a neutral one.` }))
		: [];
	return {
		used: used.sort((a, b) => b.count - a.count),
		english,
		variety: used.length,
		overused,
		register,
	};
}

export interface FillerPick {
	sk: string;
	en: string;
	job: FillerJob;
	why: string;
}

/** Two or three fillers for the jobs the talk was missing, at the learner's level and register. */
export function pickFillers(
	kit: FillerKit,
	finding: FillerFinding,
	level: Cefr,
	opts: { formal?: boolean; limit?: number } = {},
): FillerPick[] {
	const limit = opts.limit ?? 3;
	const jobOf = (sk: string) => kit.entries.find((e) => e.sk === sk)?.job;
	const missing: FillerJob[] = [];
	if (finding.english.length > 0 || !finding.used.some((u) => jobOf(u.sk) === "time")) missing.push("time");
	if (finding.variety < 2) missing.push("rephrase");
	if (!finding.used.some((u) => jobOf(u.sk) === "react")) missing.push("react");
	const jobs = missing.length ? missing : ["time", "rephrase", "react"];
	const allowed = (e: FillerEntry) =>
		LEVEL_RANK[e.level] <= LEVEL_RANK[level] &&
		(!opts.formal || e.register !== "casual") &&
		!finding.used.some((u) => u.sk === e.sk) &&
		!finding.overused.includes(e.sk);
	const picked: FillerPick[] = [];
	const why: Record<FillerJob, string> = {
		time: "for the moment you go quiet mid-sentence",
		rephrase: "when a sentence starts wrong and you need to begin again",
		agree: "to answer without building a sentence",
		react: "while the tutor is talking, so you sound like a listener",
	};
	for (const job of [...jobs, "agree"] as FillerJob[]) {
		if (picked.length >= limit) break;
		const entry = kit.entries.find((e) => e.job === job && allowed(e));
		if (!entry) continue;
		if (picked.some((p) => p.sk === entry.sk)) continue;
		picked.push({ sk: entry.sk, en: entry.en, job, why: why[job] });
	}
	return picked;
}
