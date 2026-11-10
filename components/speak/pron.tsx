"use client";

/**
 * Pronunciation on screen (LangHarness, 2026-10-28): the chip a spoken
 * line gets, and the "work on" block the end screens share (src/core/
 * pronounce.ts for the scores and the report).
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, Volume2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { speak, useActiveLanguage } from "@/components/speech";
import { PRON_CLEAR, PRON_GOOD, getArticulatoryCue, getPhonologyData, pronLabel, type PronReport, type PronScore } from "@/src/core";

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

	const selectedCue = activeSound ? getArticulatoryCue(activeSound, lang?.id) : null;

	return (
		<div className={cn("mt-8", className)} data-testid="pron-workon">
			<div className="flex items-baseline justify-between gap-4">
				<p className="font-ui text-xs font-[600] tracking-wide text-muted-foreground">
					{report.sounds.length && report.words.length
						? "Sounds and words to work on"
						: report.sounds.length
							? "Sounds to work on"
							: "Words to work on"}
				</p>
				{getPhonologyData(lang?.id) && (
					<Link href="/phonology" className="shrink-0 font-ui text-[13px] font-[550] text-ink-3 underline decoration-[var(--q-line-2)] underline-offset-[3px] hover:text-ink-2 pointer-coarse:py-3">
						Train in the ear gym
					</Link>
				)}
			</div>

			{report.sounds.length > 0 && (
				<div className="mt-2">
					<ul className="flex flex-wrap gap-2">
						{report.sounds.map((s) => {
							const cue = getArticulatoryCue(s.p, lang?.id);
							const isExpanded = activeSound === s.p;
							const changesMeaning = s.functionalLoad === "high" || cue?.functionalLoad === "high";
							const title = `${s.score} on average over ${s.n} ${s.n === 1 ? "time" : "times"}${s.in.length ? ` · in ${s.in.join(", ")}` : ""}`;
							const chip = (
								<>
									<span className={cn("font-ui font-[600]", pronInk(s.score))} lang={lang?.code}>
										{s.p}
									</span>
									{changesMeaning && (
										<span className="q-pill grey" title="Mixing this sound up can change what a word means">
											key
										</span>
									)}
									{s.in.length > 0 && <span className="font-ui text-xs text-muted-foreground">in {s.in.join(", ")}</span>}
								</>
							);

							return (
								<li key={s.p}>
									{cue ? (
										<button
											type="button"
											onClick={() => setActiveSound(isExpanded ? null : s.p)}
											aria-expanded={isExpanded}
											title={title}
											className={cn("lh-press flex items-center gap-2 rounded-lg border px-2.5 py-1 font-prose text-base", isExpanded ? "border-teal bg-teal-wash" : "border-border bg-card hover:bg-well")}
										>
											{chip}
											<ChevronDownIcon className={cn("size-3.5 text-ink-3 transition-transform", isExpanded && "rotate-180")} strokeWidth={1.8} aria-hidden="true" />
										</button>
									) : (
										<span className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1 font-prose text-base" title={title}>
											{chip}
										</span>
									)}
								</li>
							);
						})}
					</ul>

					{selectedCue && (
						<div className="lh-rise mt-2 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 rounded-lg bg-well p-4" data-testid="pron-cue">
							<div className="min-w-0 flex-1 basis-64">
								<p className="flex flex-wrap items-baseline gap-x-2 font-ui text-[13px] text-ink-3">
									<span className="font-prose text-[19px] font-semibold text-foreground" lang={lang?.code}>
										{selectedCue.symbol}
									</span>
									<span>[{selectedCue.ipa}]</span>
									<span>{selectedCue.name}</span>
								</p>
								<p className="mt-2 font-prose text-[15px] leading-relaxed text-ink-2">{selectedCue.motor}</p>
								{selectedCue.commonPitfall && <p className="mt-1.5 font-prose text-[14px] leading-relaxed text-ink-3">Watch out: {selectedCue.commonPitfall}</p>}
								{selectedCue.functionalLoad === "high" && <p className="mt-1.5 font-prose text-[14px] leading-relaxed text-ink-3">Mixing this sound up can change what a word means.</p>}
							</div>
							<button type="button" onClick={() => void speak(selectedCue.drillWord).catch(() => {})} className={cn(SECONDARY, SMALL, "shrink-0")}>
								<Volume2Icon className="size-3.5 text-ink-3" strokeWidth={1.6} />
								<span>
									Hear <span lang={lang?.code}>{selectedCue.drillWord}</span>
								</span>
							</button>
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
			<p className="mt-2 font-prose text-sm text-muted-foreground">From your spoken lines lately. Tap a sound to see how to make it and hear a word with it.</p>
		</div>
	);
}
