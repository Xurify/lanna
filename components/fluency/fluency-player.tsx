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

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, GaugeIcon, LoaderCircleIcon, MicIcon, MicOffIcon, RabbitIcon, RepeatIcon, TimerIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveTime } from "@/components/use-active-time";
import { speak } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { COLUMN, PRIMARY, SECONDARY, Stat, TaskFrame, TaskTop, Centered } from "@/components/task-frame";
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
					<div className="flex items-center gap-4">
						<span className="flex size-16 items-center justify-center rounded-2xl bg-gold/15 text-gold">
							<GaugeIcon className="size-8" />
						</span>
						<div>
							<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Read it faster · done</p>
							<h1 className="font-ui text-3xl font-black text-foreground">
								{outcome.wpm} words a minute{outcome.faster ? " — faster!" : ""}
							</h1>
						</div>
					</div>
					<div className="mt-6 flex flex-wrap gap-6 font-ui text-sm">
						<Stat label="XP" value={`+${outcome.xp}`} ink="text-xp" />
						<Stat label={outcome.previousWpm !== null ? "Last time" : "Target"} value={`${outcome.targetWpm} wpm`} ink="text-muted-foreground" />
						{plan.firstWpm !== null && <Stat label="First reading" value={`${plan.firstWpm} wpm`} ink="text-muted-foreground" />}
						<Stat label="The question" value={outcome.right ? "right" : "missed"} ink={outcome.right ? "text-go" : "text-miss"} />
					</div>
					<History history={[...plan.history, { at: "now", wpm: outcome.wpm }]} target={plan.targetWpm} />
					<p className="mt-6 font-prose text-sm text-muted-foreground">
						{outcome.faster ? "Speed on easy text is what makes the hard text feel easy. Same episode again in a few days." : "No bonus this time; the point is the climb over weeks, not one run. The question keeps the speed honest."}
					</p>
					<div className="mt-10 flex flex-wrap gap-3">
						<Link href="/" className={PRIMARY} data-testid="reread-today">
							Today
						</Link>
						<button type="button" onClick={() => void load()} className={SECONDARY} data-testid="reread-again">
							<RepeatIcon className="size-4" />
							Another episode
						</button>
						<span className="self-center font-ui text-xs text-muted-foreground">Enter goes to Today</span>
					</div>
				</div>
			</TaskFrame>
		);
	}

	return (
		<TaskFrame strip={false}>
			<TaskTop progress={phase === "intro" ? 0 : phase === "reading" ? 0.5 : 0.9} label="Re-read" count={phase === "question" ? "check" : phase === "reading" ? `${seconds} s` : `${plan.words} words`} ink="bg-gold" />
			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[5vh]">
				<div className={cn(COLUMN, "lh-rise")}>
					<p className="font-ui text-sm font-bold text-muted-foreground">
						Read it faster · episode {story.episode} · {plan.words} words
					</p>
					<h2 className="mb-5 mt-1 font-prose text-2xl font-semibold text-foreground" lang="sk">
						{story.title}
					</h2>

					{phase === "intro" && (
						<div data-testid="reread-intro">
							<p className="font-prose text-lg text-foreground">You have read this one. Read it again, as fast as you can while still following it. Press Start, read, press Done. One question follows.</p>
							<div className="mt-5 flex flex-wrap gap-6 font-ui text-sm">
								<Stat label={plan.previousWpm !== null ? "Last time" : `Target at ${story.level}`} value={`${plan.targetWpm} wpm`} ink="text-gold" />
								{plan.firstWpm !== null && <Stat label="First reading" value={`${plan.firstWpm} wpm`} ink="text-muted-foreground" />}
								<Stat label="Re-reads" value={String(plan.history.length)} ink="text-muted-foreground" />
							</div>
							<button type="button" onClick={begin} className={cn(PRIMARY, "mt-8")} data-testid="reread-start">
								<TimerIcon className="size-5" />
								Start the clock
							</button>
							<span className="ml-3 font-ui text-xs text-muted-foreground">or Enter</span>
						</div>
					)}

					{phase === "reading" && (
						<div data-testid="reread-text" data-word-lookup-enabled="true">
							<div className="rounded-2xl border border-border bg-card px-6 py-5">
								{story.sentences.map((s, i) => (
									<p key={i} className="font-prose text-[22px] leading-[1.7] text-foreground" lang="sk">
										{s.sk}
									</p>
								))}
							</div>
						</div>
					)}

					{phase === "question" && (
						<div data-testid="reread-question" data-word-lookup-enabled={picked !== null ? "true" : "false"}>
							<p className="font-ui text-xs font-bold uppercase tracking-wide text-muted-foreground">{QUESTION_KIND_INFO[plan.question.kind ?? "recall"].label}</p>
							<p className="mt-1 font-prose text-2xl text-foreground" lang="sk">
								{plan.question.q}
							</p>
							<div className="mt-5 grid gap-3">
								{plan.question.options.map((o, i) => {
									const right = picked !== null && i === plan.question.answer;
									const wrong = picked === i && !right;
									return (
										<button
											key={o}
											type="button"
											disabled={picked !== null}
											onClick={() => void answer(i)}
											className={cn(
												"flex items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3.5 text-left font-prose text-xl text-foreground transition-colors",
												picked === null && "hover:border-foreground/40 hover:bg-accent",
												right && "border-go bg-go-soft",
												wrong && "border-miss bg-miss-soft",
												picked !== null && !right && !wrong && "opacity-50",
											)}
											lang="sk"
										>
											<span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border font-ui text-sm text-muted-foreground">{i + 1}</span>
											<span>{o}</span>
											{right && <CheckIcon className="ml-auto size-5 shrink-0 text-go" strokeWidth={3} />}
										</button>
									);
								})}
							</div>
						</div>
					)}
					{error && (
						<p className="mt-4 rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert">
							{error}
						</p>
					)}
				</div>
			</div>
			<div className="border-t border-border">
				<div className={cn(COLUMN, "flex min-h-24 items-center justify-between gap-4 py-5")}>
					{phase === "reading" ? (
						<>
							<p className="font-ui text-2xl font-black tabular-nums text-foreground" data-testid="reread-clock">
								{seconds} s{liveWpm !== null && <span className="ml-3 text-base font-bold text-muted-foreground">{liveWpm} wpm</span>}
							</p>
							<button type="button" onClick={stop} className={PRIMARY} data-testid="reread-done" ref={(el) => el?.focus()}>
								Done reading
							</button>
						</>
					) : phase === "question" ? (
						<p className="font-prose text-sm text-muted-foreground">
							{seconds} s · {wordsPerMinute(plan.words, readMs.current)} words a minute · pick an answer, or press its number
						</p>
					) : (
						<p className="font-prose text-sm text-muted-foreground">Nothing new here on purpose: speed grows on text you already own.</p>
					)}
				</div>
			</div>
		</TaskFrame>
	);
}

/** Words a minute over the re-reads, as bars; the target as a line. */
function History({ history, target }: { history: Array<{ at: string; wpm: number }>; target: number }) {
	const max = Math.max(target, ...history.map((h) => h.wpm)) * 1.1;
	const h = 72;
	return (
		<div className="mt-6" data-testid="reread-history">
			<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Your pace on this episode</p>
			<div className="relative mt-2 flex h-[72px] items-end gap-2">
				<div className="absolute inset-x-0 border-t border-dashed border-foreground/30" style={{ bottom: `${(target / max) * h}px` }} aria-hidden="true" />
				{history.map((x, i) => (
					<div key={i} className="flex flex-col items-center gap-1" title={`${x.wpm} wpm`}>
						<span className={cn("w-7 rounded-t-md", i === history.length - 1 ? "bg-gold" : "bg-accent")} style={{ height: `${Math.max(4, (x.wpm / max) * h)}px` }} />
						<span className="font-ui text-xs tabular-nums text-muted-foreground">{x.wpm}</span>
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
				<Centered testId="fast-error">
					<p className="font-prose text-lg text-foreground">{error}</p>
					<div className="mt-6 flex flex-wrap justify-center gap-3">
						<button type="button" onClick={() => void load()} className={PRIMARY}>
							Try again
						</button>
						<Link href="/" className={SECONDARY}>
							Today
						</Link>
					</div>
				</Centered>
			</TaskFrame>
		);
	}

	if (phase === "loading" || !plan || !item) {
		return (
			<TaskFrame>
				<Centered testId="fast-loading">
					<p className="flex items-center justify-center gap-3 font-ui text-sm text-muted-foreground">
						<LoaderCircleIcon className="size-5 animate-spin" />
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
					<div className="flex items-center gap-4">
						<span className="flex size-16 items-center justify-center rounded-2xl bg-gold/15 text-gold">
							<RabbitIcon className="size-8" />
						</span>
						<div>
							<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Say it faster · done</p>
							<h1 className="font-ui text-3xl font-black text-foreground">
								{clean} of {reps.length} at full speed
							</h1>
						</div>
					</div>
					<div className="mt-6 flex flex-wrap gap-6 font-ui text-sm">
						<Stat label="XP" value={outcome ? `+${outcome.xp}` : "…"} ink="text-xp" />
						<Stat label={scoredPasses.length ? "Passes in the window and clear" : "Passes in the window"} value={`${made} of ${reps.length * FAST_PASSES}`} ink="text-go" />
						{avg !== null && <Stat label="Pronunciation" value={`${avg} · ${clearPasses} of ${scoredPasses.length} clear`} ink={avg >= 85 ? "text-go" : avg >= PRON_CLEAR ? "text-gold" : "text-miss"} />}
					</div>
					<PronWorkOn report={outcome?.report} />
					<ul className="mt-8 flex flex-col gap-2" data-testid="fast-reps">
						{reps.map((r) => (
							<li key={r.itemId} className="rounded-xl border border-border bg-card px-4 py-3">
								<div className="flex items-start gap-3">
									<button type="button" onClick={() => void speak(r.sentence).catch(() => {})} aria-label="Play" className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gold/20 text-foreground hover:bg-gold/30">
										<Volume2Icon className="size-4" />
									</button>
									<div className="min-w-0 flex-1">
										<p className="font-prose text-lg text-foreground" lang="sk">
											{r.sentence}
										</p>
										<p data-no-word-lookup="true" className="font-prose text-sm text-muted-foreground">{r.translation}</p>
									</div>
									<div className="flex gap-1.5" aria-label="Passes">
										{r.passes.map((p, i) => (
											<span key={i} className={cn("rounded-md px-1.5 py-0.5 font-ui text-xs font-bold tabular-nums", p.made ? "bg-go-soft text-go" : "bg-miss-soft text-miss")} title={`${(p.ms / 1000).toFixed(1)} s of ${(p.window / 1000).toFixed(1)} s${p.pron ? ` · ${p.pron.overall} clear` : ""}${p.heard ? ` · heard: ${p.heard}` : ""}${p.inWindow && !p.made ? " · in the window but not clear" : ""}`}>
												{(p.ms / 1000).toFixed(1)}s{p.pron ? ` · ${p.pron.overall}` : ""}
											</span>
										))}
									</div>
								</div>
							</li>
						))}
					</ul>
					{error && (
						<p className="mt-4 rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert">
							{error}
						</p>
					)}
					<div className="mt-10 flex flex-wrap gap-3">
						<Link href="/" className={PRIMARY} data-testid="fast-today">
							Today
						</Link>
						<button type="button" onClick={() => void load()} className={SECONDARY} data-testid="fast-again">
							<RepeatIcon className="size-4" />
							Six more
						</button>
						<span className="self-center font-ui text-xs text-muted-foreground">Enter goes to Today</span>
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
			<TaskTop progress={progress} label={`${index} of ${total} sentences`} count={`${index + 1}/${total}`} ink="bg-gold" />
			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-[8vh]">
				<div key={item.id} className={cn(COLUMN, "lh-rise")}>
					<p className="font-ui text-sm font-bold text-muted-foreground">
						Say it faster · pass {Math.min(pass + 1, FAST_PASSES)} of {FAST_PASSES} · {item.practised ? "a sentence you got right in a lesson" : "every word is yours"}
					</p>
					<h2 className="mb-6 mt-1 font-prose text-2xl font-semibold text-foreground">
						{phase === "ready" ? "Hear it, then say it" : phase === "running" ? (paused ? "Paused" : "Say it now") : last?.pending ? "Listening back…" : last?.made ? ["Made it!", "Faster!", "Full speed!"][pass] : last?.inWindow ? "Fast, but not clear" : "Over the window"}
					</h2>
					<div className="flex items-start gap-3">
						<button type="button" onClick={() => void speak(item.sentence).catch(() => {})} aria-label="Play" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gold/20 text-foreground transition-transform hover:scale-105 active:scale-95" data-testid="fast-play">
							<Volume2Icon className="size-7" />
						</button>
						<div>
							<p className="font-prose text-[30px] leading-[1.5] text-foreground" lang="sk" data-testid="fast-sentence" data-word-lookup-enabled={phase === "between" ? "true" : "false"}>
								{item.sentence}
							</p>
							<p data-no-word-lookup="true" className="mt-1 font-prose text-lg text-muted-foreground">{item.translation}</p>
						</div>
					</div>

					{/* The three windows: done passes, the live one, the ones to come. */}
					<div className="mt-8 grid grid-cols-3 gap-3" data-testid="fast-passes">
						{windows.map((w, i) => {
							const p = passes[i];
							const live = i === pass && phase === "running";
							return (
								<div key={i} className={cn("rounded-xl border-2 px-3 py-2", p ? (p.pending ? "border-gold bg-gold/10" : p.made ? "border-go bg-go-soft" : "border-miss bg-miss-soft") : live ? "border-gold bg-gold/10" : "border-border")}>
									<p className="font-ui text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{["Say it", "Faster", "Full speed"][i]}</p>
									<p className="font-ui text-xl font-black tabular-nums text-foreground">{p ? `${(p.ms / 1000).toFixed(1)} s` : live ? `${(left / 1000).toFixed(1)} s` : `${(w / 1000).toFixed(1)} s`}</p>
									{live && (
										<div className="mt-1 h-2 overflow-hidden rounded-full bg-accent">
											<div className="h-full rounded-full bg-gold" style={{ width: `${(left / w) * 100}%`, transition: "width 50ms linear" }} />
										</div>
									)}
									{p?.pending && (
										<p className="mt-1 flex items-center gap-1 font-ui text-xs text-muted-foreground">
											<LoaderCircleIcon className="size-3 animate-spin" /> scoring
										</p>
									)}
									{p?.pron && (
										<p className="mt-1">
											<PronChip score={p.pron} />
										</p>
									)}
									{p && !p.pending && !p.pron && p.heard !== undefined && (
										<p className="mt-1 truncate font-prose text-xs text-muted-foreground" title={p.heard} data-testid="fast-heard">
											heard: {p.heard || "—"}
										</p>
									)}
								</div>
							);
						})}
					</div>
					{error && (
						<p className="mt-4 rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert">
							{error}
						</p>
					)}
				</div>
			</div>
			<div className={cn("border-t border-border", phase === "between" && (last?.pending ? "bg-gold/10" : last?.made ? "bg-go-soft" : "bg-miss-soft"), phase === "running" && "bg-gold/10")}>
				<div className={cn(COLUMN, "flex min-h-24 items-center justify-between gap-4 py-5")}>
					{phase === "running" ? (
						<>
							<div className="flex items-center gap-3">
								{useMic ? <MicIcon className="size-5 text-gold" /> : <TimerIcon className="size-5 text-gold" />}
								<p className="font-ui text-lg font-extrabold text-foreground">{useMic ? "Listening — it stops when you stop" : "Press Space when you have said it"}</p>
								{useMic && <span className="h-2 w-16 overflow-hidden rounded-full bg-accent"><span className="block h-full bg-gold" style={{ width: `${level * 100}%` }} /></span>}
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
							<p className={cn("flex items-center gap-2 font-ui text-lg font-extrabold", last?.pending ? "text-foreground" : last?.made ? "text-go" : "text-miss")} data-testid="fast-verdict">
								{last?.pending ? (
									<>
										<LoaderCircleIcon className="size-5 animate-spin" /> Listening back…
									</>
								) : last?.made ? (
									`In the window · ${((last?.ms ?? 0) / 1000).toFixed(1)} s${last.pron ? ` · ${last.pron.overall} clear` : ""}`
								) : last?.inWindow ? (
									`In the window, but ${last.pron ? `${last.pron.overall} — ` : ""}not clear enough${last.pron?.words.some((w) => w.error === "omission") ? ` · missed: ${last.pron.words.filter((w) => w.error === "omission").map((w) => w.word).join(", ")}` : ""}`
								) : (
									`${(((last?.ms ?? 0) - win) / 1000).toFixed(1)} s over`
								)}
							</p>
							<button type="button" onClick={advance} disabled={!!last?.pending} className={cn(PRIMARY, !last?.pending && !last?.made && "bg-miss text-background", "disabled:opacity-50")} data-testid="fast-continue" ref={(el) => el?.focus()}>
								{pass + 1 < FAST_PASSES ? "Next pass" : index + 1 >= total ? "Finish" : "Next sentence"}
							</button>
						</>
					) : (
						<>
							<div className="flex items-center gap-3">
								<button type="button" onClick={() => setUseMic((v) => !v)} disabled={!stt || !micOk} className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-ui text-xs font-bold text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50" aria-pressed={useMic} title={stt ? (pron === "azure" ? "The microphone times each pass and scores it sound by sound" : "The microphone times each pass and checks the words were clear") : "Add an ElevenLabs or Deepgram key for the microphone"}>
									{useMic ? <MicIcon className="size-4" /> : <MicOffIcon className="size-4" />}
									{useMic ? "Mic on" : "Mic off"}
								</button>
								<p className="font-prose text-sm text-muted-foreground">Space starts the pass{useMic ? "" : " and ends it"} · R plays it again{useMic ? " · a pass counts only if it was clear" : ""}</p>
							</div>
							<button type="button" onClick={() => void startPass()} className={PRIMARY} data-testid="fast-start" ref={(el) => el?.focus()}>
								{pass === 0 ? "Go" : "Again, faster"}
							</button>
						</>
					)}
				</div>
			</div>
		</TaskFrame>
	);
}
