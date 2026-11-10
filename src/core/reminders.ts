/**
 * Daily Goal Activity Reminders & Smart Scheduler (pure core, browser-safe).
 *
 * Implements:
 * 1. Trend analysis over historical session logs to identify learner habit peaks.
 * 2. Smart auto-nudge scheduling throughout the day aligned with study patterns.
 * 3. Daily plan task allocation (kickoff morning words/blitz, focused midday lessons,
 *    and evening review/listening consolidation).
 * 4. Goal deadline warnings before midnight when daily minutes are unmet.
 * 5. Notification & sound customization configurations.
 */

import type { DayLog } from "./daylog.ts";

export const NOTIFICATION_SOUND_PRESETS = [
	"chime",
	"bell",
	"harp",
	"gentle",
	"subtle",
	"custom",
	"none",
] as const;

export type NotificationSoundPreset = (typeof NOTIFICATION_SOUND_PRESETS)[number];

export interface NotificationSettings {
	/** Overall on/off switch for daily goal activity reminders. */
	enabled: boolean;
	/** Specific fixed reminder times in 24h HH:MM format (e.g. ["09:00", "18:00"]). */
	times: string[];
	/** Sound played when reminder fires. */
	soundPreset: NotificationSoundPreset;
	/** Human-readable name of custom uploaded audio file (if custom preset chosen). */
	customSoundName?: string;
	/** Show floating banner within the app window. */
	inAppBanner: boolean;
	/** Dispatch system/OS desktop notifications. */
	systemNotification: boolean;
	/** Analyze past study habits to automatically nudge during high-retention windows. */
	smartAutoNudge: boolean;
	/** Automatically map pending daily plan tasks to optimal study times of day. */
	autoScheduleTasks: boolean;
	/** AI-assisted personalized coaching messages when AI model is available. */
	aiAssisted: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: Required<NotificationSettings> = {
	enabled: true,
	times: ["09:00", "18:30"],
	soundPreset: "chime",
	customSoundName: "",
	inAppBanner: true,
	systemNotification: true,
	smartAutoNudge: true,
	autoScheduleTasks: true,
	aiAssisted: false,
};

export interface StudyTrendInsights {
	/** Peak hour of day (0-23) or null if no session data. */
	peakHour: number | null;
	/** Peak hours of day (0-23) sorted by session frequency descending. */
	peakHours: number[];
	/** Suggested nudge times (HH:MM) inferred from habit clusters. */
	suggestedTimes: string[];
	/** Distribution of completed sessions across 24 hours. */
	hourlyDistribution: number[];
	/** Total sessions evaluated across history. */
	totalSessions: number;
	/** Concise summary for learner display. */
	summary: string;
}

export interface ScheduledNudge {
	id: string;
	/** 24h format HH:MM */
	time: string;
	source: "scheduled" | "smart_trend" | "evening_deadline" | "deadline_warning" | "streak_saver";
	languageId?: string;
	languageName?: string;
	taskKind?: string;
	taskTitle?: string;
	title: string;
	message: string;
	urgent?: boolean;
}

export interface DayLanguageItem {
	id: string;
	english: string;
	endonym: string;
	running?: boolean;
	minutes: number;
	practiced: number;
	setUp?: boolean;
	tasks?: readonly PlanTaskItem[];
}

const TIME_REGEX = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;

export function isValidTimeString(time: string): boolean {
	return typeof time === "string" && TIME_REGEX.test(time.trim());
}

export function normalizeTimeString(time: string): string {
	const trimmed = time.trim();
	if (!isValidTimeString(trimmed)) return "09:00";
	const [h, m] = trimmed.split(":").map(Number);
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseHourMinute(time: string): { hour: number; minute: number } {
	const [h, m] = time.split(":").map(Number);
	return {
		hour: Number.isFinite(h) ? Math.min(Math.max(h, 0), 23) : 9,
		minute: Number.isFinite(m) ? Math.min(Math.max(m, 0), 59) : 0,
	};
}

export function formatHourMinute(hour: number, minute: number): string {
	const h = Math.min(Math.max(Math.floor(hour), 0), 23);
	const m = Math.min(Math.max(Math.floor(minute), 0), 59);
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Analyzes session history from DayLogs to find the learner's habitual study windows.
 */
export function analyzeStudyTrends(
	days: Array<{ entries?: Array<{ time?: string }>; sessions?: Array<{ time?: string }> } | DayLog>,
): StudyTrendInsights {
	const hourly = new Array<number>(24).fill(0);
	let totalSessions = 0;

	for (const day of days) {
		const rawEntries =
			"entries" in day && Array.isArray(day.entries)
				? day.entries
				: "sessions" in day && Array.isArray((day as { sessions?: Array<{ time?: string }> }).sessions)
					? (day as { sessions: Array<{ time?: string }> }).sessions
					: [];
		for (const entry of rawEntries) {
			if (entry?.time && typeof entry.time === "string") {
				const match = entry.time.match(/^(\d{1,2}):(\d{2})$/);
				if (match) {
					const hour = Number(match[1]);
					if (hour >= 0 && hour < 24) {
						hourly[hour] = (hourly[hour] ?? 0) + 1;
						totalSessions++;
					}
				}
			}
		}
	}

	// Rank hours by session count
	const rankedHours = Array.from({ length: 24 }, (_, i) => i)
		.filter((h) => (hourly[h] ?? 0) > 0)
		.sort((a, b) => (hourly[b] ?? 0) - (hourly[a] ?? 0));

	let suggestedTimes: string[] = [];
	let summary = "";

	if (totalSessions < 3) {
		// New or light learner: default to morning kickstart and evening wind-down
		suggestedTimes = ["09:00", "18:30"];
		summary = "No recent practice history. We'll start with 09:00 morning and 18:30 evening reminders.";
	} else {
		// Pick top 1-2 distinct habit clusters separated by at least 3 hours
		const peaks: number[] = [];
		for (const h of rankedHours) {
			if (peaks.every((p) => Math.abs(p - h) >= 3)) {
				peaks.push(h);
				if (peaks.length >= 2) break;
			}
		}
		peaks.sort((a, b) => a - b);
		suggestedTimes = peaks.map((h) => `${String(h).padStart(2, "0")}:00`);

		const formattedPeaks = peaks.map((h) => `${String(h).padStart(2, "0")}:00`);
		summary = `You study most consistently around ${formattedPeaks.join(" and ")}. (${totalSessions} sessions logged)`;
	}

	return {
		peakHour: rankedHours.length > 0 ? (rankedHours[0] ?? null) : null,
		peakHours: rankedHours.slice(0, 3),
		suggestedTimes,
		hourlyDistribution: hourly,
		totalSessions,
		summary,
	};
}

export interface PlanTaskItem {
	id: string;
	title: string;
	kind?: string;
	done?: boolean;
}

/**
 * Intelligent task mapper based on circadian focus and task demands:
 * - Morning (<12:00): quick lightweight retrieval (words, blitz, spaced review).
 * - Afternoon (12:00 - 18:00): focused learning (lesson, grammar, units).
 * - Evening (>18:00): consolidation (review, listening, stories, speaking).
 */
export function pickNextOptimalTask(
	tasks: readonly PlanTaskItem[],
	hour: number,
): PlanTaskItem | undefined {
	const undone = tasks.filter((t) => !t.done);
	if (undone.length === 0) return undefined;

	const matchesKeywords = (t: PlanTaskItem, keywords: readonly string[]) => {
		const target = `${t.id} ${t.kind ?? ""} ${t.title}`.toLowerCase();
		return keywords.some((kw) => target.includes(kw));
	};

	if (hour < 12) {
		// Morning preference: blitz, words, review
		const morningMatch = undone.find((t) => matchesKeywords(t, ["words", "word", "blitz", "flashcard"]));
		if (morningMatch) return morningMatch;
	} else if (hour < 18) {
		// Afternoon preference: lesson, grammar, units
		const middayMatch = undone.find((t) => matchesKeywords(t, ["lesson", "grammar", "chapter", "unit"]));
		if (middayMatch) return middayMatch;
	} else {
		// Evening preference: review, listen, talk
		const eveningMatch = undone.find((t) => matchesKeywords(t, ["listen", "story", "review", "speak"]));
		if (eveningMatch) return eveningMatch;
	}

	return undone[0];
}

/**
 * Builds the complete schedule of activity nudges for today.
 */
export function buildDailyNudges(options: {
	settings: NotificationSettings;
	trends?: StudyTrendInsights;
	dailyGoal?: number;
	todayMinutes?: number;
	tasks?: readonly PlanTaskItem[];
	languageName?: string;
	languages?: readonly DayLanguageItem[];
}): ScheduledNudge[] {
	const { settings } = options;
	if (!settings.enabled) return [];

	const rawLanguages = options.languages ?? [];
	const isMulti = rawLanguages.length > 0;

	// Total goals and minutes (across all languages if multi-language)
	const dailyGoal = isMulti
		? rawLanguages.reduce((n, l) => n + l.minutes, 0)
		: (options.dailyGoal ?? 20);

	const todayMinutes = isMulti
		? rawLanguages.reduce((n, l) => n + l.practiced, 0)
		: (options.todayMinutes ?? 0);

	if (todayMinutes >= dailyGoal) return [];

	const remainingMinutes = Math.max(0, dailyGoal - todayMinutes);

	// Find languages that need attention (sorted by largest remaining deficit)
	const unmetLanguages = isMulti
		? rawLanguages
				.filter((l) => (l.setUp ?? true) && l.practiced < l.minutes)
				.sort((a, b) => (b.minutes - b.practiced) - (a.minutes - a.practiced))
		: [];

	const fallbackTasks = options.tasks ?? [];
	const fallbackLangName = options.languageName ?? "your language";

	const trends = options.trends ?? analyzeStudyTrends([]);
	const timeMap = new Map<string, ScheduledNudge>();

	let slotIdx = 0;

	// 1. Add configured fixed reminder times
	for (const t of settings.times) {
		if (isValidTimeString(t)) {
			const norm = normalizeTimeString(t);
			const { hour } = parseHourMinute(norm);

			// Interleave or pick the language that needs practice for this slot
			const lang = unmetLanguages.length > 0 ? unmetLanguages[slotIdx % unmetLanguages.length]! : null;
			slotIdx++;

			const langTasks = lang?.tasks ?? fallbackTasks;
			const task = settings.autoScheduleTasks ? pickNextOptimalTask(langTasks, hour) : langTasks.find((tk) => !tk.done);
			const langRemaining = lang ? Math.max(0, lang.minutes - lang.practiced) : remainingMinutes;

			const title = lang
				? (unmetLanguages.length > 1
						? `[${lang.endonym}] ${langRemaining} min left (${remainingMinutes}m total)`
						: `Daily Goal: ${remainingMinutes} min left`)
				: (remainingMinutes > 0 ? `Daily Goal: ${remainingMinutes} min left` : "Time for Practice");

			const message = lang
				? (task
						? `Up next in ${lang.english}: ${task.title}. (${lang.practiced} of ${lang.minutes} min done)`
						: `Spend ${langRemaining} minutes with ${lang.english} to maintain your daily streak!`)
				: (task
						? `Up next: ${task.title}. Keep your daily learning streak alive!`
						: `Spend a few minutes with ${fallbackLangName} to maintain your momentum.`);

			timeMap.set(norm, {
				id: `nudge-sched-${norm}`,
				time: norm,
				source: "scheduled",
				languageId: lang?.id,
				languageName: lang?.endonym ?? lang?.english,
				taskKind: task?.kind ?? task?.id,
				taskTitle: task?.title,
				title,
				message,
			});
		}
	}

	// 2. Add smart auto-nudges from trends (if enabled)
	if (settings.smartAutoNudge && trends.suggestedTimes.length > 0) {
		for (const st of trends.suggestedTimes) {
			const norm = normalizeTimeString(st);
			if (!timeMap.has(norm)) {
				const { hour } = parseHourMinute(norm);

				const lang = unmetLanguages.length > 0 ? unmetLanguages[slotIdx % unmetLanguages.length]! : null;
				slotIdx++;

				const langTasks = lang?.tasks ?? fallbackTasks;
				const task = settings.autoScheduleTasks ? pickNextOptimalTask(langTasks, hour) : langTasks.find((tk) => !tk.done);
				const langName = lang?.endonym ?? lang?.english ?? fallbackLangName;

				const title = lang
					? `Best time for ${lang.english}`
					: `Best time for ${fallbackLangName}`;

				const message = task
					? `Your peak study window is now! Perfect time for ${task.title}${lang ? ` (${lang.english})` : ""}.`
					: `You usually make great progress at this hour. Ready for a quick session?`;

				timeMap.set(norm, {
					id: `nudge-smart-${norm}`,
					time: norm,
					source: "smart_trend",
					languageId: lang?.id,
					languageName: langName,
					taskKind: task?.kind ?? task?.id,
					taskTitle: task?.title,
					title,
					message,
				});
			}
		}
	}

	// 3. Evening deadline warning (if goal unmet by 20:30 and no existing nudge at 20:30-21:30)
	if (remainingMinutes > 0) {
		const deadlineTime = "20:30";
		const hasEvening = Array.from(timeMap.keys()).some((k) => {
			const h = Number(k.split(":")[0]);
			return h >= 20 && h <= 21;
		});

		if (!hasEvening) {
			if (unmetLanguages.length > 1) {
				const breakdown = unmetLanguages.map((l) => `${l.endonym} (${l.minutes - l.practiced}m)`).join(", ");
				timeMap.set(deadlineTime, {
					id: `nudge-deadline-${deadlineTime}`,
					time: deadlineTime,
					source: "deadline_warning",
					title: `Goal Alert: ${remainingMinutes} min needed across ${unmetLanguages.length} languages`,
					message: `Finish today's goals before midnight! Remaining: ${breakdown}.`,
					urgent: true,
				});
			} else {
				const singleLang = unmetLanguages[0];
				const lastTask = (singleLang?.tasks ?? fallbackTasks).find((tk) => !tk.done);
				const langDisplayName = singleLang?.endonym ?? fallbackLangName;
				timeMap.set(deadlineTime, {
					id: `nudge-deadline-${deadlineTime}`,
					time: deadlineTime,
					source: "deadline_warning",
					languageId: singleLang?.id,
					languageName: langDisplayName,
					taskKind: lastTask?.kind ?? lastTask?.id,
					taskTitle: lastTask?.title,
					title: `Goal Alert: ${remainingMinutes} min needed today`,
					message: lastTask
						? `Finish ${lastTask.title} before midnight to complete your daily goal!`
						: `You have ${remainingMinutes} minutes left to protect your goal. Dive in before the day ends!`,
					urgent: true,
				});
			}
		}
	}

	return Array.from(timeMap.values()).sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Evaluates whether a nudge should fire right now.
 * - Current time HH:MM must match a scheduled nudge.
 * - Goal must be unmet (todayMinutes < dailyGoal).
 * - Must not have already fired today for this slot.
 */
export function shouldTriggerNudge(options: {
	nudges: readonly ScheduledNudge[];
	firedKeys: readonly string[];
	now: Date;
	dailyGoal: number;
	todayMinutes: number;
}): ScheduledNudge | null {
	const { nudges, firedKeys, now, dailyGoal, todayMinutes } = options;

	// If goal is already met, no daily goal reminder is needed
	if (todayMinutes >= dailyGoal) return null;

	const currentHour = now.getHours();
	const currentMinute = now.getMinutes();
	const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

	const firedSet = new Set(firedKeys);

	for (const nudge of nudges) {
		if (nudge.time === currentTimeStr) {
			const slotKey = `${nudge.id}-${nudge.time}`;
			if (!firedSet.has(slotKey) && !firedSet.has(nudge.time)) {
				return nudge;
			}
		}
	}

	return null;
}
