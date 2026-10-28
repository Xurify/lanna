"use client";

/**
 * Speak (LangHarness, 2026-10-28) — the output strand's screen. A scene
 * from what Slovak is for (src/core/speak.ts), said out loud: the tutor's
 * line arrives as audio and text (meaning on demand), the learner holds
 * the mic and says theirs (the clip is transcribed and sent as the line;
 * typing is always there too), and a slip in a case, verb or aspect
 * ending comes back as a prompt chip to repair, never a silent recast.
 * "Koniec" (or the tutor's goodbye) ends the scene with a summary: at
 * most three corrections, two phrases to keep, the slips' words into the
 * review deck.
 *
 * Full screen like a lesson. Keys: Space holds the mic (press to start,
 * press to send), Enter sends a typed line, M shows the meaning, R
 * replays the tutor, Escape leaves.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, KeyboardIcon, LoaderCircleIcon, MicIcon, RepeatIcon, SendIcon, SquareIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak, SpeedToggle } from "@/components/speech";
import { sfx } from "@/components/lesson/sound";
import { COLUMN, PRIMARY, SECONDARY, Stat, TaskFrame, TaskTop, Centered } from "@/components/task-frame";
import { Recorder, micSupported, transcribeClip } from "@/components/speak/recorder";
import { SLIP_LABEL, SPEAK_REPAIR_XP, SPEAK_TURNS, speakCounts, type SpeakScene, type SpeakSession, type SpeakTurn } from "@/src/core";

type SttEngine = "elevenlabs" | "deepgram";

export interface SpeakState {
	scenes: Array<SpeakScene & { suggested: boolean; done: number }>;
	canSpeak: boolean;
	stt: SttEngine | null;
	unfinished: { id: string; scene: string; sceneTitle: string; turns: number } | null;
	recent: Array<{ id: string; scene: string; sceneTitle: string; startedAt: string; turns: number; corrections: number; xp?: number }>;
}

interface Outcome {
	session: SpeakSession;
	xp: number;
	queued: string[];
	summary: { todayXp: number; dailyGoal: number; streak: { days: number } };
}

type Phase = "pick" | "starting" | "scene" | "ending" | "done";

const PRAISE = ["Výborne!", "Presne!", "Áno, tak!", "Super!"];

export function SpeakPlayer({ initialState, sceneId = null }: { initialState: SpeakState | null; sceneId?: string | null }) {
	const router = useRouter();
	const [state, setState] = useState<SpeakState | null>(initialState);
	const [phase, setPhase] = useState<Phase>("pick");
	const [session, setSession] = useState<SpeakSession | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	// Browser globals are read after mount so server and client agree.
	const [micOk, setMicOk] = useState(false);
	useEffect(() => setMicOk(micSupported()), []);
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const [listening, setListening] = useState(false);
	const [hearing, setHearing] = useState(false);
	const [level, setLevel] = useState(0);
	const [meaning, setMeaning] = useState(false);
	const [typing, setTyping] = useState(false);
	const startedAt = useRef(Date.now());
	const recorder = useRef<Recorder | null>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const autoStarted = useRef(false);

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/speak");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			setState((await res.json()) as SpeakState);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	useEffect(() => {
		if (!initialState) void load();
	}, [initialState, load]);

	const post = async <T,>(body: Record<string, unknown> | FormData): Promise<T> => {
		const res = await fetch("/api/speak", body instanceof FormData ? { method: "POST", body } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
		const data = (await res.json().catch(() => ({}))) as T & { message?: string };
		if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
		return data;
	};

	const start = useCallback(
		async (scene: string) => {
			setError(null);
			setPhase("starting");
			setMeaning(false);
			try {
				const s = await post<SpeakSession>({ action: "start", scene });
				setSession(s);
				startedAt.current = Date.now();
				setPhase("scene");
				const first = s.turns[0];
				if (first) void speak(first.text).catch(() => {});
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
				setPhase("pick");
			}
		},
		[],
	);

	const resume = useCallback(async (id: string) => {
		// The unfinished scene's record comes back through "turn" only; a
		// resume re-reads it via the state's id by starting nothing new.
		setError(null);
		try {
			const res = await fetch(`/api/speak?id=${encodeURIComponent(id)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as SpeakState & { session?: SpeakSession };
			if (!data.session) throw new Error("That scene is gone.");
			setSession(data.session);
			startedAt.current = Date.now();
			setPhase("scene");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	// ?scene=… opens the scene at once (the daily plan's link).
	useEffect(() => {
		if (sceneId && state && !autoStarted.current && phase === "pick" && state.canSpeak) {
			autoStarted.current = true;
			void start(sceneId);
		}
	}, [sceneId, state, phase, start]);

	const finish = useCallback(async () => {
		if (!session || phase !== "scene") return;
		recorder.current?.cancel();
		setListening(false);
		setPhase("ending");
		sfx.done();
		try {
			const o = await post<Outcome>({ action: "end", id: session.id, ms: Date.now() - startedAt.current, tz: new Date().getTimezoneOffset() });
			setOutcome(o);
			setSession(o.session);
			setPhase("done");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setPhase("scene");
		}
	}, [session, phase]);

	const send = useCallback(
		async (text: string, via: "voice" | "typed", clip?: { blob: Blob; ms: number }) => {
			if (!session || sending || !text.trim()) return;
			setSending(true);
			setDraft("");
			setMeaning(false);
			// The learner's line shows at once; the tutor's follows.
			const mine: SpeakTurn = { role: "learner", text: text.trim(), via, at: new Date().toISOString() };
			setSession({ ...session, turns: [...session.turns, mine] });
			try {
				const form = new FormData();
				form.set("action", "turn");
				form.set("id", session.id);
				form.set("text", text.trim());
				form.set("via", via);
				if (clip) {
					form.set("ms", String(clip.ms));
					form.set("audio", clip.blob, "line.webm");
				}
				const out = await post<{ session: SpeakSession; reply: SpeakTurn; end: boolean }>(form);
				setSession(out.session);
				if (out.reply.repaired) sfx.right(2);
				else if (out.reply.prompt) sfx.wrong();
				void speak(out.reply.text).catch(() => {});
				if (out.end) {
					// Let the goodbye play, then the summary.
					setTimeout(() => void finishRef.current(), 1200);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
				setSession(session);
				setDraft(text);
			} finally {
				setSending(false);
			}
		},
		[session, sending],
	);
	const finishRef = useRef(finish);
	finishRef.current = finish;

	const toggleMic = useCallback(async () => {
		if (!state?.stt || sending || hearing || phase !== "scene") return;
		if (listening) {
			const rec = recorder.current;
			if (!rec) return;
			setListening(false);
			setHearing(true);
			try {
				const clip = await rec.stop();
				recorder.current = null;
				if (clip.ms < 300 || clip.spokeAt === null) {
					setError("Nothing heard. Hold the mic and say your line.");
					return;
				}
				const text = await transcribeClip(clip.blob);
				if (!text) {
					setError("Nothing heard. Say it once more, a little louder.");
					return;
				}
				await send(text, "voice", { blob: clip.blob, ms: clip.ms });
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setHearing(false);
				setLevel(0);
			}
			return;
		}
		setError(null);
		const rec = new Recorder();
		recorder.current = rec;
		try {
			await rec.start({ onLevel: setLevel, maxMs: 30_000, onAutoStop: () => void toggleRef.current() });
			setListening(true);
		} catch {
			recorder.current = null;
			setError("The microphone was not allowed. Type your line, or allow the mic and try again.");
		}
	}, [state, sending, hearing, phase, listening, send]);
	const toggleRef = useRef(toggleMic);
	toggleRef.current = toggleMic;

	// The newest line scrolls into view.
	useEffect(() => {
		listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
	}, [session?.turns.length, sending]);

	useEffect(() => () => recorder.current?.cancel(), []);

	// Keys.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const inField = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement;
			if (e.key === "Escape") {
				if (listening) {
					recorder.current?.cancel();
					recorder.current = null;
					setListening(false);
					setLevel(0);
					return;
				}
				if (phase === "scene" && session && speakCounts(session.turns).learner === 0) void post({ action: "drop", id: session.id }).catch(() => undefined);
				router.push("/");
				return;
			}
			if (phase === "done" && e.key === "Enter") {
				router.push("/");
				return;
			}
			if (phase !== "scene" || inField) return;
			if (e.key === " ") {
				e.preventDefault();
				void toggleMic();
			} else if (e.key === "m" || e.key === "M") setMeaning((v) => !v);
			else if (e.key === "r" || e.key === "R") {
				const last = [...(session?.turns ?? [])].reverse().find((t) => t.role === "tutor");
				if (last) void speak(last.text).catch(() => {});
			} else if (e.key === "t" || e.key === "T") {
				setTyping(true);
				setTimeout(() => inputRef.current?.focus(), 0);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [phase, listening, session, router, toggleMic]);

	if (phase === "pick") return <Picker state={state} error={error} sceneId={sceneId} onPick={(id) => void start(id)} onResume={(id) => void resume(id)} onRetry={() => void load()} />;

	if (phase === "starting" || !session) {
		return (
			<TaskFrame>
				<Centered testId="speak-loading">
					<p className="flex items-center justify-center gap-3 font-ui text-sm text-muted-foreground">
						<LoaderCircleIcon className="size-5 animate-spin" />
						The tutor is getting into character…
					</p>
				</Centered>
			</TaskFrame>
		);
	}

	if (phase === "done" && outcome) {
		return (
			<TaskFrame>
				<EndScreen outcome={outcome} onAgain={() => router.push("/speak")} />
			</TaskFrame>
		);
	}

	const counts = speakCounts(session.turns);
	const lastTutor = [...session.turns].reverse().find((t) => t.role === "tutor");
	const scene = state?.scenes.find((s) => s.id === session.scene);
	const canMic = !!state?.stt && micOk;

	return (
		<TaskFrame strip={false}>
			<TaskTop
				progress={Math.min(1, counts.learner / SPEAK_TURNS)}
				label={`${counts.learner} of ${SPEAK_TURNS} lines said`}
				count={`${Math.min(counts.learner + 1, SPEAK_TURNS)}/${SPEAK_TURNS}`}
				ink="bg-xp"
				onLeave={() => {
					recorder.current?.cancel();
					if (counts.learner === 0) void post({ action: "drop", id: session.id }).catch(() => undefined);
					router.push("/");
				}}
			/>

			<div ref={listRef} className="flex flex-1 flex-col overflow-y-auto pb-6 pt-4">
				<div className={cn(COLUMN, "flex flex-col gap-4")}>
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<div>
							<p className="font-ui text-sm font-bold text-muted-foreground">Speak · {scene?.blurb ?? session.sceneTitle}</p>
							<h2 className="font-prose text-2xl font-semibold text-foreground" lang="sk">
								{session.sceneTitle}
							</h2>
						</div>
						{scene && <p className="max-w-sm font-prose text-sm text-muted-foreground">{scene.task}</p>}
					</div>

					<ol className="flex flex-col gap-3" data-testid="speak-turns" aria-live="polite">
						{session.turns.map((t, i) => (
							<li key={`${t.at}-${i}`} className={cn("flex", t.role === "learner" ? "justify-end" : "justify-start")}>
								{t.role === "tutor" ? <TutorBubble turn={t} last={t === lastTutor} meaning={meaning && t === lastTutor} onMeaning={() => setMeaning((v) => !v)} /> : <LearnerBubble turn={t} />}
							</li>
						))}
						{sending && (
							<li className="flex justify-start" data-testid="speak-thinking">
								<span className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-card px-4 py-3 font-ui text-sm text-muted-foreground">
									<LoaderCircleIcon className="size-4 animate-spin" />…
								</span>
							</li>
						)}
					</ol>
					{error && (
						<p className="rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" data-testid="speak-error" role="alert">
							{error}
						</p>
					)}
				</div>
			</div>

			{/* The bottom bar: the mic (or the keyboard), what it hears, Koniec. */}
			<div className={cn("border-t border-border", listening && "bg-xp/5")}>
				<div className={cn(COLUMN, "flex min-h-24 flex-col gap-3 py-4")}>
					{typing || !canMic ? (
						<form
							className="flex items-end gap-2"
							onSubmit={(e) => {
								e.preventDefault();
								void send(draft, "typed");
							}}
						>
							<textarea
								ref={inputRef}
								value={draft}
								onChange={(e) => setDraft(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										void send(draft, "typed");
									}
								}}
								rows={1}
								lang="sk"
								placeholder="Your line in Slovak…"
								disabled={sending || phase !== "scene"}
								className="min-h-12 flex-1 resize-none rounded-xl border-2 border-border bg-card px-4 py-3 font-prose text-lg text-foreground outline-none focus:border-xp"
								data-testid="speak-input"
							/>
							<button type="submit" disabled={sending || !draft.trim()} className={cn(PRIMARY, "h-12 px-4")} aria-label="Send" data-testid="speak-send">
								<SendIcon className="size-5" />
							</button>
							{canMic && (
								<button type="button" onClick={() => setTyping(false)} className={cn(SECONDARY, "h-12 px-3")} aria-label="Use the microphone" title="Use the microphone">
									<MicIcon className="size-5" />
								</button>
							)}
						</form>
					) : (
						<div className="flex items-center gap-4">
							<button
								type="button"
								onClick={() => void toggleMic()}
								disabled={sending || hearing}
								aria-pressed={listening}
								aria-label={listening ? "Stop and send" : "Say your line"}
								className={cn(
									"relative flex size-16 shrink-0 items-center justify-center rounded-full text-background transition-transform active:scale-95 disabled:opacity-60",
									listening ? "bg-miss" : "bg-xp hover:scale-105",
								)}
								data-testid="speak-mic"
							>
								{listening && <span className="absolute inset-0 rounded-full bg-miss/40" style={{ transform: `scale(${1 + level * 0.6})` }} aria-hidden="true" />}
								{hearing ? <LoaderCircleIcon className="relative size-7 animate-spin" /> : listening ? <SquareIcon className="relative size-6 fill-current" /> : <MicIcon className="relative size-7" />}
							</button>
							<div className="min-w-0 flex-1">
								{listening ? (
									<Meter level={level} />
								) : (
									<p className="font-ui text-sm font-bold text-foreground" data-testid="speak-hint">
										{hearing ? "Hearing you…" : sending ? "The tutor is answering…" : counts.learner === 0 ? "Press the mic (or Space), say your line, press again." : "Your turn. Mic or Space."}
									</p>
								)}
								<p className="mt-0.5 font-prose text-xs text-muted-foreground">{listening ? "Press again (or Space) when you have said it · Escape throws it away" : "M shows the meaning · R replays · T types a line"}</p>
							</div>
							<button type="button" onClick={() => setTyping(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Type instead" title="Type instead (T)">
								<KeyboardIcon className="size-5" />
							</button>
						</div>
					)}
					<div className="flex items-center justify-between gap-3">
						{!state?.stt ? (
							<p className="font-ui text-xs text-muted-foreground">
								Voice needs an ElevenLabs or Deepgram key —{" "}
								<Link href="/settings#keys" className="underline hover:text-foreground">
									Settings → Keys
								</Link>
								. Typing works meanwhile.
							</p>
						) : (
							<span className="flex items-center gap-2 font-ui text-xs text-muted-foreground">
								<SpeedToggle /> tutor speed
							</span>
						)}
						<button type="button" onClick={() => void finish()} disabled={counts.learner === 0 || sending || phase !== "scene"} className={cn(SECONDARY, "h-10 px-4 text-sm")} data-testid="speak-end">
							Koniec · get my corrections
						</button>
					</div>
				</div>
			</div>
			{phase === "ending" && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80" data-testid="speak-ending">
					<p className="flex items-center gap-3 font-ui text-sm text-muted-foreground">
						<LoaderCircleIcon className="size-5 animate-spin" />
						Looking back over what you said…
					</p>
				</div>
			)}
		</TaskFrame>
	);
}

function Meter({ level }: { level: number }) {
	const cells = 24;
	const lit = Math.round(level * cells);
	return (
		<div className="flex h-6 items-center gap-0.5" aria-label="Microphone level" data-testid="speak-meter">
			{Array.from({ length: cells }, (_, i) => (
				<span key={i} className={cn("w-1.5 rounded-sm transition-[height] duration-75", i < lit ? "bg-xp" : "bg-accent")} style={{ height: `${6 + (i < lit ? 14 * Math.min(1, (i + 1) / cells + 0.3) : 0)}px` }} />
			))}
		</div>
	);
}

function TutorBubble({ turn, last, meaning, onMeaning }: { turn: SpeakTurn; last: boolean; meaning: boolean; onMeaning: () => void }) {
	return (
		<div className="max-w-[85%]">
			{turn.prompt && (
				<div className="mb-1.5 inline-flex max-w-full flex-wrap items-baseline gap-x-2 rounded-xl border-2 border-gold/60 bg-gold/10 px-3 py-1.5 font-prose text-base" data-testid="speak-prompt">
					<span className="font-ui text-xs font-bold uppercase tracking-wide text-foreground">Fix the {SLIP_LABEL[turn.prompt.kind]}</span>
					<span className="text-muted-foreground line-through decoration-2" lang="sk">
						{turn.prompt.yours}
					</span>
					<span className="font-bold text-foreground" lang="sk">
						{turn.prompt.hint}
					</span>
				</div>
			)}
			{turn.repaired && (
				<p className="mb-1.5 inline-flex items-center gap-1.5 rounded-xl bg-go-soft px-3 py-1 font-ui text-sm font-bold text-go" data-testid="speak-repaired">
					<CheckIcon className="size-4" strokeWidth={3} />
					Repaired · +{SPEAK_REPAIR_XP} XP
				</p>
			)}
			<div className={cn("rounded-2xl rounded-bl-md bg-card px-4 py-3", last && "lh-rise border-2 border-xp/40")}>
				<div className="flex items-start gap-2">
					<button type="button" onClick={() => void speak(turn.text).catch(() => {})} aria-label="Play" className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-xp/15 text-xp hover:bg-xp/25">
						<Volume2Icon className="size-4" />
					</button>
					<p className={cn("font-prose text-foreground", last ? "text-2xl leading-snug" : "text-lg")} lang="sk">
						{turn.text}
					</p>
				</div>
				{turn.en && (
					<div className="mt-1.5 pl-10">
						{meaning ? (
							<p className="font-prose text-base text-muted-foreground" data-testid="speak-meaning">
								{turn.en}
							</p>
						) : last ? (
							<button type="button" onClick={onMeaning} className="font-ui text-xs font-bold text-muted-foreground hover:text-foreground">
								Show the meaning (M)
							</button>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}

function LearnerBubble({ turn }: { turn: SpeakTurn }) {
	return (
		<div className="max-w-[85%] rounded-2xl rounded-br-md bg-xp/15 px-4 py-3">
			<p className="font-prose text-lg text-foreground" lang="sk">
				{turn.text}
			</p>
			<p className="mt-0.5 font-ui text-[11px] text-muted-foreground">{turn.via === "voice" ? "heard" : "typed"}</p>
		</div>
	);
}

function Picker({ state, error, sceneId, onPick, onResume, onRetry }: { state: SpeakState | null; error: string | null; sceneId: string | null; onPick: (id: string) => void; onResume: (id: string) => void; onRetry: () => void }) {
	return (
		<TaskFrame>
			<div className={cn(COLUMN, "flex flex-1 flex-col overflow-y-auto pb-10 pt-[6vh]")}>
				<div className="lh-wco-gutter flex items-center justify-between">
					<Link href="/" className="font-ui text-sm font-bold text-muted-foreground hover:text-foreground">
						← Today
					</Link>
				</div>
				<p className="mt-6 font-ui text-sm font-bold text-muted-foreground">Speak</p>
				<h1 className="mt-1 font-ui text-3xl font-black text-foreground">Pick a scene and say it</h1>
				<p className="mt-2 max-w-xl font-prose text-base text-muted-foreground">
					The tutor plays the other person and answers out loud. Say your lines into the mic (press, speak, press). A slip in an ending comes back as a prompt to fix yourself; the rest waits for the end.
				</p>
				{error && (
					<p className="mt-4 rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert" data-testid="speak-error">
						{error}{" "}
						<button type="button" onClick={onRetry} className="underline">
							Try again
						</button>
					</p>
				)}
				{state && !state.canSpeak && (
					<p className="mt-4 rounded-xl bg-gold/15 px-4 py-2 font-ui text-sm text-foreground" data-testid="speak-nomodel">
						A scene needs a model on the cheap slot —{" "}
						<Link href="/settings" className="underline">
							Settings → Models
						</Link>
						.
					</p>
				)}
				{state?.unfinished && (
					<button type="button" onClick={() => onResume(state.unfinished!.id)} className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-xp/50 bg-xp/10 px-4 py-3 text-left hover:bg-xp/15" data-testid="speak-resume">
						<RepeatIcon className="size-5 text-xp" />
						<span>
							<span className="block font-ui text-base font-bold text-foreground">Carry on: {state.unfinished.sceneTitle}</span>
							<span className="block font-prose text-sm text-muted-foreground">{state.unfinished.turns} lines said</span>
						</span>
					</button>
				)}
				<div className="mt-6 grid gap-3 sm:grid-cols-2" data-testid="speak-scenes">
					{(state?.scenes ?? []).map((s) => (
						<button
							key={s.id}
							type="button"
							disabled={!state?.canSpeak}
							onClick={() => onPick(s.id)}
							className={cn(
								"rounded-2xl border-2 bg-card px-4 py-3.5 text-left shadow-[0_3px_0_0_var(--border)] transition-all hover:-translate-y-0.5 hover:border-xp/60 disabled:opacity-50",
								s.id === sceneId && "border-xp",
							)}
							data-testid={`scene-${s.id}`}
						>
							<span className="flex items-baseline justify-between gap-2">
								<span className="font-ui text-lg font-bold text-foreground" lang="sk">
									{s.title}
								</span>
								{s.suggested && <span className="rounded-md bg-xp/15 px-1.5 py-0.5 font-ui text-[11px] font-bold text-xp">for you</span>}
							</span>
							<span className="block font-prose text-sm text-muted-foreground">{s.blurb}</span>
							{s.done > 0 && <span className="mt-1 block font-ui text-xs text-muted-foreground">{s.done === 1 ? "once before" : `${s.done} times before`}</span>}
						</button>
					))}
				</div>
				{!state && !error && (
					<p className="mt-6 flex items-center gap-2 font-ui text-sm text-muted-foreground">
						<LoaderCircleIcon className="size-4 animate-spin" /> Loading the scenes…
					</p>
				)}
				{state && (
					<p className="mt-6 font-ui text-xs text-muted-foreground">
						{state.stt ? `Voice: ${state.stt === "elevenlabs" ? "ElevenLabs" : "Deepgram"} speech-to-text, your recordings kept with the scene.` : "No speech-to-text key yet (ElevenLabs or Deepgram in Settings → Keys): lines are typed until then."}
					</p>
				)}
			</div>
		</TaskFrame>
	);
}

function EndScreen({ outcome, onAgain }: { outcome: Outcome; onAgain: () => void }) {
	const s = outcome.session;
	const counts = speakCounts(s.turns);
	const sum = s.summary;
	const praise = PRAISE[counts.learner % PRAISE.length]!;
	return (
		<div className={cn(COLUMN, "my-auto overflow-y-auto py-10")} data-testid="speak-end">
			<div className="flex items-center gap-4">
				<span className="flex size-16 items-center justify-center rounded-2xl bg-xp/15 text-xp">
					<MicIcon className="size-8" />
				</span>
				<div>
					<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Speak · {s.sceneTitle} · done</p>
					<h1 className="font-ui text-3xl font-black text-foreground">
						{praise} {counts.learner} {counts.learner === 1 ? "line" : "lines"} said
					</h1>
				</div>
			</div>
			<div className="mt-6 flex flex-wrap gap-6 font-ui text-sm">
				<Stat label="XP" value={`+${outcome.xp}`} ink="text-xp" />
				<Stat label="Prompts repaired" value={`${counts.repaired} of ${counts.prompts}`} ink="text-go" />
				<Stat label="In your deck" value={String(outcome.queued.length)} ink="text-sky" />
			</div>
			{sum?.note && <p className="mt-6 font-prose text-base text-foreground">{sum.note}</p>}
			{sum && sum.corrections.length > 0 ? (
				<div className="mt-8">
					<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Worth fixing</p>
					<ul className="mt-2 flex flex-col gap-2" data-testid="speak-corrections">
						{sum.corrections.map((c, i) => (
							<li key={i} className="rounded-xl border border-border bg-card px-4 py-3">
								<p className="font-ui text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{SLIP_LABEL[c.kind]}</p>
								<p className="mt-1 font-prose text-base text-muted-foreground line-through decoration-2" lang="sk">
									{c.yours}
								</p>
								<p className="flex items-start gap-2 font-prose text-xl text-foreground" lang="sk">
									<button type="button" onClick={() => void speak(c.right).catch(() => {})} aria-label="Play" className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-go-soft text-go hover:brightness-110">
										<Volume2Icon className="size-4" />
									</button>
									<span>{c.right}</span>
								</p>
								{c.rule && <p className="mt-1 font-prose text-sm text-muted-foreground">{c.rule}</p>}
							</li>
						))}
					</ul>
					{outcome.queued.length > 0 && <p className="mt-2 font-prose text-sm text-muted-foreground">The words behind them are in your review deck now.</p>}
				</div>
			) : (
				sum && (
					<p className="mt-6 rounded-xl bg-go-soft px-4 py-3 font-ui text-sm font-bold text-go" data-testid="speak-clean">
						Nothing to fix this time.
					</p>
				)
			)}
			{sum && sum.keep.length > 0 && (
				<div className="mt-8">
					<p className="font-ui text-xs font-bold tracking-wide text-muted-foreground">Worth keeping</p>
					<ul className="mt-2 flex flex-wrap gap-2">
						{sum.keep.map((k) => (
							<li key={k} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1 font-prose text-base" lang="sk">
								<span>{k}</span>
								<button type="button" onClick={() => void speak(k).catch(() => {})} aria-label="Play" className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
									<Volume2Icon className="size-3.5" />
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
			<div className="mt-10 flex flex-wrap gap-3">
				<Link href="/" className={PRIMARY} data-testid="speak-today">
					Today
				</Link>
				<button type="button" onClick={onAgain} className={SECONDARY} data-testid="speak-again">
					<RepeatIcon className="size-4" />
					Another scene
				</button>
				<span className="self-center font-ui text-xs text-muted-foreground">Enter goes to Today</span>
			</div>
		</div>
	);
}
