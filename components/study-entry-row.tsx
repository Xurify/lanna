/**
 * Study entry row on Today page (LangHarness, 2026-11-10).
 * Displays current day progress for the 42-day interrupted time-series experiment:
 * - Active study day and phase (e.g. Day 1 of 42 · Input-First Study)
 * - Required 5 Listen dictation reps progress (e.g. 0/5 reps or Valid day)
 * - Weekly check alert banner on days 7, 14, 21, 28, 35, 42
 */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import type { TodayExperimentStatus } from "@/src/core";

export function StudyEntryRow({ status }: { status: TodayExperimentStatus | null | undefined }) {
	if (!status || !status.active) return null;

	const { dayNumber, totalDays, russianArm, weeklyCheckDue, weeklyCheckCompleted, weekNumber, validDay, russian } = status;
	const reps = russian.dictationReps;
	const needed = Math.max(0, 5 - reps);

	const subtitle = weeklyCheckDue && !weeklyCheckCompleted
		? `Week ${weekNumber} check due today · ${reps >= 5 ? "Daily reps validated" : `${needed} more dictation rep${needed === 1 ? "" : "s"} needed`}`
		: validDay
			? `Day ${dayNumber} validated · ${reps} dictation reps (${russian.firstPlayShare !== null ? Math.round(russian.firstPlayShare * 100) : 0}% 1st-play understood)`
			: `Need ${needed} more Russian Listen sentence${needed === 1 ? "" : "s"} today (no replay/peek for 1st-play score)`;

	const pillText = weeklyCheckDue && !weeklyCheckCompleted
		? "Check due"
		: validDay
			? "✓ Validated"
			: `${reps}/5 reps`;

	const pillTone = weeklyCheckDue && !weeklyCheckCompleted
		? "amber"
		: validDay
			? "teal"
			: "sun";

	return (
		<div
			className={cn(
				"flex flex-col gap-2 rounded-xl border p-3.5 transition-colors",
				weeklyCheckDue && !weeklyCheckCompleted
					? "border-amber-500/40 bg-amber-500/10"
					: validDay
						? "border-teal/30 bg-well"
						: "border-sun/40 bg-well ring-1 ring-sun/20",
			)}
			data-testid="study-entry-container"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
				<Link
					href="/experiments/input-first"
					className="group flex min-w-0 flex-1 items-start gap-3 text-left sm:items-center"
					data-testid="study-entry-row"
					aria-label={`Study: Day ${dayNumber} of ${totalDays}, ${pillText}`}
				>
					<QIcon
						name="chart"
						className={cn(
							"shrink-0",
							validDay ? "text-teal" : weeklyCheckDue && !weeklyCheckCompleted ? "text-amber-500" : "text-sun",
						)}
					/>
					<span className="min-w-0 flex-1">
						<span className="flex flex-wrap items-center gap-2">
							<span className="text-[15px] font-[600] tracking-[-0.006em] text-foreground group-hover:underline">
								Study · Day {dayNumber} of {totalDays}
							</span>
							<span className="rounded-md bg-well-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
								{russianArm === "input-first" ? "Input-First Phase" : "Baseline Phase"}
							</span>
							<span
								className={cn(
									"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
									pillTone === "teal" && "bg-teal/15 text-teal",
									pillTone === "amber" && "bg-amber-500 text-white",
									pillTone === "sun" && "bg-sun text-sun-ink",
								)}
							>
								{pillText}
							</span>
						</span>
						<span className="mt-0.5 block text-[13px] text-ink-2">{subtitle}</span>
					</span>
				</Link>

				<div className="flex items-center gap-2 sm:shrink-0">
					{/* Visual 5-dot pip counter */}
					<div className="hidden items-center gap-1 sm:flex" aria-hidden="true" title={`${reps} of 5 Listen sentences today`}>
						{[0, 1, 2, 3, 4].map((i) => (
							<span
								key={i}
								className={cn(
									"size-2 rounded-full transition-colors",
									i < reps ? "bg-teal" : "bg-ink-4/35",
								)}
							/>
						))}
					</div>

					{/* Primary action CTA right inside the card */}
					{weeklyCheckDue && !weeklyCheckCompleted ? (
						<Link
							href="/experiments/input-first/check"
							className="q-btn primary h-11 w-full sm:h-9 sm:w-auto"
							data-testid="study-quick-check"
						>
							<span>Take Week {weekNumber} Check</span>
							<QIcon name="arrow" className="size-3.5" />
						</Link>
					) : !validDay ? (
						<Link
							href="/listen"
							className="q-btn primary h-11 w-full sm:h-9 sm:w-auto"
							data-testid="study-quick-listen"
						>
							<span>Do {needed} in Listen</span>
							<QIcon name="arrow" className="size-3.5" />
						</Link>
					) : (
						<Link
							href="/experiments/input-first"
							className="q-btn sec h-11 w-full sm:h-9 sm:w-auto"
						>
							<span>View Study</span>
							<QIcon name="chev" className="size-3.5 text-ink-4" />
						</Link>
					)}
				</div>
			</div>
		</div>
	);
}
