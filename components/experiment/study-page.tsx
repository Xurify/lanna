import Link from "next/link";
import { ArrowLeftIcon, ChevronDownIcon } from "lucide-react";
import { SidebarToggle } from "@/components/sidebar";
import { PRIMARY, SECONDARY, SMALL } from "@/components/ui/learn-buttons";
import { cn } from "@/lib/utils";
import { StudyChart } from "@/components/experiment/study-chart";
import { ListenInLanguage } from "@/components/experiment/listen-in-language";
import { CHECK_ROUTE, studyLanguage, type StudyLanguage } from "@/components/experiment/study-language";
import {
	EXPERIMENT_CONSTANTS,
	weeklyCheckRows,
	type CheckItemRecord,
	type DailyExperimentRecord,
	type DaySchedule,
	type DeviationRecord,
	type ExperimentConfig,
	type StudyAnalysis,
	type VerdictStatus,
} from "@/src/core";

const DAYS_LISTED = 14;
const GAIN_NEEDED_POINTS = EXPERIMENT_CONSTANTS.GAIN_NEEDED * 100;
const FIRST_CANDIDATE = EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS[0];
const LAST_CANDIDATE = EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS[EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS.length - 1]!;

export interface StudyPageProps {
	config: ExperimentConfig;
	schedule: DaySchedule[];
	daily: DailyExperimentRecord[];
	checks: CheckItemRecord[];
	study: StudyAnalysis;
	deviations: Array<DeviationRecord & { at?: string }>;
	today: { date: string; dayNumber: number };
	runningLanguage: string;
}

function dayInWords(iso: string): string {
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function dateInWords(iso: string): string {
	return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const RESULT_WORDS: Record<VerdictStatus, string> = {
	insufficient_data: "Too early to say",
	pending: "Too early to say",
	confirmed_benefit: "Listening first helped",
	no_effect_or_harm: "No clear gain",
};

function whereItStands(config: ExperimentConfig, todayDay: number, treatment: string): string {
	if (todayDay < 1) return `It starts on ${dayInWords(config.startDate)}.`;
	if (todayDay > config.days) return `It ended on ${dayInWords(config.endDate)}.`;
	if (todayDay < config.onsetDay) {
		return `Day ${todayDay} of ${config.days}. ${treatment} is on the normal plan. On a day drawn at random between ${dayInWords(dateOf(config, FIRST_CANDIDATE))} and ${dayInWords(dateOf(config, LAST_CANDIDATE))}, its plan switches to listening first by itself.`;
	}
	return `Day ${todayDay} of ${config.days}. ${treatment} has been listening first since ${dayInWords(config.onsetDate)}: no lessons, speaking or speed drills.`;
}

function dateOf(config: ExperimentConfig, dayNumber: number): string {
	const [y, m, d] = config.startDate.split("-").map(Number);
	return new Date(Date.UTC(y!, m! - 1, d! + dayNumber - 1)).toISOString().slice(0, 10);
}

const signedPoints = (share: number) => `${share >= 0 ? "+" : "−"}${Math.abs(share * 100).toFixed(1)}`;
const percent = (share: number | null) => (share === null ? "—" : `${Math.round(share * 100)}%`);

export function StudyPage({
	config,
	schedule,
	daily,
	checks,
	study,
	deviations,
	today,
	runningLanguage,
}: StudyPageProps) {
	const analysis = study.regression;
	const treatment = studyLanguage(config.languages.treatment);
	const control = studyLanguage(config.languages.control);
	const languages = [treatment, control];
	const rows = weeklyCheckRows(config, checks, today.dayNumber);
	const openCheck = rows.find((r) => r.state === "open");
	const nextCheck = rows.find((r) => r.state === "ahead");
	const running = today.dayNumber >= 1 && today.dayNumber <= config.days;
	const switched = today.dayNumber >= config.onsetDay;
	const measured = analysis.verdictStatus === "confirmed_benefit" || analysis.verdictStatus === "no_effect_or_harm";
	const decided = study.verdictStatus === "confirmed_benefit" || study.verdictStatus === "no_effect_or_harm";
	const weeksNeeded = EXPERIMENT_CONSTANTS.CHECK_WEEKS_NEEDED;
	const practiced = daily.filter((d) => d.dictationReps > 0 || d.minutes > 0);
	const counted = practiced.filter((d) => d.firstPlayShare !== null).length;
	const newestFirst = [...practiced].sort((a, b) => b.dayNumber - a.dayNumber || a.language.localeCompare(b.language));
	const recent = newestFirst.slice(0, DAYS_LISTED);
	const earlier = newestFirst.slice(DAYS_LISTED);
	const daysNeeded = EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE;
	const firstShort = languages.find(
		(l) =>
			(daily.find((d) => d.date === today.date && d.language === l.id)?.dictationReps ?? 0) <
			EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY,
	);

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
				<p className="mt-2 max-w-2xl text-[20px] font-semibold leading-[1.3] tracking-[-0.018em] text-foreground">
					Does listening first make {treatment.name} easier to follow?
				</p>
				<p className="q-line dim mt-2 max-w-2xl" data-testid="study-stands">
					{whereItStands(config, today.dayNumber, treatment.name)} {control.name} keeps the normal plan the whole time,
					so the two can be compared.
				</p>

				{openCheck && (
					<section
						className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl bg-teal-wash px-5 py-4 shadow-[inset_0_0_0_1px_var(--q-teal-line)]"
						data-testid="study-check-due"
					>
						<div className="min-w-0 flex-1">
							<h2 className="font-ui text-base font-semibold text-foreground">
								The week {openCheck.week} check in {studyLanguage(openCheck.language).name} is open
							</h2>
							<p className="mt-0.5 font-prose text-sm text-ink-2">
								{EXPERIMENT_CONSTANTS.PROBE_ITEMS_PER_WEEK} sentences to hear once and type, then{" "}
								{EXPERIMENT_CONSTANTS.PRODUCTION_ITEMS_PER_WEEK} to say yourself. Open through{" "}
								{dayInWords(openCheck.lastDate)}.
							</p>
						</div>
						<Link
							href={`${CHECK_ROUTE}?week=${openCheck.week}&lang=${openCheck.language}`}
							className={PRIMARY}
							data-testid="study-check-start"
						>
							Start the check
						</Link>
					</section>
				)}

				<div className="mt-6">
					<StudyChart
						days={schedule.map((s) => ({ dayNumber: s.dayNumber, label: dayInWords(s.date) }))}
						daily={daily}
						checks={rows}
						todayDay={today.dayNumber}
						treatment={treatment}
						control={control}
						onsetDay={switched ? config.onsetDay : null}
						switchWindow={{ from: FIRST_CANDIDATE, to: LAST_CANDIDATE }}
						switchLabel={switched ? `switched · ${dateInWords(config.onsetDate)}` : "the switch falls in here"}
						fit={measured ? { b0: analysis.b0, b1: analysis.b1, b2: analysis.b2, b3: analysis.b3 } : null}
						minReps={EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY}
					/>
				</div>

				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					{running && (
						<section className="q-well" data-testid="study-today">
							<h2 className="flex flex-wrap items-baseline justify-between gap-x-3 font-ui text-[13px] font-[550] text-ink-2">
								Does today count yet?{" "}
								<span className="text-xs font-[450] text-ink-3">
									{EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed sentences in Listen
								</span>
							</h2>
							<ul className="mt-3 grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 font-ui text-[13px]">
								{languages.map((language) => {
									const record = daily.find((d) => d.date === today.date && d.language === language.id);
									return <TodayLine key={language.id} language={language} record={record} />;
								})}
							</ul>
							<div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
								<p className="font-prose text-[13px] text-ink-3">
									{openCheck
										? "A weekly check is open too."
										: nextCheck
											? `Next check: ${dayInWords(nextCheck.date)}.`
											: "Every weekly check is done."}
								</p>
								<ListenInLanguage
									language={studyLanguage(firstShort?.id ?? treatment.id)}
									running={runningLanguage}
									className={cn(SECONDARY, SMALL)}
									testId="study-today-listen"
								>
									Open {studyLanguage(firstShort?.id ?? treatment.id).name} Listen
								</ListenInLanguage>
							</div>
						</section>
					)}

					<section className="q-well" data-testid="study-result">
						<h2 className="flex flex-wrap items-baseline justify-between gap-x-3 font-ui text-[13px] font-[550] text-ink-2">
							Result so far <span className="text-xs font-[450] text-ink-3">fixed after day {config.days}</span>
						</h2>
						<p
							className={cn(
								"mt-2 font-ui text-[22px] font-semibold leading-tight tracking-[-0.02em]",
								decided ? "text-foreground" : "text-ink-3",
							)}
						>
							{RESULT_WORDS[study.verdictStatus]}
						</p>
						<p className="mt-1 font-prose text-[13px] leading-snug text-ink-3">
							{measured
								? `${signedPoints(analysis.b2)} points at the switch so far (a gain needs +${GAIN_NEEDED_POINTS} or more) · p = ${analysis.pValue.toFixed(2)}`
								: `The jump at the switch can be read once ${daysNeeded} days count on each side of it.`}
						</p>
						<dl className="mt-3 flex flex-col gap-2">
							<CountedDays label="Before the switch" have={analysis.baselineDays} need={daysNeeded} />
							<CountedDays label="After the switch" have={analysis.interventionDays} need={daysNeeded} />
							<CountedDays
								label={`Weekly checks in ${treatment.name}`}
								have={study.checkWeeksDone}
								need={weeksNeeded}
								unit="weeks"
							/>
						</dl>
						{measured && <ResultChecks study={study} control={control.name} />}
					</section>
				</div>

				<section className="mt-8" data-testid="study-daily">
					<h2 className="q-sh">
						Days measured <small>{counted === 0 ? "none yet" : `${counted} count so far`}</small>
					</h2>
					{recent.length === 0 ? (
						<p className="font-prose text-sm text-muted-foreground">
							No practice on a study day yet. A day counts once it has {EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY}{" "}
							typed sentences in Listen.
						</p>
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
										<ChevronDownIcon
											className="size-3.5 transition-transform group-open:rotate-180"
											strokeWidth={1.8}
											aria-hidden="true"
										/>
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

				<section
					className="mt-8 max-w-3xl border-t pt-5 font-prose text-sm leading-relaxed text-muted-foreground"
					data-testid="study-method"
				>
					<h2 className="font-ui text-xs font-semibold tracking-wide text-muted-foreground">
						How the result is decided
					</h2>
					<p className="mt-3">
						<b className="text-foreground">The measure.</b> Each day, the share of Listen sentences typed right on the
						first play, with no replay and no look at the text. A day with fewer than{" "}
						{EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed sentences is left out.
					</p>
					<p className="mt-3">
						<b className="text-foreground">The switch day.</b> Drawn at random from days {FIRST_CANDIDATE} to{" "}
						{LAST_CANDIDATE} before the study began (seed {config.seed}), so the day could not be picked to suit the
						result. This page names it once it has come.
					</p>
					<p className="mt-3">
						<b className="text-foreground">The rule.</b> Listening first counts as a gain only if the share jumps by{" "}
						{GAIN_NEEDED_POINTS} points or more at the switch, no other of the{" "}
						{EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS.length} possible switch days shows a bigger jump, {daysNeeded} days
						count on each side, and {weeksNeeded} weekly checks are done. The jump is read with the day&apos;s sentence
						length and word frequency held level, because the sentences get harder as more words are known. The full
						protocol is in <code className="font-mono text-[13px]">docs/experiments/input-first-russian.md</code>.
					</p>
					<p className="mt-3">
						<b className="text-foreground">What is printed beside it.</b> Whether {control.name} jumped at the same day
						too (half of {treatment.name}&apos;s jump or more would mean the calendar, not the plan), whether{" "}
						{EXPERIMENT_CONSTANTS.COMPLIANCE_THRESHOLD}% of the listening-first minutes went to allowed tasks, whether
						practice stayed at {EXPERIMENT_CONSTANTS.BALANCE_THRESHOLD}% or more of its level before the switch, and the
						words right when speaking in the weekly checks. None of these changes the result.
					</p>
					<Deviations deviations={deviations} />
				</section>
			</main>
		</div>
	);
}

function Pips({ have, need, stretch = false }: { have: number; need: number; stretch?: boolean }) {
	return (
		<span className="flex gap-[3px]" aria-hidden="true">
			{Array.from({ length: need }, (_, i) => (
				<i
					key={i}
					className={cn(
						"h-1.5 rounded-[2px]",
						stretch ? "min-w-0 flex-1" : "w-4",
						i < have ? "bg-teal" : "bg-[var(--q-line-2)]",
					)}
				/>
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

const DEVIATION_WORDS: Record<DeviationRecord["kind"], string> = {
	"missed-day": "Day short",
	"missed-check": "Check missed",
	"measure-changed": "Measure changed",
};

function Deviations({ deviations }: { deviations: Array<DeviationRecord & { at?: string }> }) {
	return (
		<details className="group mt-3" data-testid="study-deviations">
			<summary className="flex cursor-pointer list-none items-center gap-1.5 font-ui text-[13px] font-[550] text-ink-3 hover:text-ink-2 [&::-webkit-details-marker]:hidden">
				<ChevronDownIcon
					className="size-3.5 transition-transform group-open:rotate-180"
					strokeWidth={1.8}
					aria-hidden="true"
				/>
				Deviations logged · {deviations.length === 0 ? "none" : deviations.length}
			</summary>
			<p className="mt-2">
				Written by the app as it sees them: a past day without enough Listen in a language, a weekly check not finished
				in time, or a change to the code or word lists that decide what counts as understood.
			</p>
			{deviations.length > 0 && (
				<ul className="mt-2 divide-y divide-[var(--q-line)]">
					{[...deviations].reverse().map((d, i) => (
						<li key={d.key ?? i} className="flex flex-wrap gap-x-3 py-2 font-ui text-[13px]">
							<span className="font-[550] text-ink-2">{DEVIATION_WORDS[d.kind] ?? d.kind}</span>
							<span className="tabular-nums text-ink-3">{dayInWords(d.date)}</span>
							{d.language && <span className="text-ink-3">{studyLanguage(d.language).name}</span>}
							<span className="basis-full text-ink-3">{d.note}</span>
						</li>
					))}
				</ul>
			)}
		</details>
	);
}

function ResultChecks({ study, control }: { study: StudyAnalysis; control: string }) {
	const { timeTrend, compliance, balance } = study.flags;
	const { speaking } = study;
	const lines: Array<{ key: string; label: string; value: string; flagged: boolean }> = [
		{
			key: "trend",
			label: `${control} at the same day`,
			value: timeTrend.controlB2 === null ? "—" : `${signedPoints(timeTrend.controlB2)} points`,
			flagged: timeTrend.flagged,
		},
		{
			key: "compliance",
			label: "Time on allowed tasks",
			value: compliance.share === null ? "—" : `${compliance.share}%`,
			flagged: compliance.flagged,
		},
		{
			key: "balance",
			label: "Practice kept up after the switch",
			value: balance.ratio === null ? "—" : `${balance.ratio}%`,
			flagged: balance.flagged,
		},
	];
	return (
		<div className="mt-4 border-t border-[var(--q-line)] pt-3" data-testid="study-flags">
			<ul className="flex flex-col gap-1.5 font-ui text-[13px]">
				{lines.map((line) => (
					<li key={line.key} className="flex items-baseline justify-between gap-3">
						<span className="text-ink-2">{line.label}</span>
						<span className={cn("tabular-nums", line.flagged ? "font-semibold text-miss" : "text-ink-3")}>
							{line.value}
							{line.flagged && " · flagged"}
						</span>
					</li>
				))}
				<li className="flex items-baseline justify-between gap-3">
					<span className="text-ink-2">Words right when speaking</span>
					<span className={cn("tabular-nums", speaking.cost ? "font-semibold text-miss" : "text-ink-3")}>
						{percent(speaking.baselineProduction)} before · {percent(speaking.armProduction)} after
					</span>
				</li>
			</ul>
		</div>
	);
}

function CountedDays({
	label,
	have,
	need,
	unit = "days",
}: {
	label: string;
	have: number;
	need: number;
	unit?: string;
}) {
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5 font-ui text-[13px]">
			<dt className="text-ink-2">{label}</dt>
			<dd className="text-end tabular-nums text-ink-3">{have >= need ? `${have} ${unit}` : `${have} of ${need}`}</dd>
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
					{share === null
						? `${day.dictationReps} of the ${EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed sentences a day needs`
						: `${day.understoodReps} of ${day.dictationReps} typed sentences understood on the first play`}
					{" · "}
					{day.minutes} min · {day.arm === "input-first" ? "listening first" : "normal plan"}
					{day.arm === "input-first" && (
						<>
							{" · "}
							<span className={cn(!day.compliant && "text-miss")}>
								{day.compliance}% of the time on allowed tasks
								{!day.compliant && ` (needs ${EXPERIMENT_CONSTANTS.COMPLIANCE_THRESHOLD}%)`}
							</span>
						</>
					)}
				</p>
			</div>
			<p
				className={cn(
					"shrink-0 font-ui text-[16px] font-semibold tabular-nums tracking-[-0.01em]",
					share === null ? "text-muted-foreground" : "text-foreground",
				)}
			>
				{share === null ? "—" : `${Math.round(share * 100)}%`}
			</p>
		</li>
	);
}
