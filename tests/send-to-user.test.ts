/** Historical send_to_user transcript projection, extraction, and Markdown export.
 * The runtime send_to_user tool and practice agent were removed, while saved
 * transcripts still render and export historical send_to_user calls. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createFauxCore,
	fauxAssistantMessage,
	fauxText,
	fauxThinking,
	fauxToolCall,
	type FauxResponseStep,
} from "@earendil-works/pi-ai";
import type { PiEngine } from "../src/agent/models.ts";
import { runSubagent } from "../src/agent/subagents/pi-run.ts";
import { composeInstructions, createChatAgent } from "../src/agent/teacher-agent.ts";
import { SEND_TO_USER_TOOL, sendToUserText, userFacingTextOf, type LannaMessage } from "../src/core/chat-messages.ts";
import { sessionMarkdown } from "../src/core/session-markdown.ts";
import { projectView } from "../src/core/view.ts";

function scripted(provider: string, id: string, steps: FauxResponseStep[] = []) {
	const faux = createFauxCore({ provider, models: [{ id }] });
	faux.setResponses(steps);
	const engine: PiEngine = { model: faux.getModel(), streamFn: faux.streamSimple };
	return { engine, faux };
}

function outputCall(message: string | number | null = "An explanation.", id = "send-1") {
	return { type: "toolCall" as const, id, name: SEND_TO_USER_TOOL, arguments: { message } };
}
function assistant(content: unknown[], id = "a1"): LannaMessage {
	return { ...fauxAssistantMessage(""), content, id } as LannaMessage;
}
function ack(callId = "send-1", isError = false): LannaMessage {
	return {
		id: `result-${callId}`,
		role: "toolResult",
		toolCallId: callId,
		toolName: SEND_TO_USER_TOOL,
		content: [{ type: "text", text: isError ? "Invalid tool input" : "Message received for display." }],
		details: null,
		isError,
		timestamp: 1,
	};
}
function prose(messages: ReturnType<typeof projectView>): string[] {
	return messages
		.filter((m) => m.role === "assistant")
		.flatMap((m) => m.parts.filter((p) => p.type === "text").map((p) => p.text!));
}

describe("send_to_user retired from active agents", () => {
	it("chat agent and background subagents do not expose a learner-output tool", async () => {
		let calls = 0;
		const { engine } = scripted("anthropic", "claude-opus-5-5", [
			(context) => {
				calls++;
				assert.ok(
					!context.messages.some((m) => m.role === "system" && m.toolsAdded?.some((t) => t.name === SEND_TO_USER_TOOL)),
				);
				return fauxAssistantMessage("Synthetic background result.");
			},
		]);
		const agent = createChatAgent(
			{ sources: { chatId: "chat-no-send-to-user", engineFor: () => undefined, recordUsage: () => {} } },
			{ engine },
		);
		assert.equal(
			agent.state.tools.some((tool) => tool.name === SEND_TO_USER_TOOL),
			false,
		);
		assert.ok(agent.state.systemPrompt.startsWith(composeInstructions("chat")));
		assert.ok(!agent.state.systemPrompt.includes(SEND_TO_USER_TOOL));

		await runSubagent([], {
			role: "researcher",
			engine,
			systemPrompt: "Synthetic fixture.",
			prompt: "Finish.",
			maxTurns: 2,
		});
		assert.equal(calls, 1);
	});
});

describe("send_to_user extraction", () => {
	it("only extracts the output tool's nonblank message, without modifying it", () => {
		const message = "  **Keep spacing and math** $x$\n";
		assert.equal(sendToUserText(outputCall(message)), message);
		for (const block of [
			null,
			{},
			{ type: "text", text: "ordinary" },
			outputCall(2),
			outputCall("  "),
			{ ...outputCall(), name: "other" },
		]) {
			assert.equal(sendToUserText(block), undefined);
		}
		assert.deepEqual(
			userFacingTextOf([
				null,
				fauxThinking("Not lesson prose."),
				fauxText("First"),
				outputCall(message),
				fauxToolCall("pose", { answer: "Q", focus: "f" }),
			]),
			["First", message],
		);
	});
});

describe("send_to_user transcript projection", () => {
	it("renders in place as prose, with thinking unchanged and no tool/ack duplication", () => {
		const messages = [
			assistant([
				fauxText("Before."),
				outputCall("**The lesson.** $x = 1$"),
				fauxThinking("Private reasoning."),
				fauxToolCall("pose", { answer: "Q", focus: "f" }, { id: "pose-1" }),
				fauxText("After."),
			]),
			ack(),
		];
		const before = structuredClone(messages);
		const view = projectView(messages);
		assert.deepEqual(
			view[0]!.parts.map((p) => p.type),
			["step-start", "reasoning", "text", "text", "tool-pose", "text"],
		);
		assert.deepEqual(prose(view), ["Before.", "**The lesson.** $x = 1$", "After."]);
		assert.equal(view[0]!.parts.find((p) => p.type === "reasoning")!.text, "Private reasoning.");
		assert.deepEqual(
			view[0]!.parts.filter((p) => p.type === "text").map((p) => p.id),
			["a1-t0", "a1-t1", "a1-t2"],
		);
		assert.deepEqual(messages, before, "projection never rewrites native content");
		assert.deepEqual(
			projectView(JSON.parse(JSON.stringify(messages))),
			view,
			"reload is identical, without consulting a provider gate",
		);
	});

	it("streams available arguments as replacing prose, never as a live tool card", () => {
		const live = { inFlight: true, streamingIds: new Set(["a1"]), executions: new Map() };
		for (const text of ["A", "A growing", "A growing explanation."]) {
			const view = projectView([assistant([outputCall(text)])], live);
			assert.deepEqual(prose(view), [text]);
			assert.ok(!view[0]!.parts.some((p) => p.type.startsWith("tool-")));
		}
		const empty = projectView([assistant([{ ...outputCall(), arguments: {} }])], live);
		assert.deepEqual(prose(empty), []);
		assert.ok(!empty[0]!.parts.some((p) => p.type.startsWith("tool-")));
	});

	it("malformed messages contain no prose; failures keep the existing error path live and after reload", () => {
		assert.deepEqual(prose(projectView([assistant([outputCall(3)])])), []);
		const messages = [assistant([outputCall("Incomplete teaching.")]), ack("send-1", true)];
		const settled = projectView(messages);
		assert.deepEqual(prose(settled), []);
		assert.equal(settled[0]!.parts[1]!.type, "tool-send_to_user");
		assert.equal(settled[0]!.parts[1]!.state, "output-error");
		const live = projectView(messages.slice(0, 1), {
			inFlight: true,
			streamingIds: new Set(["a1"]),
			executions: new Map([["send-1", { isError: true, errorText: "Invalid tool input" }]]),
		});
		assert.deepEqual(prose(live), []);
		assert.equal(live[0]!.parts[1]!.state, "output-error");
	});
});

describe("send_to_user Markdown", () => {
	it("selects output prose once and in order", () => {
		const message = assistant([
			fauxText("First."),
			outputCall("Second."),
			fauxThinking("Hidden."),
			outputCall("Third.", "send-2"),
		]);
		const messages = [message, ack(), ack("send-2")];
		const md = sessionMarkdown(messages, { anchors: false });
		assert.equal(md, "### Teacher\n\nFirst.\n\n### Teacher\n\nSecond.\n\n### Teacher\n\nThird.");
	});

	it("does not export failed output calls, including partial calls from truncated responses", () => {
		const message = assistant([fauxText("Keep this."), outputCall("Do not treat this as delivered.")]);
		const messages = [message, ack("send-1", true)];
		assert.equal(sessionMarkdown(messages, { anchors: false }), "### Teacher\n\nKeep this.");
	});
});

describe("send_to_user interrupted generations", () => {
	for (const stopReason of ["error", "aborted"] as const) {
		it(`${stopReason} without a tool result never becomes delivered teaching; ordinary text stays unchanged`, () => {
			const message = { ...assistant([fauxText("Keep ordinary text."), outputCall("Unfinished output.")]), stopReason };
			const messages = [message];
			assert.deepEqual(prose(projectView(messages)), ["Keep ordinary text."]);
			assert.deepEqual(prose(projectView(JSON.parse(JSON.stringify(messages)))), ["Keep ordinary text."]);
			assert.equal(sessionMarkdown(messages, { anchors: false }), "### Teacher\n\nKeep ordinary text.");
		});
	}
});
