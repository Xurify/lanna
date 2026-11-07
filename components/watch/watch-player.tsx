"use client";

/**
 * Watch (LangHarness, 2026-10-28) — the Watch task's screen. Paste a
 * YouTube link; the app fetches the Slovak captions, cuts them into
 * lines, translates and glosses them once (src/server/watch.ts), then:
 *
 *   - the pre-watch pass: how much of the video you know, in the same
 *     terms as the Listen task (93% is where listening works on its own),
 *     and the unknown words worth meeting first, each with its gloss,
 *     how often it comes up and its sound;
 *   - the video in YouTube's own player (nothing downloaded) with both
 *     subtitles under it, every Slovak word tappable for its meaning and
 *     form;
 *   - line by line (the default, built for "I catch the words but can't
 *     assemble the meaning fast enough"): each line plays with the text
 *     hidden and the video pauses at its end; replay (R), slow it down
 *     (S), show the Slovak (T), show the meaning (M), then "Got it"
 *     (Enter) or "Not yet" (N). What was got on the first unaided listen
 *     is the listening-speed signal the milestone page reads;
 *   - straight through: both subtitles live, the transcript below, click
 *     a line to jump;
 *   - the comprehension check at your level, then the end screen: XP,
 *     lines got first time, words a minute, the words now in your deck.
 *
 * Full screen like a lesson (Escape leaves). Research in src/core/watch.ts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon, ExternalLinkIcon, LanguagesIcon, LibraryIcon, ListIcon, LoaderCircleIcon, MonitorPlayIcon, PauseIcon, PlayIcon, RepeatIcon, SnailIcon, ScissorsIcon, SparklesIcon, Trash2Icon, Volume2Icon, XIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { useActivity, type FeedTask } from "@/components/activity-dock";
import { EmptyState, KeyNote, AddKeyButton } from "@/components/quiet/empty-state";
import { cn } from "@/lib/utils";
import { BUTTON, PRIMARY, SECONDARY } from "@/components/ui/learn-buttons";
import { useActiveTime } from "@/components/use-active-time";
import { switchLanguage } from "@/components/switch-language";
import { speak, useActiveLanguage } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { Check } from "@/components/reading/check";
import { Tag, Word } from "@/components/reading/word";
import { coverageBand, coverageKind, formatClock, GAP_CAP_MS, LINE_DECISION_CAP_MS, listeningSpeed, LISTEN_FLOOR, parseVideoUrl, watchClockOn, watchXp, type SegmentStat, type VideoRecord, type WatchMode, type WatchState, captionLanguageName, SENTENCE_MAX_CHARS, sentenceTargets, type SentenceTarget } from "@/src/core";
import { fillStyle } from "@/components/ui/fill";
import { ChannelLink } from "@/components/watch/channel-link";
import { Shelf } from "@/components/watch/shelf";
import { forgetWatchCaches } from "@/components/watch/caches";
import { StudySections } from "@/components/watch/sections";
import { useDiscover } from "@/components/watch/discover";
import { videoUrl, type DiscoverStateView, type FragmentRange } from "@/src/core";
import { SourcesNote } from "@/components/sources/sources-note";

type Stage = "shelf" | "preview" | "watch" | "questions" | "end" | "error";

interface Outcome {
	xp: number;
	correct: number;
	total: number;
	gotFirst: number;
	gotAfter: number;
	missed: number;
	queued: string[];
	rewatch: boolean;
	summary: { todayXp: number; dailyGoal: number; streak: { days: number } };
}

interface PrepareError {
	message: string;
	noCaptions?: boolean;
	canTranscribe?: boolean;
	meta?: { title: string; channel?: string; durationSec: number } | null;
	/** Another of the learner's languages the video is spoken in. */
	elsewhere?: { profile: string; english: string } | null;
}

const COLUMN = "mx-auto w-full max-w-3xl px-6";
const SLOW_RATE = 0.75;

export function WatchPlayer({ initial, initialVideo, initialUrl, initialDiscover }: { initial: WatchState | null; initialVideo?: VideoRecord | null; initialUrl?: string | null; initialDiscover?: DiscoverStateView | null }) {
	const lang = useActiveLanguage();
	const router = useRouter();
	const discover = useDiscover(initialDiscover ?? null);
	const [state, setState] = useState<WatchState | null>(initial);
	const [video, setVideo] = useState<VideoRecord | null>(initialVideo ?? null);
	const [stage, setStage] = useState<Stage>(initialVideo ? "preview" : "shelf");
	const [error, setError] = useState<PrepareError | null>(null);
	const [pending, setPending] = useState<string | null>(initialUrl ?? null);
	// The link being sent to the server: the shelf shows a row for it, and stays usable.
	const [starting, setStarting] = useState<string | null>(initialUrl ?? null);
	const stageRef = useRef(stage);
	stageRef.current = stage;
	const [mode, setMode] = useState<WatchMode>("step");
	const [tapped, setTapped] = useState<string[]>([]);
	const [answers, setAnswers] = useState<number[]>([]);
	const [stats, setStats] = useState<SegmentStat[]>([]);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [saving, setSaving] = useState(false);
	const startedAt = useRef(Date.now());
	// The watch clock counts while the video plays, and while the learner works
	// (a paused line, a question): after GAP_CAP_MS with no action it stops.
	const [videoPlaying, setVideoPlaying] = useState(false);
	const [videoReady, setVideoReady] = useState(false);
	const [deciding, setDeciding] = useState(false);
	const [decideCapped, setDecideCapped] = useState(false);
	useEffect(() => {
		setDecideCapped(false);
		if (!deciding) return;
		const t = window.setTimeout(() => setDecideCapped(true), LINE_DECISION_CAP_MS);
		return () => window.clearTimeout(t);
	}, [deciding]);
	const [idle, setIdle] = useState(false);
	const working = stage === "watch" || stage === "questions";
	useEffect(() => {
		if (!working) return;
		setIdle(false);
		let timer = window.setTimeout(() => setIdle(true), GAP_CAP_MS);
		const act = () => {
			setIdle(false);
			window.clearTimeout(timer);
			timer = window.setTimeout(() => setIdle(true), GAP_CAP_MS);
		};
		// Focus moving into the player's frame is a click on it: its own events do not reach this window.
		const events = ["pointerdown", "keydown", "wheel", "touchstart", "blur"] as const;
		for (const e of events) window.addEventListener(e, act, { passive: true });
		return () => {
			window.clearTimeout(timer);
			for (const e of events) window.removeEventListener(e, act);
		};
	}, [working]);
	const activeTime = useActiveTime("watch", "passive", { active: watchClockOn({ watching: stage === "watch", questions: stage === "questions", ready: videoReady, playing: videoPlaying, deciding, decideCapped, idle }) });

	const { feed } = useActivity();
	const running = feed.tasks.filter((t) => t.kind === "video" && t.status === "running");
	// The library follows the background tasks: a video that finished is on the shelf without a reload.
	const taskSig = feed.tasks.filter((t) => t.kind === "video").map((t) => `${t.id}:${t.status}`).join("|");
	const seenSig = useRef(taskSig);

	const load = useCallback(async () => {
		try {
			const res = await fetch(`/api/watch?tz=${new Date().getTimezoneOffset()}`);
			if (res.ok) setState((await res.json()) as WatchState);
		} catch {
			// the page keeps what it has
		}
	}, []);

	/** Prepare a pasted link. The server fetches, translates and keeps it as a
	 *  background task (the sidebar lists it, a notice says when it is ready),
	 *  so the learner is back on the shelf at once. A video already kept opens. */
	const rangeRef = useRef<FragmentRange | undefined>(undefined);
	const prepare = useCallback(
		async (url: string, transcribe = false, force = false, range?: FragmentRange) => {
			rangeRef.current = range;
			const id = parseVideoUrl(url);
			if (!id) {
				setError({ message: "That is not a YouTube link. Paste a youtube.com/watch, youtu.be or shorts link." });
				setStarting(null);
				setStage("error");
				return;
			}
			setPending(url);
			setError(null);
			setStarting(url);
			try {
				const res = await fetch("/api/watch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add", url, transcribe, force, background: true, ...(range ? { range } : {}) }) });
				const body = (await res.json()) as VideoRecord | PrepareError | { background: true };
				if (!res.ok) throw body;
				forgetWatchCaches();
				if ("background" in body) {
					setPending(null);
					void load();
					return;
				}
				if (!("segments" in body)) throw body;
				void load();
				// A kept video opens only if the learner is still on the shelf, not in another video.
				if (stageRef.current !== "shelf") return;
				setVideo(body);
				setTapped([]);
				setAnswers([]);
				setStats([]);
				setOutcome(null);
				setStage("preview");
			} catch (err) {
				const e = err && typeof err === "object" && "message" in err ? (err as PrepareError) : { message: err instanceof Error ? err.message : String(err) };
				setError(e);
				setStage("error");
			} finally {
				setStarting(null);
			}
		},
		[load],
	);

	useEffect(() => {
		if (seenSig.current === taskSig) return;
		seenSig.current = taskSig;
		void load();
	}, [taskSig, load]);

	const kicked = useRef(false);
	useEffect(() => {
		if (kicked.current || !initialUrl || initialVideo) return;
		kicked.current = true;
		void prepare(initialUrl, false, false, rangeRef.current);
	}, [initialUrl, initialVideo, prepare]);

	/** The video is in another language of the learner's: run that language and
	 *  open the link there, where the page prepares it. */
	const [moving, setMoving] = useState(false);
	const [moveError, setMoveError] = useState<string | null>(null);
	const moveTo = useCallback(async (to: { profile: string; english: string }, url: string) => {
		setMoving(true);
		setMoveError(null);
		try {
			await switchLanguage(to.profile, to.english, `/watch?url=${encodeURIComponent(url)}`);
		} catch (err) {
			setMoveError(err instanceof Error ? err.message : String(err));
			setMoving(false);
		}
	}, []);

	const remove = useCallback(
		async (id: string) => {
			try {
				await fetch("/api/watch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", videoId: id }) });
			} catch {
				// the list below says what is still there
			}
			forgetWatchCaches();
			void load();
		},
		[load],
	);

	const open = (id: string) => {
		void fetch(`/api/watch?id=${encodeURIComponent(id)}`)
			.then((r) => (r.ok ? (r.json() as Promise<VideoRecord>) : Promise.reject(new Error(`HTTP ${r.status}`))))
			.then((v) => {
				setVideo(v);
				setTapped([]);
				setAnswers([]);
				setStats([]);
				setOutcome(null);
				setStage("preview");
			})
			.catch((err: Error) => {
				setError({ message: err.message });
				setStage("error");
			});
	};

	const start = useCallback((m: WatchMode) => {
		setMode(m);
		startedAt.current = Date.now();
		activeTime.restart();
		setStage("watch");
	}, [activeTime]);

	const finish = useCallback(
		async (all: number[], segStats: SegmentStat[]) => {
			if (!video || saving) return;
			setSaving(true);
			setStage("end");
			sfx.done();
			try {
				const res = await fetch("/api/watch", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ action: "finish", videoId: video.id, mode, stats: segStats, answers: all, tapped, ms: Date.now() - startedAt.current, activeMs: activeTime.finish(), tz: new Date().getTimezoneOffset() }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				setOutcome((await res.json()) as Outcome);
				void load();
			} catch {
				const correct = video.questions.filter((q, i) => all[i] === q.answer).length;
				const gotFirst = segStats.filter((s) => s.got === "first").length;
				const gotAfter = segStats.filter((s) => s.got === "after").length;
				setOutcome({ xp: watchXp(video.segments.length, gotFirst, gotAfter, correct, false), correct, total: video.questions.length, gotFirst, gotAfter, missed: segStats.filter((s) => s.got === "no").length, queued: [], rewatch: false, summary: { todayXp: 0, dailyGoal: 50, streak: { days: 0 } } });
			} finally {
				setSaving(false);
			}
		},
		[video, saving, mode, tapped, load, activeTime],
	);

	// Escape leaves, like a lesson — unless a word popover is open.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !document.querySelector("[data-word-popover]")) router.push("/");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [router]);

	const onTap = (key: string) => setTapped((t) => (t.includes(key) ? t : [...t, key]));

	if (stage === "error") {
		return (
			<Frame>
				<div className="mx-auto w-full max-w-3xl px-6 pt-[8vh]">
					<EmptyState
						testid="watch-error"
						title={error?.elsewhere ? `This video is in ${error.elsewhere.english}` : "This video could not be prepared"}
						action={
							error?.elsewhere && pending ? (
								<button type="button" onClick={() => void moveTo(error.elsewhere!, pending)} disabled={moving} className="q-btn primary" data-testid="watch-move">
									{moving ? "Switching…" : `Switch to ${error.elsewhere.english} and add it`}
								</button>
							) : error?.noCaptions && error.canTranscribe && pending ? (
								<button type="button" onClick={() => void prepare(pending, true)} className="q-btn primary" data-testid="watch-transcribe">
									Transcribe the audio
								</button>
							) : state?.canPrepare === false ? (
								<AddKeyButton />
							) : pending ? (
								<button type="button" onClick={() => void prepare(pending)} className="q-btn primary">
									Try again
								</button>
							) : undefined
						}
						secondary={
							<button type="button" onClick={() => setStage("shelf")} className="q-btn ghost">
								Pick another video
							</button>
						}
					>
						{error?.meta?.title && <p lang={lang?.code}>{error.meta.title}</p>}
						<p>{error?.message ?? "Something went wrong."}</p>
						{moveError && <p role="alert">{moveError}</p>}
						<p>Videos you have already prepared still play from your list.</p>
					</EmptyState>
				</div>
			</Frame>
		);
	}

	if (stage === "shelf" || !video) {
		return (
			<Shelf state={state} running={running} starting={starting} discover={discover} onOpen={open} onPrepare={(url, range) => void prepare(url, false, false, range)} onDelete={(id) => void remove(id)} />
		);
	}

	if (stage === "preview") {
		return (
			<Frame strip={false}>
				<TopBar video={video} step={`${video.segments.length} lines · ${formatClock(video.durationSec)}`} progress={0} onShelf={() => setStage("shelf")} />
				<Preview video={video} canFind={state?.canPrepare !== false} onStart={start} onRegenerate={() => void prepare(video.url, video.source.kind === "transcription", true)} />
			</Frame>
		);
	}

	if (stage === "questions") {
		return (
			<Frame strip={false}>
				<TopBar video={video} step={`Question ${Math.min(answers.length + 1, video.questions.length)} of ${video.questions.length}`} progress={video.questions.length ? answers.length / video.questions.length : 1} onShelf={() => setStage("shelf")} />
				<Check
					questions={video.questions}
					answers={answers}
					onAnswer={(i) => {
						const all = [...answers, i];
						setAnswers(all);
						if (all.length >= video.questions.length) void finish(all, stats);
					}}
				/>
			</Frame>
		);
	}

	if (stage === "end") {
		return (
			<Frame>
				<End video={video} stats={stats} outcome={outcome} saving={saving} mode={mode} tapped={tapped} onAgain={() => setStage("preview")} onShelf={() => setStage("shelf")} />
			</Frame>
		);
	}

	return (
		<Frame strip={false}>
			<Screen
				video={video}
				mode={mode}
				tapped={tapped}
				onTap={onTap}
				onMode={setMode}
				onShelf={() => setStage("shelf")}
				onPlaying={setVideoPlaying} onReady={setVideoReady} onDeciding={setDeciding} onDone={(segStats) => {
					setStats(segStats);
					if (video.questions.length) setStage("questions");
					else void finish([], segStats);
				}}
			/>
		</Frame>
	);
}

// ─── Chrome ─────────────────────────────────────────────────────────────────

function Frame({ children, strip = true }: { children: React.ReactNode; strip?: boolean }) {
	return (
		<>
			<div className="fixed inset-y-0 right-0 left-0 z-40 flex flex-col bg-background md:left-[var(--sidebar-cols,3.25rem)]">
			{strip && <div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />}
			{children}
			</div>
		</>
	);
}

function TopBar({ video, step, progress, onShelf, right }: { video: VideoRecord; step: string; progress: number; onShelf: () => void; right?: React.ReactNode }) {
	const lang = useActiveLanguage();
	return (
		<div className="lh-drag lh-wco-gutter shrink-0 select-none">
			<div className={cn(COLUMN, "flex h-16 items-center gap-4 pt-2")}>
				<Link href="/" aria-label="Leave the video" className="-ml-1.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
					<XIcon className="size-5" />
				</Link>
				<div className="min-w-0 flex-1">
					<p className="truncate font-ui text-sm font-[600] text-foreground" lang={lang?.code}>
						{video.title} <span className="text-muted-foreground">· {step}</span>
					</p>
					<div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-accent">
						<div className="lh-fill rounded-full bg-teal" style={fillStyle(Math.max(0.02, progress))} />
					</div>
				</div>
				{right}
				<button type="button" onClick={onShelf} aria-label="Your videos" title="Your videos" className="-mr-1.5 flex items-center gap-1.5 rounded-lg p-1.5 text-[13px] font-[550] text-muted-foreground hover:bg-accent hover:text-foreground">
					<LibraryIcon className="size-5" />
					<span className="max-sm:hidden">Videos</span>
				</button>
			</div>
		</div>
	);
}

// ─── The pre-watch pass ─────────────────────────────────────────────────────

function Preview({ video, canFind, onStart, onRegenerate }: { video: VideoRecord; canFind: boolean; onStart: (mode: WatchMode) => void; onRegenerate: () => void }) {
	const lang = useActiveLanguage();
	const band = coverageBand(video.coverage);
	const pct = Math.round(video.coverage * 100);
	const kind = coverageKind({ lang: video.lang, trackLang: video.source.trackLang, estimated: video.coverageEstimated });
	const tone = band.band === "comfortable" ? "text-teal-2" : band.band === "stretch" ? "text-teal-2" : "text-miss";
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// Enter in a field (a study section's gap) belongs to that field.
			if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement) && !(e.target instanceof HTMLInputElement)) {
				e.preventDefault();
				onStart("step");
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onStart]);
	return (
		<div className="flex flex-1 flex-col overflow-y-auto pb-10 pt-[4vh]">
			<div className={cn(COLUMN, "lh-rise")} data-testid="watch-preview">
				<p className="font-ui text-sm font-[600] text-muted-foreground">
					{video.channel && (
						<>
							<ChannelLink id={video.channelId} name={video.channel} />
							{" · "}
						</>
					)}
					{formatClock(video.durationSec)}
					{video.fragment ? ` (${formatClock(video.fragment.startSec)} to ${formatClock(video.fragment.endSec)} of a ${formatClock(video.fragment.ofSec)} video)` : ""} · {video.source.kind === "captions" ? "captions by people" : video.source.kind === "auto-captions" ? "YouTube's automatic captions" : "transcribed from the audio"}
					{video.source.trackLang !== video.lang ? ` in ${captionLanguageName(video.source.trackLang)}` : ""}
					{video.untranslated ? ` · ${video.untranslated} ${video.untranslated === 1 ? "line has" : "lines have"} no English translation` : ""}
				</p>
				<h1 className="mt-1 font-ui text-3xl font-[600] text-foreground" lang={video.lang}>
					{video.title}
					<a href={videoUrl(video.id)} target="_blank" rel="noreferrer" aria-label="Open this video on YouTube" title="Open on YouTube" className="ml-2 inline-flex size-8 translate-y-0.5 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-preview-youtube">
						<ExternalLinkIcon className="size-4" strokeWidth={1.6} />
					</a>
				</h1>

				<div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr]">
					{kind === "none" ? (
						<div className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4" data-testid="watch-coverage">
							<div>
								<p className="font-ui text-2xl font-[600] text-foreground">{captionLanguageName(video.source.trackLang)} captions</p>
								<p className="font-ui text-sm font-[600] text-muted-foreground">No known-word share</p>
							</div>
						</div>
					) : (
						<div className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4" data-testid="watch-coverage">
							<Ring value={video.coverage} floor={LISTEN_FLOOR} tone={tone} />
							<div>
								<p className={cn("font-ui text-2xl font-[600]", tone)}>{band.title}</p>
								<p className="font-ui text-sm font-[600] text-muted-foreground">
									{kind === "estimated" ? "About " : ""}
									{pct} of every 100 words known
								</p>
							</div>
						</div>
					)}
					<div className="rounded-lg border bg-card px-5 py-4">
						<p className="font-prose text-base leading-snug text-foreground">{kind === "none" ? `The captions are ${captionLanguageName(video.source.trackLang)}, so their words are not matched against your ${captionLanguageName(video.lang)}. Regenerate to get an estimate from a ${captionLanguageName(video.lang)} rendering of them.` : kind === "estimated" ? `${band.line} An estimate: measured on a ${captionLanguageName(video.lang)} rendering of the ${captionLanguageName(video.source.trackLang)} captions.` : band.line}</p>
						<p className="mt-2 font-prose text-sm text-muted-foreground">
							{video.wordCount} words · {video.unknownCount} you have not studied{video.expected !== undefined && kind !== "none" ? ` · ${Math.round(video.expected * 100)}% expected at ${video.level}` : ""} · {video.segments.length} lines · a check of {video.questions.length} at {video.level}
						</p>
					</div>
				</div>

				{video.preTeach.length > 0 && (
					<div className="mt-6" data-testid="watch-preteach">
						<p className="font-ui text-sm font-[600] text-muted-foreground">Meet these first — they come up in the video and you have not met them</p>
						<ul className="mt-2 grid gap-2 sm:grid-cols-2">
							{video.preTeach.map((w) => (
								<li key={w.slug ?? w.lemma} className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3">
									<button type="button" onClick={() => void speak(w.lemma).catch(() => {})} aria-label={`Play ${w.lemma}`} className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
										<Volume2Icon className="size-4" />
									</button>
									<span className="min-w-0 flex-1">
										<span className="flex flex-wrap items-baseline gap-x-2">
											<span className="font-ui text-lg font-[600] text-foreground" lang={lang?.code}>
												{w.lemma}
											</span>
											<span className="font-prose text-base text-foreground">{w.gloss}</span>
										</span>
										<span className="mt-0.5 flex flex-wrap items-center gap-1.5">
											<Tag>{w.count === 1 ? "once" : `${w.count}× in the video`}</Tag>
											{w.cat && <Tag>{w.cat.toLowerCase()}</Tag>}
										</span>
										<span className="mt-1 block truncate font-prose text-xs text-muted-foreground" lang={lang?.code} title={w.example}>
											{w.example}
										</span>
									</span>
								</li>
							))}
						</ul>
					</div>
				)}

				<div className="mt-8 grid gap-3 sm:grid-cols-2">
					<button type="button" onClick={() => onStart("step")} className="group rounded-lg border border-teal bg-teal-wash p-5 text-left transition-colors hover:brightness-105" data-testid="watch-start-step">
						<span className="flex items-center gap-2 font-ui text-lg font-[600] text-foreground">
							<PlayIcon className="size-5 fill-current text-teal-2" />
							Line by line
							<kbd className="ml-auto rounded-md border bg-card px-1.5 font-ui text-xs font-[600] text-muted-foreground">Enter</kbd>
						</span>
						<span className="mt-1 block font-prose text-sm text-foreground/80">Each line plays with the text hidden and pauses. Replay, slow it, reveal — then say whether you got it. The one for assembling meaning at speed.</span>
					</button>
					<button type="button" onClick={() => onStart("flow")} className="rounded-lg border bg-card p-5 text-left transition-colors hover:shadow-raise-hi" data-testid="watch-start-flow">
						<span className="flex items-center gap-2 font-ui text-lg font-[600] text-foreground">
							<ListIcon className="size-5 text-muted-foreground" />
							Straight through
						</span>
						<span className="mt-1 block font-prose text-sm text-muted-foreground">Both subtitles live under the video, the whole transcript below. Click any line to jump. Tap any word.</span>
					</button>
				</div>

				{video.source.trackLang === video.lang && <StudySections video={video} canFind={canFind} />}

				<div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1">
					<button type="button" onClick={onRegenerate} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-ui text-sm font-[600] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-regenerate">
						<RepeatIcon className="size-4" strokeWidth={1.6} />
						Regenerate
					</button>
					<span className="font-prose text-sm text-muted-foreground">Fetches the captions again and translates them again (one model call, two for captions in another language). Your past watchings stay.</span>
				</div>
			</div>
		</div>
	);
}

/** The coverage as a ring, with the comfortable floor marked. */
function Ring({ value, floor, tone }: { value: number; floor: number; tone: string }) {
	const r = 26;
	const c = 2 * Math.PI * r;
	const angle = (p: number) => -90 + p * 360;
	const mark = (p: number, radius: number) => ({ x: 32 + radius * Math.cos((angle(p) * Math.PI) / 180), y: 32 + radius * Math.sin((angle(p) * Math.PI) / 180) });
	const a = mark(floor, r - 6);
	const b = mark(floor, r + 6);
	return (
		<svg viewBox="0 0 64 64" className="size-20 shrink-0" aria-hidden="true">
			<circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-accent" />
			<circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className={tone} strokeDasharray={`${c * Math.max(0.01, value)} ${c}`} transform="rotate(-90 32 32)" />
			<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeWidth="2" className="text-foreground/50" />
			<text x="32" y="36" textAnchor="middle" className="fill-current font-ui text-[15px] font-[600] text-foreground">
				{Math.round(value * 100)}%
			</text>
		</svg>
	);
}

// ─── The screen: YouTube's player with both subtitles ───────────────────────

interface YTPlayer {
	playVideo(): void;
	pauseVideo(): void;
	seekTo(seconds: number, allowSeekAhead: boolean): void;
	getCurrentTime(): number;
	getPlayerState(): number;
	setPlaybackRate(rate: number): void;
	destroy(): void;
	/** Undocumented but long-standing: drops the player's own caption
	 *  module, so a track the viewer left switched on does not show the
	 *  line we are hiding. */
	unloadModule?(name: string): void;
}
interface YTNamespace {
	Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
	PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number };
}
declare global {
	interface Window {
		YT?: YTNamespace;
		onYouTubeIframeAPIReady?: () => void;
	}
}

let apiPromise: Promise<YTNamespace> | null = null;

/** YouTube's IFrame Player API, loaded once. */
function loadYouTubeApi(): Promise<YTNamespace> {
	if (window.YT?.Player) return Promise.resolve(window.YT);
	if (apiPromise) return apiPromise;
	apiPromise = new Promise<YTNamespace>((resolve, reject) => {
		const previous = window.onYouTubeIframeAPIReady;
		window.onYouTubeIframeAPIReady = () => {
			previous?.();
			if (window.YT) resolve(window.YT);
		};
		const s = document.createElement("script");
		s.src = "https://www.youtube.com/iframe_api";
		s.async = true;
		s.onerror = () => {
			apiPromise = null;
			reject(new Error("YouTube's player did not load. Is the internet on?"));
		};
		document.head.appendChild(s);
		setTimeout(() => {
			if (!window.YT?.Player) {
				apiPromise = null;
				reject(new Error("YouTube's player did not load. Is the internet on?"));
			}
		}, 20_000);
	});
	return apiPromise;
}

interface LineState {
	replays: number;
	slow: boolean;
	revealedText: boolean;
	revealedMeaning: boolean;
	got?: SegmentStat["got"];
}

const fresh = (): LineState => ({ replays: 0, slow: false, revealedText: false, revealedMeaning: false });

function Screen({ video, mode, tapped, onTap, onMode, onShelf, onDone, onPlaying, onReady, onDeciding }: { video: VideoRecord; mode: WatchMode; tapped: string[]; onTap: (key: string) => void; onMode: (m: WatchMode) => void; onShelf: () => void; onDone: (stats: SegmentStat[]) => void; onPlaying: (on: boolean) => void; onReady: (on: boolean) => void; onDeciding: (on: boolean) => void }) {
	const lang = useActiveLanguage();
	const holder = useRef<HTMLDivElement>(null);
	const player = useRef<YTPlayer | null>(null);
	const [ready, setReady] = useState(false);
	const [playerError, setPlayerError] = useState<string | null>(null);
	const [idx, setIdx] = useState(0);
	const [playing, setPlaying] = useState(false);
	useEffect(() => {
		onPlaying(playing);
		return () => onPlaying(false);
	}, [playing, onPlaying]);
	const [atEnd, setAtEnd] = useState(false);
	const [heard, setHeard] = useState(false);
	const [rate, setRate] = useState(1);
	const [line, setLine] = useState<LineState>(fresh());
	const [showEn, setShowEn] = useState(true);
	const [popover, setPopover] = useState<number | null>(null);
	const lines = useRef(new Map<number, LineState>());
	const segs = video.segments;
	const seg = segs[idx]!;
	const idxRef = useRef(idx);
	idxRef.current = idx;
	const modeRef = useRef(mode);
	modeRef.current = mode;
	const atEndRef = useRef(false);

	// The player: YouTube's own, in the box that already has its size (no
	// layout shift); the first line starts as soon as it is ready.
	useEffect(() => {
		let alive = true;
		let p: YTPlayer | null = null;
		loadYouTubeApi()
			.then((YT) => {
				if (!alive || !holder.current) return;
				const el = document.createElement("div");
				holder.current.replaceChildren(el);
				p = new YT.Player(el, {
					videoId: video.id,
					width: "100%",
					height: "100%",
					host: "https://www.youtube-nocookie.com",
					playerVars: { controls: 1, rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 0, iv_load_policy: 3, disablekb: 1, fs: 0, origin: window.location.origin, start: Math.floor(segs[0]!.start), ...(video.fragment ? { end: Math.ceil(segs[segs.length - 1]!.end + 1) } : {}) },
					events: {
						onReady: () => {
							if (!alive) return;
							player.current = p;
							// YouTube remembers "captions on" per viewer and ignores
							// cc_load_policy for it; the lines are ours to show.
							try {
								p!.unloadModule?.("captions");
								p!.unloadModule?.("cc");
							} catch {}
							setReady(true);
							p!.seekTo(segs[0]!.start, true);
							p!.playVideo();
						},
						onStateChange: (e: { data: number }) => {
							if (!alive) return;
							setPlaying(e.data === YT.PlayerState.PLAYING);
							if (e.data === YT.PlayerState.PLAYING) setHeard(true);
							if (e.data === YT.PlayerState.ENDED && modeRef.current === "flow") setAtEnd(true);
						},
						onError: (e: { data: number }) => {
							if (!alive) return;
							setPlayerError(e.data === 101 || e.data === 150 ? "The owner of this video does not allow it to be embedded. Open it on YouTube and read the lines here." : e.data === 100 ? "This video was removed or is private." : `YouTube could not play this video (error ${e.data}). The lines still work here.`);
						},
					},
				});
			})
			.catch((err: Error) => alive && setPlayerError(err.message));
		return () => {
			alive = false;
			try {
				p?.destroy();
			} catch {
				// already gone
			}
			player.current = null;
		};
	}, [video.id]);

	// The clock: in step mode the video stops at the line's end; in flow
	// mode the line under the video follows the sound.
	useEffect(() => {
		if (!ready) return;
		const tick = setInterval(() => {
			const p = player.current;
			if (!p) return;
			let t = 0;
			try {
				t = p.getCurrentTime();
			} catch {
				return;
			}
			const i = idxRef.current;
			const s = segs[i]!;
			if (modeRef.current === "step") {
				if (t >= s.end - 0.06 && !atEndRef.current) {
					atEndRef.current = true;
					p.pauseVideo();
					setAtEnd(true);
				}
				return;
			}
			// Flow: the line that holds the clock (the last one started).
			let j = i;
			const nextStart = segs[i + 1]?.start ?? Number.POSITIVE_INFINITY;
			if (t < s.start - 0.3 || t >= nextStart) {
				j = segs.findIndex((x, k) => t >= x.start && (k + 1 >= segs.length || t < segs[k + 1]!.start));
				if (j < 0) j = t < segs[0]!.start ? 0 : segs.length - 1;
			}
			if (j !== i) {
				setIdx(j);
				setPopover(null);
			}
		}, 120);
		return () => clearInterval(tick);
	}, [ready, segs]);

	const seek = useCallback(
		(i: number, play = true) => {
			const p = player.current;
			const s = segs[i];
			if (!p || !s) return;
			atEndRef.current = false;
			setAtEnd(false);
			p.seekTo(Math.max(0, s.start - 0.05), true);
			if (play) p.playVideo();
		},
		[segs],
	);

	const goTo = useCallback(
		(i: number, play = true) => {
			const next = Math.max(0, Math.min(segs.length - 1, i));
			setIdx(next);
			setPopover(null);
			setHeard(false);
			setLine(lines.current.get(next) ?? fresh());
			seek(next, play);
		},
		[segs.length, seek],
	);

	const update = useCallback((patch: Partial<LineState>) => {
		const n = { ...(lines.current.get(idxRef.current) ?? fresh()), ...patch };
		lines.current.set(idxRef.current, n);
		setLine(n);
	}, []);

	const replay = useCallback(() => {
		if (modeRef.current === "step") update({ replays: (lines.current.get(idxRef.current)?.replays ?? 0) + 1 });
		seek(idxRef.current);
	}, [seek, update]);

	const toggleSlow = useCallback(() => {
		const p = player.current;
		if (!p) return;
		const next = rate === 1 ? SLOW_RATE : 1;
		p.setPlaybackRate(next);
		setRate(next);
		if (next !== 1 && modeRef.current === "step") {
			update({ slow: true });
			seek(idxRef.current);
		}
	}, [rate, seek, update]);

	const showText = useCallback(() => update({ revealedText: true }), [update]);
	// The meaning only after the Slovak is on screen: hear, then read, then
	// translate — never English straight from the audio (docs/research/
	// desirable-difficulties.md).
	const showMeaning = useCallback(() => {
		if (!(lines.current.get(idxRef.current)?.revealedText ?? false)) return;
		update({ revealedMeaning: true });
	}, [update]);

	const togglePlay = useCallback(() => {
		const p = player.current;
		if (!p) return;
		if (playing) p.pauseVideo();
		else if (modeRef.current === "step" && atEndRef.current) seek(idxRef.current);
		else p.playVideo();
	}, [playing, seek]);

	const statsOf = useCallback((): SegmentStat[] => {
		const out: SegmentStat[] = [];
		for (const [i, l] of lines.current) {
			if (!l.got) continue;
			const s = segs[i]!;
			out.push({ i, words: s.tokens.filter((t) => t.word).length, sec: Math.round((s.end - s.start) * 100) / 100, replays: l.replays, slow: l.slow, revealed: l.revealedText || l.revealedMeaning, got: l.got });
		}
		return out.sort((a, b) => a.i - b.i);
	}, [segs]);

	const advance = useCallback(() => {
		const i = idxRef.current;
		if (i + 1 < segs.length) goTo(i + 1);
		else {
			player.current?.pauseVideo();
			onDone(statsOf());
		}
	}, [segs.length, goTo, onDone, statsOf]);

	/** Got it: on the first unaided listen, or after help. */
	const gotIt = useCallback(() => {
		const l = lines.current.get(idxRef.current) ?? fresh();
		if (l.got === "no") {
			advance();
			return;
		}
		const first = l.replays === 0 && !l.slow && !l.revealedText && !l.revealedMeaning;
		lines.current.set(idxRef.current, { ...l, got: first ? "first" : "after" });
		sfx.right(first ? 2 : 1);
		advance();
	}, [advance]);

	/** Not yet: both lines appear, the line plays once more with them,
	 *  and Continue moves on. Its new words go to the deck. */
	const notYet = useCallback(() => {
		const l = lines.current.get(idxRef.current) ?? fresh();
		if (l.got === "no") return;
		sfx.wrong();
		update({ got: "no", revealedText: true, revealedMeaning: true });
		seek(idxRef.current);
	}, [seek, update]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (popover !== null) return;
			const key = e.key.toLowerCase();
			if (e.key === " ") {
				e.preventDefault();
				togglePlay();
			} else if (key === "r") replay();
			else if (key === "s") toggleSlow();
			else if (key === "t" && mode === "step") showText();
			else if (key === "m") {
				if (mode === "step") showMeaning();
				else setShowEn((v) => !v);
			} else if (e.key === "Enter" && mode === "step") {
				e.preventDefault();
				if (heard || atEnd) gotIt();
			} else if (key === "n" && mode === "step") notYet();
			else if (e.key === "ArrowLeft") goTo(idx - 1);
			else if (e.key === "ArrowRight") {
				if (mode === "step" && idx + 1 >= segs.length) onDone(statsOf());
				else goTo(idx + 1);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [popover, mode, heard, atEnd, idx, segs.length, togglePlay, replay, toggleSlow, showText, showMeaning, gotIt, notYet, goTo, onDone, statsOf]);

	// A click on the player puts keyboard focus inside YouTube's iframe,
	// where our window-level shortcuts (T, R, S, M...) never fire. Take it back.
	useEffect(() => {
		const reclaim = () => {
			setTimeout(() => {
				if (document.activeElement instanceof HTMLIFrameElement) {
					document.activeElement.blur();
					window.focus();
				}
			}, 0);
		};
		window.addEventListener("blur", reclaim);
		return () => window.removeEventListener("blur", reclaim);
	}, []);

	// A word popover pauses the video; close it with a click outside.
	useEffect(() => {
		if (popover === null) return;
		player.current?.pauseVideo();
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

	const switchMode = (m: WatchMode) => {
		onMode(m);
		if (m === "step") {
			atEndRef.current = false;
			setAtEnd(false);
			setLine(lines.current.get(idx) ?? fresh());
			seek(idx);
		} else player.current?.playVideo();
	};

	const step = mode === "step";
	const textShown = !step || line.revealedText;
	const meaningShown = step ? line.revealedMeaning : showEn;
	const prev = idx > 0 ? segs[idx - 1] : null;
	const words = useMemo(() => seg.tokens.filter((t) => t.word).length, [seg]);
	const miss = line.got === "no";
	useEffect(() => {
		onReady(ready);
		return () => onReady(false);
	}, [ready, onReady]);
	// A line waits for the learner once it has played and the video is paused.
	const deciding = step && !playing && heard;
	useEffect(() => {
		onDeciding(deciding);
		return () => onDeciding(false);
	}, [deciding, onDeciding]);

	return (
		<>
			<TopBar
				video={video}
				step={step ? `Line ${idx + 1} of ${segs.length}` : `${formatClock(seg.start)} · ${idx + 1} of ${segs.length}`}
				progress={(idx + (atEnd ? 1 : 0)) / segs.length}
				onShelf={onShelf}
				right={
					<div className="flex items-center rounded-lg bg-accent p-0.5 font-ui text-xs font-[600]" role="group" aria-label="Mode">
						<button type="button" onClick={() => switchMode("step")} aria-pressed={step} className={cn("rounded-md px-2 py-1 transition-colors", step ? "bg-card text-foreground shadow-raise" : "text-muted-foreground hover:text-foreground")} data-testid="watch-mode-step">
							Line by line
						</button>
						<button type="button" onClick={() => switchMode("flow")} aria-pressed={!step} className={cn("rounded-md px-2 py-1 transition-colors", !step ? "bg-card text-foreground shadow-raise" : "text-muted-foreground hover:text-foreground")} data-testid="watch-mode-flow">
							Straight through
						</button>
					</div>
				}
			/>

			<div className="flex flex-1 flex-col overflow-y-auto">
				<div className={cn(COLUMN, "pt-1")}>
					{/* The player keeps its box from the first paint. */}
					<div className="relative mx-auto aspect-video w-full overflow-hidden rounded-lg bg-black" style={{ maxWidth: "calc(min(44vh, 460px) * 16 / 9)" }} data-testid="watch-player">
						<div ref={holder} className="absolute inset-0 [&>iframe]:size-full" />
						{/* In step mode the lines are ours to show, one at a time:
						    this band covers YouTube's own subtitles for the whole
						    mode (a viewer's remembered caption setting survives
						    cc_load_policy, and after a reveal the player would
						    already show the next line). Clicks pass through. */}
						{ready && !playerError && step && (
							<div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[26%] items-end justify-center bg-black pb-2" aria-hidden data-testid="watch-caption-cover">
								<span className="font-ui text-[11px] font-[600] text-sun-ink/40">{textShown ? "the line is below" : "subtitles covered · T to reveal"}</span>
							</div>
						)}
						{!ready && !playerError && (
							<div className="absolute inset-0 flex items-center justify-center text-sun-ink/70">
								<LoaderCircleIcon className="size-8 animate-spin" />
							</div>
						)}
					</div>
					{/* The player's own message stays readable; ours sits under it. */}
					{playerError && (
						<div className="mx-auto mt-3 flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-miss/40 bg-miss-soft px-4 py-3" style={{ maxWidth: "calc(min(44vh, 460px) * 16 / 9)" }} data-testid="watch-player-error">
							<p className="font-prose text-sm text-foreground">{playerError}</p>
							<a href={video.url} target="_blank" rel="noreferrer" className={cn(SECONDARY, "h-9 px-3 text-sm")}>
								Open on YouTube
							</a>
						</div>
					)}

					{/* Both subtitles */}
					<div className="mt-4 min-h-[7.5rem]" data-word-column data-word-lookup-enabled="true" data-testid="watch-subtitles">
						{step && prev && (
							<p className="mb-1 truncate font-prose text-sm text-muted-foreground" lang={lang?.code} aria-hidden="true">
								{prev.sk}
							</p>
						)}
						<div className={cn("rounded-lg border px-5 py-4 transition-colors", miss ? "border-miss bg-miss-soft" : atEnd && step ? "border-teal-line bg-card" : "bg-card")}>
							{textShown ? (
								<p className="font-prose text-[1.5rem] leading-[1.5] text-foreground" lang={lang?.code} data-testid="watch-sk">
									{seg.tokens.map((t, j) =>
										t.word ? (
											<Word
												key={j}
												token={t}
												looked={tapped.includes(t.slug ?? t.text.toLocaleLowerCase("sk-SK"))}
												open={popover === j}
												onOpen={() => {
													setPopover(j);
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
							) : (
								<p className="flex items-center gap-3 font-prose text-[1.5rem] leading-[1.5] text-muted-foreground" data-testid="watch-hidden">
									<span className="flex gap-1" aria-hidden="true">
										{Array.from({ length: Math.min(words, 14) }).map((_, k) => (
											<span key={k} className={cn("h-3 rounded-full bg-foreground/15", k % 3 === 0 ? "w-8" : k % 3 === 1 ? "w-5" : "w-6")} />
										))}
									</span>
									<span className="font-ui text-sm font-[600]">{playing ? "Listen…" : atEnd ? "Did you get it?" : heard ? "Paused" : "Starting…"}</span>
								</p>
							)}
							<p className={cn("mt-1 font-prose text-base", meaningShown ? "text-muted-foreground" : "select-none text-transparent")} data-testid="watch-en" aria-hidden={!meaningShown}>
								{meaningShown ? seg.en : "·"}
							</p>
						</div>
					</div>

					{/* Straight through: the transcript, the live line marked */}
					{!step && (
						<ol className="mt-4 flex flex-col pb-6" data-testid="watch-transcript">
							{segs.map((s) => (
								<li key={s.i}>
									<button
										type="button"
										onClick={() => goTo(s.i)}
										className={cn("flex w-full items-baseline gap-3 rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-accent", s.i === idx && "bg-teal-wash")}
										ref={(el) => {
											if (s.i === idx && el) el.scrollIntoView({ block: "nearest" });
										}}
									>
										<span className="w-12 shrink-0 font-ui text-xs font-[600] tabular-nums text-muted-foreground">{formatClock(s.start)}</span>
										<span className="min-w-0 flex-1">
											<span className={cn("block font-prose text-base", s.i === idx ? "text-foreground" : "text-foreground/80")} lang={lang?.code}>
												{s.sk}
											</span>
											{showEn && <span className="block font-prose text-sm text-muted-foreground">{s.en}</span>}
										</span>
									</button>
								</li>
							))}
						</ol>
					)}
				</div>
			</div>

			{/* The controls */}
			<div className={cn("border-t border-border", miss && "bg-miss-soft")}>
				<div className={cn("mx-auto w-full max-w-5xl px-6", "flex min-h-24 flex-wrap items-center gap-2 py-4")}>
					<Ctl onClick={togglePlay} label={playing ? "Pause" : "Play"} keyName="Space" icon={playing ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4 fill-current" />} testId="watch-play" />
					<Ctl onClick={replay} label="Replay" keyName="R" icon={<RepeatIcon className="size-4" />} testId="watch-replay" />
					<Ctl onClick={toggleSlow} label={rate === 1 ? "Slower" : "Normal speed"} keyName="S" active={rate !== 1} icon={<SnailIcon className="size-4" />} testId="watch-slow" />
					{step ? (
						<>
							<Ctl onClick={showText} label={captionLanguageName(video.source?.trackLang ?? video.lang)} keyName="T" active={line.revealedText} disabled={line.revealedText} icon={<EyeIcon className="size-4" />} testId="watch-text" />
							<Ctl onClick={showMeaning} label="Meaning" keyName="M" active={line.revealedMeaning} disabled={line.revealedMeaning || !line.revealedText} icon={<LanguagesIcon className="size-4" />} testId="watch-meaning" />
						</>
					) : (
						<Ctl onClick={() => setShowEn((v) => !v)} label={showEn ? "Hide meaning" : "Meaning"} keyName="M" active={showEn} icon={<LanguagesIcon className="size-4" />} testId="watch-meaning" />
					)}
					<div className="ml-auto flex items-center gap-2">
						<button type="button" onClick={() => goTo(idx - 1)} disabled={idx === 0} aria-label="Previous line" className="flex size-12 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30" data-testid="watch-prev">
							<ChevronLeftIcon className="size-5" />
						</button>
						{step ? (
							miss ? (
								<button type="button" onClick={advance} className={cn(BUTTON, "bg-miss text-background hover:brightness-110")} data-testid="watch-continue">
									{idx + 1 >= segs.length ? "Finish" : "Continue"}
								</button>
							) : (
								<>
									<button type="button" onClick={notYet} className={SECONDARY} data-testid="watch-notyet" title="N">
										Not yet
									</button>
									<button type="button" onClick={gotIt} disabled={!heard && !atEnd} className={PRIMARY} data-testid="watch-gotit" title="Enter · your own call, nothing checks it">
										<CheckIcon className="size-5" strokeWidth={3} />
										{idx + 1 >= segs.length ? "Got it (my call) · finish" : "Got it (my call)"}
									</button>
								</>
							)
						) : (
							<button type="button" onClick={() => onDone(statsOf())} className={PRIMARY} data-testid="watch-finish">
								{video.questions.length ? `${video.questions.length} quick questions` : "Done"}
							</button>
						)}
						<button type="button" onClick={() => (step && idx + 1 >= segs.length ? onDone(statsOf()) : goTo(idx + 1))} aria-label="Next line" className="flex size-12 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" data-testid="watch-next">
							<ChevronRightIcon className="size-5" />
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

function Ctl({ onClick, label, keyName, icon, active, disabled, testId }: { onClick: () => void; label: string; keyName: string; icon: React.ReactNode; active?: boolean; disabled?: boolean; testId: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-pressed={active}
			title={`${label} (${keyName})`}
			className={cn("inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 font-ui text-sm font-[600] transition-colors hover:bg-foreground/5 disabled:cursor-default disabled:opacity-50", active ? "border-foreground/60 text-foreground" : "border-foreground/15 text-foreground/80")}
			data-testid={testId}
		>
			{icon}
			<span className="hidden sm:inline">{label}</span>
			<kbd className="hidden rounded border bg-card px-1 font-ui text-xs font-[600] text-muted-foreground lg:inline">{keyName}</kbd>
		</button>
	);
}

// ─── The end ────────────────────────────────────────────────────────────────

/** A verdict on one sentence, as the server answers it. */
interface SentenceReply {
	ok: boolean;
	corrected: string;
	why: string;
	cached: boolean;
	xp: number;
}

/** The end's sentence step: one sentence for each word the video gave
 *  (docs/plans/watch-sentences.md). The meaning shows after the first try. */
function SentenceStep({ videoId, targets }: { videoId: string; targets: SentenceTarget[] }) {
	return (
		<section className="mt-10 text-left" data-testid="watch-sentences">
			<h2 className="font-ui text-lg font-[600] text-foreground">Use the words</h2>
			<p className="mt-1 font-prose text-sm text-muted-foreground">Write one sentence with each word, in any form. The meaning shows after your first try.</p>
			<ol className="mt-4 flex flex-col gap-3">
				{targets.map((t) => (
					<SentenceRow key={t.lemma} videoId={videoId} target={t} />
				))}
			</ol>
		</section>
	);
}

function SentenceRow({ videoId, target }: { videoId: string; target: SentenceTarget }) {
	const lang = useActiveLanguage();
	const [text, setText] = useState("");
	const [busy, setBusy] = useState(false);
	const [reply, setReply] = useState<SentenceReply | null>(null);
	const [error, setError] = useState<string | null>(null);
	const accepted = reply?.ok === true;
	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		const sentence = text.trim();
		if (busy || accepted || !sentence) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/watch", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "sentence", videoId, lemma: target.lemma, sentence, tz: new Date().getTimezoneOffset() }),
			});
			const body = (await res.json()) as Partial<SentenceReply> & { message?: string };
			if (!res.ok || typeof body.ok !== "boolean") throw new Error(body.message ?? `HTTP ${res.status}`);
			setReply(body as SentenceReply);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBusy(false);
		}
	};
	return (
		<li className="q-card px-4 py-3.5" data-testid="watch-sentence">
			<p className="font-ui text-[17px] font-[600] text-foreground" lang={lang?.code}>
				{target.lemma}
			</p>
			<p className="mt-1 font-prose text-sm text-ink-3" lang={lang?.code}>
				From the video: {target.line}
			</p>
			{reply && (
				<p className="mt-1 font-prose text-sm text-muted-foreground" data-testid="watch-sentence-meaning">
					{target.gloss ? `Meaning: ${target.gloss}` : "No meaning in the dictionary for this word."}
				</p>
			)}
			<form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
				<input
					value={text}
					onChange={(e) => setText(e.target.value)}
					disabled={accepted || busy}
					lang={lang?.code}
					autoComplete="off"
					spellCheck={false}
					maxLength={SENTENCE_MAX_CHARS}
					placeholder="Write a sentence"
					aria-label={`A sentence with ${target.lemma}`}
					className="q-field h-11 min-w-0 flex-1 rounded-lg px-4 font-ui text-[15px]"
					data-testid="watch-sentence-input"
				/>
				{!accepted && (
					<button type="submit" disabled={busy || !text.trim()} className={cn(PRIMARY, "h-11 px-5")} data-testid="watch-sentence-check">
						{busy ? "Checking…" : "Check"}
					</button>
				)}
			</form>
			{error && <p className="mt-2 font-prose text-sm text-muted-foreground">{error}</p>}
			{reply && (
				<p className="mt-2 font-prose text-sm text-foreground" data-testid="watch-sentence-result">
					{reply.ok ? `Good.${reply.xp ? ` +${reply.xp} XP` : ""}` : `Not yet. ${reply.why}`}
					{!reply.ok && reply.corrected && reply.corrected !== text.trim() && (
						<>
							<br />
							Try: <span lang={lang?.code}>{reply.corrected}</span>
						</>
					)}
				</p>
			)}
		</li>
	);
}

function End({ video, stats, outcome, saving, mode, tapped, onAgain, onShelf }: { video: VideoRecord; stats: SegmentStat[]; outcome: Outcome | null; saving: boolean; mode: WatchMode; tapped: string[]; onAgain: () => void; onShelf: () => void }) {
	const lang = useActiveLanguage();
	const speed = listeningSpeed(stats);
	const targets = useMemo(() => sentenceTargets(video, tapped), [video, tapped]);
	const judged = stats.length;
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" && outcome && !(e.target instanceof HTMLInputElement)) {
				e.preventDefault();
				onShelf();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [outcome, onShelf]);
	const total = outcome?.total ?? video.questions.length;
	const gotFirst = outcome?.gotFirst ?? stats.filter((s) => s.got === "first").length;
	return (
		<div className="m-auto w-full max-w-xl px-5 text-center" data-testid="watch-end">
			<div className="lh-pop mx-auto flex size-24 items-center justify-center rounded-full bg-teal-wash text-teal-2">
				<MonitorPlayIcon className="size-12" />
			</div>
			<h1 className="mt-5 font-ui text-4xl font-[600] text-foreground">{outcome?.rewatch ? "Watched again!" : "Watched!"}</h1>
			<p className="mt-2 font-prose text-lg text-muted-foreground" lang={lang?.code}>
				{video.title}
			</p>
			<div className="mt-8 grid grid-cols-3 gap-3">
				<Stat label="XP" value={saving || !outcome ? "…" : `+${outcome.xp}`} ink="text-teal-2" />
				<Stat label={mode === "step" ? "Got first time" : "Lines"} value={mode === "step" ? (judged ? `${gotFirst}/${judged}` : "—") : String(video.segments.length)} ink="text-teal-2" />
				<Stat label="Questions right" value={outcome ? (total ? `${outcome.correct}/${total}` : "—") : "…"} ink="text-teal-2" />
			</div>
			{mode === "step" && judged > 0 && (
				<p className="mt-4 font-prose text-sm text-muted-foreground" data-testid="watch-speed">
					{speed.wpmFirst !== null ? `On the lines you got first time the speech ran at ${speed.wpmFirst} words a minute` : "No line got on the first listen yet"}
					{speed.wpmAll ? ` · the video runs at ${speed.wpmAll}` : ""}. {Math.round(speed.shareFirst * 100)}% first time
					{outcome && outcome.missed > 0 ? `, ${outcome.missed} not yet` : ""}.
				</p>
			)}
			{outcome && (
				<p className="mt-2 font-prose text-sm text-muted-foreground">
					{outcome.queued.length > 0 ? `${outcome.queued.length} word${outcome.queued.length === 1 ? "" : "s"} added to your review deck. ` : ""}
					The app counts {Math.round(video.coverage * 100)}% of this video's words as known. That is its estimate, not a measure of what you understood.
				</p>
			)}
			{targets.length > 0 && <SentenceStep videoId={video.id} targets={targets} />}
			<div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
				<Link href="/" className={SECONDARY}>
					Today
				</Link>
				<button type="button" onClick={onAgain} className={SECONDARY}>
					Watch again
				</button>
				<button type="button" onClick={onShelf} className={PRIMARY} data-testid="watch-shelf-button">
					Your videos
				</button>
			</div>
			<SourcesNote feature="watch" className="mt-8 text-left" />
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
