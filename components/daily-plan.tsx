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
 * by hand. A task's color is its strand (components/strand-style.ts),
 * the same ink the week's balance uses.
 */

import Link from "next/link";
import { AlertTriangleIcon, ArrowLeftRightIcon, ArrowRightIcon, BlocksIcon, BookAIcon, BookOpenIcon, BotMessageSquareIcon, CheckIcon, DumbbellIcon, GaugeIcon, HeadphonesIcon, MicIcon, MonitorPlayIcon, RepeatIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KBD, PRIMARY, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { STRAND_STYLE, taskStrand } from "@/components/strand-style";
import { TrailMark } from "@/components/trail";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { STRANDS, weakSpotGroups, type DailyPlan as Plan, type LearnerGoal, type MixupSummary, type PlanTask, type WeakSpotSummary } from "@/src/core";
import { useActiveLanguage } from "@/components/speech";

export type Goal = LearnerGoal;

/** The day's next step: the first task in plan order not done yet. */
function nextTask(plan: Plan | null): PlanTask | null {
	return plan?.tasks.find((t) => !t.done) ?? null;
}

/** "Tuesday" for a YYYY-MM-DD day key. */
function dayName(key: string): string {
	return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" });
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
		description: "Hear real sentences at 95–98% known words. Train your ear before production.",
	},
	lesson: {
		label: "Grammar & Rules",
		strand: "Language-focused learning",
		description: "Deliberate practice of grammar patterns, case endings, and verb conjugations.",
	},
	strengthen: {
		label: "Strengthen Weak Spots",
		strand: "Deliberate practice",
		description: "Targeted drill on patterns where your accuracy dipped or mistakes were flagged.",
	},
	blitz: {
		label: "Speed Blitz",
		strand: "Speed",
		description: "Fast-paced 60-second challenge across units you have started to build quick recall.",
	},
	words: {
		label: "Vocabulary Cluster",
		strand: "Lexicon",
		description: "New core vocabulary organized by high-frequency thematic clusters.",
	},
	read: {
		label: "Graded Reading",
		strand: "Input",
		description: "Graded story reading with instant word tap-to-translate and audio.",
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
		strand: "Speed",
		description: "Say known sentences again, each time a little faster. Research supports the repetition; the shrinking time is our design.",
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
				description: "1-on-1 spoken practice with your tutor to guide pronunciation and rules.",
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
					className="z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border/80 bg-popover p-3 text-left font-ui shadow-xl"
				>
					<div className="space-y-1">
						<div className="flex items-center justify-between gap-1.5">
							<span className="text-xs font-bold text-foreground">{detail.label}</span>
							<span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold", st.soft, st.text)}>
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
					<span className={cn("flex items-center gap-1.5 text-xs font-bold", st.text)}>
						<TrailMark strand={strand} size="md" />
						Up next · {STRANDS.find((s) => s.id === strand)?.title}
					</span>
					<span className="mt-0.5 block text-lg font-extrabold leading-tight text-foreground">{task.title}</span>
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
	const cls = cn("group my-1 block w-full rounded-2xl border p-4 text-left transition-colors", st.border, st.soft);
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
			<span className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums text-muted-foreground">
				{task.done ? "Done" : `${task.minutes} min`}
			</span>
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
							{groups.length - 4} more in Curriculum
						</Link>
					</li>
				)}
			</ul>
		</div>
	);
}