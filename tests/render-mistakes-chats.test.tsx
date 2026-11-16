import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MistakesPage } from "@/components/mistakes/mistakes-page";
import { analyzeChats, type ChatAnswer, type MistakesReport } from "@/src/core";

const now = new Date("2026-11-11T12:00:00Z");
const answers: ChatAnswer[] = [
	{
		at: "2026-11-10T10:00:00Z",
		chatId: "c1",
		verdict: "wrong",
		given: "tá kniha",
		expected: "táto kniha",
		focus: "feminine this",
		hinted: false,
		unit: "acc-fem",
	},
	{
		at: "2026-11-11T10:00:00Z",
		chatId: "c2",
		verdict: "dont_know",
		given: "",
		expected: "táto kniha",
		focus: "feminine this",
		hinted: false,
		unit: "acc-fem",
	},
	{
		at: "2026-11-11T10:05:00Z",
		chatId: "c2",
		verdict: "right",
		given: "chlieb",
		expected: "chlieb",
		focus: "word for bread",
		hinted: false,
	},
];

function report(chatAnswers: ChatAnswer[]): MistakesReport {
	const analysis = {
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
		chat: analyzeChats(chatAnswers, now),
	};
	return { analysis, guide: null, guideCurrent: false, ai: { ready: false, reason: "no-model" } };
}

describe("From your chats on the Mistakes page", () => {
	it("shows the units and topics missed in chats even with no lesson answers yet", () => {
		const html = renderToStaticMarkup(<MistakesPage initial={report(answers)} />);
		assert.ok(!html.includes('data-testid="mistakes-empty"'));
		assert.match(html, /data-testid="mistakes-chats"/);
		assert.match(html, /3 graded answers in 2 chats: 1 right with no hint, 2 missed/);
		assert.match(html, /Feminine accusative/);
		assert.match(html, /href="\/lesson\?unit=acc-fem"/);
		assert.match(html, /feminine this/);
		assert.match(html, /you gave up/);
		assert.match(html, /missed 2 of 2 · in 2 chats/);
	});

	it("leaves the section out when nothing was missed in chats", () => {
		const html = renderToStaticMarkup(<MistakesPage initial={report([answers[2]!])} />);
		assert.ok(!html.includes('data-testid="mistakes-chats"'));
	});
});
