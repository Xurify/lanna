"use client";

/**
 * Guided Self-Talk Player (LangHarness, 2026-11-12)
 *
 * Solo speaking practice following Dr. Lýdia Machová's Language Mentoring
 * methodology. Zero-judgment out-loud speaking with scaffolding starters,
 * active timing toward the Speaking strand (P9 & P2), and vocabulary recognition.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	CheckCircleIcon,
	ChevronRightIcon,
	LoaderCircleIcon,
	MicIcon,
	RotateCcwIcon,
	SparklesIcon,
	SquareIcon,
	Volume2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	COLUMN,
	PRIMARY,
	SECONDARY,
	Stat,
	Stats,
	TaskFrame,
	TaskTop,
	Centered,
} from "@/components/task-frame";
import { speak, useActiveLanguage } from "@/components/speech";
import { Recorder, micSupported, transcribeClip } from "@/components/speak/recorder";
import {
	SELF_TALK_CATEGORIES,
	SELF_TALK_PROMPTS,
	getSelfTalkPrompts,
	type SelfTalkCategory,
	type SelfTalkPrompt,
	type UsefulChunk,
} from "@/src/core";
import { readOrigin } from "@/components/origin";

type Phase = "select" | "speaking" | "review" | "done";

export function SelfTalkPlayer({ initialPromptId }: { initialPromptId?: string | null }) {
	const lang = useActiveLanguage();
	const router = useRouter();

	const [phase, setPhase] = useState<Phase>("select");
	const [category, setCategory] = useState<SelfTalkCategory | "all">("all");
	const [activePrompt, setActivePrompt] = useState<SelfTalkPrompt>(() => {
		if (initialPromptId) {
			const found = SELF_TALK_PROMPTS.find((p) => p.id === initialPromptId);
			if (found) return found;
		}
		return SELF_TALK_PROMPTS[0]!;
	});

	const [isRecording, setIsRecording] = useState(false);
	const [level, setLevel] = useState(0);
	const [elapsedSec, setElapsedSec] = useState(0);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [transcript, setTranscript] = useState("");
	const [manualText, setManualText] = useState("");
	const [usedWords, setUsedWords] = useState<UsefulChunk[]>([]);
	const [xpEarned, setXpEarned] = useState(0);
	const [metTarget, setMetTarget] = useState(false);

	const recorder = useRef<Recorder | null>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const toggleRef = useRef<() => void>(() => {});

	// Clear timer on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			recorder.current?.cancel();
		};
	}, []);

	const filteredPrompts = getSelfTalkPrompts(category === "all" ? undefined : { category });

	const finishSpeaking = useCallback(
		async (seconds: number, wavBlob?: Blob) => {
			if (timerRef.current) {
				clearInterval(timerRef.current);
				timerRef.current = null;
			}
			setIsRecording(false);
			setLevel(0);
			setProcessing(true);
			setError(null);

			let finalTranscript = manualText.trim();
			if (wavBlob) {
				try {
					const text = await transcribeClip(wavBlob, lang?.tag ?? "sk-SK");
					if (text) {
						finalTranscript = text;
						setTranscript(text);
					}
				} catch {
					// STT engine optional/unconfigured; fallback gracefully
				}
			}

			try {
				const res = await fetch("/api/speak/self-talk", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						promptId: activePrompt.id,
						activeSec: seconds,
						transcript: finalTranscript,
						tz: new Date().getTimezoneOffset(),
					}),
				});

				if (!res.ok) {
					const data = (await res.json().catch(() => ({}))) as { message?: string };
					throw new Error(data.message ?? `HTTP ${res.status}`);
				}

				const outcome = (await res.json()) as {
					xp: number;
					metTarget: boolean;
					usedWords: UsefulChunk[];
				};

				setXpEarned(outcome.xp);
				setMetTarget(outcome.metTarget);
				setUsedWords(outcome.usedWords ?? []);
				setPhase("done");
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
				setPhase("review");
			} finally {
				setProcessing(false);
			}
		},
		[activePrompt.id, lang?.tag, manualText],
	);

	const toggleRecording = useCallback(async () => {
		if (isRecording) {
			const sec = elapsedSec;
			if (recorder.current) {
				try {
					const rec = await recorder.current.stop();
					recorder.current = null;
					await finishSpeaking(sec, rec.wav);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
					setIsRecording(false);
				}
			} else {
				await finishSpeaking(sec);
			}
			return;
		}

		setError(null);
		setElapsedSec(0);
		setTranscript("");

		if (!micSupported()) {
			setError("Microphone is not supported in this browser. You can practice speaking aloud and use manual input.");
			setPhase("speaking");
			setIsRecording(true);
			timerRef.current = setInterval(() => {
				setElapsedSec((s) => s + 1);
			}, 1000);
			return;
		}

		const rec = new Recorder();
		recorder.current = rec;

		try {
			await rec.start({
				onLevel: setLevel,
				maxMs: 180_000,
				onAutoStop: () => void toggleRef.current(),
			});
			setIsRecording(true);
			setPhase("speaking");

			timerRef.current = setInterval(() => {
				setElapsedSec((s) => s + 1);
			}, 1000);
		} catch {
			recorder.current = null;
			setError("Microphone permission denied. Speak aloud and press stop when done, or enter notes below.");
			setIsRecording(true);
			setPhase("speaking");
			timerRef.current = setInterval(() => {
				setElapsedSec((s) => s + 1);
			}, 1000);
		}
	}, [isRecording, elapsedSec, finishSpeaking]);

	toggleRef.current = toggleRecording;

	// Keyboard controls: Space to toggle mic, Escape to back out
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
			if (e.key === "Escape") {
				if (isRecording) {
					recorder.current?.cancel();
					recorder.current = null;
					if (timerRef.current) clearInterval(timerRef.current);
					setIsRecording(false);
					setPhase("select");
				} else if (phase === "speaking" || phase === "review") {
					setPhase("select");
				} else {
					router.push("/speak");
				}
			} else if (e.key === " " && (phase === "select" || phase === "speaking")) {
				e.preventDefault();
				void toggleRecording();
			} else if (e.key === "Enter" && phase === "done") {
				e.preventDefault();
				router.push("/speak");
			}
		};

		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [phase, isRecording, toggleRecording, router]);

	if (processing) {
		return (
			<TaskFrame>
				<Centered testId="self-talk-processing">
					<div className="flex flex-col items-center gap-3">
						<LoaderCircleIcon className="size-8 animate-spin text-teal" />
						<p className="font-ui text-base font-[550] text-foreground">Analyzing speech and logging active time…</p>
						<p className="font-prose text-sm text-ink-3">Counting seconds toward the Speaking strand.</p>
					</div>
				</Centered>
			</TaskFrame>
		);
	}

	if (phase === "done") {
		return (
			<TaskFrame>
				<Centered testId="self-talk-done">
					<div className={cn(COLUMN, "flex flex-col items-center text-center")}>
						<div className="flex size-14 items-center justify-center rounded-full bg-teal-wash text-teal-2">
							<CheckCircleIcon className="size-8" />
						</div>

						<h2 className="mt-4 font-ui text-2xl font-bold tracking-tight text-foreground">
							{metTarget ? "Great Self-Talk Session!" : "Session Recorded"}
						</h2>
						<p className="mt-1 font-prose text-base text-ink-2">
							{elapsedSec} seconds of active speaking added to your Speaking strand.
						</p>

						<Stats className="mt-6 w-full max-w-sm">
							<Stat label="XP Earned" value={`+${xpEarned}`} ink="text-teal-2" />
							<Stat label="Active Time" value={`${elapsedSec}s`} ink="text-foreground" />
							<Stat
								label="Target Met"
								value={metTarget ? "Yes" : "Partial"}
								ink={metTarget ? "text-teal-2" : "text-ink-3"}
							/>
						</Stats>

						{usedWords.length > 0 && (
							<div className="mt-6 w-full max-w-md rounded-xl bg-well p-4 text-left">
								<p className="font-ui text-xs font-[600] uppercase tracking-wider text-teal-2">
									Vocabulary Retrieved ({usedWords.length})
								</p>
								<div className="mt-2 flex flex-wrap gap-2">
									{usedWords.map((w) => (
										<span
											key={w.sk}
											className="inline-flex items-center gap-1.5 rounded-lg border border-teal-line bg-teal-wash px-2.5 py-1 font-prose text-sm font-[550] text-teal-2"
										>
											{w.sk}
											<span className="font-ui text-xs text-ink-3 font-normal">({w.en})</span>
										</span>
									))}
								</div>
							</div>
						)}

						{transcript && (
							<div className="mt-4 w-full max-w-md rounded-xl border border-border bg-card p-4 text-left">
								<p className="font-ui text-xs font-[600] uppercase tracking-wider text-ink-3">
									Transcript (Speech-to-Text)
								</p>
								<p className="mt-1 font-prose text-sm text-foreground">{transcript}</p>
							</div>
						)}

						<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
							<button
								type="button"
								onClick={() => {
									setPhase("select");
									setElapsedSec(0);
									setTranscript("");
									setUsedWords([]);
								}}
								className={SECONDARY}
							>
								<RotateCcwIcon className="size-4" />
								Practice another prompt
							</button>

							<Link href="/speak" className={PRIMARY}>
								Return to Speak
							</Link>
						</div>
					</div>
				</Centered>
			</TaskFrame>
		);
	}

	const progressRatio = Math.min(1, elapsedSec / activePrompt.targetSec);

	return (
		<TaskFrame strip={false}>
			<TaskTop
				progress={phase === "speaking" ? progressRatio : 0}
				label={phase === "speaking" ? `${elapsedSec}s of ${activePrompt.targetSec}s target` : "Guided Self-Talk"}
				count={activePrompt.level}
				ink="bg-teal"
				onLeave={() => {
					recorder.current?.cancel();
					router.push(readOrigin() || "/speak");
				}}
			/>

			<div className="flex flex-1 flex-col overflow-y-auto pb-8 pt-4">
				<div className={cn(COLUMN, "flex flex-col gap-6")}>
					{/* Header bar with link to Dr. Machová methodology */}
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
						<div>
							<div className="flex items-center gap-2">
								<span className="rounded-md bg-teal-wash px-2 py-0.5 font-ui text-xs font-[600] text-teal-2">
									Solo Output
								</span>
								<p className="font-ui text-xs font-[550] text-ink-3">
									Dr. Lýdia Machová&apos;s Self-Talk Technique
								</p>
							</div>
							<h1 className="mt-1 font-ui text-2xl font-bold tracking-tight text-foreground">
								Guided Self-Talk
							</h1>
						</div>

						<Link
							href="/methodologies#machova"
							className="inline-flex items-center gap-1 font-ui text-xs font-[550] text-teal-2 hover:underline"
						>
							About this method
							<ChevronRightIcon className="size-3" />
						</Link>
					</div>

					{/* Category chips */}
					{phase === "select" && (
						<div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Categories">
							<button
								type="button"
								onClick={() => setCategory("all")}
								className={cn(
									"rounded-lg px-3 py-1 font-ui text-xs font-[550] transition-colors",
									category === "all" ? "bg-foreground text-background" : "bg-well text-ink-2 hover:bg-well-2",
								)}
							>
								All Prompts ({SELF_TALK_PROMPTS.length})
							</button>
							{SELF_TALK_CATEGORIES.map((cat) => (
								<button
									key={cat.id}
									type="button"
									onClick={() => setCategory(cat.id)}
									className={cn(
										"rounded-lg px-3 py-1 font-ui text-xs font-[550] transition-colors",
										category === cat.id ? "bg-foreground text-background" : "bg-well text-ink-2 hover:bg-well-2",
									)}
								>
									{cat.label}
								</button>
							))}
						</div>
					)}

					{/* Active prompt card */}
					<div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex items-start gap-3">
								<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-well text-2xl" aria-hidden="true">
									{activePrompt.sceneEmoji ?? "💬"}
								</span>
								<div>
									<div className="flex items-center gap-2">
										<span className="rounded bg-well-2 px-1.5 py-0.2 font-ui text-xs font-[600] text-ink-2">
											{activePrompt.level}
										</span>
										<span className="font-ui text-xs text-ink-3">Target: {activePrompt.targetSec}s out loud</span>
									</div>
									<h2 className="mt-0.5 font-prose text-2xl font-bold text-foreground" lang={lang?.code}>
										{activePrompt.title}
									</h2>
									<p className="font-prose text-sm text-ink-3">{activePrompt.titleEn}</p>
								</div>
							</div>

							{phase === "select" && (
								<select
									aria-label="Change prompt"
									value={activePrompt.id}
									onChange={(e) => {
										const p = SELF_TALK_PROMPTS.find((item) => item.id === e.target.value);
										if (p) setActivePrompt(p);
									}}
									className="w-full sm:w-auto rounded-lg border border-border bg-well px-2.5 py-1.5 font-ui text-xs font-[550] text-foreground outline-none"
								>
									{filteredPrompts.map((p) => (
										<option key={p.id} value={p.id}>
											[{p.level}] {p.title}
										</option>
									))}
								</select>
							)}
						</div>


						<div className="mt-5 rounded-xl bg-well p-4">
							<p className="font-prose text-lg font-[550] text-foreground" lang={lang?.code}>
								{activePrompt.prompt}
							</p>
							<p className="mt-1 font-prose text-sm text-ink-3">{activePrompt.promptEn}</p>
						</div>

						{/* Useful Chunks / Starters */}
						<div className="mt-5">
							<p className="font-ui text-xs font-[600] uppercase tracking-wider text-ink-3">
								Sentence Starters (Užitočné frázy)
							</p>
							<div className="mt-2 grid gap-2 sm:grid-cols-2">
								{activePrompt.starters.map((starter) => (
									<div
										key={starter.sk}
										className="flex items-start justify-between gap-2 rounded-xl border border-border bg-background p-3"
									>
										<div>
											<p className="font-prose text-base font-[550] text-foreground" lang={lang?.code}>
												{starter.sk}
											</p>
											<p className="font-prose text-xs text-ink-3">{starter.en}</p>
										</div>
										<button
											type="button"
											onClick={() => void speak(starter.sk.replace(/…/g, "")).catch(() => {})}
											aria-label={`Listen to ${starter.sk}`}
											className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-well hover:text-foreground"
										>
											<Volume2Icon className="size-3.5" />
										</button>
									</div>
								))}
							</div>
						</div>

						{/* Suggested vocabulary */}
						<div className="mt-5">
							<p className="font-ui text-xs font-[600] uppercase tracking-wider text-ink-3">
								Vocabulary Ideas
							</p>
							<div className="mt-2 flex flex-wrap gap-1.5">
								{activePrompt.suggestedWords.map((word) => (
									<button
										key={word.sk}
										type="button"
										onClick={() => void speak(word.sk).catch(() => {})}
										className="inline-flex items-center gap-1 rounded-lg border border-border bg-well px-2.5 py-1 font-prose text-sm text-foreground transition-colors hover:bg-well-2"
										title={`${word.en} — tap to listen`}
									>
										<span>{word.sk}</span>
										<span className="font-ui text-xs text-ink-3">({word.en})</span>
									</button>
								))}
							</div>
						</div>
					</div>

					{error && (
						<p className="rounded-xl bg-miss-soft px-4 py-2 font-ui text-sm text-miss" role="alert">
							{error}
						</p>
					)}
				</div>
			</div>

			{/* Bottom Bar: Mic Controls & Timer */}
			<div className={cn("border-t border-border bg-card py-4 transition-colors", isRecording && "bg-teal-wash")}>
				<div className={cn(COLUMN, "flex flex-col items-center gap-4 sm:flex-row sm:justify-between")}>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => void toggleRecording()}
							className={cn(
								"flex size-14 items-center justify-center rounded-full transition-transform active:scale-95",
								isRecording
									? "bg-miss text-white shadow-lg animate-pulse"
									: "bg-teal text-white hover:bg-teal-2 shadow-md",
							)}
							aria-label={isRecording ? "Stop recording" : "Start speaking"}
						>
							{isRecording ? <SquareIcon className="size-6" /> : <MicIcon className="size-6" />}
						</button>

						<div>
							<div className="flex items-center gap-2">
								<span className="font-ui text-base font-bold text-foreground">
									{isRecording ? "Speaking Out Loud" : "Ready to Speak"}
								</span>
								<span className="font-ui text-xs text-ink-3">(Press Space)</span>
							</div>
							<p className="font-prose text-xs text-ink-2">
								{isRecording
									? `${elapsedSec}s elapsed — target ${activePrompt.targetSec}s`
									: "Speak continuously in Slovak without pausing to translate."}
							</p>
						</div>
					</div>

					{/* Audio Level Visualizer */}
					{isRecording && (
						<div className="flex items-center gap-2">
							<div className="flex h-5 items-center gap-0.5" aria-label="Microphone level">
								{Array.from({ length: 16 }, (_, i) => {
									const lit = Math.round(level * 16);
									return (
										<span
											key={i}
											className={cn("w-1 rounded-sm transition-[height] duration-75", i < lit ? "bg-teal" : "bg-accent")}
											style={{ height: `${4 + (i < lit ? 12 * Math.min(1, (i + 1) / 16 + 0.3) : 0)}px` }}
										/>
									);
								})}
							</div>
							<span className="font-ui text-xs font-semibold text-teal-2">{elapsedSec}s</span>
						</div>
					)}

					{/* Manual Notes / Typing Toggle */}
					{!isRecording && (
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => {
									const next = (SELF_TALK_PROMPTS.indexOf(activePrompt) + 1) % SELF_TALK_PROMPTS.length;
									setActivePrompt(SELF_TALK_PROMPTS[next] ?? SELF_TALK_PROMPTS[0]!);
								}}
								className={SECONDARY}
							>
								Next Prompt
							</button>
						</div>
					)}

				</div>
			</div>
		</TaskFrame>
	);
}
