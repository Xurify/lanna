import assert from "node:assert/strict";
import { test } from "node:test";
import {
	NOTIFICATION_LOG_LIMIT,
	appendNotification,
	nudgeTarget,
	parseNotificationLog,
	unreadNotifications,
	upcomingNudges,
	type LoggedNotification,
	type ScheduledNudge,
} from "../src/core/index.ts";

const nudge = (time: string, extra: Partial<ScheduledNudge> = {}): ScheduledNudge => ({
	id: `nudge-sched-${time}`,
	time,
	source: "scheduled",
	title: `Daily Goal at ${time}`,
	message: "Keep going.",
	...extra,
});

test("the newest notification comes first and the log stops at its limit", () => {
	let log: LoggedNotification[] = [];
	for (let i = 0; i < NOTIFICATION_LOG_LIMIT + 5; i++) log = appendNotification(log, nudge("09:00"), i);
	assert.equal(log.length, NOTIFICATION_LOG_LIMIT);
	assert.equal(log[0]?.firedAt, NOTIFICATION_LOG_LIMIT + 4);
	assert.equal(log.at(-1)?.firedAt, 5);
});

test("unread counts only what fired after the list was last opened", () => {
	const log = [3, 2, 1].map((firedAt) => ({ nudge: nudge("09:00"), firedAt }));
	assert.equal(unreadNotifications(log, 0), 3);
	assert.equal(unreadNotifications(log, 2), 1);
	assert.equal(unreadNotifications(log, 3), 0);
});

test("upcoming keeps the reminders later than the current minute", () => {
	const schedule = [nudge("09:00"), nudge("18:30"), nudge("20:30")];
	const at = (h: number, m: number) => new Date(2026, 10, 18, h, m);
	assert.deepEqual(
		upcomingNudges(schedule, at(18, 30)).map((n) => n.time),
		["20:30"],
	);
	assert.equal(upcomingNudges(schedule, at(8, 59)).length, 3);
	assert.equal(upcomingNudges(schedule, at(23, 0)).length, 0);
});

test("a stored log that is missing, broken or the wrong shape reads as empty", () => {
	assert.deepEqual(parseNotificationLog(null), []);
	assert.deepEqual(parseNotificationLog("{not json"), []);
	assert.deepEqual(parseNotificationLog('{"a":1}'), []);
	const good = { nudge: nudge("09:00"), firedAt: 7 };
	assert.deepEqual(parseNotificationLog(JSON.stringify([good, { firedAt: "x" }, null, { nudge: {}, firedAt: 1 }])), [
		good,
	]);
});

test("a notification opens its link, its task, or nothing", () => {
	assert.equal(nudgeTarget(nudge("09:00", { href: "/review", taskKind: "words" })), "/review");
	assert.equal(nudgeTarget(nudge("09:00", { taskKind: "listen" })), "/listen");
	assert.equal(nudgeTarget(nudge("09:00", { taskKind: "word bank" })), "/#task-word%20bank");
	assert.equal(nudgeTarget(nudge("09:00")), null);
});
