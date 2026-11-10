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
	type NotificationSettings,
	type ScheduledNudge,
	type StudyTrendInsights,
} from "@/src/core";
import { dayLogDays, progressSummary, readSettingsRecord } from "@/src/server";

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
}

export async function GET(req: Request) {
	const tz = tzOf(req);
	const todayIso = new Date(Date.now() - tz * 60_000).toISOString().slice(0, 10);

	// 1. Read stored settings
	const settingsRecord = readSettingsRecord();
	const settings: NotificationSettings = {
		...DEFAULT_NOTIFICATION_SETTINGS,
		...(settingsRecord.notifications ?? {}),
	};

	// 2. Read recent activity logs to analyze habitual windows
	const recentDays = dayLogDays(todayIso, tz, 30);
	const trends = analyzeStudyTrends(recentDays);

	// 3. Read current progress, goal, and daily plan
	const summary = progressSummary(tz);
	const dailyGoal = summary.dailyGoal ?? 20;
	const todayMinutes = summary.todayMinutes ?? 0;
	const tasks = summary.plan?.tasks ?? [];

	// 4. Build schedule
	const schedule = buildDailyNudges({
		settings,
		trends,
		dailyGoal,
		todayMinutes,
		tasks,
	});

	const response: ReminderScheduleResponse = {
		settings,
		trends,
		schedule,
		todayMinutes,
		dailyGoal,
		streak: summary.streak?.current ?? 0,
	};

	return Response.json(response);
}
