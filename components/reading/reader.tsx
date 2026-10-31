"use client";

/**
 * The reader (LangHarness, 2026-10-28) — the Read task's screen. One
 * episode of a graded story at the learner's level: the text in large
 * Slovak type, every word tappable for its dictionary form and meaning,
 * every sentence with its own play button and a Play all that reads the
 * episode aloud sentence by sentence, a translation a tap away, then a
 * short comprehension check and an end screen that names the new words
 * and the words looked up (both now in the review deck).
 *
 * The story comes from /api/read (src/server/reading.ts): the newest
 * unread episode, or a new one written on the cheap model slot and kept
 * on disk. Nothing here calls a model directly; the only paid step is
 * writing a new episode, and the screen says so before it does.
 *
 * Full screen like a lesson (a focus mode; Escape leaves). The research
 * behind the design is in src/core/reading.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenIcon, ChevronLeftIcon, ChevronRightIcon, LanguagesIcon, LibraryIcon, LoaderCircleIcon, PauseIcon, PlayIcon, RotateCcwIcon, SparklesIcon, Volume2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";
import { SettingsLink } from "@/components/settings/settings-link";
import { useActiveTime } from "@/components/use-active-time";
import { setSpeed, speak, SPEEDS, stopSpeaking, useSpeed } from "@/components/speech";
import { sfx, soundOn } from "@/components/lesson/sound";
import { Check } from "@/components/reading/check";
import { Word } from "@/components/reading/word";
import { genreInfo, gradeAnswers, readXp, type ReadingState, type StoryRecord, type StorySentence, type StoryToken, type WritingProgress } from "@/src/core";

/** What a sentence is read with: the speaker's voice for a line of
 *  dialogue, the narrator's for the rest (stories written before voices
 *  were assigned have neither and get the default). */
export function voiceFor(story: StoryRecord, s: StorySentence): { voice?: string; gender?: "female" | "male"; style: "narration" | "dialogue" } {
	const who = s.who && story.cast?.find((c) => c.name === s.who);
	if (who) return { voice: who.voice, gender: who.gender === "f" ? "female" : "male", style: "dialogue" };
	return { voice: story.narratorVoice, style: "narration" };
}

/** "Episode 3" for the series, the genre's name for the rest. */
function kindOf(story: Pick<StoryRecord, "genre" | "episode">): string {
	return (story.genre ?? "robo") === "robo" ? `Episode ${story.episode}` : genreInfo(story.genre!).label;
}

type Stage = "writing" | "reading" | "questions" | "end" | "shelf" | "error";

interface Outcome {
	xp: number;
	correct: number;
	total: number;
	queued: string[];
	reread: boolean;
	summary: { todayXp: number; dailyGoal: number; streak: { days: number } };
}

const COLUMN = "mx-auto w-full max-w-3xl px-6";

export function Reader({ initial, initialStory }: { initial: ReadingState | null; initialStory?: StoryRecord | null }) {
	const router = useRouter();
	const [state, setState] = useState<ReadingState | null>(initial);
	const [story, setStory] = useState<StoryRecord | null>(initialStory ?? initial?.current ?? null);
	// The library shows first when today's episode is already read and
	// nothing new is waiting: another episode costs a model call, so it is
	// a choice, not a side effect of opening the page.
	const [stage, setStage] = useState<Stage>(initialStory ?? initial?.current ? "reading" : initial && !initial.canWrite ? "error" : initial && initial.readToday > 0 ? "shelf" : "writing");
	const [error, setError] = useState<string | null>(initial && !initial.canWrite && !initial.current && !initialStory ? "No model is set up yet. Stories are written on the cheap model slot." : null);
	const [tapped, setTapped] = useState<string[]>([]);
	const [answers, setAnswers] = useState<number[]>([]);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [saving, setSaving] = useState(false);
	const startedAt = useRef(Date.now());
	// Reading is mostly not clicking: the day's minutes count the time this
	// tab is visible and focused while an episode is being read or its
	// questions answered (`ms` stays the wall-clock).
	const activeTime = useActiveTime("read", "passive", { active: stage === "reading" || stage === "questions" });

	const load = useCallback(async () => {
		try {
			const res = await fetch(`/api/read?tz=${new Date().getTimezoneOffset()}`);
			if (res.ok) setState((await res.json()) as ReadingState);
		} catch {
			// the page keeps what it has
		}
	}, []);

	/** The next episode: the newest unread one, or a new one written now. */
	const next = useCallback(async () => {
		setStage("writing");
		setError(null);
		try {
			const res = await fetch("/api/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "next" }) });
			const body = (await res.json()) as StoryRecord | { message: string };
			if (!res.ok || !("sentences" in body)) throw new Error("message" in body ? body.message : `HTTP ${res.status}`);
			setStory(body);
			setTapped([]);
			setAnswers([]);
			setOutcome(null);
			startedAt.current = Date.now();
			activeTime.restart();
			setStage("reading");
			void load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setStage("error");
		}
	}, [load, activeTime]);

	// Opened with nothing to read and nothing read today: write the episode.
	const kicked = useRef(false);
	useEffect(() => {
		if (kicked.current || stage !== "writing") return;
		kicked.current = true;
		void next();
	}, [stage, next]);

	const open = (id: string) => {
		void fetch(`/api/read?id=${encodeURIComponent(id)}`)
			.then((r) => (r.ok ? (r.json() as Promise<StoryRecord>) : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((s) => {
				setStory(s);
				setTapped([]);
				setAnswers([]);
				setOutcome(null);
				startedAt.current = Date.now();
				activeTime.restart();
				setStage("reading");
			})
			.catch((err: Error) => {
				setError(err.message);
				setStage("error");
			});
	};

	const finish = useCallback(
		async (all: number[]) => {
			if (!story || saving) return;
			setSaving(true);
			setStage("end");
			sfx.done();
			try {
				const res = await fetch("/api/read", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ action: "finish", storyId: story.id, answers: all, tapped, ms: Date.now() - startedAt.current, activeMs: activeTime.finish(), tz: new Date().getTimezoneOffset() }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				setOutcome((await res.json()) as Outcome);
				void load();
			} catch {
				const g = gradeAnswers(story.questions, all);
				setOutcome({ xp: readXp(story.sentences.length, g.correct, false), ...g, queued: [], reread: false, summary: { todayXp: 0, dailyGoal: 50, streak: { days: 0 } } });
			} finally {
				setSaving(false);
			}
		},
		[story, saving, tapped, load, activeTime],
	);

	// Escape leaves, like a lesson — unless a word popover is open, which
	// it closes first.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !document.querySelector("[data-word-popover]")) router.push("/");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [router]);

	const onTap = (slugOrText: string) => setTapped((t) => (t.includes(slugOrText) ? t : [...t, slugOrText]));

	if (stage === "writing") return <Writing initial={state?.generating ?? null} />;

	if (stage === "error") {
		return (
			<Frame>
				<div className="m-auto max-w-md text-center" data-testid="read-error">
					<p className="font-prose text-lg text-foreground">{error ?? "Something went wrong."}</p>
					<div className="mt-6 flex flex-wrap justify-center gap-3">
						{state?.canWrite !== false && (
							<button type="button" onClick={() => void next()} className={PRIMARY}>
								Try again
							</button>
						)}
						{state?.canWrite === false && (
							<SettingsLink className={PRIMARY}>Set up a model</SettingsLink>
						)}
						{(state?.library.length ?? 0) > 0 && (
							<button type="button" onClick={() => setStage("shelf")} className={SECONDARY}>
								The library
							</button>
						)}
						<Link href="/" className={SECONDARY}>
							Today
						</Link>
					</div>
				</div>
			</Frame>
		);
	}

	if (stage === "shelf" || !story) {
		return (
			<Frame>
				<Shelf state={state} onOpen={open} onWrite={() => void next()} />
			</Frame>
		);
	}

	if (stage === "questions") {
		return (
			<Frame strip={false}>
				<TopBar story={story} step={`Question ${Math.min(answers.length + 1, story.questions.length)} of ${story.questions.length}`} progress={story.questions.length ? answers.length / story.questions.length : 1} onShelf={() => setStage("shelf")} />
				<Check
					questions={story.questions}
					answers={answers}
					onAnswer={(i) => {
						const all = [...answers, i];
						setAnswers(all);
						if (all.length >= story.questions.length) void finish(all);
					}}
				/>
			</Frame>
		);
	}

	if (stage === "end") {
		return (
			<Frame>
				<End story={story} tapped={tapped} outcome={outcome} saving={saving} onAgain={() => open(story.id)} onNext={() => void next()} onShelf={() => setStage("shelf")} canWrite={state?.canWrite ?? true} unreadLeft={(state?.library ?? []).some((s) => s.reads === 0 && s.id !== story.id)} />
			</Frame>
		);
	}

	return (
		<Frame strip={false}>
			<TopBar story={story} step={`${story.sentences.length} sentences · ${story.wordCount} words`} progress={0} onShelf={() => setStage("shelf")} />
			<Text story={story} tapped={tapped} onTap={onTap} onDone={() => (story.questions.length ? setStage("questions") : void finish([]))} />
		</Frame>
	);
}

// ─── Writing ────────────────────────────────────────────────────────────────

/** The sentences arrive as the model writes them: the learner starts
 *  reading before the questions are even written. */
function Writing({ initial }: { initial: WritingProgress | null }) {
	const [progress, setProgress] = useState<WritingProgress | null>(initial);
	useEffect(() => {
		let live = true;
		const tick = async () => {
			try {
				const res = await fetch("/api/read?progress");
				if (res.ok && live) {
					const body = (await res.json()) as { generating: WritingProgress | null };
					if (body.generating) setProgress(body.generating);
				}
			} catch {
				// the next tick tries again
			}
		};
		void tick();
		const timer = setInterval(() => void tick(), 700);
		return () => {
			live = false;
			clearInterval(timer);
		};
	}, []);
	const label = progress ? (progress.genre === "robo" ? "the next Robo episode" : `a ${genreInfo(progress.genre).label.toLowerCase()}`) : "your next story";
	const lines = progress?.sentences ?? [];
	return (
		<Frame>
			<div className="flex flex-1 flex-col overflow-y-auto pb-10 pt-[6vh]">
				<div className={cn(COLUMN, lines.length === 0 && "m-auto max-w-md text-center")} data-testid="read-writing">
					<div className={cn("flex items-center gap-4", lines.length === 0 && "flex-col")}>
						<div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-flame/15 text-flame">
							<SparklesIcon className="size-7 lh-flicker" />
						</div>
						<div>
							<h1 className="font-ui text-2xl font-black text-foreground">Writing {label}…</h1>
							<p className="mt-1 font-prose text-base text-muted-foreground">
								{progress ? `${progress.level} · from the words you know` : "At your level, from the words you know"} · kept in your library, so it is written once.
							</p>
						</div>
					</div>
					{lines.length > 0 ? (
						<div className="mt-8 flex flex-col gap-4" aria-live="polite">
							{lines.map((line, i) => (
								<p key={i} className="lh-rise font-prose text-[1.65rem] leading-[1.6] text-foreground" lang="sk">
									{line}
								</p>
							))}
							<p className="mt-2 flex items-center gap-2 font-ui text-sm text-muted-foreground">
								<LoaderCircleIcon className="size-4 animate-spin" />
								Still writing: the rest, the meanings and the questions
							</p>
						</div>
					) : (
						<p className="mt-6 flex items-center justify-center gap-2 font-ui text-sm text-muted-foreground">
							<LoaderCircleIcon className="size-4 animate-spin" />
							The first sentences appear in a few seconds
						</p>
					)}
				</div>
			</div>
		</Frame>
	);
}

// ─── Chrome ─────────────────────────────────────────────────────────────────

function Frame({ children, strip = true }: { children: React.ReactNode; strip?: boolean }) {
	return (
		<div className="fixed inset-0 z-40 flex flex-col bg-background">
			{strip && <div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />}
			{children}
		</div>
	);
}

function TopBar({ story, step, progress, onShelf }: { story: StoryRecord; step: string; progress: number; onShelf: () => void }) {
	return (
		<div className="lh-drag lh-wco-gutter shrink-0 select-none">
			<div className={cn(COLUMN, "flex h-16 items-center gap-4 pt-2")}>
				<Link href="/" aria-label="Leave the story" className="-ml-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
					<XIcon className="size-5" />
				</Link>
				<div className="min-w-0 flex-1">
					<p className="truncate font-ui text-sm font-bold text-foreground">
						{kindOf(story)} · <span className="text-muted-foreground">{step}</span>
					</p>
					<div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent">
						<div className="h-full rounded-full bg-xp transition-[width] duration-500 ease-out" style={{ width: `${Math.max(2, progress * 100)}%` }} />
					</div>
				</div>
				<SpeedPill />
				<button type="button" onClick={onShelf} aria-label="The library" title="The library" className="-mr-1.5 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
					<LibraryIcon className="size-5" />
				</button>
			</div>
		</div>
	);
}

function SpeedPill() {
	const speed = useSpeed();
	const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length] ?? 1;
	return (
		<button
			type="button"
			onClick={() => setSpeed(next)}
			title="Playback speed"
			aria-label={`Playback speed ${speed}×, click for ${next}×`}
			className="rounded-lg px-2 py-1 font-ui text-xs font-bold tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
		>
			{speed}×
		</button>
	);
}

// ─── The text ───────────────────────────────────────────────────────────────

function Text({ story, tapped, onTap, onDone }: { story: StoryRecord; tapped: string[]; onTap: (key: string) => void; onDone?: () => void }) {
	const [playing, setPlaying] = useState<number | null>(null);
	const [activeSentence, setActiveSentence] = useState<number>(0);
	const [all, setAll] = useState(false);
	const [showTranslation, setShowTranslation] = useState(false);
	const [viewMode, setViewMode] = useState<"flow" | "focus">("flow");
	const [shown, setShown] = useState<Set<number>>(new Set());
	const [popover, setPopover] = useState<{ sentence: number; token: number } | null>(null);
	const stop = useRef(false);
	const sentenceRefs = useRef<(HTMLElement | null)[]>([]);

	const scrollToSentence = (i: number) => {
		const el = sentenceRefs.current[i];
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "nearest" });
		}
	};

	// Play all: sentence after sentence, the current one highlighted.
	const playAll = async (startIndex?: number) => {
		if (all) {
			stop.current = true;
			stopSpeaking();
			setAll(false);
			setPlaying(null);
			return;
		}
		if (!soundOn()) return;
		stop.current = false;
		setAll(true);
		const start = startIndex !== undefined ? startIndex : (activeSentence < story.sentences.length ? activeSentence : 0);
		for (let i = start; i < story.sentences.length; i++) {
			if (stop.current) break;
			setActiveSentence(i);
			setPlaying(i);
			scrollToSentence(i);
			await speak(story.sentences[i]!.sk, undefined, voiceFor(story, story.sentences[i]!)).catch(() => {});
		}
		setAll(false);
		setPlaying(null);
	};

	const playOne = async (i: number) => {
		stop.current = true;
		setAll(false);
		setActiveSentence(i);
		setPlaying(i);
		scrollToSentence(i);
		await speak(story.sentences[i]!.sk, undefined, voiceFor(story, story.sentences[i]!)).catch(() => {});
		setPlaying((p) => (p === i ? null : p));
	};

	const replayCurrent = () => {
		void playOne(activeSentence);
	};

	const stepSentence = (delta: number) => {
		const next = Math.max(0, Math.min(story.sentences.length - 1, activeSentence + delta));
		setActiveSentence(next);
		scrollToSentence(next);
		if (all) {
			void playAll(next);
		}
	};

	useEffect(() => {
		if (!popover) return;
		const close = (e: MouseEvent) => {
			const t = e.target as HTMLElement | null;
			if (!t?.closest("[data-word-popover]") && !t?.closest("[data-word]")) setPopover(null);
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPopover(null);
		window.addEventListener("mousedown", close);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("mousedown", close);
			window.removeEventListener("keydown", onKey);
		};
	}, [popover]);

	// Keyboard controls: Space for Play/Pause, Left/Right or Up/Down for stepping
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || popover) return;
			if (e.code === "Space") {
				e.preventDefault();
				void playAll();
			} else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
				e.preventDefault();
				stepSentence(1);
			} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
				e.preventDefault();
				stepSentence(-1);
			} else if (e.key.toLowerCase() === "r") {
				e.preventDefault();
				replayCurrent();
			} else if (e.key.toLowerCase() === "t") {
				e.preventDefault();
				setShowTranslation((v) => !v);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const toggleShown = (i: number) =>
		setShown((s) => {
			const n = new Set(s);
			if (n.has(i)) n.delete(i);
			else n.add(i);
			return n;
		});

	// Group contiguous narration sentences into paragraph blocks
	const blocks: { isDialogue: boolean; sentences: { sentence: (typeof story.sentences)[0]; index: number }[] }[] = [];
	for (let i = 0; i < story.sentences.length; i++) {
		const s = story.sentences[i]!;
		const isDialogue = !!s.who && s.who.toLowerCase() !== "narrator";
		if (isDialogue) {
			blocks.push({ isDialogue: true, sentences: [{ sentence: s, index: i }] });
		} else {
			const last = blocks[blocks.length - 1];
			if (last && !last.isDialogue) {
				last.sentences.push({ sentence: s, index: i });
			} else {
				blocks.push({ isDialogue: false, sentences: [{ sentence: s, index: i }] });
			}
		}
	}

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			{/* Top Control Tabs — Speakly style */}
			<div className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-2 backdrop-blur">
				<div className={cn(COLUMN, "flex flex-wrap items-center justify-between gap-2")}>
					<div className="flex items-center rounded-xl bg-accent/60 p-1 text-xs font-bold font-ui">
						<button
							type="button"
							onClick={() => setShowTranslation(false)}
							className={cn(
								"rounded-lg px-3 py-1.5 transition-colors",
								!showTranslation ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
							)}
						>
							Tekst (Text)
						</button>
						<button
							type="button"
							onClick={() => setShowTranslation(true)}
							className={cn(
								"rounded-lg px-3 py-1.5 transition-colors",
								showTranslation ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
							)}
						>
							Preklad (Translation)
						</button>
					</div>

					<div className="flex items-center gap-2">
						<div className="flex items-center rounded-xl bg-accent/60 p-1 text-xs font-bold font-ui">
							<button
								type="button"
								onClick={() => setViewMode("flow")}
								className={cn(
									"rounded-lg px-2.5 py-1.5 transition-colors",
									viewMode === "flow" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
								)}
								title="Plynulý text (Continuous prose flow)"
							>
								Príbeh
							</button>
							<button
								type="button"
								onClick={() => setViewMode("focus")}
								className={cn(
									"rounded-lg px-2.5 py-1.5 transition-colors",
									viewMode === "focus" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
								)}
								title="Jedna veta (Sentence focus mode)"
							>
								Veta po vete
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Main Scrollable Reading Area */}
			<div className="flex-1 overflow-y-auto pb-36 pt-6">
				<article className={cn(COLUMN, "lh-rise")} data-testid="read-text">
					{/* Story Introduction Card */}
					<div className="mb-8 rounded-3xl border border-border/80 bg-card/60 p-5 shadow-sm">
						<div className="flex items-center gap-2">
							<span className="rounded-full bg-flame/15 px-2.5 py-0.5 font-ui text-xs font-black uppercase tracking-wider text-flame">
								{story.level}
							</span>
							<span className="font-ui text-xs font-bold text-muted-foreground first-letter:uppercase">
								{(story.genre ?? "robo") === "robo" ? story.theme : genreInfo(story.genre!).label}
								{story.topic ? ` · ${story.topic}` : ""}
							</span>
						</div>
						<h1 className="mt-2 font-ui text-3xl font-black tracking-tight text-foreground md:text-4xl" lang="sk">
							{story.title}
						</h1>
						{story.recap && (
							<p className="mt-2 font-prose text-sm leading-relaxed text-muted-foreground">
								{story.recap}
							</p>
						)}
					</div>

					{/* View Mode: Sentence Focus Mode (LingQ Style) */}
					{viewMode === "focus" && (
						<div className="my-8 flex min-h-[300px] flex-col items-center justify-center rounded-3xl border-2 border-border/80 bg-card p-6 text-center shadow-md">
							{story.sentences[activeSentence]?.who && (
								<span className="mb-3 inline-block rounded-full bg-xp/15 px-3 py-1 font-ui text-xs font-bold uppercase tracking-wider text-xp" data-testid="read-speaker">
									{story.sentences[activeSentence]?.who}
								</span>
							)}
							<div
								ref={(el) => {
									sentenceRefs.current[activeSentence] = el;
								}}
								className="font-prose text-2xl md:text-3xl leading-relaxed text-foreground"
								lang="sk"
								data-testid="read-sentence"
							>
								{story.sentences[activeSentence]?.tokens.map((t, j) =>
									t.word ? (
										<Word
											key={j}
											token={t}
											looked={tapped.includes(t.slug ?? t.text.toLocaleLowerCase("sk-SK"))}
											open={popover?.sentence === activeSentence && popover.token === j}
											onOpen={() => {
												setPopover({ sentence: activeSentence, token: j });
												onTap(t.slug ?? t.text.toLocaleLowerCase("sk-SK"));
												sfx.tap();
											}}
											onClose={() => setPopover(null)}
										/>
									) : (
										<span key={j}>{t.text}</span>
									),
								)}
							</div>
							{(showTranslation || shown.has(activeSentence)) && (
								<p className="mt-4 max-w-lg font-prose text-lg text-muted-foreground" data-testid="read-translation">
									{story.sentences[activeSentence]?.en}
								</p>
							)}
						</div>
					)}

					{/* View Mode: Continuous Story Flow (Speakly Style) */}
					{viewMode === "flow" && (
						<div className="space-y-6">
							{blocks.map((block, bi) =>
								block.isDialogue ? (
									/* Dialogue Line */
									<div
										key={bi}
										ref={(el) => {
											sentenceRefs.current[block.sentences[0]!.index] = el;
										}}
										className={cn(
											"group relative rounded-2xl border border-transparent p-3.5 transition-all duration-200",
											playing === block.sentences[0]!.index
												? "border-xp/40 bg-xp/10 shadow-sm"
												: activeSentence === block.sentences[0]!.index
													? "border-border/80 bg-accent/30"
													: "hover:bg-accent/20",
										)}
										data-testid="read-sentence"
										onClick={() => {
											setActiveSentence(block.sentences[0]!.index);
										}}
									>
										<div className="flex items-baseline gap-2">
											<span
												className="shrink-0 rounded-md bg-xp/15 px-2 py-0.5 font-ui text-xs font-bold uppercase tracking-wider text-xp"
												data-testid="read-speaker"
											>
												{block.sentences[0]!.sentence.who}
											</span>
											<div className="min-w-0 flex-1 font-prose text-xl md:text-2xl leading-relaxed text-foreground" lang="sk">
												{block.sentences[0]!.sentence.tokens.map((t, j) =>
													t.word ? (
														<Word
															key={j}
															token={t}
															looked={tapped.includes(t.slug ?? t.text.toLocaleLowerCase("sk-SK"))}
															open={popover?.sentence === block.sentences[0]!.index && popover.token === j}
															onOpen={() => {
																setPopover({ sentence: block.sentences[0]!.index, token: j });
																onTap(t.slug ?? t.text.toLocaleLowerCase("sk-SK"));
																sfx.tap();
															}}
															onClose={() => setPopover(null)}
														/>
													) : (
														<span key={j}>{t.text}</span>
													),
												)}
											</div>
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													void playOne(block.sentences[0]!.index);
												}}
												className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
												title="Prehrať vetu"
											>
												<Volume2Icon className="size-4" />
											</button>
										</div>
										{(showTranslation || shown.has(block.sentences[0]!.index)) && (
											<p className="mt-2 pl-2 font-prose text-base text-muted-foreground/90 italic" data-testid="read-translation">
												{block.sentences[0]!.sentence.en}
											</p>
										)}
									</div>
								) : (
									/* Narration Paragraph */
									<div key={bi} className="rounded-2xl p-2 transition-colors">
										<p className="font-prose text-xl md:text-2xl leading-relaxed text-foreground" lang="sk">
											{block.sentences.map(({ sentence: s, index: i }) => (
												<span
													key={i}
													ref={(el) => {
														sentenceRefs.current[i] = el;
													}}
													onClick={() => setActiveSentence(i)}
													className={cn(
														"inline cursor-pointer rounded-lg px-1 py-0.5 transition-all duration-150",
														playing === i
															? "bg-xp/25 font-medium text-foreground ring-1 ring-xp/50"
															: activeSentence === i
																? "bg-accent/60 ring-1 ring-border"
																: "hover:bg-accent/40",
													)}
													data-testid="read-sentence"
												>
													{s.tokens.map((t, j) =>
														t.word ? (
															<Word
																key={j}
																token={t}
																looked={tapped.includes(t.slug ?? t.text.toLocaleLowerCase("sk-SK"))}
																open={popover?.sentence === i && popover.token === j}
																onOpen={() => {
																	setPopover({ sentence: i, token: j });
																	onTap(t.slug ?? t.text.toLocaleLowerCase("sk-SK"));
																	sfx.tap();
																}}
																onClose={() => setPopover(null)}
															/>
														) : (
															<span key={j}>{t.text}</span>
														),
													)}
													{" "}
												</span>
											))}
										</p>
										{/* Show translations for paragraph if enabled */}
										{showTranslation && (
											<div className="mt-3 space-y-1 border-l-2 border-border/70 pl-3">
												{block.sentences.map(({ sentence: s, index: i }) => (
													<p key={i} className="font-prose text-sm text-muted-foreground leading-normal" data-testid="read-translation">
														{s.en}
													</p>
												))}
											</div>
										)}
									</div>
								),
							)}
						</div>
					)}

					{/* New Words List */}
					{story.newWords.length > 0 && (
						<div className="mt-10 rounded-3xl border border-border/80 bg-card p-5 shadow-sm" data-testid="read-new-words">
							<p className="font-ui text-sm font-bold text-muted-foreground">Nové slová v príbehu (New words)</p>
							<ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
								{story.newWords.map((w) => (
									<li key={w.lemma} className="font-prose text-base">
										<span className="font-bold text-foreground" lang="sk">
											{w.lemma}
										</span>
										{" — "}
										<span className="text-muted-foreground">{w.gloss}</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</article>
			</div>

			{/* Docked Audio Player Bar — Speakly & LingQ Style */}
			<div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 shadow-2xl backdrop-blur-md">
				<div className={cn(COLUMN, "flex flex-col gap-2 py-3 px-4")}>
					{/* Progress bar across sentences */}
					<div className="flex items-center gap-3">
						<span className="shrink-0 font-ui text-xs font-bold text-muted-foreground tabular-nums">
							{activeSentence + 1} / {story.sentences.length}
						</span>
						<div className="relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-accent" onClick={(e) => {
							const rect = e.currentTarget.getBoundingClientRect();
							const ratio = (e.clientX - rect.left) / rect.width;
							const idx = Math.min(story.sentences.length - 1, Math.max(0, Math.floor(ratio * story.sentences.length)));
							setActiveSentence(idx);
							scrollToSentence(idx);
						}}>
							<div
								className="h-full rounded-full bg-xp transition-all duration-300"
								style={{ width: `${((activeSentence + 1) / story.sentences.length) * 100}%` }}
							/>
						</div>
						<span className="shrink-0 font-ui text-xs font-bold text-muted-foreground">
							{Math.round(((activeSentence + 1) / story.sentences.length) * 100)}%
						</span>
					</div>

					{/* Control Buttons */}
					<div className="flex items-center justify-between gap-3 pt-1">
						{/* Left: Speed & Step Controls */}
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => stepSentence(-1)}
								disabled={activeSentence === 0}
								aria-label="Previous sentence"
								className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
							>
								<ChevronLeftIcon className="size-5" />
							</button>
							<button
								type="button"
								onClick={replayCurrent}
								aria-label="Replay current sentence"
								title="Prehrať znova (R)"
								className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<RotateCcwIcon className="size-4" />
							</button>
							<button
								type="button"
								onClick={() => stepSentence(1)}
								disabled={activeSentence >= story.sentences.length - 1}
								aria-label="Next sentence"
								className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
							>
								<ChevronRightIcon className="size-5" />
							</button>
						</div>

						{/* Center: Big Play / Pause Button */}
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => void playAll()}
								className="flex h-12 items-center gap-2 rounded-2xl bg-xp px-5 font-ui text-sm font-bold text-white shadow-md transition-transform hover:scale-105 active:scale-95"
								data-testid="read-play-all"
								aria-pressed={all}
							>
								{all ? <PauseIcon className="size-5 fill-current" /> : <PlayIcon className="size-5 fill-current" />}
								<span>{all ? "Pozastaviť" : "Prehrať všetko"}</span>
							</button>
						</div>

						{/* Right: Done / Check Questions Button */}
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={onDone}
								className={PRIMARY}
								data-testid="read-done"
							>
								{story.questions.length ? `${story.questions.length} otázok` : "Hotovo"}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── The end ────────────────────────────────────────────────────────────────

function End({ story, tapped, outcome, saving, onAgain, onNext, onShelf, canWrite, unreadLeft }: { story: StoryRecord; tapped: string[]; outcome: Outcome | null; saving: boolean; onAgain: () => void; onNext: () => void; onShelf: () => void; canWrite: boolean; unreadLeft: boolean }) {
	const looked = useMemo(() => {
		const seen = new Set<string>();
		const out: StoryToken[] = [];
		for (const t of story.sentences.flatMap((s) => s.tokens)) {
			const key = t.slug ?? t.text.toLocaleLowerCase("sk-SK");
			if (!t.word || !tapped.includes(key) || seen.has(key)) continue;
			seen.add(key);
			out.push(t);
		}
		return out;
	}, [story, tapped]);
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" && outcome) {
				e.preventDefault();
				onShelf();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [outcome, onShelf]);
	const total = outcome?.total ?? story.questions.length;
	return (
		<div className="m-auto w-full max-w-xl px-5 text-center" data-testid="read-end">
			<div className="lh-pop mx-auto flex size-24 items-center justify-center rounded-full bg-flame/15 text-flame">
				<BookOpenIcon className="size-12" />
			</div>
			<h1 className="mt-5 font-ui text-4xl font-black text-foreground">{outcome?.reread ? "Read again!" : "Episode read!"}</h1>
			<p className="mt-2 font-prose text-lg text-muted-foreground" lang="sk">
				{story.title}
			</p>
			<div className="mt-8 grid grid-cols-3 gap-3">
				<Stat label="XP" value={saving || !outcome ? "…" : `+${outcome.xp}`} ink="text-xp" />
				<Stat label="Understood" value={outcome ? (total ? `${outcome.correct}/${total}` : "—") : "…"} ink="text-go" />
				<Stat label="Words" value={String(story.wordCount)} ink="text-flame" />
			</div>
			{outcome && (
				<p className="mt-4 font-prose text-sm text-muted-foreground">
					{outcome.queued.length > 0 ? `${outcome.queued.length} new word${outcome.queued.length === 1 ? "" : "s"} added to your review deck. ` : ""}
					{Math.round(story.coverage * 100)}% of the words were ones you knew.
				</p>
			)}
			{(story.newWords.length > 0 || looked.length > 0) && (
				<div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
					{story.newWords.length > 0 && (
						<div className="rounded-2xl border bg-card p-4">
							<p className="font-ui text-sm font-bold text-muted-foreground">New words</p>
							<ul className="mt-2 flex flex-col gap-1">
								{story.newWords.slice(0, 8).map((w) => (
									<li key={w.lemma} className="font-prose text-base leading-snug">
										<span className="font-bold text-foreground" lang="sk">
											{w.lemma}
										</span>{" "}
										<span className="text-muted-foreground">{w.gloss}</span>
									</li>
								))}
							</ul>
						</div>
					)}
					{looked.length > 0 && (
						<div className="rounded-2xl border bg-card p-4">
							<p className="font-ui text-sm font-bold text-muted-foreground">You looked up</p>
							<ul className="mt-2 flex flex-col gap-1">
								{looked.slice(0, 8).map((t) => (
									<li key={t.slug ?? t.text} className="font-prose text-base leading-snug">
										<span className="font-bold text-foreground" lang="sk">
											{t.lemma ?? t.text}
										</span>{" "}
										<span className="text-muted-foreground">{t.gloss ?? ""}</span>
									</li>
								))}
								{looked.length > 8 && <li className="font-prose text-sm text-muted-foreground">and {looked.length - 8} more</li>}
							</ul>
						</div>
					)}
				</div>
			)}
			<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
				<Link href="/" className={SECONDARY}>
					Today
				</Link>
				<button type="button" onClick={onAgain} className={SECONDARY}>
					Read again
				</button>
				{unreadLeft ? (
					<button type="button" onClick={onNext} className={PRIMARY}>
						Next story
					</button>
				) : (
					<button type="button" onClick={onShelf} className={PRIMARY} data-testid="read-shelf">
						The library
					</button>
				)}
			</div>
			{!unreadLeft && canWrite && <p className="mt-3 font-prose text-xs text-muted-foreground">The shelf is being filled in the background; the next story is a tap away in the library.</p>}
		</div>
	);
}

function Stat({ label, value, ink }: { label: string; value: string; ink: string }) {
	return (
		<div className="rounded-2xl border-2 bg-card px-3 py-4">
			<p className="font-ui text-sm font-bold text-muted-foreground">{label}</p>
			<p className={cn("mt-1 font-ui text-3xl font-black tabular-nums", ink)}>{value}</p>
		</div>
	);
}

// ─── The library ────────────────────────────────────────────────────────────

function Shelf({ state, onOpen, onWrite }: { state: ReadingState | null; onOpen: (id: string) => void; onWrite: () => void }) {
	const list = [...(state?.library ?? [])].reverse();
	const unread = list.filter((s) => s.reads === 0).length;
	return (
		<div className="flex flex-1 flex-col overflow-y-auto pb-10 pt-[6vh]">
			<div className={cn(COLUMN, "lh-rise")} data-testid="read-shelf-list">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Your library</p>
						<h1 className="mt-1 font-ui text-3xl font-black text-foreground">Stories at your level</h1>
						<p className="mt-1 font-prose text-base text-muted-foreground">
							{list.length === 0 ? "Nothing yet." : `${list.length} ${list.length === 1 ? "story" : "stories"}${unread ? ` · ${unread} unread` : ""}${state?.readToday ? ` · ${state.readToday} read today` : ""}`}
							{state?.generating ? ` · writing ${state.generating.genre === "robo" ? "a Robo episode" : `a ${genreInfo(state.generating.genre).label.toLowerCase()}`} (${state.generating.level})…` : ""}
						</p>
						{state?.current && state.pick && (
							<p className="mt-1 font-prose text-sm text-muted-foreground" data-testid="read-pick">
								Up next: <span className="text-foreground">{state.current.title}</span> · {state.pick.line}
							</p>
						)}
					</div>
					<div className="flex gap-3">
						<Link href="/" className={SECONDARY}>
							Today
						</Link>
						{state?.canWrite !== false && (
							<button type="button" onClick={onWrite} className={PRIMARY} data-testid="read-write-next" title="One model call on the cheap slot">
								<SparklesIcon className="size-4" />
								{unread ? "Read the next" : "Write a new one"}
							</button>
						)}
					</div>
				</div>
				<ol className="mt-6 flex flex-col gap-2">
					{list.map((s) => (
						<li key={s.id}>
							<button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center gap-4 rounded-2xl border-2 bg-card px-5 py-4 text-left transition-colors hover:border-foreground/40" data-testid="read-shelf-item">
								<span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl font-ui text-xs font-black", s.reads > 0 ? "bg-accent text-muted-foreground" : "bg-flame/15 text-flame")}>{(s.genre ?? "robo") === "robo" ? s.episode : s.level}</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-ui text-lg font-bold text-foreground" lang="sk">
										{s.title}
									</span>
									<span className="block truncate font-prose text-sm text-muted-foreground">
										{s.level} · {(s.genre ?? "robo") === "robo" ? `Robo · ${s.theme}` : genreInfo(s.genre!).label}{s.topic ? ` · ${s.topic}` : ""} · {s.wordCount} words{s.newWords.length ? ` · new: ${s.newWords.slice(0, 4).join(", ")}` : ""}
									</span>
								</span>
								<span className="shrink-0 text-right font-ui text-xs font-bold text-muted-foreground">
									{s.reads === 0 ? <span className="text-flame">unread</span> : s.lastScore ? `${s.lastScore.correct}/${s.lastScore.total} · read ${s.reads}×` : `read ${s.reads}×`}
								</span>
							</button>
						</li>
					))}
				</ol>
				{list.length === 0 && state?.canWrite === false && (
					<p className="mt-6 font-prose text-base text-muted-foreground">
						Stories are written on the cheap model slot. <SettingsLink className="underline">Set up a model</SettingsLink> to get the first episode.
					</p>
				)}
			</div>
		</div>
	);
}
