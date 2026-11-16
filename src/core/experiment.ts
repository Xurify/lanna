/**
 * Experiment Core (protocol v3, docs/experiments/input-first-russian.md).
 *
 * Implements the 42-day interrupted time-series single-case experimental design (SCED)
 * comparing an input-first Russian arm against a Slovak normal-plan control series.
 *
 * All logic is pure and deterministic:
 * - Mulberry32 PRNG for reproducible randomization from a fixed seed.
 * - Uniform draw from 11 candidate onset days (days 12 to 22).
 * - Primary measure: daily first-play understanding share in Listen dictation reps.
 * - Weekly check items: 10 listening probe sentences and 5 spoken production prompts.
 * - Interrupted time-series OLS estimation and permutation randomization test.
 */

export interface ExperimentConfig {
	id: string;
	title: string;
	version: string;
	startDate: string; // YYYY-MM-DD
	endDate: string; // YYYY-MM-DD
	days: number;
	seed: number;
	onsetDay: number; // 12..22
	onsetDate: string; // YYYY-MM-DD
	languages: {
		treatment: string;
		control: string;
	};
	protocolHash: string;
	gitCommit: string;
	decisionRule: string;
}

export interface DaySchedule {
	dayNumber: number; // 1..42
	date: string; // YYYY-MM-DD
	phase: "baseline" | "intervention";
	russianArm: "normal" | "input-first";
	slovakArm: "normal";
	weeklyCheckDue: boolean;
	weekNumber?: number; // 1..6 if check is due
}

export interface ProbeItem {
	id: string;
	lemma: string;
	targetSentence: string;
	englishTranslation: string;
	wordCount: number;
	frequencyRank?: number;
}

export interface LanguagePools {
	probePool: ProbeItem[]; // 60 items (10 per week * 6 weeks)
	productionPool: ProbeItem[]; // 30 items (5 per week * 6 weeks)
}

export interface ProbePoolData {
	seed: number;
	createdAt: string;
	russian: LanguagePools;
	slovak: LanguagePools;
}

export interface DailyExperimentRecord {
	date: string; // YYYY-MM-DD
	dayNumber: number;
	language: string;
	phase: "baseline" | "intervention";
	arm: "normal" | "input-first";
	firstPlayShare: number | null; // null if dictationReps < 5
	dictationReps: number;
	understoodReps: number;
	covariates: DayCovariates;
	minutes: number;
	minutesBy: Record<string, number>;
	compliance: number; // percentage (0..100) of minutes in allowed tasks
	compliant: boolean; // >= 90%
}

export interface DayCovariates {
	meanWordsPerSentence: number;
	meanFrequencyRank?: number;
}

export type CovariateName = keyof DayCovariates;

const COVARIATE_NAMES: readonly CovariateName[] = ["meanWordsPerSentence", "meanFrequencyRank"];

export interface CheckItemRecord {
	date: string;
	week: number;
	dayNumber: number;
	language: string;
	type: "probe" | "production";
	itemId: string;
	prompt: string;
	expected: string;
	response: string;
	score: number; // 1 or 0 for probe; 0..1 for production
	verdict: string;
	engine?: string;
}

export interface RegressionResult {
	b0: number; // Baseline intercept
	b1: number; // Baseline slope (trend)
	b2: number; // Immediate level change at onset
	b3: number; // Slope change post-onset
	pValue: number; // Randomization test p-value (e.g. 1/11 = 0.0909)
	baselineDays: number;
	interventionDays: number;
	covariatesUsed: CovariateName[];
	verdictStatus: VerdictStatus;
}

export type VerdictStatus = "pending" | "confirmed_benefit" | "no_effect_or_harm" | "insufficient_data";

export const EXPERIMENT_CONSTANTS = {
	ID: "input-first-russian",
	START_DATE: "2026-11-11",
	TOTAL_DAYS: 42,
	CANDIDATE_ONSETS: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const,
	MIN_DAYS_PER_PHASE: 8,
	MIN_REPS_FOR_VALID_DAY: 5,
	PROBE_ITEMS_PER_WEEK: 10,
	PRODUCTION_ITEMS_PER_WEEK: 5,
	TOTAL_WEEKS: 6,
	COMPLIANCE_THRESHOLD: 90,
	GAIN_NEEDED: 0.1,
	CHECK_WEEKS_NEEDED: 5,
	MAKE_UP_DAYS: 2,
	TIME_TREND_RATIO: 0.5,
	BALANCE_THRESHOLD: 70,
	SPEAKING_COST: 0.1,
} as const;

/** Mulberry32 PRNG: 32-bit state generator for deterministic draws. */
export function createRng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		let t = (s += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Draws onset day from CANDIDATE_ONSETS (12 to 22) uniformly with PRNG. */
export function drawOnsetDay(seed: number): number {
	const rand = createRng(seed);
	const index = Math.floor(rand() * EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS.length);
	return EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS[index]!;
}

/** Computes ISO date (YYYY-MM-DD) from start date and day number (1-indexed). */
export function dateForDayNumber(startDateStr: string, dayNumber: number): string {
	const [y, m, d] = startDateStr.split("-").map(Number);
	const date = new Date(Date.UTC(y!, m! - 1, d! + (dayNumber - 1)));
	return date.toISOString().slice(0, 10);
}

/** Computes day number (1..42) from start date and date string. */
export function dayNumberForDate(startDateStr: string, dateStr: string): number {
	const [y1, m1, d1] = startDateStr.split("-").map(Number);
	const [y2, m2, d2] = dateStr.split("-").map(Number);
	const t1 = Date.UTC(y1!, m1! - 1, d1!);
	const t2 = Date.UTC(y2!, m2! - 1, d2!);
	return Math.floor((t2 - t1) / 86400000) + 1;
}

/** Builds the full 42-day schedule from onset day. */
export function buildSchedule(
	startDateStr: string,
	onsetDay: number,
	totalDays = EXPERIMENT_CONSTANTS.TOTAL_DAYS,
): DaySchedule[] {
	const schedule: DaySchedule[] = [];
	for (let day = 1; day <= totalDays; day++) {
		const date = dateForDayNumber(startDateStr, day);
		const phase = day >= onsetDay ? "intervention" : "baseline";
		const russianArm = day >= onsetDay ? "input-first" : "normal";
		const weeklyCheckDue = day % 7 === 0;
		const weekNumber = weeklyCheckDue ? day / 7 : undefined;

		schedule.push({
			dayNumber: day,
			date,
			phase,
			russianArm,
			slovakArm: "normal",
			weeklyCheckDue,
			weekNumber,
		});
	}
	return schedule;
}

export function dailyRowsWithinSchedule(
	rows: DailyExperimentRecord[],
	schedule: DaySchedule[],
): DailyExperimentRecord[] {
	const dates = new Set(schedule.map((s) => s.date));
	return rows.filter((r) => dates.has(r.date));
}

/**
 * Checks whether a listen rep is first-play understood:
 * - answer or kind is dictation
 * - replays is 0 or absent
 * - peeked is false
 * - verdict is exact or accents
 */
export function isFirstPlayUnderstood(rep: {
	kind?: string;
	answer?: string;
	replays?: number;
	peeked?: boolean;
	verdict?: string;
}): boolean {
	const isDictation = rep.kind === "dictation" || rep.answer === "type";
	if (!isDictation) return false;
	if (rep.peeked === true) return false;
	if (typeof rep.replays === "number" && rep.replays > 0) return false;
	return rep.verdict === "exact" || rep.verdict === "accents";
}

export function calculateCompliance(minutesBy: Record<string, number>): number {
	const { allowed, total } = allowedAndTotal(minutesBy);
	if (total === 0) return 100;
	return Math.round((allowed / total) * 1000) / 10;
}

const ALLOWED_ON_ARM = new Set(["review", "listen", "words", "read", "watch"]);

function allowedAndTotal(minutesBy: Record<string, number>): { allowed: number; total: number } {
	let allowed = 0;
	let total = 0;
	for (const [task, mins] of Object.entries(minutesBy)) {
		if (!(mins > 0)) continue;
		total += mins;
		if (ALLOWED_ON_ARM.has(task)) allowed += mins;
	}
	return { allowed, total };
}

export function usableCovariates(days: DailyExperimentRecord[]): CovariateName[] {
	const valid = days.filter((d) => d.firstPlayShare !== null);
	return COVARIATE_NAMES.filter((name) => {
		const values = valid.map((d) => d.covariates?.[name]);
		if (values.length === 0 || values.some((v) => typeof v !== "number" || !Number.isFinite(v))) return false;
		const known = values as number[];
		return Math.max(...known) - Math.min(...known) > 1e-9;
	});
}

export function fitInterruptedTimeSeries(
	days: DailyExperimentRecord[],
	onsetDay: number,
	covariates: readonly CovariateName[] = [],
): { b0: number; b1: number; b2: number; b3: number } | null {
	const valid = days.filter((d) => d.firstPlayShare !== null);
	const width = 4 + covariates.length;
	if (valid.length < width) return null;
	const means = covariates.map((name) => valid.reduce((sum, d) => sum + d.covariates[name]!, 0) / valid.length);

	const XtX = Array.from({ length: width }, () => new Array<number>(width).fill(0));
	const XtY = new Array<number>(width).fill(0);
	for (const d of valid) {
		const t = d.dayNumber;
		const post = t >= onsetDay ? 1 : 0;
		const x = [1, t, post, post ? t - onsetDay : 0, ...covariates.map((name, i) => d.covariates[name]! - means[i]!)];
		const y = d.firstPlayShare!;
		for (let r = 0; r < width; r++) {
			XtY[r]! += x[r]! * y;
			for (let c = 0; c < width; c++) XtX[r]![c]! += x[r]! * x[c]!;
		}
	}

	const beta = solveLinear(XtX, XtY);
	if (!beta) return null;
	return { b0: beta[0]!, b1: beta[1]!, b2: beta[2]!, b3: beta[3]! };
}

function solveLinear(A: number[][], b: number[]): number[] | null {
	const M = A.map((row, i) => [...row, b[i]!]);
	const n = b.length;

	for (let i = 0; i < n; i++) {
		let maxRow = i;
		for (let k = i + 1; k < n; k++) {
			if (Math.abs(M[k]![i]!) > Math.abs(M[maxRow]![i]!)) maxRow = k;
		}
		if (Math.abs(M[maxRow]![i]!) < 1e-9) return null;

		[M[i], M[maxRow]] = [M[maxRow]!, M[i]!];

		const pivot = M[i]![i]!;
		for (let j = i; j <= n; j++) {
			M[i]![j]! /= pivot;
		}

		for (let k = 0; k < n; k++) {
			if (k === i) continue;
			const factor = M[k]![i]!;
			for (let j = i; j <= n; j++) {
				M[k]![j]! -= factor * M[i]![j]!;
			}
		}
	}

	return M.map((row) => row[n]!);
}

export function runRandomizationTest(days: DailyExperimentRecord[], observedOnset: number): RegressionResult {
	const valid = days.filter((d) => d.firstPlayShare !== null);
	const baselineDays = valid.filter((d) => d.dayNumber < observedOnset).length;
	const interventionDays = valid.filter((d) => d.dayNumber >= observedOnset).length;

	let covariatesUsed = usableCovariates(days);
	let observedFit = fitInterruptedTimeSeries(days, observedOnset, covariatesUsed);
	if (!observedFit && covariatesUsed.length > 0) {
		covariatesUsed = [];
		observedFit = fitInterruptedTimeSeries(days, observedOnset);
	}
	if (
		!observedFit ||
		baselineDays < EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE ||
		interventionDays < EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE
	) {
		return {
			b0: observedFit?.b0 ?? 0,
			b1: observedFit?.b1 ?? 0,
			b2: observedFit?.b2 ?? 0,
			b3: observedFit?.b3 ?? 0,
			pValue: 1.0,
			baselineDays,
			interventionDays,
			covariatesUsed,
			verdictStatus: "insufficient_data",
		};
	}

	const observedB2 = observedFit.b2;
	let rank = 1;
	let tested = 0;

	for (const candidate of EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS) {
		const fit = fitInterruptedTimeSeries(days, candidate, covariatesUsed);
		if (fit) {
			tested++;
			if (fit.b2 > observedB2 + 1e-6) {
				rank++;
			}
		}
	}

	const pValue = tested > 0 ? rank / tested : 1.0;
	const confirmed = observedB2 >= EXPERIMENT_CONSTANTS.GAIN_NEEDED && pValue <= 1 / 11 + 1e-4;

	return {
		b0: observedFit.b0,
		b1: observedFit.b1,
		b2: observedFit.b2,
		b3: observedFit.b3,
		pValue,
		baselineDays,
		interventionDays,
		covariatesUsed,
		verdictStatus: confirmed ? "confirmed_benefit" : "no_effect_or_harm",
	};
}

export interface WeeklyCheckRow {
	week: number;
	date: string;
	language: string;
	state: "done" | "open" | "ahead" | "missed";
	lastDate: string;
	probesUnderstood: number;
	probesAnswered: number;
	/** Mean word match over the production prompts answered, 0..1; null before the first one. */
	productionMatch: number | null;
}

export function weeklyCheckRows(
	config: ExperimentConfig,
	checks: CheckItemRecord[],
	todayDayNumber: number,
): WeeklyCheckRow[] {
	const rows: WeeklyCheckRow[] = [];
	for (let week = 1; week <= EXPERIMENT_CONSTANTS.TOTAL_WEEKS; week++) {
		const checkDay = week * 7;
		for (const language of [config.languages.treatment, config.languages.control]) {
			const latest = new Map<string, CheckItemRecord>();
			for (const c of checks) if (c.week === week && c.language === language) latest.set(`${c.type}:${c.itemId}`, c);
			const probes = [...latest.values()].filter((c) => c.type === "probe");
			const production = [...latest.values()].filter((c) => c.type === "production");
			const done =
				probes.length >= EXPERIMENT_CONSTANTS.PROBE_ITEMS_PER_WEEK &&
				production.length >= EXPERIMENT_CONSTANTS.PRODUCTION_ITEMS_PER_WEEK;
			const lastDay = checkDay + EXPERIMENT_CONSTANTS.MAKE_UP_DAYS;
			rows.push({
				week,
				date: dateForDayNumber(config.startDate, checkDay),
				lastDate: dateForDayNumber(config.startDate, lastDay),
				language,
				state: done ? "done" : todayDayNumber < checkDay ? "ahead" : todayDayNumber <= lastDay ? "open" : "missed",
				probesUnderstood: probes.filter((p) => p.score === 1).length,
				probesAnswered: probes.length,
				productionMatch:
					production.length > 0 ? production.reduce((sum, p) => sum + p.score, 0) / production.length : null,
			});
		}
	}
	return rows;
}

export interface StudyFlags {
	timeTrend: { controlB2: number | null; flagged: boolean };
	compliance: { share: number | null; flagged: boolean };
	balance: { ratio: number | null; flagged: boolean };
}

export interface SpeakingComparison {
	baselineWeeks: number;
	armWeeks: number;
	baselineProduction: number | null;
	armProduction: number | null;
	baselineProbe: number | null;
	armProbe: number | null;
	cost: boolean;
}

export interface StudyAnalysis {
	regression: RegressionResult;
	checkWeeksDone: number;
	flags: StudyFlags;
	speaking: SpeakingComparison;
	verdictStatus: VerdictStatus;
}

function fitWithUsableCovariates(days: DailyExperimentRecord[], onsetDay: number) {
	return fitInterruptedTimeSeries(days, onsetDay, usableCovariates(days)) ?? fitInterruptedTimeSeries(days, onsetDay);
}

const mean = (values: number[]): number | null =>
	values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

export function analyzeStudy(
	config: ExperimentConfig,
	daily: DailyExperimentRecord[],
	checks: CheckItemRecord[],
	todayDayNumber: number,
): StudyAnalysis {
	const { treatment, control } = config.languages;
	const elapsed = (d: DailyExperimentRecord) => d.dayNumber <= Math.min(todayDayNumber, config.days);
	const treatmentDays = daily.filter((d) => d.language === treatment && elapsed(d));
	const controlDays = daily.filter((d) => d.language === control && elapsed(d));
	const regression = runRandomizationTest(treatmentDays, config.onsetDay);

	const controlFit = fitWithUsableCovariates(controlDays, config.onsetDay);
	const controlB2 = controlFit ? controlFit.b2 : null;
	const timeTrend = {
		controlB2,
		flagged:
			controlB2 !== null && regression.b2 > 0 && controlB2 >= EXPERIMENT_CONSTANTS.TIME_TREND_RATIO * regression.b2,
	};

	const armDays = treatmentDays.filter((d) => d.arm === "input-first");
	const armMinutes = armDays
		.map((d) => allowedAndTotal(d.minutesBy ?? {}))
		.reduce((sum, m) => ({ allowed: sum.allowed + m.allowed, total: sum.total + m.total }), { allowed: 0, total: 0 });
	const complianceShare = armMinutes.total > 0 ? Math.round((armMinutes.allowed / armMinutes.total) * 1000) / 10 : null;
	const compliance = {
		share: complianceShare,
		flagged: complianceShare !== null && complianceShare < EXPERIMENT_CONSTANTS.COMPLIANCE_THRESHOLD,
	};

	const baselineMinutes = mean(treatmentDays.filter((d) => d.arm !== "input-first").map((d) => d.minutes));
	const armMinutesPerDay = mean(armDays.map((d) => d.minutes));
	const balanceRatio =
		baselineMinutes !== null && baselineMinutes > 0 && armMinutesPerDay !== null
			? Math.round((armMinutesPerDay / baselineMinutes) * 1000) / 10
			: null;
	const balance = {
		ratio: balanceRatio,
		flagged: balanceRatio !== null && balanceRatio < EXPERIMENT_CONSTANTS.BALANCE_THRESHOLD,
	};

	const doneWeeks = weeklyCheckRows(config, checks, todayDayNumber).filter(
		(r) => r.language === treatment && r.state === "done",
	);
	const isArmWeek = (week: number) => week * 7 >= config.onsetDay;
	const baselineWeeks = doneWeeks.filter((r) => !isArmWeek(r.week));
	const armWeeks = doneWeeks.filter((r) => isArmWeek(r.week));
	const probeShare = (r: WeeklyCheckRow) => (r.probesAnswered > 0 ? r.probesUnderstood / r.probesAnswered : 0);
	const baselineProduction = mean(baselineWeeks.map((r) => r.productionMatch ?? 0));
	const armProduction = mean(armWeeks.map((r) => r.productionMatch ?? 0));
	const speaking: SpeakingComparison = {
		baselineWeeks: baselineWeeks.length,
		armWeeks: armWeeks.length,
		baselineProduction,
		armProduction,
		baselineProbe: mean(baselineWeeks.map(probeShare)),
		armProbe: mean(armWeeks.map(probeShare)),
		cost:
			baselineProduction !== null &&
			armProduction !== null &&
			baselineProduction - armProduction >= EXPERIMENT_CONSTANTS.SPEAKING_COST - 1e-9,
	};

	const verdictStatus: VerdictStatus =
		regression.verdictStatus === "insufficient_data" || doneWeeks.length < EXPERIMENT_CONSTANTS.CHECK_WEEKS_NEEDED
			? "insufficient_data"
			: regression.verdictStatus;
	return {
		regression,
		checkWeeksDone: doneWeeks.length,
		flags: { timeTrend, compliance, balance },
		speaking,
		verdictStatus,
	};
}

export interface DeviationRecord {
	key: string;
	kind: "missed-day" | "missed-check" | "measure-changed";
	date: string;
	language?: string;
	note: string;
}

export function scheduleDeviations(
	config: ExperimentConfig,
	schedule: DaySchedule[],
	daily: DailyExperimentRecord[],
	checks: CheckItemRecord[],
	todayDayNumber: number,
): DeviationRecord[] {
	const languages = [config.languages.treatment, config.languages.control];
	const out: DeviationRecord[] = [];
	for (const day of schedule) {
		if (day.dayNumber >= todayDayNumber) break;
		for (const language of languages) {
			const reps = daily.find((d) => d.date === day.date && d.language === language)?.dictationReps ?? 0;
			if (reps >= EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY) continue;
			out.push({
				key: `missed-day:${day.date}:${language}`,
				kind: "missed-day",
				date: day.date,
				language,
				note: `${reps} of the ${EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY} typed Listen sentences a day needs`,
			});
		}
	}
	for (const row of weeklyCheckRows(config, checks, todayDayNumber)) {
		if (row.state !== "missed") continue;
		out.push({
			key: `missed-check:${row.week}:${row.language}`,
			kind: "missed-check",
			date: row.lastDate,
			language: row.language,
			note: `week ${row.week} check not finished by ${row.lastDate} (${row.probesAnswered} sentences answered)`,
		});
	}
	return out;
}

export function generateSummaryMarkdown(
	config: ExperimentConfig,
	schedule: DaySchedule[],
	dailyRecords: DailyExperimentRecord[],
	checkRecords: CheckItemRecord[],
	study: StudyAnalysis,
	todayDateStr?: string,
): string {
	const analysis = study.regression;
	const points = (share: number | null) => (share === null ? "n/a" : `${Math.round(share * 1000) / 10}%`);
	const flag = (flagged: boolean) => (flagged ? "**FLAGGED**" : "ok");
	const currentSchedule = todayDateStr ? schedule.find((s) => s.date === todayDateStr) : schedule[0];
	const currentPhase = currentSchedule?.phase ?? "baseline";
	const lines: string[] = [];
	lines.push(`# Experiment Progress: Input-First Russian vs Slovak Control`);
	lines.push(``);
	lines.push(`- **Study Duration**: 42 days (${config.startDate} to ${config.endDate})`);
	lines.push(`- **Randomized Onset Day**: Day ${config.onsetDay} (${config.onsetDate})`);
	lines.push(`- **Current Phase**: ${currentPhase.toUpperCase()} (Day ${currentSchedule?.dayNumber ?? 1} of 42)`);
	lines.push(`- **Seed**: ${config.seed} (Commit: \`${config.gitCommit.slice(0, 8)}\`)`);
	lines.push(`- **Protocol SHA256**: \`${config.protocolHash.slice(0, 16)}...\``);
	lines.push(``);
	lines.push(`## Statistical Status`);
	lines.push(``);
	lines.push(
		`- **Baseline Valid Days**: ${analysis.baselineDays} / ${EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE} required`,
	);
	lines.push(
		`- **Intervention Valid Days**: ${analysis.interventionDays} / ${EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE} required`,
	);
	lines.push(`- **Immediate Level Shift ($b_2$)**: ${(analysis.b2 * 100).toFixed(1)} percentage points`);
	lines.push(`- **Randomization p-value**: ${analysis.pValue.toFixed(4)} (Threshold: ${(1 / 11).toFixed(4)})`);
	lines.push(
		`- **Covariates in the model**: ${analysis.covariatesUsed.length > 0 ? analysis.covariatesUsed.join(", ") : "none (not yet varying across counted days)"}`,
	);
	lines.push(
		`- **Weekly checks done (${config.languages.treatment})**: ${study.checkWeeksDone} / ${EXPERIMENT_CONSTANTS.CHECK_WEEKS_NEEDED} required`,
	);
	lines.push(`- **Current Verdict**: **${study.verdictStatus.toUpperCase()}**`);
	lines.push(``);
	lines.push(`## Flags (printed beside the verdict, never change it)`);
	lines.push(``);
	lines.push(
		`- **Time trend**: ${config.languages.control} level change at the same day ${study.flags.timeTrend.controlB2 === null ? "n/a" : `${(study.flags.timeTrend.controlB2 * 100).toFixed(1)} pp`} against ${(analysis.b2 * 100).toFixed(1)} pp: ${flag(study.flags.timeTrend.flagged)}`,
	);
	lines.push(
		`- **Compliance**: ${study.flags.compliance.share === null ? "n/a" : `${study.flags.compliance.share}%`} of listening-first minutes on allowed tasks (needs ${EXPERIMENT_CONSTANTS.COMPLIANCE_THRESHOLD}%): ${flag(study.flags.compliance.flagged)}`,
	);
	lines.push(
		`- **Balance**: listening-first days at ${study.flags.balance.ratio === null ? "n/a" : `${study.flags.balance.ratio}%`} of the minutes a day before the switch (needs ${EXPERIMENT_CONSTANTS.BALANCE_THRESHOLD}%): ${flag(study.flags.balance.flagged)}`,
	);
	lines.push(``);
	lines.push(`## Speaking (descriptive, not tested)`);
	lines.push(``);
	lines.push(
		`- **Production**: ${points(study.speaking.baselineProduction)} before the switch (n=${study.speaking.baselineWeeks}) against ${points(study.speaking.armProduction)} after (n=${study.speaking.armWeeks})${study.speaking.cost ? " — **speaking cost (descriptive)**" : ""}`,
	);
	lines.push(
		`- **Listening probe**: ${points(study.speaking.baselineProbe)} before against ${points(study.speaking.armProbe)} after`,
	);
	lines.push(``);
	lines.push(`## Weekly Checks Summary`);
	lines.push(``);
	lines.push(`| Week | Date | Lang | Probe (10 items) | Production (5 items) | Status |`);
	lines.push(`|---|---|---|---|---|---|`);

	for (let w = 1; w <= EXPERIMENT_CONSTANTS.TOTAL_WEEKS; w++) {
		const checkDate = dateForDayNumber(config.startDate, w * 7);
		for (const lang of [config.languages.treatment, config.languages.control]) {
			const items = checkRecords.filter((c) => c.week === w && c.language === lang);
			const probes = items.filter((c) => c.type === "probe");
			const prods = items.filter((c) => c.type === "production");

			const probeScore =
				probes.length > 0 ? `${probes.filter((p) => p.score === 1).length}/${probes.length}` : "pending";
			const prodAvg =
				prods.length > 0 ? `${Math.round((prods.reduce((a, b) => a + b.score, 0) / prods.length) * 100)}%` : "pending";
			const status = probes.length === 10 && prods.length === 5 ? "Completed" : "Scheduled";

			lines.push(`| W${w} | ${checkDate} | ${lang} | ${probeScore} | ${prodAvg} | ${status} |`);
		}
	}

	lines.push(``);
	lines.push(`## Daily Log (Recent 14 Days)`);
	lines.push(``);
	lines.push(`| Day | Date | Lang | Phase | Arm | 1st-Play Share | Reps | Minutes | Compliance |`);
	lines.push(`|---|---|---|---|---|---|---|---|---|`);

	const sortedDays = [...dailyRecords].sort(
		(a, b) => b.dayNumber - a.dayNumber || a.language.localeCompare(b.language),
	);
	const recent = sortedDays.slice(0, 28);

	if (recent.length === 0) {
		lines.push(`| - | - | - | - | - | - | - | - | - |`);
	} else {
		for (const r of recent) {
			const share = r.firstPlayShare !== null ? `${Math.round(r.firstPlayShare * 100)}%` : "N/A (<5)";
			lines.push(
				`| D${r.dayNumber} | ${r.date} | ${r.language} | ${r.phase} | ${r.arm} | ${share} | ${r.dictationReps} | ${r.minutes}m | ${r.compliance}% |`,
			);
		}
	}

	lines.push(``);
	lines.push(`*Generated automatically by LangHarness experiment tracker.*`);
	return lines.join("\n");
}

export interface StudyLanguageToday {
	id: string;
	dictationReps: number;
	understoodReps: number;
	validDay: boolean;
	firstPlayShare: number | null;
}

export interface TodayExperimentStatus {
	active: boolean;
	startDate: string;
	endDate: string;
	dayNumber: number;
	totalDays: number;
	phase: "baseline" | "intervention";
	russianArm: "normal" | "input-first";
	slovakArm: "normal";
	weeklyCheckDue: boolean;
	weeklyCheckCompleted: boolean;
	weekNumber: number;
	oldestOpenCheck: { week: number; language: string } | null;
	checkLastDate: string | null;
	treatment: string;
	runningLanguage: string;
	validDay: boolean;
	languages: StudyLanguageToday[];
	runningLanguageReps: StudyLanguageToday | null;
	russian: {
		dictationReps: number;
		understoodReps: number;
		validDay: boolean;
		firstPlayShare: number | null;
	};
	slovak: {
		dictationReps: number;
		understoodReps: number;
		validDay: boolean;
		firstPlayShare: number | null;
	};
}
