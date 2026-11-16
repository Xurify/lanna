import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lh-chat-evidence-"));
const originalEnv = process.env;
process.env = {
	...(originalEnv.NODE_TEST_CONTEXT ? { NODE_TEST_CONTEXT: originalEnv.NODE_TEST_CONTEXT } : {}),
	...(originalEnv.NODE_OPTIONS ? { NODE_OPTIONS: originalEnv.NODE_OPTIONS } : {}),
	NODE_ENV: "test",
	LH_DATA_DIR: path.join(scratch, "data"),
	LH_AUTH_FILE: path.join(scratch, "auth.json"),
	HOME: path.join(scratch, "home"),
};
after(() => {
	process.env = originalEnv;
	fs.rmSync(scratch, { recursive: true, force: true });
});

const { analyzeChats, chatMissesOnUnit, guideFacts, guideReadiness, weakSpotList, noteChatAnswer } =
	await import("../src/core/index.ts");
const { recordChatAnswer } = await import("../src/server/chat-evidence.ts");
const { readChatAnswers } = await import("../src/store/chat-answers.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { analysisStore } = await import("../src/store/analysis.ts");
const { analyzeNow, mistakesReport } = await import("../src/server/mistakes-snapshot.ts");
const { chatTools } = await import("../src/agent/tools/chat.ts");

type Answer = Parameters<typeof noteChatAnswer>[1];

const now = new Date("2026-11-11T12:00:00Z");
const day = (daysAgo: number, minute = 0) =>
	new Date(now.getTime() - daysAgo * 86_400_000 + minute * 60_000).toISOString();

function answer(over: Partial<Answer>): Answer {
	return {
		at: day(0),
		chatId: "c1",
		verdict: "wrong",
		given: "tá kniha",
		expected: "táto kniha",
		focus: "feminine this",
		hinted: false,
		...over,
	};
}

describe("what the chat answers say", () => {
	const answers: Answer[] = [
		answer({ at: day(1), unit: "acc-fem" }),
		answer({ at: day(1, 1), verdict: "right", given: "táto kniha", unit: "acc-fem" }),
		answer({ at: day(0), chatId: "c2", verdict: "dont_know", given: "", unit: "acc-fem" }),
		answer({ at: day(0, 1), chatId: "c2", verdict: "right", hinted: true, given: "táto kniha", unit: "acc-fem" }),
		answer({
			at: day(2),
			chatId: "c3",
			verdict: "wrong",
			focus: "word for bread",
			expected: "chlieb",
			given: "chleba",
		}),
		answer({
			at: day(2, 1),
			chatId: "c3",
			verdict: "slip",
			focus: "word for bread",
			expected: "chlieb",
			given: "chlieb",
		}),
	];

	it("counts a right answer with no hint as right, a hinted one as help, and wrong or given up as missed", () => {
		const a = analyzeChats(answers, now);
		assert.equal(a.answers, 6);
		assert.equal(a.firstTryRight, 2);
		assert.equal(a.misses, 3);
		assert.equal(a.hinted, 1);
		assert.equal(a.chats, 3);
		assert.equal(a.from, day(2).slice(0, 10));
	});

	it("reads units from the answers that name one, and topics from every focus", () => {
		const a = analyzeChats(answers, now);
		assert.deepEqual(
			a.units.map((u) => [u.unit, u.misses, u.answers, u.right]),
			[["acc-fem", 2, 4, 1]],
		);
		assert.deepEqual(
			a.topics.map((t) => [t.focus, t.misses, t.chats]),
			[
				["feminine this", 2, 2],
				["word for bread", 1, 1],
			],
		);
		assert.equal(a.topics[0]!.lastGiven, "", "the last miss was giving up");
		assert.equal(a.topics[1]!.unit, undefined, "vocabulary names no unit");
	});

	it("pairs what was written with what was wanted at the same miss, not at a later right answer", () => {
		const a = analyzeChats(
			[
				answer({
					at: day(2),
					focus: "locative after v",
					given: "bývam v Bratislava",
					expected: "bývam v Bratislave",
					unit: "loc",
				}),
				answer({
					at: day(1),
					focus: "locative after v",
					verdict: "right",
					given: "pracujem v škole",
					expected: "pracujem v škole",
					unit: "loc",
				}),
			],
			now,
		);
		assert.deepEqual([a.topics[0]!.lastGiven, a.topics[0]!.lastExpected], ["bývam v Bratislava", "bývam v Bratislave"]);
	});

	it("lists the latest misses first, with what was written and what was wanted", () => {
		const a = analyzeChats(answers, now);
		assert.deepEqual(
			a.samples.map((s) => [s.verdict, s.given, s.expected]),
			[
				["dont_know", "", "táto kniha"],
				["wrong", "tá kniha", "táto kniha"],
				["wrong", "chleba", "chlieb"],
			],
		);
	});

	it("counts misses on a unit only inside the window", () => {
		const old = [
			answer({ at: day(30), unit: "acc-fem" }),
			answer({ at: day(20), unit: "acc-fem" }),
			answer({ at: day(1), unit: "gen" }),
		];
		assert.equal(chatMissesOnUnit(old, "acc-fem", now), 1);
		assert.equal(chatMissesOnUnit(old, "gen", now), 1);
	});

	it("gives the guide the chat evidence and counts it toward having enough", () => {
		const facts = guideFacts({ ...analyzeNowShape(), chat: analyzeChats(answers, now) });
		assert.match(facts, /In chats with the tutor: 6 graded answers, 2 right with no hint, 3 wrong or given up/);
		assert.match(facts, /In chats, unit Feminine accusative \[acc-fem\]: 2 wrong of 4/);
		assert.match(facts, /In chats, missed 1× on "word for bread" \(last wrote "chleba", wanted "chlieb"\)/);
		assert.deepEqual(
			guideReadiness({ reps: 28, wrong: 4, chat: { ...analyzeChats(answers, now), answers: 6, misses: 3 } }).ready,
			true,
		);
		assert.deepEqual(guideReadiness({ reps: 28, wrong: 4 }).ready, false);
	});
});

function analyzeNowShape() {
	return {
		at: now.toISOString(),
		reps: 0,
		wrong: 0,
		from: null,
		to: null,
		units: [],
		slips: {},
		words: [],
		weeks: [],
		mixups: [],
	};
}

describe("a chat miss becomes a weak spot on the plan", () => {
	it("waits for a second miss on the same unit, then flags it with the evidence", () => {
		const first = answer({ unit: "acc-fem" });
		assert.deepEqual(noteChatAnswer({}, first, 1, now), {}, "one wrong answer in a chat is a slip");
		const flagged = noteChatAnswer({}, first, 2, now);
		const spot = flagged["acc-fem"]!;
		assert.equal(spot.source, "chat");
		assert.equal(spot.note, "wrote “tá kniha” for “táto kniha” in a chat");
		assert.equal(weakSpotList(flagged)[0]!.line, "from your chats: wrote “tá kniha” for “táto kniha” in a chat");
	});

	it("says so when the learner gave up", () => {
		const flagged = noteChatAnswer({}, answer({ verdict: "dont_know", given: "", unit: "gen" }), 2, now);
		assert.equal(flagged.gen!.note, "did not know “táto kniha” in a chat");
	});

	it("ignores an answer with no unit, or one the course does not have", () => {
		assert.deepEqual(noteChatAnswer({}, answer({}), 5, now), {});
		assert.deepEqual(noteChatAnswer({}, answer({ unit: "nope" }), 5, now), {});
	});

	it("tallies right answers against a spot on record, skips a hinted one, and mends it after enough", () => {
		let weak = noteChatAnswer({}, answer({ unit: "acc-fem" }), 2, now);
		weak = noteChatAnswer(weak, answer({ verdict: "right", hinted: true, unit: "acc-fem" }), 0, now);
		assert.equal(weak["acc-fem"]!.hits + weak["acc-fem"]!.misses, 0, "help taken is neither");
		for (let i = 0; i < 8; i++) weak = noteChatAnswer(weak, answer({ verdict: "right", unit: "acc-fem" }), 0, now);
		assert.equal(weak["acc-fem"], undefined, "eight right since the flag mends it");
	});

	it("puts a chat spot after the level check and before lessons", () => {
		const weak = {
			gen: { since: day(5), source: "lesson" as const, hits: 0, misses: 0, lastAt: day(5) },
			ins: { since: day(4), source: "chat" as const, hits: 0, misses: 0, lastAt: day(4) },
			dat: { since: day(3), source: "check" as const, hits: 0, misses: 0, lastAt: day(3) },
		};
		assert.deepEqual(
			weakSpotList(weak).map((w) => w.unit),
			["dat", "ins", "gen"],
		);
	});
});

describe("recording a graded answer", () => {
	it("keeps the answer, flags the unit on its second miss, and puts the chats into the saved analysis", () => {
		analyzeNow(now);
		recordChatAnswer(answer({ at: day(0, 5), unit: "acc-fem" }), now);
		assert.equal(progressStore.read().weak?.["acc-fem"], undefined);
		recordChatAnswer(answer({ at: day(0, 6), unit: "acc-fem", given: "tej knihu" }), now);
		const spot = progressStore.read().weak?.["acc-fem"];
		assert.equal(spot?.source, "chat");
		assert.equal(spot?.note, "wrote “tej knihu” for “táto kniha” in a chat");
		assert.equal(readChatAnswers().length, 2);
		assert.equal(analysisStore.read().analysis?.chat?.misses, 2);
		assert.equal(mistakesReport(now).analysis.chat?.units[0]?.unit, "acc-fem");
	});

	it("records an answer that names no unit without touching the weak spots", () => {
		const before = JSON.stringify(progressStore.read().weak);
		recordChatAnswer(answer({ at: day(0, 7), focus: "word for bread", expected: "chlieb", given: "chleba" }), now);
		assert.equal(JSON.stringify(progressStore.read().weak), before);
		assert.equal(readChatAnswers().length, 3);
	});

	it("the grade tool passes a real unit id through and drops an unknown one", async () => {
		const recorded: Array<{ unit?: string }> = [];
		const tools = chatTools({ answers: { record: (a) => recorded.push(a) } });
		const base = { verdict: "wrong", given: "x", expected: "y", focus: "z" };
		await tools.grade!.execute("t1", { ...base, unit: "acc-fem" }, undefined as never, undefined as never);
		await tools.grade!.execute("t2", { ...base, unit: "not-a-unit" }, undefined as never, undefined as never);
		await tools.grade!.execute("t3", base, undefined as never, undefined as never);
		assert.deepEqual(
			recorded.map((r) => r.unit),
			["acc-fem", undefined, undefined],
		);
		assert.match(String(tools.grade!.parameters.properties.unit.description), /acc-fem: Objects: -a → -u/);
	});
});
