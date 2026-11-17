import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import type { LannaMessage } from "../src/core/chat-messages.ts";
import { needsContinuation } from "../src/core/chat-messages.ts";
import { toLlmMessages } from "../src/core/model-context.ts";
import { projectView } from "../src/core/view.ts";

const chatsDir = path.join(import.meta.dirname, "fixtures", "golden-data", "chats");

function goldenChats(): { file: string; kind: "chat" | "practice"; messages: LannaMessage[] }[] {
	return fs.readdirSync(chatsDir).map((file) => {
		const record = JSON.parse(fs.readFileSync(path.join(chatsDir, file), "utf8")) as {
			kind?: string;
			messages: LannaMessage[];
		};
		return { file, kind: record.kind === "practice" ? "practice" : "chat", messages: record.messages };
	});
}

describe("older chats still open after the question machinery is gone", () => {
	for (const chat of goldenChats()) {
		it(`${chat.file} reaches the model as plain user, assistant and tool messages`, () => {
			const llm = toLlmMessages(chat.messages);
			assert.ok(llm.length > 0);
			for (const message of llm) assert.ok(["user", "assistant", "toolResult"].includes(message.role));
			const answered = new Set(llm.filter((m) => m.role === "toolResult").map((m) => m.toolCallId));
			for (const message of llm) {
				if (message.role !== "assistant") continue;
				for (const block of message.content) if (block.type === "toolCall") assert.ok(answered.has(block.id));
			}
		});

		it(`${chat.file} renders and settles without a continuation`, () => {
			assert.ok(projectView(chat.messages).length > 0);
			assert.equal(typeof needsContinuation(chat.messages, chat.kind), "boolean");
		});
	}

	it("a plan block from a taught lesson never reaches the model", () => {
		const teach = goldenChats().find((chat) =>
			chat.messages.some((m) => m.role === "custom" && m.customType === "plan-block"),
		);
		assert.ok(teach);
		assert.ok(teach.messages.some((m) => m.role === "custom" && m.customType === "plan-block" && m.content === ""));
		const emptyUserTurns = toLlmMessages(teach.messages).filter(
			(m) =>
				m.role === "user" && Array.isArray(m.content) && m.content.every((c) => c.type === "text" && c.text === ""),
		);
		assert.equal(emptyUserTurns.length, 0);
	});
});
