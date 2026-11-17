import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { absorbed } from "../components/session-core.ts";
import { newUserMessage, type LannaMessage } from "../src/core/chat-messages.ts";
import { assistantMessage, model, userRecord } from "./helpers/session-wire.ts";

function ids(messages: readonly LannaMessage[]): unknown[] {
	return messages.map((entry) => (entry as { id?: string }).id);
}

describe("adopting the saved record during a turn", () => {
	it("a steer the server added lands between the record and the live reply", () => {
		const m = model({ initialMessages: [userRecord("u1", "topic")] });
		m.applyWireEvent({
			type: "message_start",
			message: { role: "assistant", content: [{ type: "text", text: "streaming" }] },
		});
		const steer = { ...newUserMessage("steered content"), id: "steer_1" } as LannaMessage;
		m.adoptRecord([userRecord("u1", "topic"), steer]);
		const order = ids(m.getState().nativeMessages);
		assert.deepEqual(order.slice(0, 2), ["u1", "steer_1"], "the steer shows now");
		assert.match(String(order[2] ?? ""), /^c_/, "the live reply stays last");
	});

	it("a rewritten record is not adopted; the next full sync takes over", () => {
		const m = model({ initialMessages: [userRecord("u1", "a"), userRecord("u2", "b")] });
		m.adoptRecord([userRecord("u2", "b")]);
		assert.deepEqual(ids(m.getState().nativeMessages), ["u1", "u2"]);
	});

	it("a local entry the record has taken over is absorbed, not shown twice", () => {
		const optimistic = { ...newUserMessage("my question"), id: "c_local_1" } as LannaMessage;
		const serverCopy = { ...newUserMessage("my question"), id: "srv_9" } as LannaMessage;
		assert.ok(absorbed(optimistic, [userRecord("u1", "topic"), serverCopy]), "the same content absorbs the local copy");
		assert.ok(!absorbed(serverCopy, [optimistic]), "a server id is never absorbed");
		assert.ok(
			!absorbed({ ...newUserMessage("my question") }, [serverCopy]),
			"a message without a local id is never absorbed",
		);

		const result = {
			id: "c_local_2",
			role: "toolResult",
			toolCallId: "call-1",
			toolName: "pose",
		} as unknown as LannaMessage;
		const serverResult = {
			id: "srv_10",
			role: "toolResult",
			toolCallId: "call-1",
			toolName: "pose",
		} as unknown as LannaMessage;
		assert.ok(absorbed(result, [serverResult]), "a tool result is absorbed by its toolCallId");
	});

	it("a full sync replaces the record and clears the live tail", () => {
		const m = model({ initialMessages: [userRecord("u1", "old")] });
		m.setMessages([userRecord("u1", "old"), userRecord("u2", "new"), assistantMessage("a1", "reply")]);
		assert.deepEqual(ids(m.getState().nativeMessages), ["u1", "u2", "a1"]);
	});
});
