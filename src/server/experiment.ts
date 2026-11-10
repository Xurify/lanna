/**
 * Experiment Server Store & Runner (protocol v3, docs/experiments/input-first-russian.md).
 *
 * Manages persistence in <data>/experiments/input-first-russian/:
 * - experiment.json (config, seed, commit, protocol sha256, onset day)
 * - schedule.json (42-day schedule)
 * - probe-pool.json (frozen 60-probe and 30-production pools for RU and SK)
 * - daily.jsonl (daily first-play shares, reps, covariates, minutes, compliance)
 * - checks.jsonl (weekly probe and production responses)
 * - summary.md (human-readable dashboard report)
 * - deviations.jsonl (log of missed days or deviations)
 * - verdict.json (final statistical verdict after Day 42)
 */

import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import {
	buildSchedule,
	calculateCompliance,
	createRng,
	dateForDayNumber,
	dayNumberForDate,
	drawOnsetDay,
	EXPERIMENT_CONSTANTS,
	generateSummaryMarkdown,
	isFirstPlayUnderstood,
	runRandomizationTest,
	type CheckItemRecord,
	type DailyExperimentRecord,
	type DaySchedule,
	type ExperimentConfig,
	type LanguagePools,
	type ProbeItem,
	type ProbePoolData,
} from "../core/experiment.ts";
import { dayKey } from "../core/review.ts";

export const EXPERIMENT_SEED = 20261108;

/** Directory where experiment files live. */
export function experimentDir(): string {
	return path.join(PATHS.base, "experiments", EXPERIMENT_CONSTANTS.ID);
}

function ensureDir(dirPath: string): void {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

function writeExperimentFile(fileName: string, content: string): void {
	const target = path.join(experimentDir(), fileName);
	ensureDir(path.dirname(target));
	fs.writeFileSync(target, content, "utf8");
}

/** Reads protocol hash and git commit. */
function getSystemProvenance(): { protocolHash: string; gitCommit: string } {
	let protocolHash = "unknown";
	let gitCommit = "unknown";

	try {
		const protocolPath = path.join(PATHS.root, "docs", "experiments", "input-first-russian.md");
		if (fs.existsSync(protocolPath)) {
			const content = fs.readFileSync(protocolPath);
			protocolHash = crypto.createHash("sha256").update(content).digest("hex");
		}
	} catch {
		// fallback
	}

	try {
		gitCommit = execSync("git rev-parse HEAD", { cwd: PATHS.root, encoding: "utf8" }).trim();
	} catch {
		// fallback
	}

	return { protocolHash, gitCommit };
}

/** Extracts probe and production pools from lexicon. */
function extractLanguagePool(lexiconPath: string, rand: () => number): LanguagePools {
	let data: { words?: Array<{ lemma?: string; slug?: string; sk?: string; rank?: number; examples?: Array<{ text?: string; sk?: string; en?: string }> }> } = {};
	try {
		data = JSON.parse(fs.readFileSync(lexiconPath, "utf8"));
	} catch {
		return { probePool: [], productionPool: [] };
	}

	const candidates: Array<{ lemma: string; sentence: string; translation: string; wordCount: number; rank?: number }> = [];
	const seenSentences = new Set<string>();

	for (const w of data.words || []) {
		const lemma = w.lemma || w.slug || w.sk || "";
		if (!w.examples) continue;
		for (const ex of w.examples) {
			const sentence = (ex.text || ex.sk || "").trim();
			const translation = (ex.en || "").trim();
			if (!sentence || !translation) continue;
			const words = sentence.split(/\s+/);
			if (words.length >= 4 && words.length <= 8) {
				if (!seenSentences.has(sentence)) {
					seenSentences.add(sentence);
					candidates.push({
						lemma,
						sentence,
						translation,
						wordCount: words.length,
						rank: w.rank,
					});
				}
			}
		}
	}

	// Fisher-Yates shuffle with deterministic rand
	for (let i = candidates.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
	}

	const probePool: ProbeItem[] = [];
	const productionPool: ProbeItem[] = [];
	const usedLemmas = new Set<string>();

	let idCounter = 1;
	for (const item of candidates) {
		if (usedLemmas.has(item.lemma)) continue;
		if (probePool.length < 60) {
			probePool.push({
				id: `probe-${idCounter++}`,
				lemma: item.lemma,
				targetSentence: item.sentence,
				englishTranslation: item.translation,
				wordCount: item.wordCount,
				frequencyRank: item.rank,
			});
			usedLemmas.add(item.lemma);
		} else if (productionPool.length < 30) {
			productionPool.push({
				id: `prod-${idCounter++}`,
				lemma: item.lemma,
				targetSentence: item.sentence,
				englishTranslation: item.translation,
				wordCount: item.wordCount,
				frequencyRank: item.rank,
			});
			usedLemmas.add(item.lemma);
		}
		if (probePool.length >= 60 && productionPool.length >= 30) break;
	}

	return { probePool, productionPool };
}

/** Resolves Russian lexicon path across worktrees and main repo. */
function findRussianLexiconPath(): string {
	const candidates = [
		path.join(PATHS.base, "languages", "russian", "lexicon.json"),
		path.join(PATHS.root, "curriculum", "russian", "lexicon.json"),
	];
	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return candidates[0]!;
}

/** Resolves Slovak lexicon path. */
function findSlovakLexiconPath(): string {
	const candidates = [
		path.join(PATHS.root, "curriculum", "slovak", "lexicon.json"),
		path.join(PATHS.base, "languages", "slovak", "lexicon.json"),
	];
	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return candidates[0]!;
}

/** Ensures experiment files exist before Day 1 starts. */
export function ensureExperimentInitialized(): { config: ExperimentConfig; schedule: DaySchedule[]; pool: ProbePoolData } {
	const dir = experimentDir();
	ensureDir(dir);

	const configPath = path.join(dir, "experiment.json");
	const schedulePath = path.join(dir, "schedule.json");
	const poolPath = path.join(dir, "probe-pool.json");

	let config: ExperimentConfig;
	let schedule: DaySchedule[];
	let pool: ProbePoolData;

	if (fs.existsSync(configPath) && fs.existsSync(schedulePath) && fs.existsSync(poolPath)) {
		config = JSON.parse(fs.readFileSync(configPath, "utf8"));
		schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
		pool = JSON.parse(fs.readFileSync(poolPath, "utf8"));
		if (config.startDate === EXPERIMENT_CONSTANTS.START_DATE) {
			return { config, schedule, pool };
		}
	}

	const provenance = getSystemProvenance();
	const onsetDay = drawOnsetDay(EXPERIMENT_SEED);
	const onsetDate = dateForDayNumber(EXPERIMENT_CONSTANTS.START_DATE, onsetDay);
	const endDate = dateForDayNumber(EXPERIMENT_CONSTANTS.START_DATE, EXPERIMENT_CONSTANTS.TOTAL_DAYS);

	config = {
		id: EXPERIMENT_CONSTANTS.ID,
		title: "Input-First Russian vs Slovak Control (SCED 42-day study)",
		version: "v3",
		startDate: EXPERIMENT_CONSTANTS.START_DATE,
		endDate,
		days: EXPERIMENT_CONSTANTS.TOTAL_DAYS,
		seed: EXPERIMENT_SEED,
		onsetDay,
		onsetDate,
		languages: {
			treatment: "russian",
			control: "slovak",
		},
		protocolHash: provenance.protocolHash,
		gitCommit: provenance.gitCommit,
		decisionRule: "Confirmed benefit if immediate level shift b2 >= +10 pp and randomization test p-value = 1/11 (0.0909) with >= 8 valid days per phase.",
	};

	schedule = buildSchedule(EXPERIMENT_CONSTANTS.START_DATE, onsetDay, EXPERIMENT_CONSTANTS.TOTAL_DAYS);

	const rand = createRng(EXPERIMENT_SEED);
	const skPool = extractLanguagePool(findSlovakLexiconPath(), rand);
	const ruPool = extractLanguagePool(findRussianLexiconPath(), rand);

	pool = {
		seed: EXPERIMENT_SEED,
		createdAt: new Date().toISOString(),
		russian: ruPool,
		slovak: skPool,
	};

	writeExperimentFile("experiment.json", JSON.stringify(config, null, 2));
	writeExperimentFile("schedule.json", JSON.stringify(schedule, null, 2));
	writeExperimentFile("probe-pool.json", JSON.stringify(pool, null, 2));

	// Initial empty daily.jsonl, checks.jsonl, deviations.jsonl, summary.md
	if (!fs.existsSync(path.join(dir, "daily.jsonl"))) writeExperimentFile("daily.jsonl", "");
	if (!fs.existsSync(path.join(dir, "checks.jsonl"))) writeExperimentFile("checks.jsonl", "");
	if (!fs.existsSync(path.join(dir, "deviations.jsonl"))) writeExperimentFile("deviations.jsonl", "");

	const initialSummary = generateSummaryMarkdown(config, schedule, [], [], {
		b0: 0,
		b1: 0,
		b2: 0,
		b3: 0,
		pValue: 1.0,
		baselineDays: 0,
		interventionDays: 0,
		verdictStatus: "pending",
	}, config.startDate);
	writeExperimentFile("summary.md", initialSummary);

	return { config, schedule, pool };
}

/** Resets experiment state and schedule to a fresh start date. */
export function resetExperiment(newStartDate?: string): { config: ExperimentConfig; schedule: DaySchedule[]; pool: ProbePoolData } {
	const dir = experimentDir();
	ensureDir(dir);
	const startDate = newStartDate || EXPERIMENT_CONSTANTS.START_DATE;
	const onsetDay = drawOnsetDay(EXPERIMENT_SEED);
	const onsetDate = dateForDayNumber(startDate, onsetDay);
	const endDate = dateForDayNumber(startDate, EXPERIMENT_CONSTANTS.TOTAL_DAYS);
	const provenance = getSystemProvenance();

	const config: ExperimentConfig = {
		id: EXPERIMENT_CONSTANTS.ID,
		title: "Input-First Russian vs Slovak Control (SCED 42-day study)",
		version: "v3",
		startDate,
		endDate,
		days: EXPERIMENT_CONSTANTS.TOTAL_DAYS,
		seed: EXPERIMENT_SEED,
		onsetDay,
		onsetDate,
		languages: {
			treatment: "russian",
			control: "slovak",
		},
		protocolHash: provenance.protocolHash,
		gitCommit: provenance.gitCommit,
		decisionRule: "Confirmed benefit if immediate level shift b2 >= +10 pp and randomization test p-value = 1/11 (0.0909) with >= 8 valid days per phase.",
	};

	const schedule = buildSchedule(startDate, onsetDay, EXPERIMENT_CONSTANTS.TOTAL_DAYS);
	const rand = createRng(EXPERIMENT_SEED);
	const skPool = extractLanguagePool(findSlovakLexiconPath(), rand);
	const ruPool = extractLanguagePool(findRussianLexiconPath(), rand);

	const pool: ProbePoolData = {
		seed: EXPERIMENT_SEED,
		createdAt: new Date().toISOString(),
		russian: ruPool,
		slovak: skPool,
	};

	writeExperimentFile("experiment.json", JSON.stringify(config, null, 2));
	writeExperimentFile("schedule.json", JSON.stringify(schedule, null, 2));
	writeExperimentFile("probe-pool.json", JSON.stringify(pool, null, 2));
	writeExperimentFile("daily.jsonl", "");
	writeExperimentFile("checks.jsonl", "");
	writeExperimentFile("deviations.jsonl", "");

	const initialSummary = generateSummaryMarkdown(config, schedule, [], [], {
		b0: 0,
		b1: 0,
		b2: 0,
		b3: 0,
		pValue: 1.0,
		baselineDays: 0,
		interventionDays: 0,
		verdictStatus: "pending",
	}, config.startDate);
	writeExperimentFile("summary.md", initialSummary);

	return { config, schedule, pool };
}

/** Reads scheduled arm for a language on a specific date. */
export function getScheduledArmForDate(language: string, dateStr: string): "normal" | "input-first" {
	try {
		const { schedule } = ensureExperimentInitialized();
		const entry = schedule.find((s) => s.date === dateStr);
		if (!entry) return "normal";
		if (language === "russian") return entry.russianArm;
		return "normal";
	} catch {
		return "normal";
	}
}

/** Reads all lines from a jsonl file. */
function readJsonl<T>(filePath: string): T[] {
	if (!fs.existsSync(filePath)) return [];
	const content = fs.readFileSync(filePath, "utf8");
	return content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line) as T);
}

/** Reads progress.json for a profile. */
function readProfileProgress(profile: string): any {
	const file = path.join(PATHS.base, "profiles", profile, "progress.json");
	if (!fs.existsSync(file)) return null;
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}

/** Reads lesson logs for a day and profile. */
function readDayLessonLogs(profile: string, day: string): any[] {
	return readJsonl(path.join(PATHS.base, "profiles", profile, "lessons", `${day}.jsonl`));
}

/**
 * Synchronizes daily experiment data from lesson logs and progress records.
 * Updates daily.jsonl and regenerates summary.md.
 */
export function syncDailyExperimentData(now = new Date()): { daily: DailyExperimentRecord[]; summary: string } {
	const { config, schedule } = ensureExperimentInitialized();
	const todayDateStr = dayKey(now);
	const currentDayNumber = dayNumberForDate(config.startDate, todayDateStr);

	const existingDaily = readJsonl<DailyExperimentRecord>(path.join(experimentDir(), "daily.jsonl"));
	const dailyMap = new Map<string, DailyExperimentRecord>();
	for (const r of existingDaily) {
		dailyMap.set(`${r.date}:${r.language}`, r);
	}

	const maxDay = currentDayNumber < 1 ? 0 : Math.min(currentDayNumber, EXPERIMENT_CONSTANTS.TOTAL_DAYS);

	for (let d = 1; d <= maxDay; d++) {
		const s = schedule[d - 1];
		if (!s) continue;
		const dateStr = s.date;

		for (const lang of ["russian", "slovak"] as const) {
			const logs = readDayLessonLogs(lang, dateStr);
			const progress = readProfileProgress(lang);
			const dayProgress = progress?.days?.[dateStr];

			const listenLessons = logs.filter((l: any) => l.mode === "listen");
			const allReps = listenLessons.flatMap((l: any) => l.reps || []);
			const dictationReps = allReps.filter((r: any) => r.kind === "dictation" || r.answer === "type");
			const understoodReps = dictationReps.filter(isFirstPlayUnderstood);

			const repCount = dictationReps.length;
			const understoodCount = understoodReps.length;
			const firstPlayShare = repCount >= EXPERIMENT_CONSTANTS.MIN_REPS_FOR_VALID_DAY ? Math.round((understoodCount / repCount) * 1000) / 1000 : null;

			const totalWords = dictationReps.reduce((acc: number, r: any) => acc + (r.sentence ? r.sentence.split(/\s+/).length : 5), 0);
			const meanWords = repCount > 0 ? Math.round((totalWords / repCount) * 10) / 10 : 0;

			const minutesBy = dayProgress?.minutesBy || {};
			const minutes = dayProgress?.minutes || Object.values(minutesBy).reduce((a: number, b: any) => a + Number(b), 0);
			const compliance = lang === "russian" && s.russianArm === "input-first" ? calculateCompliance(minutesBy) : 100;

			const record: DailyExperimentRecord = {
				date: dateStr,
				dayNumber: d,
				language: lang,
				phase: s.phase,
				arm: lang === "russian" ? s.russianArm : "normal",
				firstPlayShare,
				dictationReps: repCount,
				understoodReps: understoodCount,
				covariates: { meanWordsPerSentence: meanWords },
				minutes: Math.round(Number(minutes) || 0),
				minutesBy,
				compliance,
				compliant: compliance >= EXPERIMENT_CONSTANTS.COMPLIANCE_THRESHOLD,
			};

			dailyMap.set(`${dateStr}:${lang}`, record);
		}
	}

	const updatedDaily = Array.from(dailyMap.values()).sort((a, b) => a.dayNumber - b.dayNumber || a.language.localeCompare(b.language));
	const jsonlLines = updatedDaily.map((r) => JSON.stringify(r)).join("\n") + "\n";
	writeExperimentFile("daily.jsonl", jsonlLines);

	const checkRecords = readJsonl<CheckItemRecord>(path.join(experimentDir(), "checks.jsonl"));
	const russianRecords = updatedDaily.filter((r) => r.language === "russian");
	const analysis = runRandomizationTest(russianRecords, config.onsetDay);

	const summary = generateSummaryMarkdown(config, schedule, updatedDaily, checkRecords, analysis, todayDateStr);
	writeExperimentFile("summary.md", summary);

	// If study is complete (day > 42), write verdict.json
	if (currentDayNumber > EXPERIMENT_CONSTANTS.TOTAL_DAYS) {
		const verdictPath = path.join(experimentDir(), "verdict.json");
		if (!fs.existsSync(verdictPath)) {
			const verdictData = {
				completedAt: now.toISOString(),
				version: config.version,
				decisionRule: config.decisionRule,
				analysis,
				flags: {
					baselineDaysValid: analysis.baselineDays >= EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE,
					interventionDaysValid: analysis.interventionDays >= EXPERIMENT_CONSTANTS.MIN_DAYS_PER_PHASE,
					randomizationTestPassed: analysis.pValue <= 1 / 11 + 1e-4,
					levelShiftPassed: analysis.b2 >= 0.1,
				},
				verdict: analysis.verdictStatus,
			};
			writeExperimentFile("verdict.json", JSON.stringify(verdictData, null, 2));
		}
	}

	return { daily: updatedDaily, summary };
}

/** Records results from a weekly check into checks.jsonl. */
export function recordWeeklyCheckResults(items: CheckItemRecord[]): void {
	const dir = experimentDir();
	const existing = readJsonl<CheckItemRecord>(path.join(dir, "checks.jsonl"));
	const merged = [...existing, ...items];
	const content = merged.map((i) => JSON.stringify(i)).join("\n") + "\n";
	writeExperimentFile("checks.jsonl", content);

	syncDailyExperimentData();
}

/** Returns the full experiment state for the UI. */
export function getExperimentState(now = new Date()) {
	const { config, schedule, pool } = ensureExperimentInitialized();
	const { daily, summary } = syncDailyExperimentData(now);
	const checks = readJsonl<CheckItemRecord>(path.join(experimentDir(), "checks.jsonl"));
	const todayDateStr = dayKey(now);
	const currentDayNumber = dayNumberForDate(config.startDate, todayDateStr);
	const todaySchedule = schedule.find((s) => s.date === todayDateStr) || {
		dayNumber: currentDayNumber,
		date: todayDateStr,
		phase: currentDayNumber >= config.onsetDay ? "intervention" : "baseline",
		russianArm: currentDayNumber >= config.onsetDay ? "input-first" : "normal",
		slovakArm: "normal",
		weeklyCheckDue: currentDayNumber > 0 && currentDayNumber % 7 === 0,
	};

	const analysis = runRandomizationTest(
		daily.filter((d) => d.language === "russian"),
		config.onsetDay,
	);

	return {
		config,
		schedule,
		pool,
		daily,
		checks,
		summary,
		analysis,
		today: {
			date: todayDateStr,
			dayNumber: currentDayNumber,
			schedule: todaySchedule,
		},
	};
}
