import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
	assistantMessage,
	CHAT_ID,
	drippedResponse,
	model,
	partialUpdate,
	sseFrames,
	sseResponse,
	turnFetch,
	userRecord,
	type Fetch,
} from "./helpers/session-wire.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const TURN_URL = "/api/chat";
const RECORD_URL = `/api/chats/${CHAT_ID}`;
const STREAM_URL = `${RECORD_URL}/stream`;

function assistantStart(text: string): Record<string, unknown> {
	return { type: "message_start", message: { role: "assistant", content: [{ type: "text", text }] } };
}

function assistantEnd(text: string): Record<string, unknown> {
	return {
		type: "message_end",
		message: { role: "assistant", content: [{ type: "text", text }], stopReason: "stop" },
	};
}

describe("reattaching to a running turn", () => {
	it("reattach re-reads the record, then attaches to the stream", async () => {
		const urls: string[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			urls.push(url);
			if (url === RECORD_URL) return Response.json({ messages: [] });
			if (url === STREAM_URL) return drippedResponse(sseFrames(assistantStart("hi"), "[DONE]"), 8);
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;
		const m = model();
		await m.resumeStream();
		assert.deepEqual(urls, [RECORD_URL, STREAM_URL]);
		assert.equal(m.getState().status, "ready");
	});

	it("a fresh mount attaches straight to the stream without re-reading the record", async () => {
		const urls: string[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			urls.push(url);
			if (url === STREAM_URL)
				return sseResponse(assistantStart("hi"), assistantEnd("hi"), { type: "agent_end", messages: [] }, "[DONE]");
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;
		const m = model();
		await m.resumeStream(false);
		assert.deepEqual(urls, [STREAM_URL], "one round trip: the page render already read the record");
		assert.equal(m.getState().status, "ready");
	});

	it("a protocol-only start keeps the placeholder until a visible event arrives", async () => {
		let releaseProtocol!: () => void;
		let releaseRest!: () => void;
		const protocolGate = new Promise<void>((resolve) => {
			releaseProtocol = resolve;
		});
		const restGate = new Promise<void>((resolve) => {
			releaseRest = resolve;
		});
		const encoder = new TextEncoder();
		const body = new ReadableStream<Uint8Array>({
			async start(controller) {
				controller.enqueue(encoder.encode(sseFrames({ type: "agent_start" }, { type: "turn_start" })));
				await protocolGate;
				controller.enqueue(
					encoder.encode(sseFrames({ type: "message_start", message: { role: "assistant", content: [] } })),
				);
				await restGate;
				controller.enqueue(
					encoder.encode(
						sseFrames(
							partialUpdate([{ type: "thinking", thinking: "pondering" }]),
							{ type: "agent_end", messages: [] },
							"[DONE]",
						),
					),
				);
				controller.close();
			},
		});
		globalThis.fetch = turnFetch({ userText: "q", stream: () => new Response(body) });
		const m = model();
		const sending = m.send({ type: "text", text: "q" });
		assert.equal(m.status, "submitted", "the placeholder is up before anything arrives");
		await new Promise((resolve) => setTimeout(resolve, 25));
		assert.equal(m.status, "submitted", "protocol events apply nothing: the placeholder holds");
		releaseProtocol();
		await new Promise((resolve) => setTimeout(resolve, 25));
		assert.equal(m.status, "streaming", "the first applied event flips the status to streaming");
		releaseRest();
		await sending;
		assert.equal(m.status, "ready");
	});

	it("a stop during the send neither attaches a stream nor fails the send", async () => {
		let resolvePost!: () => void;
		let postAborted = false;
		const urls: string[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			urls.push(url);
			if (url === TURN_URL) {
				init?.signal?.addEventListener("abort", () => {
					postAborted = true;
				});
				await new Promise<void>((resolve) => {
					resolvePost = resolve;
				});
				return Response.json({ ok: true });
			}
			if (url === RECORD_URL) return Response.json({ messages: [userRecord("u1", "teach me")] });
			if (url === STREAM_URL) return new Response("data: [DONE]\n\n", { status: 200 });
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;
		const m = model();
		const sending = m.send({ type: "text", text: "teach me" });
		await new Promise((resolve) => setTimeout(resolve, 5));
		m.stop();
		resolvePost();
		await sending;
		assert.equal(postAborted, false, "the submit request carries no teardown signal");
		assert.ok(urls.includes(TURN_URL), "the submit reached the server");
		assert.ok(!urls.some((url) => url.endsWith("/stream")), "a stopped view attaches no stream");
		assert.equal(m.getState().status, "ready");
	});

	it("stopping during a reply keeps the streamed partial and returns to ready", async () => {
		let closeStream!: () => void;
		const encoder = new TextEncoder();
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encoder.encode(sseFrames(assistantStart("part one"))));
				closeStream = () => controller.close();
			},
		});
		globalThis.fetch = turnFetch({ stream: () => new Response(body) });
		const m = model();
		const attaching = m.resumeStream(false);
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.equal(m.status, "streaming");
		m.stop();
		assert.equal(m.status, "ready");
		closeStream();
		await attaching;
		assert.equal(m.status, "ready");
		assert.equal(m.getState().messages.at(-1)!.parts.at(-1)!.text, "part one");
	});

	it("a retried attach replays the turn once, discarding the aborted attempt's partial", async () => {
		let hold!: () => void;
		const holdGate = new Promise<void>((resolve) => {
			hold = resolve;
		});
		let attempts = 0;
		const encoder = new TextEncoder();
		const firstAttempt = () =>
			new Response(
				new ReadableStream<Uint8Array>({
					async start(controller) {
						controller.enqueue(encoder.encode(sseFrames(partialUpdate([{ type: "text", text: "part one" }]))));
						await holdGate;
						controller.enqueue(encoder.encode(sseFrames({ type: "agent_end", messages: [] }, "[DONE]")));
						controller.close();
					},
				}),
				{ headers: { "Content-Type": "text/event-stream" } },
			);
		const secondAttempt = () =>
			new Response(
				new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(
							encoder.encode(
								sseFrames(
									{
										type: "message_start",
										message: { role: "assistant", content: [{ type: "text", text: "part one" }] },
									},
									{ type: "agent_end", messages: [] },
									"[DONE]",
								),
							),
						);
						controller.close();
					},
				}),
				{ headers: { "Content-Type": "text/event-stream" } },
			);
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url !== STREAM_URL) throw new Error(`unexpected fetch: ${url}`);
			attempts += 1;
			return attempts === 1 ? firstAttempt() : secondAttempt();
		}) as Fetch;

		const m = model();
		const attempt1 = m.resumeStream(false);
		await new Promise((resolve) => setTimeout(resolve, 25));
		const attempt2 = m.resumeStream(false);
		hold();
		await Promise.allSettled([attempt1, attempt2]);
		const texts = m
			.getState()
			.messages.flatMap((message) =>
				message.parts.filter((part) => part.type === "text").map((part) => (part as { text?: string }).text),
			);
		assert.deepEqual(texts, ["part one"], "the replayed reply appears exactly once");
	});

	it("a turn-settled frame runs the settle hook and ends ready", async () => {
		let settled = 0;
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === RECORD_URL) return Response.json({ messages: [] });
			if (url === STREAM_URL) return drippedResponse(sseFrames({ type: "turn-settled" }, "[DONE]"), 8);
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;
		const m = model({
			onReattachSettled: () => {
				settled += 1;
			},
		});
		await m.resumeStream();
		assert.equal(settled, 1);
		assert.equal(m.getState().status, "ready");
		assert.equal(m.getState().error, null);
	});

	it("a replayed continuation renders beside the seeded reply as one document", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === RECORD_URL) return Response.json({ messages: [assistantMessage("seed", "the question")] });
			if (url === STREAM_URL)
				return sseResponse(
					assistantStart("the reaction"),
					assistantEnd("the reaction"),
					{ type: "agent_end", messages: [] },
					"[DONE]",
				);
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;
		const m = model({ initialMessages: [assistantMessage("seed", "the question")] });
		await m.resumeStream();
		const view = m.getState().messages;
		assert.equal(view.length, 1, "one continuous assistant document");
		assert.deepEqual(
			view[0]!.parts.map((part) => part.type),
			["step-start", "text", "step-start", "text"],
			"the seeded reply keeps rendering, and the run mounts with a step separator",
		);
	});

	it("a stream split into single bytes still decodes every frame", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === RECORD_URL) return Response.json({ messages: [] });
			if (url === STREAM_URL)
				return drippedResponse(
					sseFrames(
						{ type: "message_start", message: { role: "assistant", content: [] } },
						partialUpdate([{ type: "text", text: "hi" }]),
						assistantEnd("hi"),
					) + sseFrames("[DONE]"),
					1,
				);
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;
		const m = model();
		await m.resumeStream();
		assert.equal(m.getState().messages.at(-1)!.parts.at(-1)!.text, "hi");
	});

	it("an attach the server refuses shows the server's text as the error", async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === RECORD_URL) return Response.json({ messages: [] });
			if (url === STREAM_URL) return new Response("boom", { status: 500 });
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;
		const m = model();
		await m.resumeStream();
		const state = m.getState();
		assert.equal(state.status, "error");
		assert.match(state.error!.message, /boom/);
	});
});
