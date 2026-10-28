"use client";

/**
 * Today's plan (LangHarness, 2026-10-28) — the day's tasks on the road to
 * the target level, and the goal that road is measured against.
 *
 * The plan is computed on the server (src/core/curriculum.ts dailyPlan):
 * review what is due, ten sentences to listen to, one lesson of new
 * ground, strengthen the weakest unit, new words, an episode to read,
 * a scene to speak, and three minutes of speed on what is known, cut to
 * the planned minutes.
 * Each task is a link into the app; a task ticks itself off from the
 * progress ledger, so there is nothing to mark by hand.
 */

import { useState } from "react";
import Link from "next/link";
import { HoursSheet } from "@/components/hours-sheet";
import { AlertTriangleIcon, BookOpenIcon, BookOpenTextIcon, CheckIcon, DumbbellIcon, FlameIcon, GaugeIcon, GraduationCapIcon, HeadphonesIcon, MessagesSquareIcon, MicIcon, MonitorPlayIcon, PlayIcon, RepeatIcon, ScrollTextIcon, TargetIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StrandBalance } from "@/components/strand-balance";
import { DEFAULT_DAYS_PER_WEEK, knownLanguages, LEVEL_CAN_DO, purposePhrase, weakSpotGroups, type DailyPlan as Plan, type LearnerGoal, type PlanTask, type Projection, type StrandBalance as Balance, type WeakSpotSummary } from "@/src/core";

export type Goal = LearnerGoal;

const WEEKDAY = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];

function monthOf(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function DailyPlan({
	plan,
	goal,
	projection,
	balance = null,
	weak = [],
	week,
	busy = false,
	onSpeak,
}: {
	plan: Plan | null;
	goal: Goal | null;
	projection: Projection | null;
	/** This week by Nation's four strands (src/core/strands.ts). */
	balance?: Balance | null;
	/** Units on record as weak spots (src/core/weak-spots.ts). */
	weak?: WeakSpotSummary[];
	week: Array<{ day: string; xp: number }>;
	busy?: boolean;
	onSpeak: (task: PlanTask) => void;
}) {
	const [hoursOpen, setHoursOpen] = useState(false);
	const done = plan?.done ?? 0;
	const total = plan?.total ?? 0;
	const complete = total > 0 && done >= total;

	return (
		<section className="mt-5 rounded-3xl border bg-card px-6 py-5" data-testid="daily-plan" aria-label="Today's plan">
			<div className="flex flex-wrap items-center gap-5">
				<PlanRing done={done} total={total} />
				<div className="min-w-[15rem] flex-1">
					<p className="font-ui text-xs font-bold tracking-wide first-letter:uppercase text-muted-foreground">Today&apos;s plan</p>
					<p className="font-ui text-lg font-bold text-foreground">
						{plan ? (complete ? "All done for today. Pekne!" : `${done} of ${total} done · about ${plan.minutes} min`) : "Loading…"}
					</p>
				</div>
				<div className="flex flex-wrap gap-1.5 sm:gap-2" aria-label="This week">
					{(week.length ? week : Array.from({ length: 7 }, (_, i) => ({ day: String(i), xp: 0 }))).map((d, i, all) => {
						const isToday = i === all.length - 1;
						const wd = /\d{4}-\d{2}-\d{2}/.test(d.day) ? WEEKDAY[new Date(`${d.day}T12:00:00`).getDay()] : "";
						return (
							<div key={d.day} className="flex flex-col items-center gap-1">
								<span
									className={cn(
										"flex size-7 items-center justify-center rounded-full border-2",
										d.xp > 0 ? "border-flame bg-flame/15 text-flame" : "border-border text-muted-foreground/40",
										isToday && d.xp === 0 && "border-dashed border-foreground/40",
									)}
									title={`${d.day}: ${d.xp} XP`}
								>
									<FlameIcon className="size-3.5" />
								</span>
								<span className={cn("font-ui text-[10px] uppercase", isToday ? "text-foreground" : "text-muted-foreground")}>{wd}</span>
							</div>
						);
					})}
				</div>
			</div>

			<ol className="mt-4 flex flex-col gap-1" data-testid="plan-tasks">
				{(plan?.tasks ?? []).map((t) => (
					<li key={t.id}>
						<TaskRow task={t} busy={busy} onSpeak={onSpeak} />
					</li>
				))}
			</ol>

			{/* The week by strand: input, speaking, words & rules, speed, against
			    a quarter each (Nation's four strands). */}
			<StrandBalance balance={balance} />

			{/* Weak spots on record (src/core/weak-spots.ts): what the check, the
			    lessons or the deck flagged, until enough reps come back right. */}
			<WeakSpots weak={weak} />

			{/* The goal the plan serves, and what the map says about the road.
			    Changing it reopens setup (components/onboarding/start.tsx),
			    pre-filled, with a re-check of the level on its last screen. */}
			<div className="mt-4 border-t pt-4 font-ui text-xs text-muted-foreground" data-testid="goal-line">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span className="text-foreground">
						<TargetIcon className="mr-1.5 inline size-3.5 align-[-2px] text-flame" />
						<span className="whitespace-nowrap" title={LEVEL_CAN_DO[goal?.level ?? "B2"]}>
							Goal: <b>{goal?.level ?? "B2"}</b> at <b>{goal?.minutesPerDay ?? 30} min</b> a day
						</span>
						{goal?.purposes && goal.purposes.length > 0 && (
							<span className="text-muted-foreground" title={goal.purposeNote}>
								{" "}· for {goal.purposes.map((p) => (p === "other" && goal.purposeNote ? (goal.purposeNote.length > 48 ? `${goal.purposeNote.slice(0, 45).trimEnd()}…` : goal.purposeNote) : purposePhrase(p))).join(", ")}
							</span>
						)}
					</span>
					{projection && (
						<span>
							· {projection.hoursDone} of ~{projection.hoursTarget} guided hours
							{projection.etaPlanned && ` · at that pace about ${monthOf(projection.etaPlanned)}`}
							{projection.etaPace && projection.paceMinutes > 0 && ` · at your real pace (${projection.paceMinutes} min/day) ${monthOf(projection.etaPace)}`}
						</span>
					)}
					<Link href="/start?edit=1" className="underline hover:text-foreground" data-testid="goal-change">
						Change
					</Link>
					<Link href="/start?edit=1" className="underline hover:text-foreground" data-testid="goal-recheck">
						Re-check my level
					</Link>
					<button type="button" onClick={() => setHoursOpen(true)} className="underline hover:text-foreground" data-testid="goal-hours">
						How long does it take?
					</button>
					<Link href="/milestones" className="underline hover:text-foreground" data-testid="goal-milestones">
						When can I…?
					</Link>
				</div>
			</div>
			<HoursSheet open={hoursOpen} onClose={() => setHoursOpen(false)} minutesPerDay={goal?.minutesPerDay ?? 30} daysPerWeek={goal?.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK} target={goal?.level ?? "B2"} hoursDone={projection?.hoursDone ?? 0} languages={knownLanguages(goal)} />
		</section>
	);
}

const TASK_ICON: Record<PlanTask["id"], { icon: React.ReactNode; ink: string }> = {
	review: { icon: <RepeatIcon className="size-5" />, ink: "text-sky bg-sky/15" },
	listen: { icon: <HeadphonesIcon className="size-5" />, ink: "text-sky bg-sky/15" },
	lesson: { icon: <PlayIcon className="size-5 fill-current" />, ink: "text-go bg-go/15" },
	strengthen: { icon: <DumbbellIcon className="size-5" />, ink: "text-gold bg-gold/15" },
	blitz: { icon: <ZapIcon className="size-5" />, ink: "text-gold bg-gold/15" },
	words: { icon: <BookOpenTextIcon className="size-5" />, ink: "text-flame bg-flame/15" },
	read: { icon: <BookOpenIcon className="size-5" />, ink: "text-xp bg-xp/15" },
	watch: { icon: <MonitorPlayIcon className="size-5" />, ink: "text-go bg-go/15" },
	speak: { icon: <MicIcon className="size-5" />, ink: "text-xp bg-xp/15" },
	fluency: { icon: <GaugeIcon className="size-5" />, ink: "text-gold bg-gold/15" },
};

function TaskRow({ task, busy, onSpeak }: { task: PlanTask; busy: boolean; onSpeak: (task: PlanTask) => void }) {
	const { icon, ink } = TASK_ICON[task.id];
	const body = (
		<>
			<span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", task.done ? "bg-accent text-muted-foreground" : ink)}>
				{task.done ? <CheckIcon className="size-5" strokeWidth={3} /> : task.via === "story" ? <ScrollTextIcon className="size-5" /> : task.via === "tutor" ? <GraduationCapIcon className="size-5" /> : task.via === "talk" ? <MessagesSquareIcon className="size-5" /> : icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className={cn("block font-ui text-base font-bold", task.done ? "text-muted-foreground line-through decoration-2" : "text-foreground")}>{task.title}</span>
				<span className="block truncate font-prose text-sm text-muted-foreground">{task.line}</span>
			</span>
			<span className="shrink-0 font-ui text-xs font-bold tabular-nums text-muted-foreground">{task.done ? "done" : `${task.minutes} min`}</span>
		</>
	);
	const cls = "flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-accent disabled:opacity-60";
	return task.href ? (
		<Link href={task.href} className={cls} data-testid={`plan-${task.id}`}>
			{body}
		</Link>
	) : (
		<button type="button" onClick={() => onSpeak(task)} disabled={busy} className={cls} data-testid={`plan-${task.id}`}>
			{body}
		</button>
	);
}

function PlanRing({ done, total }: { done: number; total: number }) {
	const px = 64;
	const stroke = 7;
	const r = (px - stroke) / 2;
	const c = 2 * Math.PI * r;
	const pct = total > 0 ? done / total : 0;
	return (
		<span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: px, height: px }} aria-label={`${done} of ${total} tasks done`}>
			<svg width={px} height={px} className="absolute inset-0 -rotate-90" aria-hidden="true">
				<circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} />
				<circle
					cx={px / 2}
					cy={px / 2}
					r={r}
					fill="none"
					stroke={pct >= 1 ? "var(--lh-gold)" : "var(--lh-go)"}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={c}
					strokeDashoffset={c * (1 - pct)}
					className="transition-[stroke-dashoffset] duration-700"
				/>
			</svg>
			<span className="font-ui text-base font-black tabular-nums text-foreground">
				{done}
				<span className="text-xs text-muted-foreground">/{total}</span>
			</span>
		</span>
	);
}

/** The struggles on record, one line each: the unit (or the family two
 *  units share), where it was seen, and the tally since. Each opens the
 *  unit's lesson; the map shows the same spots in place. */
function WeakSpots({ weak }: { weak: WeakSpotSummary[] }) {
	const groups = weakSpotGroups(weak);
	if (!groups.length) return null;
	return (
		<div className="mt-4 border-t pt-4" data-testid="weak-spots">
			<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">
				<AlertTriangleIcon className="mr-1.5 inline size-3.5 align-[-2px] text-miss" />
				Your weak spots
			</p>
			<ul className="mt-1.5 flex flex-col gap-1">
				{groups.slice(0, 4).map((g) => (
					<li key={g.id}>
						<Link href={`/lesson?unit=${g.unit}`} className="group flex flex-wrap items-baseline gap-x-2 rounded-lg px-1 py-0.5 hover:bg-accent" data-testid={`weak-spot-${g.id}`}>
							<span className="font-ui text-sm font-bold text-foreground group-hover:text-go">{g.title}</span>
							<span className="font-ui text-xs text-muted-foreground">{g.spots.length > 1 ? `${g.spots.map((m) => m.title).join(" + ")} · ${g.spots[0]!.line}` : g.line}</span>
						</Link>
					</li>
				))}
				{groups.length > 4 && (
					<li className="px-1 font-ui text-xs text-muted-foreground">
						<Link href="/curriculum" className="underline hover:text-foreground">
							and {groups.length - 4} more on the map
						</Link>
					</li>
				)}
			</ul>
		</div>
	);
}
