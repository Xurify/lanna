"use client";

/**
 * The path (LangHarness, 2026-10-28) — the whole A1→B2 map as stages and
 * chapters, each unit a node whose ring fills as it is done, locked until
 * its chapter opens. The Today page shows it compact (the current chapter
 * open, the rest folded); /curriculum shows every chapter open. An open
 * chapter ends with its exam (E15): one row whose line says where it stands.
 *
 * Pure render over the server's CurriculumState (src/core/curriculum.ts);
 * starting a tutor unit or a goal's Talk scene is handed up, because those
 * need a configured model (the Today page gates them with the setup dialog).
 */

import { useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, BotMessageSquareIcon, ChevronDownIcon, ChevronRightIcon, FlagIcon, LockIcon, MapIcon, StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnitBadge } from "@/components/unit-badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { examLine, STAGES, TUTOR_SESSIONS, weakFamily, WEAK_MEND_ACCURACY, WEAK_MEND_REPS, type ChapterState, type CurriculumState, type ExamSummary, type UnitState, type WeakSpotSummary } from "@/src/core";

export function CurriculumPath({
	state,
	next,
	mode = "compact",
	goals,
	weak,
	exams,
	busy = false,
	onTutor,
	onScene,
}: {
	state: CurriculumState | null;
	next?: string;
	mode?: "compact" | "full";
	/** Goal units the learner's purposes serve (src/core/onboarding.ts): starred. */
	goals?: ReadonlySet<string>;
	/** Units on record as weak spots (src/core/weak-spots.ts): marked, with why. */
	weak?: WeakSpotSummary[];
	/** Each chapter's exam on record (src/core/exam.ts), by chapter id. */
	exams?: Record<string, ExamSummary>;
	busy?: boolean;
	onTutor: (unit: UnitState) => void;
	onScene: (scene: string, unit: UnitState) => void;
}) {
	const [opened, setOpened] = useState<Record<string, boolean>>({});
	const weakBy = new Map((weak ?? []).map((w) => [w.unit as string, w]));
	if (!state) return null;
	const isOpen = (ch: ChapterState) => mode === "full" || opened[ch.id] || (opened[ch.id] === undefined && ch.id === state.current);
	const toggle = (id: string) => setOpened((o) => ({ ...o, [id]: !(o[id] ?? id === state.current) }));
	return (
		<div data-testid="curriculum-path">
			{STAGES.map((stage) => {
				const chapters = state.chapters.filter((c) => c.stage === stage.id);
				const done = chapters.reduce((n, c) => n + c.doneCount, 0);
				const total = chapters.reduce((n, c) => n + c.total, 0);
				const current = stage.level === state.level;
				const reached = chapters.some((c) => c.open);
				return (
					<section key={stage.id} className={cn("mt-5 first:mt-0", !reached && mode === "compact" && "opacity-70")} data-testid={`stage-${stage.id}`}>
						<div className="flex items-center gap-3">
							<span className={cn("rounded-lg px-2 py-0.5 font-ui text-xs font-semibold", current || (done >= total && total > 0) ? "bg-teal text-[var(--q-on-teal)]" : "bg-well-2 text-ink-2")}>{stage.level}</span>
							<span className="min-w-0 flex-1">
								<span className="block font-ui text-base font-semibold text-foreground">{stage.title}</span>
								<span className="block font-ui text-xs text-muted-foreground">
									{done}/{total} units{mode === "full" && ` · ${stage.blurb}`}
								</span>
							</span>
						</div>
						<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-well-2" aria-hidden="true">
							<div className={cn("h-full rounded-full transition-[width] duration-700", "bg-teal")} style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
						</div>
						{/* Compact: a stage not reached yet is its header alone; its
						    chapters are the full map's business. */}
						{(reached || mode === "full") && (
							<ol className="mt-3 flex flex-col gap-2">
								{chapters.map((ch, i) => (
									<li key={ch.id} className={cn("q-card", ch.id === state.current && "shadow-[var(--q-raise),inset_0_0_0_1.5px_var(--q-teal-line)]")} data-testid={`chapter-${ch.id}`}>
										<button
											type="button"
											onClick={() => mode === "compact" && toggle(ch.id)}
											className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left", mode === "compact" && "rounded-xl hover:bg-well")}
											aria-expanded={isOpen(ch)}
										>
											<span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full font-ui text-xs font-semibold", ch.done ? "bg-teal text-[var(--q-on-teal)]" : ch.open ? "bg-teal-wash text-teal-2" : "bg-well-2 text-ink-3")}>
												{ch.done ? "✓" : ch.open ? ch.doneCount : <LockIcon className="size-3" />}
											</span>
											<span className="min-w-0 flex-1">
												<span className={cn("block font-ui text-sm font-semibold", ch.open ? "text-foreground" : "text-muted-foreground")}>{ch.title}</span>
												<span className="block truncate font-ui text-xs text-muted-foreground">{ch.open ? `${ch.doneCount}/${ch.total} · ${ch.tagline}` : chapters[i - 1]?.open ? `Opens when “${chapters[i - 1]!.title}” is nearly done` : ch.tagline}</span>
											</span>
											{mode === "compact" && (isOpen(ch) ? <ChevronDownIcon className="size-4 text-muted-foreground" /> : <ChevronRightIcon className="size-4 text-muted-foreground" />)}
										</button>
										{isOpen(ch) && (
											<ol className="flex flex-col gap-1 px-2 pb-2">
												{ch.units.map((u) => (
													<li key={u.id}>
														<UnitRow unit={u} active={u.id === next} starred={goals?.has(u.id) ?? false} weak={weakBy.get(u.id)} busy={busy} onTutor={onTutor} onScene={onScene} />
													</li>
												))}
												{ch.open && exams?.[ch.id] && (
													<li>
														<ExamRow chapterId={ch.id} summary={exams[ch.id]!} />
													</li>
												)}
											</ol>
										)}
									</li>
								))}
							</ol>
						)}
					</section>
				);
			})}
			{mode === "compact" && (
				<Link href="/curriculum" className="mt-4 flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground">
					<MapIcon className="size-3.5" />
					See the whole path
				</Link>
			)}
		</div>
	);
}

/** The second line of a unit: what the ledger shows, or what it needs. */
export function unitLine(u: UnitState, active: boolean): string {
	const pct = u.accuracy !== null && u.reps > 0 ? `${Math.round(u.accuracy * 100)}% right` : "";
	if (u.kind === "goal") return u.status === "done" ? (u.scene ? "Reached · prove it in a Talk scene" : "Reached") : u.status === "skipped" ? "Passed in placement" : (u.needs ?? u.tagline);
	if (u.status === "skipped") return u.kind === "tutor" ? "Passed in placement · open any time" : `Passed in placement${pct ? ` · ${pct}` : ""} · open any time`;
	if (u.status === "locked") return u.needs ?? u.tagline;
	if (u.kind === "tutor") return u.status === "done" ? `Done · ${u.lessons} sessions` : u.lessons > 0 ? `${u.lessons} of ${TUTOR_SESSIONS} sessions · ${u.tagline}` : u.tagline;
	if (u.status === "done") return u.lessons === 0 ? `Tested out in placement${pct ? ` · ${pct}` : ""}` : `Done · ${u.lessons} lesson${u.lessons === 1 ? "" : "s"}${pct ? ` · ${pct}` : ""}`;
	if (u.lessons > 0) return `${u.lessons} lesson${u.lessons === 1 ? "" : "s"}${pct ? ` · ${pct}` : ""}`;
	return active ? (u.tagline ? `Up next · ${u.tagline}` : "Up next") : u.tagline;
}

const WEAK_SOURCE_NAMES: Record<string, string> = {
	check: "Level check",
	lesson: "Lesson drill",
	review: "Review deck lapses",
};

function WeakSpotHover({ unit, weak }: { unit: UnitState; weak: WeakSpotSummary }) {
	const totalReps = weak.hits + weak.misses;
	const accuracy = totalReps > 0 ? Math.round((weak.hits / totalReps) * 100) : null;
	const fam = weakFamily(weak.unit);
	const mendPercent = Math.round(WEAK_MEND_ACCURACY * 100);

	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip disableHoverableContent={false}>
				<TooltipTrigger asChild>
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
						className="inline-flex cursor-help items-center rounded p-0.5 text-miss transition-colors hover:bg-[var(--q-miss-wash)] focus:outline-none focus:ring-1 focus:ring-miss"
						aria-label={`Weak spot: ${weak.title}`}
						data-testid={`weak-mark-${unit.id}`}
					>
						<AlertTriangleIcon className="size-3.5 shrink-0 text-miss" aria-hidden="true" />
					</span>
				</TooltipTrigger>
				<TooltipContent
					side="top"
					align="start"
					sideOffset={6}
					className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-popover p-3 text-left shadow-raise-hi"
				>
					<div className="flex items-start gap-2.5">
						<div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-[var(--q-miss-wash)] text-miss">
							<AlertTriangleIcon className="size-3.5" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1 space-y-2">
							<div>
								<div className="flex items-baseline justify-between gap-1.5">
									<span className="text-xs font-semibold text-foreground">Weak Spot</span>
									<span className="text-[10px] font-semibold text-muted-foreground">
										{WEAK_SOURCE_NAMES[weak.source] ?? weak.source}
									</span>
								</div>
								<p className="text-xs font-semibold text-foreground">{weak.title}</p>
								{(weak.tagline || unit.tagline) && (
									<p className="mt-0.5 text-[11px] italic text-muted-foreground">
										{weak.tagline || unit.tagline}
									</p>
								)}
							</div>

							{weak.note && (
								<div className="rounded-md bg-accent/60 px-2 py-1.5 text-[11px] text-foreground/90">
									<span className="font-semibold text-muted-foreground">Evidence: </span>
									{weak.note}
								</div>
							)}

							<div className="space-y-1 border-t border-border/50 pt-2 text-[11px]">
								<div className="flex items-center justify-between text-muted-foreground">
									<span>Practice since flagged:</span>
									<span className="font-medium text-foreground">
										{totalReps > 0 ? `${weak.hits}/${totalReps} right (${accuracy}%)` : "0 reps"}
									</span>
								</div>
								<div className="flex items-center justify-between text-muted-foreground">
									<span>To clear spot:</span>
									<span className="font-medium text-foreground">
										{WEAK_MEND_REPS} reps at ≥{mendPercent}%
									</span>
								</div>
								{totalReps < WEAK_MEND_REPS && (
									<p className="text-[10px] text-muted-foreground/80">
										{WEAK_MEND_REPS - totalReps} more reps needed before clearing
									</p>
								)}
							</div>

							{fam && (
								<div className="border-t border-border/50 pt-1.5 text-[10px] text-muted-foreground">
									<span className="font-semibold text-foreground/80">Pattern group: </span>
									{fam.title} ({fam.tagline})
								</div>
							)}
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function TutorSessionHover({ unit }: { unit: UnitState }) {
	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip disableHoverableContent={false}>
				<TooltipTrigger asChild>
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
						className="inline-flex cursor-help items-center rounded p-0.5 text-xp transition-colors hover:bg-xp/15 focus:outline-none focus:ring-1 focus:ring-xp"
						aria-label="With the tutor"
						data-testid={`tutor-hint-${unit.id}`}
					>
						<BotMessageSquareIcon className="size-3.5 shrink-0 text-xp" aria-hidden="true" />
					</span>
				</TooltipTrigger>
				<TooltipContent
					side="top"
					align="start"
					sideOffset={6}
					className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-popover p-3 text-left shadow-raise-hi"
				>
					<div className="flex items-start gap-2.5">
						<div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-xp/15 text-xp">
							<BotMessageSquareIcon className="size-3.5" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1 space-y-1.5">
							<div className="flex items-baseline justify-between gap-1.5">
								<span className="text-xs font-semibold text-foreground">With the Tutor</span>
								<span className="rounded bg-xp/10 px-1 py-0.5 text-[10px] font-semibold text-xp">
									Guided session
								</span>
							</div>
							<p className="text-xs font-semibold text-foreground">{unit.grammarTerm ?? unit.title}</p>
							<p className="text-[11px] leading-relaxed text-muted-foreground">
								Interactive 1-on-1 session with your Slovak tutor. Explains pronunciation rules, sentence structure, and grammar concepts aloud with examples before you drill them.
							</p>
							{unit.tagline && (
								<p className="border-t border-border/50 pt-1.5 text-[10px] italic text-muted-foreground">
									Focus: {unit.tagline}
								</p>
							)}
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function StarredGoalHover({ unit }: { unit: UnitState }) {
	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip disableHoverableContent={false}>
				<TooltipTrigger asChild>
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
						className="inline-flex cursor-help items-center rounded p-0.5 text-teal transition-colors hover:bg-teal-wash focus:outline-none focus:ring-1 focus:ring-teal"
						aria-label="Priority goal"
						data-testid={`starred-hint-${unit.id}`}
					>
						<StarIcon className="size-3.5 shrink-0 fill-teal text-teal" aria-hidden="true" />
					</span>
				</TooltipTrigger>
				<TooltipContent
					side="top"
					align="start"
					sideOffset={6}
					className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-popover p-3 text-left shadow-raise-hi"
				>
					<div className="flex items-start gap-2.5">
						<div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-teal-wash text-teal-2">
							<StarIcon className="size-3.5 fill-teal" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1 space-y-1.5">
							<div className="flex items-baseline justify-between gap-1.5">
								<span className="text-xs font-semibold text-foreground">Priority Goal</span>
								<span className="rounded bg-teal-wash px-1 py-0.5 text-[10px] font-semibold text-teal-2">
									Your target
								</span>
							</div>
							<p className="text-xs font-semibold text-foreground">{unit.title}</p>
							<p className="text-[11px] leading-relaxed text-muted-foreground">
								One of your selected can-do targets from onboarding. Lessons and drills directly leading toward this real-world target are highlighted and prioritized on your path.
							</p>
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function CanDoGoalHover({ unit }: { unit: UnitState }) {
	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip disableHoverableContent={false}>
				<TooltipTrigger asChild>
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
						className="inline-flex cursor-help items-center rounded p-0.5 text-ink-2 transition-colors hover:bg-well focus:outline-none focus:ring-1 focus:ring-ink-3"
						aria-label="Can-do milestone"
						data-testid={`goal-hint-${unit.id}`}
					>
						<FlagIcon className="size-3.5 shrink-0 text-ink-2" aria-hidden="true" />
					</span>
				</TooltipTrigger>
				<TooltipContent
					side="top"
					align="start"
					sideOffset={6}
					className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl bg-popover p-3 text-left shadow-raise-hi"
				>
					<div className="flex items-start gap-2.5">
						<div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-well text-ink-2">
							<FlagIcon className="size-3.5" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1 space-y-1.5">
							<div className="flex items-baseline justify-between gap-1.5">
								<span className="text-xs font-semibold text-foreground">Can-Do Milestone</span>
								<span className="rounded bg-well px-1 py-0.5 text-[10px] font-semibold text-ink-2">
									CEFR goal
								</span>
							</div>
							<p className="text-xs font-semibold text-foreground">{unit.grammarTerm ?? unit.title}</p>
							<p className="text-[11px] leading-relaxed text-muted-foreground">
								A communicative milestone. Proves practical ability in a spoken or typed dialogue scenario rather than isolated grammar exercises.
							</p>
							{unit.tagline && (
								<p className="border-t border-border/50 pt-1.5 text-[10px] italic text-muted-foreground">
									Scenario: {unit.tagline}
								</p>
							)}
						</div>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function TermHover({ unit }: { unit: UnitState }) {
	if (!unit.slovakTerm) return null;
	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip disableHoverableContent={false}>
				<TooltipTrigger asChild>
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
						className="inline-flex max-w-[120px] shrink truncate cursor-help items-center rounded-md bg-accent/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-well hover:text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
						aria-label={`Linguistic term: ${unit.slovakTerm}`}
					>
						<span className="truncate">{unit.slovakTerm}</span>
					</span>
				</TooltipTrigger>
				<TooltipContent
					side="top"
					align="start"
					sideOffset={6}
					className="z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-popover p-3 text-left shadow-raise-hi"
				>
					<div className="space-y-1.5">
						<div className="flex items-baseline justify-between gap-1.5">
							<span className="text-xs font-semibold text-foreground">{unit.slovakTerm}</span>
							<span className="rounded bg-accent px-1 py-0.5 text-[10px] font-semibold text-muted-foreground">
								Slovak grammar
							</span>
						</div>
						{unit.grammarTerm && (
							<p className="text-xs font-semibold text-foreground/90">{unit.grammarTerm}</p>
						)}
						{unit.tagline && (
							<p className="text-[11px] leading-relaxed text-muted-foreground">
								{unit.tagline}
							</p>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

function UnitBadgeHover({
	unit,
	active,
	locked,
	skipped,
	tone,
}: {
	unit: UnitState;
	active: boolean;
	locked: boolean;
	skipped: boolean;
	tone: "go" | "xp" | "flame";
}) {
	const done = unit.status === "done" || skipped;
	const statusLabel = done
		? "Completed"
		: locked
			? "Locked"
			: active
				? "Up Next"
				: unit.lessons > 0
					? "In Progress"
					: "Ready to start";

	const typeName =
		unit.kind === "tutor"
			? "Tutor Session"
			: unit.kind === "goal"
				? "Can-Do Goal"
				: unit.kind === "words"
					? "Vocabulary Lesson"
					: "Grammar Lesson";

	const detail = done
		? "Mastered or tested out. Tap to practice anytime."
		: locked
			? (unit.needs ? `Locked: ${unit.needs}.` : "Complete earlier lessons or open this chapter to unlock.")
			: active
				? "Current recommended unit on your path."
				: unit.lessons > 0
					? `${unit.lessons} lesson${unit.lessons === 1 ? "" : "s"} done (${Math.round(unit.progress * 100)}%).`
					: "Unlocked and ready to practice.";

	return (
		<TooltipProvider delayDuration={150}>
			<Tooltip disableHoverableContent={false}>
				<TooltipTrigger asChild>
					<span
						className={cn("inline-flex cursor-help", skipped && "opacity-60")}
						onClick={(e) => {
							if (locked) {
								e.preventDefault();
								e.stopPropagation();
							}
						}}
					>
						<UnitBadge glyph={unit.glyph} progress={unit.progress} done={done} active={active} locked={locked} size="sm" tone={tone} />
					</span>
				</TooltipTrigger>
				<TooltipContent
					side="right"
					align="center"
					sideOffset={8}
					className="z-50 w-60 max-w-[calc(100vw-2rem)] rounded-xl bg-popover p-2.5 text-left shadow-raise-hi"
				>
					<div className="space-y-1">
						<div className="flex items-center justify-between gap-1.5">
							<span className="truncate text-xs font-semibold text-foreground">{unit.title}</span>
							<span
								className={cn(
									"shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold",
									done ? "bg-teal-wash text-teal-2" : locked ? "bg-muted text-muted-foreground" : "bg-teal-wash text-teal-2",
								)}
							>
								{statusLabel}
							</span>
						</div>
						<p className="text-[10px] font-semibold text-muted-foreground">{typeName}</p>
						<p className="text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
					</div>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function UnitRow({ unit: u, active, starred, weak, busy, onTutor, onScene }: { unit: UnitState; active: boolean; starred: boolean; weak?: WeakSpotSummary; busy: boolean; onTutor: (u: UnitState) => void; onScene: (scene: string, u: UnitState) => void }) {
	const locked = u.status === "locked";
	const skipped = u.status === "skipped";
	const tone = u.kind === "tutor" ? "xp" : u.kind === "goal" ? "flame" : "go";
	const body = (
		<>
			<UnitBadgeHover unit={u} active={active} locked={locked} skipped={skipped} tone={tone} />
			<span className="min-w-0 flex-1">
				<span className={cn("flex min-w-0 items-center justify-between gap-1.5 font-ui text-sm font-semibold", locked || skipped ? "text-muted-foreground" : active ? "text-teal-2" : "text-foreground")}>
					<span className="flex min-w-0 flex-wrap items-center gap-x-1.5">
						<span>{u.title}</span>
						{u.slovakTerm && <TermHover unit={u} />}
					</span>
					<span className="flex shrink-0 items-center gap-1">
						{starred && <StarredGoalHover unit={u} />}
						{u.kind === "tutor" && <TutorSessionHover unit={u} />}
						{u.kind === "goal" && <CanDoGoalHover unit={u} />}
						{weak && <WeakSpotHover unit={u} weak={weak} />}
					</span>
				</span>
				<span className="block truncate font-ui text-xs text-muted-foreground" title={weak ? `Weak spot ${weak.line}` : undefined}>
					{weak ? `Weak spot ${weak.line}` : unitLine(u, active)}
				</span>
			</span>
		</>
	);
	const cls = cn("flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left", !locked && "hover:bg-well", locked && "cursor-default");
	if (locked || (u.kind === "goal" && !u.scene)) {
		return (
			<div className={cls} data-testid={`unit-${u.id}`} aria-disabled="true">
				{body}
			</div>
		);
	}
	if (u.kind === "drill" || u.kind === "words") {
		return (
			<Link href={`/lesson?unit=${u.id}`} className={cls} data-testid={`unit-${u.id}`}>
				{body}
			</Link>
		);
	}
	return (
		<button type="button" disabled={busy} onClick={() => (u.kind === "goal" && u.scene ? onScene(u.scene, u) : onTutor(u))} className={cn(cls, "disabled:opacity-60")} data-testid={`unit-${u.id}`}>
			{body}
		</button>
	);
}

/** A chapter's exam, the last row of its open units (E14, E15). Record
 *  only: the line says where it stands, and nothing on the path opens or
 *  closes on it. Its ring is a unit's ring: it fills to the best score,
 *  and turns teal once the exam is passed. */
export function ExamRow({ chapterId, summary }: { chapterId: string; summary: ExamSummary }) {
	const best = summary.best;
	return (
		<Link href={`/exam?chapter=${chapterId}`} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-well" data-testid={`exam-${chapterId}`}>
			<UnitBadge glyph="clipboard-check" progress={best ? best.score / best.total : 0} done={best?.passed ?? false} size="sm" tone="go" />
			<span className="min-w-0 flex-1">
				<span className="block font-ui text-sm font-semibold text-foreground">Chapter exam</span>
				<span className="block truncate font-ui text-xs text-muted-foreground">{examLine(summary)}</span>
			</span>
		</Link>
	);
}
