/**
 * A SCENE WITH A DATE PINS (LangHarness, 2026-11-05; creator-hooks proposal 3):
 * the calendar (the quick choices, the stepper across month ends, leap years
 * and year changes), the standing against the measured pace (no speed, on
 * track, behind, passed), the store round trip of a date and its line, records
 * written before dates existed, and the server flow. No real model is called:
 * a scripted engine answers the mapping.
 *
 * Runs under an isolated LH_DATA_DIR (E6); the real profile is refused.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";
import { createElement } from "react";
import { createFauxCore, fauxAssistantMessage } from "@earendil-works/pi-ai";
import { renderToStaticMarkup } from "react-dom/server";

const REAL_PROFILE_DATA = path.resolve("C:/Users/Stream/Projects/langharness/data").toLowerCase();
const OWN_DIR = process.env.LH_DATA_DIR ? undefined : fs.mkdtempSync(path.join(os.tmpdir(), "lh-dated-"));
if (OWN_DIR) process.env.LH_DATA_DIR = OWN_DIR;
if (path.resolve(process.env.LH_DATA_DIR!).toLowerCase().startsWith(REAL_PROFILE_DATA)) throw new Error("Tests never run on the real data folder (E6).");
process.env.LH_PROFILE = "slovak";

const dated = await import("../src/core/dated-scene.ts");
const core = await import("../src/core/milestones.ts");
const datedServer = await import("../src/server/dated-scene.ts");
const server = await import("../src/server/milestones.ts");
const { milestoneStore } = await import("../src/store/milestones.ts");
const { DatedSceneCard } = await import("../components/dated-scene-card.tsx");
const { DatePicker } = await import("../components/milestones/date-picker.tsx");

after(() => {
	if (OWN_DIR) fs.rmSync(OWN_DIR, { recursive: true, force: true });
});

type Facts = import("../src/core/milestones.ts").LearnerFacts;

const MAPPING_JSON = '{"title":"Lunch with friends","line":"Most of a lunch conversation.","genre":"conversation","coverage":0.95,"wpm":150,"support":"interactive","icon":"users"}';
const mapOf = (text: string) => core.parseCustomMapping(MAPPING_JSON, text);
/** A scripted engine whose every answer is the mapping above. */
function scriptedEngine() {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(Array.from({ length: 4 }, () => fauxAssistantMessage(MAPPING_JSON)));
	return { model: faux.getModel(), streamFn: faux.streamSimple } as never;
}

const TODAY = "2026-11-05";
const NOW = new Date("2026-11-05T12:00:00Z");
const ahead = (n: number) => dated.isoAddDays(TODAY, n);
const ICONS = ["monitor-play", "video", "headphones", "newspaper", "coffee", "users", "captions", "clapperboard", "radio", "book-open", "message-circle", "briefcase", "music", "phone", "mail", "landmark", "tv", "mic", "sparkles", "baby", "gamepad-2", "map"];

const est = (daysPace: number | null, need = 105, basis: "listen" | "watch" | "both" | "level" = "listen") => ({ eta: { daysPace }, speed: { need, basis } });
const scene = (date: string, outcome?: { at: string; text: string }) => ({ id: "custom-test", title: "Lunch with friends", date, ...(outcome ? { outcome } : {}) });

const facts = (basis: "listen" | "level", paceDays: number): Facts => ({
	level: "B1",
	levelProgress: 0.5,
	placed: true,
	words: { basis: "level", credited: 3000 },
	met: 900,
	solid: 300,
	assumed: 2000,
	vocabulary: 4000,
	wordsPerDayPlanned: 8,
	wordsPerDayReal: 6,
	minutesPerDay: 30,
	daysPerWeek: 5,
	paceMinutes: 60,
	paceDays,
	hoursDone: 50,
	hoursLogged: 50,
	listen: { sessions: 3, reading: basis === "listen" ? { wpm: 60, samples: 8, words: 80, realtime: 0.5, audioWpm: 140 } : null, trend: null, knownSentences: { total: 0, right: 0 } },
	watch: null,
	speed: { wpm: 60, basis },
});

describe("the calendar", () => {
	test("the quick choices count from today and clamp to the month", () => {
		assert.equal(dated.dateForChoice("2w", "2026-12-25"), "2027-01-08", "two weeks across a year end");
		assert.equal(dated.dateForChoice("1m", "2027-01-31"), "2027-02-28", "a month from 31 January ends on the 28th");
		assert.equal(dated.dateForChoice("1m", "2028-01-31"), "2028-02-29", "the same in a leap year ends on the 29th");
		assert.equal(dated.dateForChoice("2m", "2026-11-30"), "2027-01-30", "two months across a year end");
		assert.equal(dated.dateForChoice("3m", "2026-11-30"), "2027-02-28", "three months from 30 November");
		assert.equal(dated.dateForChoice("6m", "2026-08-31"), "2027-02-28", "six months from 31 August");
		assert.equal(dated.dateForChoice("6m", "2026-09-10"), "2027-03-10", "six months across the year end");
	});

	test("the month stepper keeps the day, clamps at month ends and moves across years", () => {
		assert.equal(dated.isoAddMonths("2026-12-31", 1), "2027-01-31");
		assert.equal(dated.isoAddMonths("2027-01-31", 1), "2027-02-28");
		assert.equal(dated.isoAddMonths("2028-01-31", 1), "2028-02-29");
		assert.equal(dated.isoAddMonths("2028-02-29", -1), "2028-01-29", "back from the leap day keeps the 29th");
		assert.equal(dated.isoAddMonths("2027-03-31", -1), "2027-02-28");
		assert.equal(dated.isoAddMonths("2026-01-31", -2), "2025-11-30", "two months back across a year");
		assert.equal(dated.isoAddMonths("2026-11-15", 3), "2027-02-15");
	});

	test("the year stepper keeps the month and clamps 29 February", () => {
		assert.equal(dated.isoAddYears("2028-02-29", 1), "2029-02-28");
		assert.equal(dated.isoAddYears("2028-02-29", 4), "2032-02-29");
		assert.equal(dated.isoAddYears("2027-02-28", -1), "2026-02-28");
		assert.equal(dated.isoAddYears("2028-02-29", -1), "2027-02-28");
	});

	test("days between dates cross year ends and leap days", () => {
		assert.equal(dated.isoDaysBetween("2027-12-31", "2028-01-01"), 1);
		assert.equal(dated.isoDaysBetween("2028-02-28", "2028-03-01"), 2, "2028 has a 29 February");
		assert.equal(dated.isoDaysBetween("2027-02-28", "2027-03-01"), 1);
		assert.equal(dated.isoDaysBetween("2026-12-01", "2026-11-30"), -1);
		assert.equal(dated.isoAddDays("2026-12-25", 14), "2027-01-08");
	});

	test("only real calendar dates are dates", () => {
		for (const ok of ["2028-02-29", "2026-11-05", "2027-12-31"]) assert.ok(dated.isIsoDate(ok), ok);
		for (const bad of ["2027-02-29", "2026-13-01", "2026-04-31", "2026-1-01", "05/11/2026", "", 20261105]) assert.ok(!dated.isIsoDate(bad), String(bad));
	});

	test("a date is said in words, and the days left in words", () => {
		assert.equal(dated.dateInWords("2026-12-05"), "Saturday, December 5, 2026");
		assert.equal(dated.daysLeftWords(12), "12 days left");
		assert.equal(dated.daysLeftWords(1), "1 day left");
		assert.equal(dated.daysLeftWords(0), "today");
		assert.equal(dated.daysLeftWords(-1), "passed yesterday");
		assert.equal(dated.daysLeftWords(-3), "passed 3 days ago");
	});

	test("a scene's day is today or later, within ten years, and a real date", () => {
		assert.equal(dated.datedDateProblem(TODAY, TODAY), null, "today is allowed");
		assert.match(dated.datedDateProblem("2026-11-04", TODAY) ?? "", /today or a later/);
		assert.equal(dated.datedDateProblem("2036-11-05", TODAY), null, "ten years on is the last day allowed");
		assert.match(dated.datedDateProblem("2036-11-06", TODAY) ?? "", /within 10 years/);
		assert.match(dated.datedDateProblem("2027-02-30", TODAY) ?? "", /calendar/);
	});
});

describe("the standing against the measured pace", () => {
	test("no measured speed gives no date, and no speed is invented", () => {
		const v = dated.datedSceneView(scene(ahead(60)), est(40, 105, "level"), TODAY);
		assert.equal(v.status, "no-speed");
		assert.equal(v.reach, null);
		assert.equal(v.daysLater, null);
		assert.ok(!/Behind by|to spare|just in time/.test(v.line), v.line);
	});

	test("a scene that asks no speed is read on the pace alone", () => {
		assert.equal(dated.datedSceneView(scene(ahead(60)), est(40, 0, "level"), TODAY).status, "on-track");
	});

	test("no measured pace gives no date", () => {
		const v = dated.datedSceneView(scene(ahead(60)), est(null), TODAY);
		assert.equal(v.status, "no-pace");
		assert.equal(v.reach, null);
	});

	test("on track when the measured pace reaches the scene by its date, with the days to spare", () => {
		const v = dated.datedSceneView(scene(ahead(60)), est(40), TODAY);
		assert.equal(v.status, "on-track");
		assert.equal(v.reach, ahead(40));
		assert.equal(v.daysLater, null);
		assert.match(v.line, /20 days to spare/);
		assert.match(dated.datedSceneView(scene(ahead(60)), est(60), TODAY).line, /just in time/);
	});

	test("behind when the measured pace reaches the scene after its date, with the number of days", () => {
		const v = dated.datedSceneView(scene(ahead(60)), est(75), TODAY);
		assert.equal(v.status, "behind");
		assert.equal(v.daysLater, 15);
		assert.equal(v.reach, ahead(75));
		assert.match(v.line, /Behind by 15 days/);
		const one = dated.datedSceneView(scene(ahead(60)), est(61), TODAY);
		assert.equal(one.daysLater, 1);
		assert.match(one.line, /Behind by 1 day:/);
	});

	test("a scene dated today is on track once the estimate says it is reached", () => {
		const v = dated.datedSceneView(scene(TODAY), est(0), TODAY);
		assert.equal(v.status, "on-track");
		assert.equal(v.daysLeft, 0);
	});

	test("once the date has passed, the line is due until the learner writes one", () => {
		const due = dated.datedSceneView(scene(ahead(-3)), est(40), TODAY);
		assert.equal(due.status, "passed");
		assert.equal(due.daysLeft, -3);
		assert.equal(due.outcomeDue, true);
		const written = dated.datedSceneView(scene(ahead(-3), { at: NOW.toISOString(), text: "I said most of it" }), est(40), TODAY);
		assert.equal(written.outcomeDue, false);
		assert.equal(written.outcome?.text, "I said most of it");
	});

	test("the verdict from a real estimate: reached by the measured pace, or not", () => {
		const estimate = core.estimateMilestone(core.customMilestone("lunch with friends in the city", mapOf("lunch with friends in the city")), facts("listen", 14), { now: NOW });
		const reach = Math.round(estimate.eta.daysPace!);
		assert.ok(reach > 10, `the estimate needs more than ten days (${reach})`);
		assert.equal(dated.datedSceneView(scene(ahead(reach + 10)), estimate, TODAY).status, "on-track");
		const behind = dated.datedSceneView(scene(ahead(reach - 10)), estimate, TODAY);
		assert.equal(behind.status, "behind");
		assert.equal(behind.daysLater, 10);
		const noSpeed = core.estimateMilestone(core.customMilestone("lunch with friends in the city", mapOf("lunch with friends in the city")), facts("level", 14), { now: NOW });
		assert.equal(dated.datedSceneView(scene(ahead(reach + 10)), noSpeed, TODAY).status, "no-speed");
		const noPace = core.estimateMilestone(core.customMilestone("lunch with friends in the city", mapOf("lunch with friends in the city")), facts("listen", 3), { now: NOW });
		assert.equal(dated.datedSceneView(scene(ahead(reach + 10)), noPace, TODAY).status, "no-pace");
	});
});

describe("the store keeps the date and the line, and older records still read", () => {
	test("a record written before dates existed reads with no date and no line", () => {
		const text = "order coffee in a cafe";
		const mapping = core.parseCustomMapping('{"title":"Order coffee","line":"Short orders.","genre":"conversation","coverage":0.9,"wpm":100,"support":"interactive"}', text);
		const legacy = { def: core.customMilestone(text, mapping), text, mapping, model: "anthropic:old", usage: { model: "anthropic:old", steps: [] }, createdAt: NOW.toISOString() };
		milestoneStore.write({ custom: [legacy] });
		const back = milestoneStore.find(legacy.def.id);
		assert.equal(back?.date, undefined);
		assert.equal(back?.outcome, undefined);
		assert.equal(back?.def.title, "Order coffee");
		assert.deepEqual(datedServer.datedScenesForToday(NOW, 0), { next: null, awaitingOutcome: [] });
		const report = server.milestonesReport(NOW, 0);
		assert.ok(report.milestones.some((m) => m.def.id === legacy.def.id), "the older scene is still on the list");
		assert.equal(report.scenes[legacy.def.id], undefined, "and has no dated view");
		assert.equal(report.today, TODAY);
	});

	test("a date and a line round-trip through the file; moving the date drops the old line", () => {
		const text = "lunch with friends in the city";
		const mapping = mapOf(text);
		const id = core.customId(text);
		milestoneStore.upsert({ def: core.customMilestone(text, mapping), text, mapping, model: "test", usage: { model: "test", steps: [] }, createdAt: NOW.toISOString(), date: ahead(60) });
		assert.equal(milestoneStore.find(id)?.date, ahead(60));
		assert.equal(milestoneStore.recordOutcome(id, { at: "2027-01-01T00:00:00.000Z", text: "I said most of it" })?.outcome?.text, "I said most of it");
		assert.equal(milestoneStore.find(id)?.outcome?.text, "I said most of it", "read back from the file");
		assert.equal(milestoneStore.schedule(id, ahead(60))?.outcome?.text, "I said most of it", "the same day keeps the line");
		const moved = milestoneStore.schedule(id, ahead(90));
		assert.equal(moved?.date, ahead(90));
		assert.equal(moved?.outcome, undefined, "moving the day drops the line written for the old one");
		assert.equal(milestoneStore.schedule("custom-missing", ahead(5)), undefined);
		assert.equal(milestoneStore.remove(id, NOW), true);
	});
});

describe("the server flow: a scene on a day, Today's list, the line after the day", () => {
	let first: { id: string } = { id: "" };
	let soonest: { id: string } = { id: "" };

	test("a scene is added on a day with the mapping, and a bad day is refused before any mapping", async () => {
		await assert.rejects(datedServer.addDatedScene("lunch with friends in the city", ahead(-1), { now: NOW, tz: 0, engine: scriptedEngine() }), (err: unknown) => err instanceof datedServer.DatedSceneError && err.status === 400);
		await assert.rejects(datedServer.addDatedScene("lunch with friends in the city", "2027-02-30", { now: NOW, tz: 0, engine: scriptedEngine() }), /calendar/);
		const { record, reused } = await datedServer.addDatedScene("lunch with friends in the city in December, in the language", ahead(40), { now: NOW, tz: 0, engine: scriptedEngine() });
		assert.equal(reused, false);
		assert.ok(record.usage.steps.length > 0, "the model mapped the words");
		assert.equal(record.date, ahead(40));
		first = { id: record.def.id };
		const today = datedServer.datedScenesForToday(NOW, 0);
		assert.equal(today.next?.id, first.id);
		assert.equal(today.next?.daysLeft, 40);
		assert.equal(today.next?.status, "no-speed", "no speed is measured in an empty profile");
		assert.deepEqual(today.awaitingOutcome, []);
	});

	test("Today shows the nearest upcoming scene", async () => {
		const near = await datedServer.addDatedScene("a film with subtitles in the language", ahead(9), { now: NOW, tz: 0, engine: scriptedEngine() });
		soonest = { id: near.record.def.id };
		await datedServer.addDatedScene("a conversation with the in-laws in six months", ahead(180), { now: NOW, tz: 0, engine: scriptedEngine() });
		assert.equal(datedServer.datedScenesForToday(NOW, 0).next?.id, soonest.id);
	});

	test("the line after a date is written only once the date has passed, and is kept", () => {
		assert.throws(
			() => datedServer.recordSceneOutcome(first.id, "I said most of it", { now: NOW, tz: 0 }),
			(err: unknown) => err instanceof datedServer.DatedSceneError && err.status === 409,
		);
		const later = new Date(`${ahead(41)}T12:00:00Z`);
		const saved = datedServer.recordSceneOutcome(first.id, "   I said   most of it  ", { now: later, tz: 0 });
		assert.equal(saved.outcome?.text, "I said most of it");
		assert.equal(saved.outcome?.at, later.toISOString());
		const due = datedServer.datedScenesForToday(later, 0).awaitingOutcome.map((v) => v.id);
		assert.ok(due.includes(soonest.id), "a past scene with no line is due");
		assert.ok(!due.includes(first.id), "a scene with its line is not");
	});

	test("a date moved into the past, a missing scene and an empty line are refused", () => {
		assert.throws(() => datedServer.scheduleScene(first.id, ahead(-1), { now: NOW, tz: 0 }), /today or a later/);
		assert.throws(
			() => datedServer.scheduleScene("custom-missing", ahead(5), { now: NOW, tz: 0 }),
			(err: unknown) => err instanceof datedServer.DatedSceneError && err.status === 404,
		);
		assert.throws(
			() => datedServer.recordSceneOutcome(first.id, "   ", { now: new Date(`${ahead(41)}T12:00:00Z`), tz: 0 }),
			(err: unknown) => err instanceof datedServer.DatedSceneError && err.status === 400,
		);
	});

	test("the report carries each dated scene's standing for the page", () => {
		const report = server.milestonesReport(NOW, 0);
		const view = report.scenes[first.id];
		assert.equal(view?.status, "no-speed");
		assert.equal(view?.dateWords, dated.dateInWords(ahead(40)));
		assert.equal(report.today, TODAY);
	});
});

describe("the components render their states", () => {
	test("the Today card names the scene and its days, links to Speak, and to Milestones once the line is due", () => {
		const base = { title: "Lunch with friends", date: "2026-12-05", line: "Behind by 4 days: at your real pace you reach it on December 9, 2026." };
		const html = renderToStaticMarkup(createElement(DatedSceneCard, { scene: { ...base, daysLeft: 30, status: "behind", outcomeDue: false } }));
		assert.ok(html.includes("Lunch with friends"));
		assert.ok(html.includes("Saturday, December 5, 2026"));
		assert.ok(html.includes("30 days left"));
		assert.ok(html.includes('href="/speak"'));
		assert.ok(!html.includes('href="/milestones"'));
		const due = renderToStaticMarkup(createElement(DatedSceneCard, { scene: { ...base, daysLeft: -2, status: "passed", line: "The date has passed.", outcomeDue: true } }));
		assert.ok(due.includes("passed 2 days ago"));
		assert.ok(due.includes('href="/milestones"'));
	});

	test("the date picker offers the five quick choices and says the chosen date in words, with no native widget", () => {
		const html = renderToStaticMarkup(createElement(DatePicker, { value: "2026-12-05", today: TODAY, onChange: () => {} }));
		for (const label of ["2 weeks", "1 month", "2 months", "3 months", "6 months"]) assert.ok(html.includes(label), label);
		assert.ok(html.includes("Saturday, December 5, 2026 · 30 days left"));
		assert.ok(!html.includes('type="date"'), "no native date input");
		assert.ok(!html.includes("<select"), "no native select");
	});
});
