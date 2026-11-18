"use client";

/**
 * Today — the Lanna front page, in the Quiet tool layout (redesign
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
import { HistoryIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QIcon, QPie } from "@/components/quiet/icon";
import { CapLabel } from "@/components/ui/cap-label";
import { ProgressPanel } from "@/components/quiet/charts";
import { chartData } from "@/components/quiet/chart-data";
import { EntryRow } from "@/components/log/day-log-view";
import type { DayLog } from "@/src/core";
import { DayRail, greeting, todayDate, taskIcon, taskLabel, words, type Summary } from "@/components/quiet/day-rail";
import { SidebarToggle } from "@/components/sidebar";
import { SetupDialog } from "@/components/setup-dialog";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { useSettingsDialog } from "@/components/settings/settings-context";
import { startTutorChat } from "@/components/lesson/tutor";
import { DaySplit } from "@/components/day-split";
import { switchLanguage } from "@/components/switch-language";
import { curriculumUnit, tutorUnitPrompt, weakSpotGroups } from "@/src/core";
import type {
	AfterPlan,
	DatedSceneView,
	DayLanguage,
	LanguageDay,
	LineState,
	PlanTask,
	StageView,
	UnitState,
} from "@/src/core";
import { TodayLineRow } from "@/components/today-line-row";
import { shownDay, useHiddenLanguages } from "@/components/hidden-languages";
import { WhereYouAre } from "@/components/where-you-are";
import { OutsideListening } from "@/components/outside-listening";
import { useActiveLanguage } from "@/components/speech";
import { choosable, DayPath, type PlanStep as Step } from "@/components/day-path";
import { ChooseVideo } from "@/components/watch/choose-video";

/** Minutes a language's setup takes (four screens and the level check). */
const SETUP_MINUTES = 5;

/** "Verb forms" from "Grammar: Verb forms": the unit's name without its kind. */
function bare(title: string): string {
	return title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "");
}

export function Today({
	initialConfigured,
	initialSummary = null,
	initialDay = null,
	initialLine = null,
	initialStage = null,
	initialDated = null,
}: {
	initialConfigured: boolean;
	initialSummary?: Summary | null;
	initialDay?: LanguageDay | null;
	initialLine?: LineState | null;
	initialStage?: StageView | null;
	initialDated?: { next: DatedSceneView | null; awaitingOutcome: DatedSceneView[] } | null;
}) {
	const lang = useActiveLanguage();
	const router = useRouter();
	const line = initialLine;
	const stage = initialStage;
	const dated = initialDated;
	const soonest = dated?.awaitingOutcome[0] ?? dated?.next ?? null;
	const [s, setS] = useState<Summary | null>(initialSummary);
	const [loadedDay, setDay] = useState<LanguageDay | null>(initialDay);
	const hiddenLanguages = useHiddenLanguages();
	const day = loadedDay && shownDay(loadedDay, hiddenLanguages);
	const [splitting, setSplitting] = useState(false);
	const [switchNote, setSwitchNote] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const [dayLog, setDayLog] = useState<DayLog | null>(null);
	const [configured, setConfigured] = useState(initialConfigured);
	const [setupOpen, setSetupOpen] = useState(false);
	const [pending, setPending] = useState<null | (() => Promise<void>)>(null);
	const [busy, setBusy] = useState(false);
	const [choosingVideo, setChoosingVideo] = useState(false);
	const zeroKeys = useZeroKeys();
	const strongKeyless = useStrongKeyless();
	const settings = useSettingsDialog();
	const keyless = !configured || zeroKeys || strongKeyless;

	const closeChooser = useCallback(() => setChoosingVideo(false), []);
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
		// Every language's plan for today, when the list has more than one.
		void fetch(`/api/day?tz=${new Date().getTimezoneOffset()}`)
			.then((r) => (r.ok ? (r.json() as Promise<LanguageDay>) : null))
			.then((x) => x && setDay(x))
			.catch(() => {});
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
	// With more than one language the plan is every language's, largest share first.
	const multi = (day?.languages.length ?? 0) > 1;
	const groups = multi
		? day!.languages.map((lang) => {
				const own = lang.running ? tasks : lang.tasks.filter((t) => !hidden(t));
				const steps: Step[] = lang.setUp
					? own.map((t) => ({ key: `${lang.id}:${t.id}`, lang, task: t, minutes: t.minutes, done: t.done }))
					: [{ key: `${lang.id}:setup`, lang, task: null, minutes: SETUP_MINUTES, done: false }];
				return { lang, steps };
			})
		: null;
	const steps: Step[] = groups
		? groups.flatMap((g) => g.steps)
		: tasks.map((t) => ({ key: t.id, lang: null, task: t, minutes: t.minutes, done: t.done }));
	const up = steps.find((x) => !x.done) ?? null;
	// Enter starts the day's next step (input once the plan is done).
	// Tasks that open a tutor chat start a model turn, so they wait for a click.
	const enterable = s ? (up ? !up.task || Boolean(up.task.href) : true) : false;
	const lessonUpNext =
		steps.find((x) => !x.done && (!x.lang || x.lang.running) && x.task?.href?.startsWith("/lesson?unit="))?.task
			?.href ?? null;
	useEffect(() => {
		if (lessonUpNext) void fetch(`/api${lessonUpNext}&warm`).catch(() => {});
	}, [lessonUpNext]);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Enter" || !enterable || !s || setupOpen || choosingVideo) return;
			if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
			const t = e.target as HTMLElement | null;
			// A focused control answers Enter itself.
			if (
				t &&
				(t.tagName === "INPUT" ||
					t.tagName === "TEXTAREA" ||
					t.tagName === "BUTTON" ||
					t.tagName === "A" ||
					t.isContentEditable ||
					t.getAttribute("role") === "button")
			)
				return;
			e.preventDefault();
			if (up) start(up);
			else router.push(s.afterPlan?.step.href ?? `/lesson?unit=${s.next}`);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

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
		withTutor(() =>
			startTutorChat(router, {
				title: unit.title,
				prompt: tutorUnitPrompt(unit),
				activity: "tutor",
				unit: unit.id,
			}),
		);
	};
	/** The plan's speaking task: a tutor unit, or a spoken scene (/speak, a
	 *  link the row follows itself). */
	const speak = (task: PlanTask) => {
		if (task.via === "tutor" && task.unit) {
			const u = (s?.curriculum.chapters ?? []).flatMap((c) => c.units).find((x) => x.id === task.unit);
			if (u) tutorUnit(u);
		} else if (task.via === "speak")
			router.push(task.href ?? (task.unit ? `/speak/tutor?scene=${task.unit}` : "/speak"));
	};
	const open = (t: PlanTask) => {
		if (t.href) router.push(t.href);
		else if (!(t.via === "tutor" && keyless)) speak(t);
		else settings.open("keys");
	};
	/** A step in another language switches to it first; the page then loads
	 *  there (a tutor task, which has no page of its own, lands on Today). */
	function start(x: Step) {
		if (x.lang && !x.lang.running) {
			setBusy(true);
			setSwitchNote(null);
			void switchLanguage(x.lang.id, x.lang.english, x.task ? (x.task.href ?? "/") : "/start").catch((err: unknown) => {
				setSwitchNote(err instanceof Error ? err.message : String(err));
				setBusy(false);
			});
			return;
		}
		if (x.task) open(x.task);
		else router.push("/start");
	}

	const done = steps.filter((x) => x.done).length;
	const total = steps.length;
	const left = steps.filter((x) => !x.done).reduce((n, x) => n + x.minutes, 0);
	const renderNext = (x: Step) => {
		const elsewhere = x.lang && !x.lang.running ? x.lang : null;
		return x.task ? (
			<UpNext
				task={x.task}
				busy={busy}
				onOpen={() => start(x)}
				onChooseVideo={choosable(x) ? () => setChoosingVideo(true) : undefined}
				meta={elsewhere ? `Opens in ${elsewhere.english}.` : x.task.id === "review" && s ? reviewMeta(s) : null}
			/>
		) : (
			<SetupNext lang={x.lang!} busy={busy} onOpen={() => start(x)} />
		);
	};
	const watchTask = tasks.find((t) => t.id === "watch") ?? null;
	const date = todayDate();
	const toGoal = s ? Math.max(0, s.dailyGoal - s.todayXp) : 0;
	const streak = s?.streak.days ?? 0;

	const weakGroups = weakSpotGroups(s?.weakSpots ?? []);
	const openMixups = (s?.mixups ?? []).filter((m) => m.status === "active");

	return (
		<div className="@container h-dvh" data-own-scroll data-testid="today">
			<div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,1fr)_376px] @6xl:grid-rows-1">
				{/* Phone and tablet: the score is a top bar, since the rail is not there. */}
				<header
					className="lanna-drag lanna-wco-gutter relative z-[2] flex h-[60px] items-center gap-2.5 bg-background px-4 shadow-[inset_0_-1px_0_var(--q-line)] @6xl:hidden"
					data-testid="today-topbar"
				>
					<SidebarToggle />
					<QPie frac={s && s.dailyGoal > 0 ? s.todayXp / s.dailyGoal : 0} size={28} />
					<div className="flex min-w-0 flex-1 flex-col leading-[1.2]">
						<b className="q-num whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em]">
							{s?.todayXp ?? 0} <span className="text-[13px] font-[450] text-ink-3">/ {s?.dailyGoal ?? 50} XP</span>
						</b>
						<small className="block truncate text-xs text-ink-3">
							{s ? (toGoal > 0 ? `${toGoal} XP to today's goal` : "Today's goal is met") : " "}
						</small>
					</div>
					<div
						className="ml-auto flex shrink-0 items-center rounded-[9px] bg-well-2 p-0.5"
						aria-label={`${streak} days in a row, level ${s?.level.level ?? 1}`}
					>
						<span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] font-[550] text-ink-2">
							<i className="size-[9px] rounded-[3px] bg-teal" aria-hidden="true" />
							{streak} {streak === 1 ? "day" : "days"}
						</span>
						<span className="inline-flex h-7 items-center whitespace-nowrap rounded-r-[7px] px-2.5 text-[13px] font-[550] text-ink-2 shadow-[inset_1px_0_0_var(--q-line-2)] @max-sm:hidden">
							Level {s?.level.level ?? 1}
						</span>
					</div>
				</header>

				<main className="flex min-h-0 flex-col">
					<div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] px-4 pt-4 @6xl:px-0 @6xl:pt-8">
						<div className="mx-auto w-full max-w-[720px] pb-8">
							<header className="q-rise">
								<p className="q-date first-letter:uppercase">{date}</p>
								<h1 className="q-hello @max-6xl:!mt-1 @max-6xl:!text-[29px] @max-6xl:!leading-[1.12]">
									{greeting()}.{" "}
									{streak > 0 && (
										<>
											<br className="@6xl:hidden" />
											<em lang="en">Day {streak} in a row.</em>
										</>
									)}
								</h1>
								{s && (
									<p className="q-line dim @max-6xl:!text-[16px]" style={{ marginTop: 8 }} data-testid="plan-summary">
										{total > 0 && done >= total ? (
											`All ${total} tasks are done today.`
										) : (
											<>
												{total} tasks
												<span className="@max-6xl:hidden">
													{multi ? ` in ${day!.languages.length} languages` : ""} today
												</span>
												, {done} done, about {left} <span className="@max-6xl:hidden">minutes</span>
												<span className="@6xl:hidden">min</span> left.
											</>
										)}
									</p>
								)}
							</header>

							{failed && (
								<p className="mt-6 rounded-lg bg-miss-soft px-4 py-3 text-[14px] text-foreground" role="alert">
									Unable to load your progress. Check that Lanna is still running, then{" "}
									<button type="button" className="font-[550] underline underline-offset-2" onClick={load}>
										try again
									</button>
									.
								</p>
							)}

							{line && (
								<div className="mt-5 q-rise" style={{ animationDelay: ".04s" }} data-testid="today-line">
									<TodayLineRow line={line} />
								</div>
							)}

							<section
								className="mt-6 q-rise @max-6xl:mt-5"
								style={{ animationDelay: ".05s" }}
								data-testid="daily-plan"
								aria-label="Today's plan"
							>
								<h2 className="q-sh">
									<QIcon name="arrow" />
									Today&apos;s plan
									{multi && (
										<button
											type="button"
											onClick={() => setSplitting((v) => !v)}
											aria-expanded={splitting}
											data-testid="day-split-open"
											className="lanna-press order-3 -my-1 inline-flex h-7 items-center rounded-md bg-well px-2.5 text-[12.5px] font-[550] text-ink-2 hover:bg-well-2 hover:text-foreground pointer-coarse:h-11"
										>
											Split the day
										</button>
									)}
								</h2>
								{multi && splitting && (
									<DaySplit
										day={day!}
										onCancel={() => setSplitting(false)}
										onSaved={(next) => {
											setDay(next);
											setSplitting(false);
											load();
										}}
									/>
								)}
								{switchNote && (
									<p
										className="mb-3 rounded-lg bg-miss-soft px-4 py-3 text-[14px] text-foreground"
										role="alert"
										data-testid="switch-note"
									>
										{switchNote}
									</p>
								)}
								{!s && <PlanSkeleton />}
								{s && total === 0 && (
									<AllDone
										minutes={s.plan.minutes}
										goal={s.pace?.goalMinutes ?? s.goal.minutesPerDay}
										next={s.next}
										after={s.afterPlan}
									/>
								)}
								{s && total > 0 && (
									<DayPath
										groups={groups}
										steps={steps}
										up={up}
										busy={busy}
										onStart={start}
										renderNext={renderNext}
										onChooseVideo={() => setChoosingVideo(true)}
									/>
								)}
								{s &&
									total > 0 &&
									done >= total &&
									(groups ? (
										<AllDone
											minutes={day!.practiced}
											goal={day!.minutes}
											next={s.next}
											after={s.afterPlan}
											className="mt-2"
										/>
									) : (
										<AllDone
											minutes={s.plan.minutes}
											goal={s.pace?.goalMinutes ?? s.goal.minutesPerDay}
											next={s.next}
											after={s.afterPlan}
											className="mt-2"
										/>
									))}
							</section>

							{choosingVideo && (
								<ChooseVideo
									current={watchTask?.href ? new URLSearchParams(watchTask.href.split("?")[1]).get("id") : null}
									onClose={closeChooser}
									onChosen={(id) => router.push(`/watch?id=${id}`)}
								/>
							)}

							<WhereYouAre stage={stage} scene={soonest} />

							{s && (
								<section
									className="mt-6 q-rise @max-6xl:mt-5"
									style={{ animationDelay: ".08s" }}
									data-testid="today-so-far"
									aria-label="Today so far"
								>
									<h2 className="q-sh">
										<QIcon name="check" />
										Today so far
										<Link
											href="/log"
											data-testid="open-log"
											className="lanna-press order-3 -my-1 inline-flex h-7 items-center gap-1.5 rounded-md bg-well px-2.5 text-[12.5px] font-[550] text-ink-2 hover:bg-well-2 hover:text-foreground"
										>
											<HistoryIcon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
											<CapLabel>Open the log</CapLabel>
										</Link>
									</h2>
									{dayLog && dayLog.entries.length > 0 ? (
										<ol className="divide-y divide-[var(--q-line)]">
											{dayLog.entries.slice(-4).map((e) => (
												<EntryRow key={`${e.at}-${e.kind}-${e.title}`} e={e} />
											))}
										</ol>
									) : (
										<p className="text-[14px] text-ink-3">
											{dayLog ? "Nothing finished yet today. Each finished task shows here with its time." : "\u00a0"}
										</p>
									)}
								</section>
							)}

							{s && <OutsideListening />}

							{weakGroups.length > 0 && (
								<section
									className="mt-6 q-rise @max-6xl:mt-5"
									style={{ animationDelay: ".1s" }}
									data-testid="weak-spots"
								>
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
															<span className="q-pair" lang={lang?.code}>
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
										<Link
											href={`/lesson?unit=${weakGroups[0]!.unit}`}
											className="q-btn sec t"
											data-testid={`weak-spot-${weakGroups[0]!.id}`}
										>
											<QIcon name="grammar" />
											<span className="@max-xl:hidden">Lesson on the {bare(weakGroups[0]!.title)}</span>
											<span className="@xl:hidden">
												{bare(weakGroups[0]!.title).replace(/^./, (c) => c.toUpperCase())} lesson
											</span>
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
											Open Mistakes <QIcon name="chev" />
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

function SetupNext({ lang, busy, onOpen }: { lang: DayLanguage; busy: boolean; onOpen: () => void }) {
	return (
		<article className="q-card" data-testid={`plan-next-setup-${lang.id}`}>
			<div className="q-card-head">
				<QIcon name="flag" />
				Setup
				<span className="mins q-num">{SETUP_MINUTES} min</span>
			</div>
			<div className="q-rv-body @max-xl:block">
				<div className="min-w-0">
					<h3 className="@max-xl:text-[19px]">Set up {lang.english}</h3>
					<p className="q-rv-tease" style={{ fontSize: 15 }}>
						Why you are learning it, what you already know, your pace and a short level check. Opens in {lang.english}.
					</p>
				</div>
				<button
					type="button"
					className="q-btn primary @max-xl:mt-3.5 @max-xl:h-11 @max-xl:w-full @max-xl:text-[15px]"
					onClick={onOpen}
					disabled={busy}
				>
					Start<span className="@xl:hidden"> setup</span>
					<kbd className="q-kbd pointer-coarse:hidden">
						<QIcon name="enter" />
					</kbd>
				</button>
			</div>
		</article>
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
function UpNext({
	task,
	busy,
	onOpen,
	onChooseVideo,
	meta,
}: {
	task: PlanTask;
	busy: boolean;
	onOpen: () => void;
	onChooseVideo?: () => void;
	meta: React.ReactNode;
}) {
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
							{task.from
								? `Left over from ${new Date(`${task.from}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" })}. ${w.rest.charAt(0).toUpperCase()}${w.rest.slice(1)}`
								: w.rest}
						</p>
					)}
					{meta && <p className="q-rv-meta">{meta}</p>}
					{onChooseVideo && (
						<p className="q-rv-meta">
							<button
								type="button"
								onClick={onChooseVideo}
								aria-haspopup="dialog"
								data-testid="plan-choose-video"
								className="font-[550] text-ink-2 underline decoration-[var(--q-dash)] underline-offset-2 hover:text-foreground"
							>
								Pick another video
							</button>
						</p>
					)}
				</div>
				<button
					type="button"
					className="q-btn primary @max-xl:mt-3.5 @max-xl:h-11 @max-xl:w-full @max-xl:text-[15px]"
					onClick={onOpen}
					disabled={busy}
				>
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
			Type it, don&apos;t pick it. <b>{s.review.due} due</b>, {known} {known === 1 ? "word" : "words"} you can recall.
		</>
	);
}

/** The plan is done: time left goes to input (src/core/after-plan.ts), with a lesson as the second choice. */
function AllDone({
	minutes,
	goal,
	next,
	after,
	className,
}: {
	minutes: number;
	goal: number;
	next: string;
	after?: AfterPlan;
	className?: string;
}) {
	const step = after?.step;
	return (
		<article className={cn("q-card", className)} data-testid="plan-complete">
			<div className="q-rv-body @max-xl:block">
				<div className="min-w-0">
					<h3 className="@max-xl:text-[19px]">All done for today.</h3>
					<p className="q-rv-tease" style={{ fontSize: 15 }}>
						That is {minutes} of your {goal} min goal.
						{step && minutes < goal ? " More time goes to listening, so drills stay about a quarter of your week." : ""}
					</p>
					{step && (
						<p className="q-rv-meta" data-testid="after-plan">
							<b>{step.title}</b> · {step.minutes} min. {step.line}.
						</p>
					)}
					{step && (
						<div className="q-acts" style={{ marginTop: 12 }}>
							{after?.find && (
								<Link href={after.find} className="q-btn sec" data-testid="after-plan-find">
									Find a video at your level
								</Link>
							)}
							<Link href={`/lesson?unit=${next}`} className="q-btn ghost" data-testid="plan-one-more">
								One more lesson
							</Link>
						</div>
					)}
				</div>
				{step ? (
					<Link
						href={step.href}
						className="q-btn primary @max-xl:mt-3.5 @max-xl:h-11 @max-xl:w-full @max-xl:text-[15px]"
						data-testid="after-plan-start"
					>
						Start<span className="@xl:hidden"> {step.kind === "watch" ? "Media" : "Listen"}</span>
						<kbd className="q-kbd pointer-coarse:hidden">
							<QIcon name="enter" />
						</kbd>
					</Link>
				) : (
					<Link href={`/lesson?unit=${next}`} className="q-btn sec" data-testid="plan-one-more">
						One more lesson
					</Link>
				)}
			</div>
		</article>
	);
}
