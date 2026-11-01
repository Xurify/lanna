"use client";

/**
 * Today — the LangHarness front page (redesign 2026-10-27; one-plan layout
 * 2026-10-29). It replaces the knowledge-graph home (now at /map), because
 * a language app opens on what to do next, not on a blank "What do you
 * want to learn?".
 *
 * One plan, one next step: the day's plan (components/daily-plan.tsx)
 * draws its first unfinished task large, and Enter starts it. Beside it,
 * the week (days practiced, the strand balance, the goal) and the path,
 * folded to the current chapter (components/curriculum-path.tsx). Below,
 * every way to practice outside the plan, grouped by the same four
 * strands the balance measures.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlocksIcon, BookAIcon, BookOpenIcon, BotMessageSquareIcon, FlameIcon, GaugeIcon, HeadphonesIcon, MessagesSquareIcon, MicIcon, MonitorPlayIcon, RepeatIcon, TableIcon, XIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { SetupDialog } from "@/components/setup-dialog";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { startTutorChat } from "@/components/lesson/tutor";
import { DailyPlan, nextTask, WeakSpots, type Goal } from "@/components/daily-plan";
import { WeekCard } from "@/components/week-card";
import { CurriculumPath } from "@/components/curriculum-path";
import { STRAND_ICON } from "@/components/strand-balance";
import { STRAND_STYLE } from "@/components/strand-style";
import { curriculumUnit, purposeGoals, speakScene, STRANDS, tutorUnitPrompt } from "@/src/core";
import type { CurriculumState, DailyPlan as Plan, ExamSummary, PlanTask, Projection, Strand, StrandBalance, TrajectoryInput, UnitId, UnitKind, UnitState, WeakSpotSummary } from "@/src/core";

interface UnitSummary {
	id: UnitId;
	title: string;
	tagline: string;
	glyph: string;
	kind?: UnitKind;
	slovakTerm?: string;
	lessons: number;
	reps: number;
	level: number;
	/** 0..1 toward completion. */
	progress: number;
	done: boolean;
	accuracy: number | null;
}

interface Summary {
	xp: number;
	level: { level: number; into: number; span: number };
	todayXp: number;
	dailyGoal: number;
	streak: { days: number; restUsed: boolean; activeToday: boolean };
	week: Array<{ day: string; xp: number }>;
	units: UnitSummary[];
	next: UnitId;
	bestBlitz: number;
	review: { due: number; newLeft: number; total: number; available: boolean };
	curriculum: CurriculumState;
	plan: Plan;
	goal: Goal;
	projection: Projection;
	balance?: StrandBalance;
	trajectory?: TrajectoryInput;
	weakSpots?: WeakSpotSummary[];
	exams?: Record<string, ExamSummary>;
	pace?: { goalMinutes: number; plannedMinutes: number; logged: number; windowDays: number; dailyAverage: number };
	backlog?: number;
}

function greeting(now = new Date()): string {
	const h = now.getHours();
	if (h < 10) return "Dobré ráno";
	if (h < 18) return "Dobrý deň";
	return "Dobrý večer";
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
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.tagName === "A" || t.isContentEditable)) return;
			e.preventDefault();
			router.push(enterHref);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [enterHref, setupOpen, router]);

	/** Tutor chats need a model; without one, the setup dialog comes first. */
	const withTutor = (run: () => Promise<void>) => {
		if (!configured || zeroKeys || strongKeyless) {
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
	/** A goal's scene, by scene id: the same spoken scene the plan's Speak task opens. */
	const sceneById = (id: string) => {
		if (speakScene(id)) router.push(`/speak?scene=${id}`);
	};
	/** The plan's speaking task: a tutor unit, or a spoken scene (/speak, a
	 *  link the row follows itself). */
	const speak = (task: PlanTask) => {
		if (task.via === "tutor" && task.unit) {
			const u = (s?.curriculum.chapters ?? []).flatMap((c) => c.units).find((x) => x.id === task.unit);
			if (u) tutorUnit(u);
		} else if (task.via === "speak") router.push(task.href ?? (task.unit ? `/speak?scene=${task.unit}` : "/speak"));
	};

	const next = s?.units.find((u) => u.id === s.next);
	const doneToday = (id: PlanTask["id"]) => s?.plan.tasks.some((t) => t.id === id && t.done) ?? false;

	const practice: Array<{ strand: Strand; items: PracticeItem[] }> = [
		{
			strand: "input",
			items: [
				{ href: "/listen", icon: HeadphonesIcon, title: "Listen", line: doneToday("listen") ? "Ten more sentences" : "Ten sentences you can follow", testid: "mode-listen" },
				{ href: "/read", icon: BookOpenIcon, title: "Read", line: doneToday("read") ? "Today's episode is read. Open the library" : "Today's episode, every word tappable", testid: "mode-read" },
				{ href: "/watch", icon: MonitorPlayIcon, title: "Watch", line: s?.plan.tasks.some((t) => t.id === "watch" && !t.done) ? "A video is waiting for you" : "A YouTube video with both subtitles", testid: "mode-watch" },
			],
		},
		{
			strand: "output",
			items: [
				{ href: "/speak", icon: MicIcon, title: "Speak", line: doneToday("speak") ? "One scene said today. Another?" : "A real scene, said out loud", testid: "mode-speak" },
				{ href: "/speak?mode=typed", icon: MessagesSquareIcon, title: "Talk in writing", line: "A role-play in written Slovak", testid: "mode-talk" },
			],
		},
		{
			strand: "form",
			items: [
				{
					href: "/review",
					icon: RepeatIcon,
					title: "Review",
					line: s ? (s.review.due > 0 ? `${s.review.due} ${s.review.due === 1 ? "card" : "cards"} due now` : s.review.newLeft > 0 ? `${s.review.newLeft} new words today` : "All caught up") : "Your word deck",
					badge: s && s.review.due > 0 ? String(s.review.due) : undefined,
					testid: "mode-review",
				},
				{
					href: `/lesson?unit=${s?.next ?? "words"}`,
					icon: next?.kind === "words" ? BookAIcon : BlocksIcon,
					title: next?.kind === "words" ? "Words lesson" : "Grammar lesson",
					line: next
						? `${next.title.replace(/^(Grammar|Words|Tutor|Goal):\s*/, "")}${next.slovakTerm ? ` · ${next.slovakTerm}` : ""}`
						: "First words · Základná slovná zásoba",
					testid: "start-lesson",
				},
				{ href: "/grammar", icon: TableIcon, title: "Grammar", line: "Six cases, three genders, and your score on each", testid: "mode-grammar" },
				{ href: "/chat/new", icon: BotMessageSquareIcon, title: "Ask the tutor", line: "Any question about Slovak", testid: "mode-tutor" },
			],
		},
		{
			strand: "fluency",
			items: [
				{ href: "/fluency?mode=fast", icon: GaugeIcon, title: "Say it faster", line: "Known sentences, in a shrinking window", testid: "mode-fast" },
				{ href: "/lesson?mode=blitz", icon: ZapIcon, title: "Blitz", line: s && s.bestBlitz > 0 ? `60 seconds · your best is ${s.bestBlitz}` : "60 seconds, as many as you can", testid: "mode-blitz" },
			],
		},
	];

	return (
		<div className="relative min-h-dvh bg-background @container">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>

			<div className="mx-auto grid w-full max-w-3xl gap-6 px-5 pb-16 @5xl:max-w-6xl @5xl:grid-cols-[minmax(0,1fr)_22rem] @5xl:gap-8" data-testid="today">
				<div className="flex min-w-0 flex-col gap-6">
					{/* Greeting and the day's numbers */}
					<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
						<div>
							<p className="text-sm font-semibold text-muted-foreground first-letter:uppercase" lang="sk">
								{new Date().toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long" })}
							</p>
							<h1 className="mt-0.5 text-3xl font-black tracking-tight text-foreground" lang="sk">
								{greeting()}
							</h1>
						</div>
						<div className="flex items-center gap-2">
							<Pill className="text-flame" title={s?.streak.restUsed ? "Day streak (one rest day used)" : "Day streak"}>
								<FlameIcon className={cn("size-4", s?.streak.activeToday && "lh-flicker")} aria-hidden="true" />
								{s ? `${s.streak.days} ${s.streak.days === 1 ? "day" : "days"}` : "–"}
							</Pill>
							<Pill className="text-xp" title={s ? `${s.level.span - s.level.into} XP to level ${s.level.level + 1}` : "Level"}>
								Level {s?.level.level ?? 1}
								<span className="text-muted-foreground" aria-hidden="true">
									·
								</span>
								{s?.xp ?? 0} XP
							</Pill>
						</div>
					</div>

					{failed && (
						<p className="rounded-xl border border-miss/40 bg-miss-soft px-4 py-3 text-sm text-foreground" role="alert">
							Unable to load your progress. Check that LangHarness is still running, then{" "}
							<button type="button" className="font-bold underline underline-offset-2" onClick={load}>
								try again
							</button>
							.
						</p>
					)}

					<DailyPlan plan={s?.plan ?? null} nextUnit={s?.next ?? "words"} pace={s?.pace} backlog={s?.backlog} busy={busy} onSpeak={speak} />

					{/* Every way to practice, outside the plan */}
					<section aria-labelledby="practice-title" data-testid="modes">
						<h2 id="practice-title" className="px-1 text-lg font-black text-foreground">
							Practice anything
						</h2>
						<p className="mt-0.5 px-1 text-sm text-muted-foreground">Outside the plan, any time. Grouped by the four kinds of practice the week balances.</p>
						<div className="mt-3 grid gap-3 @xl:grid-cols-2">
							{practice.map((g) => (
								<PracticeGroup key={g.strand} strand={g.strand} items={g.items} busy={busy} />
							))}
						</div>
					</section>
				</div>

				<aside className="flex min-w-0 flex-col gap-6 @5xl:pt-1" aria-label="Your week and your path">
					<WeekCard week={s?.week ?? []} balance={s?.balance ?? null} goal={s?.goal ?? null} projection={s?.projection ?? null} trajectory={s?.trajectory ?? null} />

					{(s?.weakSpots?.length ?? 0) > 0 && (
						<section className="rounded-3xl border bg-card p-5" aria-label="Your weak spots">
							<WeakSpots weak={s?.weakSpots ?? []} className="" />
						</section>
					)}

					{/* The path: the whole map, folded to the current chapter */}
					<section aria-labelledby="path-title" data-testid="skill-path">
						<div className="flex items-baseline justify-between gap-3 px-1">
							<h2 id="path-title" className="text-lg font-black text-foreground">
								Your path
							</h2>
							{s && (
								<p className="text-sm text-muted-foreground tabular-nums">
									{s.curriculum.done} of {s.curriculum.total} units to {s.goal.level}
								</p>
							)}
						</div>
						<div className="mt-3">
							<CurriculumPath state={s?.curriculum ?? null} next={s?.next} goals={purposeGoals(s?.goal.purposes ?? [])} weak={s?.weakSpots ?? []} exams={s?.exams} busy={busy} onTutor={tutorUnit} onScene={sceneById} />
						</div>
					</section>
				</aside>
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

function Pill({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
	return (
		<span title={title} className={cn("flex h-9 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-bold tabular-nums", className)}>
			{children}
		</span>
	);
}

interface PracticeItem {
	href?: string;
	onClick?: () => void;
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	line: string;
	badge?: string;
	testid: string;
}

/** One strand's ways to practice: its name and ink, then a row each. */
function PracticeGroup({ strand, items, busy }: { strand: Strand; items: PracticeItem[]; busy: boolean }) {
	const st = STRAND_STYLE[strand];
	const meta = STRANDS.find((x) => x.id === strand)!;
	const Icon = STRAND_ICON[strand];
	return (
		<div className="rounded-2xl border bg-card p-3" data-testid={`practice-${strand}`}>
			<p className={cn("flex items-center gap-1.5 px-2 pt-1 text-sm font-bold", st.text)}>
				<Icon className="size-4" />
				{meta.title}
			</p>
			<ul className="mt-1.5 flex flex-col">
				{items.map((it) => {
					const ItemIcon = it.icon;
					const body = (
						<>
							<span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", st.tile)}>
								<ItemIcon className="size-[18px]" />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-base font-bold text-foreground">{it.title}</span>
								<span className="block truncate text-sm text-muted-foreground">{it.line}</span>
							</span>
							{it.badge && <span className="shrink-0 rounded-full bg-sky px-2 py-0.5 text-xs font-bold tabular-nums text-background">{it.badge}</span>}
						</>
					);
					const cls = "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent disabled:opacity-60";
					return (
						<li key={it.title}>
							{it.href ? (
								<Link href={it.href} className={cls} data-testid={it.testid}>
									{body}
								</Link>
							) : (
								<button type="button" onClick={it.onClick} disabled={busy} className={cls} data-testid={it.testid}>
									{body}
								</button>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
