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
	type PlanTaskItem,
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
			day: "2026-11-01",
			entries: [
				{ at: "2026-11-01T09:10:00Z", time: "09:10", kind: "blitz", title: "Blitz", line: "done" },
				{ at: "2026-11-01T09:35:00Z", time: "09:35", kind: "words", title: "Words", line: "done" },
			],
			rules: [],
			words: [],
			mistakes: [],
			strands: { minutes: {} as any, total: 35, estimated: 35 },
			also: [],
		},
		{
			day: "2026-11-02",
			entries: [
				{ at: "2026-11-02T09:05:00Z", time: "09:05", kind: "lesson", title: "Lesson", line: "done" },
				{ at: "2026-11-02T20:15:00Z", time: "20:15", kind: "listen", title: "Listen", line: "done" },
			],
			rules: [],
			words: [],
			mistakes: [],
			strands: { minutes: {} as any, total: 55, estimated: 55 },
			also: [],
		},
		{
			day: "2026-11-03",
			entries: [
				{ at: "2026-11-03T09:20:00Z", time: "09:20", kind: "blitz", title: "Blitz", line: "done" },
				{ at: "2026-11-03T20:30:00Z", time: "20:30", kind: "review", title: "Review", line: "done" },
			],
			rules: [],
			words: [],
			mistakes: [],
			strands: { minutes: {} as any, total: 40, estimated: 40 },
			also: [],
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
	const tasks: PlanTaskItem[] = [
		{ id: "1", title: "Morning Vocabulary Blitz", kind: "words", done: false },
		{ id: "2", title: "Grammar Cases Deep Dive", kind: "lesson", done: false },
		{ id: "3", title: "Evening Audio Comprehension", kind: "listen", done: false },
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
		peakHours: [15],
		hourlyDistribution: new Array(24).fill(0),
		totalSessions: 10,
		suggestedTimes: ["15:00"],
		summary: "Active at 15:00",
	};

	const tasks: PlanTaskItem[] = [
		{ id: "t1", title: "Flashcard Sprint", kind: "blitz", done: false },
		{ id: "t2", title: "Conversation Scene", kind: "lesson", done: false },
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

test("buildDailyNudges handles multi-language day split across all languages", () => {
	const settings = {
		enabled: true,
		times: ["09:00", "14:00", "18:30"],
		soundPreset: "chime" as const,
		inAppBanner: true,
		systemNotification: true,
		smartAutoNudge: false,
		autoScheduleTasks: true,
		aiAssisted: false,
	};

	// Mimics the user's "Split the day": 210 min total across Slovak (90m), Estonian (61m), Russian (59m)
	const languages = [
		{
			id: "slovak",
			english: "Slovak",
			endonym: "Slovenčina",
			running: true,
			minutes: 90,
			practiced: 1, // 89 min remaining
			setUp: true,
			tasks: [{ id: "slovak-review", kind: "review", title: "Review", durationMinutes: 8, done: false }],
		},
		{
			id: "estonian",
			english: "Estonian",
			endonym: "Eesti",
			running: false,
			minutes: 61,
			practiced: 0, // 61 min remaining
			setUp: true,
			tasks: [{ id: "eesti-words", kind: "words", title: "Word Bank", durationMinutes: 10, done: false }],
		},
		{
			id: "russian",
			english: "Russian",
			endonym: "Русский",
			running: false,
			minutes: 59,
			practiced: 0, // 59 min remaining
			setUp: true,
			tasks: [{ id: "russian-lesson", kind: "lesson", title: "Grammar Unit", durationMinutes: 15, done: false }],
		},
	];

	const nudges = buildDailyNudges({
		settings,
		languages,
	});

	// Should generate scheduled slots + evening deadline warning
	assert.ok(nudges.length >= 3);

	// The slots should distribute across the unmet languages
	const languageIds = nudges.map((n) => n.languageId).filter(Boolean);
	assert.ok(languageIds.includes("slovak"));
	assert.ok(languageIds.includes("estonian"));
	assert.ok(languageIds.includes("russian"));

	// Deadline alert at 20:30 should break down all unmet languages
	const deadlineNudge = nudges.find((n) => n.source === "deadline_warning");
	assert.ok(deadlineNudge);
	assert.ok(deadlineNudge.urgent);
	assert.match(deadlineNudge.title, /209 min needed across 3 languages/);
	assert.match(deadlineNudge.message, /Slovenčina \(89m\)/);
	assert.match(deadlineNudge.message, /Eesti \(61m\)/);
	assert.match(deadlineNudge.message, /Русский \(59m\)/);

	// If all languages complete their goals, nudges are completely suppressed (unless study tasks remain)
	const completedLanguages = languages.map((l) => ({ ...l, practiced: l.minutes }));
	const completedNudges = buildDailyNudges({
		settings,
		languages: completedLanguages,
	});
	assert.equal(completedNudges.length, 0);
});

test("buildDailyNudges and shouldTriggerNudge alert on uncompleted study tasks even if minutes goal is met", () => {
	const settings = {
		enabled: true,
		times: ["09:00", "18:30"],
		soundPreset: "chime" as const,
		inAppBanner: true,
		systemNotification: true,
		smartAutoNudge: false,
		autoScheduleTasks: true,
		aiAssisted: false,
	};

	// Mock active experiment where today is Day 1, 0 of 5 dictation reps done
	const experimentStatus = {
		active: true,
		startDate: "2026-11-10",
		endDate: "2026-12-21",
		dayNumber: 1,
		totalDays: 42,
		phase: "baseline" as const,
		russianArm: "normal" as const,
		slovakArm: "normal" as const,
		weeklyCheckDue: false,
		weeklyCheckCompleted: false,
		weekNumber: 1,
		checkLastDate: null,
		validDay: false, // Incomplete!
		languages: [
			{ id: "russian", dictationReps: 2, understoodReps: 1, validDay: false, firstPlayShare: null },
			{ id: "slovak", dictationReps: 5, understoodReps: 2, validDay: true, firstPlayShare: 0.4 },
		],
		russian: {
			dictationReps: 2,
			understoodReps: 1,
			validDay: false,
			firstPlayShare: null,
		},
		slovak: {
			dictationReps: 0,
			understoodReps: 0,
			validDay: false,
			firstPlayShare: null,
		},
	};

	// 1. Even when todayMinutes >= dailyGoal (e.g. 30 of 20 min done), experiment nudge still generated
	const nudges = buildDailyNudges({
		settings,
		dailyGoal: 20,
		todayMinutes: 30,
		experiment: experimentStatus,
	});

	assert.ok(nudges.length > 0, "Should generate study alert despite goal minutes being met");
	const studyNudge = nudges.find((n) => n.source === "experiment");
	assert.ok(studyNudge, "Should contain an experiment source nudge");
	assert.equal(studyNudge?.taskKind, "listen");
	assert.equal(studyNudge?.title, "Study: 3 in Russian to go in Listen", "only the language still short is named");
	assert.match(studyNudge?.message ?? "", /Day 1 of 42/);

	// 2. Weekly check alert when check is due and uncompleted
	const checkDueStatus = {
		...experimentStatus,
		dayNumber: 7,
		weekNumber: 1,
		weeklyCheckDue: true,
		weeklyCheckCompleted: false,
		validDay: true, // Reps done, but check pending
		languages: experimentStatus.languages.map((l) => ({ ...l, dictationReps: 5, validDay: true })),
	};
	const checkNudges = buildDailyNudges({
		settings,
		dailyGoal: 20,
		todayMinutes: 20,
		experiment: checkDueStatus,
	});
	const checkNudge = checkNudges.find((n) => n.taskKind === "experiment");
	assert.ok(checkNudge, "Should contain weekly check alert");
	assert.match(checkNudge?.title ?? "", /week 1 check is open/);
	assert.equal(checkNudges.filter((n) => n.source === "experiment").length, 1, "a day that counts in both languages gets no Listen nudge");

	// 3. shouldTriggerNudge fires study alert when experimentPending is true even if todayMinutes >= dailyGoal
	const testTime = new Date("2026-11-10T20:30:00");
	const triggered = shouldTriggerNudge({
		nudges,
		firedKeys: [],
		now: testTime,
		dailyGoal: 20,
		todayMinutes: 30,
		experimentPending: true,
	});
	assert.ok(triggered, "shouldTriggerNudge should fire experiment nudge when goal minutes are met");
	assert.equal(triggered?.source, "experiment");

	// 4. When study day is valid and weekly check is completed, no nudges generated if minutes met
	const allDoneStatus = {
		...experimentStatus,
		validDay: true,
		languages: experimentStatus.languages.map((l) => ({ ...l, dictationReps: 5, validDay: true })),
		weeklyCheckDue: false,
		weeklyCheckCompleted: true,
	};
	const allDoneNudges = buildDailyNudges({
		settings,
		dailyGoal: 20,
		todayMinutes: 20,
		experiment: allDoneStatus,
	});
	assert.equal(allDoneNudges.length, 0, "No nudges when both goal minutes and study requirements are done");
});

