"use client";

/**
 * The climb (trail design, 2026-11-02, docs/research/trail-design.md) — the
 * path to the target level drawn as a mountain. Each CEFR stage is a stretch
 * of slope, each chapter a stop at the turn of a switchback trail, read from
 * the bottom up: what is done lies below you in solid gold, what is ahead
 * runs above you as a dotted line, the way a trail is drawn on a hiking map.
 * The stop you are at wears a ring. Today shows the stage you are on
 * (compact); /curriculum shows the whole mountain (full).
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
import { ridgeY } from "@/components/trail";
import { STAGES, type ChapterState, type CurriculumState, type ExamSummary, type Stage, type UnitState, type WeakSpotSummary } from "@/src/core";

const VW = 312;
const ROW = 60;
const PAD_TOP = 64;
const PAD_BOTTOM = 24;
const R = 15;
const XL = 44;
const XR = VW - 44;
const LABEL_MAX = 24;

const nodeX = (i: number) => (i % 2 === 0 ? XL : XR);
/** Map-label halo: the text knocks the trail out behind itself. */
const HALO = { paintOrder: "stroke" as const, stroke: "var(--card)", strokeWidth: 5, strokeLinejoin: "round" as const };
const short = (s: string) => (s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1).trimEnd()}…` : s);

interface StageProps {
	stage: Stage;
	chapters: ChapterState[];
	currentId: string;
	/** The sign at the top of this stretch: the next stage, or the goal. */
	summit: string;
	picked: string | null;
	onPick?: (id: string) => void;
}

/** One stage of the mountain: its chapters on a switchback trail. */
export function ClimbStage({ stage, chapters, currentId, summit, picked, onPick }: StageProps) {
	const n = chapters.length;
	const H = PAD_TOP + 2 * R + Math.max(0, n - 1) * ROW + PAD_BOTTOM;
	const y = (i: number) => H - PAD_BOTTOM - R - i * ROW;
	const currentIndex = chapters.findIndex((c) => c.id === currentId);
	// The gold runs through every finished chapter up to the stop you stand at.
	const reached = currentIndex >= 0 ? currentIndex : chapters.every((c) => c.done) ? n : 0;
	const summitX = nodeX(n);
	const summitY = y(n - 1) - ROW * 0.72;
	const points = chapters.map((_, i) => [nodeX(i), y(i)] as const);
	const trail = [...points, [summitX, summitY] as const];
	const seg = (a: readonly [number, number], b: readonly [number, number]) => `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`;
	const doneSegs = trail.slice(0, Math.min(reached + 1, trail.length)).reduce<string[]>((acc, p, i, arr) => (i > 0 ? [...acc, seg(arr[i - 1]!, p)] : acc), []);
	const aheadSegs = trail.slice(Math.max(reached, 0)).reduce<string[]>((acc, p, i, arr) => (i > 0 ? [...acc, seg(arr[i - 1]!, p)] : acc), []);
	const doneLen = doneSegs.length ? Math.hypot(XR - XL, ROW) * doneSegs.length : 0;
	// The slope behind the trail: the skyline from trail.tsx, peak toward the summit side.
	const ridge = Array.from({ length: 25 }, (_, k) => {
		const t = k / 24;
		const x = summitX > VW / 2 ? t : 1 - t;
		return `${(t * VW).toFixed(1)} ${(PAD_TOP * 0.35 + ridgeY(x) * (H * 0.5)).toFixed(1)}`;
	});
	const stageDone = n > 0 && chapters.every((c) => c.done);
	return (
		<svg viewBox={`0 0 ${VW} ${H}`} width="100%" style={{ aspectRatio: `${VW} / ${H}` }} className="block overflow-visible font-ui" role="list" aria-label={`${stage.level} ${stage.title}: ${chapters.length} chapters`} data-testid={`climb-stage-${stage.id}`}>
			<path d={`M 0 ${H} L ${ridge.join(" L ")} L ${VW} ${H} Z`} fill="var(--accent)" fillOpacity={0.55} />
			<path d={`M ${ridge.join(" L ")}`} fill="none" stroke="var(--border)" strokeWidth={1} strokeOpacity={0.7} />
			{/* The trail: dotted ahead, solid gold behind. */}
			{aheadSegs.map((d, i) => (
				<path key={`a${i}`} d={d} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.6} strokeWidth={2} strokeDasharray="1 6" strokeLinecap="round" />
			))}
			{doneSegs.map((d, i) => (
				<path key={`d${i}`} d={d} fill="none" stroke="var(--lh-sun)" strokeWidth={3} strokeLinecap="round" className="lh-trail-draw" style={{ strokeDasharray: doneLen, ["--lh-trail-len" as string]: doneLen }} />
			))}
			{/* The summit sign: a flag where this stretch ends. */}
			<g transform={`translate(${summitX} ${summitY})`} aria-hidden="true">
				<circle r={5} fill={stageDone ? "var(--lh-sun)" : "var(--card)"} stroke={stageDone ? "var(--lh-sun)" : "var(--muted-foreground)"} strokeWidth={2} />
				<path d="M 0 -5 V -22 M 0 -22 H 12 L 8 -17 L 12 -12 H 0" fill={stageDone ? "var(--lh-sun)" : "none"} stroke={stageDone ? "var(--lh-sun)" : "var(--muted-foreground)"} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
			</g>
			<text x={summitX > VW / 2 ? summitX - 22 : summitX + 22} y={summitY - 10} textAnchor={summitX > VW / 2 ? "end" : "start"} className="fill-muted-foreground" fontSize={11} fontWeight={600} style={HALO}>
				{summit}
			</text>
			{/* The stops. */}
			{chapters.map((ch, i) => {
				const cx = nodeX(i);
				const cy = y(i);
				const current = ch.id === currentId;
				const left = cx < VW / 2;
				const lx = left ? cx + R + 12 : cx - R - 12;
				const sub = ch.done ? `${ch.total} units · done` : ch.open ? `${ch.doneCount} of ${ch.total} units` : i > 0 && chapters[i - 1]!.open && !chapters[i - 1]!.done ? `Opens after ${short(chapters[i - 1]!.title)}` : short(ch.tagline);
				const selected = picked === ch.id;
				return (
					<g
						key={ch.id}
						role="listitem"
						tabIndex={onPick ? 0 : undefined}
						onClick={onPick ? () => onPick(ch.id) : undefined}
						onKeyDown={onPick ? (e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								onPick(ch.id);
							}
						} : undefined}
						className={cn(onPick && "cursor-pointer")}
						aria-current={current ? "step" : undefined}
						aria-label={`${ch.title}: ${sub}`}
						data-testid={`climb-${ch.id}`}
					>
						{current && <circle cx={cx} cy={cy} r={R} fill="var(--lh-sun)" className="lh-ring" />}
						<circle cx={cx} cy={cy} r={R} fill={ch.done ? "var(--lh-sun)" : current ? "var(--card)" : "var(--accent)"} stroke={ch.done || current ? "var(--lh-sun)" : "var(--border)"} strokeWidth={current ? 3 : 2} />
						{ch.done ? (
							<path d={`M ${cx - 5} ${cy} l 3.5 3.5 l 6.5 -7`} fill="none" stroke="var(--lh-sun-ink)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
						) : ch.open ? (
							<text x={cx} y={cy + 4} textAnchor="middle" fontSize={12} fontWeight={800} className={current ? "fill-sun" : "fill-foreground"}>
								{i + 1}
							</text>
						) : (
							<g transform={`translate(${cx - 5} ${cy - 6})`} className="fill-none stroke-muted-foreground" strokeWidth={1.75} strokeLinecap="round">
								<rect x="0.5" y="4.5" width="9" height="7" rx="1.5" />
								<path d="M 2.5 4.5 V 3 a 2.5 2.5 0 0 1 5 0 V 4.5" />
							</g>
						)}
						<text x={lx} y={cy - 2} textAnchor={left ? "start" : "end"} fontSize={13} fontWeight={700} className={cn(ch.open || ch.done ? "fill-foreground" : "fill-muted-foreground", selected && "underline")} style={{ ...HALO, textDecorationColor: "var(--lh-sun)" }}>
							{short(ch.title)}
						</text>
						<text x={lx} y={cy + 13} textAnchor={left ? "start" : "end"} fontSize={11} fontWeight={500} className="fill-muted-foreground" style={HALO}>
							{sub}
						</text>
					</g>
				);
			})}
		</svg>
	);
}

/** The sign at the top of a stage's stretch: the stage after it, or the goal. */
function summitSign(stage: Stage, goal: string): string {
	const i = STAGES.findIndex((s) => s.id === stage.id);
	const next = STAGES[i + 1];
	if (stage.level === goal || !next) return `${stage.level} · your goal`;
	return `${next.level} · ${next.title}`;
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
	const [picked, setPicked] = useState<string | null>(null);
	const weakBy = new Map((weak ?? []).map((w) => [w.unit as string, w]));
	const currentRef = useRef<HTMLElement>(null);
	// The whole mountain is tall: open it where the learner stands.
	useEffect(() => {
		if (mode === "full") currentRef.current?.scrollIntoView({ block: "center" });
	}, [mode]);
	if (!state) return <ClimbSkeleton compact={mode === "compact"} />;
	const currentStage = STAGES.find((s) => s.level === state.level) ?? STAGES[0]!;
	const stages = mode === "compact" ? [currentStage] : [...STAGES].reverse();
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

	if (mode === "compact") {
		const chapters = state.chapters.filter((c) => c.stage === currentStage.id);
		const shown = chapters.find((c) => c.id === (picked ?? state.current)) ?? chapters.find((c) => c.id === state.current) ?? chapters[0];
		return (
			<div data-testid="climb">
				<ClimbStage stage={currentStage} chapters={chapters} currentId={state.current} summit={summitSign(currentStage, goalLevel)} picked={shown?.id ?? null} onPick={(id) => setPicked(id)} />
				{shown && (
					<div className={cn("mt-2 rounded-2xl border p-2", shown.id === state.current ? "border-sun/40 bg-sun/5" : "bg-background/40")} data-testid={`climb-chapter-${shown.id}`}>
						<div className="flex items-baseline justify-between gap-3 px-2 pt-1 pb-1.5">
							<p className="min-w-0 truncate font-ui text-sm font-bold text-foreground">{shown.title}</p>
							<p className="shrink-0 font-ui text-xs text-muted-foreground tabular-nums">{shown.open ? `${shown.doneCount} of ${shown.total} units` : "Locked"}</p>
						</div>
						{shown.open || shown.done ? chapterUnits(shown) : <p className="px-2 pb-1.5 font-ui text-xs text-muted-foreground">{shown.tagline}</p>}
					</div>
				)}
				<Link href="/curriculum" className="mt-3 flex items-center gap-1.5 px-1 font-ui text-xs font-semibold text-muted-foreground hover:text-foreground" data-testid="climb-whole">
					<MapIcon className="size-3.5" />
					See the whole climb
				</Link>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-10" data-testid="climb">
			{stages.map((stage) => {
				const chapters = state.chapters.filter((c) => c.stage === stage.id);
				const done = chapters.reduce((n, c) => n + c.doneCount, 0);
				const total = chapters.reduce((n, c) => n + c.total, 0);
				const current = stage.id === currentStage.id;
				const reached = chapters.some((c) => c.open);
				return (
					<section key={stage.id} ref={current ? currentRef : undefined} className={cn("grid gap-6 @3xl:grid-cols-[19.5rem_minmax(0,1fr)]", !reached && "opacity-80")} data-testid={`stage-${stage.id}`} aria-labelledby={`stage-${stage.id}-title`}>
						<div>
							<div className="flex items-center gap-3 px-1">
								<span className={cn("rounded-lg px-2 py-0.5 font-ui text-xs font-extrabold", current ? "bg-sun text-sun-ink" : done >= total && total > 0 ? "bg-sun/20 text-sun" : "bg-accent text-foreground/80")}>{stage.level}</span>
								<span className="min-w-0 flex-1">
									<span id={`stage-${stage.id}-title`} className="block font-ui text-base font-bold text-foreground">
										{stage.title}
									</span>
									<span className="block font-ui text-xs text-muted-foreground tabular-nums">
										{done} of {total} units
									</span>
								</span>
							</div>
							<div className="mt-3 rounded-3xl border bg-card p-3">
								<ClimbStage stage={stage} chapters={chapters} currentId={state.current} summit={summitSign(stage, goalLevel)} picked={null} />
							</div>
							<p className="mt-3 px-1 font-prose text-sm text-muted-foreground">{stage.blurb}</p>
						</div>
						<ol className="flex flex-col gap-2">
							{chapters.map((ch, i) => (
								<ChapterCard key={ch.id} chapter={ch} index={i} current={ch.id === state.current} defaultOpen={ch.id === state.current || (ch.open && !ch.done)}>
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

/** A chapter's card on the whole-mountain page: title, where it stands, its
 *  units behind a fold (open where the work is). */
function ChapterCard({ chapter: ch, index, current, defaultOpen, children }: { chapter: ChapterState; index: number; current: boolean; defaultOpen: boolean; children: React.ReactNode }) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<li className={cn("rounded-2xl border", current ? "border-sun/40 bg-sun/5" : "bg-card")} data-testid={`chapter-${ch.id}`}>
			<button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-accent/60" aria-expanded={open}>
				<span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full font-ui text-xs font-extrabold", ch.done ? "bg-sun text-sun-ink" : current ? "border-2 border-sun text-sun" : ch.open ? "bg-accent text-foreground" : "bg-accent text-muted-foreground")}>{ch.done ? "✓" : index + 1}</span>
				<span className="min-w-0 flex-1">
					<span className={cn("block font-ui text-sm font-bold", ch.open || ch.done ? "text-foreground" : "text-muted-foreground")}>{ch.title}</span>
					<span className="block truncate font-ui text-xs text-muted-foreground">{ch.open ? `${ch.doneCount} of ${ch.total} units · ${ch.tagline}` : ch.tagline}</span>
				</span>
				{open ? <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
			</button>
			{open && <div className="px-2 pb-2">{children}</div>}
		</li>
	);
}

/** The same shape while the state loads, so nothing jumps (CLS 0). */
function ClimbSkeleton({ compact }: { compact: boolean }) {
	return (
		<div aria-busy="true" aria-label="Loading your climb" data-testid="climb-loading">
			<div className={cn("w-full animate-pulse rounded-3xl bg-accent/60", compact ? "aspect-[312/372]" : "h-96")} />
			{compact && <div className="mt-2 h-40 animate-pulse rounded-2xl bg-accent/40" />}
		</div>
	);
}
