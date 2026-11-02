"use client";

/**
 * The trail design's two signatures (2026-11-02, docs/research/trail-design.md).
 *
 * TrailMark — the značka: a colored stripe between two white ones, the blaze
 * painted on trees and rocks along every Slovak hiking trail. The four
 * trail colors are the four kinds of practice (components/strand-style.ts),
 * so a task shows its kind by shape as well as by color.
 *
 * RidgeProgress — the ridge line under the greeting on Today: the whole way
 * to the target level drawn as a mountain skyline, the stretch walked in
 * solid gold, the stretch ahead dotted like a trail on a hiking map, and a
 * marker where the learner stands.
 */

import { cn } from "@/lib/utils";
import { STRAND_STYLE } from "@/components/strand-style";
import { STAGES, type CurriculumState, type Strand } from "@/src/core";

export function TrailMark({ strand, size = "md", className }: { strand: Strand; size?: "sm" | "md" | "lg"; className?: string }) {
	const w = size === "lg" ? 24 : size === "sm" ? 14 : 18;
	const h = size === "lg" ? 16 : size === "sm" ? 10 : 12;
	return (
		<svg width={w} height={h} viewBox="0 0 18 12" className={cn("shrink-0", className)} aria-hidden="true" data-testid={`trail-mark-${strand}`}>
			<rect x="0" y="0" width="18" height="12" rx="1.5" fill="var(--foreground)" />
			<rect x="0" y="4" width="18" height="4" fill={STRAND_STYLE[strand].stripe} />
		</svg>
	);
}

/** A Tatra-like skyline: x in 0..1 across, y in 0..1 (0 = the top). The
 *  highest peak sits near the end, where the goal is. */
const RIDGE: Array<[number, number]> = [
	[0, 0.86],
	[0.06, 0.7],
	[0.11, 0.78],
	[0.17, 0.52],
	[0.22, 0.62],
	[0.28, 0.4],
	[0.33, 0.55],
	[0.39, 0.3],
	[0.44, 0.47],
	[0.5, 0.36],
	[0.56, 0.58],
	[0.62, 0.26],
	[0.67, 0.42],
	[0.73, 0.14],
	[0.79, 0.33],
	[0.85, 0.2],
	[0.9, 0.45],
	[0.95, 0.3],
	[1, 0.5],
];

/** The ridge's height at `x`, by straight lines between the points. */
export function ridgeY(x: number): number {
	const t = Math.max(0, Math.min(1, x));
	for (let i = 1; i < RIDGE.length; i++) {
		const [x0, y0] = RIDGE[i - 1]!;
		const [x1, y1] = RIDGE[i]!;
		if (t <= x1) return y0 + ((t - x0) / (x1 - x0)) * (y1 - y0);
	}
	return RIDGE[RIDGE.length - 1]![1];
}

const W = 600;
const H = 56;
const px = (p: [number, number]) => `${(p[0] * W).toFixed(1)} ${(p[1] * (H - 10) + 4).toFixed(1)}`;

export interface RidgeStop {
	/** The level this stretch of the way climbs. */
	label: string;
	/** Where the stretch begins and ends, 0..1 along the way to the target level. */
	from: number;
	to: number;
}

/** The stretches of the way, one per level up to the target: each level's
 *  share of the units, in order, so the ridge can post the boundaries and
 *  name the stretches. */
export function ridgeStops(c: Pick<CurriculumState, "chapters" | "total">): RidgeStop[] {
	const order = STAGES.filter((st) => c.chapters.some((ch) => ch.stage === st.id));
	const stops: RidgeStop[] = [];
	let cum = 0;
	for (const st of order) {
		const units = c.chapters.filter((ch) => ch.stage === st.id).reduce((n, ch) => n + ch.units.length, 0);
		const from = c.total > 0 ? cum / c.total : 0;
		cum += units;
		const to = c.total > 0 ? Math.min(1, cum / c.total) : 0;
		if (to > from) stops.push({ label: st.level, from, to });
	}
	return stops;
}

export function RidgeProgress({ done, total, level, goal, stops = [], className }: { done: number; total: number; level: string; goal: string; stops?: RidgeStop[]; className?: string }) {
	const share = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
	const here: [number, number] = [share, ridgeY(share)];
	const behind = RIDGE.filter((p) => p[0] < share);
	const ahead = RIDGE.filter((p) => p[0] > share);
	const donePath = `M ${[...behind, here].map(px).join(" L ")}`;
	const aheadPath = `M ${[here, ...ahead].map(px).join(" L ")}`;
	// The marker stays whole at either edge.
	const hx = Math.max(1.4, Math.min(98.6, share * 100)).toFixed(2);
	const hy = (((ridgeY(share) * (H - 10) + 4) / H) * 100).toFixed(2);
	const posts = stops.filter((st) => st.from > 0 && st.from < 1);
	return (
		<div className={cn("relative", className)} data-testid="ridge-progress" aria-label={`${level} now, ${done} of ${total} units to ${goal}`}>
			{/* The level signs: one over each stretch of the way, the current one gold. */}
			<div className="relative h-4" aria-hidden="true">
				{stops.map((st) => (
					<span
						key={st.label}
						className={cn("absolute bottom-0 -translate-x-1/2 font-ui text-[11px] font-bold leading-none", st.label === level ? "text-sun" : "text-muted-foreground")}
						style={{ left: `${(((st.from + st.to) / 2) * 100).toFixed(2)}%` }}
						data-testid={`ridge-stop-${st.label}`}
					>
						{st.label}
					</span>
				))}
			</div>
			<div className="relative">
				<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-14 w-full overflow-visible" aria-hidden="true">
					{/* The slope under the skyline, a shade up from the page. */}
					<path d={`${aheadPath} L ${W} ${H} L 0 ${H} Z`} fill="var(--card)" />
					<path d={`${donePath} L ${(share * W).toFixed(1)} ${H} L 0 ${H} Z`} fill="var(--lh-sun)" fillOpacity={0.12} />
					{/* A post where each next level begins. */}
					{posts.map((st) => {
						const x = (st.from * W).toFixed(1);
						const y = (ridgeY(st.from) * (H - 10) + 4).toFixed(1);
						return <line key={st.label} x1={x} y1={y} x2={x} y2={-3} stroke={st.from <= share ? "var(--lh-sun)" : "var(--border)"} strokeWidth={2} vectorEffect="non-scaling-stroke" />;
					})}
					<path d={aheadPath} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
					<path d={donePath} fill="none" stroke="var(--lh-sun)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
				</svg>
				{/* The marker: where the learner stands on the way. */}
				<span className="absolute flex size-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center" style={{ left: `${hx}%`, top: `${hy}%` }} aria-hidden="true">
					<span className="absolute inset-0 rounded-full bg-sun lh-ring" />
					<span className="relative size-3.5 rounded-full border-2 border-background bg-sun" />
				</span>
			</div>
			{/* Signs at both ends. */}
			<p className="mt-1 text-right font-ui text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden="true">
				{done} of {total} units to <span className="text-foreground">{goal}</span>
			</p>
		</div>
	);
}
