/**
 * persistTurn (src/server/turn-service.ts): the canonical write of a turn's
 * native history. Empty message ids are stamped here, and the turn persists
 * only its own tail, so the record stays append-only.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { PATHS } from "../config.ts";
import { persistTurn } from "../src/server/turn-service.ts";
import { chatStore } from "../src/store/chats.ts";

const createdChats: string[] = [];

after(() => {
	for (const id of createdChats) {
		try {
			fs.unlinkSync(path.join(PATHS.chats, `${id}.json`));
		} catch {
			/* already gone */
		}
	}
});

describe("persistTurn (native history)", () => {
	it("stamps EMPTY ids (pi minted no id) at the canonical write and preserves existing ones", () => {
		const chat = chatStore.createChat("Test: persist stamps ids");
		createdChats.push(chat.id);
		const stamped = persistTurn(
			chatStore,
			chat.id,
			0,
			[
				{ id: "", role: "user", content: "wake turn", timestamp: 1 } as never,
				{
					id: "msg_kept",
					role: "assistant",
					content: [{ type: "text", text: "hi" }],
					api: "openai-completions",
					provider: "openrouter",
					model: "test",
					usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					stopReason: "stop",
					timestamp: 1,
				} as never,
			],
			false,
		);
		assert.notEqual(stamped[0]!.id, "", "empty id replaced");
		assert.match(stamped[0]!.id, /^msg_/);
		assert.equal(stamped[1]!.id, "msg_kept", "server-authored id untouched");
		const record = chatStore.getChat(chat.id)!;
		assert.equal(record.messages.length, 2, "both messages persisted");
		assert.ok(
			record.messages.every((m) => m.id && m.id.length > 0),
			"no empty ids survive persist",
		);
	});

	it("baseCount slices the turn's own messages (the agent's state is append-only across turns)", () => {
		const chat = chatStore.createChat("Test: persist slices the turn tail");
		createdChats.push(chat.id);
		chatStore.saveMessages(chat.id, [{ id: "base_1", role: "user", content: "first", timestamp: 1 } as never]);
		// The agent's state at onFinish: the base record + the turn's OWN new
		// messages, so the slice keeps persist append-only.
		const state = [
			{ id: "base_1", role: "user", content: "first", timestamp: 1 } as never,
			{
				id: "",
				role: "assistant",
				content: [{ type: "text", text: "wake turn" }],
				api: "openai-completions",
				provider: "openrouter",
				model: "test",
				usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				stopReason: "stop",
				timestamp: 1,
			} as never,
		];
		const stamped = persistTurn(chatStore, chat.id, 1, state, false);
		assert.equal(stamped.length, 1, "only the turn's new tail persists");
		const record = chatStore.getChat(chat.id)!;
		assert.equal(record.messages.length, 2, "the base record is untouched — append-only");
		assert.match(record.messages[1]!.id, /^msg_/);
	});
});
