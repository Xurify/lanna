import { SessionModel } from "../../components/session-core.ts";
import type { LannaMessage } from "../../src/core/chat-messages.ts";
import { newUserMessage } from "../../src/core/chat-messages.ts";

export type Fetch = typeof globalThis.fetch;

export const CHAT_ID = "chat_x";
const RECORD_URL = `/api/chats/${CHAT_ID}`;
const STREAM_URL = `${RECORD_URL}/stream`;
const TURN_URL = "/api/chat";

export function sseFrames(...events: unknown[]): string {
	return events
		.map((event) => (event === "[DONE]" ? "data: [DONE]\n\n" : `data: ${JSON.stringify(event)}\n\n`))
		.join("");
}

export function sseResponse(...events: unknown[]): Response {
	return new Response(sseFrames(...events), { status: 200 });
}

export function drippedResponse(text: string, sliceBytes: number, status = 200): Response {
	const bytes = new TextEncoder().encode(text);
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			for (let offset = 0; offset < bytes.length; offset += sliceBytes) {
				controller.enqueue(bytes.slice(offset, offset + sliceBytes));
			}
			controller.close();
		},
	});
	return new Response(body, { status });
}

export function model(options: Partial<ConstructorParameters<typeof SessionModel>[0]> = {}): SessionModel {
	return new SessionModel({ chatId: CHAT_ID, initialMessages: [], ...options });
}

export function assistantMessage(id: string, text: string): LannaMessage {
	return {
		id,
		role: "assistant",
		content: [{ type: "text", text }],
		stopReason: "stop",
		usage: { input: 0, output: 0, total: 0, cacheReads: 0, cacheWrites: 0 },
		timestamp: 0,
		provider: "openrouter",
		model: "test",
	} as unknown as LannaMessage;
}

export function failedAssistant(
	id = "failed",
	errorMessage: string | undefined = "Google 500: fixture failure",
): LannaMessage {
	return { ...assistantMessage(id, ""), content: [], stopReason: "error", errorMessage } as LannaMessage;
}

export function assistantWithCall(id: string, callId: string, name = "research"): LannaMessage {
	return {
		id,
		role: "assistant",
		content: [{ type: "toolCall", id: callId, name, arguments: { topic: "x" } }],
		stopReason: "toolUse",
		usage: { input: 0, output: 0, total: 0, cacheReads: 0, cacheWrites: 0 },
		provider: "openrouter",
		model: "test",
		timestamp: 0,
	} as unknown as LannaMessage;
}

export function resultMessage(callId: string, name = "research"): LannaMessage {
	return {
		id: `r_${callId}`,
		role: "toolResult",
		toolCallId: callId,
		toolName: name,
		content: [{ type: "text", text: "ok" }],
		details: { ok: true },
		isError: false,
		timestamp: 0,
	} as unknown as LannaMessage;
}

export function userRecord(id: string, text: string): LannaMessage {
	return { ...newUserMessage(text), id };
}

export function partialUpdate(blocks: unknown[], stopReason?: string): Record<string, unknown> {
	return {
		type: "message_update",
		message: {
			role: "assistant",
			content: blocks,
			...(stopReason ? { stopReason } : {}),
			usage: { input: 0, output: 0, total: 0, cacheReads: 0, cacheWrites: 0 },
			provider: "openrouter",
			model: "test",
		},
		assistantMessageEvent: { type: "text", textDelta: "" },
	};
}

export interface TurnRoutes {
	stream: () => Response;
	userText?: string;
	post?: () => Promise<Response> | Response;
	onPost?: (body: string) => void;
}

export function turnFetch(routes: TurnRoutes): Fetch {
	return (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		if (url === TURN_URL) {
			if (routes.onPost && typeof init?.body === "string") routes.onPost(init.body);
			return (await routes.post?.()) ?? Response.json({ ok: true });
		}
		if (url === RECORD_URL) return Response.json({ messages: recordFor(routes.userText) });
		if (url === STREAM_URL) return routes.stream();
		throw new Error(`unexpected fetch: ${url}`);
	}) as Fetch;
}

function recordFor(userText: string | undefined): unknown[] {
	return userText === undefined ? [] : [{ id: "u1", role: "user", content: userText, timestamp: 1 }];
}
