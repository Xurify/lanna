"use client";

/**
 * This week (LangHarness, 2026-10-29) — the right-hand card on Today: the
 * days practiced, the week's balance by strand, and the goal those days
 * add up to, with the door to the Plan page where the pace is set.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, TargetIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HoursSheet } from "@/components/hours-sheet";
import { StrandBalance } from "@/components/strand-balance";
import { monthAt, TrajectoryChart, trajectoryHeadline } from "@/components/trajectory-chart";
import { DEFAULT_DAYS_PER_WEEK, knownLanguages, LEVEL_CAN_DO, measuredPace, trajectory as projectTrajectory, type LearnerGoal, type Projection, type StrandBalance as Balance, type TrajectoryInput } from "@/src/core";

const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function monthOf(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function WeekCard({
	week,
	balance,
	goal,
	projection,
	trajectory,
}: {
	week: Array<{ day: string; xp: number }>;
	balance: Balance | null;
	goal: LearnerGoal | null;
	projection: Projection | null;
	trajectory?: TrajectoryInput | null;
}) {
	const days = week.length ? week : Array.from({ length: 7 }, (_, i) => ({ day: String(i), xp: 0 }));
	const level = goal?.level ?? "B2";
	const [open, setOpen] = useState(false);
	const pathState = useMemo(() => {
		if (!trajectory) return null;
		const now = new Date();
		const pace = measuredPace(trajectory.days, trajectory.goalMinutes, trajectory.goalDays);
		return { now, measured: pace.measured, t: projectTrajectory(trajectory, "hours", pace) };
	}, [trajectory]);
	// The date follows the recent pace once a week of study is on record, the plan until then.
	const eta = pathState ? (pathState.t.daysToTarget === null ? null : monthAt(pathState.now, pathState.t.daysToTarget)) : monthOf(projection?.etaPlanned ?? null);
	const paceWord = pathState?.measured ? "recent" : "planned";
	const activeCount = days.filter((d) => d.xp > 0).length;
	const targetDays = goal?.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK;
	return (
		<section className="rounded-3xl border bg-card p-5" data-testid="week-card" aria-labelledby="week-title">
			<h2 id="week-title" className="text-lg font-extrabold text-foreground">
				This week
			</h2>

			<ol className="mt-3 grid grid-cols-7 gap-1" aria-label="Days practiced">
				{days.map((d, i) => {
					const isToday = i === days.length - 1;
					const date = /\d{4}-\d{2}-\d{2}/.test(d.day) ? new Date(`${d.day}T12:00:00`) : null;
					const active = d.xp > 0;
					return (
						<li key={d.day} className="flex justify-center" title={date ? `${WEEKDAY_EN[date.getDay()]}: ${d.xp} XP` : undefined}>
							<span
								className={cn(
									"flex size-9 items-center justify-center rounded-full border-2 text-xs font-bold",
									active ? "border-sun bg-sun text-sun-ink" : "border-border text-muted-foreground",
									isToday && !active && "border-dashed border-foreground/50 text-foreground",
									isToday && "ring-2 ring-sun/40 ring-offset-2 ring-offset-card",
								)}
							>
								<span aria-hidden="true">{date ? WEEKDAY[date.getDay()] : ""}</span>
								<span className="sr-only">
									{date ? `${WEEKDAY_EN[date.getDay()]}, ` : ""}
									{active ? `practiced, ${d.xp} XP` : "not practiced"}
								</span>
							</span>
						</li>
					);
				})}
			</ol>
			<p className="mt-3 text-center font-ui text-xs font-semibold text-muted-foreground" data-testid="week-target">
				{activeCount >= targetDays ? (
					<span className="text-sun">Target met · {activeCount} of the last seven days</span>
				) : (
					<>
						{activeCount} of {targetDays} planned days in the last seven
					</>
				)}
			</p>

			<div className="mt-5 border-t pt-4">
				<StrandBalance balance={balance} />
			</div>

			{pathState && (
				<>
					<button type="button" onClick={() => setOpen(true)} className="mt-4 block w-full rounded-2xl border p-3 text-left transition-colors hover:border-foreground/40" data-testid="trajectory-card" aria-label="Where you're heading: open the projection">
						<span className="block text-xs font-bold tracking-wide text-muted-foreground">Where you&apos;re heading</span>
						<span className="mt-0.5 block text-sm font-bold text-foreground" data-testid="trajectory-card-headline">
							{trajectoryHeadline(pathState.t, pathState.now, level)}
						</span>
						<span className="mt-1 block">
							<TrajectoryChart t={pathState.t} now={pathState.now} variant="compact" targetLevel={level} />
						</span>
					</button>
					<HoursSheet open={open} onClose={() => setOpen(false)} minutesPerDay={goal?.minutesPerDay ?? 20} daysPerWeek={goal?.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK} target={level} hoursDone={projection?.hoursDone ?? 0} languages={knownLanguages(goal)} trajectory={trajectory ?? undefined} />
				</>
			)}

			<Link
				href="/progress"
				className="group mt-4 flex items-center gap-3 rounded-2xl border border-sun/30 bg-sun/10 p-3 transition-colors hover:border-sun/50 hover:bg-sun/15"
				data-testid="goal-line"
			>
				<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sun/20">
					<TargetIcon className="size-5 text-sun" aria-hidden="true" />
				</span>
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-bold text-foreground" title={LEVEL_CAN_DO[level]}>
						Goal: {level}
						{eta && <span className="font-semibold text-muted-foreground"> · about {eta}</span>}
					</span>
					<span className="block text-xs text-muted-foreground group-hover:text-foreground" data-testid="goal-plan">
						At your {paceWord} pace · hours, milestones, level check
					</span>
				</span>
				<ChevronRightIcon className="size-4 shrink-0 text-sun transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
			</Link>
		</section>
	);
}
