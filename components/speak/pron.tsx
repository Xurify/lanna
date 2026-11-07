"use client";

/**
 * Pronunciation on screen (LangHarness, 2026-10-28): the chip a spoken
 * line gets, and the "work on" block the end screens share (src/core/
 * pronounce.ts for the scores and the report).
 */

import { Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak, useActiveLanguage } from "@/components/speech";
import { PRON_CLEAR, PRON_GOOD, pronLabel, type PronReport, type PronScore } from "@/src/core";

export function pronInk(overall: number): string {
	return overall >= PRON_GOOD ? "text-teal-2" : overall >= PRON_CLEAR ? "text-teal-2" : "text-miss";
}

export function pronBg(overall: number): string {
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

/** The sounds and words that keep scoring low, with a play button on each word. */
export function PronWorkOn({ report, className }: { report: PronReport | undefined; className?: string }) {
	const lang = useActiveLanguage();
	if (!report || (report.sounds.length === 0 && report.words.length === 0)) return null;
	return (
		<div className={cn("mt-8", className)} data-testid="pron-workon">
			<p className="font-ui text-xs font-[600] tracking-wide text-muted-foreground">{report.sounds.length && report.words.length ? "Sounds and words to work on" : report.sounds.length ? "Sounds to work on" : "Words to work on"}</p>
			{report.sounds.length > 0 && (
				<ul className="mt-2 flex flex-wrap gap-2">
					{report.sounds.map((s) => (
						<li key={s.p} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1 font-prose text-base" title={`${s.score} on average over ${s.n} times${s.in.length ? ` · in ${s.in.join(", ")}` : ""}`}>
							<span className={cn("font-ui font-[600]", pronInk(s.score))} lang={lang?.code}>
								{s.p}
							</span>
							{s.in.length > 0 && <span className="font-ui text-xs text-muted-foreground">in {s.in.join(", ")}</span>}
						</li>
					))}
				</ul>
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
			<p className="mt-2 font-prose text-sm text-muted-foreground">From your spoken lines lately. Hear the word, say it slowly, then at speed.</p>
		</div>
	);
}
