import assert from "node:assert/strict";
import { test } from "node:test";
import type { ScheduledNudge, TaskKind } from "../src/core/index.ts";
import type { QIconName } from "../components/quiet/icon-paths.ts";
import { nudgeIcon } from "../components/notifications/nudge-icon.ts";

const nudge = (extra: Partial<ScheduledNudge> = {}): ScheduledNudge => ({
	id: "nudge-sched-09:00",
	time: "09:00",
	source: "scheduled",
	title: "Daily Goal: 12 min left",
	message: "Keep going.",
	...extra,
});

/** The plan's own icon for each practice, as its cards and the log draw them. */
const PRACTICE_ICON: ReadonlyArray<readonly [TaskKind, QIconName]> = [
	["review", "review"],
	["listen", "listen"],
	["lesson", "grammar"],
	["strengthen", "letter"],
	["blitz", "fast"],
	["words", "words"],
	["read", "read"],
	["watch", "play"],
	["speak", "speak"],
	["fluency", "fast"],
];

test("every practice the plan builds wears the plan's own icon for it", () => {
	for (const [kind, icon] of PRACTICE_ICON) {
		assert.equal(nudgeIcon(nudge({ taskKind: kind })), icon, kind);
	}
});

test("a reminder that names a practice wears it whatever kind of reminder it is", () => {
	assert.equal(nudgeIcon(nudge({ source: "scheduled", taskKind: "words" })), "words");
	assert.equal(nudgeIcon(nudge({ source: "smart_trend", taskKind: "read" })), "read");
	assert.equal(nudgeIcon(nudge({ source: "deadline_warning", taskKind: "listen", urgent: true })), "listen");
});

test("a reminder that names no practice points at what it is about", () => {
	assert.equal(nudgeIcon(nudge({ source: "scheduled" })), "flag");
	assert.equal(nudgeIcon(nudge({ source: "deadline_warning", urgent: true })), "flag");
	assert.equal(nudgeIcon(nudge({ source: "smart_trend" })), "chart");
});

test("a practice this build does not have falls back to what the reminder is about", () => {
	assert.equal(nudgeIcon(nudge({ source: "deadline_warning", taskKind: "goal" })), "flag");
	assert.equal(nudgeIcon(nudge({ source: "smart_trend", taskKind: "constructor" })), "chart");
	assert.equal(nudgeIcon(nudge({ source: "scheduled", taskKind: "toString" })), "flag");
});

test("a source this build does not build still shows what the reminder is about", () => {
	assert.equal(nudgeIcon(nudge({ source: "evening_deadline" })), "flag");
	assert.equal(nudgeIcon(nudge({ source: "streak_saver", taskKind: "review" })), "review");
	assert.equal(nudgeIcon(nudge({ source: "unknown" as ScheduledNudge["source"] })), "flag");
});
