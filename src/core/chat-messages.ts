import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ToolResultMessage, UserMessage } from "@earendil-works/pi-ai";
import { closesChatReply } from "./chat-answers.ts";
import { CONCLUDE_ACK_TEXT, NEXT_PROBLEM_TEXT, THINKING_LABEL } from "./contracts/chat.ts";

export type CurrentMarkerType = "practice-thinking" | "practice-next" | "problem-dismissed" | "compaction";

export type LegacyMarkerType = "subagent-steer" | "subagent-abort" | "probe-handoff" | "graph-context" | "plan-block";

export interface LannaMarkerMessage {
	id: string;
	role: "custom";
	customType: CurrentMarkerType | LegacyMarkerType;
	content: string;
	display: boolean;
	details: unknown;
	timestamp: number;
}

declare module "@earendil-works/pi-agent-core" {
	interface CustomAgentMessages {
		lannaMarker: LannaMarkerMessage;
	}
}

export type LannaMessage = (UserMessage | AssistantMessage | ToolResultMessage | LannaMarkerMessage) & { id: string };

export function asAgentMessages(messages: readonly LannaMessage[]): AgentMessage[] {
	return messages as unknown as AgentMessage[];
}

export function newMessageId(): string {
	return `msg_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

export function newUserMessage(text: string): LannaMessage & UserMessage {
	return { id: newMessageId(), role: "user", content: text, timestamp: Date.now() };
}

export function newUserSteer(id: string, text: string): LannaMessage & UserMessage {
	return { id, role: "user", content: text, timestamp: Date.now() };
}

export const SEND_TO_USER_TOOL = "send_to_user";

export function sendToUserText(block: unknown): string | undefined {
	if (!block || typeof block !== "object") return undefined;
	const call = block as { type?: unknown; name?: unknown; arguments?: unknown };
	if (call.type !== "toolCall" || call.name !== SEND_TO_USER_TOOL) return undefined;
	if (!call.arguments || typeof call.arguments !== "object") return undefined;
	const message = (call.arguments as { message?: unknown }).message;
	return typeof message === "string" && message.trim() ? message : undefined;
}

export function userFacingTextOf(content: unknown, failedOutputCalls?: ReadonlySet<string>): string[] {
	if (typeof content === "string") return content.trim() ? [content] : [];
	if (!Array.isArray(content)) return [];
	const out: string[] = [];
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		if (block.type === "toolCall" && failedOutputCalls?.has(block.id)) continue;
		const text = block.type === "text" ? block.text : sendToUserText(block);
		if (typeof text === "string" && text.trim()) out.push(text);
	}
	return out;
}

export function failedOutputCallIds(messages: readonly LannaMessage[]): ReadonlySet<string> {
	const failed = new Set<string>();
	for (const message of messages) {
		if (message.role === "toolResult" && message.toolName === SEND_TO_USER_TOOL && message.isError) {
			failed.add(message.toolCallId);
		} else if (message.role === "assistant" && (message.stopReason === "error" || message.stopReason === "aborted")) {
			for (const block of message.content) {
				if (block.type === "toolCall" && block.name === SEND_TO_USER_TOOL) failed.add(block.id);
			}
		}
	}
	return failed;
}

export const PRACTICE_PROBLEM_TOOL = "problem";
export const PRACTICE_CONCLUDE_TOOL = "conclude";

export function newThinkingMessage(problemCallId: string, text: string): LannaMarkerMessage {
	return {
		id: newMessageId(),
		role: "custom",
		customType: "practice-thinking",
		content: `${THINKING_LABEL}:\n${text}`,
		display: true,
		details: { problemCallId, text },
		timestamp: Date.now(),
	};
}

export function newNextMessage(): LannaMarkerMessage {
	return {
		id: newMessageId(),
		role: "custom",
		customType: "practice-next",
		content: NEXT_PROBLEM_TEXT,
		display: true,
		details: {},
		timestamp: Date.now(),
	};
}

export function newProblemDismissedMarker(problemCallId: string): LannaMarkerMessage {
	return {
		id: newMessageId(),
		role: "custom",
		customType: "problem-dismissed",
		content: "",
		display: true,
		details: { problemCallId },
		timestamp: Date.now(),
	};
}

export function concludedByDismissalPair(
	problemCallId: string,
): [LannaMessage & AssistantMessage, LannaMessage & ToolResultMessage] {
	const callId = `call_conc_${problemCallId}`;
	const now = Date.now();
	// pi-ai's history serializers read only the content blocks, so these
	// stamps are placeholders.
	const syntheticStamps = {
		api: "faux",
		provider: "synthetic",
		model: "synthetic-conclude",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "toolUse",
	} as const;
	return [
		{
			id: newMessageId(),
			role: "assistant",
			content: [{ type: "toolCall", id: callId, name: PRACTICE_CONCLUDE_TOOL, arguments: { outcome: "dismissed" } }],
			timestamp: now,
			...syntheticStamps,
		},
		{
			id: newMessageId(),
			role: "toolResult",
			toolCallId: callId,
			toolName: PRACTICE_CONCLUDE_TOOL,
			content: [{ type: "text", text: CONCLUDE_ACK_TEXT }],
			details: { outcome: "dismissed", problemCallId },
			isError: false,
			timestamp: now,
		},
	];
}

function cleanToolCallIds(messages: readonly LannaMessage[]): Set<string> {
	const ids = new Set<string>();
	for (const message of messages) {
		if (message.role === "toolResult" && !message.isError) ids.add(message.toolCallId);
	}
	return ids;
}

export interface ActiveProblem {
	toolCallId: string;
	input: unknown;
}

export function activeProblemOf(messages: readonly LannaMessage[]): ActiveProblem | null {
	const cleanIds = cleanToolCallIds(messages);
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index]!;
		if (message.role === "custom") {
			if (message.customType === "problem-dismissed") return null;
			continue;
		}
		if (message.role !== "assistant") continue;
		for (const block of [...message.content].reverse()) {
			if (block.type !== "toolCall") continue;
			if (block.name === PRACTICE_CONCLUDE_TOOL && cleanIds.has(block.id)) return null;
			if (block.name === PRACTICE_PROBLEM_TOOL && cleanIds.has(block.id)) {
				return { toolCallId: block.id, input: block.arguments };
			}
		}
	}
	return null;
}

export function pendingProblemDismissalOf(messages: readonly LannaMessage[]): string | null {
	const cleanIds = cleanToolCallIds(messages);
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index]!;
		if (message.role === "custom" && message.customType === "problem-dismissed") {
			return (message.details as { problemCallId: string }).problemCallId;
		}
		if (message.role !== "assistant") continue;
		const settled = message.content.some(
			(block) =>
				block.type === "toolCall" &&
				(block.name === PRACTICE_CONCLUDE_TOOL || block.name === PRACTICE_PROBLEM_TOOL) &&
				cleanIds.has(block.id),
		);
		if (settled) return null;
	}
	return null;
}

export function modelSolutionForConclude(
	messages: readonly LannaMessage[],
	concludeCallId: string,
): string | undefined {
	const input = problemInputForConclude(messages, concludeCallId);
	return typeof input?.modelSolution === "string" ? input.modelSolution : undefined;
}

export interface ProblemPoseInput {
	statement?: unknown;
	mode?: unknown;
	target?: unknown;
	modelSolution?: unknown;
}

export function problemInputForConclude(
	messages: readonly LannaMessage[],
	concludeCallId: string,
): ProblemPoseInput | undefined {
	const cleanIds = cleanToolCallIds(messages);
	const concludeIndex = messages.findIndex(
		(message) =>
			message.role === "assistant" &&
			message.content.some((block) => block.type === "toolCall" && block.id === concludeCallId),
	);
	if (concludeIndex < 0) return undefined;
	for (let index = concludeIndex; index >= 0; index--) {
		const message = messages[index]!;
		if (message.role !== "assistant") continue;
		for (const block of [...message.content].reverse()) {
			if (block.type !== "toolCall" || block.name !== PRACTICE_PROBLEM_TOOL || !cleanIds.has(block.id)) continue;
			return (block.arguments ?? undefined) as ProblemPoseInput | undefined;
		}
	}
	return undefined;
}

function trailingResultsStart(messages: readonly LannaMessage[]): number {
	let start = messages.length - 1;
	while (start > 0 && messages[start - 1]?.role === "toolResult") start--;
	return start;
}

export function needsContinuation(messages: readonly LannaMessage[]): boolean {
	const last = messages.at(-1);
	if (last?.role !== "toolResult") return false;
	const start = trailingResultsStart(messages);
	const owner = messages[start - 1];
	if (owner?.role !== "assistant" || !Array.isArray(owner.content)) return false;
	const results = messages.slice(start) as Array<LannaMessage & ToolResultMessage>;
	const posedProblem = results.some(
		(result) => result.toolName === PRACTICE_PROBLEM_TOOL && !result.isError && result.details == null,
	);
	if (posedProblem) return false;
	if (closesChatReply(owner.content)) return false;
	const answered = new Set(results.map((result) => result.toolCallId));
	const calls = owner.content.filter((block) => block.type === "toolCall");
	return calls.length > 0 && calls.every((call) => answered.has(call.id));
}
