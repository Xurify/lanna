"use client";

/**
 * The rail (Quiet tool): the score and the day's plan as a checklist, beside
 * Today and beside the practice screens. Types and small helpers that both
 * Today and the rail read live here too.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { QCheck, QIcon, QPie } from "@/components/quiet/icon";
import type { QIconName } from "@/components/quiet/icon-paths";
import { SettingsLink } from "@/components/settings/settings-link";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import type { Goal } from "@/components/daily-plan";
import type { CurriculumState, DailyPlan as Plan, ExamSummary, MixupSummary, PlanTask, Projection, StampState, StrandBalance, TrailLog, TrajectoryInput, UnitId, UnitKind, WeakSpotSummary } from "@/src/core";

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
	if (h < 10) return "Dobré ráno";
	if (h < 18) return "Dobrý deň";
	return "Dobrý večer";
}

export const TASK_LABEL: Record<PlanTask["id"], string> = {
	review: "Review",
	listen: "Listen",
	lesson: "Lesson",
	strengthen: "Weak spot",
	blitz: "Blitz",
	words: "Words",
	read: "Read",
	watch: "Watch",
	speak: "Speak",
	fluency: "Say it faster",
};

export const TASK_ICON: Record<PlanTask["id"], QIconName> = {
	review: "review",
	listen: "listen",
	lesson: "grammar",
	strengthen: "letter",
	blitz: "fast",
	words: "words",
	read: "read",
	watch: "play",
	speak: "speak",
	fluency: "fast",
};

export function taskLabel(t: PlanTask): string {
	return t.via === "tutor" ? "Tutor" : TASK_LABEL[t.id];
}

export function taskIcon(t: PlanTask): QIconName {
	return t.via === "tutor" ? "tutor" : TASK_ICON[t.id];
}

/** How a task reads in the plan: the thing to do first, its kind and unit under it. The plan's
 *  titles come two ways: "Grammar: I, you, we · Prítomný čas" (kind, name, Slovak term) or a bare
 *  kind ("Review") whose line says what it is. */
export function words(t: PlanTask): { primary: string; kind: string; rest?: string } {
	const m = t.title.match(/^(Grammar|Words|With the tutor|Tutor|Goal|Lesson):s*(.*?)(?:s·s(.+))?$/);
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
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(load, []);
	return { s, failed, load };
}

/** A task in the plan that needs a model, when none is set up. */
export function taskLocked(t: PlanTask, keyless: boolean): boolean {
	return !t.done && t.via === "tutor" && keyless;
}

/** The date the screens show, in Slovak: "Pondelok 2. novembra". */
export function skDate(): string {
	return new Date().toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long" });
}

/** A task that is under way, shown in the rail's plan instead of its first line. */
export interface InProgress {
	id: PlanTask["id"];
	title: string;
	done: number;
	total: number;
}

export function DayRail({ s, keyless, busy = false, onOpen, inProgress }: { s: Summary | null; keyless: boolean; busy?: boolean; onOpen: (t: PlanTask) => void; inProgress?: InProgress }) {
	const settings = useSettingsDialog();
	const tasks = s?.plan.tasks ?? [];
	const done = s?.plan.done ?? 0;
	const total = s?.plan.total ?? 0;
	const left = tasks.filter((t) => !t.done).reduce((n, t) => n + t.minutes, 0);
	const up = tasks.find((t) => !t.done) ?? null;
	const date = skDate();
	const toGoal = s ? Math.max(0, s.dailyGoal - s.todayXp) : 0;
	const streak = s?.streak.days ?? 0;
	const open = onOpen;
	const locked = (t: PlanTask) => taskLocked(t, keyless);
	return (
		<div className="hidden min-h-0 @6xl:block">
			<aside className="q-rail h-full" aria-label="Your day">
				<div className="q-rail-in overflow-y-auto">
					<div className="q-brand">
						<span className="q-mark">
							<QPie frac={0.7} size={14} className="mk" />
						</span>
						<b>LangHarness</b>
						<small>Slovenčina</small>
						<button type="button" className="gear" aria-label="Settings" onClick={() => settings.open()}>
							<QIcon name="gear" className="size-4" />
						</button>
					</div>

					<div className="q-r-today">
						<h2>Today</h2>
						<p className="first-letter:uppercase" lang="sk">
							{date}
						</p>
					</div>

					<div className="q-score">
						<div className="q-xp" data-testid="xp-pill">
							<QPie frac={s && s.dailyGoal > 0 ? s.todayXp / s.dailyGoal : 0} size={36} />
							<div className="v">
								<b className="q-num">
									{s?.todayXp ?? 0} <span>/ {s?.dailyGoal ?? 50} XP</span>
								</b>
								<small>{s ? (toGoal > 0 ? `${toGoal} to today's goal` : "Today's goal is met") : " "}</small>
							</div>
						</div>
						<div className="q-two">
							<div data-testid="streak-pill">
								<span className="q-week" aria-hidden="true">
									{(s?.week.length ? s.week : Array.from({ length: 7 }, () => ({ day: "", xp: 0 }))).map((d, i) => (
										<i key={i} className={cn(d.xp <= 0 && "off")} />
									))}
								</span>
								<span className="q-num"><b>{streak} {streak === 1 ? "day" : "days"}</b> <small>in a row</small></span>
							</div>
							<div>
								<b>Level {s?.level.level ?? 1}</b>
								<small>{s ? `${s.level.span - s.level.into} XP to level ${s.level.level + 1}` : " "}</small>
							</div>
						</div>
					</div>

					<div className="q-tl-head">
						The plan
						<span className="q-num">{s ? (inProgress ? `${done} of ${total} done · in ${TASK_LABEL[inProgress.id]}` : done >= total && total > 0 ? `All ${total} done` : `${done} of ${total} done · about ${left} min left`) : " "}</span>
					</div>
					<ol className="q-tl" data-testid="plan-tasks">
						{tasks.map((t) => {
							const lk = locked(t);
							const mine = inProgress?.id === t.id;
							const state = t.done ? "done" : lk ? "locked" : t === up || mine ? "next" : "";
							return (
								<li key={t.id} className={state} data-testid={`plan-${t.id}`} {...(t === up || mine ? { "data-next": "true" } : {})}>
									<span className="q-cb">{t.done && <QCheck />}</span>
									<div className="min-w-0">
										<button type="button" className="k1 block w-full text-left" onClick={() => open(t)} disabled={busy || lk}>
											{mine ? inProgress.title : words(t).primary}
										</button>
										<div className="k2">
											<QIcon name={taskIcon(t)} />
											{words(t).kind}
											{(t === up || mine) && <span className="now">· {mine ? "In progress" : "Up next"}</span>}
											{t.from && <span>· Left from {new Date(`${t.from}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}</span>}
										</div>
										{mine && (
											<div className="q-mini" aria-hidden="true">
												{Array.from({ length: Math.min(9, inProgress.total) }, (_, j) => (
													<i key={j} className={j < inProgress.done ? "d" : j === inProgress.done ? "c" : undefined} />
												))}
											</div>
										)}
										{lk && (
											<div className="lockline">
												<QIcon name="key" />
												Needs an AI key ·{" "}
												<SettingsLink keys className="text-ink-2 underline decoration-line-2 underline-offset-[3px]">
													Settings → API keys
												</SettingsLink>
											</div>
										)}
									</div>
									<span className="m q-num">{t.minutes} min</span>
								</li>
							);
						})}
					</ol>

					{s?.projection && (
						<div className="q-goal" data-testid="goal-line">
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
					You average {avg} of {s.pace.goalMinutes} min a day this week.
				</>
			)}
		</>
	);
}

