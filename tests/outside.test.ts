/**
 * LISTENING OUTSIDE THE APP (2026-11-07): what an entry may hold, the
 * 14-day summary and its weights, the milestone's extra speed date, and the
 * server round trip under an isolated LANNA_DATA_DIR.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-outside-"));
process.env.LANNA_DATA_DIR = TMP;
process.env.LANNA_PROFILE = "slovak";

const { parseEntry, outsideSummary, OUTSIDE_WEIGHT, MAX_DAY_MINUTES } = await import("../src/core/outside.ts");
const { estimateMilestone, creditedSpeed, MILESTONES } = await import("../src/core/milestones.ts");
type LearnerFacts = import("../src/core/milestones.ts").LearnerFacts;
type OutsideEntry = import("../src/core/outside.ts").OutsideEntry;
const { logOutside, removeOutside, outsideState, paceWindow } = await import("../src/server/outside.ts");
const { learnerFacts } = await import("../src/server/milestones.ts");
const { progressStore } = await import("../src/store/progress.ts");

after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const NOW = new Date("2026-11-07T12:00:00Z");
const entry = (day: string, minutes: number, attention: "focused" | "background"): OutsideEntry => ({
	id: `${day}-${minutes}-${attention}`,
	day,
	at: `${day}T20:00:00Z`,
	minutes,
	attention,
});

test("an entry needs whole minutes in range and one of the two kinds of attention", () => {
	assert.deepEqual(parseEntry({ minutes: 29.6, attention: "focused", what: "  Podcast   o  Bratislave " }), {
		ok: true,
		minutes: 30,
		attention: "focused",
		what: "Podcast o Bratislave",
	});
	assert.equal(parseEntry({ minutes: 0, attention: "focused" }).ok, false);
	assert.equal(parseEntry({ minutes: 601, attention: "focused" }).ok, false);
	assert.equal(parseEntry({ minutes: 30, attention: "half" }).ok, false);
	assert.equal(parseEntry(null).ok, false);
	const plain = parseEntry({ minutes: 10, attention: "background", what: "   " });
	assert.ok(plain.ok && !("what" in plain));
});

test("the summary averages over every day of the window, credits focused time at its weight and background at none", () => {
	const days = paceWindow(NOW, 0);
	assert.equal(days.length, 14);
	const s = outsideSummary(
		[entry(days[13]!, 140, "focused"), entry(days[12]!, 280, "background"), entry("2026-01-01", 600, "focused")],
		days,
	);
	assert.equal(s.focusedPerDay, 10);
	assert.equal(s.backgroundPerDay, 20);
	assert.equal(s.creditedPerDay, 10 * OUTSIDE_WEIGHT.focused + 20 * OUTSIDE_WEIGHT.background);
	assert.equal(s.focusedHours, 12.3);
	assert.equal(s.entries, 3);
});

test("a day counts no more than sixteen hours, focused first", () => {
	const days = paceWindow(NOW, 0);
	const today = days[13]!;
	const s = outsideSummary(
		[entry(today, 600, "focused"), entry(today, 300, "focused"), entry(today, 600, "background")],
		days,
	);
	assert.equal(Math.round(s.focusedPerDay * 14), 900);
	assert.equal(Math.round(s.backgroundPerDay * 14), MAX_DAY_MINUTES - 900);
});

function facts(over: Partial<LearnerFacts> = {}): LearnerFacts {
	const base: Omit<LearnerFacts, "speed"> = {
		level: "B1",
		levelProgress: 0.4,
		placed: true,
		words: { basis: "level", credited: 2880 },
		met: 400,
		solid: 120,
		assumed: 3200,
		vocabulary: 3600,
		wordsPerDayPlanned: 15,
		wordsPerDayReal: 6,
		minutesPerDay: 60,
		daysPerWeek: 6,
		paceMinutes: 20,
		paceDays: 12,
		hoursDone: 300,
		hoursLogged: 40,
		listen: {
			sessions: 12,
			reading: { wpm: 80, samples: 90, words: 700, realtime: 0.3, audioWpm: 150 },
			trend: null,
			knownSentences: { total: 60, right: 52 },
		},
		watch: null,
	};
	const merged = { ...base, ...over };
	return { ...merged, speed: creditedSpeed(merged) };
}

const vlog = MILESTONES.find((m) => m.id === "vlog")!;
const outside = (creditedPerDay: number) => ({
	focusedPerDay: creditedPerDay * 2,
	backgroundPerDay: 90,
	creditedPerDay,
	focusedHours: 10,
	backgroundHours: 20,
	entries: 4,
});

test("focused outside time adds a speed date of its own and leaves the measured dates alone", () => {
	const plain = estimateMilestone(vlog, facts(), { now: NOW });
	const withOutside = estimateMilestone(vlog, facts({ outside: outside(30) }), { now: NOW });
	assert.equal(plain.speed.outside, null);
	assert.deepEqual(withOutside.speed.eta, plain.speed.eta);
	assert.deepEqual(withOutside.eta, plain.eta);
	const o = withOutside.speed.outside;
	assert.ok(o && o.basis === "added");
	assert.equal(o.measuredPerDay, 20);
	assert.equal(o.creditedPerDay, 30);
	// 336 hours to go at 20 measured + 30 credited minutes a day.
	assert.ok(Math.abs(o.days - plain.speed.hoursToGo / (50 / 60)) < 1);
	assert.ok(o.days < plain.speed.eta.daysPace!);
	// Without a measured pace yet, the outside minutes stand alone and the row says so.
	const unpaced = estimateMilestone(vlog, facts({ paceDays: 3, outside: outside(30) }), { now: NOW }).speed.outside;
	assert.ok(unpaced && unpaced.basis === "added" && unpaced.measuredPerDay === 0);
});

test("background time alone adds nothing, and the learner's own trend already holds what outside listening did", () => {
	assert.equal(estimateMilestone(vlog, facts({ outside: outside(0) }), { now: NOW }).speed.outside, null);
	const trended = estimateMilestone(
		vlog,
		facts({
			outside: outside(30),
			listen: {
				sessions: 12,
				reading: { wpm: 80, samples: 90, words: 700, realtime: 0.3, audioWpm: 150 },
				trend: { slope: 0.2, points: 9 },
				knownSentences: { total: 60, right: 52 },
			},
		}),
		{ now: NOW },
	);
	assert.equal(trended.speed.hoursBasis, "trend");
	assert.deepEqual(trended.speed.outside, { basis: "in-trend" });
});

test("logging, listing and removing on the server; the measured minutes never move", () => {
	const before = JSON.stringify(progressStore.read().days);
	const bad = logOutside({ minutes: 30, attention: "focused", day: "2026-10-01" }, NOW, 0);
	assert.equal(bad.ok, false);
	const a = logOutside({ minutes: 45, attention: "focused", what: "Rádio Slovensko" }, NOW, 0);
	assert.ok(a.ok);
	assert.equal(a.entry.day, "2026-11-07");
	const b = logOutside({ minutes: 60, attention: "background", day: "2026-11-06" }, NOW, 0);
	assert.ok(b.ok);
	const state = outsideState(NOW, 0);
	assert.deepEqual(state.days.slice(0, 2), ["2026-11-07", "2026-11-06"]);
	assert.equal(state.recent.length, 2);
	assert.equal(state.summary.focusedPerDay, Math.round((45 / 14) * 10) / 10);
	assert.equal(learnerFacts(null, NOW, 0).outside?.entries, 2);
	assert.equal(JSON.stringify(progressStore.read().days), before);
	assert.equal(removeOutside(a.entry.id, NOW, 0).ok, true);
	assert.equal(removeOutside(a.entry.id, NOW, 0).ok, false);
	assert.equal(outsideState(NOW, 0).recent.length, 1);
	assert.ok(fs.existsSync(path.join(TMP, "profiles", "slovak", "outside-listening.json")));
});
