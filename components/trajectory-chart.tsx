"use client";

/**
 * The projected line (LangHarness, 2026-10-29) — where the learner will be
 * if they keep this pace. A solid line for what the days show so far, a
 * dashed one forward at the pace, the level's hours as a mark, and (full
 * size) a scrub to read any day. Two sizes: a sparkline for Today, the
 * full chart in the hours sheet. Every number comes from
 * src/core/trajectory.ts; this only draws it.
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CEFR_ORDER, GUIDED_HOURS, type Cefr, type Trajectory, type TrajectoryMetric, type TrajectoryPoint } from "@/src/core";

const DAY_MS = 86_400_000;

export function monthAt(now: Date, days: number): string {
	return new Date(now.getTime() + days * DAY_MS).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function dayAt(now: Date, days: number): string {
	return new Date(now.getTime() + days * DAY_MS).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatValue(metric: TrajectoryMetric, v: number): string {
	if (metric === "hours") return `${Math.round(v)} h`;
	if (metric === "units") return `${Math.round(v)} unit${Math.round(v) === 1 ? "" : "s"}`;
	return `${Math.round(v).toLocaleString("en-GB")} words`;
}

/** The one-line answer: when the target lands, or what the pace buys. */
export function trajectoryHeadline(t: Trajectory, now: Date, targetLevel: Cefr): string {
	if (!t.ready) return t.metric === "words" ? "Collecting your first week of word counts" : "Finish a lesson to start the line";
	if (t.metric === "words") {
		const gain = Math.round(t.ratePerDay * 90);
		return gain > 0 ? `About ${gain.toLocaleString("en-GB")} more words in 3 months` : "No new words at this pace";
	}
	const what = t.metric === "hours" ? targetLevel : "Every unit to your level";
	if (t.daysToTarget === null) return `${what} doesn't get closer at this pace`;
	if (t.daysToTarget === 0) return t.metric === "hours" ? `You have the ${targetLevel} hours` : "Every unit to your level is done";
	return `${what} around ${monthAt(now, t.daysToTarget)}`;
}

function interpolate(points: readonly TrajectoryPoint[], day: number): number | null {
	if (points.length === 0) return null;
	const first = points[0]!;
	const last = points.at(-1)!;
	if (day < first.day || day > last.day) return null;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1]!;
		const b = points[i]!;
		if (day <= b.day) return b.day === a.day ? b.value : a.value + ((b.value - a.value) * (day - a.day)) / (b.day - a.day);
	}
	return last.value;
}

export interface Scenario {
	label: string;
	t: Trajectory;
}

export function TrajectoryChart({
	t,
	now,
	variant = "full",
	scenarios = [],
	targetLevel,
}: {
	t: Trajectory;
	now: Date;
	variant?: "compact" | "full";
	scenarios?: readonly Scenario[];
	targetLevel: Cefr;
}) {
	const compact = variant === "compact";
	const [hover, setHover] = useState<number | null>(null);
	const W = 560;
	const H = compact ? 84 : 240;
	const pad = compact ? { l: 2, r: 2, t: 6, b: 6 } : { l: 44, r: 14, t: 14, b: 26 };

	const geo = useMemo(() => {
		const all = [...t.past, ...t.future, ...scenarios.flatMap((s) => s.t.future)];
		const xmin = Math.min(0, t.past[0]?.day ?? 0);
		const xmax = Math.max(1, t.future.at(-1)?.day ?? 0, ...scenarios.map((s) => s.t.future.at(-1)?.day ?? 0));
		const ymax = Math.max(1, ...all.map((p) => p.value));
		return { xmin, xmax, ymax: ymax * 1.06 };
	}, [t, scenarios]);

	const x = (d: number) => pad.l + ((W - pad.l - pad.r) * (d - geo.xmin)) / (geo.xmax - geo.xmin);
	const y = (v: number) => H - pad.b - ((H - pad.t - pad.b) * v) / geo.ymax;
	const line = (pts: readonly TrajectoryPoint[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");

	// Level marks: hours only, the ones inside the drawn range.
	const marks =
		t.metric === "hours"
			? CEFR_ORDER.filter((l) => GUIDED_HOURS[l] <= geo.ymax && GUIDED_HOURS[l] > 0).map((l) => ({ label: l, value: GUIDED_HOURS[l], on: l === targetLevel }))
			: t.metric === "units" && t.target
				? [{ label: "your level", value: t.target, on: true }]
				: [];

	const nowX = x(0);
	const hoverValue = hover === null ? null : (interpolate(t.past, hover) ?? interpolate(t.future, hover));
	const ticks = compact ? [] : [geo.xmin, 0, geo.xmax].filter((d, i, a) => a.indexOf(d) === i);

	const scrub = (e: React.PointerEvent<SVGSVGElement>) => {
		const r = e.currentTarget.getBoundingClientRect();
		const px = ((e.clientX - r.left) / r.width) * W;
		const d = geo.xmin + ((px - pad.l) / (W - pad.l - pad.r)) * (geo.xmax - geo.xmin);
		setHover(Math.round(Math.max(geo.xmin, Math.min(geo.xmax, d))));
	};

	return (
		<div>
			<svg
				viewBox={`0 0 ${W} ${H}`}
				className={cn("w-full touch-pan-y", compact ? "h-auto" : "cursor-crosshair")}
				role="img"
				aria-label={`${t.metric} so far and projected at this pace. ${trajectoryHeadline(t, now, targetLevel)}.`}
				onPointerMove={compact ? undefined : scrub}
				onPointerLeave={compact ? undefined : () => setHover(null)}
				data-testid={compact ? "trajectory-compact" : "trajectory-full"}
			>
				{!compact &&
					marks.map((m) => (
						<g key={m.label}>
							<line x1={pad.l} x2={W - pad.r} y1={y(m.value)} y2={y(m.value)} stroke="var(--border)" strokeWidth={m.on ? 1.5 : 1} strokeDasharray={m.on ? undefined : "2 4"} />
							<text x={pad.l - 6} y={y(m.value) + 4} textAnchor="end" className={cn("font-ui", m.on ? "fill-foreground" : "fill-muted-foreground")} fontSize={11} fontWeight={m.on ? 600 : 500}>
								{m.label}
							</text>
						</g>
					))}
				{compact && t.metric === "hours" && marks.filter((m) => m.on).map((m) => <line key={m.label} x1={pad.l} x2={W - pad.r} y1={y(m.value)} y2={y(m.value)} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="3 4" />)}

				{t.ready && t.future.length > 1 && <path d={`${line(t.future)} L${x(t.future.at(-1)!.day).toFixed(1)} ${y(0)} L${nowX.toFixed(1)} ${y(0)} Z`} fill="var(--q-teal-wash)" />}

				{scenarios.map((s) =>
					s.t.future.length > 1 ? (
						<g key={s.label}>
							<path d={line(s.t.future)} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="2 5" strokeLinecap="round" />
							{!compact && (
								<text x={Math.min(W - pad.r, x(s.t.future.at(-1)!.day)) - 4} y={y(s.t.future.at(-1)!.value) - 5} textAnchor="end" className="fill-muted-foreground font-ui" fontSize={10}>
									{s.label}
								</text>
							)}
						</g>
					) : null,
				)}

				{t.ready && t.future.length > 1 && <path d={line(t.future)} fill="none" className="stroke-teal" strokeWidth={compact ? 2 : 2.5} strokeDasharray="6 5" strokeLinecap="round" />}
				{t.past.length > 1 && <path d={line(t.past)} fill="none" className="stroke-teal" strokeWidth={compact ? 2.5 : 3} strokeLinecap="round" strokeLinejoin="round" />}

				<line x1={nowX} x2={nowX} y1={pad.t} y2={H - pad.b} stroke="var(--border)" strokeWidth={1} />
				<circle cx={nowX} cy={y(t.now)} r={compact ? 4 : 5} className="fill-teal" stroke="var(--q-card)" strokeWidth={2} />

				{!compact &&
					ticks.map((d) => (
						<text key={d} x={x(d)} y={H - 6} textAnchor={d === geo.xmin ? "start" : d === geo.xmax ? "end" : "middle"} className="fill-muted-foreground font-ui" fontSize={11}>
							{d === 0 ? "today" : dayAt(now, d)}
						</text>
					))}

				{!compact && hover !== null && hoverValue !== null && (
					<g pointerEvents="none">
						<line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--foreground)" strokeOpacity={0.35} />
						<circle cx={x(hover)} cy={y(hoverValue)} r={4} className="fill-foreground" />
					</g>
				)}
			</svg>
			{!compact && (
				<p className="mt-1 min-h-5 font-ui text-xs text-muted-foreground" role="status" aria-live="polite">
					{hover !== null && hoverValue !== null ? (
						<>
							<b className="text-foreground">{dayAt(now, hover)}</b> · {formatValue(t.metric, hoverValue)} · {hover > 0 ? "projected" : hover === 0 ? "today" : "so far"}
						</>
					) : (
						"Move over the chart to read a day. Solid is so far; dashed is at this pace."
					)}
				</p>
			)}
		</div>
	);
}
