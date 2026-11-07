"use client";

/**
 * The climb (/curriculum): the path to the target level as a calm list.
 * Each CEFR stage is a section with a strip of its chapters (teal for done,
 * outlined for the one you are on, hairline for what is ahead, dashed for
 * what is still locked), and each chapter is a row that folds out to its
 * units. Compact mode shows only the stage you are on. The "mountain" view
 * (full mode only) reads the same data as a mountain per level beside the chapter
 * cards, highest level first.
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
import { EmptyState } from "@/components/quiet/empty-state";
import { ridgeY } from "@/components/trail";
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

const VW = 312;
const ROW = 58;
const PAD_TOP = 56;
const PAD_BOTTOM = 20;
const R = 13;
const XL = 40;
const XR = VW - 40;
const nodeX = (i: number) => (i % 2 === 0 ? XL : XR);
// The label knocks the trail out behind itself.
const HALO = { paintOrder: "stroke" as const, stroke: "var(--q-card)", strokeWidth: 5, strokeLinejoin: "round" as const };

/** One level as a mountain: the chapters are stops on a dotted trail that zigzags up the slope, a flag at the top. Solid teal behind you, dotted ahead, the climber between stops by the units done in the chapter you are on. Names only; the descriptions are in the list beside it. */
function ClimbMap({ stage, chapters, currentId, summit }: { stage: Stage; chapters: ChapterState[]; currentId: string; summit: string }) {
	const n = chapters.length;
	const H = PAD_TOP + 2 * R + Math.max(0, n - 1) * ROW + PAD_BOTTOM;
	const y = (i: number) => H - PAD_BOTTOM - R - i * ROW;
	const currentIndex = chapters.findIndex((c) => c.id === currentId);
	const reached = currentIndex >= 0 ? currentIndex : chapters.every((c) => c.done) ? n : 0;
	const summitX = nodeX(n);
	const summitY = y(n - 1) - ROW * 0.72;
	const trail = [...chapters.map((_, i) => [nodeX(i), y(i)] as const), [summitX, summitY] as const];
	const seg = (a: readonly [number, number], b: readonly [number, number]) => `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`;
	const segs = (from: number, to: number) => trail.slice(from, to).reduce<string[]>((acc, p, i, arr) => (i > 0 ? [...acc, seg(arr[i - 1]!, p)] : acc), []);
	const cur = currentIndex >= 0 ? chapters[currentIndex]! : undefined;
	// The climber stands on the way from the current stop to the next, by the share of its units done.
	const share = cur && cur.total > 0 ? Math.min(1, cur.doneCount / cur.total) : 0;
	const from = trail[Math.max(reached, 0)]!;
	const to = trail[Math.min(reached + 1, trail.length - 1)]!;
	const climber = cur && share > 0 && !cur.done ? ([from[0] + (to[0] - from[0]) * share * 0.85, from[1] + (to[1] - from[1]) * share * 0.85] as const) : null;
	const doneSegs = segs(0, Math.min(reached + 1, trail.length));
	const aheadSegs = segs(Math.max(reached, 0), trail.length);
	const stageDone = n > 0 && chapters.every((c) => c.done);
	const ridge = Array.from({ length: 25 }, (_, k) => {
		const t = k / 24;
		const x = summitX > VW / 2 ? t : 1 - t;
		return `${(t * VW).toFixed(1)} ${(PAD_TOP * 0.4 + ridgeY(x) * (H * 0.46)).toFixed(1)}`;
	});
	const doneCount = chapters.filter((c) => c.done).length;
	const alt = `${stage.level} ${stage.title}: ${n} chapters, ${doneCount} finished. ${cur ? `You are on ${cur.title}, ${cur.doneCount} of ${cur.total} units done. ` : ""}At the top: ${summit}.`;
	return (
		<div className="q-card overflow-hidden px-1 pb-1 pt-2" data-testid={`climb-stage-${stage.id}`}>
			<svg viewBox={`0 0 ${VW} ${H}`} width="100%" style={{ aspectRatio: `${VW} / ${H}` }} className="block" role="img" aria-label={alt}>
				<path d={`M 0 ${H} L ${ridge.join(" L ")} L ${VW} ${H} Z`} fill="var(--q-well)" />
				<path d={`M ${ridge.join(" L ")}`} fill="none" stroke="var(--q-ink-4)" strokeWidth={1.3} strokeLinejoin="round" />
				{aheadSegs.map((d, i) => (
					<path key={`a${i}`} d={d} fill="none" stroke="var(--q-ink-3)" strokeWidth={2} strokeDasharray="1 6" strokeLinecap="round" />
				))}
				{doneSegs.map((d, i) => (
					<path key={`d${i}`} d={d} fill="none" stroke="var(--q-teal)" strokeWidth={3} strokeLinecap="round" />
				))}
				<g transform={`translate(${summitX} ${summitY})`}>
					<circle r={4.5} fill={stageDone ? "var(--q-teal)" : "var(--q-card)"} stroke={stageDone ? "var(--q-teal)" : "var(--q-ink-2)"} strokeWidth={2} />
					<path d="M 0 -4.5 V -22 M 0 -22 H 12 L 8 -17 L 12 -12 H 0" fill={stageDone ? "var(--q-teal)" : "none"} stroke={stageDone ? "var(--q-teal)" : "var(--q-ink-2)"} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
				</g>
				<text x={summitX > VW / 2 ? summitX - 18 : summitX + 18} y={summitY + 4} textAnchor={summitX > VW / 2 ? "end" : "start"} className="fill-ink-2" fontSize={11} fontWeight={600} style={HALO}>
					{summit}
				</text>
				{chapters.map((ch, i) => {
					const cx = nodeX(i);
					const cy = y(i);
					const current = ch.id === currentId;
					const left = cx < VW / 2;
					const lx = left ? cx + R + 10 : cx - R - 10;
					const locked = !ch.open && !ch.done;
					return (
						<g key={ch.id} aria-hidden="true">
							<circle cx={cx} cy={cy} r={R} fill={ch.done ? "var(--q-teal)" : current ? "var(--q-teal-wash)" : "var(--q-card)"} stroke={ch.done ? "var(--q-teal)" : current ? "var(--q-teal)" : "var(--q-line-2)"} strokeWidth={current ? 2 : 1.5} strokeDasharray={locked ? "3 3" : undefined} />
							{ch.done ? (
								<path d={`M ${cx - 5} ${cy} l 3.5 3.5 l 6.5 -7`} fill="none" stroke="var(--q-on-teal)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
							) : locked ? (
								<g transform={`translate(${cx - 5} ${cy - 6})`} fill="none" stroke="var(--q-ink-3)" strokeWidth={1.6} strokeLinecap="round">
									<rect x="0.5" y="4.5" width="9" height="7" rx="1.5" />
									<path d="M 2.5 4.5 V 3 a 2.5 2.5 0 0 1 5 0 V 4.5" />
								</g>
							) : (
								<text x={cx} y={cy + 4.5} textAnchor="middle" fontSize={12} fontWeight={600} className={current ? "fill-teal-2" : "fill-ink-2"}>
									{i + 1}
								</text>
							)}
							<text x={lx} y={cy + 4.5} textAnchor={left ? "start" : "end"} fontSize={13} fontWeight={600} className={ch.open || ch.done ? "fill-foreground" : "fill-ink-3"} style={HALO}>
								{ch.title}
							</text>
						</g>
					);
				})}
				{climber && (
					<g aria-hidden="true">
						<circle cx={climber[0]} cy={climber[1]} r={7} fill="var(--q-card)" />
						<circle cx={climber[0]} cy={climber[1]} r={4.5} fill="var(--q-teal)" />
					</g>
				)}
			</svg>
		</div>
	);
}

/** The sign at the top of a level's trail: the level after it, or the goal. */
function summitSign(stage: Stage, goal: string): string {
	const next = STAGES[STAGES.findIndex((s) => s.id === stage.id) + 1];
	return stage.level === goal || !next ? `${stage.level} · your goal` : `${next.level} · ${next.title}`;
}

interface ClimbProps {
	view?: "chapters" | "mountain";
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

export function Climb({ state, next, view = "chapters", mode = "compact", goalLevel, goals, weak, exams, busy = false, onTutor, onScene }: ClimbProps) {
	const weakBy = new Map((weak ?? []).map((w) => [w.unit as string, w]));
	const currentRef = useRef<HTMLElement>(null);
	// The whole list is tall: open it where the learner stands.
	useEffect(() => {
		if (mode === "full") currentRef.current?.scrollIntoView({ block: "center" });
	}, [mode]);
	if (!state) return <ClimbSkeleton compact={mode === "compact"} view={view} />;
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

	if (state.chapters.length === 0) {
		return (
			<EmptyState testid="climb-empty" title="Your climb is not set up yet">
				<p>This page lists every level from A1 to your goal, with the chapters and units in each. It fills in once your level and goal are set.</p>
			</EmptyState>
		);
	}

	if (mode === "full" && view === "mountain") {
		return (
			<div className="flex flex-col gap-10" data-testid="climb" data-view="mountain">
				{[...stages].reverse().map((stage) => {
					const chapters = state.chapters.filter((c) => c.stage === stage.id);
					const done = chapters.reduce((n, c) => n + c.doneCount, 0);
					const total = chapters.reduce((n, c) => n + c.total, 0);
					const current = stage.id === currentStage.id;
					const reached = chapters.some((c) => c.open);
					return (
						<section key={stage.id} ref={current ? currentRef : undefined} className={cn("grid grid-cols-[minmax(0,1fr)] gap-6 @3xl:grid-cols-[19.5rem_minmax(0,1fr)]", !reached && "opacity-80")} data-testid={`stage-${stage.id}`} aria-labelledby={`stage-${stage.id}-title`}>
							<div>
								<h2 id={`stage-${stage.id}-title`} className="q-sh">
									<span className={cn("q-pill", !current && "grey")}>{stage.level}</span>
									{stage.title}
									<small className="q-num">
										{done} of {total} units
									</small>
								</h2>
								<ClimbMap stage={stage} chapters={chapters} currentId={state.current} summit={summitSign(stage, goalLevel)} />
								<p className="mt-3 text-[13px] text-ink-3">{stage.blurb}</p>
							</div>
							<ol className="flex flex-col gap-2">
								{chapters.map((ch, i) => (
									<ChapterCard key={ch.id} chapter={ch} index={i} previous={chapters[i - 1]} current={ch.id === state.current} defaultOpen={ch.id === state.current || (ch.open && !ch.done)}>
										{chapterUnits(ch)}
									</ChapterCard>
								))}
							</ol>
						</section>
					);
				})}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-10" data-testid="climb" data-view="chapters">
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
function ClimbSkeleton({ compact, view }: { compact: boolean; view: "chapters" | "mountain" }) {
	if (!compact && view === "mountain") {
		return (
			<div aria-busy="true" aria-label="Loading your climb" data-testid="climb-loading" className="grid grid-cols-[minmax(0,1fr)] gap-6 @3xl:grid-cols-[19.5rem_minmax(0,1fr)]">
				<div className="aspect-[312/392] w-full animate-pulse rounded-xl bg-well" />
				<div className="h-96 w-full animate-pulse rounded-xl bg-well" />
			</div>
		);
	}
	return (
		<div aria-busy="true" aria-label="Loading your climb" data-testid="climb-loading">
			<div className={cn("w-full animate-pulse rounded-xl bg-well", compact ? "h-72" : "h-96")} />
		</div>
	);
}
