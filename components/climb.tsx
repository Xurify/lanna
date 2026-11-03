"use client";

/**
 * The climb (/curriculum): the path to the target level as a calm list.
 * Each CEFR stage is a section with a strip of its chapters (teal for done,
 * outlined for the one you are on, hairline for what is ahead, dashed for
 * what is still locked), and each chapter is a row that folds out to its
 * units. Compact mode shows only the stage you are on.
 *
 * Pure render over the server's CurriculumState (src/core/curriculum.ts).
 * Starting a tutor unit or a scene is handed up, because those need a
 * configured model (the pages gate them with the setup dialog).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon, MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExamRow, UnitRow } from "@/components/curriculum-path";
import { QCheck } from "@/components/quiet/icon";
import { STAGES, type ChapterState, type CurriculumState, type ExamSummary, type Stage, type UnitState, type WeakSpotSummary } from "@/src/core";

type Mark = "done" | "next" | "ahead" | "locked";

const markOf = (ch: ChapterState, current: boolean): Mark => (ch.done ? "done" : current ? "next" : ch.open ? "ahead" : "locked");

/** One chapter's mark: the teal check, a teal ring, a hairline ring, or a dashed one. */
function ChapterMark({ mark, label }: { mark: Mark; label: string | number }) {
	return (
		<span
			className={cn(
				"grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
				mark === "done" && "bg-teal text-[var(--q-on-teal)]",
				mark === "next" && "bg-teal-wash text-teal-2 shadow-[inset_0_0_0_1.5px_var(--q-teal)]",
				mark === "ahead" && "bg-card text-ink-2 shadow-[inset_0_0_0_1px_var(--q-line-2)]",
				mark === "locked" && "text-ink-4 outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-[var(--q-dash)]",
			)}
			aria-hidden="true"
		>
			{mark === "done" ? <QCheck className="size-3" /> : label}
		</span>
	);
}

/** A stage's chapters as proportional segments, as the plan strip on Today. */
function StageStrip({ chapters, currentId }: { chapters: ChapterState[]; currentId: string }) {
	return (
		<div className="q-strip" style={{ height: 10, marginTop: 0 }} aria-hidden="true">
			{chapters.map((ch) => {
				const mark = markOf(ch, ch.id === currentId);
				return <span key={ch.id} className={cn("q-seg", mark === "done" && "done", mark === "next" && "next", mark === "locked" && "locked")} style={{ flex: Math.max(1, ch.total) }} />;
			})}
		</div>
	);
}

interface ClimbProps {
	state: CurriculumState | null;
	next?: string;
	mode?: "compact" | "full";
	goalLevel: string;
	goals?: ReadonlySet<string>;
	weak?: WeakSpotSummary[];
	exams?: Record<string, ExamSummary>;
	busy?: boolean;
	onTutor: (unit: UnitState) => void;
	onScene: (scene: string, unit: UnitState) => void;
}

export function Climb({ state, next, mode = "compact", goalLevel, goals, weak, exams, busy = false, onTutor, onScene }: ClimbProps) {
	const weakBy = new Map((weak ?? []).map((w) => [w.unit as string, w]));
	const currentRef = useRef<HTMLElement>(null);
	// The whole list is tall: open it where the learner stands.
	useEffect(() => {
		if (mode === "full") currentRef.current?.scrollIntoView({ block: "center" });
	}, [mode]);
	if (!state) return <ClimbSkeleton compact={mode === "compact"} />;
	const currentStage = STAGES.find((s) => s.level === state.level) ?? STAGES[0]!;
	const stages: Stage[] = mode === "compact" ? [currentStage] : [...STAGES];
	const chapterUnits = (ch: ChapterState) => (
		<ol className="flex flex-col gap-0.5" data-testid={`climb-units-${ch.id}`}>
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
	);

	return (
		<div className="flex flex-col gap-10" data-testid="climb">
			{stages.map((stage) => {
				const chapters = state.chapters.filter((c) => c.stage === stage.id);
				const done = chapters.reduce((n, c) => n + c.doneCount, 0);
				const total = chapters.reduce((n, c) => n + c.total, 0);
				const current = stage.id === currentStage.id;
				const reached = chapters.some((c) => c.open);
				const goal = stage.level === goalLevel;
				return (
					<section key={stage.id} ref={current ? currentRef : undefined} className={cn(!reached && "opacity-80")} data-testid={`stage-${stage.id}`} aria-labelledby={`stage-${stage.id}-title`}>
						<h2 id={`stage-${stage.id}-title`} className="q-sh">
							<span className={cn("q-pill", !current && "grey")}>{stage.level}</span>
							{stage.title}
							<small className="q-num">
								{done} of {total} units{goal ? " · your goal" : ""}
							</small>
						</h2>
						{mode === "full" && <p className="-mt-1 mb-3 max-w-2xl text-[13px] text-ink-3">{stage.blurb}</p>}
						<StageStrip chapters={chapters} currentId={state.current} />
						<ol className="mt-4 flex flex-col gap-2">
							{chapters.map((ch, i) => (
								<ChapterCard key={ch.id} chapter={ch} index={i} previous={chapters[i - 1]} current={ch.id === state.current} defaultOpen={mode === "compact" ? ch.id === state.current : ch.id === state.current || (ch.open && !ch.done)}>
									{chapterUnits(ch)}
								</ChapterCard>
							))}
						</ol>
					</section>
				);
			})}
			{mode === "compact" && (
				<Link href="/curriculum" className="-mt-4 inline-flex items-center gap-1.5 px-1 text-xs font-semibold text-ink-3 hover:text-ink-2" data-testid="climb-whole">
					<MapIcon className="size-3.5" strokeWidth={1.6} />
					See the whole climb
				</Link>
			)}
		</div>
	);
}

/** A chapter's card: title, where it stands, its units behind a fold (open
 *  where the work is). */
function ChapterCard({ chapter: ch, index, previous, current, defaultOpen, children }: { chapter: ChapterState; index: number; previous?: ChapterState; current: boolean; defaultOpen: boolean; children: React.ReactNode }) {
	const [open, setOpen] = useState(defaultOpen);
	const sub = ch.open ? `${ch.doneCount} of ${ch.total} units · ${ch.tagline}` : previous?.open && !previous.done ? `Opens after ${previous.title}` : ch.tagline;
	return (
		<li className={cn("q-card", current && "shadow-[var(--q-raise),inset_0_0_0_1.5px_var(--q-teal-line)]")} data-testid={`chapter-${ch.id}`}>
			<button type="button" onClick={() => setOpen((o) => !o)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-well" aria-expanded={open}>
				<ChapterMark mark={markOf(ch, current)} label={index + 1} />
				<span className="min-w-0 flex-1">
					<span className={cn("block text-sm font-semibold", ch.open || ch.done ? "text-foreground" : "text-ink-4")}>{ch.title}</span>
					<span className="block truncate text-xs text-ink-3">{sub}</span>
				</span>
				{open ? <ChevronDownIcon className="size-4 shrink-0 text-ink-3" strokeWidth={1.6} /> : <ChevronRightIcon className="size-4 shrink-0 text-ink-3" strokeWidth={1.6} />}
			</button>
			{open && <div className="px-2 pb-2">{children}</div>}
		</li>
	);
}

/** The same shape while the state loads, so nothing jumps (CLS 0). */
function ClimbSkeleton({ compact }: { compact: boolean }) {
	return (
		<div aria-busy="true" aria-label="Loading your climb" data-testid="climb-loading">
			<div className={cn("w-full animate-pulse rounded-xl bg-well", compact ? "h-72" : "h-96")} />
		</div>
	);
}
