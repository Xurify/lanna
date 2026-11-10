/**
 * GET /api/reminders/schedule?tz=<minutes>
 *
 * Computes today's intelligent reminder schedule:
 * 1. Analyzes learner activity logs from past 30 days to extract habit clusters.
 * 2. Computes peak study hours and optimal reminder windows.
 * 3. Inspects today's progress against the daily goal (minutes completed vs target).
 * 4. Pulls pending tasks from the daily plan to pair with scheduled focus slots.
 * 5. Returns combined nudges (custom times + smart trend times + evening deadline).
 */

import {
	analyzeStudyTrends,
	buildDailyNudges,
	DEFAULT_NOTIFICATION_SETTINGS,
	type DayLanguage,
	type DayLog,
	type NotificationSettings,
	type ScheduledNudge,
	type StudyTrendInsights,
} from "@/src/core";
import {
	dayLogDays,
	languageDay,
	progressSummary,
	readSettingsRecord,
	shownProfiles,
	withProfile,
} from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(req: Request): number {
	const tz = Number(new URL(req.url).searchParams.get("tz"));
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : 0;
}

export interface ReminderScheduleResponse {
	settings: NotificationSettings;
	trends: StudyTrendInsights;
	schedule: ScheduledNudge[];
	todayMinutes: number;
	dailyGoal: number;
	streak: number;
	languages?: DayLanguage[];
}

export async function GET(req: Request) {
	const tz = tzOf(req);
	const todayIso = new Date(Date.now() - tz * 60_000).toISOString().slice(0, 10);

	// 1. Read stored settings
	const settingsRecord = readSettingsRecord();
	const settings: NotificationSettings = {
		...DEFAULT_NOTIFICATION_SETTINGS,
		...(settingsRecord?.notifications ?? {}),
	};

	// 2. Read recent activity logs across all profiles to analyze habitual windows
	const profiles = shownProfiles();
	const allDays: DayLog[] = [];
	for (const pid of profiles) {
		const days = withProfile(pid, () => dayLogDays(todayIso, tz, 30));
		allDays.push(...days);
	}
	const trends = analyzeStudyTrends(allDays);

	// 3. Read today across every language in the list (the split of the day)
	const dayPlan = languageDay(tz);
	const activeSummary = progressSummary(tz);

	// 4. Build schedule taking into account all languages and their task plans
	const schedule = buildDailyNudges({
		settings,
		trends,
		dailyGoal: dayPlan.minutes,
		todayMinutes: dayPlan.practiced,
		tasks: activeSummary.plan?.tasks ?? [],
		languageName: dayPlan.languages.find((l) => l.running)?.english ?? "your language",
		languages: dayPlan.languages,
	});

	const response: ReminderScheduleResponse = {
		settings,
		trends,
		schedule,
		todayMinutes: dayPlan.practiced,
		dailyGoal: dayPlan.minutes,
		streak: activeSummary.streak?.days ?? 0,
		languages: dayPlan.languages,
	};

	return Response.json(response);
}
