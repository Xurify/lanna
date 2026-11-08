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

const { createChatAgent, composeInstructions } = await import("../src/agent/teacher-agent.ts");
const { POST } = await import("../app/api/chats/route.ts");
const { writeSettings } = await import("../src/store/settings.ts");
const { chatStore } = await import("../src/store/chats.ts");
const { CHAT_THINKING_LEVEL, quickReplies, endsWithQuestion, REPLIES_TO_A_QUESTION, REPLIES_AFTER_AN_ANSWER } = await import("../src/core/index.ts");

const CHECKING_TOOLS = new Set(["lookup_word", "check_slovak", "slovak_reference", "add_to_review", "review_status"]);

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
	it("holds only the silent checks, and no learner-output tool even on a Claude model", () => {
		const agent = createChatAgent({ review: { enqueue: () => [], digest: () => "" } }, { engine: claudeEngine() });
		const names = agent.state.tools.map((tool) => tool.name);
		assert.ok(names.length > 0);
		for (const name of names) assert.ok(CHECKING_TOOLS.has(name), name);
		assert.ok(names.includes("add_to_review"));
		assert.equal(agent.state.systemPrompt, composeInstructions("chat"));
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
