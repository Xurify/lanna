"use client";

/**
 * The progress charts (Quiet tool): week XP against the daily goal, minutes
 * by strand, a streak calendar and level progress. They read the progress
 * summary and nothing else; an empty week or a new learner gets a plain
 * sentence in place of the chart, never a row of zeros.
 */

import { cn } from "@/lib/utils";
import { QPie } from "@/components/quiet/icon";
import { STRAND_TARGET, STRANDS, type StrandBalance } from "@/src/core";
import type { ChartData } from "@/components/quiet/chart-data";

const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dow(day: string): number {
	return new Date(`${day}T12:00:00`).getDay();
}

/** One bar a day for the last seven days; the dashed line is the day's XP goal. */
export function WeekXpChart({ data, className }: { data: ChartData; className?: string }) {
	const week = data.week;
	const total = week.reduce((n, d) => n + d.xp, 0);
	const reached = week.filter((d) => data.dailyGoal > 0 && d.xp >= data.dailyGoal).length;
	const top = Math.max(data.dailyGoal, ...week.map((d) => d.xp), 1) * 1.1;
	const H = 96;
	return (
		<figure className={cn("q-well", className)} aria-label="XP each day this week" data-testid="week-xp-chart">
			<h4>
				XP this week <small>goal {data.dailyGoal} a day</small>
			</h4>
			<div className="relative mt-4" style={{ height: H + 36 }}>
				{data.dailyGoal > 0 && (
					<div
						className="absolute inset-x-0"
						style={{ bottom: 18 + (data.dailyGoal / top) * H, borderTop: "1px dashed var(--q-ink-4)" }}
						aria-hidden="true"
					/>
				)}
				<ol className="absolute inset-x-0 bottom-0 flex items-end gap-2" style={{ height: H + 36 }}>
					{week.map((d, i) => {
						const today = i === week.length - 1;
						const hit = data.dailyGoal > 0 && d.xp >= data.dailyGoal;
						const h = d.xp > 0 ? Math.max(4, (d.xp / top) * H) : 3;
						return (
							<li
								key={d.day}
								className="flex min-w-0 flex-1 flex-col items-center justify-end"
								title={`${WEEKDAY_EN[dow(d.day)]}: ${d.xp} XP`}
							>
								<span className={cn("q-num mb-1 text-[11px]", d.xp > 0 ? "text-ink-2" : "text-transparent")}>
									{d.xp}
								</span>
								<span
									className={cn(
										"w-full max-w-7 rounded-[4px]",
										d.xp <= 0 ? "bg-well-2" : hit ? "bg-teal" : "bg-teal-line",
										today && "shadow-[0_0_0_2px_var(--q-well),0_0_0_3.5px_var(--q-teal)]",
									)}
									style={{ height: h }}
								/>
								<span className={cn("mt-1.5 h-4 text-[11px]", today ? "font-[600] text-ink-2" : "text-ink-3")}>
									{WEEKDAY[dow(d.day)]}
								</span>
							</li>
						);
					})}
				</ol>
			</div>
			<p className="mt-1 text-[12.5px] text-ink-3" data-testid="week-xp-summary">
				{total === 0
					? "No XP yet this week. A first lesson draws the first bar."
					: `${total} XP in 7 days. ${reached} of 7 days reached the goal.`}
			</p>
		</figure>
	);
}

/** The last five weeks as a grid of days, Monday first; a day is filled when anything was practiced. */
export function StreakCalendar({ data, className }: { data: ChartData; className?: string }) {
	const WEEKS = 5;
	const byDay = new Map(data.days.map((d) => [d.day, d.minutes]));
	const last = data.week.length ? data.week[data.week.length - 1]!.day : data.days.at(-1)?.day;
	if (!last) return null;
	const end = new Date(`${last}T12:00:00`);
	const mondayOffset = (end.getDay() + 6) % 7;
	// The streak counts days with any practice, measured minutes or not, so its days are filled even where no minutes were timed.
	const streakDays = new Set<string>();
	const lastXp = data.week.at(-1)?.xp ?? 0;
	for (let k = lastXp > 0 ? 0 : 1; streakDays.size < data.streak; k++) {
		const d = new Date(end);
		d.setDate(end.getDate() - k);
		streakDays.add(
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
		);
	}
	// One truth per day, the same one the XP chart above draws: inside its seven days a cell follows that day's XP (goal met, some, none); before them only minutes were kept, so older cells follow minutes. A day with timed minutes but no XP is not practice here, so the two charts never disagree.
	type Cell = { day: string; state: "future" | "none" | "some" | "goal"; label: string };
	const weekByDay = new Map(data.week.map((w) => [w.day, w.xp]));
	const cells: Cell[] = [];
	const start = new Date(end);
	start.setDate(end.getDate() - mondayOffset - (WEEKS - 1) * 7);
	for (let i = 0; i < WEEKS * 7; i++) {
		const d = new Date(start);
		d.setDate(start.getDate() + i);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		const name = `${WEEKDAY_EN[d.getDay()]} ${d.getDate()} ${d.toLocaleString("en", { month: "short" })}`;
		if (d.getTime() > end.getTime() + 12 * 3600_000) {
			cells.push({ day: key, state: "future", label: name });
			continue;
		}
		if (weekByDay.has(key)) {
			const xp = weekByDay.get(key) ?? 0;
			cells.push({
				day: key,
				state: xp <= 0 ? "none" : data.dailyGoal > 0 && xp >= data.dailyGoal ? "goal" : "some",
				label: `${name}: ${xp} XP`,
			});
			continue;
		}
		const m = Math.max(byDay.get(key) ?? 0, streakDays.has(key) ? 1 : 0);
		cells.push({
			day: key,
			state: m <= 0 ? "none" : data.goalMinutes > 0 && m >= data.goalMinutes ? "goal" : "some",
			label: `${name}: ${m > 0 ? `${Math.round(m)} min` : "no practice"}`,
		});
	}
	const active = cells.filter((c) => c.state === "some" || c.state === "goal").length;
	return (
		<figure
			className={cn("q-well", className)}
			aria-label="Days practiced in the last five weeks"
			data-testid="streak-calendar"
		>
			<h3>
				Streak <small>last 5 weeks</small>
			</h3>
			<div className="mt-3 grid grid-cols-7 gap-1.5">
				{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((w) => (
					<span key={w} className="text-center text-[11px] text-ink-3">
						{w}
					</span>
				))}
				{cells.map((c) => (
					<span
						key={c.day}
						title={c.state === "future" ? undefined : c.label}
						className={cn(
							"mx-auto aspect-square w-full max-w-6 rounded-[5px]",
							c.state === "future"
								? "bg-transparent shadow-[inset_0_0_0_1px_var(--q-line)]"
								: c.state === "goal"
									? "bg-teal"
									: c.state === "some"
										? "bg-teal-line"
										: "bg-well-2",
							c.day === last && "shadow-[0_0_0_2px_var(--q-well),0_0_0_3.5px_var(--q-teal)]",
						)}
					/>
				))}
			</div>
			<p className="q-legend" aria-hidden="true">
				<span>
					<i className="bg-teal" />
					goal met
				</span>
				<span>
					<i className="bg-teal-line" />
					some practice
				</span>
				<span>
					<i className="bg-well-2" />
					none
				</span>
			</p>
			<p className="mt-3 text-[12.5px] text-ink-3" data-testid="streak-summary">
				{active === 0
					? "No days yet. Today is the first square."
					: `${active} of the last ${cells.filter((c) => c.state !== "future").length} days practiced.`}
				{data.streak > 0 && (
					<>
						{" "}
						<b className="font-[550] text-ink-2">
							{data.streak} {data.streak === 1 ? "day" : "days"} in a row
						</b>
						{data.longestStreak && data.longestStreak > data.streak ? `, longest ${data.longestStreak}` : ""}.
					</>
				)}
			</p>
		</figure>
	);
}

/** Level progress: the ring is today's XP against the goal, the bar is the way to the next level. */
export function LevelProgress({ data, className }: { data: ChartData; className?: string }) {
	const { level, todayXp, dailyGoal } = data;
	const frac = level.span > 0 ? Math.min(1, level.into / level.span) : 0;
	const toGoal = Math.max(0, dailyGoal - todayXp);
	return (
		<div className={cn("q-score", className)} data-testid="level-progress">
			<div className="q-xp" data-testid="xp-pill">
				<QPie frac={dailyGoal > 0 ? todayXp / dailyGoal : 0} size={36} />
				<div className="v">
					<b className="q-num">
						{todayXp} <span>/ {dailyGoal} XP today</span>
					</b>
					<small>{toGoal > 0 ? `${toGoal} XP to today's goal` : "Today's goal is met"}</small>
				</div>
			</div>
			<div className="border-t border-border px-4 pb-3.5 pt-3">
				<div className="flex items-baseline justify-between">
					<b className="text-[14px] font-semibold tracking-[-0.01em]">Level {level.level}</b>
					<small className="q-num text-[12px] text-ink-3">
						{level.span - level.into} XP to level {level.level + 1}
					</small>
				</div>
				<div
					className="q-bar mt-2 hot"
					role="meter"
					aria-valuemin={0}
					aria-valuemax={level.span}
					aria-valuenow={level.into}
					aria-label={`Level ${level.level}: ${level.into} of ${level.span} XP`}
				>
					<i style={{ width: `${Math.max(frac > 0 ? 2 : 0, frac * 100)}%` }} />
				</div>
			</div>
		</div>
	);
}

/** The week's minutes by strand: grey bars against the quarter mark; the strand furthest behind is teal. */
/** Minutes as a learner reads them: "42 min", "1 h 05". */
function formatMinutes(m: number): string {
	const n = Math.round(m);
	if (n < 60) return `${n} min`;
	return `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, "0")}`;
}

export function StrandBars({ balance, className }: { balance: StrandBalance | null; className?: string }) {
	if (!balance || balance.total === 0) {
		return (
			<figure className={cn("q-well", className)} aria-label="This week's balance" data-testid="strand-balance">
				<h4>
					Minutes by strand <small>aim: about {Math.round(STRAND_TARGET * 100)}% each</small>
				</h4>
				<p className="mt-3 text-[13px] text-ink-3">
					Nothing counted yet this week. Listening, speaking, words and speed each get a bar once you have practiced.
				</p>
			</figure>
		);
	}
	const max = Math.max(balance.target * 2, ...STRANDS.map((x) => balance.share[x.id]));
	return (
		<figure className={cn("q-well", className)} aria-label="This week's balance" data-testid="strand-balance">
			<h4>
				Minutes by strand <small>{formatMinutes(balance.total)} this week</small>
			</h4>
			<div className="q-bars with-mins">
				{STRANDS.map((x) => {
					const share = balance.share[x.id];
					const pct = Math.round(share * 100);
					const hot = balance.behind === x.id;
					const solid = Math.min(share, balance.target);
					return (
						<div
							key={x.id}
							className="contents"
							title={`${x.title}: ${x.line} · ${Math.round(balance.minutes[x.id])} min`}
						>
							<span className={cn("lab", hot && "hotc")}>{x.title}</span>
							<span
								className={cn("q-bar", hot && "hot")}
								role="meter"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={pct}
								aria-label={`${x.title}: ${pct}% of the week`}
							>
								<i style={{ width: `${(solid / max) * 100}%` }} />
								{share > balance.target && (
									<i
										className="over"
										style={{
											left: `${(balance.target / max) * 100}%`,
											width: `${((share - balance.target) / max) * 100}%`,
										}}
									/>
								)}
								<span className="target" style={{ left: `${(balance.target / max) * 100}%` }} aria-hidden="true" />
							</span>
							<span className={cn("mins q-num", hot && "hotc")}>{formatMinutes(balance.minutes[x.id])}</span>
							<span className={cn("pct q-num", hot && "hotc")}>{pct}%</span>
						</div>
					);
				})}
			</div>
		</figure>
	);
}

/** All four, stacked: the rail on Today and Review, and the top of Progress on a narrow screen. */
export function ProgressPanel({ data, className }: { data: ChartData; className?: string }) {
	return (
		<div className={cn("flex flex-col gap-3", className)} data-testid="progress-panel">
			<LevelProgress data={data} />
			<WeekXpChart data={data} />
			<StreakCalendar data={data} />
			<StrandBars balance={data.balance} />
		</div>
	);
}
