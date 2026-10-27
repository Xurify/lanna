"use client";

/**
 * Today — the LangHarness front page (redesign, 2026-10-27). It replaces
 * the knowledge-graph home (now at /map), because a language app opens on
 * what to do next, not on a blank "What do you want to learn?".
 *
 * One obvious next step (Continue, Enter starts it), the day's goal and
 * streak, four ways to practise (Review, Blitz, Talk, Story), and the
 * skill path: every grammar unit as a node whose ring fills as lessons
 * are finished.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	BookOpenTextIcon,
	CheckIcon,
	FlameIcon,
	GraduationCapIcon,
	MapIcon,
	MessagesSquareIcon,
	PlayIcon,
	RepeatIcon,
	ScrollTextIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "@/components/sidebar";
import { SetupDialog } from "@/components/setup-dialog";
import { useStrongKeyless, useZeroKeys } from "@/components/setup-cta";
import { startTutorChat, storyPrompt, TALK_SCENES, talkPrompt, type Scene } from "@/components/lesson/tutor";
import { UnitIcon } from "@/components/lesson/unit-icon";
import { LESSONS_TO_COMPLETE } from "@/src/core";
import type { UnitId } from "@/src/core";

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
}

function greeting(now = new Date()): string {
	const h = now.getHours();
	if (h < 10) return "Dobré ráno";
	if (h < 18) return "Dobrý deň";
	return "Dobrý večer";
}

const WEEKDAY = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];

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
				prompt: storyPrompt((s?.units ?? []).filter((u) => u.lessons > 0 && u.id !== "words").map((u) => u.title)),
			}),
		);

	const next = s?.units.find((u) => u.id === s.next);
	const goalPct = s ? Math.min(1, s.todayXp / Math.max(1, s.dailyGoal)) : 0;

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

					{/* Daily goal + week */}
					<div className="mt-5 flex flex-wrap items-center gap-6 rounded-3xl border bg-card px-6 py-5">
						<GoalRing pct={goalPct} xp={s?.todayXp ?? 0} goal={s?.dailyGoal ?? 50} />
						<div className="min-w-0 flex-1">
							<p className="font-ui text-lg font-bold text-foreground">
								{goalPct >= 1 ? "Daily goal reached. Pekne!" : `${Math.max(0, (s?.dailyGoal ?? 50) - (s?.todayXp ?? 0))} XP left for today's goal`}
							</p>
							<div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2" aria-label="This week">
								{(s?.week ?? Array.from({ length: 7 }, (_, i) => ({ day: String(i), xp: 0 }))).map((d, i, all) => {
									const isToday = i === all.length - 1;
									const wd = /\d{4}-\d{2}-\d{2}/.test(d.day) ? WEEKDAY[new Date(`${d.day}T12:00:00`).getDay()] : "";
									return (
										<div key={d.day} className="flex flex-col items-center gap-1">
											<span
												className={cn(
													"flex size-7 items-center justify-center rounded-full border-2 sm:size-8",
													d.xp > 0 ? "border-flame bg-flame/15 text-flame" : "border-border text-muted-foreground/40",
													isToday && d.xp === 0 && "border-dashed border-foreground/40",
												)}
												title={`${d.day}: ${d.xp} XP`}
											>
												<FlameIcon className="size-4" />
											</span>
											<span className={cn("font-ui text-[10px] uppercase", isToday ? "text-foreground" : "text-muted-foreground")}>{wd}</span>
										</div>
									);
								})}
							</div>
						</div>
					</div>

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
							onClick={() => setTalkOpen(true)}
							icon={<MessagesSquareIcon className="size-6" />}
							ink="text-xp"
							ring="hover:border-xp/60"
							title="Talk"
							line="Role-play a real scene"
							disabled={busy}
						/>
						<ModeTile
							onClick={story}
							icon={<ScrollTextIcon className="size-6" />}
							ink="text-flame"
							ring="hover:border-flame/60"
							title="Story"
							line="Robo's next episode"
							disabled={busy}
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
						<Link href="/map" className="flex items-center gap-1.5 hover:text-foreground">
							<MapIcon className="size-3.5" />
							Knowledge map
						</Link>
					</div>
				</section>

				{/* The skill path */}
				<aside aria-label="Skill path" data-testid="skill-path">
					<p className="font-ui text-xs font-bold tracking-wide first-letter:uppercase text-muted-foreground">Your path</p>
					<ol className="relative mt-4">
						{(s?.units ?? []).map((u, i) => {
							const offset = [0, 1, 2, 1][i % 4]!;
							const current = u.id === s?.next;
							return (
								<li key={u.id} className="relative flex items-center gap-4 pb-6" style={{ paddingLeft: `${offset * 2.25}rem` }}>
									{i > 0 && (
										<span
											aria-hidden="true"
											className="absolute -top-6 h-6 border-l-[3px] border-dotted border-border"
											style={{ left: `calc(${([0, 1, 2, 1][(i - 1) % 4]! + offset) * 1.125}rem + 1.75rem)` }}
										/>
									)}
									<Link href={`/lesson?unit=${u.id}`} className="group flex items-center gap-4" data-testid={`unit-${u.id}`}>
										<UnitBadge glyph={u.glyph} progress={u.progress} done={u.done} active={current} />
										<span className="min-w-0">
											<span className={cn("block font-ui text-base font-bold", current ? "text-go" : "text-foreground group-hover:text-foreground")}>{u.title}</span>
											<span className="block font-ui text-xs text-muted-foreground">{pathLine(u, current)}</span>
										</span>
									</Link>
								</li>
							);
						})}
					</ol>
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

/** The second line of a path node: done, in progress, up next, or what it
 *  teaches. */
function pathLine(u: UnitSummary, current: boolean): string {
	const pct = u.accuracy !== null && u.reps > 0 ? `${Math.round(u.accuracy * 100)}% right` : null;
	if (u.done) return `Done · ${u.lessons} lesson${u.lessons === 1 ? "" : "s"}${pct ? ` · ${pct}` : ""}`;
	if (u.lessons > 0) return `Lesson ${Math.min(u.lessons + 1, LESSONS_TO_COMPLETE)} of ${LESSONS_TO_COMPLETE} next${pct ? ` · ${pct}` : ""}`;
	return current ? "Up next" : u.tagline;
}

/** A unit's circle: its icon, with a ring that fills as its lessons are
 *  finished and turns gold with a check when the unit is complete. */
function UnitBadge({ glyph, progress, done = false, active = false, size = "md" }: { glyph: string; progress: number; done?: boolean; active?: boolean; size?: "md" | "lg" }) {
	const px = size === "lg" ? 88 : 56;
	const stroke = size === "lg" ? 7 : 5;
	const r = (px - stroke) / 2;
	const c = 2 * Math.PI * r;
	return (
		<span className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full", active && "lh-pulse-ring")} style={{ width: px, height: px }}>
			<svg width={px} height={px} className="absolute inset-0 -rotate-90" aria-hidden="true">
				<circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} />
				<circle
					cx={px / 2}
					cy={px / 2}
					r={r}
					fill="none"
					stroke={done ? "var(--lh-gold)" : "var(--lh-go)"}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={c}
					strokeDashoffset={c * (1 - (done ? 1 : progress))}
					className="transition-[stroke-dashoffset] duration-700"
				/>
			</svg>
			<span
				className={cn(
					"flex items-center justify-center rounded-full",
					size === "lg" ? "size-[66px]" : "size-[40px]",
					active ? "bg-go text-go-ink" : done ? "bg-gold/15 text-gold" : progress > 0 ? "bg-card text-foreground" : "bg-accent text-foreground/70",
				)}
			>
				<UnitIcon name={glyph} className={size === "lg" ? "size-8" : "size-5"} strokeWidth={2.25} />
			</span>
			{done && (
				<span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-background bg-gold text-background" title="Unit complete">
					<CheckIcon className="size-3" strokeWidth={3.5} />
				</span>
			)}
		</span>
	);
}

function GoalRing({ pct, xp, goal }: { pct: number; xp: number; goal: number }) {
	const px = 76;
	const stroke = 8;
	const r = (px - stroke) / 2;
	const c = 2 * Math.PI * r;
	return (
		<span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: px, height: px }} aria-label={`${xp} of ${goal} XP today`}>
			<svg width={px} height={px} className="absolute inset-0 -rotate-90" aria-hidden="true">
				<circle cx={px / 2} cy={px / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} />
				<circle
					cx={px / 2}
					cy={px / 2}
					r={r}
					fill="none"
					stroke="var(--lh-xp)"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={c}
					strokeDashoffset={c * (1 - pct)}
					className="transition-[stroke-dashoffset] duration-700"
				/>
			</svg>
			<span className="text-center">
				<span className="block font-ui text-lg font-black leading-none text-foreground tabular-nums">{xp}</span>
				<span className="block font-ui text-[10px] text-muted-foreground">/ {goal}</span>
			</span>
		</span>
	);
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
