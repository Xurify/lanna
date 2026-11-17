import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { CHAT_ID, model, sseResponse, turnFetch, type Fetch } from "./helpers/session-wire.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const CONNECTION_DROPPED = "The connection dropped before the turn completed.";
const RECORD_URL = `/api/chats/${CHAT_ID}`;
const STREAM_URL = `${RECORD_URL}/stream`;
const TURN_URL = "/api/chat";

const truncated = () =>
	sseResponse({ type: "message_start", message: { role: "assistant", content: [{ type: "text", text: "partial" }] } });

const completed = () =>
	sseResponse(
		{ type: "message_start", message: { role: "assistant", content: [{ type: "text", text: "complete" }] } },
		{
			type: "message_end",
			message: { role: "assistant", content: [{ type: "text", text: "complete" }], stopReason: "stop" },
		},
		"[DONE]",
	);

const brokenBody = (error: Error) =>
	new Response(
		new ReadableStream({
			start(controller) {
				controller.error(error);
			},
		}),
	);

describe("recovering a stream that was cut off", () => {
	it("a stream cut off before its end reattaches once and replaces the partial replay", async () => {
		let streams = 0;
		const m = model({
			fetch: turnFetch({ userText: "go", stream: () => (++streams === 1 ? truncated() : completed()) }),
		});
		await m.send({ type: "text", text: "go" });
		assert.equal(streams, 2);
		assert.equal(m.status, "ready");
		assert.equal(m.getState().error, null);
		assert.equal(m.getState().nativeMessages.filter((entry) => entry.role === "assistant").length, 1);
		assert.equal(m.getState().messages.at(-1)!.parts.at(-1)!.text, "complete");
	});

	it("a second cut-off shows the connection message without resending the input", async () => {
		let streams = 0;
		let posts = 0;
		const m = model({
			fetch: turnFetch({
				stream: () => {
					streams += 1;
					return truncated();
				},
				onPost: () => {
					posts += 1;
				},
			}),
		});
		await m.send({ type: "text", text: "go" });
		assert.equal(posts, 1);
		assert.equal(streams, 2);
		assert.equal(m.status, "error");
		assert.equal(m.getState().error?.message, CONNECTION_DROPPED);
	});

	it("a failed record read during recovery shows the connection message", async () => {
		let records = 0;
		const m = model({
			fetch: (async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === TURN_URL) return Response.json({ ok: true });
				if (url === STREAM_URL) return truncated();
				if (url === RECORD_URL) {
					records += 1;
					if (records === 1) return Response.json({ messages: [] });
					throw new TypeError("synthetic offline");
				}
				throw new Error(`unexpected fetch: ${url}`);
			}) as Fetch,
		});
		await m.send({ type: "text", text: "go" });
		assert.equal(m.status, "error");
		assert.equal(m.getState().error?.message, CONNECTION_DROPPED);
	});

	it("a turn that settled during the disconnect ends without an error", async () => {
		let streams = 0;
		let settled = 0;
		const m = model({
			onReattachSettled: () => {
				settled += 1;
			},
			fetch: turnFetch({
				stream: () => (++streams === 1 ? truncated() : sseResponse({ type: "turn-settled" }, "[DONE]")),
			}),
		});
		await m.send({ type: "text", text: "go" });
		assert.equal(streams, 2);
		assert.equal(settled, 1);
		assert.equal(m.status, "ready");
		assert.equal(m.getState().error, null);
	});

	it("a broken body read is recovered, but an application error is not reported as a drop", async () => {
		let streams = 0;
		const recovering = model({
			fetch: turnFetch({
				stream: () => (++streams === 1 ? brokenBody(new TypeError("synthetic read failure")) : completed()),
			}),
		});
		await recovering.send({ type: "text", text: "go" });
		assert.equal(streams, 2);
		assert.equal(recovering.status, "ready");

		let applied = 0;
		const failing = model({
			fetch: turnFetch({
				stream: () => {
					applied += 1;
					return completed();
				},
			}),
		});
		failing.applyWireEvent = () => {
			throw new Error("synthetic event application failure");
		};
		await failing.send({ type: "text", text: "go" });
		assert.equal(applied, 1, "an application error is not retried");
		assert.equal(failing.getState().error?.message, "synthetic event application failure");
	});

	it("an abort-shaped body failure is recovered unless the view was cancelled", async () => {
		let streams = 0;
		const m = model({
			fetch: turnFetch({
				stream: () =>
					++streams === 1 ? brokenBody(new DOMException("synthetic unexpected read abort", "AbortError")) : completed(),
			}),
		});
		await m.send({ type: "text", text: "go" });
		assert.equal(streams, 2);
		assert.equal(m.status, "ready");
		assert.equal(m.getState().error, null);
	});

	it("a failed record body during recovery shows the connection message", async () => {
		let records = 0;
		const m = model({
			fetch: (async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url === TURN_URL) return Response.json({ ok: true });
				if (url === STREAM_URL) return truncated();
				if (url === RECORD_URL) {
					records += 1;
					if (records === 1) return Response.json({ messages: [] });
					return brokenBody(new TypeError("synthetic record-body transport failure"));
				}
				throw new Error(`unexpected fetch: ${url}`);
			}) as Fetch,
		});
		await m.send({ type: "text", text: "go" });
		assert.equal(m.status, "error");
		assert.equal(m.getState().error?.message, CONNECTION_DROPPED);
	});

	it("a malformed frame shows the parser's diagnostic, not a connection message", async () => {
		let streams = 0;
		const m = model({
			fetch: turnFetch({
				stream: () => {
					streams += 1;
					return new Response("data: {broken}\n\n");
				},
			}),
		});
		await m.send({ type: "text", text: "go" });
		assert.equal(streams, 1, "a malformed frame is not retried");
		assert.equal(m.status, "error");
		assert.notEqual(m.getState().error?.message, CONNECTION_DROPPED);
		assert.match(m.getState().error!.message, /JSON|property name/);
	});

	it("a refused recovery attach shows the connection message and makes no third attempt", async () => {
		let streams = 0;
		const m = model({
			fetch: turnFetch({
				stream: () => {
					streams += 1;
					return streams === 1 ? truncated() : new Response("synthetic unavailable", { status: 503 });
				},
			}),
		});
		await m.send({ type: "text", text: "go" });
		assert.equal(streams, 2);
		assert.equal(m.status, "error");
		assert.equal(m.getState().error?.message, CONNECTION_DROPPED);
	});

	it("an older superseded stream cannot recover or overwrite its replacement", async () => {
		let streams = 0;
		let closeFirst!: () => void;
		let beganReading!: () => void;
		const reading = new Promise<void>((resolve) => {
			beganReading = resolve;
		});
		const m = model({
			fetch: turnFetch({
				stream: () => {
					streams += 1;
					if (streams > 1) return completed();
					return new Response(
						new ReadableStream(
							{
								start(controller) {
									closeFirst = () => controller.close();
								},
								pull() {
									beganReading();
								},
							},
							{ highWaterMark: 0 },
						),
					);
				},
			}),
		});
		const first = m.resumeStream(false);
		await reading;
		await m.resumeStream(false);
		closeFirst();
		await first;
		assert.equal(streams, 2);
		assert.equal(m.status, "ready");
		assert.equal(m.getState().error, null);
		assert.equal(m.getState().messages.at(-1)!.parts.at(-1)!.text, "complete");
	});
});
