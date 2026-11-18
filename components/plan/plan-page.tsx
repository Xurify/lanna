"use client";

/**
 * /progress — everything about the road, in one place (Lanna,
 * 2026-10-28). Xurify: the goal line on Today was crowded and its tools
 * hard to find, the date should move "seamlessly" as you tweak the time
 * you give it (the way Acorns shows when you will reach a sum), and the
 * milestones chart should say what each row is when you hover it.
 *
 * So: the goal and the re-check of the level; two sliders, minutes a day
 * and days a week, that move every date on the page as they are dragged
 * (src/core/plan.ts; nothing waits on the server) and are saved only when
 * asked; the hours to each level; the milestones; the weak spots. Today
 * keeps one line and a door here.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { TodayLink } from "@/components/today-link";
import { useRouter } from "next/navigation";
import { FlagIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { HoursSheet } from "@/components/hours-sheet";
import { Slider } from "@/components/ui/slider";
import { Timeline } from "@/components/milestones/milestones-page";
import { WeakSpots } from "@/components/daily-plan";
import { StampBook } from "@/components/stamp";
import { SourcesNote } from "@/components/sources/sources-note";
import { LevelProgress, StrandBars, StreakCalendar, WeekXpChart } from "@/components/quiet/charts";
import type { ChartData } from "@/components/quiet/chart-data";
import {
	DEFAULT_DAYS_PER_WEEK,
	estimateMilestone,
	GUIDED_HOURS,
	knownLanguages,
	LEVEL_CAN_DO,
	levelDates,
	MIN_PACE_DAYS,
	PACE_WINDOW_DAYS,
	paceEta,
	purposePhrase,
	shiftLine,
	withPlan,
	type LearnerGoal,
	type WeakSpotSummary,
} from "@/src/core";
import type { LearnerFacts, MilestoneEstimate, StampState, TrailLog } from "@/src/core";

/** The part of the milestones report (src/server/milestones.ts) the page reads. */
interface PlanReport {
	facts: LearnerFacts;
	milestones: MilestoneEstimate[];
	generatedAt: string;
}

function monthOf(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/** "45 min", "1 h 30 min". */
function clock(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	return minutes % 60 === 0 ? `${h} h` : `${h} h ${minutes % 60} min`;
}

/** Hours credited so far, as a person would say them: "2.4", "37". The
 *  credit is a sum of fractional unit hours, so the raw number can run to
 *  sixteen decimals. */
function hoursText(h: number): string {
	return h < 10 ? String(Math.round(h * 10) / 10) : String(Math.round(h));
}

const CARD = "q-card mt-5 p-5";
const H2 = "text-[13px] font-semibold text-ink-2";

export function PlanPage({
	goal,
	report,
	weak,
	stamps = null,
	log = null,
	charts = null,
}: {
	goal: LearnerGoal;
	report: PlanReport | null;
	weak: WeakSpotSummary[];
	stamps?: StampState[] | null;
	log?: TrailLog | null;
	charts?: ChartData | null;
}) {
	const router = useRouter();
	const savedMinutes = goal.minutesPerDay;
	const savedDays = goal.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK;
	const [minutes, setMinutes] = useState(savedMinutes);
	const [days, setDays] = useState(savedDays);
	const [saving, setSaving] = useState<"idle" | "saving" | "error">("idle");
	const [hoursOpen, setHoursOpen] = useState(false);

	const facts = report?.facts ?? null;
	const now = useMemo(() => new Date(report?.generatedAt ?? Date.now()), [report]);
	const hoursDone = facts?.hoursDone ?? 0;
	const dirty = minutes !== savedMinutes || days !== savedDays;

	const dates = useMemo(
		() => levelDates({ goal: goal.level, hoursDone, minutesPerDay: minutes, daysPerWeek: days, now }),
		[goal.level, hoursDone, minutes, days, now],
	);
	const savedDates = useMemo(
		() => levelDates({ goal: goal.level, hoursDone, minutesPerDay: savedMinutes, daysPerWeek: savedDays, now }),
		[goal.level, hoursDone, savedMinutes, savedDays, now],
	);
	const target = dates[dates.length - 1]!;
	const shift = dirty ? shiftLine(savedDates[savedDates.length - 1]!.days, target.days) : null;

	const milestones = useMemo(() => {
		if (!report) return [];
		const f = withPlan(report.facts, minutes, days);
		return report.milestones
			.map((m) => estimateMilestone(m.def, f, { now }))
			.sort((a, b) => (a.eta.daysPlanned ?? 1e9) - (b.eta.daysPlanned ?? 1e9));
	}, [report, minutes, days, now]);

	const paceKnown = (facts?.paceDays ?? 0) >= MIN_PACE_DAYS;
	const paceDate = facts
		? paceEta(Math.max(0, GUIDED_HOURS[goal.level] - hoursDone), facts.paceMinutes, facts.paceDays, now)
		: null;

	const save = async () => {
		setSaving("saving");
		try {
			const res = await fetch(`/api/progress?tz=${new Date().getTimezoneOffset()}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ goal: { minutesPerDay: minutes, daysPerWeek: days } }),
			});
			if (!res.ok) throw new Error(String(res.status));
			setSaving("idle");
			router.refresh();
		} catch {
			setSaving("error");
		}
	};

	const purposes = (goal.purposes ?? [])
		.map((p) =>
			p === "other" && goal.purposeNote
				? goal.purposeNote.length > 60
					? `${goal.purposeNote.slice(0, 57).trimEnd()}…`
					: goal.purposeNote
				: purposePhrase(p),
		)
		.join(", ");
	const maxMinutes = Math.max(240, savedMinutes);
	const topHours = GUIDED_HOURS[goal.level];

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lanna-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-20" data-testid="plan">
				<TodayLink />
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Progress</h1>
				<p className="q-line dim mt-1">Your goal, your pace, and when the hours add up to it.</p>

				{charts && (
					<section className="mt-6" data-testid="plan-charts" aria-label="This week">
						<h2 className="q-sh">This week</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							<WeekXpChart data={charts} className="sm:col-span-2" />
							<LevelProgress data={charts} className="!mt-0 self-start" />
							<StreakCalendar data={charts} />
							<StrandBars balance={charts.balance} className="sm:col-span-2" />
							<SourcesNote feature="plan" className="sm:col-span-2" />
						</div>
					</section>
				)}

				{/* The goal, and where the level is checked again. */}
				<section className="mt-10" data-testid="plan-goal" aria-label="Your goal">
					<h2 className="q-sh">Your goal</h2>
					<p className="text-[28px] font-semibold leading-[1.15] tracking-[-0.022em] text-foreground">{goal.level}</p>
					{purposes && <p className="mt-1 text-base text-foreground first-letter:uppercase">For {purposes}</p>}
					<p className="mt-1 max-w-[60ch] text-sm text-ink-3">{LEVEL_CAN_DO[goal.level]}</p>
					<div className="q-acts" style={{ marginTop: 14 }}>
						<Link href="/start?edit=1" className="q-btn sec" data-testid="plan-change-goal">
							Change goal
						</Link>
						<Link href="/start?edit=1&check=1" className="q-btn sec" data-testid="plan-recheck">
							Re-check my level
						</Link>
					</div>
					<p className="mt-3 text-xs text-ink-3">
						{goal.placedAt
							? `Last check: ${goal.placedLevel ?? "—"} on ${goal.placedAt.slice(0, 10)}.`
							: "No level check yet. Guided hours are credited as you finish units."}
					</p>
				</section>

				{/* The sliders: every date below moves as they do. */}
				<section className="mt-10" data-testid="plan-pace" aria-label="Your pace">
					<h2 className="q-sh">Your pace</h2>
					<p
						className="mt-2 text-3xl font-semibold tracking-[-0.028em] text-foreground"
						aria-live="polite"
						data-testid="plan-eta"
					>
						{target.days === 0
							? `${goal.level} is within reach now`
							: target.date
								? `${goal.level} around ${monthOf(target.date)}`
								: "Set some minutes to see a date"}
					</p>
					<p className="mt-1 min-h-5 text-sm text-ink-3" aria-live="polite">
						{shift ??
							(dirty
								? "About the same as your saved plan."
								: `${hoursText(hoursDone)} of ~${topHours} guided hours done · at ${clock(savedMinutes)} × ${savedDays} days a week`)}
					</p>
					{facts && (
						<p className="mt-2 text-sm font-semibold text-ink-2" data-testid="plan-gap">
							You planned {clock(savedMinutes)} a day. The last {PACE_WINDOW_DAYS} days averaged{" "}
							{clock(Math.round(facts.paceMinutes))} a day.
						</p>
					)}

					<div className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2">
						<Slider
							header
							value={minutes}
							min={5}
							max={maxMinutes}
							step={5}
							onChange={setMinutes}
							label="Minutes a day"
							valueText={clock(minutes)}
							ticks={[15, 30, 45, 60, 90, 120, 180, 240]}
							testid="plan-minutes"
							valueTestid="plan-minutes-value"
						/>
						<Slider
							header
							value={days}
							min={1}
							max={7}
							step={1}
							onChange={setDays}
							label="Days a week"
							valueText={`${days} ${days === 1 ? "day" : "days"}`}
							ticks
							testid="plan-days"
							valueTestid="plan-days-value"
						/>
					</div>

					<div className="mt-3 flex min-h-10 flex-wrap items-center justify-between gap-3">
						<p className="text-xs text-ink-3" data-testid="plan-real-pace">
							{paceKnown
								? paceDate
									? `At your real pace (${facts!.paceMinutes} min a day over the last two weeks): ${monthOf(paceDate)}.`
									: "At your real pace: no date yet."
								: `At your real pace: not enough data yet (${facts?.paceDays ?? 0} of the ${MIN_PACE_DAYS} study days it needs, out of the last ${PACE_WINDOW_DAYS}).`}
						</p>
						{dirty && (
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => {
										setMinutes(savedMinutes);
										setDays(savedDays);
									}}
									className="text-xs font-semibold text-ink-3 underline underline-offset-2 hover:text-ink-2"
								>
									Reset
								</button>
								<button
									type="button"
									onClick={() => void save()}
									disabled={saving === "saving"}
									className="q-btn primary"
									data-testid="plan-save"
								>
									{saving === "saving" && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
									Make this my plan
								</button>
							</div>
						)}
					</div>
					{saving === "error" && (
						<p className="text-xs text-miss" role="alert">
							Couldn&apos;t save. Try again.
						</p>
					)}
				</section>

				{/* The trail log: the totals, every one an outcome (src/core/stamps.ts TrailLog). */}
				{log && (
					<section className={CARD} data-testid="plan-log" aria-label="Totals">
						<h2 className={H2}>Totals</h2>
						<dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
							{[
								["Time studied", clock(log.minutes)],
								["Guided hours credited", hoursText(log.hours)],
								["Words you can recall", log.wordsKnown.toLocaleString("en-US")],
								["Days practiced", String(log.daysActive)],
								["Longest streak", `${log.longestStreak} ${log.longestStreak === 1 ? "day" : "days"}`],
								["Lessons", log.lessons.toLocaleString("en-US")],
								["Review answers", log.reviews.toLocaleString("en-US")],
								["Stories read", String(log.stories)],
								["Scenes said aloud", String(log.scenes)],
							].map(([label, value]) => (
								<div key={label}>
									<dt className="text-xs text-ink-3">{label}</dt>
									<dd className="q-num mt-0.5 text-xl font-semibold tracking-[-0.015em] text-foreground">{value}</dd>
								</div>
							))}
						</dl>
						<p className="mt-4 text-[12.5px] leading-relaxed text-ink-3" data-testid="plan-log-hours-note">
							Time studied is the time measured while you were active. Guided hours are the curriculum&apos;s own count:
							each level is worth a set number (A1 {GUIDED_HOURS.A1}, A2 {GUIDED_HOURS.A2}, B1 {GUIDED_HOURS.B1}, B2{" "}
							{GUIDED_HOURS.B2}), and each unit you finish adds its share. The two differ on purpose, so guided hours
							stay at 0 until your first unit is done.
						</p>
					</section>
				)}

				{/* The stamp book (E31): what was done, never how long it took. */}
				{stamps && stamps.length > 0 && (
					<section id="stamps" className={cn(CARD, "scroll-mt-20")} data-testid="plan-stamps" aria-label="Stamp book">
						<h2 className={H2}>Stamp book</h2>
						<p className="mt-1 text-sm text-ink-3">
							Like the wooden stamps sold at mountain huts: one for each chapter and each level, and one for each thing
							done on the way. Most stamps mark something you can now do; a few count practice you did, such as reviews,
							listens and guided hours credited for finished units. None count minutes alone.
						</p>
						<StampBook stamps={stamps} className="mt-4" />
						<SourcesNote feature="habit" className="mt-5" />
					</section>
				)}

				{/* Hours to each level at the slider's pace. */}
				<section className={CARD} data-testid="plan-hours" aria-label="Hours to each level">
					<div className="flex items-baseline justify-between gap-3">
						<h2 className={H2}>Guided hours to each level</h2>
						<button
							type="button"
							onClick={() => setHoursOpen(true)}
							className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink-2"
							data-testid="plan-hours-sheet"
						>
							How long does it take?
						</button>
					</div>
					<ol className="mt-3 flex flex-col gap-2.5">
						{dates.map((l) => {
							const done = Math.min(1, hoursDone / l.hours);
							const isGoal = l.level === goal.level;
							return (
								<li
									key={l.level}
									className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3"
									title={`${l.level}: about ${l.hours} guided hours from zero. ${l.days === 0 ? "Reached." : l.date ? `At this pace, around ${monthOf(l.date)}.` : ""}`}
								>
									<span className={cn("text-sm font-semibold", isGoal ? "text-foreground" : "text-ink-3")}>
										{l.level}
									</span>
									<span
										className="relative h-2 overflow-hidden rounded-full bg-well-2"
										style={{ width: `${Math.max(12, (l.hours / topHours) * 100)}%` }}
									>
										<span
											className={cn("absolute inset-y-0 left-0 rounded-full", "bg-teal")}
											style={{ width: `${done * 100}%` }}
										/>
									</span>
									<span className="q-num text-xs text-ink-3">
										{l.hours} h · {l.days === 0 ? "reached" : (monthOf(l.date) ?? "—")}
									</span>
								</li>
							);
						})}
					</ol>
					<p className="mt-3 text-xs text-ink-3">
						<FlagIcon className="mr-1 inline size-3 align-[-1px] text-teal" strokeWidth={1.6} />
						The filled part is the guided hours credited so far: {hoursText(hoursDone)} h.
					</p>
				</section>

				{/* When can I…?, at the slider's pace. */}
				{milestones.length > 0 && (
					<section className={CARD} data-testid="plan-milestones" aria-label="When can I…?">
						<div className="flex items-baseline justify-between gap-3">
							<h2 className={H2}>When can I…?</h2>
							<Link
								href="/milestones"
								className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink-2"
								data-testid="plan-milestones-link"
							>
								See details or add your own
							</Link>
						</div>
						<Timeline items={milestones} paceKnown={paceKnown} />
					</section>
				)}

				{weak.length > 0 && (
					<section
						className={cn(CARD, "[&>div]:mt-0 [&>div]:border-t-0 [&>div]:pt-0")}
						data-testid="plan-weak"
						aria-label="Your weak spots"
					>
						<WeakSpots weak={weak} />
					</section>
				)}

				<p className="mt-2 font-ui text-xs text-ink-3">
					Every task is built from published research.{" "}
					<Link
						href="/sources"
						className="underline decoration-line-2 underline-offset-[3px] hover:text-ink-2"
						data-testid="plan-sources-link"
					>
						See the sources
					</Link>
				</p>
			</main>
			<HoursSheet
				open={hoursOpen}
				onClose={() => setHoursOpen(false)}
				minutesPerDay={minutes}
				daysPerWeek={days}
				target={goal.level}
				hoursDone={hoursDone}
				languages={knownLanguages(goal)}
			/>
		</div>
	);
}
