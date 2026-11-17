import type { Agent, AgentEvent, AgentMessage } from "@earendil-works/pi-agent-core";
import { ToolCallIdUniquifier } from "./call-ids.ts";

export const TURN_STREAM_HEADERS: HeadersInit = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache, no-transform",
	"X-Accel-Buffering": "no",
};

export const TURN_DONE_FRAME = "data: [DONE]\n\n";

export function turnFrame(event: unknown): string {
	return `data: ${JSON.stringify(event)}\n\n`;
}

type TurnWireEvent =
	| AgentEvent
	| { type: "message_update"; message: AgentMessage }
	| { type: "error"; errorText: string };

interface TurnSubscriber {
	push(event: TurnWireEvent): void;
	done(): void;
}

interface TurnChannel {
	send(event: TurnWireEvent): void;
	close(): void;
	isSettled(): boolean;
	attach(): ReadableStream<Uint8Array>;
}

export interface PiTurnHandle {
	subscribe(): ReadableStream<Uint8Array>;
	abort(): void;
}

interface PiTurnSpec {
	agent: Agent;
	onError?: (error: unknown) => string;
	onSettleError?: (error: unknown) => string;
	onSettleFailure?: (error: unknown, reportedErrorText?: string) => void;
	onFinish: (messages: AgentMessage[], isAborted: boolean) => void;
	usedToolCallIds?: ReadonlySet<string>;
	updateFlushMs?: number;
}

const DEFAULT_UPDATE_FLUSH_MS = 100;

function updateSlotOf(event: TurnWireEvent): string | null {
	if (event.type === "message_update") return "message";
	if (event.type === "tool_execution_update") return `tool:${event.toolCallId}`;
	return null;
}

function endedSlotOf(event: TurnWireEvent): string | null {
	if (event.type === "message_end") return "message";
	if (event.type === "tool_execution_end") return `tool:${event.toolCallId}`;
	return null;
}

function slimWireEvent(event: AgentEvent): TurnWireEvent {
	// pi-agent-core repeats the full partial message inside assistantMessageEvent on every message_update; the wire keeps only the message.
	if (event.type !== "message_update") return event;
	return { type: "message_update", message: event.message };
}

function isAbortedAssistantEnd(event: AgentEvent): boolean {
	if (event.type !== "message_end") return false;
	const message = event.message as { role?: string; stopReason?: string } | undefined;
	return message?.role === "assistant" && message.stopReason === "aborted";
}

function createTurnChannel(updateFlushMs: number): TurnChannel {
	const log: TurnWireEvent[] = [];
	const updateSlots = new Map<string, number>();
	const pending = new Map<string, TurnWireEvent>();
	const subscribers = new Set<TurnSubscriber>();
	let settled = false;
	let flushTimer: ReturnType<typeof setTimeout> | undefined;

	const flushPending = (): void => {
		if (flushTimer !== undefined) {
			clearTimeout(flushTimer);
			flushTimer = undefined;
		}
		if (pending.size === 0) return;
		const batch = [...pending.values()];
		pending.clear();
		for (const subscriber of subscribers) for (const event of batch) subscriber.push(event);
	};

	const armFlush = (): void => {
		if (flushTimer !== undefined) return;
		flushTimer = setTimeout(() => {
			flushTimer = undefined;
			flushPending();
		}, updateFlushMs);
		(flushTimer as { unref?: () => void }).unref?.();
	};

	const retainUpdate = (slot: string, event: TurnWireEvent): void => {
		const index = updateSlots.get(slot);
		if (index !== undefined) {
			log[index] = event;
		} else {
			updateSlots.set(slot, log.length);
			log.push(event);
		}
		pending.set(slot, event);
		armFlush();
	};

	const send = (event: TurnWireEvent): void => {
		if (settled) return;
		const slot = updateSlotOf(event);
		if (slot !== null) {
			retainUpdate(slot, event);
			return;
		}
		const ended = endedSlotOf(event);
		if (ended !== null) updateSlots.delete(ended);
		flushPending();
		log.push(event);
		for (const subscriber of subscribers) subscriber.push(event);
	};

	const close = (): void => {
		if (settled) return;
		flushPending();
		settled = true;
		for (const subscriber of subscribers) subscriber.done();
		subscribers.clear();
	};

	const attach = (): ReadableStream<Uint8Array> => {
		let subscriber: TurnSubscriber | undefined;
		return new ReadableStream<Uint8Array>({
			start(controller) {
				const encoder = new TextEncoder();
				let closed = false;
				subscriber = {
					push(event) {
						if (closed) return;
						try {
							controller.enqueue(encoder.encode(turnFrame(event)));
						} catch {
							closed = true;
						}
					},
					done() {
						if (closed) return;
						closed = true;
						try {
							controller.enqueue(encoder.encode(TURN_DONE_FRAME));
							controller.close();
						} catch {
							// WHATWG streams: enqueue and close throw once the reader has cancelled.
						}
					},
				};
				if (!settled) subscribers.add(subscriber);
				for (const event of log) subscriber.push(event);
				if (settled) subscriber.done();
			},
			cancel() {
				if (subscriber) subscribers.delete(subscriber);
			},
		});
	};

	return {
		send,
		close,
		isSettled: () => settled,
		attach,
	};
}

export function runPiTurn(spec: PiTurnSpec): PiTurnHandle {
	const { agent, onError, onFinish, onSettleError, onSettleFailure, usedToolCallIds } = spec;
	const updateFlushMs = spec.updateFlushMs ?? DEFAULT_UPDATE_FLUSH_MS;
	const uniquifier = usedToolCallIds ? new ToolCallIdUniquifier(usedToolCallIds) : undefined;
	const channel = createTurnChannel(updateFlushMs);
	let sawAbort = false;
	let reportedErrorText: string | undefined;

	const sendErrorFrame = (errorText: string): void => {
		reportedErrorText = errorText;
		channel.send({ type: "error", errorText });
	};

	const runCleanup = (error: unknown): void => {
		try {
			onSettleFailure?.(error, reportedErrorText);
		} catch (cleanupError) {
			console.error("[turn] settlement cleanup failed:", cleanupError);
		}
	};

	const settle = (): void => {
		try {
			// pi-agent-core seeds a leading system message from systemPrompt and the tool declarations; the next turn builds its own.
			const finalMessages = [...agent.state.messages].filter(
				(message) => (message as { role?: string }).role !== "system",
			);
			const messages = uniquifier ? uniquifier.remapSettled(finalMessages) : finalMessages;
			onFinish(messages as AgentMessage[], sawAbort);
		} catch (error) {
			console.error("[turn] settlement failed:", error);
			runCleanup(error);
			if (reportedErrorText === undefined) sendErrorFrame(onSettleError?.(error) ?? "An error occurred.");
		}
	};

	const handle = (event: AgentEvent): void => {
		if (channel.isSettled()) return;
		const uniqued = uniquifier ? uniquifier.event(event) : event;
		channel.send(slimWireEvent(uniqued));
		if (isAbortedAssistantEnd(event)) sawAbort = true;
		if (event.type === "agent_end") {
			settle();
			channel.close();
		}
	};
	agent.subscribe(handle);

	void (async () => {
		try {
			await agent.continue();
		} catch (error) {
			if (channel.isSettled()) {
				console.error("[turn] error after settlement:", error);
				return;
			}
			console.error("[turn] agent loop failed:", error);
			sendErrorFrame(onError?.(error) ?? "An error occurred.");
			settle();
			channel.close();
		}
	})();

	return {
		subscribe: () => channel.attach(),
		abort() {
			if (channel.isSettled()) return;
			sawAbort = true;
			agent.abort();
		},
	};
}

export function piTurnResponse(handle: PiTurnHandle): Response {
	return new Response(handle.subscribe(), { headers: TURN_STREAM_HEADERS });
}
