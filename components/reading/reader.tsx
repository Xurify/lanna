"use client";

/**
 * The reader (2026-10-28) — the Read task's screen. One
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
import {
	LanguagesIcon,
	LoaderCircleIcon,
	PauseIcon,
	PlayIcon,
	PlusIcon,
	SearchIcon,
	SparklesIcon,
	XIcon,
} from "lucide-react";
import { EmptyState, KeyNote, AddKeyButton } from "@/components/quiet/empty-state";
import { cn } from "@/lib/utils";
import { PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";
import {
	endEnterBlocked,
	EnterHint,
	NotSaved,
	PAGE_TIME_HOW,
	PracticeTime,
	Stat,
	Stats,
	TaskEnd,
} from "@/components/task-frame";
import { QIcon } from "@/components/quiet/icon";
import { useActiveTime } from "@/components/use-active-time";
import { speak, stopSpeaking, useActiveLanguage } from "@/components/speech";
import { sfx, soundOn } from "@/components/lesson/sound";
import { Check } from "@/components/reading/check";
import { Word } from "@/components/reading/word";
import { StoryAudioControl } from "@/components/reading/story-audio";
import { BookList, NextUp, type BookGroup, type ListBook, type ListSlot } from "@/components/reading/book-list";
import {
	AddReadingDialog,
	difficultyInfo,
	EMPTY_READING_DRAFT,
	linksIn,
	type ReadingDraft,
} from "@/components/reading/add-reading-dialog";
import {
	cheersFor,
	genreInfo,
	gradeAnswers,
	MAX_SOURCE_WORDS,
	readXp,
	storySpeech,
	type LibraryEntry,
	type ReadingState,
	type SourceEntry,
	type StoryRecord,
	type StorySource,
	type StorySentence,
	type StoryToken,
	type WritingProgress,
} from "@/src/core";
import { fillStyle } from "@/components/ui/fill";
import { SourcesNote } from "@/components/sources/sources-note";
import { keepSession, onSessionSaved, RefusedError, sendSession, type PendingSession } from "@/components/session-save";

export function kindOf(story: Pick<StoryRecord, "genre" | "episode" | "source">): string {
	if (story.source) return `Part ${story.source.part} of ${story.source.parts}`;
	return (story.genre ?? "robo") === "robo" ? `Episode ${story.episode}` : genreInfo(story.genre!).label;
}

type Stage = "writing" | "reading" | "questions" | "end" | "shelf" | "error";

interface Outcome {
	xp: number;
	correct: number;
	total: number;
	queued: string[];
	reread: boolean;
}

const COLUMN = "mx-auto w-full max-w-3xl px-6";
const LIBRARY_REFRESH_MS = 4000;

export function Reader({ initial, initialStory }: { initial: ReadingState | null; initialStory?: StoryRecord | null }) {
	const lang = useActiveLanguage();
	const router = useRouter();
	const [state, setState] = useState<ReadingState | null>(initial);
	const [story, setStory] = useState<StoryRecord | null>(initialStory ?? initial?.current ?? null);
	const [stage, setStage] = useState<Stage>(initialStory ? "reading" : "shelf");
	const [adding, setAdding] = useState<{ draft: ReadingDraft; error: string | null } | null>(null);
	const [waitingForOwnText, setWaitingForOwnText] = useState(false);
	const [linksBeingRead, setLinksBeingRead] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [tapped, setTapped] = useState<string[]>([]);
	const [answers, setAnswers] = useState<number[]>([]);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [practiceMs, setPracticeMs] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveFailed, setSaveFailed] = useState(false);
	const [saveRefused, setSaveRefused] = useState(false);
	const lastSave = useRef<PendingSession | null>(null);
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

	const lastRequest = useRef<
		{ action: "next" | "write"; topic?: string } | { action: "part"; sourceId: string; part: number }
	>({ action: "next" });

	const requestStory = useCallback(
		async (action: "next" | "write", topic?: string) => {
			lastRequest.current = { action, topic };
			setWaitingForOwnText(false);
			setStage("writing");
			setError(null);
			try {
				const res = await fetch("/api/read", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ action, ...(topic ? { topic } : {}) }),
				});
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
		},
		[load, activeTime],
	);

	const next = useCallback(() => requestStory("next"), [requestStory]);
	const write = useCallback((topic?: string) => requestStory("write", topic), [requestStory]);

	useEffect(() => {
		void load();
	}, [load]);

	const firstPartsBeingWritten = stage === "shelf" && (state?.sources ?? []).some((s) => s.preparing);
	useEffect(() => {
		if (!firstPartsBeingWritten) return;
		const timer = setInterval(() => void load(), LIBRARY_REFRESH_MS);
		return () => clearInterval(timer);
	}, [firstPartsBeingWritten, load]);

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

	const show = (opened: StoryRecord) => {
		setStory(opened);
		setTapped([]);
		setAnswers([]);
		setOutcome(null);
		startedAt.current = Date.now();
		activeTime.restart();
		setStage("reading");
		void load();
	};

	const postRead = async <T,>(body: Record<string, unknown>): Promise<T> => {
		const res = await fetch("/api/read", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		const answer = (await res.json().catch(() => ({}))) as T & { message?: string };
		if (!res.ok) throw new Error(answer.message ?? `HTTP ${res.status}`);
		return answer;
	};

	const openPart = (sourceId: string, part: number, storyId?: string) => {
		if (storyId) return open(storyId);
		lastRequest.current = { action: "part", sourceId, part };
		setWaitingForOwnText(true);
		setStage("writing");
		setError(null);
		postRead<StoryRecord>({ action: "part", sourceId, part })
			.then(show)
			.catch((err: Error) => {
				setError(err.message);
				setStage("error");
			});
	};

	const importLinks = (links: string[], draft: ReadingDraft) => {
		setLinksBeingRead(links.length);
		postRead<{ added: number; failed: Array<{ url: string; message: string }> }>({
			action: "import",
			urls: links,
			difficulty: draft.difficulty,
		})
			.then(({ added, failed }) => {
				if (failed.length === 0) return;
				const one = failed.length === 1;
				const could =
					added === 0
						? "None of these could be read"
						: `${added} added. ${one ? "This one" : `These ${failed.length}`} could not be read`;
				setAdding({
					draft: { ...draft, value: failed.map((f) => f.url).join("\n") },
					error: `${could}. Open ${one ? "the page and paste its text" : "each page and paste its text, one at a time,"} instead.`,
				});
			})
			.catch((err: Error) => setAdding({ draft, error: err.message }))
			.finally(() => {
				setLinksBeingRead(0);
				void load();
			});
	};

	const importText = (draft: ReadingDraft) => {
		setAdding(null);
		const links = linksIn(draft.value);
		if (links.length > 1) return importLinks(links, draft);
		setWaitingForOwnText(true);
		setStage("writing");
		const value = draft.value.trim();
		postRead<{ story: StoryRecord }>({
			action: "import",
			difficulty: draft.difficulty,
			...(links.length === 1 ? { url: links[0] } : { text: value, title: draft.title }),
		})
			.then((imported) => show(imported.story))
			.catch((err: Error) => {
				setStage("shelf");
				setAdding({ draft, error: err.message });
			});
	};

	const removeText = (sourceId: string) => {
		void postRead({ action: "remove-source", sourceId })
			.catch(() => undefined)
			.then(load);
	};

	const tryAgain = () => {
		const last = lastRequest.current;
		if (last.action === "part") openPart(last.sourceId, last.part);
		else void requestStory(last.action, last.topic);
	};

	const finish = useCallback(
		async (all: number[]) => {
			if (!story || saving) return;
			setSaving(true);
			setSaveFailed(false);
			setSaveRefused(false);
			setStage("end");
			sfx.done();
			const activeMs = activeTime.finish();
			setPracticeMs(activeMs);
			try {
				lastSave.current = keepSession(lang?.code ?? "sk", "/api/read", {
					action: "finish",
					storyId: story.id,
					answers: all,
					tapped,
					ms: Date.now() - startedAt.current,
					activeMs,
					tz: new Date().getTimezoneOffset(),
				});
				setOutcome(await sendSession<Outcome>(lastSave.current));
				void load();
			} catch (err) {
				setSaveFailed(true);
				setSaveRefused(err instanceof RefusedError);
				const g = gradeAnswers(story.questions, all);
				setOutcome({ xp: readXp(story.sentences.length, g.correct, false), ...g, queued: [], reread: false });
			} finally {
				setSaving(false);
			}
		},
		[story, saving, tapped, load, activeTime, lang],
	);

	const retrySave = async () => {
		if (!lastSave.current || saving) return;
		setSaving(true);
		try {
			setOutcome(await sendSession<Outcome>(lastSave.current));
			setSaveFailed(false);
			setSaveRefused(false);
			void load();
		} catch (err) {
			setSaveFailed(true);
			setSaveRefused(err instanceof RefusedError);
		} finally {
			setSaving(false);
		}
	};

	useEffect(() => {
		const session = lastSave.current;
		if (!saveFailed || saveRefused || !session) return;
		return onSessionSaved(session.id, (saved) => {
			setOutcome(saved as Outcome);
			setSaveFailed(false);
			void load();
		});
	}, [saveFailed, saveRefused, load]);

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

	if (stage === "writing") return <Writing initial={state?.generating ?? null} ownText={waitingForOwnText} />;

	if (stage === "error") {
		return (
			<Frame>
				<div className={cn(COLUMN, "pt-[8vh]")}>
					<EmptyState
						testid="read-error"
						title={waitingForOwnText ? "This part could not be written" : "The episode could not be written"}
						action={
							<button type="button" onClick={tryAgain} className="q-btn primary">
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
						<p>
							{waitingForOwnText
								? "The parts already written are still in the library."
								: "Episodes you have already read are still in the library."}
						</p>
					</EmptyState>
				</div>
			</Frame>
		);
	}

	if (stage === "shelf" || !story) {
		return (
			<Frame>
				<Shelf
					state={state}
					linksBeingRead={linksBeingRead}
					onOpen={open}
					onWrite={(topic) => void write(topic)}
					onAdd={() => setAdding({ draft: EMPTY_READING_DRAFT, error: null })}
					onOpenPart={openPart}
					onRemoveSource={removeText}
				/>
				{adding && (
					<AddReadingDialog
						initial={adding.draft}
						error={adding.error}
						onClose={() => setAdding(null)}
						onSubmit={importText}
					/>
				)}
			</Frame>
		);
	}

	if (stage === "questions") {
		return (
			<Frame strip={false}>
				<TopBar
					story={story}
					step={`Question ${Math.min(answers.length + 1, story.questions.length)} of ${story.questions.length}`}
					progress={story.questions.length ? answers.length / story.questions.length : 1}
				/>
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
				<End
					story={story}
					tapped={tapped}
					answers={answers}
					outcome={outcome}
					practiceMs={practiceMs}
					saving={saving}
					failed={saveFailed}
					refused={saveRefused}
					onRetrySave={() => void retrySave()}
					onAgain={() => open(story.id)}
					onNext={() => void next()}
					onOpenPart={openPart}
					nextPartStoryId={nextPartStoryId(state, story)}
					onShelf={() => setStage("shelf")}
					canWrite={state?.canWrite ?? true}
					unreadLeft={(state?.library ?? []).some((s) => s.reads === 0 && s.id !== story.id)}
				/>
			</Frame>
		);
	}

	return (
		<Frame strip={false}>
			<Text
				story={story}
				tapped={tapped}
				onTap={onTap}
				onDone={() => (story.questions.length ? setStage("questions") : void finish([]))}
				onLibrary={() => {
					if (new URLSearchParams(window.location.search).has("id")) router.push("/read");
					else setStage("shelf");
				}}
			/>
		</Frame>
	);
}

// ─── Writing ────────────────────────────────────────────────────────────────

/** The sentences arrive as the model writes them: the learner starts
 *  reading before the questions are even written. */
function Writing({ initial, ownText }: { initial: WritingProgress | null; ownText: boolean }) {
	const lang = useActiveLanguage();
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
	const mine = !ownText || !!progress?.title;
	const heading =
		progress?.title && ownText
			? `Writing “${progress.title}” for you…`
			: ownText
				? "Getting your text ready…"
				: `Writing ${progress ? (progress.topic ? `“${progress.topic}”` : progress.genre === "robo" ? "the next episode" : `a new story: ${genreInfo(progress.genre).label}`) : "your next story"}…`;
	const lines = mine ? (progress?.sentences ?? []) : [];
	return (
		<Frame>
			<div className="flex flex-1 flex-col overflow-y-auto pb-10 pt-[6vh]">
				<div className={cn(COLUMN, lines.length === 0 && "m-auto max-w-md text-center")} data-testid="read-writing">
					<div className={cn("flex items-center gap-4", lines.length === 0 && "flex-col")}>
						<div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-teal-wash text-teal-2">
							<SparklesIcon className="size-7 lanna-flicker" />
						</div>
						<div>
							<h1 className="font-ui text-2xl font-[600] text-foreground">{heading}</h1>
							<p className="mt-1 font-prose text-base text-muted-foreground">
								{ownText
									? "Kept in your library, so it is written once."
									: `${progress ? `${progress.level} · from the words you know` : "At your level, from the words you know"} · kept in your library, so it is written once.`}
							</p>
						</div>
					</div>
					{lines.length > 0 ? (
						<div className="mt-8 flex flex-col gap-4" aria-live="polite">
							{lines.map((line, i) => (
								<p
									key={i}
									className="lanna-rise font-prose text-[1.65rem] leading-[1.6] text-foreground"
									lang={lang?.code}
								>
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
							This takes about a minute. {ownText ? "The part" : "The episode"} opens when it is written.
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
			<div className="fixed inset-y-0 right-0 left-0 z-40 flex flex-col bg-background md:left-[var(--sidebar-cols,3.25rem)]">
				{strip && <div className="lanna-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />}
				{children}
			</div>
		</>
	);
}

function TopBar({ story, step, progress }: { story: StoryRecord; step: string; progress: number }) {
	return (
		<div className="lanna-drag lanna-wco-gutter shrink-0 select-none">
			<div className={cn(COLUMN, "flex h-16 items-center gap-4 pt-2")}>
				{/* The 12px padding makes a 44px touch target; the matching margin keeps the icon on the text edge. */}
				<Link
					href="/"
					aria-label="Leave the story"
					className="-ml-3 rounded-lg p-3 text-muted-foreground transition-colors hover:bg-well hover:text-foreground"
				>
					<XIcon className="size-5" />
				</Link>
				<div className="min-w-0 flex-1">
					<p className="truncate text-[14px] font-[600] text-foreground">
						{kindOf(story)} · <span className="text-ink-3">{step}</span>
					</p>
					<div
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(progress * 100)}
						className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-well-2"
					>
						<div className="lanna-fill rounded-full bg-teal" style={fillStyle(Math.max(0.02, progress))} />
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── The text ───────────────────────────────────────────────────────────────

/** Opening marks (Slovak „, parentheses, « ¿ ¡) stay with the word after them; closing marks and punctuation stay with the word before. */
const OPENERS = /^[„([«¡¿]+$/;

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

function Text({
	story,
	tapped,
	onTap,
	onDone,
	onLibrary,
}: {
	story: StoryRecord;
	tapped: string[];
	onTap: (key: string) => void;
	onDone?: () => void;
	onLibrary: () => void;
}) {
	const lang = useActiveLanguage();
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
			await speak(story.sentences[i]!.sk, undefined, storySpeech(story, story.sentences[i]!)).catch(() => {});
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
		if (s.startsParagraph && i > 0) {
			blocks.push({ speaker, sentences: [{ sentence: s, index: i }] });
		} else if (last && last.speaker === speaker) {
			last.sentences.push({ sentence: s, index: i });
		} else {
			blocks.push({ speaker, sentences: [{ sentence: s, index: i }] });
		}
	}

	const minutes = Math.max(1, Math.round(story.wordCount / 80));

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="lanna-drag lanna-wco-gutter shrink-0 select-none">
				<div className="mx-auto flex h-16 w-full max-w-[40rem] items-center gap-3 px-6 pt-2">
					<Link
						href="/"
						aria-label="Leave the story"
						className="-ml-3 rounded-lg p-3 text-muted-foreground transition-colors hover:bg-well hover:text-foreground"
					>
						<XIcon className="size-5" />
					</Link>
					<p className="min-w-0 flex-1 truncate text-[14px] font-[600] text-foreground" lang={lang?.code}>
						{story.title}
					</p>
					<button type="button" onClick={onLibrary} className="q-btn ghost">
						Library
					</button>
					<button
						type="button"
						onClick={() => setLarge((v) => !v)}
						aria-pressed={large}
						className="q-btn ghost !px-2.5"
						title="Text size"
					>
						<span className="text-[13px]">A</span>
						<span className="-ml-1 text-[17px] leading-none">A</span>
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto pb-32 pt-4 sm:pt-8 [scrollbar-gutter:stable]">
				<article
					className="mx-auto w-full max-w-[40rem] px-6 lanna-rise"
					data-testid="read-text"
					data-word-lookup-enabled="true"
				>
					<header className="mb-8">
						<p className="text-[13px] text-ink-3">
							{kindOf(story)} · {story.level} · about {minutes} min
						</p>
						<h1
							className="mt-2 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground"
							lang={lang?.code}
						>
							{story.title}
						</h1>
						{story.source && (
							<p className="mt-2 text-[13px] text-ink-3" data-testid="read-source-attribution">
								{sourceLine(story.source)}
							</p>
						)}
					</header>

					<div className="flex flex-col gap-6">
						{blocks.map((block, bi) => (
							<div key={bi}>
								{block.speaker && (
									<p className="mb-1 select-none text-[13px] font-[600] text-ink-3" data-testid="read-speaker">
										{block.speaker}
									</p>
								)}
								<p
									className={cn(
										"font-prose text-foreground [&_[data-word]]:!py-0",
										large
											? "text-[24px] leading-[1.6] max-sm:text-[21px]"
											: "text-[21px] leading-[1.6] max-sm:text-[19px]",
									)}
									lang={lang?.code}
								>
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
										<span className="font-[600] text-foreground" lang={lang?.code}>
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

			<div className="absolute inset-x-0 bottom-0 z-30 bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-1px_0_var(--q-line)]">
				<div className="mx-auto flex w-full max-w-[40rem] items-center justify-center gap-2">
					<button
						type="button"
						onClick={() => void playAll()}
						className="q-btn sec"
						data-testid="read-play-all"
						aria-pressed={all}
					>
						{all ? <PauseIcon className="size-4 fill-current" /> : <PlayIcon className="size-4 fill-current" />}
						{all ? "Pause" : "Play all"}
					</button>
					<button
						type="button"
						onClick={() => setShowTranslation((v) => !v)}
						aria-pressed={showTranslation}
						className={cn("q-btn sec max-sm:!px-3", showTranslation && "t")}
						title="Show or hide the English (T)"
					>
						<LanguagesIcon className="size-4" />
						<span className="max-sm:sr-only">Translation {showTranslation ? "on" : "off"}</span>
					</button>
					<button type="button" onClick={onDone} className="q-btn primary" data-testid="read-done">
						{story.questions.length
							? `Answer ${story.questions.length} ${story.questions.length === 1 ? "question" : "questions"}`
							: "Done"}
					</button>
				</div>
			</div>
		</div>
	);
}

// ─── The end ────────────────────────────────────────────────────────────────

function End({
	failed,
	refused,
	onRetrySave,
	story,
	tapped,
	answers,
	outcome,
	practiceMs,
	saving,
	onAgain,
	onNext,
	onOpenPart,
	nextPartStoryId,
	onShelf,
	canWrite,
	unreadLeft,
}: {
	story: StoryRecord;
	tapped: string[];
	answers: number[];
	outcome: Outcome | null;
	practiceMs: number | null;
	saving: boolean;
	failed: boolean;
	refused: boolean;
	onRetrySave: () => void;
	onAgain: () => void;
	onNext: () => void;
	onOpenPart: (sourceId: string, part: number, storyId?: string) => void;
	nextPartStoryId?: string;
	onShelf: () => void;
	canWrite: boolean;
	unreadLeft: boolean;
}) {
	const lang = useActiveLanguage();
	const language = lang?.english ?? "the language";
	const source = story.source;
	const hasNextPart = !!source && source.part < source.parts;
	const openNextPart = () => source && onOpenPart(source.id, source.part + 1, nextPartStoryId);
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
			if (e.key === "Enter" && outcome && !endEnterBlocked(e)) {
				e.preventDefault();
				if (hasNextPart) openNextPart();
				else if (unreadLeft) onNext();
				else onShelf();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});
	const graded = outcome ?? gradeAnswers(story.questions, answers);
	const total = graded.total;
	const reread = outcome?.reread ?? false;
	const cheers = cheersFor(lang?.code);
	const cheer = cheers ? (total > 0 && graded.correct === total ? cheers.perfect : cheers.done) : null;
	const notCounted = refused ? "Not counted" : "Not counted yet";
	const original = source ? story.original : undefined;
	const hasSide = !!original || story.newWords.length > 0 || looked.length > 0;
	return (
		<TaskEnd
			testId="read-end"
			wide={hasSide}
			hint={
				failed ? (
					<NotSaved onRetry={onRetrySave} busy={saving} refused={refused} />
				) : (
					<EnterHint>
						{hasNextPart ? "for the next part" : unreadLeft ? "for the next story" : "for the library"}
					</EnterHint>
				)
			}
			actions={
				<>
					<Link href="/" className={SECONDARY}>
						Today
					</Link>
					<button type="button" onClick={onAgain} className={SECONDARY}>
						Read again
					</button>
					{hasNextPart ? (
						<button type="button" onClick={openNextPart} className={PRIMARY} data-testid="read-next-part">
							Next part
						</button>
					) : unreadLeft ? (
						<button type="button" onClick={onNext} className={PRIMARY}>
							Next story
						</button>
					) : (
						<button type="button" onClick={onShelf} className={PRIMARY} data-testid="read-shelf">
							Open the library
						</button>
					)}
				</>
			}
		>
			<div className={cn("lanna-end", hasSide && "lanna-end-split")}>
				<header className="min-w-0 [grid-area:head]">
					<p className="q-date flex items-center gap-1.5">
						<QIcon name="read" className="text-teal" />
						<span className="truncate">{source ? source.title : "Read"}</span>
					</p>
					<h1 className="q-hello" data-testid="read-end-heading">
						{cheer ? (
							<>
								<span lang={lang?.code}>{cheer.text}</span>{" "}
								<span className="ml-1 font-ui text-[15px] font-[550] tracking-normal text-ink-2">{cheer.gloss}</span>
							</>
						) : (
							endHeading(source, reread)
						)}
					</h1>
					<div className="mt-2 flex min-h-7 flex-wrap items-center gap-x-3.5 gap-y-1.5">
						<p className="q-line dim" data-testid="read-end-where">
							{endWhere(story, reread)} · <span lang={lang?.code}>{story.title}</span>
						</p>
						{source && source.parts > 1 && (
							<ol className="q-dots ml-0" aria-label={`${source.part} of ${source.parts} parts read`}>
								{Array.from({ length: source.parts }, (_, i) => (
									<li key={i} className={cn("h-1 w-8 rounded-full", i < source.part ? "bg-teal" : "bg-well-2")} />
								))}
							</ol>
						)}
					</div>
				</header>

				<section
					className={cn("mt-10 [grid-area:score]", hasSide && "lg:sticky lg:top-16 lg:self-start")}
					aria-label="Your score"
					data-testid="read-end-score"
				>
					<p className="flex items-baseline gap-2.5">
						<span className="font-ui text-[52px] font-semibold leading-none tracking-[-0.045em] tabular-nums text-foreground">
							{total ? `${graded.correct} of ${total}` : story.wordCount}
						</span>
						<span className="font-ui text-[15px] font-[550] text-ink-2">
							{total ? "questions right" : "words read"}
						</span>
					</p>
					<PracticeTime ms={practiceMs} how={PAGE_TIME_HOW} />
					<Stats className="mt-7 max-w-none">
						<Stat
							label="XP"
							value={saving || !outcome ? null : failed ? notCounted : `+${outcome.xp}`}
							ink={failed ? "text-ink-3" : "text-teal-2"}
						/>
						{total > 0 && <Stat label="Words read" value={String(story.wordCount)} />}
						<Stat
							label="Added to Review"
							value={
								saving || !outcome
									? null
									: failed
										? notCounted
										: outcome.queued.length > 0
											? `${outcome.queued.length} ${outcome.queued.length === 1 ? "word" : "words"}`
											: "None"
							}
							ink={failed ? "text-ink-3" : undefined}
						/>
						<Stat label="Words counted as known" value={`${Math.round(story.coverage * 100)}%`} />
					</Stats>
					<p className="mt-3 font-prose text-[13px] leading-relaxed text-ink-3">
						The share of known words is the app's estimate, not a measure of what you understood.
						{source &&
							(source.difficulty === "full"
								? ` This part was put into ${language} by a model, which can get a point wrong.`
								: " This part was retold by a model, which can leave a point out or get one wrong.")}
					</p>
				</section>

				{hasSide && (
					<div className="mt-12 flex min-w-0 flex-col gap-10 [grid-area:list] lg:mt-10">
						{original && (
							<section aria-labelledby="read-original-title">
								<h2 id="read-original-title" className="q-sh mb-0">
									The original of this part
								</h2>
								<p className="mt-1 font-prose text-[14px] text-ink-3">
									Read it now to check what you understood.
									{source?.url && (
										<>
											{" "}
											<a
												href={source.url}
												target="_blank"
												rel="noopener noreferrer"
												className="whitespace-nowrap text-ink-2 underline decoration-line-2 underline-offset-[3px] hover:text-foreground"
											>
												Open the page
											</a>
										</>
									)}
								</p>
								<p
									className="mt-4 whitespace-pre-line font-prose text-[16px] leading-relaxed text-ink-2 select-text"
									data-testid="read-original"
								>
									{original}
								</p>
							</section>
						)}
						{(story.newWords.length > 0 || looked.length > 0) && (
							<div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
								{story.newWords.length > 0 && (
									<section>
										<h2 className="q-sh">New words</h2>
										<ul className="flex flex-col gap-1">
											{story.newWords.slice(0, 8).map((w) => (
												<li key={w.lemma} className="font-prose text-base leading-snug">
													<span className="font-[600] text-foreground" lang={lang?.code}>
														{w.lemma}
													</span>{" "}
													<span className="text-ink-3">{w.gloss}</span>
												</li>
											))}
										</ul>
									</section>
								)}
								{looked.length > 0 && (
									<section>
										<h2 className="q-sh">You looked up</h2>
										<ul className="flex flex-col gap-1">
											{looked.slice(0, 8).map((t) => (
												<li key={t.slug ?? t.text} className="font-prose text-base leading-snug">
													<span className="font-[600] text-foreground" lang={lang?.code}>
														{t.lemma ?? t.text}
													</span>{" "}
													<span className="text-ink-3">{t.gloss ?? ""}</span>
												</li>
											))}
											{looked.length > 8 && (
												<li className="font-prose text-sm text-ink-3">and {looked.length - 8} more</li>
											)}
										</ul>
									</section>
								)}
							</div>
						)}
					</div>
				)}
			</div>
			<SourcesNote feature="read" className="mt-14" />
			{!unreadLeft && !hasNextPart && canWrite && (
				<p className="mt-3 font-prose text-xs text-ink-3">
					New stories are written in the background and wait in the library.
				</p>
			)}
		</TaskEnd>
	);
}

// ─── The library ────────────────────────────────────────────────────────────

/** Filters appear once there are enough stories to need them; search later still. */
const FILTERS_FROM = 6;
const SEARCH_FROM = 11;

function newWordList(words: ReadonlyArray<string | { sk?: string; lemma?: string }>): string[] {
	return words.map((w) => (typeof w === "string" ? w : (w.sk ?? w.lemma ?? ""))).filter(Boolean);
}

/** One line of what a story is: level, length, new words, share of words the app counts as known. Parts that do not exist are left out. */
export function storyMeta(s: {
	level: string;
	wordCount: number;
	coverage: number;
	newWords: ReadonlyArray<string | { sk?: string; lemma?: string }>;
}): string {
	const parts = [s.level, `about ${Math.max(1, Math.round(s.wordCount / 80))} min`];
	const fresh = newWordList(s.newWords);
	if (fresh.length) parts.push(`${fresh.length} new ${fresh.length === 1 ? "word" : "words"}`);
	if (s.coverage > 0) parts.push(`${Math.round(s.coverage * 100)}% of words counted as known`);
	return parts.join(" · ");
}

const partsWord = (parts: number) => `${parts} ${parts === 1 ? "part" : "parts"}`;

export function sourceMeta(entry: SourceEntry): string {
	const notStarted =
		entry.written > 0 ? "not started" : entry.preparing ? "part 1 is being written" : "not written yet";
	const progress = entry.finished
		? `read · ${partsWord(entry.parts)}`
		: entry.read === 0
			? `${partsWord(entry.parts)} · ${notStarted}`
			: `part ${entry.nextPart} of ${entry.parts} is next`;
	return [
		entry.site,
		progress,
		entry.difficulty === "level" ? null : difficultyInfo(entry.difficulty, "").label.toLowerCase(),
		entry.shortened ? "a shorter version" : null,
		entry.truncated ? `only its first ${MAX_SOURCE_WORDS.toLocaleString("en-US")} words` : null,
	]
		.filter(Boolean)
		.join(" · ");
}

function sourceLine(source: StorySource): string {
	const from = `“${source.title}”${source.site ? ` · ${source.site}` : ""}`;
	if (source.difficulty === "full") return `Not simplified, from ${from}`;
	return `Retold ${source.difficulty === "harder" ? "a step above your level" : "at your level"} from ${from}`;
}

function endHeading(source: StorySource | undefined, reread: boolean): string {
	if (!source) return reread ? "Episode read again!" : "Episode read!";
	if (reread) return `Part ${source.part} of ${source.parts} read again!`;
	return source.part === source.parts ? "You read the whole text!" : `Part ${source.part} of ${source.parts} read!`;
}

function endWhere(story: StoryRecord, reread: boolean): string {
	const source = story.source;
	if (source && source.part === source.parts && source.parts > 1 && !reread) return `All ${source.parts} parts read`;
	return `${kindOf(story)} read${reread ? " again" : ""}`;
}

function nextPartStoryId(state: ReadingState | null, story: StoryRecord): string | undefined {
	const entry = story.source && state?.sources?.find((s) => s.id === story.source!.id);
	return entry && entry.nextPart === story.source!.part + 1 ? entry.nextStoryId : undefined;
}

const LEVEL_RANK: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
const LEVEL_NAME: Record<string, string> = {
	A1: "Beginner",
	A2: "Elementary",
	B1: "Intermediate",
	B2: "Upper intermediate",
	C1: "Advanced",
};
const readMinutes = (words: number) => Math.max(1, Math.round(words / 80));

export function storyBookMeta(s: Pick<LibraryEntry, "wordCount" | "coverage" | "lastScore">): string {
	const parts = [`about ${readMinutes(s.wordCount)} min`];
	if (s.coverage > 0) parts.push(`${Math.round(s.coverage * 100)}% counted as known`);
	if (s.lastScore) parts.push(`${s.lastScore.correct} of ${s.lastScore.total} right`);
	return parts.join(" · ");
}

function Shelf({
	state,
	linksBeingRead,
	onOpen,
	onWrite,
	onAdd,
	onOpenPart,
	onRemoveSource,
}: {
	state: ReadingState | null;
	linksBeingRead: number;
	onOpen: (id: string) => void;
	onWrite: (topic?: string) => void;
	onAdd: () => void;
	onOpenPart: (sourceId: string, part: number, storyId?: string) => void;
	onRemoveSource: (sourceId: string) => void;
}) {
	const lang = useActiveLanguage();
	const library = useMemo(() => state?.library ?? [], [state]);
	const stories = useMemo(() => library.filter((s) => !s.source), [library]);
	const sources = state?.sources ?? [];
	const [level, setLevel] = useState<string>("all");
	const [status, setStatus] = useState<"all" | "unread" | "read">("all");
	const [query, setQuery] = useState("");
	const [askingTopic, setAskingTopic] = useState(false);
	const [topic, setTopic] = useState("");
	const canWrite = state?.canWrite !== false;

	const pick = library.find((s) => s.id === state?.current?.id) ?? stories.find((s) => s.reads === 0);
	const nextBookId = pick?.source?.id ?? pick?.id ?? null;
	const levels = useMemo(
		() => [...new Set(stories.map((s) => s.level))].sort((a, b) => (LEVEL_RANK[a] ?? 9) - (LEVEL_RANK[b] ?? 9)),
		[stories],
	);
	const filtering = level !== "all" || status !== "all" || query.trim() !== "";
	const unread = stories.filter((s) => s.reads === 0).length;

	const storyBook = useCallback(
		(s: LibraryEntry): ListBook => ({
			id: s.id,
			title: s.title,
			titleLang: lang?.code,
			level: s.level,
			state: s.id === nextBookId ? "next" : s.reads > 0 ? "read" : "unread",
			kind: kindOf(s),
			length: `${readMinutes(s.wordCount)} min`,
			meta: storyBookMeta(s),
			about: [s.theme, s.topic].filter(Boolean).join(" "),
			known: s.coverage,
			cover: s.cover,
			newWords: s.newWords,
			actionLabel: s.reads > 0 ? "Read again" : "Read",
			onRead: () => onOpen(s.id),
		}),
		[nextBookId, lang, onOpen],
	);

	const storyGroups = useMemo((): BookGroup[] => {
		const q = query.trim().toLowerCase();
		const shown = stories
			.filter((s) => (level === "all" ? true : s.level === level))
			.filter((s) => (status === "all" ? true : status === "unread" ? s.reads === 0 : s.reads > 0))
			.filter(
				(s) =>
					!q ||
					s.title.toLowerCase().includes(q) ||
					(s.topic ?? "").toLowerCase().includes(q) ||
					(s.genre ? genreInfo(s.genre).label.toLowerCase().includes(q) : false),
			)
			.map(storyBook);
		const shownLevels = levels.filter((l) => shown.some((b) => b.level === l));
		if (shownLevels.length < 2 && levels.length < 2) return shown.length ? [{ label: "", books: shown }] : [];
		return shownLevels.map((l) => ({ label: l, name: LEVEL_NAME[l], books: shown.filter((b) => b.level === l) }));
	}, [stories, levels, level, status, query, storyBook]);

	const sourceBooks = sources.map((entry): ListBook => ({
		id: entry.id,
		title: entry.title,
		level: entry.level,
		state: entry.id === nextBookId ? "next" : entry.finished ? "read" : "unread",
		beingWritten: entry.preparing,
		kind: entry.site ?? "Your text",
		length: `${entry.read}/${entry.parts}`,
		meta: sourceMeta({ ...entry, site: undefined }),
		about: entry.title,
		progress: entry.read / Math.max(1, entry.parts),
		actionLabel: entry.finished ? "Read again" : `Read part ${entry.nextPart}`,
		onRead: () => onOpenPart(entry.id, entry.nextPart, entry.nextStoryId),
		onRemove: () => onRemoveSource(entry.id),
	}));

	const pickStory = pick && !pick.source ? stories.find((s) => s.id === pick.id) : undefined;
	const nextBook = sourceBooks.find((b) => b.id === nextBookId) ?? (pickStory ? storyBook(pickStory) : undefined);

	const addSlot: ListSlot | undefined = canWrite
		? {
				label: "Add a text",
				hint: "A link or pasted article, at your level",
				icon: <PlusIcon />,
				onClick: onAdd,
				testId: "read-add",
			}
		: undefined;
	const writeSlot: ListSlot | undefined = canWrite
		? {
				label: unread ? "Write another episode" : "Write a new episode",
				hint: "About a topic you pick",
				icon: <SparklesIcon />,
				onClick: () => setAskingTopic((asking) => !asking),
				expanded: askingTopic,
				testId: "read-write-next",
			}
		: undefined;

	const ownShelf = (
		<section className="mt-9" aria-label="Your reading">
			<h2 className="q-sh">
				Your reading
				{sources.length > 0 && <small>{sources.length}</small>}
			</h2>
			{sources.length === 0 && (
				<p className="q-line dim mb-2" data-testid="read-sources-empty">
					An article or a newsletter you mean to read? Add its link or paste the text, and read it here, as easy or as
					hard as you choose.
				</p>
			)}
			{linksBeingRead > 0 && (
				<p
					className="mb-2 flex items-center gap-2 text-[14px] text-ink-2"
					role="status"
					data-testid="read-links-being-read"
				>
					<LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
					Reading {linksBeingRead} links. They come onto the shelf as they are read.
				</p>
			)}
			{(sources.length > 0 || addSlot) && (
				<BookList
					groups={sourceBooks.length ? [{ label: "", books: sourceBooks }] : []}
					slot={addSlot}
					label="Your reading"
					testId="read-sources"
				/>
			)}
			{!canWrite && sources.length === 0 && (
				<div className="mt-3">
					<KeyNote>Your own texts are written with an AI key.</KeyNote>
				</div>
			)}
		</section>
	);

	const storyShelf = stories.length > 0 && (
		<section className="mt-9" aria-label="Stories">
			<h2 className="q-sh">
				Stories
				<small>{stories.length}</small>
			</h2>
			{stories.length >= FILTERS_FROM && (
				<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="read-filters">
					<div className="q-segc" role="radiogroup" aria-label="Level">
						{["all", ...levels].map((l) => (
							<button
								key={l}
								type="button"
								role="radio"
								aria-checked={level === l}
								className={cn(level === l && "on")}
								onClick={() => setLevel(l)}
							>
								{l === "all" ? "All" : l}
							</button>
						))}
					</div>
					<div className="q-segc" role="radiogroup" aria-label="Status">
						{(["all", "unread", "read"] as const).map((st) => (
							<button
								key={st}
								type="button"
								role="radio"
								aria-checked={status === st}
								className={cn(status === st && "on")}
								onClick={() => setStatus(st)}
							>
								{st === "all" ? "All" : st === "unread" ? "Unread" : "Read"}
							</button>
						))}
					</div>
				</div>
			)}
			{stories.length >= SEARCH_FROM && (
				<div className="q-jump mb-3 !h-10 !shadow-[0_0_0_1px_var(--q-line-2)]">
					<SearchIcon className="size-4 text-ink-3" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search by title or topic"
						aria-label="Search stories"
						className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3"
					/>
				</div>
			)}
			{storyGroups.length > 0 ? (
				<BookList groups={storyGroups} slot={filtering ? undefined : writeSlot} label="Stories" testId="read-library" />
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
			{askingTopic && canWrite && (
				<div className="q-card mt-4 p-4 sm:p-5" data-testid="read-topic-prompt">
					<div className="flex items-center justify-between gap-2">
						<label htmlFor="story-topic" className="text-[14px] font-semibold text-foreground">
							What should it be about? <span className="font-normal text-ink-3">(optional)</span>
						</label>
						<button
							type="button"
							onClick={() => setAskingTopic(false)}
							className="-mr-1.5 rounded-md p-2.5 text-ink-3 hover:bg-well hover:text-foreground"
							aria-label="Close"
						>
							<XIcon className="size-4" />
						</button>
					</div>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							onWrite(topic.trim() || undefined);
						}}
						className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center"
					>
						<input
							id="story-topic"
							type="text"
							value={topic}
							onChange={(e) => setTopic(e.target.value)}
							placeholder="Buying train tickets, meeting a neighbor, finding a flat"
							className="q-field h-10 w-full shrink-0 px-3.5 text-[14px] sm:flex-1 sm:shrink"
							autoFocus
							maxLength={150}
						/>
						<button type="submit" className="q-btn primary shrink-0" data-testid="read-write-submit">
							<SparklesIcon className="size-4" />
							Write episode
						</button>
					</form>
					<div className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
						<span className="font-medium">Ideas:</span>
						{["At the café", "The train station", "At the doctor's", "Finding a flat", "Sunday lunch"].map((idea) => (
							<button
								key={idea}
								type="button"
								onClick={() => {
									setTopic(idea);
									onWrite(idea);
								}}
								className="rounded-md bg-well px-2 py-1 text-foreground hover:bg-well-2"
							>
								{idea}
							</button>
						))}
					</div>
				</div>
			)}
			{!canWrite && (
				<div className="mt-4">
					<KeyNote>New episodes are written with an AI key.</KeyNote>
				</div>
			)}
		</section>
	);

	return (
		<div className="flex flex-1 flex-col overflow-y-auto pb-16 pt-8 [scrollbar-gutter:stable]">
			<div className={cn(COLUMN, "max-w-5xl lanna-rise")} data-testid="read-shelf-list">
				<Link href="/" className="inline-flex min-h-6 items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<XIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
				<div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
					<div>
						<h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Read</h1>
						<p className="q-line dim mt-1">
							Stories at your level, and your own articles and newsletters. Tap any word for its meaning.
						</p>
					</div>
					<StoryAudioControl />
				</div>
				{nextBook && (
					<div className="mt-7">
						<NextUp book={nextBook} />
					</div>
				)}

				{stories.length === 0 && sources.length === 0 && (
					<div className="mt-8">
						<EmptyState
							testid="read-empty"
							title="No episodes yet"
							action={
								canWrite ? (
									<button type="button" onClick={() => onWrite()} className="q-btn primary">
										Write the first episode
									</button>
								) : (
									<AddKeyButton />
								)
							}
							secondary={
								<Link href="/" className="q-btn ghost">
									Back to Today
								</Link>
							}
						>
							<p>Episodes are short stories at your level, with every word tappable.</p>
							<p>
								{canWrite
									? "The first one takes about a minute to write, then it is kept here."
									: "They are written with an AI key. Once you add one, your first episode is ready in about a minute."}
							</p>
						</EmptyState>
					</div>
				)}

				{sources.length > 0 ? (
					<>
						{ownShelf}
						{storyShelf}
					</>
				) : (
					<>
						{storyShelf}
						{ownShelf}
					</>
				)}
				<SourcesNote feature="read" className="mt-10" />
			</div>
		</div>
	);
}
