import Link from "next/link";
import { ArrowLeftIcon, ChevronDownIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { PRIMARY, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { cn } from "@/lib/utils";
import { StudyChart } from "@/components/experiment/study-chart";
import { ListenInLanguage } from "@/components/experiment/listen-in-language";
import { CHECK_ROUTE, studyLanguage, type StudyLanguage } from "@/components/experiment/study-language";
import { EXPERIMENT_CONSTANTS, weeklyCheckRows, type CheckItemRecord, type DailyExperimentRecord, type DaySchedule, type ExperimentConfig, type RegressionResult } from "@/src/core";

const DAYS_LISTED = 14;
const GAIN_NEEDED_POINTS = 10;

export interface StudyPageProps {
	config: ExperimentConfig;
	schedule: DaySchedule[];
	daily: DailyExperimentRecord[];
	checks: CheckItemRecord[];
	analysis: RegressionResult;
	today: { date: string; dayNumber: number };
	runningLanguage: string;
}

function dayInWords(iso: string): string {
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function dateInWords(iso: string): string {
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const RESULT_WORDS: Record<RegressionResult["verdictStatus"], string> = {
	insufficient_data: "Too early to say",
	pending: "Too early to say",
	confirmed_benefit: "Listening first helped",
	no_effect_or_harm: "No clear gain",
};

function whereItStands(config: ExperimentConfig, todayDay: number, treatment: string): string {
	if (todayDay < 1) return `It starts on ${dayInWords(config.startDate)}.`;
	if (todayDay > config.days) return `It ended on ${dayInWords(config.endDate)}.`;
	const daysToSwitch = config.onsetDay - todayDay;
	if (daysToSwitch > 0) return `Day ${todayDay} of ${config.days}. ${treatment} is on the normal plan and switches to listening first on ${dayInWords(config.onsetDate)}, in ${daysToSwitch} ${daysToSwitch === 1 ? "day" : "days"}.`;
	return `Day ${todayDay} of ${config.days}. ${treatment} has been listening first since ${dayInWords(config.onsetDate)}: no lessons, speaking or speed drills.`;
}

export function StudyPage({ config, schedule, daily, checks, analysis, today, runningLanguage }: StudyPageProps) {
	const treatment = studyLanguage(config.languages.treatment);
	const control = studyLanguage(config.languages.control);
	const languages = [treatment, control];
	const rows = weeklyCheckRows(config, checks, today.dayNumber);
	const openCheck = rows.find((r) => r.state === "open");
	const nextCheck = rows.find((r) => r.state === "ahead");
	const running = today.dayNumber >= 1 && today.dayNumber <= config.days;
	const measured = analysis.verdictStatus === "confirmed_benefit" || analysis.verdictStatus === "no_effect_or_harm";
	const jumpPoints = analysis.b2 * 100;
	const practiced = daily.filter((d) => d.dictationReps > 0 || d.minutes > 0);
	const counted = practiced.filter((d) => d.firstPlayShare !== null).length;
	const newestFirst = [...practiced].sort((a, b) => b.dayNumber - a.dayNumber || a.language.localeCompare(b.language));
	const recent = newestFirst.slice(0, DAYS_LISTED);
	const earlier = newestFirst.slice(DAYS_LISTED);
	const daysNeeded = EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE;

	const todayRussian = daily.find((d) => d.date === today.date && d.language === config.languages.treatment);
	const russianReps = todayRussian?.dictationReps ?? 0;
	const russianValid = russianReps >= EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY;

	return (
		<div className="relative min-h-dvh bg-background">
			<div className="lh-drag absolute inset-x-0 top-0 h-13" aria-hidden="true" />
			<header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-3 py-2">
				<SidebarToggle />
			</header>
			<main className="mx-auto w-full max-w-4xl px-5 pb-20" data-testid="study">
				<Link href="/" className="inline-flex min-h-6 items-center gap-1.5 text-[13px] text-ink-3 hover:text-ink-2">
					<ArrowLeftIcon className="size-3.5" strokeWidth={1.6} />
					Today
				</Link>
				<h1 className="mt-3 text-[34px] font-semibold leading-[1.15] tracking-[-0.028em] text-foreground">Study</h1>
				<p className="mt-2 max-w-2xl text-[20px] font-semibold leading-[1.3] tracking-[-0.018em] text-foreground">Does listening first make {treatment.name} easier to follow?</p>
				<p className="q-line dim mt-2 max-w-2xl" data-testid="study-stands">
					{whereItStands(config, today.dayNumber, treatment.name)} {control.name} keeps the normal plan the whole time, so the two can be compared.
				</p>

				{openCheck ? (
					<section className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 shadow-xs" data-testid="study-check-due">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-white">
									Weekly Check Due Today
								</span>
								<span className="text-xs font-semibold text-ink-3">Day {today.dayNumber} of {config.days}</span>
							</div>
							<h2 className="mt-1.5 font-ui text-base font-semibold text-foreground">
								The week {openCheck.week} check in {studyLanguage(openCheck.language).name} is open
							</h2>
							<p className="mt-0.5 font-prose text-sm text-ink-2">
								{EXPERIMENT_CONSTANTS.PROBE_ITEMS_PER_WEEK} sentences to hear once and type, then {EXPERIMENT_CONSTANTS.PRODUCTION_ITEMS_PER_WEEK} to write yourself.
							</p>
						</div>
						<Link href={`${CHECK_ROUTE}?week=${openCheck.week}&lang=${openCheck.language}`} className={PRIMARY} data-testid="study-check-start">
							Start the check →
						</Link>
					</section>
				) : running ? (
					<section
						className={cn(
							"mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-xl border p-4 sm:p-5 shadow-xs transition-colors",
							russianValid
								? "border-teal/30 bg-teal-wash/60"
								: "border-teal/40 bg-card ring-1 ring-teal/20",
						)}
						data-testid="study-action-card"
					>
						<div className="min-w-0 w-full sm:w-auto sm:flex-1">
							<div className="flex items-center gap-2">
								<span
									className={cn(
										"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
										russianValid
											? "bg-teal text-white"
											: "bg-teal/15 text-teal",
									)}
								>
									{russianValid ? "✓ Today Validated" : "Action Needed Today"}
								</span>
								<span className="text-xs font-semibold text-ink-3">
									Day {today.dayNumber} of {config.days}
								</span>
							</div>
							<h2 className="mt-2 text-base font-semibold text-foreground sm:text-[17px]">
								{russianValid
									? `Today's trial data is recorded (${russianReps} of 5 Listen sentences completed)`
									: `Complete 5 typed sentences in ${treatment.name} Listen today (${russianReps} of 5 done)`}
							</h2>
							<p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">
								{russianValid
									? `First-play comprehension: ${todayRussian?.firstPlayShare !== null ? Math.round((todayRussian?.firstPlayShare ?? 0) * 100) : 0}%. Your Day ${today.dayNumber} data is safely logged!`
									: `To record today's baseline comprehension, open ${treatment.name} Listen and type each sentence without peeking or replaying. At least 5 dictation sentences are required for Day ${today.dayNumber}.`}
							</p>
							<div className="mt-3 flex items-center gap-3">
								<div className="flex items-center gap-1.5" aria-label={`${russianReps} of 5 sentences`}>
									{[0, 1, 2, 3, 4].map((i) => (
										<span
											key={i}
											className={cn(
												"size-2.5 rounded-full transition-colors",
												i < russianReps ? "bg-teal" : "bg-ink-4/30",
											)}
										/>
									))}
								</div>
								<span className="text-xs font-medium text-ink-3">
									{russianReps >= 5 ? "5 of 5 reps complete" : `${Math.max(0, 5 - russianReps)} reps remaining`}
								</span>
							</div>
						</div>
						<div className="shrink-0">
							{russianValid ? (
								<ListenInLanguage language={treatment} running={runningLanguage} className={SECONDARY} testId="study-action-btn">
									Open {treatment.name} Listen
								</ListenInLanguage>
							) : (
								<ListenInLanguage language={treatment} running={runningLanguage} className={PRIMARY} testId="study-action-btn">
									Start {treatment.name} Listen ({Math.max(0, 5 - russianReps)} more) →
								</ListenInLanguage>
							)}
						</div>
					</section>
				) : null}

				<div className="mt-6">
					<StudyChart
						days={schedule.map((s) => ({ dayNumber: s.dayNumber, label: dayInWords(s.date), listeningFirst: s.phase === "intervention" }))}
						daily={daily}
						checks={rows}
						todayDay={today.dayNumber}
						treatment={treatment}
						control={control}
						onsetDay={config.onsetDay}
						switchLabel={`${today.dayNumber >= config.onsetDay ? "switched" : "the switch"} · ${dateInWords(config.onsetDate)}`}
						fit={measured ? { b0: analysis.b0, b1: analysis.b1, b2: analysis.b2, b3: analysis.b3 } : null}
						minReps={EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY}
					/>
				</div>

				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					{running && (
						<section className="q-well" data-testid="study-today">
							<h2 className="flex flex-wrap items-baseline justify-between gap-x-3 font-ui text-[13px] font-[550] text-ink-2">
								Does today count yet? <span className="text-xs font-[450] text-ink-3">{EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed sentences in Listen</span>
							</h2>
							<ul className="mt-3 grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 font-ui text-[13px]">
								{languages.map((language) => {
									const record = daily.find((d) => d.date === today.date && d.language === language.id);
									return <TodayLine key={language.id} language={language} record={record} />;
								})}
							</ul>
							<div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
								<p className="font-prose text-[13px] text-ink-3">{openCheck ? "A weekly check is open too." : nextCheck ? `Next check: ${dayInWords(nextCheck.date)}.` : "Every weekly check is done."}</p>
								<Link href="/listen" className={cn(SECONDARY, SMALL)}>
									Open Listen
								</Link>
							</div>
						</section>
					)}

					<section className="q-well" data-testid="study-result">
						<h2 className="flex flex-wrap items-baseline justify-between gap-x-3 font-ui text-[13px] font-[550] text-ink-2">
							Result so far <span className="text-xs font-[450] text-ink-3">fixed after day {config.days}</span>
						</h2>
						<p className={cn("mt-2 font-ui text-[22px] font-semibold leading-tight tracking-[-0.02em]", measured ? "text-foreground" : "text-ink-3")}>{RESULT_WORDS[analysis.verdictStatus]}</p>
						<p className="mt-1 font-prose text-[13px] leading-snug text-ink-3">
							{measured
								? `${jumpPoints >= 0 ? "+" : "−"}${Math.abs(jumpPoints).toFixed(1)} points at the switch (a gain needs +${GAIN_NEEDED_POINTS} or more) · p = ${analysis.pValue.toFixed(2)}`
								: `The jump at the switch can be read once ${daysNeeded} days count on each side of it.`}
						</p>
						<dl className="mt-3 flex flex-col gap-2">
							<CountedDays label="Before the switch" have={analysis.baselineDays} need={daysNeeded} />
							<CountedDays label="After the switch" have={analysis.interventionDays} need={daysNeeded} />
						</dl>
					</section>
				</div>

				<section className="mt-8" data-testid="study-daily">
					<h2 className="q-sh">
						Days measured <small>{counted === 0 ? "none yet" : `${counted} count so far`}</small>
					</h2>
					{recent.length === 0 ? (
						<p className="font-prose text-sm text-muted-foreground">No practice on a study day yet. A day counts once it has {EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed sentences in Listen.</p>
					) : (
						<>
							<ul className="divide-y divide-[var(--q-line)]">
								{recent.map((d) => (
									<DayLine key={`${d.date}:${d.language}`} day={d} />
								))}
							</ul>
							{earlier.length > 0 && (
								<details className="group mt-2" data-testid="study-daily-earlier">
									<summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-1 font-ui text-[13px] font-[550] text-ink-3 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
										<ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-180" strokeWidth={1.8} aria-hidden="true" />
										Earlier · {earlier.length} more
									</summary>
									<ul className="divide-y divide-[var(--q-line)]">
										{earlier.map((d) => (
											<DayLine key={`${d.date}:${d.language}`} day={d} />
										))}
									</ul>
								</details>
							)}
						</>
					)}
				</section>

				<section className="mt-8 max-w-3xl border-t pt-5 font-prose text-sm leading-relaxed text-muted-foreground" data-testid="study-method">
					<h2 className="font-ui text-xs font-semibold tracking-wide text-muted-foreground">How the result is decided</h2>
					<p className="mt-3">
						<b className="text-foreground">The measure.</b> Each day, the share of Listen sentences typed right on the first play, with no replay and no look at the text. A day with fewer than {EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed sentences is left out.
					</p>
					<p className="mt-3">
						<b className="text-foreground">The switch day.</b> Drawn at random from days {EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS[0]} to {EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS.at(-1)} before the study began (seed {config.seed}), so the day could not be picked to suit the result.
					</p>
					<p className="mt-3">
						<b className="text-foreground">The rule.</b> Listening first counts as a gain only if the share jumps by {GAIN_NEEDED_POINTS} points or more at the switch, and no other of the {EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS.length} possible switch days shows a bigger jump. On the listening-first plan, {EXPERIMENT_CONSTANTS.COMPLIANCE_THRESHOLD}% of a day&apos;s minutes must be on the allowed tasks. The full protocol is in <code className="font-mono text-[13px]">docs/experiments/input-first-russian.md</code>.
					</p>
				</section>
			</main>
		</div>
	);
}

function Pips({ have, need, stretch = false }: { have: number; need: number; stretch?: boolean }) {
	return (
		<span className="flex gap-[3px]" aria-hidden="true">
			{Array.from({ length: need }, (_, i) => (
				<i key={i} className={cn("h-1.5 rounded-[2px]", stretch ? "min-w-0 flex-1" : "w-4", i < have ? "bg-teal" : "bg-[var(--q-line-2)]")} />
			))}
		</span>
	);
}

function TodayLine({ language, record }: { language: StudyLanguage; record: DailyExperimentRecord | undefined }) {
	const need = EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY;
	const typed = record?.dictationReps ?? 0;
	const share = record?.firstPlayShare ?? null;
	return (
		<li className="contents">
			<span className="text-ink-2">{language.name}</span>
			<Pips have={Math.min(typed, need)} need={need} />
			<span className="text-end tabular-nums text-ink-3">
				{share !== null ? (
					<>
						<span className="max-[359px]:hidden">counts · </span>
						<b className="font-semibold text-foreground">{Math.round(share * 100)}%</b>
					</>
				) : (
					`${typed} of ${need}`
				)}
			</span>
		</li>
	);
}

function CountedDays({ label, have, need }: { label: string; have: number; need: number }) {
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 font-ui text-[13px]">
			<dt className="text-ink-2">{label}</dt>
			<dd className="text-end tabular-nums text-ink-3">{have >= need ? `${have} days` : `${have} of ${need}`}</dd>
			<dd className="col-span-2">
				<Pips have={Math.min(have, need)} need={need} stretch />
			</dd>
		</div>
	);
}

function DayLine({ day }: { day: DailyExperimentRecord }) {
	const share = day.firstPlayShare;
	return (
		<li className="flex items-start justify-between gap-4 py-3">
			<div className="min-w-0">
				<p className="font-ui text-sm font-semibold text-foreground">
					{studyLanguage(day.language).name}
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
