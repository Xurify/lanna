"use client";

/**
 * Today's plan (LangHarness, 2026-10-28; one-card layout 2026-10-29) — the
 * day's tasks on the road to the target level.
 *
 * The plan is computed on the server (src/core/curriculum.ts dailyPlan):
 * review what is due, ten sentences to listen to, one lesson of new
 * ground, strengthen the weakest unit, new words, an episode to read,
 * a scene to speak, and three minutes of speed on what is known, cut to
 * the planned minutes.
 *
 * The first task not done yet is the day's one next step: it is drawn
 * large with its Start action, and Enter on Today starts it. Every task
 * ticks itself off from the progress ledger, so there is nothing to mark
 * by hand. A task's colour is its strand (components/strand-style.ts),
 * the same ink the week's balance uses.
 */

import Link from "next/link";
import { AlertTriangleIcon, ArrowLeftRightIcon, ArrowRightIcon, BlocksIcon, BookAIcon, BookOpenIcon, BotMessageSquareIcon, CheckIcon, DumbbellIcon, GaugeIcon, HeadphonesIcon, MicIcon, MonitorPlayIcon, RepeatIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KBD, PRIMARY, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { STRAND_STYLE, taskStrand } from "@/components/strand-style";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { STRANDS, weakSpotGroups, type DailyPlan as Plan, type LearnerGoal, type MixupSummary, type PlanTask, type WeakSpotSummary } from "@/src/core";

export type Goal = LearnerGoal;

/** The day's next step: the first task in plan order not done yet. */
export function nextTask(plan: Plan | null): PlanTask | null {
	return plan?.tasks.find((t) => !t.done) ?? null;
}

/** "Tuesday" for a YYYY-MM-DD day key. */
function dayName(key: string): string {
	return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" });
}

export function DailyPlan({
	plan,
	nextUnit,
	pace,
	backlog = 0,
	busy = false,
	onSpeak,
}: {
	plan: Plan | null;
	/** The Continue unit: "one more lesson" once the plan is done. */
	nextUnit: string;
	/** The goal against the plan and the last seven days' logged minutes. */
	pace?: { goalMinutes: number; plannedMinutes: number; dailyAverage: number; windowDays: number };
	/** Unfinished tasks from the last seven days. */
	backlog?: number;
	busy?: boolean;
	onSpeak: (task: PlanTask) => void;
}) {
	const tasks = plan?.tasks ?? [];
	const done = plan?.done ?? 0;
	const total = plan?.total ?? 0;
	const up = nextTask(plan);
	const left = tasks.filter((t) => !t.done).reduce((n, t) => n + t.minutes, 0);
	const complete = total > 0 && done >= total;

	return (
		<section className="rounded-3xl border bg-card p-4 sm:p-5" data-testid="daily-plan" aria-labelledby="plan-title">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
				<h2 id="plan-title" className="text-xl font-black text-foreground">
					Today&apos;s plan
				</h2>
				<p className="text-sm font-semibold tabular-nums text-muted-foreground" data-testid="plan-summary">
					{!plan ? "\u00a0" : complete ? `All ${total} done` : done === 0 ? `${total} tasks · about ${left} min` : `${done} of ${total} done · about ${left} min left`}
				</p>
			</div>
			{pace && plan && (
				<p className="mt-1 px-1 text-sm text-muted-foreground" data-testid="plan-pace">
					Goal {pace.goalMinutes} min a day · today&apos;s plan about {pace.plannedMinutes} min · the last {pace.windowDays} days averaged {pace.dailyAverage} min a day
				</p>
			)}
			{backlog > 0 && pace && (
				<p className="mt-1 px-1 text-sm font-semibold text-gold" data-testid="plan-backlog">
					{backlog} unfinished {backlog === 1 ? "task" : "tasks"} left over from the last {pace.windowDays} days
				</p>
			)}
			<PlanProgress tasks={tasks} />

			{complete && (
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-gold/40 bg-gold/5 p-4" data-testid="plan-complete">
					<div>
						<p className="text-lg font-black text-foreground">All done for today. Pekne!</p>
						<p className="text-sm text-muted-foreground">
							{pace ? `That is ${plan?.minutes ?? 0} of your ${pace.goalMinutes} min goal. ` : ""}Practice freely below, or keep going on your path.
						</p>
					</div>
					<Link href={`/lesson?unit=${nextUnit}`} className={cn(SECONDARY, SMALL)} data-testid="plan-one-more">
						One more lesson
					</Link>
				</div>
			)}

			{plan ? (
				<ol className="mt-3 flex flex-col gap-1" data-testid="plan-tasks">
					{tasks.map((t) => (
						<li key={t.id}>{t === up ? <NextTask task={t} busy={busy} onSpeak={onSpeak} /> : <TaskRow task={t} busy={busy} onSpeak={onSpeak} />}</li>
					))}
				</ol>
			) : (
				<PlanSkeleton />
			)}
		</section>
	);
}

/** One segment per task, filled in the task's strand ink once it is done. */
function PlanProgress({ tasks }: { tasks: PlanTask[] }) {
	return (
		<div className="mt-3 flex gap-1 px-1" aria-hidden="true">
			{tasks.length === 0 ? (
				<span className="h-1.5 flex-1 rounded-full bg-accent" />
			) : (
				tasks.map((t) => <span key={t.id} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-500", t.done ? STRAND_STYLE[taskStrand(t)].bar : "bg-accent")} />)
			)}
		</div>
	);
}

/** Rows shaped like the real ones while the plan loads, so nothing jumps. */
function PlanSkeleton() {
	return (
		<ol className="mt-3 flex flex-col gap-1" aria-label="Loading today's plan">
			{[0, 1, 2, 3, 4].map((i) => (
				<li key={i} className="flex items-center gap-3 px-2 py-2">
					<span className="size-10 shrink-0 animate-pulse rounded-xl bg-accent" />
					<span className="flex-1">
						<span className="block h-4 w-1/3 animate-pulse rounded bg-accent" />
						<span className="mt-1.5 block h-3 w-2/3 animate-pulse rounded bg-accent/70" />
					</span>
				</li>
			))}
		</ol>
	);
}

const TASK_ICON: Record<PlanTask["id"], React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
	review: RepeatIcon,
	listen: HeadphonesIcon,
	lesson: BlocksIcon,
	strengthen: DumbbellIcon,
	blitz: ZapIcon,
	words: BookAIcon,
	read: BookOpenIcon,
	watch: MonitorPlayIcon,
	speak: MicIcon,
	fluency: GaugeIcon,
};

interface TaskDescription {
	label: string;
	strand: string;
	description: string;
}

const TASK_DETAILS: Record<PlanTask["id"], TaskDescription> = {
	review: {
		label: "Spaced Review",
		strand: "Retention",
		description: "Spaced repetition (FSRS) to review words and endings just as they are about to fade.",
	},
	listen: {
		label: "Comprehensible Input",
		strand: "Listening",
		description: "Hear real Slovak sentences at 95–98% known words. Train your ear before production.",
	},
	lesson: {
		label: "Grammar & Rules",
		strand: "Language-focused learning",
		description: "Deliberate practice of Slovak grammar patterns, case endings, and verb conjugations.",
	},
	strengthen: {
		label: "Strengthen Weak Spots",
		strand: "Deliberate practice",
		description: "Targeted drill on patterns where your accuracy dipped or mistakes were flagged.",
	},
	blitz: {
		label: "Speed Blitz",
		strand: "Fluency",
		description: "Fast-paced 60-second challenge across units you have started to build quick recall.",
	},
	words: {
		label: "Vocabulary Cluster",
		strand: "Lexicon",
		description: "New core vocabulary organized by high-frequency thematic clusters.",
	},
	read: {
		label: "Extensive Reading",
		strand: "Input",
		description: "Graded story reading in Slovak with instant word tap-to-translate and audio.",
	},
	watch: {
		label: "Authentic Video",
		strand: "Input",
		description: "Short authentic video clips with interactive dual subtitles.",
	},
	speak: {
		label: "Spoken Practice",
		strand: "Meaning-focused output",
		description: "Roleplay realistic dialogue scenes with speech recognition or 1-on-1 tutor guidance.",
	},
	fluency: {
		label: "Say It Faster",
		strand: "Fluency development",
		description: "Paul Nation's 4/3/2 fluency technique: repeat known material faster to build automaticity without hesitation.",
	},
};

function TaskIcon({ task, large = false }: { task: PlanTask; large?: boolean }) {
	const strand = taskStrand(task);
	const st = STRAND_STYLE[strand];
	const isTutor = task.via === "tutor";
	const Icon = isTutor ? BotMessageSquareIcon : TASK_ICON[task.id];
	const detail = isTutor
		? {
				label: "Tutor Session",
				strand: "Guided speaking",
				description: "1-on-1 spoken practice with your Slovak tutor to guide pronunciation and rules.",
		  }
		: TASK_DETAILS[task.id];

	const iconEl = (
		<span
			role="button"
			tabIndex={0}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					e.stopPropagation();
				}
			}}
			aria-label={`${detail.label}: ${detail.description}`}
			className={cn(
				"flex shrink-0 cursor-help items-center justify-center rounded-xl transition-transform hover:scale-105 focus:outline-none focus:ring-1 focus:ring-accent",
				large ? "size-12" : "size-10",
				task.done ? cn("bg-accent", st.text) : st.tile,
			)}
		>
			{task.done ? <CheckIcon className="size-5" strokeWidth={3} aria-label="Done" /> : <Icon className={large ? "size-6" : "size-5"} />}
		</span>
	);

	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip disableHoverableContent={false}>
				<TooltipTrigger asChild>
					{iconEl}
				</TooltipTrigger>
				<TooltipContent
					side="top"
					align="start"
					sideOffset={6}
					className="z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border/80 bg-popover/95 p-3 text-left font-ui shadow-xl backdrop-blur-md"
				>
					<div className="space-y-1">
						<div className="flex items-center justify-between gap-1.5">
							<span className="text-xs font-bold text-foreground">{detail.label}</span>
							<span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", st.soft, st.text)}>
								{detail.strand}
							</span>
						</div>
						<p className="text-[11px] leading-relaxed text-muted-foreground">{detail.description}</p>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/** The next step: one large target with its Start action. */
function NextTask({ task, busy, onSpeak }: { task: PlanTask; busy: boolean; onSpeak: (task: PlanTask) => void }) {
	const strand = taskStrand(task);
	const st = STRAND_STYLE[strand];
	const body = (
		<>
			<span className="flex items-start gap-4">
				<TaskIcon task={task} large />
				<span className="min-w-0 flex-1">
					<span className={cn("block text-xs font-bold", st.text)}>Up next · {STRANDS.find((s) => s.id === strand)?.title}</span>
					<span className="mt-0.5 block text-lg font-black leading-tight text-foreground">{task.title}</span>
					<span className="mt-1 block text-sm text-pretty text-muted-foreground">{task.from ? `Left from ${dayName(task.from)} · ${task.line}` : task.line}</span>
				</span>
			</span>
			<span className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:pl-16">
				<span className={cn(PRIMARY, "h-11 px-6 group-disabled:bg-accent group-disabled:text-muted-foreground")}>
					Start
					<ArrowRightIcon className="size-4" strokeWidth={3} />
				</span>
				<span className="text-sm text-muted-foreground">
					About {task.minutes} min
					{task.href && (
						<>
							<span className="hidden pointer-fine:inline">{" · "}
							<kbd className={KBD}>Enter</kbd> to start</span>
						</>
					)}
				</span>
			</span>
		</>
	);
	const cls = cn("group my-1 block w-full rounded-2xl border-2 p-4 text-left transition-colors", st.border, st.soft);
	return task.href ? (
		<Link href={task.href} className={cls} data-testid={`plan-${task.id}`} data-next="true">
			{body}
		</Link>
	) : (
		<button type="button" onClick={() => onSpeak(task)} disabled={busy} className={cls} data-testid={`plan-${task.id}`} data-next="true">
			{body}
		</button>
	);
}

function TaskRow({ task, busy, onSpeak }: { task: PlanTask; busy: boolean; onSpeak: (task: PlanTask) => void }) {
	const body = (
		<>
			<TaskIcon task={task} />
			<span className="min-w-0 flex-1">
				<span className={cn("block truncate text-base font-bold", task.done ? "text-muted-foreground" : "text-foreground")}>{task.title}</span>
				<span className="block truncate text-sm text-muted-foreground">{task.from ? `Left from ${dayName(task.from)} · ${task.line}` : task.line}</span>
			</span>
			<span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{task.done ? "Done" : `${task.minutes} min`}</span>
		</>
	);
	const cls = "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent disabled:opacity-60";
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

/** The struggles on record, one line each: the unit (or the family two
 *  units share), where it was seen, and the tally since. Each opens the
 *  unit's lesson; the map shows the same spots in place. */
export function WeakSpots({ weak, className = "mt-4 border-t pt-4" }: { weak: WeakSpotSummary[]; className?: string }) {
	const groups = weakSpotGroups(weak);
	if (!groups.length) return null;
	return (
		<div className={className} data-testid="weak-spots">
			<p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
				<AlertTriangleIcon className="size-4 text-miss" aria-hidden="true" />
				Your weak spots
			</p>
			<ul className="mt-2 flex flex-col gap-0.5">
				{groups.slice(0, 4).map((g) => (
					<li key={g.id}>
						<Link href={`/lesson?unit=${g.unit}`} className="group -mx-2 block rounded-lg px-2 py-1.5 hover:bg-accent" data-testid={`weak-spot-${g.id}`}>
							<span className="block text-sm font-bold text-foreground group-hover:text-go">{g.title}</span>
							<span className="block text-xs text-muted-foreground">{g.spots.length > 1 ? `${g.spots.map((m) => m.title).join(" + ")} · ${g.spots[0]!.line}` : g.line}</span>
						</Link>
					</li>
				))}
				{groups.length > 4 && (
					<li className="pt-1 text-xs text-muted-foreground">
						<Link href="/curriculum" className="underline underline-offset-2 hover:text-foreground">
							{groups.length - 4} more on the path
						</Link>
					</li>
				)}
			</ul>
		</div>
	);
}

/** The pairs of words the learner gives one for the other, and the
 *  look-alikes predicted from them (src/core/mixups.ts). One link opens the
 *  Mix-ups lesson, which takes them all. */
export function MixUps({ mixups, className = "mt-4 border-t pt-4" }: { mixups: MixupSummary[]; className?: string }) {
	const open = mixups.filter((m) => m.status === "active");
	const probes = mixups.filter((m) => m.status === "probe");
	if (!open.length && !probes.length) return null;
	return (
		<div className={className} data-testid="mixups">
			<p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
				<ArrowLeftRightIcon className="size-4 text-miss" aria-hidden="true" />
				Words you mix up
			</p>
			<ul className="mt-2 flex flex-col gap-0.5">
				{open.slice(0, 4).map((m) => (
					<li key={m.key} className="py-1.5" data-testid={`mixup-${m.key}`}>
						<span className="block text-sm font-bold text-foreground" lang="sk">
							{m.words.join(" / ")}
						</span>
						<span className="block text-xs text-muted-foreground">{m.line}</span>
					</li>
				))}
				{probes.length > 0 && (
					<li className="py-1.5 text-xs text-muted-foreground" data-testid="mixup-probes">
						<span className="font-bold text-foreground">{open.length ? "Likely next" : "To test"}:</span>{" "}
						<span lang="sk">{probes.slice(0, 4).map((m) => m.words.join(" / ")).join(", ")}</span>
						{open.length ? " — the same pattern, not tested yet" : " — predicted from pairs you have mixed up"}
					</li>
				)}
			</ul>
			<Link href="/lesson?mode=mixups" className={cn(SECONDARY, SMALL, "mt-2 pointer-coarse:min-h-11")} data-testid="mixups-practise">
				Practise them
			</Link>
		</div>
	);
}
