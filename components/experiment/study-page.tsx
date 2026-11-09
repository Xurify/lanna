import Link from "next/link";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { PRIMARY, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { cn } from "@/lib/utils";
import { CHECK_ROUTE, studyLanguage } from "@/components/experiment/study-language";
import { EXPERIMENT_CONSTANTS, weeklyCheckRows, type CheckItemRecord, type DailyExperimentRecord, type DaySchedule, type ExperimentConfig, type RegressionResult, type WeeklyCheckRow } from "@/src/core";

const DAYS_LISTED = 14;
const GAIN_NEEDED_POINTS = 10;

export interface StudyPageProps {
	config: ExperimentConfig;
	schedule: DaySchedule[];
	daily: DailyExperimentRecord[];
	checks: CheckItemRecord[];
	analysis: RegressionResult;
	today: { date: string; dayNumber: number };
}

function languageName(id: string): string {
	return studyLanguage(id).name;
}

function dayInWords(iso: string): string {
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function checkHref(row: WeeklyCheckRow): string {
	return `${CHECK_ROUTE}?week=${row.week}&lang=${row.language}`;
}

const RESULT_WORDS: Record<RegressionResult["verdictStatus"], string> = {
	insufficient_data: "Too early to say",
	pending: "Too early to say",
	confirmed_benefit: "Listening first helped",
	no_effect_or_harm: "No clear gain",
};

export function StudyPage({ config, schedule, daily, checks, analysis, today }: StudyPageProps) {
	const treatment = languageName(config.languages.treatment);
	const control = languageName(config.languages.control);
	const rows = weeklyCheckRows(config, checks, today.dayNumber);
	const openCheck = rows.find((r) => r.state === "open");
	const nextCheck = rows.find((r) => r.state === "ahead");
	const running = today.dayNumber >= 1 && today.dayNumber <= config.days;
	const switched = today.dayNumber >= config.onsetDay;
	const measured = analysis.verdictStatus === "confirmed_benefit" || analysis.verdictStatus === "no_effect_or_harm";
	const jumpPoints = analysis.b2 * 100;
	const practiced = daily.filter((d) => d.dictationReps > 0 || d.minutes > 0);
	const counted = practiced.filter((d) => d.firstPlayShare !== null).length;
	const recent = [...practiced].sort((a, b) => b.dayNumber - a.dayNumber || a.language.localeCompare(b.language)).slice(0, DAYS_LISTED);

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-3xl px-5 pb-20" data-testid="study">
				<Link href="/" className="inline-flex min-h-6 items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Study</h1>
				<p className="q-line dim mt-2 max-w-2xl">
					<b className="text-foreground">Does listening first make {treatment} easier to follow?</b> For {config.days} days {treatment} and {control} run side by side. On day {config.onsetDay} {treatment} drops its lessons, speaking and speed drills and keeps only listening, reading, watching and words. {control} keeps the normal plan, so the two can be compared.
				</p>

				{openCheck ? (
					<section className="q-card mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4" data-testid="study-check-due">
						<div className="min-w-0">
							<h2 className="font-ui text-sm font-semibold text-foreground">
								The week {openCheck.week} check in {languageName(openCheck.language)} is open
							</h2>
							<p className="mt-0.5 font-prose text-sm text-muted-foreground">
								{EXPERIMENT_CONSTANTS.PROBE_ITEMS_PER_WEEK} sentences to hear once and type, then {EXPERIMENT_CONSTANTS.PRODUCTION_ITEMS_PER_WEEK} to write yourself.
							</p>
						</div>
						<Link href={checkHref(openCheck)} className={PRIMARY} data-testid="study-check-start">
							Start the check
						</Link>
					</section>
				) : (
					nextCheck && (
						<p className="mt-6 font-prose text-sm text-muted-foreground" data-testid="study-check-next">
							Nothing to do here today. The week {nextCheck.week} check opens on <b className="font-[550] text-ink-2">{dayInWords(nextCheck.date)}</b>; until then the daily plan does the measuring.
						</p>
					)
				)}

				<section className="q-card mt-6 p-4" aria-label="Where the study stands" data-testid="study-facts">
					<dl className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
						<Fact label="Day" value={today.dayNumber < 1 ? "Not started" : running ? `${today.dayNumber} of ${config.days}` : "Finished"} line={`${dayInWords(config.startDate)} to ${dayInWords(config.endDate)}`} />
						<Fact label={`${treatment} today`} value={switched ? "Listening first" : "Normal plan"} line={`${switched ? "switched" : "switches"} on day ${config.onsetDay} · ${dayInWords(config.onsetDate)}`} />
						<Fact
							label="Jump at the switch"
							value={measured ? `${jumpPoints >= 0 ? "+" : "−"}${Math.abs(jumpPoints).toFixed(1)} points` : "—"}
							dim={!measured}
							line={measured ? `in sentences understood on the first play · a gain needs +${GAIN_NEEDED_POINTS} or more` : `needs ${EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE} measured days on each side · ${analysis.baselineDays} before, ${analysis.interventionDays} after`}
						/>
						<Fact label="Result so far" value={RESULT_WORDS[analysis.verdictStatus]} dim={!measured} line={measured ? `p = ${analysis.pValue.toFixed(2)} · fixed after day ${config.days}` : `decided after day ${config.days}`} />
					</dl>
				</section>

				<section className="mt-8" data-testid="study-days">
					<h2 className="q-sh">
						{treatment}, day by day <small>a check closes each week</small>
					</h2>
					<DayStrip schedule={schedule} todayDay={today.dayNumber} checkedWeeks={new Set(rows.filter((r) => r.state === "done" && r.language === config.languages.treatment).map((r) => r.week))} />
					<p className="q-legend">
						<span>
							<i style={{ background: "var(--q-bar)" }} />
							Normal plan
						</span>
						<span>
							<i style={{ background: "var(--q-teal)" }} />
							Listening first
						</span>
						<span>
							<i style={{ background: "var(--q-well-2)", boxShadow: "inset 0 0 0 1px var(--q-line-2)" }} />
							Still ahead (paler)
						</span>
						<span>
							<i style={{ background: "var(--background)", boxShadow: "0 0 0 1.5px var(--q-teal)" }} />
							Today
						</span>
					</p>
				</section>

				<section className="mt-8" data-testid="study-checks">
					<h2 className="q-sh">Weekly checks</h2>
					<ol className="divide-y divide-[var(--q-line)]">
						{Array.from({ length: EXPERIMENT_CONSTANTS.TOTAL_WEEKS }, (_, i) => i + 1).map((week) => {
							const ofWeek = rows.filter((r) => r.week === week);
							return (
								<li key={week} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 py-3">
									<div>
										<p className="font-ui text-sm font-semibold text-foreground">Week {week}</p>
										<p className="font-ui text-xs text-muted-foreground">{dayInWords(ofWeek[0]!.date)}</p>
									</div>
									{ofWeek.every((row) => row.state === "ahead") ? (
										<p className="self-center font-ui text-sm text-muted-foreground">{ofWeek.map((row) => languageName(row.language)).join(" and ")} · not open yet</p>
									) : (
										<ul className="flex flex-col gap-1.5">
											{ofWeek.map((row) => (
												<CheckLine key={row.language} row={row} primary={row === openCheck} />
											))}
										</ul>
									)}
								</li>
							);
						})}
					</ol>
				</section>

				<section className="mt-8" data-testid="study-daily">
					<h2 className="q-sh">
						Days measured <small>{counted === 0 ? "none yet" : `${counted} count so far`}</small>
					</h2>
					{recent.length === 0 ? (
						<p className="font-prose text-sm text-muted-foreground">No practice on a study day yet. A day counts once it has {EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed sentences in Listen.</p>
					) : (
						<ul className="divide-y divide-[var(--q-line)]">
							{recent.map((d) => (
								<DayLine key={`${d.date}:${d.language}`} day={d} />
							))}
						</ul>
					)}
				</section>

				<section className="mt-8 border-t pt-5 font-prose text-sm leading-relaxed text-muted-foreground" data-testid="study-method">
					<h2 className="font-ui text-xs font-semibold tracking-wide text-muted-foreground">How the result is decided</h2>
					<p className="mt-3">
						<b className="text-foreground">The measure.</b> Each day, the share of Listen sentences typed right on the first play, with no replay and no look at the text. A day with fewer than {EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed sentences is left out.
					</p>
					<p className="mt-3">
						<b className="text-foreground">The switch day.</b> Drawn at random from days {EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS[0]} to {EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS.at(-1)} before the study began (seed {config.seed}), so the day could not be picked to suit the result.
					</p>
					<p className="mt-3">
						<b className="text-foreground">The rule.</b> Listening first counts as a gain only if the share jumps by {GAIN_NEEDED_POINTS} points or more at the switch, and no other of the {EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS.length} possible switch days shows a bigger jump. On the listening-first plan, {EXPERIMENT_CONSTANTS.COMPLIANCE_THRESHOLD}% of a day's minutes must be on the allowed tasks. The full protocol is in <code className="font-mono text-[13px]">docs/experiments/input-first-russian.md</code>.
					</p>
				</section>
			</main>
		</div>
	);
}

function Fact({ label, value, line, dim }: { label: string; value: string; line: string; dim?: boolean }) {
	return (
		<div className="min-w-0">
			<dt className="font-ui text-xs font-semibold tracking-wide text-muted-foreground">{label}</dt>
			<dd className={cn("mt-0.5 font-ui text-[19px] font-semibold leading-tight tracking-[-0.015em] tabular-nums", dim ? "text-muted-foreground" : "text-foreground")}>{value}</dd>
			<dd className="mt-1 font-prose text-xs leading-snug text-muted-foreground">{line}</dd>
		</div>
	);
}

function DayStrip({ schedule, todayDay, checkedWeeks }: { schedule: DaySchedule[]; todayDay: number; checkedWeeks: Set<number> }) {
	const weeks: DaySchedule[][] = [];
	for (let i = 0; i < schedule.length; i += 7) weeks.push(schedule.slice(i, i + 7));
	const onset = schedule.find((s) => s.phase === "intervention");
	return (
		<div role="img" aria-label={`${schedule.length} days in ${weeks.length} weeks. ${todayDay >= 1 && todayDay <= schedule.length ? `Today is day ${todayDay}. ` : ""}${onset ? `Listening first starts on day ${onset.dayNumber}.` : ""}`} className="flex gap-1.5">
			{weeks.map((days, i) => (
				<div key={i} className="min-w-0 flex-1">
					<div className="flex h-7 gap-0.5">
						{days.map((d) => {
							const ahead = d.dayNumber > todayDay;
							const listeningFirst = d.phase === "intervention";
							return (
								<span
									key={d.dayNumber}
									title={`Day ${d.dayNumber} · ${dayInWords(d.date)} · ${listeningFirst ? "listening first" : "normal plan"}`}
									className={cn(
										"min-w-0 flex-1 rounded-[3px]",
										listeningFirst ? (ahead ? "bg-teal-wash shadow-[inset_0_0_0_1px_var(--q-teal-line)]" : "bg-teal") : ahead ? "bg-well-2 shadow-[inset_0_0_0_1px_var(--q-line-2)]" : "bg-[var(--q-bar)]",
										d.dayNumber === todayDay && "relative z-[1] shadow-[0_0_0_2px_var(--background),0_0_0_3.5px_var(--q-teal)]",
									)}
								/>
							);
						})}
					</div>
					<p className="mt-1.5 flex items-center gap-1 font-ui text-[11px] text-ink-3">
						<span>
							<span className="max-sm:hidden">Week </span>
							<span className="sm:hidden">W</span>
							{i + 1}
						</span>
						{checkedWeeks.has(i + 1) && <CheckIcon className="size-3 text-teal" strokeWidth={2.4} aria-label="check done" />}
					</p>
				</div>
			))}
		</div>
	);
}

function CheckLine({ row, primary }: { row: WeeklyCheckRow; primary: boolean }) {
	return (
		<li className="flex min-h-8 items-center justify-between gap-3" data-testid={`study-check-${row.week}-${row.language}`}>
			<p className="min-w-0 font-ui text-sm text-foreground">
				{row.state === "done" && <CheckIcon className="mr-1.5 inline size-4 align-[-3px] text-teal" strokeWidth={2} aria-label="Done" />}
				{languageName(row.language)}
				<span className="text-muted-foreground">
					{" · "}
					{row.state === "done" ? (
						<>
							<span className="tabular-nums">
								{row.probesUnderstood} of {row.probesAnswered}
							</span>{" "}
							heard right, <span className="tabular-nums">{Math.round((row.productionMatch ?? 0) * 100)}%</span> of the words written
						</>
					) : row.state === "open" ? (
						"not done yet"
					) : (
						"not open yet"
					)}
				</span>
			</p>
			{row.state === "open" && (
				<Link href={checkHref(row)} className={cn(primary ? PRIMARY : SECONDARY, SMALL, "shrink-0")}>
					Start
				</Link>
			)}
		</li>
	);
}

function DayLine({ day }: { day: DailyExperimentRecord }) {
	const share = day.firstPlayShare;
	return (
		<li className="flex items-start justify-between gap-4 py-3">
			<div className="min-w-0">
				<p className="font-ui text-sm font-semibold text-foreground">
					{languageName(day.language)}
					<span className="font-normal text-muted-foreground">
						{" "}
						· day {day.dayNumber} · {dayInWords(day.date)}
					</span>
				</p>
				<p className="mt-0.5 font-prose text-[13px] leading-snug text-muted-foreground">
					{share === null ? `${day.dictationReps} of the ${EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed sentences a day needs` : `${day.understoodReps} of ${day.dictationReps} typed sentences understood on the first play`}
					{" · "}
					{day.minutes} min · {day.arm === "input-first" ? "listening first" : "normal plan"}
					{day.arm === "input-first" && (
						<>
							{" · "}
							<span className={cn(!day.compliant && "text-miss")}>
								{day.compliance}% of the time on allowed tasks{!day.compliant && ` (needs ${EXPERIMENT_CONSTANTS.COMPLIANCE_THRESHOLD}%)`}
							</span>
						</>
					)}
				</p>
			</div>
			<p className={cn("shrink-0 font-ui text-[16px] font-semibold tabular-nums tracking-[-0.01em]", share === null ? "text-muted-foreground" : "text-foreground")}>{share === null ? "—" : `${Math.round(share * 100)}%`}</p>
		</li>
	);
}
