import assert from "node:assert/strict";
import { test } from "node:test";
import type { ScheduledNudge } from "../src/core/index.ts";
import { nudgeIcon } from "../components/notifications/nudge-icon.ts";

const nudge = (extra: Partial<ScheduledNudge> = {}): ScheduledNudge => ({
	id: "nudge-sched-09:00",
	time: "09:00",
	source: "scheduled",
	title: "Daily Goal: 12 min left",
	message: "Keep going.",
	...extra,
});

test("a reminder that names a practice wears that practice's icon, the plan's own", () => {
	assert.equal(nudgeIcon(nudge({ taskKind: "blitz" })), "fast");
	assert.equal(nudgeIcon(nudge({ taskKind: "review" })), "review");
	assert.equal(nudgeIcon(nudge({ taskKind: "listen" })), "listen");
	assert.equal(nudgeIcon(nudge({ taskKind: "words" })), "words");
	assert.equal(nudgeIcon(nudge({ taskKind: "speak" })), "speak");
});

test("a reminder with no practice points at what it is about instead", () => {
	assert.equal(nudgeIcon(nudge({ source: "deadline_warning" })), "flag");
	assert.equal(nudgeIcon(nudge({ source: "evening_deadline" })), "flag");
	assert.equal(nudgeIcon(nudge({ source: "streak_saver" })), "flag");
	assert.equal(nudgeIcon(nudge({ source: "smart_trend" })), "chart");
});

test("a practice this build does not have falls back to what the reminder is about", () => {
	assert.equal(nudgeIcon(nudge({ source: "smart_trend", taskKind: "goal" })), "chart");
	assert.equal(nudgeIcon(nudge({ source: "deadline_warning", taskKind: "constructor" })), "flag");
});

test("a source this build does not have still shows something", () => {
	assert.equal(nudgeIcon(nudge({ source: "unknown_source" as ScheduledNudge["source"] })), "flag");
});
