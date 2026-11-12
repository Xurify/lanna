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
	covariates: {
		meanWordsPerSentence: number;
		meanFrequencyRank?: number;
	};
	minutes: number;
	minutesBy: Record<string, number>;
	compliance: number; // percentage (0..100) of minutes in allowed tasks
	compliant: boolean; // >= 90%
}

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
	verdictStatus: "pending" | "confirmed_benefit" | "no_effect_or_harm" | "insufficient_data";
}

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
export function buildSchedule(startDateStr: string, onsetDay: number, totalDays = EXPERIMENT_CONSTANTS.TOTAL_DAYS): DaySchedule[] {
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

export function dailyRowsWithinSchedule(rows: DailyExperimentRecord[], schedule: DaySchedule[]): DailyExperimentRecord[] {
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

/**
 * Calculates compliance percentage for a day on the input-first arm.
 * Allowed tasks on input-first arm: review, listen, words, read, watch.
 * Forbidden: lesson, strengthen, blitz, speak, fluency.
 */
export function calculateCompliance(minutesBy: Record<string, number>): number {
	const ALLOWED = new Set(["review", "listen", "words", "read", "watch"]);
	let allowedMinutes = 0;
	let totalMinutes = 0;

	for (const [task, mins] of Object.entries(minutesBy)) {
		if (mins <= 0) continue;
		totalMinutes += mins;
		if (ALLOWED.has(task)) {
			allowedMinutes += mins;
		}
	}

	if (totalMinutes === 0) return 100;
	return Math.round((allowedMinutes / totalMinutes) * 1000) / 10;
}

/**
 * Fits linear interrupted time series regression via OLS:
 * Y_t = b0 + b1 * t + b2 * D_t(k) + b3 * (t - k) * D_t(k)
 * where D_t(k) = 1 if t >= k else 0.
 */
export function fitInterruptedTimeSeries(days: DailyExperimentRecord[], onsetDay: number): { b0: number; b1: number; b2: number; b3: number } | null {
	const valid = days.filter((d) => d.firstPlayShare !== null);
	if (valid.length < 4) return null;

	const n = valid.length;
	const X: number[][] = [];
	const Y: number[] = [];

	for (const d of valid) {
		const t = d.dayNumber;
		const post = t >= onsetDay ? 1 : 0;
		const postTrend = post ? t - onsetDay : 0;
		X.push([1, t, post, postTrend]);
		Y.push(d.firstPlayShare!);
	}

	const XtX: number[][] = [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
	];
	const XtY: number[] = [0, 0, 0, 0];

	for (let i = 0; i < n; i++) {
		const x = X[i]!;
		const y = Y[i]!;
		for (let r = 0; r < 4; r++) {
			XtY[r]! += x[r]! * y;
			for (let c = 0; c < 4; c++) {
				XtX[r]![c]! += x[r]! * x[c]!;
			}
		}
	}

	const beta = solve4x4(XtX, XtY);
	if (!beta) return null;
	return { b0: beta[0]!, b1: beta[1]!, b2: beta[2]!, b3: beta[3]! };
}

function solve4x4(A: number[][], b: number[]): number[] | null {
	const M = A.map((row, i) => [...row, b[i]!]);
	const n = 4;

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

	return [M[0]![n]!, M[1]![n]!, M[2]![n]!, M[3]![n]!];
}

/**
 * Runs the exact permutation randomization test over the 11 candidate onsets (12..22).
 */
export function runRandomizationTest(days: DailyExperimentRecord[], observedOnset: number): RegressionResult {
	const valid = days.filter((d) => d.firstPlayShare !== null);
	const baselineDays = valid.filter((d) => d.dayNumber < observedOnset).length;
	const interventionDays = valid.filter((d) => d.dayNumber >= observedOnset).length;

	const observedFit = fitInterruptedTimeSeries(days, observedOnset);
	if (!observedFit || baselineDays < EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE || interventionDays < EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE) {
		return {
			b0: observedFit?.b0 ?? 0,
			b1: observedFit?.b1 ?? 0,
			b2: observedFit?.b2 ?? 0,
			b3: observedFit?.b3 ?? 0,
			pValue: 1.0,
			baselineDays,
			interventionDays,
			verdictStatus: "insufficient_data",
		};
	}

	const observedB2 = observedFit.b2;
	let rank = 1;
	let tested = 0;

	for (const candidate of EXPERIMENT_CONSTANTS.CANDIDATE_ONSETS) {
		const fit = fitInterruptedTimeSeries(days, candidate);
		if (fit) {
			tested++;
			if (fit.b2 > observedB2 + 1e-6) {
				rank++;
			}
		}
	}

	const pValue = tested > 0 ? rank / tested : 1.0;
	const confirmed = observedB2 >= 0.10 && pValue <= 1 / 11 + 1e-4;

	return {
		b0: observedFit.b0,
		b1: observedFit.b1,
		b2: observedFit.b2,
		b3: observedFit.b3,
		pValue,
		baselineDays,
		interventionDays,
		verdictStatus: confirmed ? "confirmed_benefit" : "no_effect_or_harm",
	};
}

export interface WeeklyCheckRow {
	week: number;
	date: string;
	language: string;
	state: "done" | "open" | "ahead";
	probesUnderstood: number;
	probesAnswered: number;
	/** Mean word match over the production prompts answered, 0..1; null before the first one. */
	productionMatch: number | null;
}

/** One row per week and language. A check opens on its own day; an item answered twice counts once, with its latest answer. */
export function weeklyCheckRows(config: ExperimentConfig, checks: CheckItemRecord[], todayDayNumber: number): WeeklyCheckRow[] {
	const rows: WeeklyCheckRow[] = [];
	for (let week = 1; week <= EXPERIMENT_CONSTANTS.TOTAL_WEEKS; week++) {
		const checkDay = week * 7;
		for (const language of [config.languages.treatment, config.languages.control]) {
			const latest = new Map<string, CheckItemRecord>();
			for (const c of checks) if (c.week === week && c.language === language) latest.set(`${c.type}:${c.itemId}`, c);
			const probes = [...latest.values()].filter((c) => c.type === "probe");
			const production = [...latest.values()].filter((c) => c.type === "production");
			const done = probes.length >= EXPERIMENT_CONSTANTS.PROBE_ITEMS_PER_WEEK && production.length >= EXPERIMENT_CONSTANTS.PRODUCTION_ITEMS_PER_WEEK;
			rows.push({
				week,
				date: dateForDayNumber(config.startDate, checkDay),
				language,
				state: done ? "done" : todayDayNumber >= checkDay ? "open" : "ahead",
				probesUnderstood: probes.filter((p) => p.score === 1).length,
				probesAnswered: probes.length,
				productionMatch: production.length > 0 ? production.reduce((sum, p) => sum + p.score, 0) / production.length : null,
			});
		}
	}
	return rows;
}

export function generateSummaryMarkdown(
	config: ExperimentConfig,
	schedule: DaySchedule[],
	dailyRecords: DailyExperimentRecord[],
	checkRecords: CheckItemRecord[],
	analysis: RegressionResult,
	todayDateStr?: string,
): string {
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
	lines.push(`- **Baseline Valid Days**: ${analysis.baselineDays} / ${EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE} required`);
	lines.push(`- **Intervention Valid Days**: ${analysis.interventionDays} / ${EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE} required`);
	lines.push(`- **Immediate Level Shift ($b_2$)**: ${(analysis.b2 * 100).toFixed(1)} percentage points`);
	lines.push(`- **Randomization p-value**: ${analysis.pValue.toFixed(4)} (Threshold: ${(1 / 11).toFixed(4)})`);
	lines.push(`- **Current Verdict**: **${analysis.verdictStatus.toUpperCase()}**`);
	lines.push(``);
	lines.push(`## Weekly Checks Summary`);
	lines.push(``);
	lines.push(`| Week | Date | Lang | Probe (10 items) | Production (5 items) | Status |`);
	lines.push(`|---|---|---|---|---|---|`);

	for (let w = 1; w <= EXPERIMENT_CONSTANTS.TOTAL_WEEKS; w++) {
		const checkDate = dateForDayNumber(config.startDate, w * 7);
		for (const lang of ["russian", "slovak"]) {
			const items = checkRecords.filter((c) => c.week === w && c.language === lang);
			const probes = items.filter((c) => c.type === "probe");
			const prods = items.filter((c) => c.type === "production");

			const probeScore = probes.length > 0 ? `${probes.filter((p) => p.score === 1).length}/${probes.length}` : "pending";
			const prodAvg = prods.length > 0 ? `${Math.round((prods.reduce((a, b) => a + b.score, 0) / prods.length) * 100)}%` : "pending";
			const status = probes.length === 10 && prods.length === 5 ? "Completed" : "Scheduled";

			lines.push(`| W${w} | ${checkDate} | ${lang} | ${probeScore} | ${prodAvg} | ${status} |`);
		}
	}

	lines.push(``);
	lines.push(`## Daily Log (Recent 14 Days)`);
	lines.push(``);
	lines.push(`| Day | Date | Lang | Phase | Arm | 1st-Play Share | Reps | Minutes | Compliance |`);
	lines.push(`|---|---|---|---|---|---|---|---|---|`);

	const sortedDays = [...dailyRecords].sort((a, b) => b.dayNumber - a.dayNumber || a.language.localeCompare(b.language));
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

/** Real-time status for the current day of the experiment (for Today UI and notifications). */
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
	treatment: string;
	runningLanguage: string;
	validDay: boolean;
	runningLanguageReps: {
		dictationReps: number;
		understoodReps: number;
		validDay: boolean;
		firstPlayShare: number | null;
	} | null;
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
