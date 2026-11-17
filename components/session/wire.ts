import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { ToolResultMessage } from "@earendil-works/pi-ai";
import type { LannaMessage } from "../../src/core";
import { withError } from "./transitions";
import { localId } from "./local-id";
import { type RunningTurn, type SessionData } from "./state";

export type WireEvent = AgentEvent | { type: "error"; errorText?: unknown };

export interface WireStep {
	data: SessionData;
	acted: boolean;
}

type MessageEventType = "message_start" | "message_update" | "message_end";

type ToolResultPayload = {
	content?: Array<{ type?: string; text?: string }>;
	details?: unknown;
} | null;

const UNKNOWN_ERROR_TEXT = "An error occurred.";
const TOOL_FAILED_TEXT = "The tool call failed.";

export function reduceWireEvent(data: SessionData, event: WireEvent): WireStep {
	switch (event.type) {
		case "error":
			return { data: withError(data, String(event.errorText ?? UNKNOWN_ERROR_TEXT)), acted: false };
		case "agent_start":
			return { data: agentStarted(data), acted: false };
		case "message_start":
		case "message_update":
		case "message_end":
			return reduceMessageEvent(data, event.type, event.message as LannaMessage);
		case "tool_execution_end":
			return { data: toolExecutionEnded(data, event), acted: true };
		case "turn_end":
			return { data: turnEnded(data, event.toolResults), acted: true };
		default:
			return { data, acted: false };
	}
}

function agentStarted(data: SessionData): SessionData {
	const unblocked = { ...data, automaticContinuationBlocked: false };
	return data.error === null ? unblocked : withError(unblocked, null);
}

function reduceMessageEvent(data: SessionData, type: MessageEventType, message: LannaMessage): WireStep {
	if (message.role !== "assistant") return reduceMarkerEvent(data, message);
	return { data: reduceAssistantEvent(data, type, message), acted: true };
}

function reduceMarkerEvent(data: SessionData, message: LannaMessage): WireStep {
	if (message.id === undefined) return { data, acted: false };
	return { data: { ...data, tail: upsertById(data.tail, message) }, acted: true };
}

function reduceAssistantEvent(data: SessionData, type: MessageEventType, message: LannaMessage): SessionData {
	const streamedId: string | undefined = message.id;
	const id = streamedId ?? data.turn.streamingMessageId ?? localId();
	const stamped = { ...message, id } as LannaMessage;
	if (type === "message_start") return startAssistant(data, id, stamped);
	if (type === "message_update") return updateAssistant(data, id, stamped);
	return endAssistant(data, id, stamped);
}

function startAssistant(data: SessionData, id: string, stamped: LannaMessage): SessionData {
	const turn: RunningTurn = {
		...data.turn,
		incompleteUsageIds: withMember(data.turn.incompleteUsageIds, id),
		streamingIds: withMember(data.turn.streamingIds, id),
		streamingMessageId: id,
	};
	return { ...data, tail: [...data.tail, stamped], turn };
}

function updateAssistant(data: SessionData, id: string, stamped: LannaMessage): SessionData {
	const turn: RunningTurn = { ...data.turn, incompleteUsageIds: withMember(data.turn.incompleteUsageIds, id) };
	return { ...data, tail: upsertById(data.tail, stamped), turn };
}

function endAssistant(data: SessionData, id: string, stamped: LannaMessage): SessionData {
	const failed = stamped.role === "assistant" && stamped.stopReason === "error";
	const turn: RunningTurn = {
		...data.turn,
		incompleteUsageIds: withoutMember(data.turn.incompleteUsageIds, id),
		streamingMessageId: null,
		liveFailureId: failed ? id : data.turn.liveFailureId,
	};
	const settled = { ...data, tail: upsertById(data.tail, stamped), turn };
	return failed ? withError(settled, null) : settled;
}

function toolExecutionEnded(
	data: SessionData,
	event: Extract<AgentEvent, { type: "tool_execution_end" }>,
): SessionData {
	const result = event.result as ToolResultPayload;
	const errorText = result?.content?.find((block) => block.type === "text")?.text ?? TOOL_FAILED_TEXT;
	const execution = { isError: event.isError, output: result?.details, errorText };
	const executions = new Map(data.turn.executions).set(event.toolCallId, execution);
	return { ...data, turn: { ...data.turn, executions } };
}

function turnEnded(data: SessionData, results: ToolResultMessage[]): SessionData {
	const stamped = results.map((result) => ({ ...result, id: localId() }) as unknown as LannaMessage);
	return { ...data, tail: [...data.tail, ...stamped] };
}

function upsertById(list: readonly LannaMessage[], message: LannaMessage): LannaMessage[] {
	const index = list.findIndex((entry) => entry.id === message.id);
	return index === -1 ? [...list, message] : list.with(index, message);
}

function withMember(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
	return new Set(set).add(id);
}

function withoutMember(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
	return new Set([...set].filter((member) => member !== id));
}
