"use client";

/**
 * This week (LangHarness, 2026-10-29) — the right-hand card on Today: the
 * days practised, the week's balance by strand, and the goal those days
 * add up to, with the door to the Plan page where the pace is set.
 */

import Link from "next/link";
import { ChevronRightIcon, FlameIcon, TargetIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StrandBalance } from "@/components/strand-balance";
import { LEVEL_CAN_DO, type LearnerGoal, type Projection, type StrandBalance as Balance } from "@/src/core";

const WEEKDAY = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
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
}: {
	week: Array<{ day: string; xp: number }>;
	balance: Balance | null;
	goal: LearnerGoal | null;
	projection: Projection | null;
}) {
	const days = week.length ? week : Array.from({ length: 7 }, (_, i) => ({ day: String(i), xp: 0 }));
	const level = goal?.level ?? "B2";
	const eta = monthOf(projection?.etaPlanned ?? null);
	return (
		<section className="rounded-3xl border bg-card p-5" data-testid="week-card" aria-labelledby="week-title">
			<h2 id="week-title" className="text-lg font-black text-foreground">
				This week
			</h2>

			<ol className="mt-3 grid grid-cols-7 gap-1" aria-label="Days practised">
				{days.map((d, i) => {
					const isToday = i === days.length - 1;
					const date = /\d{4}-\d{2}-\d{2}/.test(d.day) ? new Date(`${d.day}T12:00:00`) : null;
					const active = d.xp > 0;
					return (
						<li key={d.day} className="flex flex-col items-center gap-1" title={date ? `${WEEKDAY_EN[date.getDay()]}: ${d.xp} XP` : undefined}>
							<span
								className={cn(
									"flex size-8 items-center justify-center rounded-full border-2",
									active ? "border-flame bg-flame/15 text-flame" : "border-border text-muted-foreground/60",
									isToday && !active && "border-dashed border-foreground/40",
								)}
							>
								<FlameIcon className="size-4" aria-hidden="true" />
								<span className="sr-only">{active ? `practised, ${d.xp} XP` : "not practised"}</span>
							</span>
							<span className={cn("text-xs", isToday ? "font-bold text-foreground" : "text-muted-foreground")}>{date ? WEEKDAY[date.getDay()] : ""}</span>
						</li>
					);
				})}
			</ol>

			<div className="mt-5 border-t pt-4">
				<StrandBalance balance={balance} />
			</div>

			<Link href="/plan" className="group -mx-2 mt-4 flex items-center gap-3 rounded-xl border-t px-2 pt-4 pb-1 hover:text-foreground" data-testid="goal-line">
				<TargetIcon className="size-5 shrink-0 text-flame" aria-hidden="true" />
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-bold text-foreground" title={LEVEL_CAN_DO[level]}>
						Goal: {level}
						{eta && <span className="font-semibold text-muted-foreground"> · about {eta}</span>}
					</span>
					<span className="block text-xs text-muted-foreground group-hover:text-foreground" data-testid="goal-plan">
						Your pace, hours and level check
					</span>
				</span>
				<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
			</Link>
		</section>
	);
}
