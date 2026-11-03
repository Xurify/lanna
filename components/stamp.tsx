"use client";

/**
 * Stamps — turistické známky (LangHarness, 2026-11-02; E31,
 * docs/research/gamification.md). The round wooden stamp hikers collect at
 * every Slovak peak and hut, as the app's record of outcomes: a chapter
 * done, a level climbed, a week of days, a thousand words known.
 *
 * One stamp is a flat disc in the card color with a gold rim once earned;
 * before that a dashed rim with a gold arc that fills as the count grows
 * (the goal gradient: the nearer, the harder people push). No gradients,
 * no shine: the trail design's surfaces (E30).
 */

import type { ComponentType } from "react";
import Link from "next/link";
import { BookAIcon, BookOpenIcon, CheckCheckIcon, FlagIcon, FootprintsIcon, GraduationCapIcon, HeadphonesIcon, HourglassIcon, MicIcon, MountainSnowIcon, RepeatIcon, RotateCcwIcon, SignpostIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { nextStamps, recentStamps, STRANDS, type StampKind, type StampState } from "@/src/core";

const ICON: Record<Exclude<StampKind, "balance">, ComponentType<{ className?: string; strokeWidth?: number }>> = {
	first: FootprintsIcon,
	chapter: SignpostIcon,
	summit: MountainSnowIcon,
	streak: FlagIcon,
	words: BookAIcon,
	reviews: RepeatIcon,
	perfect: CheckCheckIcon,
	comeback: RotateCcwIcon,
	stories: BookOpenIcon,
	scenes: MicIcon,
	listens: HeadphonesIcon,
	blitz: ZapIcon,
	hours: HourglassIcon,
	exams: GraduationCapIcon,
};

/** One bar per strand, for the balanced-week stamp. */
function FourMarks({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" className={className} aria-hidden="true">
			{STRANDS.map((s, i) => (
				<rect key={s.id} x={3} y={3 + i * 5} width={18} height={3.2} rx={1} fill="currentColor" />
			))}
		</svg>
	);
}

const SIZE = { sm: 48, md: 72, lg: 112 } as const;

export function StampDisc({ state, size = "md", pressed = false, className }: { state: StampState; size?: keyof typeof SIZE; pressed?: boolean; className?: string }) {
	const px = SIZE[size];
	const earned = !!state.earned;
	const stroke = size === "lg" ? 4 : 3;
	const r = (px - stroke) / 2;
	const c = 2 * Math.PI * r;
	const Icon = state.kind === "balance" ? FourMarks : ICON[state.kind];
	const iconCls = size === "lg" ? "size-11" : size === "sm" ? "size-5" : "size-7";
	return (
		<span
			className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", pressed && "lh-stamp", className)}
			style={{ width: px, height: px }}
			data-testid={`stamp-${state.id}`}
			data-earned={earned ? "true" : "false"}
		>
			<svg width={px} height={px} className="absolute inset-0 -rotate-90" aria-hidden="true">
				<circle cx={px / 2} cy={px / 2} r={r} fill={earned ? "var(--q-teal-wash)" : "var(--q-card)"} stroke={earned ? "var(--q-teal)" : "var(--border)"} strokeWidth={stroke} strokeDasharray={earned ? undefined : "3 5"} strokeLinecap="round" />
				{!earned && state.progress > 0 && <circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--q-teal)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - state.progress)} />}
				{earned && <circle cx={px / 2} cy={px / 2} r={r - stroke * 2.2} fill="none" stroke="var(--q-teal)" strokeOpacity={0.35} strokeWidth={1} />}
			</svg>
			<Icon className={cn("relative", iconCls, earned ? "text-teal" : "text-ink-4")} strokeWidth={2} />
			{(state.kind === "chapter" || state.kind === "summit") && state.level && size !== "sm" && (
				<span className={cn("absolute bottom-[14%] font-ui text-[9px] font-semibold leading-none tracking-wide", earned ? "text-teal" : "text-ink-4")} aria-hidden="true">
					{state.level}
				</span>
			)}
		</span>
	);
}

/** A stamp with its name under it, for the book. */
export function StampTile({ state, size = "md" }: { state: StampState; size?: "sm" | "md" }) {
	const earned = !!state.earned;
	return (
		<li className={cn("flex flex-col items-center text-center", size === "sm" ? "w-20" : "w-28")} title={`${state.name} — ${state.line}${earned ? ` · earned ${state.earned}` : state.goal > 1 ? ` · ${fmt(state.have)} of ${fmt(state.goal)}` : ""}`}>
			<StampDisc state={state} size={size} />
			<span className={cn("mt-2 line-clamp-2 font-ui text-xs font-semibold leading-tight", earned ? "text-foreground" : "text-muted-foreground")} lang="sk">
				{state.name}
			</span>
			<span className="mt-0.5 line-clamp-2 font-ui text-[11px] leading-tight text-muted-foreground">{earned ? state.line : state.goal > 1 ? `${fmt(state.have)} of ${fmt(state.goal)}` : state.line}</span>
		</li>
	);
}

function fmt(n: number): string {
	return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(1);
}

/** The whole book: summits, chapters, then the deeds, each group counted. */
export function StampBook({ stamps, className }: { stamps: StampState[]; className?: string }) {
	const groups: Array<{ id: string; title: string; size: "sm" | "md"; items: StampState[] }> = [
		{ id: "summits", title: "Summits", size: "md", items: stamps.filter((s) => s.kind === "summit") },
		{ id: "chapters", title: "Chapters", size: "sm", items: stamps.filter((s) => s.kind === "chapter") },
		{ id: "deeds", title: "On the trail", size: "md", items: stamps.filter((s) => s.kind !== "summit" && s.kind !== "chapter") },
	];
	const earned = stamps.filter((s) => s.earned).length;
	return (
		<div className={className} data-testid="stamp-book">
			<p className="font-ui text-sm font-semibold text-muted-foreground" data-testid="stamp-book-count">
				<span className="font-semibold text-foreground">{earned}</span> of {stamps.length} stamps
			</p>
			{groups
				.filter((g) => g.items.length)
				.map((g) => (
					<section key={g.id} className="mt-5" aria-label={g.title} data-testid={`stamp-group-${g.id}`}>
						<h3 className="font-ui text-xs font-semibold tracking-wide text-muted-foreground">
							{g.title} · {g.items.filter((s) => s.earned).length} of {g.items.length}
						</h3>
						<ul className="mt-3 flex flex-wrap gap-x-3 gap-y-5">
							{g.items.map((s) => (
								<StampTile key={s.id} state={s} size={g.size} />
							))}
						</ul>
					</section>
				))}
		</div>
	);
}

/** The Today card: the last stamp earned and the closest ones to come. */
export function StampsCard({ stamps, className }: { stamps: StampState[] | null; className?: string }) {
	const recent = stamps ? recentStamps(stamps, 1) : [];
	const next = stamps ? nextStamps(stamps, 3) : [];
	const earned = stamps ? stamps.filter((s) => s.earned).length : 0;
	return (
		<section className={cn("q-card p-5", className)} aria-labelledby="stamps-title" data-testid="stamps-card">
			<div className="flex items-baseline justify-between gap-3">
				<h2 id="stamps-title" className="text-lg font-semibold text-foreground">
					Stamps
				</h2>
				{stamps && (
					<Link href="/progress#stamps" className="font-ui text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="stamps-all">
						{earned} of {stamps.length} · all
					</Link>
				)}
			</div>
			{recent[0] && (
				<div className="mt-3 flex items-center gap-3" data-testid="stamps-recent">
					<StampDisc state={recent[0]} size="sm" />
					<div className="min-w-0">
						<p className="truncate font-ui text-sm font-semibold text-foreground" lang="sk">
							{recent[0].name}
						</p>
						<p className="truncate font-ui text-xs text-muted-foreground">{recent[0].line} · earned</p>
					</div>
				</div>
			)}
			{next.length > 0 && (
				<ol className={cn("flex flex-col gap-3", recent[0] ? "mt-4 border-t border-border pt-4" : "mt-3")} aria-label="Next stamps" data-testid="stamps-next">
					{next.map((s) => (
						<li key={s.id} className="flex items-center gap-3">
							<StampDisc state={s} size="sm" />
							<div className="min-w-0 flex-1">
								<p className="flex items-baseline justify-between gap-2">
									<span className="truncate font-ui text-sm font-semibold text-foreground" lang="sk">
										{s.name}
									</span>
									<span className="shrink-0 font-ui text-xs font-semibold tabular-nums text-muted-foreground">{s.goal > 1 ? `${fmt(s.have)} of ${fmt(s.goal)}` : s.line}</span>
								</p>
								<p className="truncate font-ui text-xs text-muted-foreground">{s.goal > 1 ? s.line : "Next on the trail"}</p>
								<span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-well-2" aria-hidden="true">
									<span className="block h-full rounded-full bg-teal transition-[width] duration-700" style={{ width: `${Math.max(s.progress > 0 ? 3 : 0, Math.round(s.progress * 100))}%` }} />
								</span>
							</div>
						</li>
					))}
				</ol>
			)}
			{!stamps && <p className="mt-3 font-ui text-sm text-muted-foreground">Loading…</p>}
		</section>
	);
}
