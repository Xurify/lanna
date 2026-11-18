/**
 * Speaking reports and their trends: every talking session keeps a report,
 * and each measure is carried across sessions the way unit accuracy is
 * (trendOf from mistakes.ts) so "better" means the change is bigger than
 * chance. A cell that slips in three or more sessions is flagged; a cell
 * that used to slip and has been clean lately is shown as a strength. Pure
 * and browser-safe.
 */

import type { Cefr } from "./curriculum.ts";
import type { FillerFinding, FillerPick } from "./fillers.ts";
import type { FirstTryCell } from "./first-try.ts";
import { ATLAS_CASES, ATLAS_GENDERS, type AtlasCase, type AtlasGender } from "./grammar.ts";
import type { SlipKind } from "./speak.ts";
import type { SpeechMetrics } from "./speech-metrics.ts";
import { REPLY_BAR_MS, SPEECH_RATE_BAR } from "./speech-metrics.ts";
import { TREND_DAYS, trendOf, type Trend } from "./mistakes.ts";

const DAY_MS = 86_400_000;

export interface SpeakingSlip {
	/** Index of the learner turn the slip is in. */
	turn: number;
	yours: string;
	right: string;
	kind: SlipKind;
	rule?: string;
	/** The grammar atlas cell, when the slip is on a case form. */
	cell?: FirstTryCell;
	/** The case drill it was counted on. */
	drill?: string;
	gender?: string;
}

export interface SpeakingImprovement {
	turn: number;
	yours: string;
	right: string;
	why: string;
}

export interface SpeakingComplexity {
	past: boolean;
	future: boolean;
	clauses: string[];
	aspectPairs: number;
	note: string;
}

export interface SpeakingChunk {
	sk: string;
	en: string;
	slug?: string;
}

export interface SpeakingReport {
	id: string;
	kind: "scene" | "island";
	/** The scene id or the island id. */
	ref: string;
	title: string;
	lang: string;
	level: Cefr;
	at: string;
	startedAt: string;
	endedAt: string;
	metrics: SpeechMetrics;
	/** The learner's words came from Phonic only, so accuracy is approximate. */
	approximate: boolean;
	/** The model read the talk; without one only the counts are known. */
	judged: boolean;
	slips: SpeakingSlip[];
	strengths: string[];
	improve: SpeakingImprovement[];
	complexity?: SpeakingComplexity;
	newChunks: SpeakingChunk[];
	fillers: FillerFinding;
	recommended: FillerPick[];
	xp: number;
	model?: string;
}

export interface SpeakingIndexEntry {
	id: string;
	kind: "scene" | "island";
	ref: string;
	title: string;
	at: string;
	sec: number;
	learnerShare: number;
	medianReplyMs: number | null;
	englishShare: number;
	slips: number;
	xp: number;
	approximate: boolean;
}

export function speakingIndexEntry(report: SpeakingReport): SpeakingIndexEntry {
	return {
		id: report.id,
		kind: report.kind,
		ref: report.ref,
		title: report.title,
		at: report.at,
		sec: report.metrics.talkSec,
		learnerShare: report.metrics.learnerShare,
		medianReplyMs: report.metrics.medianReplyMs,
		englishShare: report.metrics.englishShare,
		slips: report.slips.length,
		xp: report.xp,
		approximate: report.approximate,
	};
}

export function cellKey(cell: FirstTryCell | undefined): string {
	return cell ? `${cell.row}:${cell.col}` : "";
}

export function cellLabel(key: string): string {
	const [row, col] = key.split(":") as [AtlasCase, AtlasGender];
	const info = ATLAS_CASES.find((c) => c.case === row);
	const gender = ATLAS_GENDERS.find((g) => g.id === col);
	return `${info?.english ?? row} ${gender?.english ?? col}`.replace(/^./, (c) => c.toUpperCase());
}

export interface SpeakingMetricTrend {
	id: "english" | "share" | "reply" | "rate";
	label: string;
	line: string;
	recent: number | null;
	earlier: number | null;
	trend: Trend;
	/** The latest session's number, in words. */
	now: string;
}

export interface SpeakingTrends {
	sessions: number;
	metrics: SpeakingMetricTrend[];
	weakCells: Array<{ cell: string; label: string; sessions: number; last: string }>;
	fixedCells: Array<{ cell: string; label: string; lastSlip: string }>;
	fillers: { english: number; target: number; trend: Trend };
}

interface WindowCount {
	reps: number;
	right: number;
}

function add(window: WindowCount, reps: number, right: number): void {
	window.reps += Math.max(0, reps);
	window.right += Math.max(0, Math.min(reps, right));
}

type MeasureId = SpeakingMetricTrend["id"];

export function speakingTrends(reports: readonly SpeakingReport[], now = new Date()): SpeakingTrends {
	const sorted = [...reports].sort((a, b) => a.at.localeCompare(b.at));
	const cut = now.getTime() - TREND_DAYS * DAY_MS;
	const windows: Record<MeasureId, { recent: WindowCount; earlier: WindowCount }> = {
		english: { recent: { reps: 0, right: 0 }, earlier: { reps: 0, right: 0 } },
		share: { recent: { reps: 0, right: 0 }, earlier: { reps: 0, right: 0 } },
		reply: { recent: { reps: 0, right: 0 }, earlier: { reps: 0, right: 0 } },
		rate: { recent: { reps: 0, right: 0 }, earlier: { reps: 0, right: 0 } },
	};
	const fillers = { recent: { reps: 0, right: 0 }, earlier: { reps: 0, right: 0 } };
	for (const report of sorted) {
		const side = Date.parse(report.at) >= cut ? "recent" : "earlier";
		const m = report.metrics;
		add(windows.english[side], m.words, m.targetWords);
		add(windows.share[side], Math.round(m.talkSec * 10), Math.round(m.learnerShare * m.talkSec * 10));
		add(windows.reply[side], m.replyTurns, m.fastReplies);
		add(windows.rate[side], m.learnerTurns, m.syllablesPerMinute >= SPEECH_RATE_BAR ? m.learnerTurns : 0);
		const english = report.fillers.english.reduce((n, e) => n + e.count, 0);
		const target = report.fillers.used.reduce((n, e) => n + e.count, 0);
		add(fillers[side], english + target, target);
	}
	const latest = sorted.at(-1);
	const metric = (id: MeasureId, label: string, line: string, nowText: string): SpeakingMetricTrend => {
		const w = windows[id];
		const share = (c: WindowCount) => (c.reps > 0 ? c.right / c.reps : null);
		const trend = trendOf(w.recent, w.earlier);
		return {
			id,
			label,
			line,
			recent: share(w.recent),
			earlier: share(w.earlier),
			trend: id === "english" ? invert(trend) : trend,
			now: nowText,
		};
	};
	const slipsByCell = new Map<string, string[]>();
	for (const report of sorted)
		for (const slip of report.slips) {
			const key = cellKey(slip.cell);
			if (!key) continue;
			slipsByCell.set(key, [...(slipsByCell.get(key) ?? []), report.at]);
		}
	const weakCells = [...slipsByCell.entries()]
		.filter(([, at]) => at.length >= 3)
		.map(([cell, at]) => ({ cell, label: cellLabel(cell), sessions: at.length, last: at.at(-1)! }))
		.sort((a, b) => b.sessions - a.sessions);
	const fixedCells = [...slipsByCell.entries()]
		.filter(([cell]) => cell.length > 0)
		.map(([cell, at]) => {
			const lastSlip = at.at(-1)!;
			const cleanAfter = sorted.filter((r) => r.at > lastSlip).length;
			return { cell, label: cellLabel(cell), lastSlip, cleanAfter, slips: at.length };
		})
		.filter((c) => c.cleanAfter >= 3 && c.slips < 3)
		.map(({ cell, label, lastSlip }) => ({ cell, label, lastSlip }));
	return {
		sessions: sorted.length,
		metrics: [
			metric(
				"english",
				"English in the talk",
				"Share of your words that were English; lower is better.",
				latest ? `${Math.round(latest.metrics.englishShare * 100)}% in the last talk` : "No talk yet",
			),
			metric(
				"share",
				"Carrying the talk",
				"Share of the talk that was you speaking.",
				latest ? `${Math.round(latest.metrics.learnerShare * 100)}% in the last talk` : "No talk yet",
			),
			metric(
				"reply",
				"Quick replies",
				`Turns you started within ${REPLY_BAR_MS / 1000} seconds of the tutor finishing.`,
				latest?.metrics.medianReplyMs != null
					? `median ${(latest.metrics.medianReplyMs / 1000).toFixed(1)} s in the last talk`
					: "No timed turn yet",
			),
			metric(
				"rate",
				"Pace",
				`Turns at or above ${SPEECH_RATE_BAR} syllables a minute.`,
				latest ? `${latest.metrics.syllablesPerMinute}/min in the last talk` : "No talk yet",
			),
		],
		weakCells,
		fixedCells,
		fillers: {
			english: fillers.recent.reps - fillers.recent.right,
			target: fillers.recent.right,
			trend: trendOf(fillers.recent, fillers.earlier),
		},
	};
}

/** A lower English share is better, so the direction flips. */
function invert(trend: Trend): Trend {
	return trend === "better" ? "worse" : trend === "worse" ? "better" : trend;
}
