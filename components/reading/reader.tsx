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
import { BookOpenIcon, BookmarkIcon, CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, LanguagesIcon, LibraryIcon, LoaderCircleIcon, PauseIcon, PlayIcon, RotateCcwIcon, SearchIcon, SparklesIcon, Volume2Icon, XIcon } from "lucide-react";
import { EmptyState, KeyNote, AddKeyButton } from "@/components/quiet/empty-state";
import { cn } from "@/lib/utils";
import { NavRail } from "@/components/nav-rail";
import { PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";
import { SettingsLink } from "@/components/settings/settings-link";
import { useActiveTime } from "@/components/use-active-time";
import { setSpeed, speak, SPEEDS, stopSpeaking, useSpeed } from "@/components/speech";
import { sfx, soundOn } from "@/components/lesson/sound";
import { Check } from "@/components/reading/check";
import { Word } from "@/components/reading/word";
import { genreInfo, gradeAnswers, readXp, type ReadingState, type StoryRecord, type StorySentence, type StoryToken, type WritingProgress } from "@/src/core";
import { fillStyle } from "@/components/ui/fill";

export function levelBadgeStyle(level: string): string {
	switch (level) {
		case "A1":
			return "bg-teal-wash text-teal-2 border-teal-line";
		case "A2":
			return "bg-teal-wash text-teal-2 border-teal-line";
		case "B1":
			return "bg-teal-wash text-teal-2 border-teal-line";
		case "B2":
		case "C1":
			return "bg-purple-500/15 text-purple-400 border-purple-500/30";
		default:
			return "bg-accent text-muted-foreground border-border/60";
	}
}

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

export function Reader({ initial, initialStory, startOnShelf = false }: { initial: ReadingState | null; initialStory?: StoryRecord | null; startOnShelf?: boolean }) {
	const router = useRouter();
	const [state, setState] = useState<ReadingState | null>(initial);
	const [story, setStory] = useState<StoryRecord | null>(initialStory ?? initial?.current ?? null);
	// The library shows first when today's episode is already read and
	// nothing new is waiting: another episode costs a model call, so it is
	// a choice, not a side effect of opening the page.
	const [stage, setStage] = useState<Stage>(startOnShelf && !initialStory ? "shelf" : initialStory ?? initial?.current ? "reading" : initial && !initial.canWrite ? "shelf" : initial && initial.readToday > 0 ? "shelf" : "writing");
	const [error, setError] = useState<string | null>(null);
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
				<div className={cn(COLUMN, "pt-[8vh]")}>
					<EmptyState
						testid="read-error"
						title="The episode could not be written"
						action={
							<button type="button" onClick={() => void next()} className="q-btn primary">
								Try again
							</button>
						}
						secondary={
							<button type="button" onClick={() => setStage("shelf")} className="q-btn ghost">
								Back to the library
							</button>
						}
					>
						<p>{error ?? "Something went wrong."}</p>
						<p>Episodes you have already read are still in the library.</p>
					</EmptyState>
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
				<TopBar story={story} step={`Question ${Math.min(answers.length + 1, story.questions.length)} of ${story.questions.length}`} progress={story.questions.length ? answers.length / story.questions.length : 1} />
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
						<div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-teal-wash text-teal-2">
							<SparklesIcon className="size-7 lh-flicker" />
						</div>
						<div>
							<h1 className="font-ui text-2xl font-[600] text-foreground">Writing {label}…</h1>
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
		<>
			<NavRail />
			<div className="fixed inset-y-0 right-0 left-0 z-40 flex flex-col bg-background md:left-14">
			{strip && <div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />}
			{children}
			</div>
		</>
	);
}

function TopBar({ story, step, progress }: { story: StoryRecord; step: string; progress: number }) {
	return (
		<div className="lh-drag lh-wco-gutter shrink-0 select-none">
			<div className={cn(COLUMN, "flex h-16 items-center gap-4 pt-2")}>
				<Link href="/" aria-label="Leave the story" className="-ml-1.5 pointer-coarse:-ml-3 rounded-lg p-1.5 pointer-coarse:p-3 text-muted-foreground transition-colors hover:bg-well hover:text-foreground">
					<XIcon className="size-5" />
				</Link>
				<div className="min-w-0 flex-1">
					<p className="truncate text-[14px] font-[600] text-foreground">
						{kindOf(story)} · <span className="text-ink-3">{step}</span>
					</p>
					<div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-well-2">
						<div className="lh-fill rounded-full bg-teal" style={fillStyle(Math.max(0.02, progress))} />
					</div>
				</div>
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
			className="rounded-lg px-2 py-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:px-3 font-ui text-xs font-[600] tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
		>
			{speed}×
		</button>
	);
}

// ─── The text ───────────────────────────────────────────────────────────────

/** Opening marks (Slovak „, parentheses, « ¿ ¡) stay with the word after them; closing marks and punctuation stay with the word before. */
const OPENERS = /^[„(\[«¡¿]+$/;

/**
 * The tokens of a sentence as groups that cannot break inside: a word with the punctuation that touches
 * it, so a full stop or a closing quote is never left alone at the start of a line. Whitespace between
 * groups stays breakable.
 */
export function groupTokens(tokens: readonly StoryToken[]): Array<{ indexes: number[]; space: boolean }> {
	const groups: Array<{ indexes: number[]; space: boolean }> = [];
	let pending: number[] = [];
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i]!;
		if (/^\s+$/.test(t.text)) {
			if (pending.length) {
				groups.push({ indexes: pending, space: false });
				pending = [];
			}
			groups.push({ indexes: [i], space: true });
		} else if (t.word) {
			groups.push({ indexes: [...pending, i], space: false });
			pending = [];
		} else if (OPENERS.test(t.text)) {
			pending.push(i);
		} else {
			const last = groups[groups.length - 1];
			if (last && !last.space) last.indexes.push(i);
			else groups.push({ indexes: [i], space: false });
		}
	}
	if (pending.length) groups.push({ indexes: pending, space: false });
	return groups;
}

function Text({ story, tapped, onTap, onDone }: { story: StoryRecord; tapped: string[]; onTap: (key: string) => void; onDone?: () => void }) {
	const [playing, setPlaying] = useState<number | null>(null);
	const [all, setAll] = useState(false);
	const [showTranslation, setShowTranslation] = useState(false);
	const [large, setLarge] = useState(false);
	const [popover, setPopover] = useState<{ sentence: number; token: number } | null>(null);
	const stop = useRef(false);
	const sentenceRefs = useRef<(HTMLElement | null)[]>([]);

	// Play all: sentence after sentence, the one being read in the accent color.
	const playAll = async () => {
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
		for (let i = 0; i < story.sentences.length; i++) {
			if (stop.current) break;
			setPlaying(i);
			sentenceRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
			await speak(story.sentences[i]!.sk, undefined, voiceFor(story, story.sentences[i]!)).catch(() => {});
		}
		setAll(false);
		setPlaying(null);
	};

	useEffect(() => {
		return () => {
			stop.current = true;
			stopSpeaking();
		};
	}, []);

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

	// Space plays or pauses; T shows or hides the translation.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || popover) return;
			if (e.code === "Space") {
				e.preventDefault();
				void playAll();
			} else if (e.key.toLowerCase() === "t") {
				e.preventDefault();
				setShowTranslation((v) => !v);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	// Narration runs on as a paragraph; a speaker's lines are one block under the speaker's name.
	interface StoryBlock {
		speaker?: string;
		sentences: { sentence: StorySentence; index: number }[];
	}
	const blocks: StoryBlock[] = [];
	for (let i = 0; i < story.sentences.length; i++) {
		const s = story.sentences[i]!;
		const speaker = s.who && s.who.toLowerCase() !== "narrator" ? s.who : undefined;
		const last = blocks[blocks.length - 1];
		if (last && last.speaker === speaker) last.sentences.push({ sentence: s, index: i });
		else blocks.push({ speaker, sentences: [{ sentence: s, index: i }] });
	}

	const minutes = Math.max(1, Math.round(story.wordCount / 80));

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="lh-drag lh-wco-gutter shrink-0 select-none">
				<div className="mx-auto flex h-16 w-full max-w-[40rem] items-center gap-3 px-6 pt-2">
					<Link href="/" aria-label="Leave the story" className="-ml-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-well hover:text-foreground pointer-coarse:-ml-3 pointer-coarse:p-3">
						<XIcon className="size-5" />
					</Link>
					<p className="min-w-0 flex-1 truncate text-[14px] font-[600] text-foreground" lang="sk">
						{story.title}
					</p>
					<Link href="/read?library=1" className="q-btn ghost">
						Library
					</Link>
					<button type="button" onClick={() => setLarge((v) => !v)} aria-pressed={large} className="q-btn ghost !px-2.5" title="Text size">
						<span className="text-[13px]">A</span>
						<span className="-ml-1 text-[17px] leading-none">A</span>
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto pb-32 pt-4 sm:pt-8 [scrollbar-gutter:stable]">
				<article className="mx-auto w-full max-w-[40rem] px-6 lh-rise" data-testid="read-text" data-word-lookup-enabled="true">
					<header className="mb-8">
						<p className="text-[13px] text-ink-3">
							{kindOf(story)} · {story.level} · about {minutes} min
						</p>
						<h1 className="mt-2 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground" lang="sk">
							{story.title}
						</h1>
					</header>

					<div className="flex flex-col gap-6">
						{blocks.map((block, bi) => (
							<div key={bi}>
								{block.speaker && (
									<p className="mb-1 select-none text-[13px] font-[600] text-ink-3" data-testid="read-speaker">
										{block.speaker}
									</p>
								)}
								<p className={cn("font-prose text-foreground [&_[data-word]]:!py-0", large ? "text-[24px] leading-[1.6] max-sm:text-[21px]" : "text-[21px] leading-[1.6] max-sm:text-[19px]")} lang="sk">
									{block.sentences.map(({ sentence: s, index: i }) => (
										<span
											key={i}
											ref={(el) => {
												sentenceRefs.current[i] = el;
											}}
											className={cn("transition-colors duration-150", playing === i && "text-teal-2")}
											data-testid="read-sentence"
										>
											{groupTokens(s.tokens).map((g, gi) =>
												g.space ? (
													<span key={gi}>{s.tokens[g.indexes[0]!]!.text}</span>
												) : (
													<span key={gi} className="whitespace-nowrap">
														{g.indexes.map((j) => {
															const t = s.tokens[j]!;
															return t.word ? (
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
															);
														})}
													</span>
												),
											)}{" "}
										</span>
									))}
								</p>
								{showTranslation && (
									<p className="mt-2 text-[15px] leading-relaxed text-ink-3 select-text" data-testid="read-translation">
										{block.sentences.map((s) => s.sentence.en).join(" ")}
									</p>
								)}
							</div>
						))}
					</div>

					{story.newWords.length > 0 && (
						<section className="mt-12" data-testid="read-new-words" aria-label="New words">
							<h2 className="q-sh">New words</h2>
							<ul className="flex flex-col gap-1.5">
								{story.newWords.map((w) => (
									<li key={w.lemma} className="text-[16px]">
										<span className="font-[600] text-foreground" lang="sk">
											{w.lemma}
										</span>
										<span className="text-ink-3"> · {w.gloss}</span>
									</li>
								))}
							</ul>
						</section>
					)}
				</article>
			</div>

			<div className="fixed inset-x-0 bottom-0 z-30 bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-1px_0_var(--q-line)]">
				<div className="mx-auto flex w-full max-w-[40rem] items-center justify-center gap-2">
					<button type="button" onClick={() => void playAll()} className="q-btn sec" data-testid="read-play-all" aria-pressed={all}>
						{all ? <PauseIcon className="size-4 fill-current" /> : <PlayIcon className="size-4 fill-current" />}
						{all ? "Pause" : "Play all"}
					</button>
					<button type="button" onClick={() => setShowTranslation((v) => !v)} aria-pressed={showTranslation} className="q-btn sec" title="Show or hide the English (T)">
						<LanguagesIcon className="size-4" />
						Translation {showTranslation ? "on" : "off"}
					</button>
					<button type="button" onClick={onDone} className="q-btn primary" data-testid="read-done">
						{story.questions.length ? `Questions (${story.questions.length})` : "Done"}
					</button>
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
			<div className="lh-pop mx-auto flex size-24 items-center justify-center rounded-full bg-teal-wash text-teal-2">
				<BookOpenIcon className="size-12" />
			</div>
			<h1 className="mt-5 font-ui text-4xl font-[600] text-foreground">{outcome?.reread ? "Read again!" : "Episode read!"}</h1>
			<p className="mt-2 font-prose text-lg text-muted-foreground" lang="sk">
				{story.title}
			</p>
			<div className="mt-8 grid grid-cols-3 gap-3">
				<Stat label="XP" value={saving || !outcome ? "…" : `+${outcome.xp}`} ink="text-teal-2" />
				<Stat label="Understood" value={outcome ? (total ? `${outcome.correct}/${total}` : "—") : "…"} ink="text-teal-2" />
				<Stat label="Words" value={String(story.wordCount)} ink="text-teal-2" />
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
						<div className="rounded-lg border bg-card p-4">
							<p className="font-ui text-sm font-[600] text-muted-foreground">New words</p>
							<ul className="mt-2 flex flex-col gap-1">
								{story.newWords.slice(0, 8).map((w) => (
									<li key={w.lemma} className="font-prose text-base leading-snug">
										<span className="font-[600] text-foreground" lang="sk">
											{w.lemma}
										</span>{" "}
										<span className="text-muted-foreground">{w.gloss}</span>
									</li>
								))}
							</ul>
						</div>
					)}
					{looked.length > 0 && (
						<div className="rounded-lg border bg-card p-4">
							<p className="font-ui text-sm font-[600] text-muted-foreground">You looked up</p>
							<ul className="mt-2 flex flex-col gap-1">
								{looked.slice(0, 8).map((t) => (
									<li key={t.slug ?? t.text} className="font-prose text-base leading-snug">
										<span className="font-[600] text-foreground" lang="sk">
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
		<div className="rounded-lg border bg-card px-3 py-4">
			<p className="font-ui text-sm font-[600] text-muted-foreground">{label}</p>
			<p className={cn("mt-1 font-ui text-3xl font-[600] tabular-nums", ink)}>{value}</p>
		</div>
	);
}

// ─── The library ────────────────────────────────────────────────────────────

/** Filters appear once there are enough stories to need them; search later still. */
const FILTERS_FROM = 6;
const SEARCH_FROM = 11;

function newWordList(words: ReadonlyArray<string | { sk: string }>): string[] {
	return words.map((w) => (typeof w === "string" ? w : w.sk)).filter(Boolean);
}

/** One line of what a story is: level, length, new words, share of words known. Parts that do not exist are left out. */
export function storyMeta(s: { level: string; wordCount: number; coverage: number; newWords: ReadonlyArray<string | { sk: string }> }): string {
	const parts = [s.level, `about ${Math.max(1, Math.round(s.wordCount / 80))} min`];
	const fresh = newWordList(s.newWords);
	if (fresh.length) parts.push(`${fresh.length} new ${fresh.length === 1 ? "word" : "words"}`);
	if (s.coverage > 0) parts.push(`${Math.round(s.coverage * 100)}% of words known`);
	return parts.join(" · ");
}

function Shelf({ state, onOpen, onWrite }: { state: ReadingState | null; onOpen: (id: string) => void; onWrite: () => void }) {
	const list = state?.library ?? [];
	const [level, setLevel] = useState<string>("all");
	const [status, setStatus] = useState<"all" | "unread" | "read">("all");
	const [query, setQuery] = useState("");
	const canWrite = state?.canWrite !== false;

	const LEVEL_RANK: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
	const featured = list.find((s) => s.id === state?.current?.id) ?? list.find((s) => s.reads === 0) ?? list[0];
	const levels = useMemo(() => [...new Set(list.map((s) => s.level))].sort((a, b) => (LEVEL_RANK[a] ?? 9) - (LEVEL_RANK[b] ?? 9)), [list]);
	const rest = useMemo(() => {
		const q = query.trim().toLowerCase();
		return list
			.filter((s) => s.id !== featured?.id)
			.filter((s) => (level === "all" ? true : s.level === level))
			.filter((s) => (status === "all" ? true : status === "unread" ? s.reads === 0 : s.reads > 0))
			.filter((s) => !q || s.title.toLowerCase().includes(q) || (s.topic ?? "").toLowerCase().includes(q) || (s.genre ? genreInfo(s.genre).label.toLowerCase().includes(q) : false))
			.sort((a, b) => (a.reads === 0 ? 0 : 1) - (b.reads === 0 ? 0 : 1) || (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9) || a.episode - b.episode);
	}, [list, featured, level, status, query]);
	const filtering = level !== "all" || status !== "all" || query.trim() !== "";
	const unread = list.filter((s) => s.reads === 0).length;

	return (
		<div className="flex flex-1 flex-col overflow-y-auto pb-16 pt-8 [scrollbar-gutter:stable]">
			<div className={cn(COLUMN, "max-w-3xl lh-rise")} data-testid="read-shelf-list">
				<Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<XIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
				<div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
					<div>
						<h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Read</h1>
						<p className="q-line dim mt-1">Short stories at your level. Tap any word for its meaning.</p>
					</div>
					{canWrite && list.length > 0 && (
						<button type="button" onClick={onWrite} className="q-btn sec" data-testid="read-write-next">
							<SparklesIcon className="size-4" />
							{unread ? "Write another episode" : "Write a new episode"}
						</button>
					)}
				</div>

				{list.length === 0 && (
					<div className="mt-8">
						<EmptyState
							testid="read-empty"
							title="No episodes yet"
							action={canWrite ? <button type="button" onClick={onWrite} className="q-btn primary">Write the first episode</button> : <AddKeyButton />}
							secondary={<Link href="/" className="q-btn ghost">Back to Today</Link>}
						>
							<p>Episodes are short stories at your level, with every word tappable.</p>
							<p>{canWrite ? "The first one takes about a minute to write, then it is kept here." : "They are written with an AI key. Once you add one, your first episode is ready in about a minute."}</p>
						</EmptyState>
					</div>
				)}

				{featured && (
					<section className="mt-8" data-testid="read-pick" aria-label="Today's episode">
						<h2 className="q-sh">{featured.reads === 0 ? "Today's episode" : "Read it again"}</h2>
						<article className="q-card p-5 sm:p-6">
							<p className="text-[13px] text-ink-3">{kindOf(featured)}</p>
							<h3 className="mt-1 text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground" lang="sk">
								{featured.title}
							</h3>
							<p className="mt-2 text-[14px] text-ink-3">{storyMeta(featured)}</p>
							{newWordList(featured.newWords).length > 0 && (
								<p className="mt-1 text-[14px] text-ink-2">
									New words: <span lang="sk">{newWordList(featured.newWords).slice(0, 4).join(", ")}</span>
								</p>
							)}
							<div className="q-acts" style={{ marginTop: 16 }}>
								<button type="button" onClick={() => onOpen(featured.id)} className="q-btn primary" data-testid="read-open">
									{featured.reads === 0 ? "Read today's episode" : "Read it again"}
								</button>
							</div>
						</article>
						{!canWrite && (
							<div className="mt-3">
								<KeyNote>New episodes are written with an AI key.</KeyNote>
							</div>
						)}
					</section>
				)}

				{list.length > 1 && (
					<section className="mt-8" aria-label="More stories">
						<h2 className="q-sh">
							More stories
							<small>{list.length - 1}</small>
						</h2>
						{list.length >= FILTERS_FROM && (
							<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="read-filters">
								<div className="q-segc" role="radiogroup" aria-label="Level">
									{["all", ...levels].map((l) => (
										<button key={l} type="button" role="radio" aria-checked={level === l} className={cn(level === l && "on")} onClick={() => setLevel(l)}>
											{l === "all" ? "All" : l}
										</button>
									))}
								</div>
								<div className="q-segc" role="radiogroup" aria-label="Status">
									{(["all", "unread", "read"] as const).map((st) => (
										<button key={st} type="button" role="radio" aria-checked={status === st} className={cn(status === st && "on")} onClick={() => setStatus(st)}>
											{st === "all" ? "All" : st === "unread" ? "Unread" : "Read"}
										</button>
									))}
								</div>
							</div>
						)}
						{list.length >= SEARCH_FROM && (
							<div className="q-jump mb-3 !h-10 !shadow-[0_0_0_1px_var(--q-line-2)]">
								<SearchIcon className="size-4 text-ink-3" />
								<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title or topic" aria-label="Search stories" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3" />
							</div>
						)}
						{rest.length > 0 ? (
							<ul className="divide-y divide-[var(--q-line)]" data-testid="read-library">
								{rest.map((s) => (
									<li key={s.id}>
										<button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center gap-4 py-3 text-left hover:bg-well sm:px-2" data-testid="read-story">
											<span className="min-w-0 flex-1">
												<span className="block truncate text-[16px] font-[550] text-foreground" lang="sk">
													{s.title}
												</span>
												<span className="block text-[13px] text-ink-3">{storyMeta(s)}</span>
											</span>
											<span className="shrink-0 text-[13px] text-ink-3">{s.reads === 0 ? "New" : s.lastScore ? `${s.lastScore.correct} of ${s.lastScore.total}` : `Read ${s.reads}×`}</span>
										</button>
									</li>
								))}
							</ul>
						) : (
							filtering && (
								<EmptyState
									testid="read-filter-empty"
									title="No stories match"
									action={
										<button
											type="button"
											className="q-btn primary"
											onClick={() => {
												setLevel("all");
												setStatus("all");
												setQuery("");
											}}
										>
											Show all stories
										</button>
									}
								>
									<p>Nothing in the library fits those filters. Your other stories are still here.</p>
								</EmptyState>
							)
						)}
					</section>
				)}
			</div>
		</div>
	);
}
