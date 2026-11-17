"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SourcesNote } from "@/components/sources/sources-note";
import type { WordEstimateReport } from "@/src/core";

const count = (n: number) => n.toLocaleString("en-US");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS[Number(day.slice(5, 7)) - 1] ?? ""}`;
const percent = (share: number) => `${Math.max(0, Math.min(100, share * 100))}%`;

export function WordEstimatePanel({
	initial,
	revision = 0,
}: {
	initial: WordEstimateReport | null;
	revision?: number;
}) {
	const [report, setReport] = useState(initial);

	useEffect(() => {
		let gone = false;
		fetch(`/api/words/estimate?tz=${new Date().getTimezoneOffset()}`)
			.then((res) => (res.ok ? (res.json() as Promise<WordEstimateReport>) : null))
			.then((fresh) => {
				if (fresh && !gone) setReport(fresh);
			})
			.catch(() => {});
		return () => {
			gone = true;
		};
	}, [revision]);

	const estimate = report?.estimate;
	if (!report || !estimate) return null;

	const fromEvidence = estimate.parts.review + estimate.parts.marked + estimate.parts.checked;
	const earlier = report.history.length > 1 ? report.history[0]! : null;
	const canCheck = report.wordsLeftToCheck > 0;

	return (
		<section
			className="mb-7"
			data-testid="word-estimate"
			data-measured={report.measured}
			aria-labelledby="word-estimate-title"
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<p id="word-estimate-title" className="font-ui text-[13px] font-[550] text-ink-3">
						Words you know
					</p>
					<p
						className={cn(
							"mt-0.5 font-title text-[28px] font-semibold leading-tight tracking-[-0.022em]",
							report.measured ? "text-foreground" : "text-ink-2",
						)}
						data-testid="word-estimate-total"
					>
						{report.measured ? (
							<>
								About <span className="tabular-nums">{count(estimate.total)}</span>
							</>
						) : fromEvidence > 0 ? (
							<>
								<span className="tabular-nums">{count(fromEvidence)}</span> counted so far
							</>
						) : (
							"Not measured yet"
						)}
					</p>
					<p className="q-sub !mt-1 max-w-[60ch]" data-testid="word-estimate-line">
						{report.measured ? (
							<>
								Likely between <b className="tabular-nums">{count(estimate.low)}</b> and{" "}
								<b className="tabular-nums">{count(estimate.high)}</b>, measured from {count(estimate.answers)} meanings
								you typed.
								{estimate.answers < report.answersForASteadyEstimate
									? ` A first reading: studies of size tests ask for about ${count(report.answersForASteadyEstimate)} words here.`
									: ""}
								{earlier &&
									earlier.total !== estimate.total &&
									` It was about ${count(earlier.total)} on ${dayLabel(earlier.day)}.`}
							</>
						) : (
							<>
								Your level{report.level ? ` (${report.level})` : ""} suggests about{" "}
								<b className="tabular-nums">{count(estimate.total)}</b> in all. That is a guess, not a measurement:
								check {report.checkLength} words to get your own number.
							</>
						)}
					</p>
				</div>
				{canCheck && (
					<div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
						<Link
							href="/words/check"
							className={cn("q-btn pointer-coarse:min-h-11", report.measured ? "sec" : "primary")}
							data-testid="word-estimate-check"
						>
							{report.measured ? `Check ${report.checkLength} more` : "Check my words"}
						</Link>
						<span className="font-ui text-[12.5px] text-ink-3">
							{report.measured
								? "Each check narrows the range"
								: `${report.checkLength} words to type the meaning of, about 5 minutes`}
						</span>
					</div>
				)}
			</div>

			<div
				className="q-bar mt-4"
				role="img"
				aria-label={`About ${count(estimate.total)} of the ${count(estimate.dictionary)} words in this dictionary: ${count(fromEvidence)} counted from your own evidence, ${count(estimate.parts.inferred)} estimated.`}
			>
				<i
					style={{
						width: percent(fromEvidence / estimate.dictionary),
						borderRadius: estimate.parts.inferred > 0 ? "4px 0 0 4px" : undefined,
					}}
				/>
				<i
					className="over"
					style={{
						left: percent(fromEvidence / estimate.dictionary),
						width: percent(estimate.parts.inferred / estimate.dictionary),
						borderRadius: fromEvidence > 0 ? undefined : "4px",
					}}
				/>
			</div>
			<p className="q-legend" data-testid="word-estimate-legend">
				<span title="Review cards count by the scheduler's chance that you recall each one today. A word you marked as known counts in full. A checked word counts when the meaning you typed was right.">
					<i className="bg-[var(--q-bar)]" />
					<span>
						<b className="tabular-nums">{count(fromEvidence)}</b> counted: {count(estimate.parts.review)} from Review,{" "}
						{count(estimate.parts.marked)} marked known, {count(estimate.parts.checked)} checked
					</span>
				</span>
				<span title="Words with no evidence of their own: the share you are likely to know at each frequency, from your check answers.">
					<i className="[background:repeating-linear-gradient(135deg,var(--q-bar-hatch-a)_0_2px,var(--q-bar-hatch-b)_2px_4px)]" />
					<span>
						<b className="tabular-nums">{count(estimate.parts.inferred)}</b> {report.measured ? "estimated" : "guessed"}
					</span>
				</span>
				<span>
					of <b className="tabular-nums">{count(estimate.dictionary)}</b> in this dictionary
				</span>
			</p>
			{report.measured && estimate.shareOfUses !== null && (
				<p className="q-sub max-w-[60ch]" data-testid="word-estimate-coverage">
					Counted by use, not one each, these words are about{" "}
					<b className="tabular-nums">{Math.round(estimate.shareOfUses * 100)}%</b> of the words in this dictionary's
					example sentences: a few common words do most of the work.
				</p>
			)}
			<SourcesNote feature="word-check" className="mt-4" />
		</section>
	);
}
