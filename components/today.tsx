"use client";

/**
 * Today — the LangHarness front page, in the Quiet tool layout (redesign
 * 2026-11-02, from the mockup r3-3-quiet/home-desktop and home-phone).
 *
 * A main column and a rail. The column says how the day stands (greeting,
 * a strip with one segment per task), draws the next task as a card with
 * Start (Enter starts it), says what the answers show is weakest, and shows
 * the week's balance. The rail keeps the score and the plan as a checklist.
 * Every other door is one search away: the jump bar at the foot of the
 * column (components/quiet/jump.tsx).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { QCheck, QIcon, QPie } from "@/components/quiet/icon";
import { ProgressPanel } from "@/components/quiet/charts";
import { chartData } from "@/components/quiet/chart-data";
import { EntryRow } from "@/components/log/day-log-view";
import type { DayLog } from "@/src/core";
import { DayRail, greeting, skDate, taskIcon, taskLabel, taskLocked, words, TASK_LABEL, type Summary } from "@/components/quiet/day-rail";
import { JumpBar } from "@/components/quiet/jump";
import { SidebarToggle } from "@/components/sidebar";
import { SetupDialog } from "@/components/setup-dialog";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { SettingsLink } from "@/components/settings/settings-link";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { startTutorChat } from "@/components/lesson/tutor";
import { curriculumUnit, speakScene, STRAND_TARGET, STRANDS, strandAdvice, tutorUnitPrompt, weakSpotGroups } from "@/src/core";
import type { CurriculumState, DailyPlan as Plan, ExamSummary, MixupSummary, PlanTask, Projection, StampState, Strand, StrandBalance, TrailLog, TrajectoryInput, UnitId, UnitKind, UnitState, WeakSpotSummary } from "@/src/core";

const STRAND_DOOR: Record<Strand, { href: string; label: string }> = {
	input: { href: "/listen", label: "Listen" },
	output: { href: "/speak", label: "Speak" },
	form: { href: "/review", label: "Review" },
	fluency: { href: "/fluency?mode=fast", label: "Say it faster" },
};

/** "Verb forms" from "Grammar: Verb forms": the unit's name without its kind. */
function bare(title: string): string {
	return title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");
}

export function Today({ initialConfigured, initialSummary = null }: { initialConfigured: boolean; initialSummary?: Summary | null }) {
	const router = useRouter();
	const [s, setS] = useState<Summary | null>(initialSummary);
	const [failed, setFailed] = useState(false);
	const [dayLog, setDayLog] = useState<DayLog | null>(null);
	const [configured, setConfigured] = useState(initialConfigured);
	const [setupOpen, setSetupOpen] = useState(false);
	const [pending, setPending] = useState<null | (() => Promise<void>)>(null);
	const [busy, setBusy] = useState(false);
	const zeroKeys = useZeroKeys();
	const strongKeyless = useStrongKeyless();
	const settings = useSettingsDialog();
	const keyless = !configured || zeroKeys || strongKeyless;

	const load = useCallback(() => {
		void fetch(`/api/progress?tz=${new Date().getTimezoneOffset()}`)
			.then((r) => {
				if (!r.ok) throw new Error(String(r.status));
				return r.json() as Promise<Summary>;
			})
			.then((x) => {
				setS(x);
				setFailed(false);
			})
			.catch(() => setFailed(true));
		// Today so far: the same log the Log page shows, for today only.
		void fetch(`/api/daylog?tz=${new Date().getTimezoneOffset()}`)
			.then((r) => (r.ok ? (r.json() as Promise<DayLog>) : null))
			.then((x) => x && setDayLog(x))
			.catch(() => {});
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const hidden = (t: PlanTask) => t.via === "tutor" && keyless && !t.done;
	const tasks = (s?.plan.tasks ?? []).filter((t) => !hidden(t));
	const up = tasks.find((t) => !t.done) ?? null;
	// Enter starts the day's next step (a lesson once the plan is done).
	// Tasks that open a tutor chat start a model turn, so they wait for a click.
	const enterHref = s ? (up ? up.href : `/lesson?unit=${s.next}`) : undefined;
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Enter" || !enterHref || setupOpen) return;
			if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
			const t = e.target as HTMLElement | null;
			// A focused control answers Enter itself.
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.tagName === "A" || t.isContentEditable || t.getAttribute("role") === "button")) return;
			e.preventDefault();
			router.push(enterHref);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [enterHref, setupOpen, router]);

	/** Tutor chats need a model; without one, the setup dialog comes first. */
	const withTutor = (run: () => Promise<void>) => {
		if (keyless) {
			setPending(() => run);
			setSetupOpen(true);
			return;
		}
		setBusy(true);
		void run().catch(() => setBusy(false));
	};

	/** A tutor unit on the path: a practice session with the unit's brief. */
	const tutorUnit = (u: UnitState) => {
		const unit = curriculumUnit(u.id);
		if (!unit) return;
		withTutor(() => startTutorChat(router, { title: `Tutor: ${unit.title}`, prompt: tutorUnitPrompt(unit), activity: "tutor", unit: unit.id }));
	};
	/** The plan's speaking task: a tutor unit, or a spoken scene (/speak, a
	 *  link the row follows itself). */
	const speak = (task: PlanTask) => {
		if (task.via === "tutor" && task.unit) {
			const u = (s?.curriculum.chapters ?? []).flatMap((c) => c.units).find((x) => x.id === task.unit);
			if (u) tutorUnit(u);
		} else if (task.via === "speak") router.push(task.href ?? (task.unit ? `/speak?scene=${task.unit}` : "/speak"));
	};
	const open = (t: PlanTask) => {
		if (t.href) router.push(t.href);
		else if (!(t.via === "tutor" && keyless)) speak(t);
		else settings.open("keys");
	};

	const done = tasks.filter((t) => t.done).length;
	const total = tasks.length;
	const left = tasks.filter((t) => !t.done).reduce((n, t) => n + t.minutes, 0);
	const date = skDate();
	const toGoal = s ? Math.max(0, s.dailyGoal - s.todayXp) : 0;
	const streak = s?.streak.days ?? 0;

	const weakGroups = weakSpotGroups(s?.weakSpots ?? []);
	const openMixups = (s?.mixups ?? []).filter((m) => m.status === "active");

	return (
		<div className="@container h-dvh" data-testid="today">
			<div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,1fr)_376px] @6xl:grid-rows-1">
				{/* Phone and tablet: the score is a top bar, since the rail is not there. */}
				<header className="relative z-[2] flex h-[60px] items-center gap-2.5 bg-background px-4 shadow-[inset_0_-1px_0_var(--q-line)] @6xl:hidden" data-testid="today-topbar">
					<SidebarToggle />
					<QPie frac={s && s.dailyGoal > 0 ? s.todayXp / s.dailyGoal : 0} size={28} />
					<div className="flex min-w-0 flex-col leading-[1.2]">
						<b className="q-num text-[15px] font-semibold tracking-[-0.01em]">
							{s?.todayXp ?? 0} <span className="text-[13px] font-[450] text-ink-3">/ {s?.dailyGoal ?? 50} XP</span>
						</b>
						<small className="text-xs text-ink-3">{s ? (toGoal > 0 ? `${toGoal} to today's goal` : "Today's goal is met") : " "}</small>
					</div>
					<div className="ml-auto flex items-center rounded-[9px] bg-well-2 p-0.5" aria-label={`${streak} days in a row, level ${s?.level.level ?? 1}`}>
						<span className="inline-flex h-7 items-center gap-1.5 px-2.5 text-[13px] font-[550] text-ink-2">
							<i className="size-[9px] rounded-[3px] bg-teal" aria-hidden="true" />
							{streak} {streak === 1 ? "day" : "days"}
						</span>
						<span className="inline-flex h-7 items-center rounded-r-[7px] px-2.5 text-[13px] font-[550] text-ink-2 shadow-[inset_1px_0_0_var(--q-line-2)]">Level {s?.level.level ?? 1}</span>
					</div>
				</header>

				<main className="flex min-h-0 flex-col">
					<div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] px-4 pt-4 [mask-image:linear-gradient(to_bottom,#000_calc(100%-48px),transparent)] @6xl:px-0 @6xl:pt-8 @6xl:[mask-image:none]">
						<div className="mx-auto w-full max-w-[720px] pb-6">
							<header className="q-rise">
								<p className="q-date first-letter:uppercase" lang="sk">
									{date}
								</p>
								<h1 className="q-hello @max-6xl:!mt-1 @max-6xl:!text-[29px] @max-6xl:!leading-[1.12]" lang="sk">
									{greeting()}.{" "}
									{streak > 0 && (
										<>
											<br className="@6xl:hidden" />
											<em lang="en">
												Day {streak} in a row.
											</em>
										</>
									)}
								</h1>
								{s && (
									<p className="q-line dim @max-6xl:!text-[16px]" style={{ marginTop: 8 }} data-testid="plan-summary">
										{total > 0 && done >= total ? (
											`All ${total} things are done today.`
										) : (
											<>
												{total} things<span className="@max-6xl:hidden"> today</span>, {done} done, about {left} <span className="@max-6xl:hidden">minutes</span>
												<span className="@6xl:hidden">min</span> left.
											</>
										)}
									</p>
								)}
							</header>

							{failed && (
								<p className="mt-6 rounded-lg bg-miss-soft px-4 py-3 text-[14px] text-foreground" role="alert">
									Unable to load your progress. Check that LangHarness is still running, then{" "}
									<button type="button" className="font-[550] underline underline-offset-2" onClick={load}>
										try again
									</button>
									.
								</p>
							)}

							<section className="mt-6 q-rise @max-6xl:mt-5" style={{ animationDelay: ".05s" }} data-testid="daily-plan" aria-label="Today's plan">
								<h2 className="q-sh">
									<QIcon name="arrow" />
									Today&apos;s plan
								</h2>
								{!s && <PlanSkeleton />}
								{s && total === 0 && <AllDone minutes={s.plan.minutes} goal={s.pace?.goalMinutes ?? s.goal.minutesPerDay} next={s.next} />}
								{s && total > 0 && (
									<ol className="flex flex-col gap-2" data-testid="plan-tasks">
										{tasks.map((t) =>
											t === up ? (
												<li key={t.id} data-testid={`plan-${t.id}`} data-next="true">
													<UpNext task={t} busy={busy} onOpen={() => open(t)} meta={t.id === "review" ? reviewMeta(s) : null} />
												</li>
											) : (
												<li key={t.id} data-testid={`plan-${t.id}`}>
													<PlanRow task={t} busy={busy} onOpen={() => open(t)} />
												</li>
											),
										)}
									</ol>
								)}
								{s && total > 0 && done >= total && <AllDone minutes={s.plan.minutes} goal={s.pace?.goalMinutes ?? s.goal.minutesPerDay} next={s.next} className="mt-2" />}
							</section>

							{s && (
								<section className="mt-6 q-rise @max-6xl:mt-5" style={{ animationDelay: ".08s" }} data-testid="today-so-far" aria-label="Today so far">
									<h2 className="q-sh">
										<QIcon name="check" />
										Today so far
										<Link href="/log" className="order-3 text-[12.5px] font-[450] text-ink-3 underline decoration-[var(--q-line-2)] underline-offset-[3px] hover:text-ink-2">
											Open the log
										</Link>
									</h2>
									{dayLog && dayLog.entries.length > 0 ? (
										<ol className="divide-y divide-[var(--q-line)]">
											{dayLog.entries.slice(-4).map((e) => (
												<EntryRow key={`${e.at}-${e.kind}-${e.title}`} e={e} />
											))}
										</ol>
									) : (
										<p className="text-[14px] text-ink-3">{dayLog ? "Nothing finished yet today. Each finished task shows here with its time." : "\u00a0"}</p>
									)}
								</section>
							)}

							{weakGroups.length > 0 && (
								<section className="mt-6 q-rise @max-6xl:mt-5" style={{ animationDelay: ".1s" }} data-testid="weak-spots">
									<h2 className="q-sh">
										<QIcon name="chart" />
										From your answers
									</h2>
									<p className="q-line">
										Your weakest unit right now is the <b className="q-sk">{bare(weakGroups[0]!.title)}</b>.
									</p>
									{(weakGroups.length > 1 || openMixups.length > 0) && (
										<p className="q-sub">
											{weakGroups.length > 1 && (
												<>
													Also weak:{" "}
													{weakGroups.slice(1, 3).map((g, i) => (
														<span key={g.id}>
															{i > 0 && ", "}
															<b>{bare(g.title)}</b>
														</span>
													))}
													.{" "}
												</>
											)}
											{openMixups.length > 0 && (
												<span data-testid="mixups">
													You mix up{" "}
													{openMixups.slice(0, 3).map((m, i, arr) => (
														<span key={m.key}>
															{i > 0 && (i === arr.length - 1 ? " and " : ", ")}
															<span className="q-pair" lang="sk">
																{m.words[0]}
																<s>/</s>
																{m.words[1]}
															</span>
														</span>
													))}
													.
												</span>
											)}
										</p>
									)}
									<div className="q-acts @max-xl:[&_.q-btn]:h-10" style={{ marginTop: 16 }}>
										<Link href={`/lesson?unit=${weakGroups[0]!.unit}`} className="q-btn sec t" data-testid={`weak-spot-${weakGroups[0]!.id}`}>
											<QIcon name="grammar" />
											<span className="@max-xl:hidden">Lesson on the {bare(weakGroups[0]!.title)}</span>
											<span className="@xl:hidden">{bare(weakGroups[0]!.title).replace(/^./, (c) => c.toUpperCase())} lesson</span>
										</Link>
										{openMixups.length > 0 && (
											<Link href="/lesson?mode=mixups" className="q-btn sec" data-testid="mixups-practice">
												<QIcon name="mix" />
												<span>
													Mix-ups<span className="@max-xl:hidden"> lesson</span>
												</span>
											</Link>
										)}
										<Link href="/mistakes" className="q-btn ghost @max-xl:hidden">
											Open My mistakes <QIcon name="chev" />
										</Link>
									</div>
								</section>
							)}

							{/* On a phone the rail is not there, so its charts follow the plan. */}
							{s && (
								<section className="mt-6 q-rise @6xl:hidden" style={{ animationDelay: ".15s" }} data-testid="week-card">
									<h2 className="q-sh">
										<QPie frac={s.level.span > 0 ? s.level.into / s.level.span : 0} size={14} />
										Your progress
									</h2>
									<ProgressPanel data={chartData(s)} />
								</section>
							)}
						</div>
					</div>

					<div className="px-4 pb-3 pt-2 @6xl:px-0 @6xl:pb-5 @6xl:pt-3">
						<div className="mx-auto w-full max-w-[720px]">
							<JumpBar />
						</div>
					</div>
				</main>

				<DayRail s={s} />
			</div>

			<SetupDialog
				open={setupOpen}
				onClose={() => setSetupOpen(false)}
				onDone={() => {
					setConfigured(true);
					setSetupOpen(false);
					const run = pending;
					setPending(null);
					if (run) {
						setBusy(true);
						void run().catch(() => setBusy(false));
					}
				}}
			/>
		</div>
	);
}

/** The plan's other tasks: a state box, what to do, its kind as a word, the minutes. */
function PlanRow({ task, busy, onOpen }: { task: PlanTask; busy: boolean; onOpen: () => void }) {
	const w = words(task);
	return (
		<button type="button" onClick={onOpen} disabled={busy} className={cn("flex w-full items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-left", task.done ? "bg-transparent" : "bg-well hover:bg-well-2")}>
			<span className={cn("q-cb !mt-0 shrink-0", task.done && "!bg-teal !shadow-none")}>{task.done && <QCheck />}</span>
			<span className="min-w-0 flex-1">
				<span className={cn("block truncate text-[15px] tracking-[-0.006em]", task.done ? "text-ink-3 line-through decoration-[var(--q-dash)]" : "text-foreground")}>{w.primary}</span>
			</span>
			<span className="q-pill grey shrink-0">{taskLabel(task)}</span>
			<span className="q-num w-12 shrink-0 text-right text-[12.5px] text-ink-3">{task.minutes} min</span>
			<span className={cn("hidden w-12 shrink-0 text-right text-[12px] @xl:block", task.done ? "font-[550] text-teal-2" : "text-ink-4")}>{task.done ? "Done" : "To do"}</span>
		</button>
	);
}

function PlanSkeleton() {
	return (
		<div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading today's plan">
			<div className="q-card h-[150px] animate-pulse" />
			{[0, 1, 2].map((i) => (
				<div key={i} className="h-11 animate-pulse rounded-[10px] bg-well" />
			))}
		</div>
	);
}

/** The next task as a card: its kind, its minutes, what it is, and Start. */
function UpNext({ task, busy, onOpen, meta }: { task: PlanTask; busy: boolean; onOpen: () => void; meta: React.ReactNode }) {
	const w = words(task);
	return (
		<article className="q-card" data-testid={`plan-next-${task.id}`}>
			<div className="q-card-head">
				<QIcon name={taskIcon(task)} />
				{taskLabel(task)}
				<span className="mins q-num">{task.minutes} min</span>
			</div>
			<div className="q-rv-body @max-xl:block">
				<div className="min-w-0">
					<h3 className="@max-xl:text-[19px]">{w.primary}</h3>
					{w.rest && (
						<p className="q-rv-tease" style={{ fontSize: 15 }}>
							{task.from ? `Left from ${new Date(`${task.from}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}. ` : ""}
							{w.rest}
						</p>
					)}
					{meta && <p className="q-rv-meta">{meta}</p>}
				</div>
				<button type="button" className="q-btn primary @max-xl:mt-3.5 @max-xl:h-11 @max-xl:w-full @max-xl:text-[15px]" onClick={onOpen} disabled={busy}>
					Start<span className="@xl:hidden"> {taskLabel(task)}</span>
					<kbd className="q-kbd pointer-coarse:hidden">
						<QIcon name="enter" />
					</kbd>
				</button>
			</div>
		</article>
	);
}

/** What the Review card says under its title: the mockup's line, with the deck's own numbers. */
function reviewMeta(s: Summary): React.ReactNode {
	const known = s.wordsKnown ?? 0;
	return (
		<>
			Type it, don&apos;t pick it. <b>{s.review.due} due</b>, {known} {known === 1 ? "word" : "words"} known so far.
		</>
	);
}

function AllDone({ minutes, goal, next, className }: { minutes: number; goal: number; next: string; className?: string }) {
	return (
		<article className={cn("q-card", className)} data-testid="plan-complete">
			<div className="q-rv-body">
				<div>
					<h3>All done for today. Pekne!</h3>
					<p className="q-rv-tease" style={{ fontSize: 15 }}>
						That is {minutes} of your {goal} min goal.
					</p>
				</div>
				<Link href={`/lesson?unit=${next}`} className="q-btn sec" data-testid="plan-one-more">
					One more lesson
				</Link>
			</div>
		</article>
	);
}
