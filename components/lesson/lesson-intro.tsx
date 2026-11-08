"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { KBD, PRIMARY } from "@/components/ui/learn-buttons";
import { COLUMN, Dock, PracticeCard } from "@/components/task-frame";
import { speak, useActiveLanguage } from "@/components/speech";
import { CaseSketch, sketchLead, sketchStages, sketchSummary, type SketchStage } from "@/components/lesson/case-sketch";
import { PenUnderline } from "@/components/lesson/ink";
import { referencePageUrl, unitInfo, type LessonPlan } from "@/src/core";

/**
 * The learn-first intro: a click-through case sketch before the first rep.
 * Each stage says what the preposition means, draws it, shows one real
 * sentence with its translation and only its ending lit, then the same word
 * before and after (dictionary form, form after the cue) and one plain line on
 * why. A last step sums up the rule and links the case page on slovak.wiki.
 * Nothing here is graded and no first try is counted. Units without a sketch
 * skip the intro and open on rep 1.
 */

export function LessonIntro({ plan, onStart }: { plan: LessonPlan; onStart: () => void }) {
	const stages = sketchStages(plan.unit);
	const summary = sketchSummary(plan.unit);
	const [step, setStep] = useState(0);
	const lang = useActiveLanguage();
	const stage = stages[step];

	useEffect(() => {
		if (!stage || !lang) return;
		void speak(`${stage.before}${stage.base}${stage.ending}${stage.after}`, lang).catch(() => {});
	}, [lang, stage]);

	const count = stages.length + (summary ? 1 : 0);
	const last = count - 1;
	const onSummary = summary !== undefined && step === stages.length;
	const finished = step === last;

	useEffect(() => {
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});
	function onKey(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			if (finished) onStart();
			else setStep(step + 1);
			return;
		}
		if (e.key === "ArrowRight" && step < last) setStep(step + 1);
		if (e.key === "ArrowLeft" && step > 0) setStep(step - 1);
	}

	if (stages.length === 0) return null;

	return (
		<>
			{introCard(
				plan,
				onSummary ? "The rule" : `Step ${step + 1} of ${count}`,
				<>
					{onSummary ? (
						<SummaryStage summary={summary!} />
					) : (
						<figure className="lh-rise flex flex-col items-center" data-testid="intro-stage">
							<p className="max-w-md text-center font-ui text-[13px] text-ink-3" data-testid="intro-lead">
								{sketchLead(plan.unit)}
							</p>
							<p className="mt-4 text-center font-ui text-[15px] font-semibold text-foreground" data-testid="intro-label">
								{stage!.label}
							</p>
							<CaseSketch unit={plan.unit} stage={step} className="mx-auto my-1 max-h-40" />
							<MarkedEnding {...stage!} className="mt-2 text-center" />
							<p className="mt-1 text-center font-prose text-[15px] text-ink-3" data-testid="intro-meaning">
								{stage!.meaning}
							</p>
							<FormChange stage={stage!} />
							<p className="mt-4 min-h-12 max-w-md text-balance text-center font-prose text-[15px] leading-snug text-ink-2" data-testid="intro-why">
								{keepEndings(stage!.why)}
							</p>
						</figure>
					)}
					<div className="mt-5 flex justify-center">
						<StageDots step={step} count={count} onPick={setStep} />
					</div>
				</>,
			)}
			<IntroDock
				hint="Enter · ← → to step"
				action={
					finished ? (
						<button type="button" onClick={onStart} className={PRIMARY} data-testid="intro-start">
							Start practicing
						</button>
					) : (
						<button type="button" onClick={() => setStep(step + 1)} className={PRIMARY} data-testid="intro-next">
							Next
						</button>
					)
				}
			/>
		</>
	);
}

// ─── Pieces ────────────────────────────────────────────────────────────────

function introCard(plan: LessonPlan, progress: string, body: React.ReactNode) {
	const info = unitInfo(plan.unit);
	return (
		<div className={cn(COLUMN, "lh-rise flex flex-1 flex-col")}>
			<PracticeCard icon="rule" title={info.slovakTerm ?? info.title} sub={info.tagline} right={progress}>
				{body}
			</PracticeCard>
		</div>
	);
}

function IntroDock({ hint, action }: { hint?: string; action: React.ReactNode }) {
	return (
		<Dock>
			<div className={cn(COLUMN, "flex min-h-20 items-center justify-between gap-4 py-4")}>
				{hint ? (
					<p className="hidden items-center gap-1.5 font-ui text-[13px] text-ink-3 pointer-fine:flex">
						<kbd className={KBD}>{hint}</kbd>
					</p>
				) : (
					<span />
				)}
				<div className="ml-auto flex items-center gap-2">{action}</div>
			</div>
		</Dock>
	);
}

function keepEndings(text: string): string {
	return text.replace(/-(?=\p{L})/gu, "-\u2060");
}

function FormChange({ stage }: { stage: SketchStage }) {
	return (
		<div className="mt-4 flex items-start justify-center gap-4 font-prose" lang="sk" data-testid="intro-change">
			<div className="flex flex-col items-center gap-0.5">
				<span className="text-[22px] font-semibold text-foreground">{stage.dictionary}</span>
				<span className="font-ui text-[13px] text-ink-3" lang="en">
					in the dictionary · {stage.gender}
				</span>
			</div>
			<ArrowRightIcon className="mt-2 size-5 text-ink-3" strokeWidth={1.6} aria-hidden />
			<div className="flex flex-col items-center gap-0.5">
				<span className="text-[22px] font-semibold text-foreground">
					{stage.base}
					<span className="text-teal-2">{stage.ending}</span>
				</span>
				<span className="font-ui text-[13px] text-ink-3" lang="en">
					{stage.cue}
				</span>
			</div>
		</div>
	);
}

function MarkedEnding({ before, base, ending, after, className }: { before: string; base: string; ending: string; after: string; className?: string }) {
	return (
		<p className={cn("font-prose text-[28px] font-semibold leading-[1.5] tracking-[-0.032em] text-foreground sm:text-[34px] sm:leading-[50px]", className)} lang="sk">
			{before}
			{base}
			<span className="relative inline-block align-baseline font-semibold leading-none text-teal-2">
				{ending}
				<PenUnderline />
			</span>
			{after}
		</p>
	);
}

function StageDots({ step, count, onPick }: { step: number; count: number; onPick: (i: number) => void }) {
	return (
		<div className="flex items-center gap-1.5" data-testid="intro-dots">
			{Array.from({ length: count }, (_, i) => (
				<button
					type="button"
					key={i}
					aria-label={`Step ${i + 1}`}
					aria-current={i === step}
					onClick={() => onPick(i)}
					className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-teal" : i < step ? "w-1.5 bg-teal/50" : "w-1.5 bg-well-2 hover:bg-teal/40")}
				/>
			))}
		</div>
	);
}

function SummaryStage({ summary }: { summary: { lines: readonly string[]; exceptions?: string; slug: string } }) {
	const link = referencePageUrl(`/grammar/cases/${summary.slug}`);
	return (
		<div className="lh-rise flex flex-col items-start gap-3 font-prose text-[15px] leading-relaxed text-foreground" data-testid="intro-summary">
			<p className="font-ui text-[13px] font-semibold text-ink-3">The rule in short</p>
			{summary.lines.map((l, i) => (
				<p key={i}>{keepEndings(l)}</p>
			))}
			{summary.exceptions && (
				<p className="text-ink-3" data-testid="intro-exceptions">
					<span className="font-semibold text-foreground">Exceptions: </span>
					{keepEndings(summary.exceptions)}
				</p>
			)}
			{link && (
				<a href={link} target="_blank" rel="noopener noreferrer" className="font-ui text-[13px] font-[550] text-ink-3 underline decoration-[var(--q-line-2)] underline-offset-[3px] hover:text-ink-2" data-testid="intro-wiki">
					The {summary.slug} case on slovak.wiki
				</a>
			)}
		</div>
	);
}
