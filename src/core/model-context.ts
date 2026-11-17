import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, Message, ToolResultMessage } from "@earendil-works/pi-ai";
import type { LannaMarkerMessage, LannaMessage } from "./chat-messages.ts";
import { activeCompactionOf, keptIndexFor } from "./compaction.ts";

const INTERRUPTED_TEXT = "This call was interrupted before it returned a result.";

function compactionHead(compaction: LannaMarkerMessage): Message {
	return {
		role: "user",
		content: [{ type: "text", text: compaction.content }],
		timestamp: compaction.timestamp,
	};
}

function markerHasModelFace(marker: LannaMarkerMessage): boolean {
	return marker.content !== "" && marker.customType !== "problem-dismissed";
}

function markerAsUserMessage(marker: LannaMarkerMessage): Message {
	return { role: "user", content: [{ type: "text", text: marker.content }], timestamp: marker.timestamp };
}

function withoutRecordId(message: LannaMessage): Message {
	const { id: _id, ...native } = message;
	return native as Message;
}

function resultIdsAfter(messages: readonly AgentMessage[], index: number): Set<string> {
	const ids = new Set<string>();
	for (const message of messages.slice(index + 1)) {
		if ((message as { role?: string }).role === "toolResult") ids.add((message as ToolResultMessage).toolCallId);
	}
	return ids;
}

function interruptedResultsOf(assistant: AssistantMessage, answeredIds: ReadonlySet<string>): ToolResultMessage[] {
	const results: ToolResultMessage[] = [];
	for (const block of assistant.content) {
		if (block.type !== "toolCall" || answeredIds.has(block.id)) continue;
		results.push({
			role: "toolResult",
			toolCallId: block.id,
			toolName: block.name,
			content: [{ type: "text", text: INTERRUPTED_TEXT }],
			isError: false,
			timestamp: assistant.timestamp,
		});
	}
	return results;
}

export function toLlmMessages(messages: readonly AgentMessage[]): Message[] {
	const records = messages as readonly LannaMessage[];
	const active = activeCompactionOf(records);
	const keptIndex = active ? keptIndexFor(records, active) : 0;
	const head = active && keptIndex > 0 ? compactionHead(active) : null;
	const start = head ? keptIndex : 0;
	const leading = (messages[0] as { role?: string } | undefined)?.role === "system" ? (messages[0] as Message) : null;

	const out: Message[] = [];
	if (leading) out.push(leading);
	if (head) out.push(head);
	for (let index = leading ? Math.max(start, 1) : start; index < messages.length; index++) {
		const message = messages[index] as LannaMessage;
		if (message.role === "custom") {
			if (!markerHasModelFace(message)) continue;
			if (head !== null && active !== null && message.id === active.id) continue;
			out.push(markerAsUserMessage(message));
			continue;
		}
		out.push(withoutRecordId(message));
		if (message.role !== "assistant") continue;
		out.push(...interruptedResultsOf(message, resultIdsAfter(messages, index)));
	}
	return out;
}
