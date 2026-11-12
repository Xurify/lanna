"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, LoaderCircleIcon, MicIcon, RepeatIcon, SquareIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLUMN, Centered, Dock, EnterHint, PracticeCard, PRIMARY, SECONDARY, SentenceRow, SentenceRows, Stat, Stats, TaskEnd, TaskFrame, TaskTop, endEnterBlocked, onFocusedControl } from "@/components/task-frame";
import { KBD } from "@/components/ui/learn-buttons";
import { speak, useActiveLanguage } from "@/components/speech";
import { Recorder, micSupported, transcribeClip } from "@/components/speak/recorder";
import { SpeakModes } from "@/components/speak/speak-modes";
import { QIcon } from "@/components/quiet/icon";
import { SELF_TALK_CATEGORIES, SELF_TALK_PROMPTS, getSelfTalkPromptById, type SelfTalkPrompt, type UsefulChunk } from "@/src/core";

type Phase = "pick" | "talking" | "saving" | "done";

interface Outcome {
	xp: number;
	metTarget: boolean;
	activeSec: number;
	usedWords: UsefulChunk[];
	transcript: string;
}

const LONGEST_TAKE_MS = 300_000;

const GROUPS = SELF_TALK_CATEGORIES.map((c) => ({ ...c, prompts: SELF_TALK_PROMPTS.filter((p) => p.category === c.id) })).filter((g) => g.prompts.length > 0);

const categoryLabel = (p: SelfTalkPrompt) => SELF_TALK_CATEGORIES.find((c) => c.id === p.category)?.label ?? "";

function clockOf(sec: number): string {
	return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function stripEllipsis(text: string): string {
	return text.replace(/…/g, "").trim();
}

function stopTimer(timer: { current: ReturnType<typeof setInterval> | null }) {
	if (timer.current) clearInterval(timer.current);
	timer.current = null;
}

export function SelfTalkPlayer({ initialPromptId }: { initialPromptId?: string | null }) {
	const lang = useActiveLanguage();
	const router = useRouter();
	const [phase, setPhase] = useState<Phase>("pick");
	const [selected, setSelected] = useState(() => getSelfTalkPromptById(initialPromptId ?? "")?.id ?? SELF_TALK_PROMPTS[0]!.id);
	const prompt = getSelfTalkPromptById(selected) ?? SELF_TALK_PROMPTS[0]!;
	const [elapsed, setElapsed] = useState(0);
	const [level, setLevel] = useState(0);
	const [listening, setListening] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const recorder = useRef<Recorder | null>(null);
	const timer = useRef<ReturnType<typeof setInterval> | null>(null);
	const elapsedRef = useRef(0);
	const finishRef = useRef<() => Promise<void>>(async () => {});

	useEffect(
		() => () => {
			stopTimer(timer);
			recorder.current?.cancel();
		},
		[],
	);

	const start = useCallback(async () => {
		setError(null);
		setOutcome(null);
		elapsedRef.current = 0;
		setElapsed(0);
		setPhase("talking");
		stopTimer(timer);
		timer.current = setInterval(() => {
			elapsedRef.current += 1;
			setElapsed(elapsedRef.current);
		}, 1000);
		if (!micSupported()) {
			setError("This browser gives no microphone access. Talk out loud anyway: the clock counts, nothing is transcribed.");
			return;
		}
		const rec = new Recorder();
		try {
			await rec.start({ onLevel: setLevel, maxMs: LONGEST_TAKE_MS, onAutoStop: () => void finishRef.current() });
			recorder.current = rec;
			setListening(true);
		} catch {
			setError("The microphone was not allowed. Talk out loud anyway: the clock counts, nothing is transcribed.");
		}
	}, []);

	const cancel = useCallback(() => {
		stopTimer(timer);
		recorder.current?.cancel();
		recorder.current = null;
		setListening(false);
		setLevel(0);
		setPhase("pick");
	}, []);

	const finish = useCallback(async () => {
		stopTimer(timer);
		const seconds = elapsedRef.current;
		const rec = recorder.current;
		recorder.current = null;
		setListening(false);
		setLevel(0);
		setPhase("saving");
		let transcript = "";
		if (rec) {
			try {
				transcript = await transcribeClip((await rec.stop()).wav);
			} catch {
				transcript = "";
			}
		}
		try {
			const res = await fetch("/api/speak/self-talk", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ promptId: prompt.id, activeSec: seconds, transcript, tz: new Date().getTimezoneOffset() }),
			});
			const data = (await res.json().catch(() => ({}))) as { xp?: number; metTarget?: boolean; activeSec?: number; usedWords?: UsefulChunk[]; message?: string };
			if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
			setOutcome({ xp: data.xp ?? 0, metTarget: !!data.metTarget, activeSec: data.activeSec ?? seconds, usedWords: data.usedWords ?? [], transcript });
			setPhase("done");
		} catch (err) {
			setError(`Not saved: ${err instanceof Error ? err.message : String(err)}`);
			setPhase("pick");
		}
	}, [prompt.id]);
	finishRef.current = finish;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (phase === "pick") {
				if (e.key === "ArrowDown" || e.key === "ArrowUp") {
					e.preventDefault();
					const i = SELF_TALK_PROMPTS.findIndex((p) => p.id === selected);
					const next = SELF_TALK_PROMPTS[(i + (e.key === "ArrowDown" ? 1 : SELF_TALK_PROMPTS.length - 1)) % SELF_TALK_PROMPTS.length];
					if (next) {
						setSelected(next.id);
						document.querySelector(`[data-prompt-row="${next.id}"]`)?.scrollIntoView({ block: "nearest" });
					}
				} else if (e.key === "Enter") {
					const t = e.target instanceof HTMLElement ? e.target : null;
					if (t && (t instanceof HTMLAnchorElement || (t instanceof HTMLButtonElement && !t.dataset.promptRow))) return;
					e.preventDefault();
					void start();
				} else if (e.key === "Escape") router.push("/speak");
			} else if (phase === "talking") {
				if (e.key === " " || e.key === "Enter") {
					e.preventDefault();
					void finish();
				} else if (e.key === "Escape") cancel();
			} else if (phase === "done") {
				if (e.key === "Enter" && !endEnterBlocked(e)) {
					e.preventDefault();
					router.push("/");
				} else if (e.key === "Escape" && !onFocusedControl(e)) router.push("/speak");
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [phase, selected, start, finish, cancel, router]);

	if (phase === "saving")
		return (
			<TaskFrame>
				<Centered testId="self-talk-saving">
					<p className="flex items-center justify-center gap-3 font-ui text-sm text-muted-foreground">
						<LoaderCircleIcon className="size-5 animate-spin" />
						Listening back to what you said…
					</p>
				</Centered>
			</TaskFrame>
		);

	if (phase === "done" && outcome) return <EndScreen prompt={prompt} outcome={outcome} onAgain={() => setPhase("pick")} />;

	if (phase === "talking")
		return (
			<TaskFrame strip={false}>
				<TaskTop progress={Math.min(1, elapsed / prompt.targetSec)} label="Time said out loud" count={`${clockOf(elapsed)} / ${clockOf(prompt.targetSec)}`} onLeave={cancel} />
				<div className="flex flex-1 flex-col overflow-y-auto pt-4 pb-8">
					<div className={COLUMN}>
						<PracticeCard icon="speak" title="On your own" sub={`${categoryLabel(prompt)} · ${prompt.level}`}>
							<h1 className="font-prose text-[28px] font-semibold leading-tight tracking-[-0.015em] text-foreground" lang={lang?.code}>
								{prompt.prompt}
							</h1>
							<p className="mt-1.5 font-prose text-[15px] text-ink-3">{prompt.promptEn}</p>
							<Help prompt={prompt} lang={lang?.code} stuck />
						</PracticeCard>
						{error && (
							<p className="mt-6 rounded-xl bg-well px-4 py-3 font-prose text-sm text-ink-2" role="status" data-testid="self-talk-error">
								{error}
							</p>
						)}
					</div>
				</div>
				<Dock testId="self-talk-dock">
					<div className={cn(COLUMN, "flex min-h-24 items-center gap-4 py-4")}>
						<button
							type="button"
							onClick={() => void finish()}
							aria-label="Done talking"
							className={cn("lh-press relative flex size-16 shrink-0 items-center justify-center rounded-full text-sun-ink", listening ? "bg-miss" : "bg-teal hover:bg-teal-2")}
							data-testid="self-talk-stop"
						>
							{listening && <span className="absolute inset-0 rounded-full bg-miss/40" style={{ transform: `scale(${1 + level * 0.6})` }} aria-hidden="true" />}
							<SquareIcon className="relative size-6 fill-current" />
						</button>
						<div className="min-w-0 flex-1">
							{listening ? <Meter level={level} /> : <p className="font-ui text-sm font-[600] text-foreground">Talking out loud</p>}
							<p className="mt-0.5 font-prose text-xs text-muted-foreground">
								<span className="pointer-coarse:hidden">Space or Enter when you are done · Escape throws it away</span>
								<span className="hidden pointer-coarse:inline">Tap the square when you are done</span>
							</p>
						</div>
						<p className={cn("shrink-0 font-ui text-[22px] font-[600] tracking-[-0.02em] tabular-nums", elapsed >= prompt.targetSec ? "text-teal-2" : "text-foreground")} aria-live="off" data-testid="self-talk-clock">
							{clockOf(elapsed)}
						</p>
					</div>
				</Dock>
			</TaskFrame>
		);

	const sheet = (inline: boolean) => <PromptSheet key={`${prompt.id}-${inline}`} prompt={prompt} lang={lang?.code} inline={inline} onStart={() => void start()} />;

	return (
		<TaskFrame>
			<div className="@container flex flex-1 flex-col overflow-y-auto">
				<div className="mx-auto w-full max-w-5xl px-5 pt-[5vh] pb-12 @md:px-6">
					<Link href="/" className="lh-wco-gutter inline-flex items-center gap-1.5 font-ui text-xs text-muted-foreground hover:text-foreground">
						<ArrowLeftIcon className="size-3.5" />
						Today
					</Link>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h1 className="font-ui text-[28px] font-[600] tracking-[-0.028em] text-foreground">Speak</h1>
						<SpeakModes current="solo" />
					</div>
					<p className="mt-1 max-w-2xl font-prose text-[15px] text-ink-3">Nobody answers and nobody grades. Pick a topic, say what comes to mind out loud, and keep going until the clock reaches the goal.</p>

					{error && (
						<p className="mt-5 rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert" data-testid="self-talk-error">
							{error}
						</p>
					)}

					<div className="mt-7 grid grid-cols-[minmax(0,1fr)] items-start gap-x-8 gap-y-6 @3xl:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] @5xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
						<div className="flex min-w-0 flex-col gap-6" data-testid="self-talk-prompts">
							{GROUPS.map((g) => (
								<section key={g.id} aria-label={g.label}>
									<h2 className="q-sh !mb-1.5 px-3">{g.label}</h2>
									<ul className="flex flex-col gap-1">
										{g.prompts.map((p) => {
											const on = p.id === prompt.id;
											return (
												<li key={p.id}>
													<button
														type="button"
														onClick={() => setSelected(p.id)}
														aria-current={on ? "true" : undefined}
														data-prompt-row={p.id}
														data-testid={`prompt-${p.id}`}
														className={cn("lh-press flex w-full min-w-0 items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors", on ? "bg-well" : "hover:bg-well")}
													>
														<span className="min-w-0 flex-1">
															<span className={cn("block truncate font-ui text-[15px] font-[600] tracking-[-0.01em]", on ? "text-foreground" : "text-ink-2")} lang={lang?.code}>
																{p.title}
															</span>
															<span className="block truncate font-prose text-[13px] text-ink-3">{p.titleEn}</span>
														</span>
														<span className="shrink-0 font-ui text-xs tabular-nums text-ink-3">{p.level}</span>
													</button>
													{on && <div className="mt-2 mb-4 @3xl:hidden">{sheet(true)}</div>}
												</li>
											);
										})}
									</ul>
								</section>
							))}
							<p className="hidden px-3 font-ui text-xs text-ink-3 pointer-fine:@3xl:block">
								<kbd className={KBD}>↑</kbd> <kbd className={KBD}>↓</kbd> pick · <kbd className={KBD}>Enter</kbd> starts · <kbd className={KBD}>Esc</kbd> leaves
							</p>
						</div>
						<div className="sticky top-6 hidden @3xl:block">{sheet(false)}</div>
					</div>

					<p className="mt-10 max-w-2xl font-ui text-xs text-muted-foreground">
						The time you talk counts toward Speaking. With a speech-to-text key the app also listens for the words on the list; without one, only the time counts.
					</p>
				</div>
			</div>
		</TaskFrame>
	);
}

function PromptSheet({ prompt, lang, inline, onStart }: { prompt: SelfTalkPrompt; lang?: string; inline: boolean; onStart: () => void }) {
	const tid = (id: string) => (inline ? undefined : id);
	return (
		<article className={cn(inline ? "ml-3 border-l border-[var(--q-line-2)] pl-3" : "lh-rise border-l border-[var(--q-line)] pl-8")} data-testid={tid("self-talk-sheet")} aria-label={prompt.title}>
			<div className={cn(inline ? "py-2" : "pt-1 pb-2")}>
				{!inline && (
					<>
						<p className="font-ui text-[13px] font-[550] text-teal-2">
							{categoryLabel(prompt)} · {prompt.level}
						</p>
						<h2 className="mt-1 font-ui text-[30px] font-[600] tracking-[-0.028em] text-foreground @4xl:text-[34px]" lang={lang}>
							{prompt.title}
						</h2>
						<p className="mt-1 font-prose text-base text-ink-2">{prompt.titleEn}</p>
					</>
				)}

				<dl className={cn("grid gap-x-6 gap-y-3 font-prose text-[15px] @md:grid-cols-[7rem_minmax(0,1fr)]", !inline && "mt-5 border-t border-border pt-5")}>
					<dt className="font-ui text-[13px] font-[550] text-ink-3 @md:pt-px">Your part</dt>
					<dd className="-mt-2 @md:mt-0">
						<span className="block text-foreground" lang={lang}>
							{prompt.prompt}
						</span>
						<span className="mt-0.5 block text-[13px] text-ink-3">{prompt.promptEn}</span>
					</dd>
					<dt className="font-ui text-[13px] font-[550] text-ink-3 @md:pt-px">Goal</dt>
					<dd className="-mt-2 text-foreground @md:mt-0">{clockOf(prompt.targetSec)} out loud, without stopping to translate</dd>
				</dl>

				<div className="mt-6 flex flex-wrap items-center gap-2">
					<button type="button" onClick={onStart} className={PRIMARY} data-testid={tid("self-talk-start")}>
						<MicIcon className="size-4" />
						Start talking
						<kbd className={cn(KBD, "hidden bg-white/15 text-current shadow-none pointer-fine:inline-flex")}>Enter</kbd>
					</button>
				</div>

				<Help prompt={prompt} lang={lang} />
			</div>
		</article>
	);
}

function Help({ prompt, lang, stuck = false }: { prompt: SelfTalkPrompt; lang?: string; stuck?: boolean }) {
	return (
		<>
			<div className="mt-7">
				<h3 className="q-sh !mb-0">{stuck ? "If you get stuck" : "To get you started"}</h3>
				<SentenceRows>
					{prompt.starters.map((s) => (
						<SentenceRow key={s.sk} sentence={s.sk} lang={lang} translation={s.en} onPlay={() => void speak(stripEllipsis(s.sk)).catch(() => {})} />
					))}
				</SentenceRows>
			</div>
			<div className="mt-5">
				<h3 className="q-sh">Words you might need</h3>
				<WordList words={prompt.suggestedWords} lang={lang} />
			</div>
		</>
	);
}

function WordList({ words, lang, used }: { words: UsefulChunk[]; lang?: string; used?: Set<string> }) {
	return (
		<ul className="flex flex-wrap gap-2">
			{words.map((w) => {
				const hit = used?.has(w.sk);
				return (
					<li key={w.sk}>
						<button
							type="button"
							onClick={() => void speak(w.sk).catch(() => {})}
							aria-label={`Play: ${w.sk}, ${w.en}`}
							className={cn("lh-press flex items-baseline gap-1.5 rounded-md px-2.5 py-1 transition-colors pointer-coarse:py-2", hit ? "bg-teal-wash text-teal-2" : "bg-well text-foreground hover:bg-well-2")}
						>
							<span className="font-prose text-base font-[550]" lang={lang}>
								{w.sk}
							</span>
							<span className={cn("font-prose text-[13px]", hit ? "text-teal-2" : "text-ink-3")}>{w.en}</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

function Meter({ level }: { level: number }) {
	const cells = 24;
	const lit = Math.round(level * cells);
	return (
		<div className="flex h-6 items-center gap-0.5" aria-label="Microphone level" data-testid="self-talk-meter">
			{Array.from({ length: cells }, (_, i) => (
				<span key={i} className={cn("w-1.5 rounded-sm transition-[height] duration-75", i < lit ? "bg-teal" : "bg-accent")} style={{ height: `${6 + (i < lit ? 14 * Math.min(1, (i + 1) / cells + 0.3) : 0)}px` }} />
			))}
		</div>
	);
}

function EndScreen({ prompt, outcome, onAgain }: { prompt: SelfTalkPrompt; outcome: Outcome; onAgain: () => void }) {
	const lang = useActiveLanguage();
	const heard = outcome.transcript.length > 0;
	const used = new Set(outcome.usedWords.map((w) => w.sk));
	return (
		<TaskFrame>
			<TaskEnd
				testId="self-talk-end"
				hint={<EnterHint>for Today</EnterHint>}
				actions={
					<>
						<button type="button" onClick={onAgain} className={SECONDARY} data-testid="self-talk-again">
							<RepeatIcon className="size-4" />
							Another topic
						</button>
						<Link href="/" className={PRIMARY}>
							Today
						</Link>
					</>
				}
			>
				<p className="q-date flex items-center gap-1.5">
					<QIcon name="speak" className="text-teal" />
					Speak · <span lang={lang?.code}>{prompt.title}</span> · done
				</p>
				<h1 className="q-hello">{clockOf(outcome.activeSec)} said out loud</h1>
				<Stats className="mt-7 max-w-none">
					<Stat label="XP" value={`+${outcome.xp}`} ink="text-teal-2" />
					<Stat label={`Goal of ${clockOf(prompt.targetSec)}`} value={outcome.metTarget ? "Reached" : "Not yet"} ink={outcome.metTarget ? "text-teal-2" : undefined} />
					<Stat label="Words from the list" value={heard ? `${outcome.usedWords.length} of ${prompt.suggestedWords.length}` : "Not listened for"} />
				</Stats>
				{!heard && <p className="mt-2 font-prose text-sm text-ink-3">Nothing was transcribed, so only the time counts. A speech-to-text key in Settings lets the app listen for the words.</p>}
				{heard && (
					<div className="mt-8">
						<h2 className="q-sh">What the app heard</h2>
						<p className="font-prose text-[17px] leading-relaxed text-foreground" lang={lang?.code} data-testid="self-talk-transcript">
							{outcome.transcript}
						</p>
					</div>
				)}
				<div className="mt-8">
					<h2 className="q-sh">{heard ? "The words, the ones you used in teal" : "The words"}</h2>
					<WordList words={prompt.suggestedWords} lang={lang?.code} used={used} />
				</div>
			</TaskEnd>
		</TaskFrame>
	);
}
