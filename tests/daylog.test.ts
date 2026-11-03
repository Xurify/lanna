import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDayLog, dayLogIsEmpty, localDay, localTime, type DayLogCard, type DayLogLesson, type DayLogReview } from "../src/core/daylog.ts";

const rep = (answer: string, given: string, verdict: "exact" | "wrong") => ({ unit: "acc-people", lemma: answer, gloss: "g", sentence: `Vidím ${answer}.`, answer, given, verdict, first: { given, verdict } });
const lesson = (over: Partial<DayLogLesson> = {}): DayLogLesson => ({ at: "2026-11-02T07:31:00.000Z", day: "2026-11-02", unit: "present", mode: "lesson", ms: 180_000, correct: 10, total: 12, reps: [], ...over });
const review = (at: string, verdict: string, given = "x", cardId = "c1"): DayLogReview => ({ cardId, given, verdict, reviewedAt: at, ms: 20_000 });
const card = (over: Partial<DayLogCard> = {}): DayLogCard => ({ id: "c1", lemma: "ľudia", gloss: "people", sentence: "Na námestí je veľa ľudí.", answer: "ľudí", createdAt: "2026-11-01T10:00:00.000Z", ...over });
const input = (over: Partial<Parameters<typeof buildDayLog>[1]> = {}) => ({ lessons: [], reviews: [], cards: [], tz: 0, ...over });

describe("the log of a day", () => {
	it("localTime and localDay apply the browser's offset (minutes west of UTC)", () => {
		assert.equal(localTime("2026-11-02T12:31:00.000Z", 300), "07:31");
		assert.equal(localDay("2026-11-02T01:00:00.000Z", 300), "2026-11-01");
	});

	it("a lesson is an entry with its time, what happened and the minutes", () => {
		const log = buildDayLog("2026-11-02", input({ lessons: [lesson()] }));
		assert.equal(log.entries.length, 1);
		assert.equal(log.entries[0]!.time, "07:31");
		assert.equal(log.entries[0]!.title, "Grammar: I, you, we");
		assert.equal(log.entries[0]!.line, "10 of 12 right, 3 min");
	});

	it("a grammar lesson writes its rule once; a words lesson writes none; another day and the placement drill stay off", () => {
		const log = buildDayLog("2026-11-02", input({ lessons: [lesson(), lesson({ at: "2026-11-02T08:00:00.000Z" }), lesson({ unit: "words", at: "2026-11-02T07:40:00.000Z" }), lesson({ day: "2026-11-01" }), lesson({ unit: "placement", mode: "placement" })] }));
		assert.deepEqual(log.rules.map((r) => r.unit), ["present"]);
		assert.equal(log.entries.length, 3);
		assert.deepEqual(log.entries.map((e) => e.time), ["07:31", "07:40", "08:00"]);
	});

	it("review answers are grouped into sittings 20 minutes apart", () => {
		const reviews = [review("2026-11-02T09:00:00.000Z", "exact"), review("2026-11-02T09:02:00.000Z", "wrong", "zzz"), review("2026-11-02T09:03:00.000Z", "exact"), review("2026-11-02T18:00:00.000Z", "exact"), review("2026-11-01T18:00:00.000Z", "exact")];
		const log = buildDayLog("2026-11-02", input({ reviews, cards: [card()] }));
		const sittings = log.entries.filter((e) => e.kind === "review");
		assert.equal(sittings.length, 2);
		assert.equal(sittings[0]!.line, "3 answers, 2 right, 1 min");
		assert.equal(sittings[1]!.line, "1 answer, 1 right, under a minute");
	});

	it("only a wrong first try with a different answer is a mistake, from a lesson or from Review", () => {
		const lessons = [lesson({ unit: "acc-people", reps: [rep("brata", "brat", "wrong"), rep("psa", "", "wrong"), rep("lekára", "lekára", "exact")] })];
		const reviews = [review("2026-11-02T09:00:00.000Z", "wrong", "ludi"), review("2026-11-02T09:01:00.000Z", "wrong", "")];
		const log = buildDayLog("2026-11-02", input({ lessons, reviews, cards: [card()] }));
		assert.deepEqual(log.mistakes.map((m) => `${m.given}>${m.answer}`), ["brat>brata", "ludi>ľudí"]);
	});

	it("words added to Review are the cards minted that day, once each, in order", () => {
		const cards = [card({ id: "a", lemma: "dom", createdAt: "2026-11-02T06:00:00.000Z" }), card({ id: "b", lemma: "pes", createdAt: "2026-11-02T05:00:00.000Z" }), card({ id: "c", lemma: "mačka", createdAt: "2026-11-01T05:00:00.000Z" })];
		const log = buildDayLog("2026-11-02", input({ cards }));
		assert.deepEqual(log.words.map((w) => w.lemma), ["pes", "dom"]);
	});

	it("minutes by strand come from the day's measured minutes, and the counts without a time are listed as 'also'", () => {
		const log = buildDayLog("2026-11-02", input({ record: { minutesBy: { listen: 4, read: 5, watch: 6, lesson: 3, review: 2 }, reads: 1, watches: 2 } }));
		assert.equal(log.strands.minutes.input, 15);
		assert.equal(log.strands.minutes.form, 5);
		assert.equal(Math.round(log.strands.total), 20);
		assert.deepEqual(log.also, ["1 episode read", "2 videos watched"]);
	});

	it("a day with no records is empty, and says so honestly", () => {
		const log = buildDayLog("2026-11-02", input());
		assert.ok(dayLogIsEmpty(log));
		assert.equal(log.entries.length + log.words.length + log.mistakes.length + log.rules.length, 0);
	});
});
