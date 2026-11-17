import type { AssistantMessage, ToolResultMessage, UserMessage } from "@earendil-works/pi-ai";
import {
	modelSolutionForConclude,
	PRACTICE_CONCLUDE_TOOL,
	PRACTICE_PROBLEM_TOOL,
	problemInputForConclude,
	SEND_TO_USER_TOOL,
	sendToUserText,
	type LannaMarkerMessage,
	type LannaMessage,
} from "./chat-messages.ts";
import { activeCompactionOf, type CompactionDetails } from "./compaction.ts";

export interface LannaViewPart extends Record<string, unknown> {
	type: string;
	id?: string;
	text?: string;
	state?: string;
	toolCallId?: string;
	input?: unknown;
	output?: unknown;
	rawInput?: unknown;
	errorText?: string;
	data?: unknown;
}

export interface LannaViewMessage {
	id: string;
	role: "user" | "assistant";
	parts: LannaViewPart[];
	metadata?: unknown;
}

export interface LiveExecution {
	isError: boolean;
	output?: unknown;
	errorText?: string;
}

interface LiveTurnState {
	executions: ReadonlyMap<string, LiveExecution>;
	inFlight: boolean;
	streamingIds: ReadonlySet<string>;
}

type AssistantBlock = AssistantMessage["content"][number];
type ToolCallBlock = Extract<AssistantBlock, { type: "toolCall" }>;
type CompactionMarker = LannaMarkerMessage & { details: CompactionDetails };

interface AssistantContext {
	messages: readonly LannaMessage[];
	live: LiveTurnState | undefined;
	failedOutputs: ReadonlyMap<string, ToolResultMessage>;
}

function textPart(text: string): LannaViewPart {
	return { type: "text", text, state: "done" };
}

function messageTextPart(id: string, text: string): LannaViewPart {
	return { type: "text", id, text, state: "done" };
}

function applyResult(part: LannaViewPart, result: ToolResultMessage): void {
	if (!result.isError) {
		part.state = "output-available";
		part.output = result.details;
		return;
	}
	part.state = "output-error";
	part.rawInput = part.input;
	const text = result.content.find((content) => content.type === "text");
	part.errorText = text?.type === "text" ? text.text : "The tool call failed.";
}

function toolPartOf(block: ToolCallBlock, live: LiveTurnState | undefined, streaming: boolean): LannaViewPart {
	const part: LannaViewPart = { type: `tool-${block.name}`, toolCallId: block.id, input: block.arguments };
	const execution = live?.executions.get(block.id);
	if (!execution) {
		part.state = streaming ? "input-streaming" : "input-available";
		return part;
	}
	if (execution.isError) {
		part.state = "output-error";
		part.rawInput = block.arguments;
		part.errorText = execution.errorText ?? "The tool call failed.";
		return part;
	}
	if (block.name === PRACTICE_PROBLEM_TOOL) {
		part.state = "input-available";
		return part;
	}
	part.state = "output-available";
	part.output = execution.output;
	return part;
}

function outputCallPart(
	block: ToolCallBlock,
	message: AssistantMessage & { id: string },
	context: AssistantContext,
	streaming: boolean,
	nextTextId: () => string,
): LannaViewPart | undefined {
	if (message.stopReason === "error" || message.stopReason === "aborted") return undefined;
	const part = toolPartOf(block, context.live, streaming);
	const failure = context.failedOutputs.get(block.id);
	if (failure) applyResult(part, failure);
	if (part.state === "output-error") return part;
	const text = sendToUserText(block);
	return text === undefined ? undefined : messageTextPart(nextTextId(), text);
}

function contentParts(
	message: AssistantMessage & { id: string },
	context: AssistantContext,
	streaming: boolean,
): LannaViewPart[] {
	const reasoning: LannaViewPart[] = [];
	const rest: LannaViewPart[] = [];
	let textCount = 0;
	let reasoningCount = 0;
	const nextTextId = () => `${message.id}-t${textCount++}`;
	for (const block of message.content) {
		if (block.type === "text") {
			rest.push(messageTextPart(nextTextId(), block.text));
		} else if (block.type === "thinking") {
			reasoning.push({
				type: "reasoning",
				id: `${message.id}-r${reasoningCount++}`,
				text: block.thinking,
				state: "done",
			});
		} else if (block.type === "toolCall") {
			if (block.name === SEND_TO_USER_TOOL) {
				const part = outputCallPart(block, message, context, streaming, nextTextId);
				if (part) rest.push(part);
				continue;
			}
			const part = toolPartOf(block, context.live, streaming);
			if (block.name === PRACTICE_CONCLUDE_TOOL) {
				part.reveal = modelSolutionForConclude(context.messages, block.id);
				part.problemInput = problemInputForConclude(context.messages, block.id);
			}
			rest.push(part);
		}
	}
	return [...reasoning, ...rest];
}

function assistantParts(message: AssistantMessage & { id: string }, context: AssistantContext): LannaViewPart[] {
	const streaming = context.live?.streamingIds.has(message.id) === true;
	const parts = contentParts(message, context, streaming);
	if (parts.length > 0) return parts;
	return streaming ? [{ type: "reasoning", id: `${message.id}-r0`, text: "", state: "done" }] : [];
}

function lastAssistantView(views: readonly LannaViewMessage[]): LannaViewMessage | undefined {
	const last = views.at(-1);
	return last?.role === "assistant" ? last : undefined;
}

function projectAssistant(
	message: AssistantMessage & { id: string },
	views: LannaViewMessage[],
	context: AssistantContext,
): void {
	const parts = assistantParts(message, context);
	if (parts.length === 0) return;
	const group = lastAssistantView(views);
	if (group) {
		group.parts.push({ type: "step-start" }, ...parts);
		return;
	}
	views.push({ id: message.id, role: "assistant", parts: [{ type: "step-start" }, ...parts] });
}

function userView(message: UserMessage & { id: string }): LannaViewMessage {
	const texts =
		typeof message.content === "string"
			? [message.content]
			: message.content.flatMap((content) => (content.type === "text" ? [content.text] : []));
	return { id: message.id, role: "user", parts: texts.map(textPart) };
}

function findToolPart(views: readonly LannaViewMessage[], toolCallId: string): LannaViewPart | undefined {
	for (let viewIndex = views.length - 1; viewIndex >= 0; viewIndex--) {
		const parts = views[viewIndex]!.parts;
		for (let partIndex = parts.length - 1; partIndex >= 0; partIndex--) {
			const part = parts[partIndex]!;
			if (part.type.startsWith("tool-") && part.toolCallId === toolCallId) return part;
		}
	}
	return undefined;
}

function applyToolResult(part: LannaViewPart | undefined, result: ToolResultMessage): void {
	if (!part) return;
	const isPoseAcknowledgement =
		part.type === `tool-${PRACTICE_PROBLEM_TOOL}` && !result.isError && result.details == null;
	if (isPoseAcknowledgement) {
		part.state = "input-available";
		return;
	}
	applyResult(part, result);
}

function failedOutputResults(messages: readonly LannaMessage[]): Map<string, ToolResultMessage> {
	const failed = new Map<string, ToolResultMessage>();
	for (const message of messages) {
		if (message.role === "toolResult" && message.toolName === SEND_TO_USER_TOOL && message.isError) {
			failed.set(message.toolCallId, message);
		}
	}
	return failed;
}

function cutDivider(compaction: CompactionMarker): LannaViewMessage {
	return {
		id: `cut_${compaction.id}`,
		role: "user",
		parts: [
			{
				type: "data-compaction-cut",
				id: `cc_${compaction.id}`,
				data: { content: compaction.content, details: compaction.details },
			},
		],
	};
}

function projectMarker(marker: LannaMarkerMessage, views: LannaViewMessage[]): void {
	switch (marker.customType) {
		case "practice-thinking":
			views.push({
				id: marker.id,
				role: "user",
				parts: [{ type: "data-practice-thinking", id: `pt_${marker.id}`, data: marker.details }],
			});
			return;
		case "practice-next":
			views.push({
				id: marker.id,
				role: "user",
				parts: [{ type: "data-practice-next", id: `pn_${marker.id}`, data: null }],
			});
			return;
		case "compaction":
			views.push({
				id: marker.id,
				role: "user",
				parts: [
					{
						type: "data-compaction",
						id: `cm_${marker.id}`,
						data: { content: marker.content, details: marker.details as CompactionDetails },
					},
				],
			});
			return;
		default:
			return;
	}
}

export function projectView(messages: readonly LannaMessage[], live?: LiveTurnState): LannaViewMessage[] {
	const views: LannaViewMessage[] = [];
	const context: AssistantContext = { messages, live, failedOutputs: failedOutputResults(messages) };
	const compaction = activeCompactionOf(messages);
	for (const message of messages) {
		if (compaction && message.id === compaction.details.firstKeptMessageId) views.push(cutDivider(compaction));
		switch (message.role) {
			case "user":
				views.push(userView(message));
				break;
			case "custom":
				projectMarker(message, views);
				break;
			case "toolResult":
				applyToolResult(findToolPart(views, message.toolCallId), message);
				break;
			case "assistant":
				projectAssistant(message, views, context);
				break;
		}
	}
	return views;
}
