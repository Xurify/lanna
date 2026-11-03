"use client";

/**
 * Fluency (LangHarness, 2026-10-28) — the speed strand's two screens
 * (src/core/fluency.ts):
 *
 *   reread — an episode already read, against the clock. Start the
 *            clock, read, stop it, answer one of the episode's own
 *            questions; the result is words a minute against the last
 *            time on this text (or the level's target).
 *   fast   — six known sentences; each is heard once, then said three
 *            times with the window shrinking (4/3/2 shrunk to a line).
 *            With a microphone the recorder stops itself when the voice
 *            does and the clip is scored (src/core/pronounce.ts): a pass
 *            counts only when it was in the window AND clear, so a fast
 *            mumble does not pass. Without one, Space marks the end and
 *            time alone decides.
 *
 * Full screen like a lesson; Escape leaves. No model call anywhere.
 */

import { EmptyState } from "@/components/quiet/empty-state";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, MicIcon, MicOffIcon, RepeatIcon, TimerIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveTime } from "@/components/use-active-time";
import { speak } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { COLUMN, Centered, Dock, OptionTile, PracticeCard, PRIMARY, SECONDARY, Stat, Stats, TaskFrame, TaskTop } from "@/components/task-frame";
import { QIcon } from "@/components/quiet/icon";
import { Recorder, micSupported, scoreClip } from "@/components/speak/recorder";
import { PronChip, PronWorkOn } from "@/components/speak/pron";
import { FAST_PASSES, fastWindows, passMade, PRON_CLEAR, QUESTION_KIND_INFO, wordsPerMinute, type FastItem, type FastRep, type PronEngine, type PronReport, type PronScore, type StoryQuestion, type StoryRecord } from "@/src/core";

export type FluencyMode = "reread" | "fast";

export interface RereadPlan {
	story: StoryRecord;
	words: number;
	targetWpm: number;
	previousWpm: number | null;
	firstWpm: number | null;
	question: StoryQuestion;
	questionIndex: number;
	history: Array<{ at: string; wpm: number }>;
}

export interface FastPlan {
	items: FastItem[];
	known: number;
}

interface Summary {
	todayXp: number;
	dailyGoal: number;
	streak: { days: number };
}

export function FluencyPlayer({ mode, initialReread = null, initialFast = null, stt = false, pron = null }: { mode: FluencyMode; initialReread?: RereadPlan | null; initialFast?: FastPlan | null; stt?: boolean; pron?: PronEngine | null }) {
	if (mode === "reread") return <Reread initial={initialReread} />;
	return <Fast initial={initialFast} stt={stt} pron={pron} />;
}

// ─── Re-read ────────────────────────────────────────────────────────────────

type RereadPhase = "intro" | "reading" | "question" | "done";

interface RereadOutcome {
	xp: number;
	wpm: number;
	targetWpm: number;
	previousWpm: number | null;
	faster: boolean;
	right: boolean;
	summary: Summary;
}

function Reread({ initial }: { initial: RereadPlan | null }) {
	const router = useRouter();
	const [plan, setPlan] = useState<RereadPlan | null>(initial);
	const [missing, setMissing] = useState(initial === null);
	const [phase, setPhase] = useState<RereadPhase>("intro");
	const [elapsed, setElapsed] = useState(0);
	const [picked, setPicked] = useState<number | null>(null);
	const [outcome, setOutcome] = useState<RereadOutcome | null>(null);
	const [error, setError] = useState<string | null>(null);
	const startedAt = useRef(0);
	const readMs = useRef(0);

	const load = useCallback(async () => {
		setError(null);
		try {
			const res = await fetch(`/api/fluency?mode=reread&tz=${new Date().getTimezoneOffset()}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const p = (await res.json()) as RereadPlan | null;
			setPlan(p);
			setMissing(p === null);
			setPhase("intro");
			setPicked(null);
			setOutcome(null);
			setElapsed(0);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	// The clock.
	useEffect(() => {
		if (phase !== "reading") return;
		const t = setInterval(() => setElapsed(Date.now() - startedAt.current), 100);
		return () => clearInterval(t);
	}, [phase]);

	const begin = () => {
		startedAt.current = Date.now();
		setElapsed(0);
		setPhase("reading");
	};
	const stop = () => {
		readMs.current = Date.now() - startedAt.current;
		setElapsed(readMs.current);
		setPhase("question");
	};
	const answer = async (i: number) => {
		if (!plan || picked !== null) return;
		setPicked(i);
		const right = i === plan.question.answer;
		if (right) sfx.right(1);
		else sfx.wrong();
		try {
			const res = await fetch("/api/fluency", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ mode: "reread", storyId: plan.story.id, ms: readMs.current, questionIndex: plan.questionIndex, answer: i, tz: new Date().getTimezoneOffset() }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			setOutcome((await res.json()) as RereadOutcome);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
		setTimeout(() => {
			sfx.done();
			setPhase("done");
		}, 900);
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") return router.push("/");
			if (e.key === "Enter") {
				e.preventDefault();
				if (phase === "intro" && plan) begin();
				else if (phase === "reading") stop();
				else if (phase === "done") router.push("/");
			} else if (phase === "question" && plan) {
				const n = Number(e.key);
				if (n >= 1 && n <= plan.question.options.length) void answer(n - 1);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	if (missing || !plan) {
		return (
			<TaskFrame>
				<Centered testId="reread-empty">
					{error ? (
						<p className="font-prose text-lg text-foreground">{error}</p>
						) : (
						<>
							<p className="font-prose text-lg text-foreground">Nothing to re-read yet.</p>
							<p className="mt-2 font-prose text-base text-muted-foreground">Read an episode first; the day after, it comes back here against the clock.</p>
						</>
					)}
					<div className="mt-6 flex flex-wrap justify-center gap-3">
						<Link href="/read" className={PRIMARY}>
							Read today&apos;s episode
						</Link>
						<Link href="/fluency?mode=fast" className={SECONDARY}>
							Say it faster instead
						</Link>
						<Link href="/" className={SECONDARY}>
							Today
						</Link>
					</div>
				</Centered>
			</TaskFrame>
		);
	}

	const { story } = plan;
	const seconds = (elapsed / 1000).toFixed(1);
	const liveWpm = elapsed > 2000 ? wordsPerMinute(plan.words, elapsed) : null;

	if (phase === "done" && outcome) {
		return (
			<TaskFrame>
				<div className={cn(COLUMN, "my-auto py-10")} data-testid="reread-end">
					<p className="q-date flex items-center gap-1.5">
							<QIcon name="read" className="text-teal" />
							Read it faster · done
						</p>
						<h1 className="q-hello">
							{outcome.wpm} words a minute{outcome.faster ? ", faster." : "."}
						</h1>
						<Stats className="mt-6">
							<Stat label="XP" value={`+${outcome.xp}`} ink="text-teal-2" />
							<Stat label={outcome.previousWpm !== null ? "Last time" : "Target"} value={`${outcome.targetWpm} wpm`} ink="text-ink-2" />
							{plan.firstWpm !== null && <Stat label="First reading" value={`${plan.firstWpm} wpm`} ink="text-ink-2" />}
							<Stat label="The question" value={outcome.right ? "right" : "missed"} ink={outcome.right ? "text-teal-2" : "text-miss"} />
						</Stats>
					<History history={[...plan.history, { at: "now", wpm: outcome.wpm }]} target={plan.targetWpm} />
					<p className="q-sub mt-4">
							{outcome.faster ? "Speed on easy text is what makes the hard text feel easy. Same episode again in a few days." : "No bonus this time; the point is the climb over weeks, not one run. The question keeps the speed honest."}
					</p>
					<div className="q-acts mt-6">
							<Link href="/" className={PRIMARY} data-testid="reread-today">
							Today
						</Link>
						<button type="button" onClick={() => void load()} className={SECONDARY} data-testid="reread-again">
							<RepeatIcon className="size-4" strokeWidth={1.6} />
								Another episode
						</button>
						<span className="self-center font-ui text-xs text-ink-3">Enter goes to Today</span>
						</div>
					</div>
				</TaskFrame>
			);
		}

		return (
		<TaskFrame strip={false}>
			<TaskTop progress={phase === "intro" ? 0 : phase === "reading" ? 0.5 : 0.9} label="Re-read" count={phase === "question" ? "check" : phase === "reading" ? `${seconds} s` : `${plan.words} words`}  />
			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[4vh]">
				<div className={cn(COLUMN, "lh-rise")}>
					<PracticeCard icon="read" title="Read it faster" sub={`episode ${story.episode} · ${plan.words} words`}>
					<h2 className="mb-5 font-prose text-[28px] font-semibold leading-tight tracking-[-0.028em] text-foreground" lang="sk">
						{story.title}
					</h2>


					{phase === "intro" && (
						<div data-testid="reread-intro">
							<p className="font-prose text-[17px] leading-relaxed text-ink-2">You have read this one. Read it again, as fast as you can while still following it. Press Start, read, press Done. One question follows.</p>
							<Stats className="mt-5">
								<Stat label={plan.previousWpm !== null ? "Last time" : `Target at ${story.level}`} value={`${plan.targetWpm} wpm`} ink="text-teal-2" />
								{plan.firstWpm !== null && <Stat label="First reading" value={`${plan.firstWpm} wpm`} ink="text-ink-2" />}
								<Stat label="Re-reads" value={String(plan.history.length)} ink="text-ink-2" />
							</Stats>
							<button type="button" onClick={begin} className={cn(PRIMARY, "mt-6")} data-testid="reread-start">
								<TimerIcon className="size-4" strokeWidth={1.6} />
								Start the clock
							</button>
							<span className="ml-3 font-ui text-xs text-ink-3">or Enter</span>
						</div>
					)}

					{phase === "reading" && (
						<div data-testid="reread-text" data-word-lookup-enabled="true">
							<div className="rounded-[10px] bg-well px-5 py-4">
								{story.sentences.map((s, i) => (
									<p key={i} className="font-prose text-[21px] leading-[1.7] tracking-[-0.008em] text-foreground" lang="sk">
										{s.sk}
									</p>
								))}
							</div>
						</div>
					)}

					{phase === "question" && (
						<div data-testid="reread-question" data-word-lookup-enabled={picked !== null ? "true" : "false"}>
							<p className="q-lbl">{QUESTION_KIND_INFO[plan.question.kind ?? "recall"].label}</p>
							<p className="mt-2 font-prose text-[22px] font-semibold leading-snug tracking-[-0.018em] text-foreground" lang="sk">
								{plan.question.q}
							</p>
							<div className="mt-5 grid gap-3">
								{plan.question.options.map((o, i) => {
									const right = picked !== null && i === plan.question.answer;
									const wrong = picked === i && !right;
									return (
										<OptionTile key={o} n={i + 1} lang="sk" disabled={picked !== null} onClick={() => void answer(i)} state={picked === null ? "idle" : right ? "right" : wrong ? "wrong" : "dim"}>
											{o}
										</OptionTile>
									);
								})}
							</div>
						</div>
					)}
					</PracticeCard>
					{error && (
						<p className="mt-4 rounded-[10px] bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert">
							{error}
						</p>
					)}
				</div>
			</div>
			<Dock>
				<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
					{phase === "reading" ? (
						<>
							<p className="font-ui text-[22px] font-semibold tracking-[-0.015em] tabular-nums text-foreground" data-testid="reread-clock">
								{seconds} s{liveWpm !== null && <span className="ml-3 text-sm font-[450] text-ink-3">{liveWpm} wpm</span>}
							</p>
							<button type="button" onClick={stop} className={PRIMARY} data-testid="reread-done" ref={(el) => el?.focus()}>
								Done reading
							</button>
						</>
					) : phase === "question" ? (
						<p className="font-prose text-[13px] text-ink-3">
							{seconds} s · {wordsPerMinute(plan.words, readMs.current)} words a minute · pick an answer, or press its number
						</p>
					) : (
						<p className="font-prose text-[13px] text-ink-3">Nothing new here on purpose: speed grows on text you already own.</p>
					)}
				</div>
			</Dock>
		</TaskFrame>
	);
}

/** Words a minute over the re-reads, as bars; the target as a line. */
function History({ history, target }: { history: Array<{ at: string; wpm: number }>; target: number }) {
	const max = Math.max(target, ...history.map((h) => h.wpm)) * 1.1;
	const h = 72;
	return (
		<div className="mt-6" data-testid="reread-history">
			<p className="q-sh">Your pace on this episode</p>
			<div className="relative mt-2 flex h-[72px] items-end gap-2">
				<div className="absolute inset-x-0 border-t border-dashed border-[var(--q-ink-4)]" style={{ bottom: `${(target / max) * h}px` }} aria-hidden="true" />
				{history.map((x, i) => (
					<div key={i} className="flex flex-col items-center gap-1" title={`${x.wpm} wpm`}>
						<span className={cn("w-7 rounded-t-md", i === history.length - 1 ? "bg-teal" : "bg-well-2")} style={{ height: `${Math.max(4, (x.wpm / max) * h)}px` }} />
						<span className="font-ui text-xs tabular-nums text-ink-3">{x.wpm}</span>
					</div>
				))}
			</div>
		</div>
	);
}

// ─── Say it faster ──────────────────────────────────────────────────────────

type FastPhase = "loading" | "ready" | "running" | "between" | "done";

interface Pass {
	ms: number;
	window: number;
	/** The verdict: in the window and (when scored) clear. */
	made: boolean;
	inWindow: boolean;
	/** The clip is being scored; the verdict is not in yet. */
	pending?: boolean;
	heard?: string;
	match?: number;
	pron?: PronScore;
}

interface FastOutcome {
	xp: number;
	passesMade: number;
	sentencesMade: number;
	total: number;
	summary: Summary;
	report: PronReport;
}

/** How long the verdict waits for the score before time alone decides. */
const SCORE_WAIT_MS = 8000;

function Fast({ initial, stt, pron }: { initial: FastPlan | null; stt: boolean; pron: PronEngine | null }) {
	const router = useRouter();
	const [plan, setPlan] = useState<FastPlan | null>(initial);
	const [error, setError] = useState<string | null>(null);
	const [index, setIndex] = useState(0);
	const [pass, setPass] = useState(0);
	const [passes, setPasses] = useState<Pass[]>([]);
	const [reps, setReps] = useState<FastRep[]>([]);
	const [phase, setPhase] = useState<FastPhase>(initial ? "ready" : "loading");
	const [elapsed, setElapsed] = useState(0);
	const [paused, setPaused] = useState(false);
	const [level, setLevel] = useState(0);
	const [outcome, setOutcome] = useState<FastOutcome | null>(null);
	// The mic check reads browser globals: decided after mount so the
	// server and the first client render agree (no hydration mismatch).
	const [micOk, setMicOk] = useState(false);
	const [useMic, setUseMic] = useState(false);
	useEffect(() => {
		const ok = micSupported();
		setMicOk(ok);
		setUseMic(stt && ok);
	}, [stt]);
	const startedAt = useRef(Date.now());
	// The day's minutes count active time: the gaps between actions, each
	// capped (`ms` stays the wall-clock). A timed re-read keeps its own
	// reading clock, which is also what its words a minute is built from.
	const activeTime = useActiveTime("fast", "interactive");
	const passStart = useRef(0);
	// Pause: time spent paused is kept out of the pass; pausedAt is 0 when running.
	const pausedAt = useRef(0);
	const pausedMs = useRef(0);
	const recorder = useRef<Recorder | null>(null);
	const finishing = useRef(false);

	const load = useCallback(async () => {
		setPhase("loading");
		setError(null);
		setIndex(0);
		setPass(0);
		setPasses([]);
		setReps([]);
		setOutcome(null);
		finishing.current = false;
		try {
			const res = await fetch("/api/fluency?mode=fast");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const p = (await res.json()) as FastPlan;
			if (p.items.length === 0) throw new Error("No known sentences yet. Finish a lesson or two first.");
			setPlan(p);
			startedAt.current = Date.now();
			activeTime.restart();
			setPhase("ready");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [activeTime]);

	useEffect(() => {
		if (!initial) void load();
	}, [initial, load]);

	const item = plan?.items[index] ?? null;
	const total = plan?.items.length ?? 0;
	const windows = item ? fastWindows(item.words) : [0, 0, 0];
	const win = windows[pass] ?? windows[windows.length - 1]!;

	// Hear it once when it arrives.
	useEffect(() => {
		if (item && phase === "ready" && pass === 0) void speak(item.sentence).catch(() => {});
	}, [item, phase, pass]);

	// The countdown (frozen while paused).
	useEffect(() => {
		if (phase !== "running" || paused) return;
		const t = setInterval(() => setElapsed((pausedAt.current || Date.now()) - passStart.current - pausedMs.current), 50);
		return () => clearInterval(t);
	}, [phase, paused]);

	const finish = useCallback(
		async (all: FastRep[]) => {
			if (finishing.current) return;
			finishing.current = true;
			sfx.done();
			setPhase("done");
			try {
				const res = await fetch("/api/fluency", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ mode: "fast", reps: all, ms: Date.now() - startedAt.current, activeMs: activeTime.finish(), tz: new Date().getTimezoneOffset() }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				setOutcome((await res.json()) as FastOutcome);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		},
		[activeTime],
	);

	const endPass = useCallback(
		async (auto = false) => {
			if (!item || phase !== "running") return;
			const ms = (pausedAt.current || Date.now()) - passStart.current - pausedMs.current;
			pausedAt.current = 0;
			setPaused(false);
			setPhase("between");
			setElapsed(ms);
			const inWindow = ms <= win;
			const rec = recorder.current;
			recorder.current = null;
			const scored = !!rec && !!pron;
			const p: Pass = { ms, window: win, made: inWindow, inWindow, ...(scored ? { pending: true } : {}) };
			const next = [...passes, p];
			setPasses(next);
			const verdict = (made: boolean) => {
				if (made) sfx.right(pass + 1);
				else sfx.wrong();
			};
			if (!scored) {
				verdict(inWindow);
				if (rec) void rec.stop().catch(() => undefined);
				return;
			}
			// The clip is scored before the verdict: in the window AND clear.
			const at = next.length - 1;
			let settled = false;
			const settle = (extra: Partial<Pass>) => {
				if (settled) return;
				settled = true;
				const made = passMade(inWindow, extra.pron ?? null);
				setPasses((cur) => cur.map((x, i) => (i === at ? { ...x, ...extra, made, pending: false } : x)));
				verdict(made);
			};
			const timer = setTimeout(() => settle({}), SCORE_WAIT_MS);
			void rec
				.stop()
				.then(async (clip) => {
					if (clip.ms < 200) return settle({});
					const score = await scoreClip(clip.wav, item.sentence);
					if (!score) return settle({ heard: "" });
					settle({ pron: score, heard: score.heard ?? "", match: score.accuracy / 100 });
				})
				.catch(() => settle({}))
				.finally(() => clearTimeout(timer));
			void auto;
		},
		[item, phase, win, pass, passes, pron],
	);
	const endRef = useRef(endPass);
	endRef.current = endPass;

	const startPass = useCallback(async () => {
		if (!item || (phase !== "ready" && phase !== "between")) return;
		setError(null);
		if (useMic) {
			const rec = new Recorder();
			try {
				await rec.start({ onLevel: setLevel, silenceMs: 650, maxMs: win * 3, onAutoStop: () => void endRef.current(true) });
				recorder.current = rec;
			} catch {
				setUseMic(false);
				setError("The microphone was not allowed; Space marks the end of each pass instead.");
			}
		}
		passStart.current = Date.now();
		pausedAt.current = 0;
		pausedMs.current = 0;
		setPaused(false);
		setElapsed(0);
		setPhase("running");
	}, [item, phase, useMic, win]);

	/** Pause or resume the running pass (mic off only: the recorder runs on its own clock). */
	const togglePause = useCallback(() => {
		if (phase !== "running" || useMic) return;
		if (pausedAt.current) {
			pausedMs.current += Date.now() - pausedAt.current;
			pausedAt.current = 0;
			setPaused(false);
		} else {
			pausedAt.current = Date.now();
			setElapsed(pausedAt.current - passStart.current - pausedMs.current);
			setPaused(true);
		}
	}, [phase, useMic]);

	/** After a pass: the next pass, the next sentence, or the end. */
	const advance = useCallback(() => {
		if (!item || phase !== "between" || passes[passes.length - 1]?.pending) return;
		if (pass + 1 < FAST_PASSES) {
			setPass(pass + 1);
			void startPass();
			return;
		}
		// The sentence is done: keep its reps (what was heard may still arrive; the log takes what it has).
		const rep: FastRep = { itemId: item.id, slug: item.slug, sentence: item.sentence, translation: item.translation, passes };
		const all = [...reps, rep];
		setReps(all);
		setPasses([]);
		setPass(0);
		if (index + 1 >= total) void finish(all);
		else {
			setIndex(index + 1);
			setPhase("ready");
		}
	}, [item, phase, pass, passes, reps, index, total, startPass, finish]);

	useEffect(() => () => recorder.current?.cancel(), []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				recorder.current?.cancel();
				router.push("/");
				return;
			}
			if (phase === "done" && e.key === "Enter") return router.push("/");
			if (e.key === " " || e.key === "Enter") {
				e.preventDefault();
				if (phase === "ready") void startPass();
				else if (phase === "running") void endPass();
				else if (phase === "between") advance();
			} else if ((e.key === "r" || e.key === "R") && item && phase !== "running") void speak(item.sentence).catch(() => {});
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [phase, item, router, startPass, endPass, advance]);

	if (error && !plan) {
		return (
			<TaskFrame>
				<div className="mx-auto w-full max-w-3xl px-6 pt-[8vh]">
					<EmptyState
						testid="fast-error"
						title={/yet/i.test(error) ? "No sentences to say faster yet" : "Say it faster could not start"}
						action={
							/yet/i.test(error) ? (
								<Link href="/" className="q-btn primary">
									Go to Today
								</Link>
							) : (
								<button type="button" onClick={() => void load()} className="q-btn primary">
									Try again
								</button>
							)
						}
						secondary={/yet/i.test(error) ? undefined : <Link href="/" className="q-btn ghost">Back to Today</Link>}
					>
						{/yet/i.test(error) ? (
							<>
								<p>Say it faster uses sentences built from words you have met, so it opens after your first lessons.</p>
								<p>It needs no AI key.</p>
							</>
						) : (
							<p>{error}</p>
						)}
					</EmptyState>
				</div>
			</TaskFrame>
		);
	}

	if (phase === "loading" || !plan || !item) {
		return (
			<TaskFrame>
				<Centered testId="fast-loading">
					<p className="flex items-center justify-center gap-3 font-ui text-sm text-ink-3">
						<LoaderCircleIcon className="size-5 animate-spin" strokeWidth={1.6} />
						Picking sentences you know…
					</p>
				</Centered>
			</TaskFrame>
		);
	}

	if (phase === "done") {
		const made = reps.reduce((n, r) => n + r.passes.filter((p) => p.made).length, 0);
		const clean = reps.filter((r) => r.passes[r.passes.length - 1]?.made).length;
		const scoredPasses = reps.flatMap((r) => r.passes.filter((p) => p.pron));
		const clearPasses = scoredPasses.filter((p) => (p.pron?.overall ?? 0) >= PRON_CLEAR).length;
		const avg = scoredPasses.length ? Math.round(scoredPasses.reduce((n, p) => n + (p.pron?.overall ?? 0), 0) / scoredPasses.length) : null;
		return (
			<TaskFrame>
				<div className={cn(COLUMN, "my-auto overflow-y-auto py-10")} data-testid="fast-end">
					<p className="q-date flex items-center gap-1.5">
							<QIcon name="fast" className="text-teal" />
							Say it faster · done
						</p>
						<h1 className="q-hello">
							{clean} of {reps.length} at full speed.
						</h1>
						<Stats className="mt-6">
							<Stat label="XP" value={outcome ? `+${outcome.xp}` : null} ink="text-teal-2" />
							<Stat label={scoredPasses.length ? "Passes in the window and clear" : "Passes in the window"} value={`${made} of ${reps.length * FAST_PASSES}`} ink="text-teal-2" />
							{avg !== null && <Stat label="Pronunciation" value={`${avg} · ${clearPasses} of ${scoredPasses.length} clear`} ink={avg >= PRON_CLEAR ? "text-teal-2" : "text-miss"} />}
						</Stats>
					<PronWorkOn report={outcome?.report} />
					<ul className="mt-8 flex flex-col gap-2" data-testid="fast-reps">
						{reps.map((r) => (
							<li key={r.itemId} className="q-card px-4 py-3">
								<div className="flex items-start gap-3">
									<button type="button" onClick={() => void speak(r.sentence).catch(() => {})} aria-label="Play" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-teal-wash text-teal-2 hover:bg-[var(--q-teal-line)]">
										<Volume2Icon className="size-4" strokeWidth={1.6} />
									</button>
									<div className="min-w-0 flex-1">
										<p className="font-prose text-lg text-foreground" lang="sk">
											{r.sentence}
										</p>
										<p data-no-word-lookup="true" className="font-prose text-sm text-ink-3">{r.translation}</p>
									</div>
									<div className="flex gap-1.5" aria-label="Passes">
										{r.passes.map((p, i) => (
											<span key={i} className={cn("rounded-md px-1.5 py-0.5 font-ui text-xs font-bold tabular-nums", p.made ? "bg-teal-wash text-teal-2" : "bg-miss-soft text-miss")} title={`${(p.ms / 1000).toFixed(1)} s of ${(p.window / 1000).toFixed(1)} s${p.pron ? ` · ${p.pron.overall} clear` : ""}${p.heard ? ` · heard: ${p.heard}` : ""}${p.inWindow && !p.made ? " · in the window but not clear" : ""}`}>
												{(p.ms / 1000).toFixed(1)}s{p.pron ? ` · ${p.pron.overall}` : ""}
											</span>
										))}
									</div>
								</div>
							</li>
						))}
					</ul>
					{error && (
						<p className="mt-4 rounded-[10px] bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert">
							{error}
						</p>
					)}
					<div className="q-acts mt-6">
							<Link href="/" className={PRIMARY} data-testid="fast-today">
							Today
						</Link>
						<button type="button" onClick={() => void load()} className={SECONDARY} data-testid="fast-again">
							<RepeatIcon className="size-4" strokeWidth={1.6} />
									Six more
						</button>
						<span className="self-center font-ui text-xs text-ink-3">Enter goes to Today</span>
						</div>
					</div>
				</TaskFrame>
			);
		}

		const last = passes[passes.length - 1];
	const left = Math.max(0, win - elapsed);
	const progress = (index + (pass + (phase === "between" ? 1 : 0)) / FAST_PASSES) / total;

	return (
		<TaskFrame strip={false}>
			<TaskTop progress={progress} label={`${index} of ${total} sentences`} count={`${index + 1}/${total}`}  />
			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[4vh]">
				<div key={item.id} className={cn(COLUMN, "lh-rise")}>
					<PracticeCard icon="fast" title="Say it faster" sub={`pass ${Math.min(pass + 1, FAST_PASSES)} of ${FAST_PASSES} · ${item.practiced ? "a sentence you got right in a lesson" : "every word is yours"}`}>
					<h2 className="mb-5 font-prose text-[22px] font-semibold tracking-[-0.018em] text-foreground">
						{phase === "ready" ? "Hear it, then say it" : phase === "running" ? (paused ? "Paused" : "Say it now") : last?.pending ? "Listening back…" : last?.made ? ["Made it!", "Faster!", "Full speed!"][pass] : last?.inWindow ? "Fast, but not clear" : "Over the window"}
					</h2>
					<div className="flex items-start gap-3">
						<button type="button" onClick={() => void speak(item.sentence).catch(() => {})} aria-label="Play" className="lh-press flex size-14 shrink-0 items-center justify-center rounded-xl bg-teal text-[var(--q-on-teal)] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(10_84_82/0.35)] hover:bg-teal-2" data-testid="fast-play">
							<Volume2Icon className="size-6" strokeWidth={1.6} />
						</button>
						<div>
							<p className="font-prose text-[28px] font-semibold leading-[1.4] tracking-[-0.03em] text-foreground sm:text-[36px]" lang="sk" data-testid="fast-sentence" data-word-lookup-enabled={phase === "between" ? "true" : "false"}>
								{item.sentence}
							</p>
							<p data-no-word-lookup="true" className="mt-2 font-prose text-base text-ink-2">{item.translation}</p>
						</div>
					</div>

					{/* The three windows: done passes, the live one, the ones to come. */}
					<div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3" data-testid="fast-passes">
						{windows.map((w, i) => {
							const p = passes[i];
							const live = i === pass && phase === "running";
							return (
								<div key={i} className={cn("rounded-[10px] px-3 py-2", p ? (p.pending ? "bg-teal-wash shadow-[inset_0_0_0_1.5px_var(--q-teal)]" : p.made ? "bg-teal-wash shadow-[inset_0_0_0_1px_var(--q-teal-line)]" : "bg-miss-soft shadow-[inset_0_0_0_1px_var(--q-miss)]") : live ? "bg-teal-wash shadow-[inset_0_0_0_1.5px_var(--q-teal)]" : "bg-well")}>
									<p className="font-ui text-xs text-ink-3">{["Say it", "Faster", "Full speed"][i]}</p>
									<p className="font-ui text-xl font-semibold tracking-[-0.015em] tabular-nums text-foreground">{p ? `${(p.ms / 1000).toFixed(1)} s` : live ? `${(left / 1000).toFixed(1)} s` : `${(w / 1000).toFixed(1)} s`}</p>
									{live && (
										<div className="mt-1.5 h-1 overflow-hidden rounded-full bg-well-2">
											<div className="h-full rounded-full bg-teal" style={{ width: `${(left / w) * 100}%`, transition: "width 50ms linear" }} />
										</div>
									)}
									{p?.pending && (
										<p className="mt-1 flex items-center gap-1 font-ui text-xs text-ink-3">
											<LoaderCircleIcon className="size-3 animate-spin" strokeWidth={1.6} /> scoring
										</p>
									)}
									{p?.pron && (
										<p className="mt-1">
											<PronChip score={p.pron} />
										</p>
									)}
									{p && !p.pending && !p.pron && p.heard !== undefined && (
										<p className="mt-1 truncate font-prose text-xs text-ink-3" title={p.heard} data-testid="fast-heard">
											heard: {p.heard || "—"}
										</p>
									)}
								</div>
							);
						})}
					</div>
					{error && (
						<p className="mt-4 rounded-[10px] bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert">
							{error}
						</p>
					)}
					</PracticeCard>
				</div>
			</div>
			<Dock tone={phase === "between" ? (last?.pending ? "wait" : last?.made ? "right" : "miss") : phase === "running" ? "wait" : "plain"}>
				<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
					{phase === "running" ? (
						<>
							<div className="flex items-center gap-3">
								{useMic ? <MicIcon className="size-5 text-teal" strokeWidth={1.6} /> : <TimerIcon className="size-5 text-teal" strokeWidth={1.6} />}
								<p className="font-ui text-[15px] font-semibold tracking-[-0.01em] text-foreground">{useMic ? "Listening — it stops when you stop" : "Press Space when you have said it"}</p>
								{useMic && <span className="h-1 w-16 overflow-hidden rounded-full bg-well-2"><span className="block h-full bg-teal" style={{ width: `${level * 100}%` }} /></span>}
							</div>
							<div className="flex items-center gap-3">
								{!useMic && (
									<button type="button" onClick={togglePause} className={SECONDARY} data-testid="fast-pause">
										{paused ? "Resume" : "Pause"}
									</button>
								)}
								<button type="button" onClick={() => void endPass()} className={PRIMARY} data-testid="fast-said">
									Said it
								</button>
							</div>
						</>
					) : phase === "between" ? (
						<>
							<p className={cn("flex items-center gap-2 font-ui text-[15px] font-semibold tracking-[-0.01em]", last?.pending ? "text-foreground" : last?.made ? "text-teal-2" : "text-miss")} data-testid="fast-verdict">
								{last?.pending ? (
									<>
										<LoaderCircleIcon className="size-5 animate-spin" strokeWidth={1.6} /> Listening back…
									</>
								) : last?.made ? (
									`In the window · ${((last?.ms ?? 0) / 1000).toFixed(1)} s${last.pron ? ` · ${last.pron.overall} clear` : ""}`
								) : last?.inWindow ? (
									`In the window, but ${last.pron ? `${last.pron.overall} — ` : ""}not clear enough${last.pron?.words.some((w) => w.error === "omission") ? ` · missed: ${last.pron.words.filter((w) => w.error === "omission").map((w) => w.word).join(", ")}` : ""}`
								) : (
									`${(((last?.ms ?? 0) - win) / 1000).toFixed(1)} s over`
								)}
							</p>
							<button type="button" onClick={advance} disabled={!!last?.pending} className={cn(PRIMARY, "disabled:opacity-50")} data-testid="fast-continue" ref={(el) => el?.focus()}>
								{pass + 1 < FAST_PASSES ? "Next pass" : index + 1 >= total ? "Finish" : "Next sentence"}
							</button>
						</>
					) : (
						<>
							<div className="flex items-center gap-3">
								<button type="button" onClick={() => setUseMic((v) => !v)} disabled={!stt || !micOk} className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-ui text-xs font-[550] text-ink-3 hover:bg-well hover:text-ink-2 disabled:opacity-50 pointer-coarse:min-h-11" aria-pressed={useMic} title={stt ? (pron === "azure" ? "The microphone times each pass and scores it sound by sound" : "The microphone times each pass and checks the words were clear") : "Add an ElevenLabs or Deepgram key for the microphone"}>
									{useMic ? <MicIcon className="size-4" strokeWidth={1.6} /> : <MicOffIcon className="size-4" strokeWidth={1.6} />}
									{useMic ? "Mic on" : "Mic off"}
								</button>
								<p className="font-prose text-[13px] text-ink-3">Space starts the pass{useMic ? "" : " and ends it"} · R plays it again{useMic ? " · a pass counts only if it was clear" : ""}</p>
							</div>
							<button type="button" onClick={() => void startPass()} className={PRIMARY} data-testid="fast-start" ref={(el) => el?.focus()}>
								{pass === 0 ? "Go" : "Again, faster"}
							</button>
						</>
					)}
				</div>
			</Dock>
		</TaskFrame>
	);
}
