"use client";

/**
 * "Where you're heading" (LangHarness, 2026-10-29) — the projected line in
 * the hours sheet: a Hours / Units / Words switch, the headline, the chart
 * and a minutes-a-day slider that redraws it with a slower and a faster
 * scenario beside it. The slider only asks "what if"; it never changes the
 * saved plan (that is the Plan page).
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { TrajectoryChart, trajectoryHeadline } from "@/components/trajectory-chart";
import { MAX_MINUTES, measuredPace, MIN_WORD_SNAPSHOTS, trajectory, TRAJECTORY_METRICS, type Cefr, type Trajectory, type TrajectoryInput, type TrajectoryMetric } from "@/src/core";

/** What the line assumes about the payoff of an hour, said plainly. */
function rateLine(t: Trajectory): string {
	const per = t.perPracticeHour;
	if (t.metric === "hours") {
		return t.basis === "measured" ? `Lately an hour of practice has earned about ${per.toFixed(1)} map hours.` : "Until there is a couple of weeks of history, an hour of practice counts as one map hour.";
	}
	if (t.metric === "units") {
		return t.basis === "measured" ? `Lately ${per.toFixed(2)} units for every hour of practice.` : "Estimated from lessons per hour until there is a couple of weeks of history.";
	}
	return t.basis === "measured" ? `Lately about ${Math.round(per)} new words for every hour of practice.` : "Not enough practice yet to say how fast words arrive.";
}

export function TrajectorySection({ input, target }: { input: TrajectoryInput; target: Cefr }) {
	const [metric, setMetric] = useState<TrajectoryMetric>("hours");
	const [override, setOverride] = useState<number | null>(null);
	const now = useMemo(() => new Date(), []);
	const pace = useMemo(() => measuredPace(input.days, input.goalMinutes, input.goalDays), [input]);
	const minutes = override ?? pace.minutesPerDay;
	const maxSlider = Math.min(MAX_MINUTES, Math.max(120, pace.minutesPerDay * 2, input.goalMinutes * 2));

	const main = useMemo(() => trajectory(input, metric, { minutesPerDay: minutes, daysPerWeek: pace.daysPerWeek }), [input, metric, minutes, pace.daysPerWeek]);
	const span = main.future.at(-1)?.day;
	const scenarios = useMemo(() => {
		const at = (m: number) => trajectory(input, metric, { minutesPerDay: m, daysPerWeek: pace.daysPerWeek }, span);
		return [
			{ label: "slower", t: at(Math.max(5, Math.round(minutes / 2))) },
			{ label: "faster", t: at(Math.min(MAX_MINUTES, Math.round(minutes * 1.5))) },
		];
	}, [input, metric, minutes, pace.daysPerWeek, span]);

	const snapshots = input.days.filter((d) => d.words !== null).length;
	const edited = override !== null && override !== pace.minutesPerDay;

	return (
		<section className="mt-5 rounded-2xl border bg-background/40 p-4" aria-labelledby="heading-title" data-testid="trajectory-section">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 id="heading-title" className="font-ui text-base font-black text-foreground">
					Where you&apos;re heading
				</h3>
				<div className="flex rounded-lg border p-0.5" role="group" aria-label="Measure">
					{TRAJECTORY_METRICS.map((m) => (
						<button key={m.id} type="button" aria-pressed={metric === m.id} onClick={() => setMetric(m.id)} className={cn("rounded-md px-2.5 py-1 font-ui text-xs font-bold", metric === m.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")} data-testid={`trajectory-${m.id}`}>
							{m.title}
						</button>
					))}
				</div>
			</div>

			<p className="mt-2 font-ui text-xl font-black text-foreground" data-testid="trajectory-headline">
				{trajectoryHeadline(main, now, target)}
			</p>
			<p className="font-prose text-sm text-muted-foreground">
				{pace.measured ? "At your pace of the last two weeks" : "At your planned pace, until a week of study is on record"}: {minutes} min on {pace.daysPerWeek} days a week.
			</p>

			{main.ready && (
				<p className="font-prose text-sm text-muted-foreground" data-testid="trajectory-rate">
					{rateLine(main)}
				</p>
			)}

			{main.ready ? (
				<div className="mt-3">
					<TrajectoryChart t={main} now={now} scenarios={scenarios} targetLevel={target} />
				</div>
			) : (
				<p className="mt-3 rounded-xl bg-accent/60 px-4 py-6 text-center font-prose text-sm text-muted-foreground" role="status">
					{metric === "words" ? `Word counts are saved once a day from now on: ${Math.min(snapshots, MIN_WORD_SNAPSHOTS)} of ${MIN_WORD_SNAPSHOTS} days so far. The line appears when there are enough.` : "No lessons on record yet. Finish one and the line starts."}
				</p>
			)}

			<div className="mt-3 flex flex-wrap items-center gap-3">
				<label htmlFor="trajectory-minutes" className="font-ui text-sm font-bold text-foreground">
					What if I did
				</label>
				<input id="trajectory-minutes" type="range" min={5} max={maxSlider} step={5} value={Math.min(maxSlider, minutes)} onChange={(e) => setOverride(Number(e.target.value))} className="min-w-40 flex-1 accent-[var(--lh-go)]" data-testid="trajectory-slider" />
				<span className="w-24 font-ui text-sm tabular-nums text-foreground">{minutes} min a day</span>
				{edited && (
					<button type="button" onClick={() => setOverride(null)} className="font-ui text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
						Back to my pace
					</button>
				)}
			</div>
			<p className="mt-2 font-prose text-xs text-muted-foreground">An estimate: the line carries your recent pace forward, and the solid part is what your days recorded (earlier days are pieced together from your practice). The slider only shows what a different pace would do; it doesn&apos;t change your plan.</p>
		</section>
	);
}
