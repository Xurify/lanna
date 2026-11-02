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
import type { Strand } from "@/src/core";

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

export function RidgeProgress({ done, total, level, goal, className }: { done: number; total: number; level: string; goal: string; className?: string }) {
	const share = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
	const here: [number, number] = [share, ridgeY(share)];
	const behind = RIDGE.filter((p) => p[0] < share);
	const ahead = RIDGE.filter((p) => p[0] > share);
	const donePath = `M ${[...behind, here].map(px).join(" L ")}`;
	const aheadPath = `M ${[here, ...ahead].map(px).join(" L ")}`;
	const hx = (share * 100).toFixed(2);
	const hy = (((ridgeY(share) * (H - 10) + 4) / H) * 100).toFixed(2);
	return (
		<div className={cn("relative", className)} data-testid="ridge-progress" aria-label={`${done} of ${total} units to ${goal}`}>
			<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-14 w-full overflow-visible" aria-hidden="true">
				{/* The slope under the skyline, a shade up from the page. */}
				<path d={`${aheadPath.replace(/^M/, "M")} L ${W} ${H} L 0 ${H} Z`} fill="var(--card)" />
				<path d={`${donePath} L ${(share * W).toFixed(1)} ${H} L 0 ${H} Z`} fill="var(--lh-sun)" fillOpacity={0.1} />
				<path d={aheadPath} fill="none" stroke="var(--border)" strokeWidth={2} strokeDasharray="1 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
				<path d={donePath} fill="none" stroke="var(--lh-sun)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
			</svg>
			{/* The marker: where the learner stands on the way. */}
			<span className="absolute flex size-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center" style={{ left: `${hx}%`, top: `${hy}%` }} aria-hidden="true">
				<span className="absolute inset-0 rounded-full bg-sun lh-ring" />
				<span className="relative size-3.5 rounded-full border-2 border-background bg-sun" />
			</span>
			{/* Signs at both ends. */}
			<span className="absolute left-0 top-full mt-1 font-ui text-xs font-semibold text-muted-foreground" aria-hidden="true">
				{level} now
			</span>
			<span className="absolute right-0 top-full mt-1 font-ui text-xs font-semibold text-muted-foreground tabular-nums" aria-hidden="true">
				{done} of {total} units to <span className="text-foreground">{goal}</span>
			</span>
		</div>
	);
}
