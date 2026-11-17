import type { AgentEvent } from "@earendil-works/pi-agent-core";

type ToolCallBlock = { type: "toolCall"; id: string } & Record<string, unknown>;

type IdTable = Map<string, string>;

function roleOf(message: unknown): string | undefined {
	return (message as { role?: string } | null | undefined)?.role;
}

function isToolCallBlock(block: unknown): block is ToolCallBlock {
	return (
		(block as { type?: unknown } | null)?.type === "toolCall" && typeof (block as { id?: unknown }).id === "string"
	);
}

function toolCallBlocksOf(message: unknown): ToolCallBlock[] {
	const content = (message as { content?: unknown } | null | undefined)?.content;
	return Array.isArray(content) ? content.filter(isToolCallBlock) : [];
}

export function collectToolCallIds(messages: readonly unknown[]): string[] {
	return messages.flatMap((message) => {
		switch (roleOf(message)) {
			case "assistant":
				return toolCallBlocksOf(message).map((block) => block.id);
			case "toolResult": {
				const id = (message as { toolCallId?: unknown }).toolCallId;
				return typeof id === "string" ? [id] : [];
			}
			default:
				return [];
		}
	});
}

// Providers such as DeepSeek (via OpenRouter) reset tool-call ids on every response, so `call_0` recurs across turns.
function mintUnusedId(usedIds: Set<string>, originalId: string): string {
	const claim = (id: string): string => {
		usedIds.add(id);
		return id;
	};
	if (!usedIds.has(originalId)) return claim(originalId);
	for (let suffix = 2; ; suffix++) {
		const candidate = `${originalId}~${suffix}`;
		if (!usedIds.has(candidate)) return claim(candidate);
	}
}

export class ToolCallIdUniquifier {
	private readonly usedIds: Set<string>;
	// pi-agent-core's message_end carries the same object it keeps in agent.state.messages, so settlement finds each table by identity.
	private readonly tablesByMessage = new WeakMap<object, IdTable>();
	private currentTable: IdTable | null = null;

	constructor(usedIds: Iterable<string>) {
		this.usedIds = new Set(usedIds);
	}

	event(event: AgentEvent): AgentEvent {
		switch (event.type) {
			case "message_start":
				if (roleOf((event as { message?: unknown }).message) === "assistant") this.currentTable = new Map();
				return this.remapEventMessage(event);
			case "message_update":
			case "message_end":
				return this.remapEventMessage(event);
			case "tool_execution_start":
			case "tool_execution_update":
			case "tool_execution_end":
				return this.remapToolExecution(event);
			case "turn_end":
				return this.remapTurnEnd(event);
			case "agent_end": {
				const messages = (event as { messages: unknown[] }).messages;
				return { ...event, messages: this.remapSettled(messages) } as unknown as AgentEvent;
			}
			default:
				return event;
		}
	}

	remapSettled(messages: readonly unknown[]): unknown[] {
		let scope: IdTable | undefined;
		return messages.map((message) => {
			switch (roleOf(message)) {
				case "assistant": {
					const table = this.tablesByMessage.get(message as object);
					scope = table;
					return table ? this.remapMessage(message) : message;
				}
				case "toolResult": {
					const originalId = (message as { toolCallId?: unknown }).toolCallId;
					if (scope && typeof originalId === "string" && scope.has(originalId)) {
						return { ...(message as object), toolCallId: scope.get(originalId)! };
					}
					return message;
				}
				default:
					return message;
			}
		});
	}

	private remapEventMessage(event: AgentEvent): AgentEvent {
		const message = (event as { message: unknown }).message;
		const remapped = this.remapMessage(message);
		return remapped === message ? event : ({ ...event, message: remapped } as AgentEvent);
	}

	private remapToolExecution(event: AgentEvent): AgentEvent {
		const { toolCallId } = event as { toolCallId: string };
		const mapped = this.currentTable?.get(toolCallId) ?? toolCallId;
		return mapped === toolCallId ? event : ({ ...event, toolCallId: mapped } as AgentEvent);
	}

	private remapTurnEnd(event: AgentEvent): AgentEvent {
		const turn = event as unknown as { message: unknown; toolResults: Array<{ toolCallId?: string }> };
		const message = this.remapMessage(turn.message);
		const table = this.currentTable;
		const toolResults = table
			? turn.toolResults.map((result) =>
					typeof result.toolCallId === "string" && table.has(result.toolCallId)
						? { ...result, toolCallId: table.get(result.toolCallId)! }
						: result,
				)
			: turn.toolResults;
		return { ...turn, message, toolResults } as unknown as AgentEvent;
	}

	private remapMessage(message: unknown): unknown {
		if (roleOf(message) !== "assistant") return message;
		if (toolCallBlocksOf(message).length === 0) return message;
		const table = this.tableFor(message as object);
		let changed = false;
		const content = (message as { content: unknown[] }).content.map((block) => {
			if (!isToolCallBlock(block)) return block;
			const mapped = this.idFor(table, block.id);
			if (mapped === block.id) return block;
			changed = true;
			return { ...block, id: mapped };
		});
		return changed ? { ...(message as object), content } : message;
	}

	private tableFor(message: object): IdTable {
		const existing = this.tablesByMessage.get(message);
		if (existing) {
			this.currentTable = existing;
			return existing;
		}
		const table = this.currentTable ?? new Map<string, string>();
		this.currentTable = table;
		this.tablesByMessage.set(message, table);
		return table;
	}

	private idFor(table: IdTable, originalId: string): string {
		const known = table.get(originalId);
		if (known !== undefined) return known;
		const minted = mintUnusedId(this.usedIds, originalId);
		table.set(originalId, minted);
		return minted;
	}
}
