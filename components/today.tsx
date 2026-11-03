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
import { QIcon, QPie } from "@/components/quiet/icon";
import { DayRail, greeting, skDate, taskIcon, taskLabel, taskLocked, words, TASK_LABEL, type Summary } from "@/components/quiet/day-rail";
import { JumpBar } from "@/components/quiet/jump";
import { SetupDialog } from "@/components/setup-dialog";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { SettingsLink } from "@/components/settings/settings-link";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { startTutorChat } from "@/components/lesson/tutor";
import { nextTask, type Goal } from "@/components/daily-plan";
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
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const up = nextTask(s?.plan ?? null);
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

	const tasks = s?.plan.tasks ?? [];
	const done = s?.plan.done ?? 0;
	const total = s?.plan.total ?? 0;
	const left = tasks.filter((t) => !t.done).reduce((n, t) => n + t.minutes, 0);
	const locked = (t: PlanTask) => !t.done && t.via === "tutor" && keyless;
	const lockedTask = tasks.find(locked);
	const goalMin = s ? (s.pace?.goalMinutes ?? s.goal.minutesPerDay) : 30;
	const date = new Date().toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long" });
	const toGoal = s ? Math.max(0, s.dailyGoal - s.todayXp) : 0;
	const streak = s?.streak.days ?? 0;

	const weakGroups = weakSpotGroups(s?.weakSpots ?? []);
	const openMixups = (s?.mixups ?? []).filter((m) => m.status === "active");
	const balance = s?.balance ?? null;
	const behind = balance?.behind ? STRANDS.find((x) => x.id === balance.behind) : null;

	return (
		<div className="@container h-dvh" data-testid="today">
			<div className="grid h-full grid-rows-[auto_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,1fr)_376px] @6xl:grid-rows-1">
				{/* Phone and tablet: the score is a top bar, since the rail is not there. */}
				<header className="relative z-[2] flex h-[60px] items-center gap-2.5 bg-background px-4 shadow-[inset_0_-1px_0_var(--q-line)] @6xl:hidden" data-testid="today-topbar">
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
					<div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 @6xl:px-0 @6xl:pt-8">
						<div className="mx-auto w-full max-w-[720px] pb-6">
							<header className="q-rise">
								<p className="q-date first-letter:uppercase" lang="sk">
									{date}
								</p>
								<h1 className="q-hello text-[29px] @6xl:text-[34px]" lang="sk">
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
									<p className="q-line dim" style={{ marginTop: 8 }} data-testid="plan-summary">
										{done >= total && total > 0
											? `All ${total} things are done today.`
											: `${total} things today, ${done} done, about ${left} minutes left.`}
									</p>
								)}
								<div className="q-strip" role="img" aria-label={s ? `Plan: ${done} of ${total} done${up ? `, ${taskLabel(up)} is up next` : ""}${lockedTask ? `, ${taskLabel(lockedTask)} needs an AI key` : ""}` : "Plan"}>
									{(s ? tasks : []).map((t) => (
										<span
											key={t.id}
											className={cn("q-seg", t.done ? "done" : locked(t) ? "locked" : t === up && "next")}
											style={{ flex: `${t.minutes} 1 0` }}
											title={t.title}
										>
											<QIcon name={t.done ? "check" : taskIcon(t)} />
										</span>
									))}
									{!s && <span className="q-seg" style={{ flex: 1 }} />}
								</div>
								<div className="q-legend">
									<span>
										<i style={{ background: "var(--q-teal)" }} />
										{done} done
									</span>
									{up && (
										<span>
											<i style={{ boxShadow: "inset 0 0 0 1.5px var(--q-teal)" }} />
											{taskLabel(up)} is up next
										</span>
									)}
									{total - done - (up ? 1 : 0) > 0 && (
										<span>
											<i style={{ boxShadow: "inset 0 0 0 1px var(--q-line-2)" }} />
											{total - done - (up ? 1 : 0)} to go
										</span>
									)}
									{lockedTask && (
										<span>
											<i style={{ background: "repeating-linear-gradient(135deg,var(--q-well) 0 2px,var(--q-bar-hatch-b) 2px 3px)" }} />
											<em style={{ fontStyle: "normal" }}>
												<b>{taskLabel(lockedTask)}</b> needs an AI key
											</em>
										</span>
									)}
								</div>
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

							{s && (
								<section className="mt-6 q-rise" style={{ animationDelay: ".05s" }} data-testid="daily-plan" aria-label="Up next">
									<h2 className="q-sh">
										<QIcon name="arrow" />
										{up ? "Up next" : "All done for today"}
									</h2>
									{up ? <UpNext task={up} locked={locked(up)} busy={busy} onOpen={() => open(up)} meta={up.id === "review" ? reviewMeta(s) : null} /> : <AllDone minutes={s.plan.minutes} goal={goalMin} next={s.next} />}
								</section>
							)}

							{weakGroups.length > 0 && (
								<section className="mt-6 q-rise" style={{ animationDelay: ".1s" }} data-testid="weak-spots">
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
																{m.words.map((w, j) => (
																	<span key={w}>
																		{j > 0 && <s>/</s>}
																		{w}
																	</span>
																))}
															</span>
														</span>
													))}
													.
												</span>
											)}
										</p>
									)}
									<div className="q-acts" style={{ marginTop: 16 }}>
										<Link href={`/lesson?unit=${weakGroups[0]!.unit}`} className="q-btn sec t" data-testid={`weak-spot-${weakGroups[0]!.id}`}>
											<QIcon name="grammar" />
											Lesson on the {bare(weakGroups[0]!.title)}
										</Link>
										{openMixups.length > 0 && (
											<Link href="/lesson?mode=mixups" className="q-btn sec" data-testid="mixups-practice">
												<QIcon name="mix" />
												Mix-ups lesson
											</Link>
										)}
										<Link href="/mistakes" className="q-btn ghost">
											Open My mistakes <QIcon name="chev" />
										</Link>
									</div>
								</section>
							)}

							{s && balance && (
								<section className="mt-6 q-rise" style={{ animationDelay: ".15s" }} data-testid="week-card">
									<h2 className="q-sh">
										<QPie frac={goalMin > 0 ? (s.pace?.dailyAverage ?? 0) / goalMin : 0} size={14} />
										This week
										<small>
											{s.pace?.dailyAverage ?? 0} of {goalMin} min a day
										</small>
									</h2>
									<div className="grid gap-4 @2xl:grid-cols-[344px_1fr] @2xl:items-center @2xl:gap-7">
										<figure className="q-well" style={{ padding: "14px 16px 16px" }} aria-label="This week's balance" data-testid="strand-balance">
											<h4>
												Minutes by strand <small>aim: about {Math.round(STRAND_TARGET * 100)}% each</small>
											</h4>
											<Bars balance={balance} />
										</figure>
										{balance.total > 0 && (
											<div>
												<p className="q-line" data-testid="strand-advice">
													{strandAdvice(balance)}
												</p>
												{behind && (
													<div className="q-acts" style={{ marginTop: 12 }}>
														<Link href={STRAND_DOOR[behind.id].href} className="q-btn sec t">
															<QIcon name="plus" />
															Open {STRAND_DOOR[behind.id].label}
														</Link>
													</div>
												)}
											</div>
										)}
									</div>
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

				<DayRail s={s} keyless={keyless} busy={busy} onOpen={open} />
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

/** The next task as a card: its kind, its minutes, what it is, and Start. */
function UpNext({ task, locked, busy, onOpen, meta }: { task: PlanTask; locked: boolean; busy: boolean; onOpen: () => void; meta: React.ReactNode }) {
	const w = words(task);
	return (
		<article className="q-card" data-testid={`plan-next-${task.id}`}>
			<div className="q-card-head">
				<QIcon name={taskIcon(task)} />
				{taskLabel(task)}
				<span className="mins q-num">{task.minutes} min</span>
			</div>
			<div className="q-rv-body">
				<div className="min-w-0">
					<h3>{w.primary}</h3>
					{w.rest && (
						<p className="q-rv-tease" style={{ fontSize: 15 }}>
							{task.from ? `Left from ${new Date(`${task.from}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}. ` : ""}
							{w.rest}
						</p>
					)}
					{meta && <p className="q-rv-meta">{meta}</p>}
					{locked && (
						<p className="q-needs mt-2">
							<QIcon name="key" />
							Needs an AI key ·{" "}
							<SettingsLink keys className="text-ink-2 underline decoration-line-2 underline-offset-[3px]">
								Settings → API keys
							</SettingsLink>
						</p>
					)}
				</div>
				<button type="button" className="q-btn primary max-@xl:w-full" onClick={onOpen} disabled={busy || locked}>
					Start
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

function AllDone({ minutes, goal, next }: { minutes: number; goal: number; next: string }) {
	return (
		<article className="q-card" data-testid="plan-complete">
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

/** The week's minutes by strand: grey bars against the quarter mark; the strand furthest behind is teal. */
function Bars({ balance }: { balance: StrandBalance }) {
	const max = Math.max(balance.target * 2, ...STRANDS.map((x) => balance.share[x.id]));
	return (
		<div className="q-bars">
			{STRANDS.map((x) => {
				const share = balance.share[x.id];
				const pct = Math.round(share * 100);
				const hot = balance.behind === x.id;
				const solid = Math.min(share, balance.target);
				return (
					<div key={x.id} className="contents" title={`${x.title}: ${x.line} · ${balance.minutes[x.id]} min`}>
						<span className={cn("lab", hot && "hotc")}>{x.title}</span>
						<span className={cn("q-bar", hot && "hot")} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${x.title}: ${pct}% of the week`}>
							<i style={{ width: `${(solid / max) * 100}%` }} />
							{share > balance.target && <i className="over" style={{ left: `${(balance.target / max) * 100}%`, width: `${((share - balance.target) / max) * 100}%` }} />}
							<span className="target" style={{ left: `${(balance.target / max) * 100}%` }} aria-hidden="true" />
						</span>
						<span className={cn("pct q-num", hot && "hotc")}>{pct}%</span>
					</div>
				);
			})}
		</div>
	);
}

