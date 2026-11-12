import Link from "next/link";
import { cn } from "@/lib/utils";
import { QIcon } from "@/components/quiet/icon";
import { CHECK_ROUTE, STUDY_ROUTE, studyLanguage } from "@/components/experiment/study-language";
import { EXPERIMENT_CONSTANTS, type TodayExperimentStatus } from "@/src/core";

const ROW = "flex w-full items-center gap-3 rounded-[10px] bg-well px-3.5 py-2.5 text-left hover:bg-well-2";

function shortDate(iso: string): string {
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function StudyEntryRow({ status }: { status: TodayExperimentStatus | null | undefined }) {
	if (!status || !status.active) return null;

	const need = EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY;
	const checkOpen = status.weeklyCheckDue && !status.weeklyCheckCompleted;
	const left = status.languages.reduce((sum, l) => sum + Math.max(0, need - l.dictationReps), 0);
	const pill = checkOpen ? "check open" : status.validDay ? "counts" : `${left} to go`;
	const href = checkOpen ? `${CHECK_ROUTE}?week=${status.weekNumber}&lang=${status.languages[0]?.id ?? ""}` : STUDY_ROUTE;

	return (
		<Link href={href} className={ROW} data-testid="study-entry-row" aria-label={`Study, day ${status.dayNumber} of ${status.totalDays}: ${pill}`}>
			<QIcon name="chart" className={cn("shrink-0", status.validDay && !checkOpen ? "text-ink-3" : "text-teal")} />
			<span className="min-w-0 flex-1">
				<span className="block text-[15px] font-[550] tracking-[-0.006em] text-foreground">
					Study <span className="font-[450] text-ink-3">· day {status.dayNumber} of {status.totalDays}</span>
				</span>
				{checkOpen ? (
					<span className="block truncate text-[13px] text-ink-3">
						The week {status.weekNumber} check is open{status.checkLastDate ? ` through ${shortDate(status.checkLastDate)}` : ""}
					</span>
				) : (
					<span className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[13px] text-ink-3" data-testid="study-entry-languages">
						{status.languages.map((l) => (
							<span key={l.id} className="inline-flex items-center gap-1.5">
								{studyLanguage(l.id).name}
								<span className="flex gap-[2px]" aria-hidden="true">
									{Array.from({ length: need }, (_, i) => (
										<i key={i} className={cn("h-1.5 w-2.5 rounded-[2px]", i < l.dictationReps ? "bg-teal" : "bg-[var(--q-line-2)]")} />
									))}
								</span>
								<span className="tabular-nums">{l.validDay ? "counts" : `${Math.min(l.dictationReps, need)} of ${need}`}</span>
							</span>
						))}
					</span>
				)}
			</span>
			<span className={cn("q-pill shrink-0", status.validDay && !checkOpen && "grey")}>{pill}</span>
			<QIcon name="chev" className="shrink-0 text-ink-4" />
		</Link>
	);
}
