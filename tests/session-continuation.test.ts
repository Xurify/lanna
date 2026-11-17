import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { needsContinuation, type LannaMessage } from "../src/core/chat-messages.ts";
import {
	assistantMessage,
	assistantWithCall,
	model,
	resultMessage,
	sseResponse,
	turnFetch,
	userRecord,
} from "./helpers/session-wire.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("automatic continuation", () => {
	const answered = [assistantWithCall("dispatch", "r1", "research"), resultMessage("r1", "research")];

	it("a retained failure blocks automatic continuation even after its banner is dismissed", async () => {
		let posts = 0;
		const m = model({
			initialMessages: answered,
			initialError: "The reply could not be saved.",
			fetch: turnFetch({
				onPost: () => {
					posts += 1;
				},
				stream: () => sseResponse("[DONE]"),
			}),
		});
		assert.equal(m.getState().error?.message, "The reply could not be saved.");
		await m.continueIfOwed(answered);
		assert.equal(posts, 0);
		m.clearError();
		await m.continueIfOwed(answered);
		assert.equal(posts, 0, "closing the banner is not permission to retry the model");
		await m.send({ type: "text", text: "explicit learner input" });
		assert.equal(posts, 1);
		assert.equal(m.getState().error, null);
	});

	it("a failed live save cannot trigger a continuation during a record sync", async () => {
		let posts = 0;
		const m = model({
			initialMessages: answered,
			fetch: turnFetch({
				onPost: () => {
					posts += 1;
				},
				stream: () => sseResponse("[DONE]"),
			}),
		});
		m.applyWireEvent({ type: "error", errorText: "The reply could not be saved." });
		m.setMessages(answered);
		await m.continueIfOwed(answered);
		assert.equal(posts, 0);
	});

	it("an owed continuation starts once through the ordinary send", async () => {
		let posts = 0;
		const m = model({
			initialMessages: answered,
			fetch: turnFetch({
				onPost: () => {
					posts += 1;
				},
				stream: () => sseResponse("[DONE]"),
			}),
		});
		await m.continueIfOwed(answered);
		assert.equal(posts, 1);
	});
});

function reply(id: string, content: unknown[], stopReason = "toolUse"): LannaMessage {
	return { id, role: "assistant", content, stopReason, timestamp: 0 } as unknown as LannaMessage;
}

describe("which records are owed a continuation", () => {
	it("a record ending on a fully answered tool call is owed a continuation", () => {
		const messages = [userRecord("u1", "topic"), assistantWithCall("a1", "call-r1"), resultMessage("call-r1")];
		assert.equal(needsContinuation(messages), true);
	});

	it("a record ending on text is never owed a continuation", () => {
		const messages = [userRecord("u1", "topic"), assistantMessage("a1", "done talking")];
		assert.equal(needsContinuation(messages), false);
	});

	it("a result with no asking reply is never owed a continuation", () => {
		assert.equal(needsContinuation([userRecord("u1", "topic"), resultMessage("call-x")]), false);
	});

	it("a closed chat reply that used only record tools is not continued", () => {
		const reply1 = reply("a1", [
			{ type: "text", text: "I saved that word for review." },
			{ type: "toolCall", id: "call-review", name: "add_to_review", arguments: { words: ["kniha"] } },
		]);
		const messages = [userRecord("u1", "topic"), reply1, resultMessage("call-review", "add_to_review")];
		assert.equal(needsContinuation(messages), false);
	});

	it("a reply with text and a job tool is still continued", () => {
		const reply1 = reply("a1", [
			{ type: "text", text: "Let me look that up." },
			{ type: "toolCall", id: "call-research", name: "research", arguments: { topic: "x" } },
		]);
		const messages = [userRecord("u1", "topic"), reply1, resultMessage("call-research", "research")];
		assert.equal(needsContinuation(messages), true);
	});

	it("a practice reply with only record tools moves on to its next problem, but a chat reply does not", () => {
		const reply1 = reply("a1", [
			{ type: "text", text: "Saved for review." },
			{ type: "toolCall", id: "call-review", name: "add_to_review", arguments: { words: ["kniha"] } },
		]);
		const messages = [userRecord("u1", "topic"), reply1, resultMessage("call-review", "add_to_review")];
		assert.equal(needsContinuation(messages, "practice"), true);
		assert.equal(needsContinuation(messages, "chat"), false);
	});

	it("a dismissed question from an older chat does not restart the tutor", () => {
		const skipped = {
			...(resultMessage("call-quiz", "quiz") as object),
			details: { dismissed: true },
		} as unknown as LannaMessage;
		const messages = [userRecord("u1", "topic"), assistantWithCall("a1", "call-quiz", "quiz"), skipped];
		assert.equal(needsContinuation(messages), false);
	});
});
