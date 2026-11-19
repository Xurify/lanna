"use client";

/**
 * The rail (Quiet tool): the score and the day's plan as a checklist, beside
 * Today and beside the practice screens. Types and small helpers that both
 * Today and the rail read live here too.
 */

import { useEffect, useState } from "react";
import { QIcon, QPie } from "@/components/quiet/icon";
import { ProgressPanel } from "@/components/quiet/charts";
import { chartData } from "@/components/quiet/chart-data";
import { useSettingsDialog } from "@/components/settings/settings-context";
import type { Goal } from "@/components/daily-plan";
import type {
	AfterPlan,
	CurriculumState,
	DailyPlan as Plan,
	ExamSummary,
	MixupSummary,
	PlanTask,
	Projection,
	StampState,
	StrandBalance,
	TrailLog,
	TrajectoryInput,
	UnitId,
	UnitKind,
	WeakSpotSummary,
} from "@/src/core";
import { useActiveLanguage } from "@/components/speech";

export interface UnitSummary {
	id: UnitId;
	title: string;
	tagline: string;
	glyph: string;
	kind?: UnitKind;
	slovakTerm?: string;
	lessons: number;
	reps: number;
	level: number;
	/** 0..1 toward completion. */
	progress: number;
	done: boolean;
	accuracy: number | null;
}

export interface Summary {
	xp: number;
	level: { level: number; into: number; span: number };
	todayXp: number;
	dailyGoal: number;
	streak: { days: number; restUsed: boolean; activeToday: boolean };
	week: Array<{ day: string; xp: number }>;
	units: UnitSummary[];
	next: UnitId;
	bestBlitz: number;
	review: { due: number; newLeft: number; total: number; available: boolean };
	curriculum: CurriculumState;
	plan: Plan;
	afterPlan?: AfterPlan;
	goal: Goal;
	projection: Projection;
	balance?: StrandBalance;
	trajectory?: TrajectoryInput;
	weakSpots?: WeakSpotSummary[];
	mixups?: MixupSummary[];
	exams?: Record<string, ExamSummary>;
	pace?: { goalMinutes: number; plannedMinutes: number; logged: number; windowDays: number; dailyAverage: number };
	backlog?: number;
	todayMinutes?: number;
	wordsKnown?: number;
	stamps?: { all: StampState[]; earned: number; total: number; recent: StampState[]; next: StampState[] };
	log?: TrailLog;
}

export function greeting(now = new Date()): string {
	const h = now.getHours();
	if (h < 10) return "Good morning";
	if (h < 18) return "Good afternoon";
	return "Good evening";
}

const TASK_LABEL: Record<PlanTask["id"], string> = {
	review: "Review",
	listen: "Listen",
	lesson: "Lesson",
	strengthen: "Weak spot",
	blitz: "Blitz",
	words: "Words",
	read: "Read",
	watch: "Media",
	speak: "Speak",
	fluency: "Speed",
};

export function taskLabel(t: PlanTask): string {
	return t.via === "tutor" ? "Tutor" : TASK_LABEL[t.id];
}

/** How a task reads in the plan: the thing to do first, its kind and unit under it. The plan's
 *  titles come two ways: "Grammar: I, you, we · Prítomný čas" (kind, name, Slovak term) or a bare
 *  kind ("Review") whose line says what it is. */
export function words(t: PlanTask): { primary: string; kind: string; rest?: string } {
	const m = t.title.match(/^(Grammar|Words|With the tutor|Tutor|Goal|Lesson):\s*(.*?)(?:\s·\s(.+))?$/);
	if (m) return { primary: m[2]!, kind: `${taskLabel(t)}${m[3] ? ` · ${m[3]}` : ""}`, rest: t.line };
	if (t.title === TASK_LABEL[t.id] || t.title === taskLabel(t)) {
		const [first, ...more] = t.line.split(" — ");
		return { primary: first!, kind: taskLabel(t), rest: more.join(" — ") || undefined };
	}
	return { primary: t.title, kind: taskLabel(t), rest: t.line };
}

/** Where each strand grows, for the week's one suggestion. */

/** The progress summary every Today-family screen reads. */
export function useDaySummary(initial: Summary | null = null) {
	const [s, setS] = useState<Summary | null>(initial);
	const [failed, setFailed] = useState(false);
	const load = () => {
		void fetch(`/api/progress?tz=${new Date().getTimezoneOffset()}`)
			.then((r) => {
				if (!r.ok) throw new Error(String(r.status));
				return r.json() as Promise<Summary>;
			})
			.then((x) => {
				setS(x);
				setFailed(false);
			})
			.catch(() => setFailed(true));
	};
	useEffect(load, []);
	return { s, failed, load };
}
/** The date the screens show: "Monday, November 2". */
export function todayDate(): string {
	return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** The rail beside Today and Review: the brand, the day's date, the charts and the goal. */
export function DayRail({ s }: { s: Summary | null }) {
	const settings = useSettingsDialog();
	const lang = useActiveLanguage();
	const date = todayDate();
	return (
		<div className="hidden min-h-0 @6xl:block">
			<aside className="q-rail h-full" aria-label="Your progress">
				<div className="q-rail-in overflow-y-auto">
					<div className="q-brand">
						<span className="q-mark">
							<QPie frac={0.7} size={14} className="mk" />
						</span>
						<b>Lanna</b>
						<small>{lang?.english}</small>
						<button type="button" className="gear" aria-label="Settings" onClick={() => settings.open()}>
							<QIcon name="gear" className="size-4" />
						</button>
					</div>

					<div className="q-r-today">
						<h2>Progress</h2>
						<p className="first-letter:uppercase" lang={lang?.code}>
							{date}
						</p>
					</div>

					<div className="mt-3">
						{s ? (
							<ProgressPanel data={chartData(s)} />
						) : (
							<div className="q-well h-64 animate-pulse" aria-hidden="true" />
						)}
					</div>

					{s?.projection && (
						<div className="q-goal mt-4" data-testid="goal-line">
							<QIcon name="flag" />
							<p data-testid="goal-plan">{goalLine(s)}</p>
						</div>
					)}
				</div>
			</aside>
		</div>
	);
}

/** "B2 by about March 2040 at this pace. You average 16 of 30 min a day this week." */
function goalLine(s: Summary): React.ReactNode {
	const level = s.goal.level;
	const iso = s.projection.etaPace ?? s.projection.etaPlanned;
	const when = iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : null;
	const avg = s.pace?.dailyAverage;
	return (
		<>
			<b>{level}</b>
			{when ? (
				<>
					{" "}
					by about <b>{when}</b> at {s.projection.etaPace ? "this" : "the planned"} pace.
				</>
			) : (
				" is your goal."
			)}
			{avg !== undefined && s.pace && (
				<>
					{" "}
					You average {avg} of {s.pace.goalMinutes} min a day over the last {s.pace.windowDays} days.
				</>
			)}
		</>
	);
}
