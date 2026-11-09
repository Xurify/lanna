"use client";

/**
 * Pronunciation on screen (LangHarness, 2026-10-28): the chip a spoken
 * line gets, and the "work on" block the end screens share (src/core/
 * pronounce.ts for the scores and the report).
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronUpIcon, HeadphonesIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak, useActiveLanguage } from "@/components/speech";
import { PRON_CLEAR, PRON_GOOD, getArticulatoryCue, pronLabel, type PronReport, type PronScore } from "@/src/core";

function pronInk(overall: number): string {
	return overall >= PRON_GOOD ? "text-teal-2" : overall >= PRON_CLEAR ? "text-teal-2" : "text-miss";
}

function pronBg(overall: number): string {
	return overall >= PRON_GOOD ? "bg-teal-wash text-teal-2" : overall >= PRON_CLEAR ? "bg-teal-wash text-foreground" : "bg-miss-soft text-miss";
}

/** "Clear · 92" with the weak words in the title. */
export function PronChip({ score, big = false }: { score: PronScore; big?: boolean }) {
	const weak = score.words.filter((w) => w.error === "omission" || w.error === "mispronunciation" || w.score < 60);
	const title = [
		`${score.engine === "azure" ? "Scored sound by sound" : "From what speech-to-text could make out"}: accuracy ${score.accuracy}`,
		score.fluency !== undefined ? `fluency ${score.fluency}` : "",
		score.prosody !== undefined ? `prosody ${score.prosody}` : "",
		weak.length ? `weak: ${weak.map((w) => w.word).join(", ")}` : "",
	]
		.filter(Boolean)
		.join(" · ");
	return (
		<span className={cn("inline-flex items-center gap-1 rounded-md font-ui font-[600] tabular-nums", big ? "px-2 py-0.5 text-sm" : "px-1.5 py-px text-xs", pronBg(score.overall))} title={title} data-testid="pron-chip">
			{pronLabel(score.overall)} · {score.overall}
		</span>
	);
}

/** The sounds and words that keep scoring low, with articulatory diagnostics and drill links. */
export function PronWorkOn({ report, className }: { report: PronReport | undefined; className?: string }) {
	const lang = useActiveLanguage();
	const [activeSound, setActiveSound] = useState<string | null>(null);

	if (!report || (report.sounds.length === 0 && report.words.length === 0)) return null;

	const selectedCue = activeSound ? getArticulatoryCue(activeSound) : null;

	return (
		<div className={cn("mt-8", className)} data-testid="pron-workon">
			<div className="flex items-center justify-between">
				<p className="font-ui text-xs font-[600] tracking-wide text-muted-foreground">
					{report.sounds.length && report.words.length
						? "Sounds and words to work on"
						: report.sounds.length
							? "Sounds to work on"
							: "Words to work on"}
				</p>
				<Link
					href="/phonology"
					className="inline-flex items-center gap-1 text-xs font-ui text-teal-600 hover:text-teal-700 dark:text-teal-400"
				>
					<HeadphonesIcon className="size-3" />
					<span>Train in Ear Gym</span>
				</Link>
			</div>

			{report.sounds.length > 0 && (
				<div className="mt-2 space-y-2">
					<ul className="flex flex-wrap gap-2">
						{report.sounds.map((s) => {
							const cue = getArticulatoryCue(s.p);
							const isExpanded = activeSound === s.p;
							const isHighFl = s.functionalLoad === "high" || cue?.functionalLoad === "high";

							return (
								<li key={s.p}>
									<button
										type="button"
										onClick={() => setActiveSound(isExpanded ? null : s.p)}
										className={cn(
											"flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-prose text-base transition-colors",
											isExpanded
												? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/20"
												: "border-border bg-card hover:bg-accent",
										)}
										title={`${s.score} average over ${s.n} times${s.in.length ? ` · in ${s.in.join(", ")}` : ""}${cue ? ` · ${cue.motor}` : ""}`}
									>
										<span className={cn("font-ui font-[600]", pronInk(s.score))} lang={lang?.code}>
											{s.p}
										</span>
										{isHighFl && (
											<span className="rounded bg-rose-500/10 px-1 py-px text-[10px] font-ui font-[700] text-rose-600 dark:text-rose-400" title="High functional load: alters word meaning">
												key
											</span>
										)}
										{s.in.length > 0 && (
											<span className="font-ui text-xs text-muted-foreground">in {s.in.join(", ")}</span>
										)}
										{isExpanded ? (
											<ChevronUpIcon className="size-3 text-muted-foreground" />
										) : (
											<ChevronDownIcon className="size-3 text-muted-foreground" />
										)}
									</button>
								</li>
							);
						})}
					</ul>

					{/* Articulatory Diagnostic Guide Card */}
					{activeSound && selectedCue && (
						<div className="rounded-lg border border-border bg-muted/40 p-3.5 text-xs animate-in fade-in">
							<div className="flex items-start justify-between gap-2">
								<div>
									<div className="flex items-center gap-2">
										<span className="font-ui font-[700] text-sm text-foreground">
											Sound: {selectedCue.symbol} [{selectedCue.ipa}]
										</span>
										<span className="text-muted-foreground font-[500]">
											{selectedCue.name}
										</span>
										{selectedCue.functionalLoad === "high" && (
											<span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-ui font-[600] text-rose-600 dark:text-rose-400">
												Meaning Critical
											</span>
										)}
									</div>
									<p className="mt-1 font-prose text-foreground/90">
										<strong>Articulatory cue:</strong> {selectedCue.motor}
									</p>
									{selectedCue.commonPitfall && (
										<p className="mt-1 font-prose text-muted-foreground">
											<strong>Watch out:</strong> {selectedCue.commonPitfall}
										</p>
									)}
								</div>
								<button
									type="button"
									onClick={() => void speak(selectedCue.drillWord).catch(() => {})}
									className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 font-ui font-[500] hover:bg-accent"
								>
									<Volume2Icon className="size-3.5 text-teal-600" />
									<span>Hear &apos;{selectedCue.drillWord}&apos;</span>
								</button>
							</div>
						</div>
					)}
				</div>
			)}

			{report.words.length > 0 && (
				<ul className="mt-2 flex flex-wrap gap-2">
					{report.words.map((w) => (
						<li key={w.word} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1 font-prose text-base" lang={lang?.code} title={`${w.score} on average over ${w.n} ${w.n === 1 ? "time" : "times"}`}>
							<span className={pronInk(w.score)}>{w.word}</span>
							<button type="button" onClick={() => void speak(w.word).catch(() => {})} aria-label={`Play ${w.word}`} className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
								<Volume2Icon className="size-3.5" />
							</button>
						</li>
					))}
				</ul>
			)}
			<p className="mt-2 font-prose text-sm text-muted-foreground">
				From your spoken lines lately. Tap a sound to see tongue placement and hear clean model words.
			</p>
		</div>
	);
}
