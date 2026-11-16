/**
 * MEASURED MINUTES PINS (2026-10-29): the active-time clock
 * (interactive gaps capped, passive visible-and-focused), the per-activity
 * ledger, the strand balance reading measured minutes before estimates,
 * the server handlers that record them and the endpoint that takes the
 * time of a session left unfinished.
 *
 * Runs under an isolated LANNA_DATA_DIR, so every app-module import is dynamic.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-active-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";

const {
	ACTIVITY_CAP_MIN,
	addMinutes,
	createActiveClock,
	GAP_CAP_MS,
	isTimedActivity,
	MIN_SEND_MS,
	practiceClock,
	sessionMs,
	TIMED_ACTIVITIES,
	watchClockOn,
} = await import("../src/core/active-time.ts");

it("watchClockOn: nothing counts before the video loads; playing counts; a line waiting for the learner counts up to its cap; questions and paused time count until the gap cap", () => {
	const watching = {
		watching: true,
		questions: false,
		ready: true,
		playing: false,
		deciding: false,
		decideCapped: false,
		idle: false,
	};
	assert.equal(watchClockOn({ ...watching, ready: false, playing: true }), false, "the video is not loaded yet");
	assert.equal(
		watchClockOn({ ...watching, playing: true, idle: true }),
		true,
		"a playing video counts, even with no action",
	);
	assert.equal(
		watchClockOn({ ...watching, deciding: true, idle: true }),
		true,
		"a line waiting for Got it counts, even with no action, up to its cap",
	);
	assert.equal(
		watchClockOn({ ...watching, deciding: true, decideCapped: true, idle: true }),
		false,
		"past the line cap and idle, it stops",
	);
	assert.equal(
		watchClockOn({ ...watching, deciding: true, decideCapped: true }),
		true,
		"past the line cap, a recent action still counts",
	);
	assert.equal(watchClockOn({ ...watching, idle: true }), false, "paused and idle does not count");
	assert.equal(
		watchClockOn({
			watching: false,
			questions: true,
			ready: false,
			playing: false,
			deciding: false,
			decideCapped: false,
			idle: false,
		}),
		true,
		"a question being answered counts",
	);
	assert.equal(
		watchClockOn({
			watching: false,
			questions: true,
			ready: false,
			playing: false,
			deciding: false,
			decideCapped: false,
			idle: true,
		}),
		false,
		"questions left idle do not count",
	);
	assert.equal(
		watchClockOn({
			watching: false,
			questions: false,
			ready: true,
			playing: true,
			deciding: false,
			decideCapped: false,
			idle: false,
		}),
		false,
		"the end card is not watching",
	);
});
const { strandBalance, strandCaption, strandMinutes, strandParts, STRAND_MINUTES } =
	await import("../src/core/strands.ts");
const { dayKey } = await import("../src/core/review.ts");
const { recordActiveTime, recordLesson, recordReviewXp } = await import("../src/server/lesson.ts");
const { emptyProgress, progressStore } = await import("../src/store/progress.ts");
const { readLessonLog } = await import("../src/store/corpus.ts");
const timeRoute = await import("../app/api/progress/time/route.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const NOW = new Date("2026-10-28T10:00:00Z");
const DAY = "2026-10-28";
const MIN = 60_000;
const rep = { itemId: "x#0", slug: "x", kind: "choose" as const, verdict: "exact" as const };
const today = () => progressStore.read().days[DAY]!;

beforeEach(() => progressStore.write(emptyProgress()));

describe("addMinutes: one session's time into the day", () => {
	it("adds to the total and to the activity's own share, and keeps adding", () => {
		const day: { minutes?: number; minutesBy?: Record<string, number> } = {};
		assert.equal(addMinutes(day, "lesson", 2 * MIN), 2);
		assert.equal(addMinutes(day, "lesson", 1 * MIN), 1);
		assert.equal(addMinutes(day, "review", 30_000), 0.5);
		assert.equal(day.minutes, 3.5);
		assert.deepEqual(day.minutesBy, { lesson: 3, review: 0.5 });
	});

	it("caps one session at the activity's ceiling, a safety net for a forgotten tab", () => {
		const day: { minutes?: number } = {};
		assert.equal(addMinutes(day, "review", 20 * MIN), ACTIVITY_CAP_MIN.review);
		assert.equal(ACTIVITY_CAP_MIN.review, 5);
		assert.equal(addMinutes(day, "watch", 3 * 3_600_000), ACTIVITY_CAP_MIN.watch);
		for (const a of TIMED_ACTIVITIES) assert.ok(ACTIVITY_CAP_MIN[a] > 0, `${a} has a cap`);
	});

	it("ignores what is not a duration and leaves no entry, so the balance falls back to its estimate", () => {
		for (const bad of [undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, "5" as unknown as number]) {
			const day = {};
			assert.equal(addMinutes(day, "lesson", bad), 0);
			assert.deepEqual(day, {});
		}
	});

	it("keeps a measured zero as zero: the learner was there and did nothing", () => {
		const day: { minutes?: number; minutesBy?: Record<string, number> } = {};
		assert.equal(addMinutes(day, "watch", 0), 0);
		assert.equal(day.minutesBy?.watch, 0);
		assert.equal(day.minutes, 0);
	});

	it("knows its activities", () => {
		assert.ok(isTimedActivity("blitz") && isTimedActivity("placement"));
		assert.ok(!isTimedActivity("talk") && !isTimedActivity("") && !isTimedActivity(3));
	});
});

describe("practiceClock: a session's time on its end screen", () => {
	it("shows minutes and seconds, and hours past 59:59", () => {
		assert.equal(practiceClock(0), "0:00");
		assert.equal(practiceClock(42_400), "0:42");
		assert.equal(practiceClock(7 * 60_000 + 20_000), "7:20");
		assert.equal(practiceClock(59 * 60_000 + 59_000), "59:59");
		assert.equal(practiceClock(65 * 60_000 + 3_000), "1:05:03");
	});
});

describe("sessionMs: which duration a finished session adds", () => {
	it("prefers the measured active time, including a measured 0", () => {
		assert.equal(sessionMs({ activeMs: 90_000, ms: 600_000 }), 90_000);
		assert.equal(sessionMs({ activeMs: 0, ms: 600_000 }), 0);
	});
	it("falls back to the old wall-clock ms for a client that sends no active time", () => {
		assert.equal(sessionMs({ ms: 5_000 }), 5_000);
		assert.equal(sessionMs({ activeMs: -5, ms: 3_000 }), 3_000);
		assert.equal(sessionMs({ activeMs: Number.NaN, ms: 3_000 }), 3_000);
	});
	it("is nothing when there is no real duration", () => {
		assert.equal(sessionMs({}), undefined);
		assert.equal(sessionMs({ ms: 0 }), undefined);
	});
});

describe("the interactive clock: the time between actions, each gap capped", () => {
	it("counts a busy stretch in full", () => {
		let t = 0;
		const clock = createActiveClock("interactive", { now: () => t });
		t = 10_000;
		clock.act();
		t = 25_000;
		clock.act();
		assert.equal(clock.read(), 25_000);
	});

	it("walking away stops the clock: a long gap counts only up to the cap", () => {
		let t = 0;
		const clock = createActiveClock("interactive", { now: () => t });
		t = 25_000;
		clock.act();
		t += 10 * MIN;
		assert.equal(clock.read(), 25_000 + GAP_CAP_MS, "the trailing silence is capped too");
		clock.act();
		assert.equal(clock.read(), 25_000 + GAP_CAP_MS, "and so is the action that ends it");
		assert.equal(GAP_CAP_MS, 90_000);
	});

	it("hands out what is unsent and starts again, so a flush and a finish never count the same seconds", () => {
		let t = 0;
		const clock = createActiveClock("interactive", { now: () => t });
		t = 20_000;
		clock.act();
		assert.equal(clock.take(), 20_000);
		assert.equal(clock.take(), 0, "nothing is counted twice");
		t += 5_000;
		assert.equal(clock.read(), 5_000);
		clock.reset();
		assert.equal(clock.read(), 0);
	});

	it("ignores visibility: that is the passive clock's rule", () => {
		let t = 0;
		const clock = createActiveClock("interactive", { now: () => t });
		clock.engage(false);
		t = 10_000;
		assert.equal(clock.read(), 10_000);
	});

	it("a send under the floor is noise", () => {
		assert.equal(MIN_SEND_MS, 2_000);
	});
});

describe("the passive clock: the time the tab is visible and focused", () => {
	it("stops while the tab is hidden and resumes when it is back", () => {
		let t = 0;
		const clock = createActiveClock("passive", { now: () => t });
		t = 30_000;
		clock.engage(false);
		t += 10 * MIN;
		assert.equal(clock.read(), 30_000, "ten hidden minutes are not practice");
		clock.engage(true);
		t += 20_000;
		assert.equal(clock.read(), 50_000);
	});

	it("needs no clicks: minutes of watching count in full", () => {
		let t = 0;
		const clock = createActiveClock("passive", { now: () => t });
		t = 8 * MIN;
		assert.equal(clock.read(), 8 * MIN);
	});

	it("can start disengaged (not on a practice screen) and ignores actions", () => {
		let t = 0;
		const clock = createActiveClock("passive", { now: () => t, engaged: false });
		t = 60_000;
		clock.act();
		assert.equal(clock.read(), 0);
		clock.engage(true);
		t += 15_000;
		assert.equal(clock.read(), 15_000);
	});

	it("keeps running after a take, and a take while hidden hands out only what was banked", () => {
		let t = 0;
		const clock = createActiveClock("passive", { now: () => t });
		t = 50_000;
		assert.equal(clock.take(), 50_000);
		t += 5_000;
		assert.equal(clock.read(), 5_000);
		clock.engage(false);
		t += MIN;
		assert.equal(clock.take(), 5_000);
		assert.equal(clock.take(), 0);
	});
});

describe("the strand balance reads measured minutes, then the plan's estimate", () => {
	it("an activity with a measurement is counted from it, not from count × planned minutes", () => {
		const b = strandBalance([{ lessons: 2, minutesBy: { lesson: 7.5 } }]);
		assert.equal(b.minutes.form, 7.5, "not the 2 × 3 min the plan guesses");
		assert.equal(b.estimated, 0);
	});

	it("falls back per activity, so one measured activity does not hide another's estimate", () => {
		const b = strandBalance([{ lessons: 1, reviews: 8, minutesBy: { lesson: 4 } }]);
		assert.equal(b.minutes.form, 4 + 8 * STRAND_MINUTES.review);
		assert.equal(b.estimated, 8 * STRAND_MINUTES.review);
	});

	it("Blitz is Speed and a lesson is Words & rules, each from its own key", () => {
		const m = strandMinutes({ blitz: 1, lessons: 1, minutesBy: { blitz: 1.5, lesson: 5 } });
		assert.equal(m.fluency, 1.5);
		assert.equal(m.form, 5);
	});

	it("listening, reading and watching are input; speaking is output; re-reads and say-it-faster are speed", () => {
		const m = strandMinutes({ minutesBy: { listen: 2.5, read: 4, watch: 6, speak: 7, reread: 3, fast: 2 } });
		assert.equal(m.input, 12.5);
		assert.equal(m.output, 7);
		assert.equal(m.fluency, 5);
		assert.equal(m.form, 0);
	});

	it("a measured zero stays zero instead of reverting to the estimate", () => {
		const b = strandBalance([{ listens: 1, minutesBy: { listen: 0 } }]);
		assert.equal(b.minutes.input, 0);
		assert.equal(b.estimated, 0);
	});

	it("Talk, Story and tutor sessions have no timer, so they are always estimated", () => {
		const b = strandBalance([{ talks: 1, stories: 1, tutors: 1, minutesBy: { lesson: 3 } }]);
		assert.equal(b.minutes.output, STRAND_MINUTES.talk);
		assert.equal(b.minutes.input, STRAND_MINUTES.story);
		assert.equal(b.minutes.form, 3 + STRAND_MINUTES.tutor);
		assert.equal(b.estimated, STRAND_MINUTES.talk + STRAND_MINUTES.story + STRAND_MINUTES.tutor);
	});

	it("placement time is in the day's total but in no strand, as it always was", () => {
		const b = strandBalance([{ minutesBy: { placement: 15 } }]);
		assert.equal(b.total, 0);
		assert.equal(b.behind, null);
	});

	it("a week mixing old days and measured days counts each day by what it has", () => {
		const b = strandBalance([{ watches: 1 }, { watches: 1, minutesBy: { watch: 3 } }]);
		assert.equal(b.minutes.input, STRAND_MINUTES.watch + 3);
		assert.equal(b.estimated, STRAND_MINUTES.watch);
	});

	it("keeps the count-only behavior for days with no measurement at all", () => {
		assert.equal(strandMinutes({ watches: 2 }).input, 16);
		const p = strandParts({ lessons: 3, reviews: 28 });
		assert.equal(p.minutes.form, 3 * 3 + 28 * 0.25);
		assert.equal(p.estimated, p.minutes.form);
	});

	it("never calls more of the total estimated than the total", () => {
		const b = strandBalance([{ lessons: 1 }, { reviews: 1, minutesBy: { review: 0.1 } }]);
		assert.ok(b.estimated <= b.total);
	});
});

describe("the balance caption says how the minutes were counted", () => {
	it("is plain before anything is counted", () => {
		assert.match(strandCaption(strandBalance([])), /Measured while you practice/);
	});
	it("says measured when every minute was", () => {
		const text = strandCaption(strandBalance([{ lessons: 1, minutesBy: { lesson: 12 } }]));
		assert.match(text, /^12 min this week, measured while you were active\./);
	});
	it("says planned minutes when none were measured", () => {
		const text = strandCaption(strandBalance([{ watches: 1 }]));
		assert.match(text, /^About 8 min this week, counted from each activity's planned minutes\./);
	});
	it("splits the two when a week has both", () => {
		const text = strandCaption(strandBalance([{ lessons: 1, minutesBy: { lesson: 10 }, talks: 1 }]));
		assert.match(
			text,
			/16 min this week: 10 measured while you were active, 6 counted from planned minutes \(tutor, Talk, Story and older days\)/,
		);
	});
});

describe("the server records measured minutes per activity", () => {
	it("a lesson counts its active time while the log keeps the wall-clock", () => {
		recordLesson({ unit: "loc", mode: "lesson", reps: [rep], ms: 10 * MIN, activeMs: 3 * MIN, tz: 0 }, NOW);
		assert.equal(today().minutes, 3);
		assert.deepEqual(today().minutesBy, { lesson: 3 });
		const entry = readLessonLog().find((e) => e.mode === "lesson" && e.ms === 10 * MIN);
		assert.ok(entry, "the log still has the wall-clock ms (speeds and logs read it)");
	});

	it("a Blitz is Speed time, under its own key", () => {
		recordLesson({ unit: "loc", mode: "blitz", reps: [rep], ms: 60_000, activeMs: 45_000, tz: 0 }, NOW);
		assert.deepEqual(today().minutesBy, { blitz: 0.75 });
	});

	it("a client that sends only ms still counts (older tab, older caller)", () => {
		recordLesson({ unit: "loc", mode: "lesson", reps: [rep], ms: 2 * MIN, tz: 0 }, NOW);
		assert.equal(today().minutes, 2);
		assert.equal(today().minutesBy?.lesson, 2);
	});

	it("no timing at all leaves no minutes and no entry", () => {
		recordLesson({ unit: "loc", mode: "lesson", reps: [rep], tz: 0 }, NOW);
		assert.equal(today().minutes, undefined);
		assert.equal(today().minutesBy, undefined);
	});

	it("a review card counts its active time and its XP as before", () => {
		const xp = recordReviewXp("exact", 0, NOW, 400_000, 30_000);
		assert.equal(xp, 8);
		recordReviewXp("wrong", 0, NOW, undefined, 10_000);
		assert.equal(today().reviews, 2);
		assert.equal(today().minutesBy?.review, 40_000 / MIN);
	});

	it("a card left open for twenty minutes still counts five at most", () => {
		recordReviewXp("exact", 0, NOW, 20 * MIN, 20 * MIN);
		assert.equal(today().minutesBy?.review, 5);
	});

	it("time sent when leaving adds minutes only: no count, no XP, and a later finish adds its own part", () => {
		assert.equal(recordActiveTime("lesson", 90_000, 0, NOW), 1.5);
		assert.equal(today().xp, 0);
		assert.equal(today().lessons, 0);
		assert.equal(today().reps, 0);
		assert.equal(today().minutesBy?.lesson, 1.5);
		recordLesson({ unit: "loc", mode: "lesson", reps: [rep], activeMs: 30_000, tz: 0 }, NOW);
		assert.equal(today().minutes, 2);
		assert.equal(today().lessons, 1);
	});

	it("an unfinished session's time counts toward the strand it belongs to", () => {
		recordActiveTime("fast", 3 * MIN, 0, NOW);
		const b = strandBalance([today()]);
		assert.equal(b.minutes.fluency, 3);
		assert.equal(b.estimated, 0);
	});
});

describe("POST /api/progress/time", () => {
	const post = (body: unknown) =>
		timeRoute.POST(new Request("http://127.0.0.1/api/progress/time", { method: "POST", body: JSON.stringify(body) }));
	const todayKey = () => dayKey(new Date(), 0);

	it("takes the time of a session that was left", async () => {
		const res = await post({ activity: "speak", ms: 2 * MIN, tz: 0 });
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { minutes: 2 });
		assert.equal(progressStore.read().days[todayKey()]?.minutesBy?.speak, 2);
	});

	it("refuses an activity it does not time, a bad duration and a missing body", async () => {
		assert.equal((await post({ activity: "talk", ms: 1000 })).status, 400);
		assert.equal((await post({ activity: "lesson", ms: -5 })).status, 400);
		assert.equal((await post({ activity: "lesson", ms: "5" })).status, 400);
		assert.equal((await post({ ms: 1000 })).status, 400);
		assert.equal(
			(await timeRoute.POST(new Request("http://127.0.0.1/api/progress/time", { method: "POST", body: "not json" })))
				.status,
			400,
		);
	});

	it("caps a single send, first at six hours, then at the activity's own ceiling", async () => {
		const res = await post({ activity: "review", ms: 99 * 3_600_000, tz: 0 });
		assert.deepEqual(await res.json(), { minutes: 5 });
	});
});
