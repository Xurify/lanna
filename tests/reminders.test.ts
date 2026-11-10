import assert from "node:assert/strict";
import { test } from "node:test";
import {
	isValidTimeString,
	normalizeTimeString,
	analyzeStudyTrends,
	pickNextOptimalTask,
	buildDailyNudges,
	shouldTriggerNudge,
	DEFAULT_NOTIFICATION_SETTINGS,
	type NotificationSettings,
	type DayLog,
	type PlanTask,
	sanitizeUserSettings,
} from "../src/core/index.ts";

test("time string validation and normalization", () => {
	assert.equal(isValidTimeString("09:00"), true);
	assert.equal(isValidTimeString("9:00"), true);
	assert.equal(isValidTimeString("23:59"), true);
	assert.equal(isValidTimeString("0:00"), true);
	assert.equal(isValidTimeString("00:00"), true);

	assert.equal(isValidTimeString("24:00"), false);
	assert.equal(isValidTimeString("12:60"), false);
	assert.equal(isValidTimeString("noon"), false);
	assert.equal(isValidTimeString(""), false);
	assert.equal(isValidTimeString("12"), false);

	assert.equal(normalizeTimeString("9:05"), "09:05");
	assert.equal(normalizeTimeString("09:05"), "09:05");
	assert.equal(normalizeTimeString("14:30"), "14:30");
});

test("study trends analysis with empty or sparse history", () => {
	const emptyDays: DayLog[] = [];
	const trends = analyzeStudyTrends(emptyDays);

	assert.equal(trends.totalSessions, 0);
	assert.equal(trends.peakHour, null);
	assert.deepEqual(trends.suggestedTimes, ["09:00", "18:30"]);
	assert.ok(trends.summary.includes("No recent practice history"));
});

test("study trends analysis extracts peak hours and habit clusters", () => {
	const sampleDays: DayLog[] = [
		{
			isoDate: "2026-11-01",
			sessions: [
				{ time: "09:10", seconds: 1200, kind: "blitz" },
				{ time: "09:35", seconds: 900, kind: "words" },
			],
			seconds: 2100,
			itemsReviewed: 45,
			wordsLearned: 5,
		},
		{
			isoDate: "2026-11-02",
			sessions: [
				{ time: "09:05", seconds: 1500, kind: "lesson" },
				{ time: "20:15", seconds: 1800, kind: "listen" },
			],
			seconds: 3300,
			itemsReviewed: 50,
			wordsLearned: 8,
		},
		{
			isoDate: "2026-11-03",
			sessions: [
				{ time: "09:20", seconds: 1200, kind: "blitz" },
				{ time: "20:30", seconds: 1200, kind: "review" },
			],
			seconds: 2400,
			itemsReviewed: 60,
			wordsLearned: 10,
		},
	];

	const trends = analyzeStudyTrends(sampleDays);
	assert.equal(trends.totalSessions, 6);
	assert.equal(trends.peakHour, 9);
	assert.ok(trends.suggestedTimes.includes("09:00"));
	assert.ok(trends.suggestedTimes.includes("20:00"));
	assert.ok(trends.summary.includes("09:00"));
});

test("optimal task picker matches time of day circadian windows", () => {
	const tasks: PlanTask[] = [
		{ id: "1", title: "Morning Vocabulary Blitz", kind: "words", estimatedMinutes: 10, done: false },
		{ id: "2", title: "Grammar Cases Deep Dive", kind: "lesson", estimatedMinutes: 15, done: false },
		{ id: "3", title: "Evening Audio Comprehension", kind: "listen", estimatedMinutes: 15, done: false },
	];

	// Morning (hour 8) -> words task
	const morningTask = pickNextOptimalTask(tasks, 8);
	assert.equal(morningTask?.kind, "words");

	// Midday/Afternoon (hour 14) -> lesson task
	const afternoonTask = pickNextOptimalTask(tasks, 14);
	assert.equal(afternoonTask?.kind, "lesson");

	// Evening (hour 20) -> listen task
	const eveningTask = pickNextOptimalTask(tasks, 20);
	assert.equal(eveningTask?.kind, "listen");
});

test("buildDailyNudges returns empty when goal is already completed", () => {
	const settings: NotificationSettings = {
		...DEFAULT_NOTIFICATION_SETTINGS,
		enabled: true,
		times: ["09:00", "18:00"],
	};

	const nudges = buildDailyNudges({
		settings,
		dailyGoal: 20,
		todayMinutes: 25, // Goal met
	});

	assert.equal(nudges.length, 0);
});

test("buildDailyNudges generates scheduled, smart trend, and deadline alerts", () => {
	const settings: NotificationSettings = {
		...DEFAULT_NOTIFICATION_SETTINGS,
		enabled: true,
		times: ["10:00"],
		smartAutoNudge: true,
		autoScheduleTasks: true,
	};

	const trends = {
		peakHour: 15,
		hourlyDistribution: new Array(24).fill(0),
		totalSessions: 10,
		suggestedTimes: ["15:00"],
		summary: "Active at 15:00",
	};

	const tasks: PlanTask[] = [
		{ id: "t1", title: "Flashcard Sprint", kind: "blitz", estimatedMinutes: 5, done: false },
		{ id: "t2", title: "Conversation Scene", kind: "lesson", estimatedMinutes: 15, done: false },
	];

	const nudges = buildDailyNudges({
		settings,
		trends,
		dailyGoal: 30,
		todayMinutes: 10,
		tasks,
	});

	// Should have scheduled (10:00), smart trend (15:00), and evening deadline warning (20:30)
	assert.ok(nudges.some((n) => n.time === "10:00" && n.source === "scheduled"));
	assert.ok(nudges.some((n) => n.time === "15:00" && n.source === "smart_trend"));
	assert.ok(nudges.some((n) => n.source === "deadline_warning" && n.urgent === true));

	// First task assigned to morning nudge
	const morningNudge = nudges.find((n) => n.time === "10:00");
	assert.ok(morningNudge?.taskTitle);
});

test("shouldTriggerNudge fires on match and prevents duplicate firing", () => {
	const now = new Date("2026-11-09T09:15:00");
	const nudges = [
		{
			id: "n1",
			time: "09:15",
			source: "scheduled" as const,
			title: "Practice Time",
			message: "Let's learn!",
		},
		{
			id: "n2",
			time: "18:00",
			source: "scheduled" as const,
			title: "Evening Review",
			message: "Review words",
		},
	];

	// Not fired yet
	const firedNudge = shouldTriggerNudge({
		nudges,
		firedKeys: [],
		now,
		dailyGoal: 20,
		todayMinutes: 5,
	});
	assert.ok(firedNudge);
	assert.equal(firedNudge?.id, "n1");

	// Once recorded as fired, does not fire again
	const suppressedNudge = shouldTriggerNudge({
		nudges,
		firedKeys: ["n1-09:15"],
		now,
		dailyGoal: 20,
		todayMinutes: 5,
	});
	assert.equal(suppressedNudge, null);

	// If goal reached in the meantime, does not fire
	const goalMetNudge = shouldTriggerNudge({
		nudges,
		firedKeys: [],
		now,
		dailyGoal: 20,
		todayMinutes: 25,
	});
	assert.equal(goalMetNudge, null);
});

test("sanitizeUserSettings handles notifications section strictly", () => {
	const raw = {
		version: 1,
		notifications: {
			enabled: true,
			times: ["08:30", "bad_time", "19:45"],
			soundPreset: "bell",
			customSoundName: "my-chime.wav",
			inAppBanner: true,
			systemNotification: false,
			smartAutoNudge: true,
			autoScheduleTasks: true,
			aiAssisted: true,
			unknownExtraKey: 123,
		},
	};

	const sanitized = sanitizeUserSettings(raw);
	assert.ok(sanitized?.notifications);
	assert.equal(sanitized.notifications.enabled, true);
	// Bad time dropped, valid times normalized
	assert.deepEqual(sanitized.notifications.times, ["08:30", "19:45"]);
	assert.equal(sanitized.notifications.soundPreset, "bell");
	assert.equal(sanitized.notifications.customSoundName, "my-chime.wav");
	assert.equal(sanitized.notifications.systemNotification, false);
	assert.equal(sanitized.notifications.aiAssisted, true);

	// Invalid sound preset falls back to default "chime"
	const badPreset = sanitizeUserSettings({
		version: 1,
		notifications: {
			soundPreset: "invalid_horn",
		},
	});
	assert.equal(badPreset?.notifications?.soundPreset, "chime");
});

test("parseNotificationSettingsBody accepts valid partial and full bodies", async () => {
	const { parseNotificationSettingsBody } = await import("../src/server/settings-body.ts");

	const res = parseNotificationSettingsBody({
		enabled: true,
		times: ["07:30", "21:00"],
		soundPreset: "harp",
		customSoundName: "harp.mp3",
		inAppBanner: true,
		systemNotification: true,
		smartAutoNudge: true,
		autoScheduleTasks: true,
		aiAssisted: false,
	});

	assert.equal(res.ok, true);
	if (res.ok) {
		assert.equal(res.settings.enabled, true);
		assert.deepEqual(res.settings.times, ["07:30", "21:00"]);
		assert.equal(res.settings.soundPreset, "harp");
		assert.equal(res.settings.customSoundName, "harp.mp3");
	}

	// Invalid input format returns { ok: false, error: ... }
	assert.equal(parseNotificationSettingsBody(null).ok, false);
	assert.equal(parseNotificationSettingsBody("not-an-object").ok, false);
	assert.equal(parseNotificationSettingsBody({ times: "not-an-array" }).ok, false);
	assert.equal(parseNotificationSettingsBody({ soundPreset: "invalid-preset" }).ok, false);
});
