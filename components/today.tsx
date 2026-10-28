"use client";

/**
 * Today — the LangHarness front page (redesign, 2026-10-27). It replaces
 * the knowledge-graph home (now at /map), because a language app opens on
 * what to do next, not on a blank "What do you want to learn?".
 *
 * One obvious next step (Continue, Enter starts it), today's plan on the
 * road to the target level (components/daily-plan.tsx), four ways to
 * practise (Review, Blitz, Speak, Read), and the path: the whole A1→B2
 * map folded to the current chapter (components/curriculum-path.tsx).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	BookOpenIcon,
	BookOpenTextIcon,
	CheckIcon,
	FlameIcon,
	GraduationCapIcon,
	MapIcon,
	MessagesSquareIcon,
	MicIcon,
	PlayIcon,
	RepeatIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { SetupDialog } from "@/components/setup-dialog";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { startTutorChat, storyPrompt, TALK_SCENES, talkPrompt, type Scene } from "@/components/lesson/tutor";
import { UnitBadge } from "@/components/unit-badge";
import { DailyPlan, type Goal } from "@/components/daily-plan";
import { CurriculumPath } from "@/components/curriculum-path";
import { curriculumUnit, LESSONS_TO_COMPLETE, purposeGoals, tutorUnitPrompt } from "@/src/core";
import type { CurriculumState, DailyPlan as Plan, PlanTask, Projection, StrandBalance, UnitId, UnitState } from "@/src/core";

interface UnitSummary {
	id: UnitId;
	title: string;
	tagline: string;
	glyph: string;
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
	const [talkOpen, setTalkOpen] = useState(false);
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

	// Enter starts the Continue lesson — the one-key way into practice.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Enter" || !s || talkOpen || setupOpen) return;
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
			e.preventDefault();
			router.push(`/lesson?unit=${s.next}`);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [s, talkOpen, setupOpen, router]);

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

	const talk = (scene: Scene) =>
		withTutor(() => startTutorChat(router, { title: `Talk: ${scene.title}`, prompt: talkPrompt(scene) }));
	const story = () =>
		withTutor(() =>
			startTutorChat(router, {
				title: "Story: Robo in Bratislava",
				prompt: storyPrompt(
					(s?.curriculum.chapters ?? [])
						.flatMap((c) => c.units)
						.filter((u) => u.kind === "drill" && u.lessons > 0 && u.id !== "words")
						.map((u) => u.title),
				),
			}),
		);
	/** A tutor unit on the path: a practice session with the unit's brief. */
	const tutorUnit = (u: UnitState) => {
		const unit = curriculumUnit(u.id);
		if (!unit) return;
		withTutor(() => startTutorChat(router, { title: `Tutor: ${unit.title}`, prompt: tutorUnitPrompt(unit), activity: "tutor", unit: unit.id }));
	};
	/** A goal's Talk scene, by scene id. */
	const sceneById = (id: string) => {
		const scene = TALK_SCENES.find((x) => x.id === id);
		if (scene) talk(scene);
	};
	/** The plan's speaking task: a tutor unit, a spoken scene (/speak, a
	 *  link the row follows itself), a text Talk, or a story. */
	const speak = (task: PlanTask) => {
		if (task.via === "tutor" && task.unit) {
			const u = (s?.curriculum.chapters ?? []).flatMap((c) => c.units).find((x) => x.id === task.unit);
			if (u) tutorUnit(u);
		} else if (task.via === "speak") router.push(task.href ?? (task.unit ? `/speak?scene=${task.unit}` : "/speak"));
		else if (task.via === "talk" && task.unit) sceneById(task.unit);
		else if (task.via === "talk") setTalkOpen(true);
		else story();
	};

	const next = s?.units.find((u) => u.id === s.next);

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="relative flex items-center gap-2 px-3 py-2">
				<SidebarToggle />
			</header>

			<main className="mx-auto grid w-full max-w-6xl gap-8 px-5 pb-16 lg:grid-cols-[minmax(0,1fr)_22rem]" data-testid="today">
				<section className="min-w-0">
					{/* Greeting + the day's numbers */}
					<div className="flex flex-wrap items-end justify-between gap-4">
						<div>
							<p className="font-ui text-xs font-bold tracking-wide first-letter:uppercase text-muted-foreground">
								{new Date().toLocaleDateString("sk-SK", { weekday: "long", day: "numeric", month: "long" })}
							</p>
							<h1 className="mt-1 font-ui text-4xl font-black tracking-tight text-foreground">{greeting()}!</h1>
						</div>
						<div className="flex items-center gap-2">
							<Pill className="text-flame" title={s?.streak.restUsed ? "Streak (one rest day used)" : "Day streak"}>
								<FlameIcon className={cn("size-4", s?.streak.activeToday && "lh-flicker")} />
								{s ? `${s.streak.days} ${s.streak.days === 1 ? "day" : "days"}` : "–"}
							</Pill>
							<Pill className="text-xp" title={s ? `Level ${s.level.level}: ${s.level.span - s.level.into} XP to level ${s.level.level + 1}` : "Level"}>
								Level {s?.level.level ?? 1}
								<span className="text-muted-foreground">·</span>
								{s?.xp ?? 0} XP
							</Pill>
						</div>
					</div>

					{failed && (
						<p className="mt-6 rounded-xl border border-miss/40 bg-miss-soft px-4 py-3 font-prose text-foreground">
							Couldn&apos;t load your progress.{" "}
							<button type="button" className="underline" onClick={load}>
								Try again
							</button>
						</p>
					)}

					{/* Continue — the one obvious next step */}
					<div className="relative mt-6 overflow-hidden rounded-3xl border-2 border-go/40 bg-gradient-to-br from-go/20 via-card to-card p-6 sm:p-8" data-testid="continue-card">
						<div className="absolute -right-10 -top-10 size-48 rounded-full bg-go/10 blur-2xl" aria-hidden="true" />
						<p className="font-ui text-xs font-bold tracking-wide first-letter:uppercase text-go">Continue</p>
						<div className="mt-3 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
							<UnitBadge glyph={next?.glyph ?? "book"} progress={next?.progress ?? 0} size="lg" active />
							<div className="min-w-0">
								<h2 className="font-ui text-3xl font-black text-foreground">{next?.title ?? "First words"}</h2>
								<p className="mt-1 font-prose text-lg text-muted-foreground">{next?.tagline ?? "Everyday words in real sentences"}</p>
								<p className="mt-1 font-ui text-xs text-muted-foreground" data-testid="continue-meta">
									{next ? lessonLine(next) : "12 reps · about 3 minutes"}
								</p>
							</div>
						</div>
						<div className="mt-6 flex flex-wrap items-center gap-3">
							<Link
								href={`/lesson?unit=${s?.next ?? "words"}`}
								data-testid="start-lesson"
								className="lh-pulse-ring flex items-center gap-2 rounded-2xl bg-go px-8 py-3.5 font-ui text-sm font-extrabold uppercase tracking-wider text-go-ink shadow-[0_4px_0_0_rgb(0_0_0/0.35)] transition-all hover:brightness-110 active:translate-y-0.5 active:shadow-none"
							>
								<PlayIcon className="size-4 fill-current" />
								Start
							</Link>
							<span className="font-ui text-xs text-muted-foreground">or press Enter</span>
						</div>
					</div>

					{/* Today's plan: the day's tasks on the road to the goal */}
					<DailyPlan plan={s?.plan ?? null} goal={s?.goal ?? null} projection={s?.projection ?? null} balance={s?.balance ?? null} week={s?.week ?? []} busy={busy} onSpeak={speak} />

					{/* Ways to practise */}
					<div className="mt-5 grid grid-cols-2 gap-4" data-testid="modes">
						<ModeTile
							href="/review"
							icon={<RepeatIcon className="size-6" />}
							ink="text-sky"
							ring="hover:border-sky/60"
							title="Review"
							line={s ? (s.review.due > 0 ? `${s.review.due} due now` : s.review.newLeft > 0 ? `${s.review.newLeft} new words today` : "All caught up") : "Your word deck"}
							badge={s && s.review.due > 0 ? String(s.review.due) : undefined}
						/>
						<ModeTile
							href="/lesson?mode=blitz"
							icon={<ZapIcon className="size-6" />}
							ink="text-gold"
							ring="hover:border-gold/60"
							title="Blitz"
							line={s && s.bestBlitz > 0 ? `60 seconds · best ${s.bestBlitz}` : "60 seconds, as many as you can"}
						/>
						<ModeTile
							href="/speak"
							icon={<MicIcon className="size-6" />}
							ink="text-xp"
							ring="hover:border-xp/60"
							title="Speak"
							line={s?.plan.tasks.some((t) => t.id === "speak" && t.done) ? "A scene said today · another?" : "Say a real scene out loud"}
						/>
						<ModeTile
							href="/read"
							icon={<BookOpenIcon className="size-6" />}
							ink="text-flame"
							ring="hover:border-flame/60"
							title="Read"
							line={s?.plan.tasks.some((t) => t.id === "read" && t.done) ? "Today's episode is read · the library" : "Today's episode, every word tappable"}
						/>
					</div>

					<div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-ui text-xs text-muted-foreground">
						<Link href="/chat/new" className="flex items-center gap-1.5 hover:text-foreground">
							<GraduationCapIcon className="size-3.5" />
							Deep-dive with the tutor
						</Link>
						<Link href="/chat/new?mode=practice" className="flex items-center gap-1.5 hover:text-foreground">
							<BookOpenTextIcon className="size-3.5" />
							Practice problems
						</Link>
						<button type="button" onClick={() => setTalkOpen(true)} disabled={busy} className="flex items-center gap-1.5 hover:text-foreground disabled:opacity-50">
							<MessagesSquareIcon className="size-3.5" />
							Talk in writing
						</button>
						<Link href="/fluency?mode=fast" className="flex items-center gap-1.5 hover:text-foreground">
							<ZapIcon className="size-3.5" />
							Say it faster
						</Link>
						<Link href="/curriculum" className="flex items-center gap-1.5 hover:text-foreground">
							<MapIcon className="size-3.5" />
							The whole path
						</Link>
						<Link href="/map" className="flex items-center gap-1.5 hover:text-foreground">
							<MapIcon className="size-3.5" />
							Knowledge map
						</Link>
					</div>
				</section>

				{/* The path: the whole map, folded to the current chapter */}
				<aside aria-label="Your path" data-testid="skill-path">
					<div className="flex items-baseline justify-between">
						<p className="font-ui text-xs font-bold tracking-wide first-letter:uppercase text-muted-foreground">Your path</p>
						{s && (
							<p className="font-ui text-xs text-muted-foreground">
								{s.curriculum.level} · {s.curriculum.done}/{s.curriculum.total} to {s.goal.level}
							</p>
						)}
					</div>
					<div className="mt-4">
						<CurriculumPath state={s?.curriculum ?? null} next={s?.next} goals={purposeGoals(s?.goal.purposes ?? [])} busy={busy} onTutor={tutorUnit} onScene={sceneById} />
					</div>
				</aside>
			</main>

			{talkOpen && <TalkPicker onClose={() => setTalkOpen(false)} onPick={(scene) => talk(scene)} busy={busy} />}

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
		<span title={title} className={cn("flex items-center gap-1.5 rounded-full border-2 bg-card px-3 py-1.5 font-ui text-sm font-bold tabular-nums", className)}>
			{children}
		</span>
	);
}

/** What the Continue card says under the unit: which lesson of the unit
 *  comes next, and how far the unit is. */
function lessonLine(u: UnitSummary): string {
	if (u.done) return `Unit complete · one more lesson to keep it sharp · ${Math.round((u.accuracy ?? 0) * 100)}% right`;
	const n = Math.min(u.lessons + 1, LESSONS_TO_COMPLETE);
	return `Lesson ${n} of ${LESSONS_TO_COMPLETE} · 12 reps · about 3 minutes`;
}

function ModeTile({
	href,
	onClick,
	icon,
	ink,
	ring,
	title,
	line,
	badge,
	disabled,
}: {
	href?: string;
	onClick?: () => void;
	icon: React.ReactNode;
	ink: string;
	ring: string;
	title: string;
	line: string;
	badge?: string;
	disabled?: boolean;
}) {
	const body = (
		<>
			<span className={cn("flex size-12 items-center justify-center rounded-2xl bg-accent", ink)}>{icon}</span>
			<span className="mt-4 block font-ui text-xl font-black text-foreground">{title}</span>
			<span className="mt-0.5 block font-prose text-sm text-muted-foreground">{line}</span>
			{badge && <span className="absolute right-4 top-4 rounded-full bg-sky px-2 py-0.5 font-ui text-xs font-bold text-background">{badge}</span>}
		</>
	);
	const cls = cn(
		"relative block rounded-3xl border-2 bg-card p-5 text-left shadow-[0_4px_0_0_var(--border)] transition-all hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50",
		ring,
	);
	return href ? (
		<Link href={href} className={cls} data-testid={`mode-${title.toLowerCase()}`}>
			{body}
		</Link>
	) : (
		<button type="button" onClick={onClick} disabled={disabled} className={cls} data-testid={`mode-${title.toLowerCase()}`}>
			{body}
		</button>
	);
}

function TalkPicker({ onClose, onPick, busy }: { onClose: () => void; onPick: (scene: Scene) => void; busy: boolean }) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label="Pick a scene">
			<div className="lh-rise w-full max-w-2xl rounded-3xl border-2 bg-card p-6">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="font-ui text-2xl font-black text-foreground">Pick a scene</h2>
						<p className="mt-1 font-prose text-base text-muted-foreground">Slovak only, one line at a time. Write “koniec” to stop and get your corrections.</p>
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
						<XIcon className="size-5" />
					</button>
				</div>
				<div className="mt-5 grid gap-3 sm:grid-cols-2">
					{TALK_SCENES.map((scene) => (
						<button
							key={scene.id}
							type="button"
							disabled={busy}
							onClick={() => onPick(scene)}
							className="rounded-2xl border-2 bg-background px-4 py-3.5 text-left shadow-[0_3px_0_0_var(--border)] transition-all hover:-translate-y-0.5 hover:border-xp/60 disabled:opacity-50"
						>
							<span className="block font-ui text-lg font-bold text-foreground" lang="sk">
								{scene.title}
							</span>
							<span className="block font-prose text-sm text-muted-foreground">{scene.blurb}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
