import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { createFauxCore } from "@earendil-works/pi-ai";
import type { PiEngine } from "../src/agent/models.ts";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "lh-chat-kind-"));
const originalEnv = process.env;
const originalFetch = globalThis.fetch;
process.env = {
	...(originalEnv.NODE_TEST_CONTEXT ? { NODE_TEST_CONTEXT: originalEnv.NODE_TEST_CONTEXT } : {}),
	...(originalEnv.NODE_OPTIONS ? { NODE_OPTIONS: originalEnv.NODE_OPTIONS } : {}),
	NODE_ENV: "test",
	LH_DATA_DIR: path.join(scratch, "data"),
	LH_AUTH_FILE: path.join(scratch, "auth.json"),
	HOME: path.join(scratch, "home"),
};
globalThis.fetch = async () => {
	throw new Error("CLOSED: unexpected network request");
};
after(() => {
	process.env = originalEnv;
	globalThis.fetch = originalFetch;
	fs.rmSync(scratch, { recursive: true, force: true });
});

const { createChatAgent, composeInstructions, withLearnerNotes } = await import("../src/agent/teacher-agent.ts");
const { chatTools } = await import("../src/agent/tools/chat.ts");
const { appendChatAnswer, readChatAnswers } = await import("../src/store/chat-answers.ts");
const { POST } = await import("../app/api/chats/route.ts");
const { writeSettings } = await import("../src/store/settings.ts");
const { chatStore } = await import("../src/store/chats.ts");
const { CHAT_THINKING_LEVEL, chatScore, quickReplies, endsWithQuestion, REPLIES_TO_A_QUESTION, REPLIES_AFTER_AN_ANSWER } = await import("../src/core/index.ts");

const CHAT_TOOLS = new Set(["pose", "grade", "read", "ls", "find", "grep", "research", "pdf", "lookup_word", "check_slovak", "slovak_reference", "add_to_review", "review_status"]);

function claudeEngine(): PiEngine {
	const faux = createFauxCore({ provider: "anthropic", models: [{ id: "claude-haiku-5-5" }] });
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

describe("the chat agent's prompt", () => {
	const prompt = composeInstructions("chat");

	it("carries the chat doctrine, the drawing format, the voice and the accuracy rule", () => {
		assert.match(prompt, /^# The chat/);
		assert.ok(prompt.includes("# Drawings"));
		assert.ok(prompt.includes("## Voice"));
		assert.ok(prompt.includes("## Accuracy: non-negotiable"));
	});

	it("leaves out the document formatting, the lesson base and the question mechanics", () => {
		assert.ok(!prompt.includes("documents, not chat messages"));
		assert.ok(!prompt.includes("# The agent\n"));
		assert.ok(!prompt.includes("## The question tools"));
		assert.ok(!prompt.includes("plan_init"));
	});

	it("names the six drawing colors the page maps", () => {
		for (const token of ["--ink", "--graphite", "--faint", "--rule", "--mark", "--wash"]) assert.ok(prompt.includes(`var(${token})`), token);
	});
});

describe("the chat agent's tools", () => {
	it("holds the commit and grade pair, the checks, the learner's files and the jobs, and no learner-output tool even on a Claude model", () => {
		const agent = createChatAgent(
			{ review: { enqueue: () => [], digest: () => "" }, jobs: { chatId: "c", jobStore: {} as never, spawn: () => {}, searchAvailable: () => true } },
			{ engine: claudeEngine() },
		);
		const names = agent.state.tools.map((tool) => tool.name);
		for (const name of names) assert.ok(CHAT_TOOLS.has(name), name);
		for (const name of ["pose", "grade", "read", "pdf", "research", "add_to_review"]) assert.ok(names.includes(name), name);
		assert.ok(!names.includes("visual"), "drawings are written in the reply");
		assert.equal(agent.state.systemPrompt, composeInstructions("chat"));
	});

	it("grade records what the learner answered through the seam", async () => {
		const recorded: unknown[] = [];
		const tools = chatTools({ answers: { record: (a) => recorded.push(a) } });
		const result = await tools.grade!.execute("t1", { verdict: "slip", given: "tato zena", expected: "táto žena", focus: "feminine this" }, undefined as never, undefined as never);
		assert.match(JSON.stringify(result), /Recorded/);
		assert.deepEqual(recorded, [{ verdict: "slip", given: "tato zena", expected: "táto žena", focus: "feminine this", hinted: false }]);
	});

	it("keeps every answer in the data folder, one line each", () => {
		appendChatAnswer({ at: "2026-11-08T10:00:00Z", chatId: "c1", verdict: "wrong", given: "tá kniha", expected: "táto kniha", focus: "feminine this", hinted: false });
		appendChatAnswer({ at: "2026-11-08T10:01:00Z", chatId: "c1", verdict: "right", given: "táto kniha", expected: "táto kniha", focus: "feminine this", hinted: false });
		assert.deepEqual(readChatAnswers().map((a) => a.verdict), ["wrong", "right"]);
	});
});

describe("the model-only checker note", () => {
	it("is appended to the learner's text in the model's copy only", () => {
		const note = (text: string) => (text.includes("s sestra") ? "[Checker: s + sestra takes the instrumental: so sestrou]" : null);
		const messages = [
			{ role: "user" as const, content: "Idem s sestra", timestamp: 1 },
			{ role: "user" as const, content: [{ type: "text" as const, text: "Hint" }], timestamp: 2 },
		];
		const out = withLearnerNotes(messages as never, note);
		assert.equal((out[0] as { content: string }).content, "Idem s sestra\n\n[Checker: s + sestra takes the instrumental: so sestrou]");
		assert.deepEqual(out[1], messages[1]);
		assert.equal(messages[0]!.content, "Idem s sestra", "the record is untouched");
	});
});

describe("the chat's score", () => {
	const turn = (parts: Array<{ type: string; input?: unknown }>) => ({ role: "assistant", parts });
	it("counts the first grade after each pose, and names the missed focus once", () => {
		const score = chatScore([
			turn([{ type: "tool-pose", input: { focus: "feminine this" } }, { type: "text" }]),
			{ role: "user", parts: [] },
			turn([{ type: "tool-grade", input: { verdict: "wrong", focus: "feminine this" } }]),
			turn([{ type: "tool-grade", input: { verdict: "right", focus: "feminine this" } }]),
			turn([{ type: "tool-pose", input: { focus: "neuter this" } }]),
			turn([{ type: "tool-grade", input: { verdict: "slip", focus: "neuter this" } }]),
			turn([{ type: "tool-pose", input: { focus: "masculine this" } }]),
			turn([{ type: "tool-grade", input: { verdict: "right", focus: "masculine this", hinted: true } }]),
		]);
		assert.deepEqual(score, { asked: 3, firstTryRight: 1, misses: ["feminine this", "masculine this"] });
	});
});

describe("POST /api/chats with kind chat", () => {
	it("marks the record and stamps the strong slot's model at the chat's low thinking level", async () => {
		writeSettings({
			version: 1,
			models: {
				strong: { model: { provider: "anthropic", id: "claude-haiku-5-5" }, thinkingLevel: "high" },
				cheap: { model: { provider: "anthropic", id: "claude-sonnet-5-5" }, thinkingLevel: "medium" },
			},
		});
		const res = await POST(new Request("http://test/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "this and that", kind: "chat" }) }));
		const { id } = (await res.json()) as { id: string };
		const record = chatStore.getChat(id);
		assert.equal(record?.kind, "chat");
		assert.deepEqual(record?.settings, { model: { provider: "anthropic", id: "claude-haiku-5-5" }, thinkingLevel: CHAT_THINKING_LEVEL });
	});

	it("an unknown kind still makes the probed lesson", async () => {
		const res = await POST(new Request("http://test/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "x", kind: "other" }) }));
		const { id } = (await res.json()) as { id: string };
		assert.equal(chatStore.getChat(id)?.kind, undefined);
	});
});

describe("the replies under the tutor's message", () => {
	it("offers help with an open question, and next steps after an answer", () => {
		assert.deepEqual(quickReplies("Correct: táto kniha.\n\nYour turn: how do you say “this woman”?"), REPLIES_TO_A_QUESTION);
		assert.deepEqual(quickReplies("Correct: táto žena = “this woman.” You have all three forms now."), REPLIES_AFTER_AN_ANSWER);
		assert.deepEqual(quickReplies(""), []);
	});

	it("reads the question from the prose, not from a drawing after it", () => {
		assert.equal(endsWithQuestion("Which one is near?\n\n```svg\n<svg viewBox=\"0 0 1 1\"><text>far?</text></svg>\n```"), true);
		assert.equal(endsWithQuestion("Is it near? Yes.\n\nThe ending is -a."), false);
		assert.equal(endsWithQuestion("How do you say “that book”?”"), true);
	});
});

describe("a reply written twice around a tool call", () => {
	it("shows the second identical text block once", async () => {
		const { repeatsEarlierText } = await import("../src/core/index.ts");
		const parts = [{ type: "text", text: "Not yet. Try again." }, { type: "tool-check_slovak" }, { type: "text", text: "Not yet. Try again.\n" }, { type: "text", text: "Something new." }];
		assert.deepEqual(parts.map((_, i) => repeatsEarlierText(parts, i)), [false, false, true, false]);
	});
});

describe("an open question", () => {
	it("is a pose with no grade after it, whatever the punctuation", async () => {
		const { questionOpen, quickReplies, REPLIES_TO_A_QUESTION } = await import("../src/core/index.ts");
		const asked = [{ role: "assistant", parts: [{ type: "tool-pose" }, { type: "text" }] }];
		assert.equal(questionOpen(asked), true);
		assert.equal(questionOpen([...asked, { role: "user", parts: [] }, { role: "assistant", parts: [{ type: "tool-grade", input: { verdict: "right" } }] }]), false);
		assert.equal(questionOpen([...asked, { role: "assistant", parts: [{ type: "tool-grade", input: { verdict: "wrong" } }] }]), true, "a miss leaves the question open for a second try");
		assert.deepEqual(quickReplies("Fill the gap: ___ knihu.", true), REPLIES_TO_A_QUESTION);
	});
});
