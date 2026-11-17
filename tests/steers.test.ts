/**
 * The learner's own mid-turn messages (src/server/steers.ts): a steer goes to
 * the live agent when a turn runs, is kept until the saved record holds it,
 * and rides the chat's next run when a turn could not take it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	discardChatSteers,
	registerLiveAgent,
	reconcileUserSteers,
	steerLiveChat,
	unregisterLiveAgent,
} from "../src/server/steers.ts";
import { chatStore } from "../src/store/chats.ts";

/** A minimal stand-in for pi's Agent: only steer() is touched. */
function fakeAgent(): { handed: unknown[]; agent: unknown } {
	const handed: unknown[] = [];
	return { handed, agent: { steer: (m: unknown) => handed.push(m) } };
}

describe("steers (src/server/steers.ts)", () => {
	it("no live turn → false, nothing parked (the client falls back to a plain send)", () => {
		const chatId = chatStore.createChat("steer: idle").id;
		const msg = { id: "steer_x1", role: "user", content: "hold on", timestamp: 1 };
		assert.equal(steerLiveChat(chatId, msg as never), false);
		const { handed, agent } = fakeAgent();
		registerLiveAgent(chatId, agent as never);
		assert.equal(handed.length, 0, "nothing was parked by the refused steer");
		unregisterLiveAgent(chatId);
	});

	it("live agent → steered AND parked (the stranding safety net)", () => {
		const chatId = chatStore.createChat("steer: live").id;
		const msg = { id: "steer_x2", role: "user", content: "also cover Venus", timestamp: 1 };
		const { handed, agent } = fakeAgent();
		registerLiveAgent(chatId, agent as never);
		assert.equal(steerLiveChat(chatId, msg as never), true);
		assert.equal(handed.length, 1, "handed to the live agent's steering queue");
		// Re-registering the SAME agent never re-hands (double-handoff guard).
		registerLiveAgent(chatId, agent as never);
		assert.equal(handed.length, 1);
		unregisterLiveAgent(chatId);
		reconcileUserSteers(chatId, [msg] as never);
	});

	it("settlement reconciliation: delivered ids drop, stranded ones ride the NEXT run", () => {
		const chatId = chatStore.createChat("steer: reconcile").id;
		const delivered = { id: "steer_d1", role: "user", content: "delivered", timestamp: 1 };
		const stranded = { id: "steer_s1", role: "user", content: "stranded behind a question", timestamp: 2 };
		const { agent } = fakeAgent();
		registerLiveAgent(chatId, agent as never);
		assert.equal(steerLiveChat(chatId, delivered as never), true);
		assert.equal(steerLiveChat(chatId, stranded as never), true);

		// Settlement: the run persisted ONLY the delivered one (the stranded
		// copy died with the agent — question termination / abort).
		unregisterLiveAgent(chatId);
		reconcileUserSteers(chatId, [delivered] as never);

		// The chat's next run (the answer turn) picks up the stranded steer.
		const next = fakeAgent();
		registerLiveAgent(chatId, next.agent as never);
		assert.equal(next.handed.length, 1, "exactly the stranded steer rides the next run");
		assert.equal((next.handed[0] as { id: string }).id, "steer_s1");
		unregisterLiveAgent(chatId);
		reconcileUserSteers(chatId, [stranded, delivered] as never);
	});

	it("a deleted chat keeps no parked steers and no live agent", () => {
		const chatId = chatStore.createChat("steer: deleted").id;
		const msg = { id: "steer_x3", role: "user", content: "after the delete", timestamp: 1 };
		const { agent } = fakeAgent();
		registerLiveAgent(chatId, agent as never);
		assert.equal(steerLiveChat(chatId, msg as never), true);
		discardChatSteers(chatId);
		assert.equal(steerLiveChat(chatId, msg as never), false, "no live agent after the discard");
		const next = fakeAgent();
		registerLiveAgent(chatId, next.agent as never);
		assert.equal(next.handed.length, 0, "the discarded steer never rides a later run");
		unregisterLiveAgent(chatId);
	});
});
