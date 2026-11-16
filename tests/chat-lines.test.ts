import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerMark, learnerLines, messageText } from "../src/core/chat-lines.ts";

const you = (text: string) => ({ role: "user", parts: [{ type: "text", text }] });
const tutor = (...parts: Array<{ type: string; text?: string; input?: unknown }>) => ({ role: "assistant", parts });
const say = (text: string) => ({ type: "text", text });
const pose = { type: "tool-pose", input: { answer: "môj dom", focus: "masculine my" } };
const grade = (verdict: string, hinted = false) => ({
	type: "tool-grade",
	input: { verdict, hinted, given: "x", expected: "y", focus: "f" },
});

describe("the mark beside a graded answer", () => {
	it("says Right only for an unhinted right answer, as the first-try count does, in the words Review uses", () => {
		assert.deepEqual(answerMark({ verdict: "right", hinted: false }), { tone: "right", label: "Right" });
		assert.deepEqual(answerMark({ verdict: "right", hinted: true }), { tone: "near", label: "Right with help" });
		assert.deepEqual(answerMark({ verdict: "slip", hinted: false }), {
			tone: "near",
			label: "Almost, check the spelling",
		});
	});

	it("uses the words lessons and Review use for a miss, and names a skipped question", () => {
		assert.deepEqual(answerMark({ verdict: "wrong", hinted: true }), { tone: "miss", label: "Not quite" });
		assert.deepEqual(answerMark({ verdict: "dont_know", hinted: false }), { tone: "shown", label: "Skipped" });
	});
});

describe("the learner's lines on a chat page", () => {
	it("makes the first question the page's title", () => {
		const lines = learnerLines([you("Teach me possessives"), tutor(say('Say "my house".'), pose)]);
		assert.deepEqual(lines.get(0), { kind: "title" });
	});

	it("reads a line sent while a question is open as an answer, with the grade that follows it", () => {
		const lines = learnerLines([
			you("Teach me possessives"),
			tutor(say('Say "my house".'), pose),
			you("môj dom"),
			tutor(say("Correct."), grade("right"), pose),
		]);
		assert.deepEqual(lines.get(2), { kind: "answer", grade: { verdict: "right", hinted: false } });
	});

	it("keeps an answer ungraded until its grade arrives", () => {
		const lines = learnerLines([you("Teach me possessives"), tutor(say('Say "my house".'), pose), you("môj dom")]);
		assert.deepEqual(lines.get(2), { kind: "answer", grade: null });
	});

	it("gives a second try its own grade, since a wrong answer leaves the question open", () => {
		const lines = learnerLines([
			you("Q"),
			tutor(say("Ask."), pose),
			you("moja dom"),
			tutor(say("Not yet."), grade("wrong")),
			you("môj dom"),
			tutor(say("Correct."), grade("right", true)),
		]);
		assert.deepEqual(lines.get(2), { kind: "answer", grade: { verdict: "wrong", hinted: false } });
		assert.deepEqual(lines.get(4), { kind: "answer", grade: { verdict: "right", hinted: true } });
	});

	it("reads a tapped reply as a request, and never hands it the grade", () => {
		const lines = learnerLines([
			you("Q"),
			tutor(say("Ask."), pose),
			you("I don't know"),
			tutor(say("The answer is…"), grade("dont_know"), pose),
			you("Hint"),
		]);
		assert.deepEqual(lines.get(2), { kind: "request" });
		assert.deepEqual(lines.get(4), { kind: "request" });
	});

	it("reads a line as a new question when nothing is open, or when it ends in a question mark", () => {
		const lines = learnerLines([
			you("Q"),
			tutor(say("Ask."), pose),
			you("What does dom mean?"),
			tutor(say("House.")),
			you("môj dom"),
			tutor(say("Correct."), grade("right")),
			you("And the plural"),
		]);
		assert.deepEqual(lines.get(2), { kind: "ask" });
		assert.deepEqual(lines.get(4), { kind: "answer", grade: { verdict: "right", hinted: false } });
		assert.deepEqual(lines.get(6), { kind: "ask" });
	});

	it("skips a message with no typed text", () => {
		const lines = learnerLines([{ role: "user", parts: [{ type: "data-steer" }] }, you("Q")]);
		assert.equal(lines.has(0), false);
		assert.deepEqual(lines.get(1), { kind: "title" });
		assert.equal(messageText(you("a")), "a");
	});
});
