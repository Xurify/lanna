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
import { BookOpenIcon, CheckIcon, LanguagesIcon, LibraryIcon, LoaderCircleIcon, PauseIcon, PlayIcon, SparklesIcon, Volume2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { setSpeed, speak, SPEEDS, useSpeed } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { gradeAnswers, QUESTIONS_PER_STORY, readXp, type ReadingState, type StoryRecord, type StoryToken } from "@/src/core";

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
const BUTTON = "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 font-ui text-base font-extrabold transition-[filter,transform,background-color] active:scale-[0.98]";
const PRIMARY = cn(BUTTON, "bg-go text-go-ink hover:brightness-110 disabled:cursor-not-allowed disabled:bg-accent disabled:text-muted-foreground disabled:hover:brightness-100 disabled:active:scale-100");
const SECONDARY = cn(BUTTON, "border-2 border-foreground/20 px-5 text-foreground hover:bg-foreground/5");

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
			setStage("reading");
			void load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setStage("error");
		}
	}, [load]);

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
					body: JSON.stringify({ action: "finish", storyId: story.id, answers: all, tapped, ms: Date.now() - startedAt.current, tz: new Date().getTimezoneOffset() }),
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
		[story, saving, tapped, load],
	);

	// Escape leaves, like a lesson.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") router.push("/");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [router]);

	const onTap = (slugOrText: string) => setTapped((t) => (t.includes(slugOrText) ? t : [...t, slugOrText]));

	if (stage === "writing") {
		const n = (state?.library.length ?? 0) + 1;
		return (
			<Frame>
				<div className="m-auto max-w-md text-center" data-testid="read-writing">
					<div className="mx-auto flex size-20 items-center justify-center rounded-full bg-flame/15 text-flame">
						<SparklesIcon className="size-9 lh-flicker" />
					</div>
					<h1 className="mt-5 font-ui text-3xl font-black text-foreground">Writing episode {n}…</h1>
					<p className="mt-2 font-prose text-lg text-muted-foreground">At your level, from the words you know. About twenty seconds; it is saved to your library, so it is written once.</p>
					<p className="mt-6 flex items-center justify-center gap-2 font-ui text-sm text-muted-foreground">
						<LoaderCircleIcon className="size-4 animate-spin" />
						Robo in Bratislava
					</p>
				</div>
			</Frame>
		);
	}

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
							<Link href="/settings" className={PRIMARY}>
								Set up a model
							</Link>
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
					story={story}
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
			<Text story={story} tapped={tapped} onTap={onTap} />
			<div className="border-t border-border">
				<div className={cn(COLUMN, "flex min-h-24 flex-wrap items-center justify-between gap-4 py-5")}>
					<p className="font-prose text-sm text-muted-foreground">Tap any word for its meaning · the speaker plays a sentence · Enter when you have read it</p>
					<button
						type="button"
						onClick={() => (story.questions.length ? setStage("questions") : void finish([]))}
						className={PRIMARY}
						data-testid="read-done"
						ref={(el) => el?.focus()}
					>
						{story.questions.length ? `${QUESTIONS_PER_STORY} quick questions` : "Done"}
					</button>
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
						Episode {story.episode} · <span className="text-muted-foreground">{step}</span>
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

function Text({ story, tapped, onTap }: { story: StoryRecord; tapped: string[]; onTap: (key: string) => void }) {
	const [playing, setPlaying] = useState<number | null>(null);
	const [all, setAll] = useState(false);
	const [shown, setShown] = useState<Set<number>>(new Set());
	const [popover, setPopover] = useState<{ sentence: number; token: number } | null>(null);
	const stop = useRef(false);

	// Play all: sentence after sentence, the current one marked. Reading
	// while listening — the eyes follow the voice.
	const playAll = async () => {
		if (all) {
			stop.current = true;
			setAll(false);
			setPlaying(null);
			return;
		}
		stop.current = false;
		setAll(true);
		for (let i = 0; i < story.sentences.length; i++) {
			if (stop.current) break;
			setPlaying(i);
			await speak(story.sentences[i]!.sk).catch(() => {});
		}
		setAll(false);
		setPlaying(null);
	};
	const playOne = async (i: number) => {
		stop.current = true;
		setAll(false);
		setPlaying(i);
		await speak(story.sentences[i]!.sk).catch(() => {});
		setPlaying((p) => (p === i ? null : p));
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

	const toggleShown = (i: number) =>
		setShown((s) => {
			const n = new Set(s);
			if (n.has(i)) n.delete(i);
			else n.add(i);
			return n;
		});

	return (
		<div className="flex flex-1 flex-col overflow-y-auto pb-10 pt-[5vh]">
			<article className={cn(COLUMN, "lh-rise")} data-testid="read-text">
				<p className="font-ui text-sm font-bold text-muted-foreground first-letter:uppercase">
					{story.level} · {story.theme}
				</p>
				<div className="mt-1 flex flex-wrap items-center justify-between gap-3">
					<h1 className="font-ui text-3xl font-black text-foreground" lang="sk">
						{story.title}
					</h1>
					<button type="button" onClick={() => void playAll()} className={cn(SECONDARY, "h-10 px-4 text-sm")} data-testid="read-play-all" aria-pressed={all}>
						{all ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4 fill-current" />}
						{all ? "Stop" : "Play all"}
					</button>
				</div>

				<div className="mt-7 flex flex-col gap-4">
					{story.sentences.map((s, i) => (
						<div key={i} className={cn("group relative -mx-3 flex items-start gap-2 rounded-2xl px-3 py-2 transition-colors", playing === i && "bg-xp/10")} data-testid="read-sentence">
							<button
								type="button"
								onClick={() => void playOne(i)}
								aria-label={`Play sentence ${i + 1}`}
								className={cn("mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", playing === i && "text-xp")}
							>
								<Volume2Icon className="size-4" />
							</button>
							<div className="min-w-0 flex-1">
								<p className="font-prose text-[1.65rem] leading-[1.6] text-foreground" lang="sk">
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
								</p>
								{shown.has(i) && (
									<p className="lh-rise mt-1 font-prose text-base text-muted-foreground" data-testid="read-translation">
										{s.en}
									</p>
								)}
							</div>
							<button
								type="button"
								onClick={() => toggleShown(i)}
								aria-label={shown.has(i) ? "Hide the translation" : "Show the translation"}
								aria-pressed={shown.has(i)}
								className={cn("mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground", shown.has(i) && "text-foreground")}
							>
								<LanguagesIcon className="size-4" />
							</button>
						</div>
					))}
				</div>

				{story.newWords.length > 0 && (
					<div className="mt-8 rounded-2xl border bg-card p-4" data-testid="read-new-words">
						<p className="font-ui text-sm font-bold text-muted-foreground">New in this episode</p>
						<ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
							{story.newWords.map((w) => (
								<li key={w.lemma} className="font-prose text-base">
									<span className="font-bold text-foreground" lang="sk">
										{w.lemma}
									</span>{" "}
									<span className="text-muted-foreground">{w.gloss}</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</article>
		</div>
	);
}

/** One tappable word. A fresh word (not met before) carries a dotted
 *  underline so the eye knows where the new ground is; a word looked up
 *  keeps a faint mark. The popover opens under the word. */
function Word({ token, looked, open, onOpen, onClose }: { token: StoryToken; looked: boolean; open: boolean; onOpen: () => void; onClose: () => void }) {
	const ref = useRef<HTMLSpanElement>(null);
	const [side, setSide] = useState<"left" | "right">("left");
	useEffect(() => {
		if (!open || !ref.current) return;
		const r = ref.current.getBoundingClientRect();
		const column = ref.current.closest("article")?.getBoundingClientRect();
		if (column) setSide(r.left - column.left > column.width * 0.55 ? "right" : "left");
	}, [open]);
	return (
		<span ref={ref} className="relative inline">
			<button
				type="button"
				data-word
				onClick={() => (open ? onClose() : onOpen())}
				aria-expanded={open}
				className={cn(
					"rounded-md px-0.5 -mx-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-go",
					token.fresh && "underline decoration-dotted decoration-xp decoration-2 underline-offset-[5px]",
					looked && !token.fresh && "underline decoration-dotted decoration-foreground/30 decoration-2 underline-offset-[5px]",
					open && "bg-accent",
				)}
			>
				{token.text}
			</button>
			{open && (
				<span
					data-word-popover
					role="dialog"
					aria-label={`About ${token.text}`}
					className={cn("lh-pop absolute top-full z-10 mt-2 block w-max min-w-[13rem] max-w-[22rem] rounded-2xl border-2 bg-card p-4 text-left font-prose text-base shadow-lg", side === "left" ? "left-0" : "right-0")}
					data-testid="word-popover"
				>
					<span className="flex items-baseline justify-between gap-3">
						<span className="font-ui text-xl font-black text-foreground" lang="sk">
							{token.lemma ?? token.text}
						</span>
						<button
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => void speak(token.lemma ?? token.text).catch(() => {})}
							aria-label="Play the word"
							className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
						>
							<Volume2Icon className="size-4" />
						</button>
					</span>
					{token.lemma && token.lemma.toLocaleLowerCase("sk-SK") !== token.text.toLocaleLowerCase("sk-SK") && (
						<span className="block font-ui text-xs text-muted-foreground">
							here: <span lang="sk">{token.text}</span>
						</span>
					)}
					<span className="mt-1 block leading-snug text-foreground">{token.gloss ?? "Not in the dictionary yet."}</span>
					{(token.cat || token.gender || token.fresh) && (
						<span className="mt-1.5 flex flex-wrap gap-1.5">
							{token.cat && <Tag>{token.cat.toLowerCase()}</Tag>}
							{token.gender && <Tag>{token.gender}</Tag>}
							{token.fresh && <Tag className="bg-xp/15 text-xp">new word</Tag>}
						</span>
					)}
				</span>
			)}
		</span>
	);
}

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
	return <span className={cn("rounded-full bg-accent px-2 py-0.5 font-ui text-[11px] font-bold text-muted-foreground", className)}>{children}</span>;
}

// ─── The check ──────────────────────────────────────────────────────────────

function Check({ story, answers, onAnswer }: { story: StoryRecord; answers: number[]; onAnswer: (i: number) => void }) {
	const i = answers.length;
	const q = story.questions[i];
	const [picked, setPicked] = useState<number | null>(null);
	useEffect(() => setPicked(null), [i]);

	const pick = useCallback(
		(n: number) => {
			if (!q || picked !== null) return;
			setPicked(n);
			if (n === q.answer) sfx.right();
			else sfx.wrong();
			void speak(q.options[q.answer]!).catch(() => {});
		},
		[q, picked],
	);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!q) return;
			const n = Number(e.key);
			if (picked === null && n >= 1 && n <= q.options.length) {
				e.preventDefault();
				pick(n - 1);
			} else if (picked !== null && e.key === "Enter") {
				e.preventDefault();
				onAnswer(picked);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [q, picked, pick, onAnswer]);

	if (!q) return null;
	const right = picked === q.answer;
	return (
		<>
			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[9vh]">
				<div key={i} className={cn(COLUMN, "lh-rise")} data-testid="read-question">
					<p className="font-ui text-sm font-bold text-muted-foreground">What happened?</p>
					<h2 className="mb-6 mt-1 font-prose text-2xl font-semibold text-foreground" lang="sk">
						{q.q}
					</h2>
					<div className="grid gap-3">
						{q.options.map((o, n) => {
							const tone = picked === null ? "" : n === q.answer ? "border-go bg-go-soft" : n === picked ? "border-miss bg-miss-soft" : "opacity-60";
							return (
								<button
									key={n}
									type="button"
									disabled={picked !== null}
									onClick={() => pick(n)}
									className={cn("flex items-center gap-4 rounded-2xl border-2 bg-card px-5 py-4 text-left font-prose text-xl text-foreground transition-colors hover:border-foreground/40 disabled:cursor-default", tone)}
									data-testid="read-option"
									lang="sk"
								>
									<kbd className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-background font-ui text-xs font-bold text-muted-foreground">{n + 1}</kbd>
									<span className="flex-1">{o}</span>
									{picked !== null && n === q.answer && <CheckIcon className="size-5 text-go" strokeWidth={3} />}
									{picked !== null && n === picked && n !== q.answer && <XIcon className="size-5 text-miss" strokeWidth={3} />}
								</button>
							);
						})}
					</div>
				</div>
			</div>
			<div className={cn("border-t border-border", picked !== null && (right ? "bg-go-soft" : "bg-miss-soft"))}>
				<div className={cn(COLUMN, "flex min-h-24 items-center justify-between gap-4 py-5")}>
					<p className={cn("font-ui text-lg font-bold", picked === null ? "text-muted-foreground font-prose text-sm font-normal" : right ? "text-go" : "text-miss")}>
						{picked === null ? "Pick one, or press its number" : right ? "Presne tak!" : "Not quite — the right one is marked"}
					</p>
					{picked !== null && (
						<button type="button" autoFocus onClick={() => onAnswer(picked)} className={cn(BUTTON, right ? "bg-go text-go-ink" : "bg-miss text-background", "hover:brightness-110")} data-testid="read-continue">
							{i + 1 >= story.questions.length ? "Finish" : "Continue"}
						</button>
					)}
				</div>
			</div>
		</>
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
						Next episode
					</button>
				) : (
					<button type="button" onClick={onShelf} className={PRIMARY} data-testid="read-shelf">
						The library
					</button>
				)}
			</div>
			{!unreadLeft && canWrite && <p className="mt-3 font-prose text-xs text-muted-foreground">The next episode is written when you ask for it in the library (one model call).</p>}
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
						<h1 className="mt-1 font-ui text-3xl font-black text-foreground">Robo in Bratislava</h1>
						<p className="mt-1 font-prose text-base text-muted-foreground">
							{list.length === 0 ? "No episodes yet." : `${list.length} episode${list.length === 1 ? "" : "s"}${unread ? ` · ${unread} unread` : ""}${state?.readToday ? ` · ${state.readToday} read today` : ""}`}
						</p>
					</div>
					<div className="flex gap-3">
						<Link href="/" className={SECONDARY}>
							Today
						</Link>
						{state?.canWrite !== false && (
							<button type="button" onClick={onWrite} className={PRIMARY} data-testid="read-write-next" title="One model call on the cheap slot">
								<SparklesIcon className="size-4" />
								{unread ? "Read the next" : "Write the next episode"}
							</button>
						)}
					</div>
				</div>
				<ol className="mt-6 flex flex-col gap-2">
					{list.map((s) => (
						<li key={s.id}>
							<button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center gap-4 rounded-2xl border-2 bg-card px-5 py-4 text-left transition-colors hover:border-foreground/40" data-testid="read-shelf-item">
								<span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl font-ui text-sm font-black", s.reads > 0 ? "bg-accent text-muted-foreground" : "bg-flame/15 text-flame")}>{s.episode}</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-ui text-lg font-bold text-foreground" lang="sk">
										{s.title}
									</span>
									<span className="block truncate font-prose text-sm text-muted-foreground">
										{s.level} · {s.theme} · {s.wordCount} words{s.newWords.length ? ` · new: ${s.newWords.slice(0, 4).join(", ")}` : ""}
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
						Stories are written on the cheap model slot. <Link href="/settings" className="underline">Set up a model</Link> to get the first episode.
					</p>
				)}
			</div>
		</div>
	);
}
