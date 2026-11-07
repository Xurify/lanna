/**
 * PLAN AND FEEDBACK PINS: what the day's ledger counts and what Today shows.
 * A Talk or tutor day keeps the streak; a lesson with no reps is not a
 * lesson; a tutor session counts when the learner types, once; yesterday's
 * unfinished tasks come back on top; the pace line carries the logged
 * minutes. Runs under an isolated LH_DATA_DIR, so every app import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-plan-feedback-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const { RECENT_DAYS } = await import("../src/core/carry-over.ts");
const { chatStore } = await import("../src/store/chats.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { persistTurn } = await import("../src/server/turn-service.ts");
const { progressSummary, recordActivity, recordLesson, setGoal } = await import("../src/server/lesson.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const user = (text: string) => ({ role: "user", content: text, timestamp: Date.now() }) as unknown as AgentMessage;

describe("the streak", () => {
	it("a day with only a Talk is an active day", () => {
		const now = new Date("2026-10-20T10:00:00Z");
		recordActivity("talk", undefined, 0, now);
		const s = progressSummary(0, now);
		assert.equal(s.streak.activeToday, true);
		assert.equal(s.streak.days, 1);
	});
});

describe("a lesson", () => {
	it("with no reps is not counted; with a rep it is", () => {
		const now = new Date("2026-10-21T10:00:00Z");
		recordLesson({ unit: "loc", mode: "lesson", reps: [], tz: 0 }, now);
		assert.equal(progressStore.read().units["loc"]?.lessons ?? 0, 0);
		assert.equal(progressStore.read().days["2026-10-21"]?.lessons ?? 0, 0);
		recordLesson({ unit: "loc", mode: "lesson", reps: [{ itemId: "x#0", slug: "x", kind: "choose", verdict: "exact" }], tz: 0 }, now);
		assert.equal(progressStore.read().units["loc"]?.lessons, 1);
	});
});

describe("a tutor unit's session", () => {
	it("is counted when the learner first types, and once", () => {
		const chat = chatStore.createChat("Tutor: Aspect", "practice");
		chatStore.setTutorUnit(chat.id, "aspect");
		const lessons = () => progressStore.read().units["aspect"]?.lessons ?? 0;
		// The chat's own opening prompt is the first user message: not counted.
		persistTurn(chatStore, chat.id, 0, [user("opening prompt")], false);
		assert.equal(lessons(), 0);
		persistTurn(chatStore, chat.id, 0, [user("my first reply")], false);
		assert.equal(lessons(), 1);
		persistTurn(chatStore, chat.id, 0, [user("and another")], false);
		assert.equal(lessons(), 1);
		assert.equal(chatStore.getChat(chat.id)?.tutorCounted, true);
	});

	it("is not counted for a chat with no tutor unit", () => {
		const chat = chatStore.createChat("Talk: Café", "practice");
		persistTurn(chatStore, chat.id, 0, [user("one")], false);
		persistTurn(chatStore, chat.id, 0, [user("two")], false);
		assert.equal(chatStore.getChat(chat.id)?.tutorCounted, undefined);
	});
});

describe("Today", () => {
	const now = new Date("2026-10-28T10:00:00Z");

	it("shows yesterday's unfinished tasks first, checks the ledger, and counts only what the plan offers", () => {
		const p = progressStore.read();
		for (const k of Object.keys(p.days)) if (k < "2026-10-26") delete p.days[k]; // the earlier tests' days
		p.days["2026-10-27"] = {
			xp: 5,
			lessons: 0,
			reps: 0,
			reviews: 0,
			listens: 1,
			minutes: 21,
			planned: [
				{ id: "listen", title: "Listen", done: false },
				{ id: "read", title: "Read", done: false },
				{ id: "fluency", title: "Speed", done: false },
			],
		};
		p.days["2026-10-26"] = { xp: 5, lessons: 0, reps: 0, reviews: 0, minutes: 14 };
		progressStore.write(p);
		setGoal({ minutesPerDay: 90 }, 0, now);

		const s = progressSummary(0, now);
		const from = (id: string) => s.plan.tasks.find((t) => t.id === id)?.from;
		assert.equal(from("read"), "2026-10-27");
		assert.equal(from("fluency"), "2026-10-27");
		assert.equal(from("listen"), undefined, "the ledger says it was done");
		assert.ok(s.plan.tasks[0]!.from, "carried tasks lead");
		assert.equal(s.backlog, 2);
	});

	it("keeps today's plan as a snapshot and reports the goal against the logged week", () => {
		const s = progressSummary(0, new Date("2026-10-28T10:00:00Z"));
		const planned = progressStore.read().days["2026-10-28"]?.planned;
		assert.deepEqual(
			planned?.map((t) => t.id),
			s.plan.tasks.map((t) => t.id),
		);
		assert.equal(s.pace.goalMinutes, 90);
		assert.equal(s.pace.logged, 35);
		assert.equal(s.pace.windowDays, RECENT_DAYS);
		assert.equal(s.pace.dailyAverage, Math.round(35 / RECENT_DAYS));
	});
});
