"use client";

/**
 * High-Variability Phonetic Training (HVPT) Ear Gym (LangHarness, 2026-11).
 *
 * Implements 2AFC (Two-Alternative Forced Choice) auditory discrimination
 * based on Logan, Lively & Pisoni (1991), Bradlow et al. (1997), and Best (1995).
 * Overcomes equivalence classification through immediate feedback and
 * multi-talker auditory drills.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon, EarIcon, HeadphonesIcon, RotateCcwIcon, Volume2Icon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak } from "@/components/speech";
import {
	createEarGymExercise,
	getPamContrastPriority,
	getPhonologyPairs,
	type EarGymExercise,
	type PhonologyFamily,
} from "@/src/core";
import { RhythmicVisualizer } from "./rhythmic-visualizer";

const FAMILIES: Array<{ id: PhonologyFamily | "all"; label: string; sub: string }> = [
	{ id: "all", label: "All Contrasts", sub: "Mixed pool" },
	{ id: "vowel_length", label: "Vowel Length", sub: "pas vs pás" },
	{ id: "palatals", label: "Palatals", sub: "plat vs plať" },
	{ id: "syllabic_liquids", label: "Syllabic Liquids", sub: "vrch vs vŕba" },
	{ id: "diphthongs", label: "Diphthongs", sub: "stôl vs stola" },
	{ id: "voicing", label: "Voicing", sub: "dub vs dup" },
];

export function EarGym() {
	const [tab, setTab] = useState<"pairs" | "rhythm">("pairs");
	const [activeFamily, setActiveFamily] = useState<PhonologyFamily | "all">("all");
	const [seed, setSeed] = useState(0);
	const [selectedWord, setSelectedWord] = useState<string | null>(null);
	const [stats, setStats] = useState({ correct: 0, total: 0 });
	const [earFirst, setEarFirst] = useState(true);
	const [revealed, setRevealed] = useState(false);
	const [playingAudio, setPlayingAudio] = useState(false);

	// Filtered pool of minimal pairs
	const pairs = useMemo(() => {
		return getPhonologyPairs(activeFamily === "all" ? {} : { family: activeFamily });
	}, [activeFamily]);

	// Current exercise
	const currentPair = pairs[seed % pairs.length];
	const exercise: EarGymExercise | null = useMemo(() => {
		if (!currentPair) return null;
		return createEarGymExercise(currentPair, seed);
	}, [currentPair, seed]);

	// Play target audio
	const playTarget = useCallback(async () => {
		if (!exercise) return;
		setPlayingAudio(true);
		try {
			await speak(exercise.targetWord);
		} finally {
			setPlayingAudio(false);
		}
	}, [exercise]);

	// Play target on fresh exercise mount
	useEffect(() => {
		setSelectedWord(null);
		setRevealed(false);
		void playTarget();
	}, [seed, activeFamily, playTarget]);

	if (!exercise) {
		return (
			<div className="mx-auto max-w-xl py-12 text-center">
				<p className="text-muted-foreground">No minimal pairs found for this contrast.</p>
			</div>
		);
	}

	const hasAnswered = selectedWord !== null;
	const isCorrectAnswer = selectedWord === exercise.targetWord;
	const pam = getPamContrastPriority(exercise.family, ["en"]);

	const handleSelect = (word: string) => {
		if (hasAnswered) return;
		setSelectedWord(word);
		setRevealed(true);
		const correct = word === exercise.targetWord;
		setStats((s) => ({
			correct: s.correct + (correct ? 1 : 0),
			total: s.total + 1,
		}));
	};

	const handleNext = () => {
		setSeed((s) => s + 1);
	};

	return (
		<div className="mx-auto max-w-2xl px-4 py-8" data-testid="ear-gym">
			{/* Top Bar / Breadcrumb */}
			<div className="mb-6 flex items-center justify-between border-b border-border pb-4">
				<div>
					<div className="flex items-center gap-2">
						<HeadphonesIcon className="size-5 text-teal-600 dark:text-teal-400" />
						<h1 className="font-ui text-xl font-[700] tracking-tight">Ear Gym · Minimal Pairs</h1>
					</div>
					<p className="font-prose text-xs text-muted-foreground">
						High-Variability Phonetic Training (HVPT) to tune your auditory perception
					</p>
				</div>
				<div className="flex items-center gap-3">
					{stats.total > 0 && (
						<div className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-mono font-[600] tabular-nums">
							{stats.correct}/{stats.total} ({Math.round((stats.correct / stats.total) * 100)}%)
						</div>
					)}
					<Link
						href="/"
						className="rounded-md px-2.5 py-1 text-xs font-ui text-muted-foreground hover:bg-accent hover:text-foreground"
					>
						Done
					</Link>
				</div>
			</div>

			{/* Mode Selector */}
			<div className="mb-6 flex gap-2 border-b border-border pb-3">
				<button
					type="button"
					onClick={() => setTab("pairs")}
					className={cn(
						"flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-ui text-xs font-[600] transition-colors",
						tab === "pairs"
							? "bg-foreground text-background shadow-sm"
							: "text-muted-foreground hover:bg-muted hover:text-foreground",
					)}
				>
					<HeadphonesIcon className="size-3.5" />
					<span>Minimal-Pair Ear Gym</span>
				</button>
				<button
					type="button"
					onClick={() => setTab("rhythm")}
					className={cn(
						"flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-ui text-xs font-[600] transition-colors",
						tab === "rhythm"
							? "bg-foreground text-background shadow-sm"
							: "text-muted-foreground hover:bg-muted hover:text-foreground",
					)}
				>
					<EarIcon className="size-3.5" />
					<span>Rhythmic Law & Cadence</span>
				</button>
			</div>

			{tab === "rhythm" ? (
				<RhythmicVisualizer />
			) : (
				<>
					{/* Contrast Family Selector */}
					<div className="mb-6 flex flex-wrap gap-1.5">
						{FAMILIES.map((f) => (
							<button
								key={f.id}
								type="button"
								onClick={() => {
									setActiveFamily(f.id);
									setSeed(0);
								}}
								className={cn(
									"rounded-full px-3 py-1 font-ui text-xs font-[500] transition-colors",
									activeFamily === f.id
										? "bg-foreground text-background"
										: "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
								)}
							>
								{f.label}
							</button>
						))}
					</div>

			{/* Ear-First Mode Toggle */}
			<div className="mb-6 flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
				<div className="flex items-center gap-2">
					<EarIcon className="size-4 text-muted-foreground" />
					<span className="font-ui font-[500]">Ear-First Masking</span>
					<span className="text-muted-foreground">(prevents reading English spelling habits)</span>
				</div>
				<button
					type="button"
					onClick={() => setEarFirst(!earFirst)}
					className={cn(
						"rounded px-2 py-0.5 font-mono text-[11px] font-[600] transition-colors",
						earFirst ? "bg-teal-600 text-white" : "bg-muted text-muted-foreground",
					)}
				>
					{earFirst ? "ON" : "OFF"}
				</button>
			</div>

			{/* Main Drill Card */}
			<div className="rounded-xl border border-border bg-card p-6 shadow-sm">
				{/* Audio Prompt Button */}
				<div className="flex flex-col items-center justify-center py-6 text-center">
					<button
						type="button"
						onClick={() => void playTarget()}
						disabled={playingAudio}
						aria-label="Play sound"
						className={cn(
							"relative flex size-20 items-center justify-center rounded-full bg-teal-600 text-white shadow-md transition-transform active:scale-95 hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-500/20",
							playingAudio && "animate-pulse",
						)}
					>
						<Volume2Icon className="size-8" />
					</button>
					<p className="mt-3 font-ui text-xs font-[600] text-muted-foreground">
						{playingAudio ? "Listening..." : "Tap to listen again"}
					</p>
					<div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
						<span>Contrast:</span>
						<strong className="text-foreground font-medium">{exercise.contrast}</strong>
						{exercise.functionalLoad === "high" && (
							<span className="rounded bg-rose-500/10 px-1 font-[600] text-rose-600 dark:text-rose-400">
								High Impact
							</span>
						)}
					</div>
				</div>

				{/* 2AFC Choices */}
				<div className="mt-4 grid grid-cols-2 gap-4">
					{exercise.options.map((opt, i) => {
						const isSelected = selectedWord === opt.word;
						const isTarget = opt.word === exercise.targetWord;
						const isMasked = earFirst && !revealed && !hasAnswered;

						return (
							<button
								key={opt.word}
								type="button"
								onClick={() => handleSelect(opt.word)}
								disabled={hasAnswered}
								className={cn(
									"group flex flex-col items-center justify-center rounded-xl border-2 p-5 text-center transition-all",
									!hasAnswered && "border-border hover:border-teal-500/50 hover:bg-muted/40",
									hasAnswered && isTarget && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
									hasAnswered && isSelected && !isTarget && "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20",
									hasAnswered && !isSelected && !isTarget && "border-border/40 opacity-50",
								)}
							>
								<div className="font-ui text-xs font-[600] text-muted-foreground">
									Option {i === 0 ? "A" : "B"}
								</div>
								<div className="mt-1 font-prose text-2xl font-[700] text-foreground">
									{isMasked ? "???" : opt.word}
								</div>
								<div className="mt-1 font-prose text-xs text-muted-foreground">
									{isMasked ? "Choose what you heard" : opt.meaning}
								</div>
							</button>
						);
					})}
				</div>

				{/* Feedback & Articulatory Explanation */}
				{hasAnswered && (
					<div className="mt-6 rounded-lg border border-border bg-muted/40 p-4 animate-in fade-in">
						<div className="flex items-start gap-3">
							{isCorrectAnswer ? (
								<CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-600" />
							) : (
								<XCircleIcon className="mt-0.5 size-5 shrink-0 text-rose-600" />
							)}
							<div className="flex-1">
								<p className="font-ui text-sm font-[600]">
									{isCorrectAnswer ? (
										<span className="text-emerald-700 dark:text-emerald-400">
											Correct! You heard {exercise.targetWord} [{exercise.targetIpa}].
										</span>
									) : (
										<span className="text-rose-700 dark:text-rose-400">
											Not quite. That was {exercise.targetWord} [{exercise.targetIpa}].
										</span>
									)}
								</p>
								<p className="mt-1 font-prose text-xs text-muted-foreground">{exercise.cue}</p>

								{/* Side-by-Side Comparison Audio */}
								<div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
									<span className="text-xs text-muted-foreground">Compare:</span>
									<button
										type="button"
										onClick={() => void speak(exercise.targetWord)}
										className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-xs font-[500] hover:bg-accent"
									>
										<Volume2Icon className="size-3 text-teal-600" />
										{exercise.targetWord} [{exercise.targetIpa}]
									</button>
									<button
										type="button"
										onClick={() => void speak(exercise.distractorWord)}
										className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-xs font-[500] hover:bg-accent"
									>
										<Volume2Icon className="size-3 text-muted-foreground" />
										{exercise.distractorWord} [{exercise.distractorIpa}]
									</button>
								</div>
							</div>
						</div>

						{/* Next Exercise Button */}
						<div className="mt-4 flex justify-end">
							<button
								type="button"
								onClick={handleNext}
								className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 font-ui text-xs font-[600] text-white hover:bg-teal-700"
							>
								<span>Next Contrast</span>
								<ArrowRightIcon className="size-3.5" />
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Pedagogy Note */}
			<div className="mt-6 rounded-lg border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
				<p className="font-ui font-[600] text-foreground">Why Minimal Pairs Work</p>
				<p className="mt-1 font-prose">
					{pam.rationale} High-Variability Phonetic Training forces your brain to carve out new perceptual boundaries rather than assimilating foreign sounds into your native language habits.
				</p>
			</div>
			</>
			)}
		</div>
	);
}
