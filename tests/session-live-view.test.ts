import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { absorbed, SessionModel } from "../components/session-core.ts";
import { newThinkingMessage, type LannaMessage } from "../src/core/chat-messages.ts";
import { projectView } from "../src/core/index.ts";

function poseRecord(): LannaMessage[] {
	return [
		{ id: "m1", role: "user", content: "db practice" },
		{
			id: "m3",
			role: "assistant",
			content: [{ type: "toolCall", id: "call-p1", name: "problem", arguments: { statement: "Q?" } }],
		} as unknown as LannaMessage,
		{
			id: "m4",
			role: "toolResult",
			toolCallId: "call-p1",
			toolName: "problem",
			content: [{ type: "text", text: "Problem posed — the turn ends here." }],
			details: null,
		} as unknown as LannaMessage,
	] as LannaMessage[];
}

function model(initialMessages: LannaMessage[]): SessionModel {
	return new SessionModel({ chatId: "chat_x", initialMessages });
}

describe("what a learner sees while a turn runs", () => {
	it("a settled problem call never shows as live during another turn", () => {
		const live = { executions: new Map(), inFlight: true, streamingIds: new Set<string>() };
		const problem = projectView(poseRecord(), live)
			.flatMap((entry) => entry.parts)
			.find((part) => part.type === "tool-problem");
		assert.ok(problem, "the problem part is shown");
		assert.equal(problem!.state, "input-available", "a settled problem shows its card, not a shimmer");
	});

	it("a call in this turn's streaming reply shows as streaming", () => {
		const live = { executions: new Map(), inFlight: true, streamingIds: new Set(["c_as1"]) };
		const messages = [
			...poseRecord(),
			{
				id: "c_as1",
				role: "assistant",
				content: [{ type: "toolCall", id: "call-c1", name: "conclude", arguments: { outcome: "solved" } }],
			} as unknown as LannaMessage,
		];
		const conclude = projectView(messages, live)
			.flatMap((entry) => entry.parts)
			.find((part) => part.type === "tool-conclude");
		assert.ok(conclude, "the conclude part is shown");
		assert.equal(conclude!.state, "input-streaming", "the live card renders at the bottom");
	});

	it("a dangling call in a settled reply is pending, not streaming", () => {
		const live = { executions: new Map(), inFlight: true, streamingIds: new Set<string>() };
		const messages = [
			{ id: "m1", role: "user", content: "go" },
			{
				id: "m2",
				role: "assistant",
				content: [{ type: "toolCall", id: "call-p9", name: "problem", arguments: { statement: "Q?" } }],
			} as unknown as LannaMessage,
		] as LannaMessage[];
		const part = projectView(messages, live)
			.flatMap((entry) => entry.parts)
			.find((candidate) => candidate.type === "tool-problem");
		assert.equal(part!.state, "input-available", "no evidence of a live call, so no shimmer");
	});

	it("a saved practice thinking marker is matched by its content, not its id", () => {
		const optimistic = { ...newThinkingMessage("call-p1", "my trace"), id: "c_opt1" } as LannaMessage;
		const serverCopy = { ...newThinkingMessage("call-p1", "my trace"), id: "srv_1" } as LannaMessage;
		assert.ok(absorbed(optimistic, [...poseRecord(), serverCopy]), "the same submission drops the local copy");
		const other = { ...newThinkingMessage("call-p1", "a later, different trace"), id: "srv_2" } as LannaMessage;
		assert.ok(!absorbed(optimistic, [...poseRecord(), other]), "different details are a different submission");
		assert.ok(!absorbed(serverCopy, [optimistic]), "a server id is never dropped");
	});

	it("an optimistic thinking card is replaced by its server copy, never doubled", () => {
		const m = model(poseRecord());
		const optimistic = { ...newThinkingMessage("call-p1", "my trace"), id: "c_opt1" } as LannaMessage;
		m.applyWireEvent({ type: "message_start", message: optimistic });
		const customs = () => m.getState().nativeMessages.filter((entry) => entry.role === "custom");
		assert.equal(customs().length, 1, "the optimistic marker is in the live tail");
		const serverCopy = { ...newThinkingMessage("call-p1", "my trace"), id: "srv_1" } as LannaMessage;
		m.adoptRecord([...poseRecord(), serverCopy]);
		assert.equal(customs().length, 1, "the server copy replaces the optimistic one");
		assert.equal((customs()[0] as { id?: string }).id, "srv_1");
	});
});
