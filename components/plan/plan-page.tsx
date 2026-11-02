"use client";

/**
 * /plan — everything about the road, in one place (LangHarness,
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
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, FlagIcon, LoaderCircleIcon, TargetIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { SidebarToggle } from "@/components/sidebar";
import { HoursSheet } from "@/components/hours-sheet";
import { Slider } from "@/components/plan/slider";
import { Timeline } from "@/components/milestones/milestones-page";
import { WeakSpots } from "@/components/daily-plan";
import { StampBook } from "@/components/stamp";
import { DEFAULT_DAYS_PER_WEEK, estimateMilestone, GUIDED_HOURS, knownLanguages, LEVEL_CAN_DO, levelDates, MIN_PACE_DAYS, PACE_WINDOW_DAYS, paceEta, purposePhrase, shiftLine, withPlan, type LearnerGoal, type WeakSpotSummary } from "@/src/core";
import type { LearnerFacts, MilestoneEstimate, StampState, TrailLog } from "@/src/core";

/** The part of the milestones report (src/server/milestones.ts) the page reads. */
export interface PlanReport {
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

const CARD = "mt-5 rounded-2xl border bg-card p-5";
const H2 = "font-ui text-xs font-bold tracking-wide text-muted-foreground";
const LINK_BTN = cn(SECONDARY, SMALL);

export function PlanPage({ goal, report, weak, stamps = null, log = null }: { goal: LearnerGoal; report: PlanReport | null; weak: WeakSpotSummary[]; stamps?: StampState[] | null; log?: TrailLog | null }) {
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

	const dates = useMemo(() => levelDates({ goal: goal.level, hoursDone, minutesPerDay: minutes, daysPerWeek: days, now }), [goal.level, hoursDone, minutes, days, now]);
	const savedDates = useMemo(() => levelDates({ goal: goal.level, hoursDone, minutesPerDay: savedMinutes, daysPerWeek: savedDays, now }), [goal.level, hoursDone, savedMinutes, savedDays, now]);
	const target = dates[dates.length - 1]!;
	const shift = dirty ? shiftLine(savedDates[savedDates.length - 1]!.days, target.days) : null;

	const milestones = useMemo(() => {
		if (!report) return [];
		const f = withPlan(report.facts, minutes, days);
		return report.milestones.map((m) => estimateMilestone(m.def, f, { now })).sort((a, b) => (a.eta.daysPlanned ?? 1e9) - (b.eta.daysPlanned ?? 1e9));
	}, [report, minutes, days, now]);

	const paceKnown = (facts?.paceDays ?? 0) >= MIN_PACE_DAYS;
	const paceDate = facts ? paceEta(Math.max(0, GUIDED_HOURS[goal.level] - hoursDone), facts.paceMinutes, facts.paceDays, now) : null;

	const save = async () => {
		setSaving("saving");
		try {
			const res = await fetch(`/api/progress?tz=${new Date().getTimezoneOffset()}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: { minutesPerDay: minutes, daysPerWeek: days } }) });
			if (!res.ok) throw new Error(String(res.status));
			setSaving("idle");
			router.refresh();
		} catch {
			setSaving("error");
		}
	};

	const purposes = (goal.purposes ?? []).map((p) => (p === "other" && goal.purposeNote ? (goal.purposeNote.length > 60 ? `${goal.purposeNote.slice(0, 57).trimEnd()}…` : goal.purposeNote) : purposePhrase(p))).join(", ");
	const maxMinutes = Math.max(240, savedMinutes);
	const topHours = GUIDED_HOURS[goal.level];

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-20" data-testid="plan">
				<Link href="/" className="flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground">
					<ArrowLeftIcon className="size-3.5" />
					Today
				</Link>
				<h1 className="mt-3 font-ui text-3xl font-extrabold tracking-tight text-foreground">Progress</h1>
				<p className="mt-1 font-prose text-base text-muted-foreground">Your goal, your pace, and when the hours add up to it.</p>

				{/* The goal, and where the level is checked again. */}
				<section className={CARD} data-testid="plan-goal" aria-label="Your goal">
					<h2 className={H2}>Your goal</h2>
					<div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
						{/* A floor on the text: on a phone the buttons wrap below it instead of squeezing it to a column. */}
						<div className="min-w-48 flex-1">
							<p className="flex items-center gap-2 font-ui text-2xl font-black text-foreground">
								<TargetIcon className="size-6 text-sun" aria-hidden="true" />
								{goal.level}
							</p>
							{purposes && <p className="mt-1 font-prose text-base text-foreground first-letter:uppercase">For {purposes}</p>}
							<p className="mt-1 font-prose text-sm text-muted-foreground">{LEVEL_CAN_DO[goal.level]}</p>
						</div>
						<div className="flex flex-wrap gap-2">
							<Link href="/start?edit=1" className={LINK_BTN} data-testid="plan-change-goal">
								Change goal
							</Link>
							<Link href="/start?edit=1&check=1" className={LINK_BTN} data-testid="plan-recheck">
								Re-check my level
							</Link>
						</div>
					</div>
					<p className="mt-3 font-ui text-xs text-muted-foreground">{goal.placedAt ? `Last check: ${goal.placedLevel ?? "—"} on ${goal.placedAt.slice(0, 10)}.` : "No level check yet; the map credits hours as you finish units."}</p>
				</section>

				{/* The sliders: every date below moves as they do. */}
				<section className={CARD} data-testid="plan-pace" aria-label="Your pace">
					<h2 className={H2}>Your pace</h2>
					<p className="mt-2 font-ui text-3xl font-black tracking-tight text-foreground" aria-live="polite" data-testid="plan-eta">
						{target.days === 0 ? `${goal.level} is within reach now` : target.date ? `${goal.level} around ${monthOf(target.date)}` : "Set some minutes to see a date"}
					</p>
					<p className="mt-1 min-h-5 font-ui text-sm text-muted-foreground" aria-live="polite">
						{shift ?? (dirty ? "About the same as your saved plan." : `${hoursText(hoursDone)} of ~${topHours} guided hours done · at ${clock(savedMinutes)} × ${savedDays} days a week`)}
					</p>
					{facts && (
						<p className="mt-2 font-ui text-sm font-semibold text-foreground" data-testid="plan-gap">
							You planned {clock(savedMinutes)} a day. The last {PACE_WINDOW_DAYS} days averaged {clock(Math.round(facts.paceMinutes))} a day.
						</p>
					)}

					<div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
						<div>
							<div className="flex items-baseline justify-between">
								<span className="font-ui text-sm font-bold text-foreground">Minutes a day</span>
								<span className="font-ui text-sm font-bold tabular-nums text-foreground" data-testid="plan-minutes-value">
									{clock(minutes)}
								</span>
							</div>
							<Slider value={minutes} min={5} max={maxMinutes} step={5} onChange={setMinutes} label="Minutes a day" valueText={clock(minutes)} testid="plan-minutes" />
						</div>
						<div>
							<div className="flex items-baseline justify-between">
								<span className="font-ui text-sm font-bold text-foreground">Days a week</span>
								<span className="font-ui text-sm font-bold tabular-nums text-foreground" data-testid="plan-days-value">
									{days}
								</span>
							</div>
							<Slider value={days} min={1} max={7} step={1} onChange={setDays} label="Days a week" valueText={`${days} days`} testid="plan-days" />
						</div>
					</div>

					<div className="mt-3 flex min-h-10 flex-wrap items-center justify-between gap-3">
						<p className="font-ui text-xs text-muted-foreground" data-testid="plan-real-pace">
							{paceKnown ? (paceDate ? `At your real pace (${facts!.paceMinutes} min a day over the last two weeks): ${monthOf(paceDate)}.` : "At your real pace: no date yet.") : `At your real pace: not enough data yet (${facts?.paceDays ?? 0} of the ${MIN_PACE_DAYS} study days it needs, out of the last ${PACE_WINDOW_DAYS}).`}
						</p>
						{dirty && (
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => {
										setMinutes(savedMinutes);
										setDays(savedDays);
									}}
									className="font-ui text-xs font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground"
								>
									Reset
								</button>
								<button type="button" onClick={() => void save()} disabled={saving === "saving"} className={cn(PRIMARY, SMALL)} data-testid="plan-save">
									{saving === "saving" && <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />}
									Make this my plan
								</button>
							</div>
						)}
					</div>
					{saving === "error" && (
						<p className="font-ui text-xs text-miss" role="alert">
							Couldn&apos;t save. Try again.
						</p>
					)}
				</section>

				{/* The trail log: the totals, every one an outcome (src/core/stamps.ts TrailLog). */}
				{log && (
					<section className={CARD} data-testid="plan-log" aria-label="Trail log">
						<p className="font-ui text-sm font-bold text-muted-foreground">Trail log</p>
						<dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
							{[
								["Hours on the trail", hoursText(log.hours)],
								["Words known", log.wordsKnown.toLocaleString("en-US")],
								["Days practiced", String(log.daysActive)],
								["Longest streak", `${log.longestStreak} ${log.longestStreak === 1 ? "day" : "days"}`],
								["Lessons", log.lessons.toLocaleString("en-US")],
								["Review answers", log.reviews.toLocaleString("en-US")],
								["Stories read", String(log.stories)],
								["Scenes said aloud", String(log.scenes)],
							].map(([label, value]) => (
								<div key={label}>
									<dt className="font-ui text-xs text-muted-foreground">{label}</dt>
									<dd className="mt-0.5 font-ui text-xl font-extrabold tabular-nums text-foreground">{value}</dd>
								</div>
							))}
						</dl>
					</section>
				)}

				{/* The stamp book (E31): what was done, never how long it took. */}
				{stamps && stamps.length > 0 && (
					<section id="stamps" className={cn(CARD, "scroll-mt-20")} data-testid="plan-stamps" aria-label="Stamp book">
						<p className="font-ui text-sm font-bold text-muted-foreground">Stamp book</p>
						<p className="mt-1 font-prose text-sm text-muted-foreground">Like the wooden stamps sold at every Slovak peak and hut: one for each chapter and each level, and one for each thing done on the way. A stamp marks something you can now do, never time spent.</p>
						<StampBook stamps={stamps} className="mt-4" />
					</section>
				)}

				{/* Hours to each level at the slider's pace. */}
				<section className={CARD} data-testid="plan-hours" aria-label="Hours to each level">
					<div className="flex items-baseline justify-between gap-3">
						<h2 className={H2}>Guided hours to each level</h2>
						<button type="button" onClick={() => setHoursOpen(true)} className="font-ui text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" data-testid="plan-hours-sheet">
							How long does it take?
						</button>
					</div>
					<ol className="mt-3 flex flex-col gap-2.5">
						{dates.map((l) => {
							const done = Math.min(1, hoursDone / l.hours);
							const isGoal = l.level === goal.level;
							return (
								<li key={l.level} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3" title={`${l.level}: about ${l.hours} guided hours from zero. ${l.days === 0 ? "Reached." : l.date ? `At this pace, around ${monthOf(l.date)}.` : ""}`}>
									<span className={cn("font-ui text-sm font-black", isGoal ? "text-foreground" : "text-muted-foreground")}>{l.level}</span>
									<span className="relative h-3 overflow-hidden rounded-full bg-accent" style={{ width: `${Math.max(12, (l.hours / topHours) * 100)}%` }}>
										<span className={cn("absolute inset-y-0 left-0 rounded-full", done >= 1 ? "bg-go" : "bg-sky")} style={{ width: `${done * 100}%` }} />
									</span>
									<span className="font-ui text-xs tabular-nums text-muted-foreground">
										{l.hours} h · {l.days === 0 ? "reached" : (monthOf(l.date) ?? "—")}
									</span>
								</li>
							);
						})}
					</ol>
					<p className="mt-3 font-ui text-xs text-muted-foreground">
						<FlagIcon className="mr-1 inline size-3 align-[-1px] text-flame" />
						The blue part is what the map credits so far: {hoursText(hoursDone)} h.
					</p>
				</section>

				{/* When can I…?, at the slider's pace. */}
				{milestones.length > 0 && (
					<section className={CARD} data-testid="plan-milestones" aria-label="When can I…?">
						<div className="flex items-baseline justify-between gap-3">
							<h2 className={H2}>When can I…?</h2>
							<Link href="/milestones" className="font-ui text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" data-testid="plan-milestones-link">
								Details, and add your own
							</Link>
						</div>
						<Timeline items={milestones} paceKnown={paceKnown} />
					</section>
				)}

				{weak.length > 0 && (
					<section className={cn(CARD, "[&>div]:mt-0 [&>div]:border-t-0 [&>div]:pt-0")} data-testid="plan-weak" aria-label="Your weak spots">
						<WeakSpots weak={weak} />
					</section>
				)}
			</main>
			<HoursSheet open={hoursOpen} onClose={() => setHoursOpen(false)} minutesPerDay={minutes} daysPerWeek={days} target={goal.level} hoursDone={hoursDone} languages={knownLanguages(goal)} />
		</div>
	);
}
