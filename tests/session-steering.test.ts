import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { visibleQueuedSteers } from "../components/session-core.ts";
import type { LannaMessage } from "../src/core/chat-messages.ts";
import { CHAT_ID, model, partialUpdate, sseFrames, sseResponse, type Fetch } from "./helpers/session-wire.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const TURN_URL = "/api/chat";
const RECORD_URL = `/api/chats/${CHAT_ID}`;
const STREAM_URL = `${RECORD_URL}/stream`;
const STEER_URL = `${RECORD_URL}/steer`;
const DISMISS_URL = `${RECORD_URL}/dismiss`;

function bodyOf(init: RequestInit | undefined): unknown {
	return JSON.parse(String(init?.body));
}

function openStream(): { response: Response; close: () => void; push: (frames: string) => void } {
	const encoder = new TextEncoder();
	let controllerRef!: ReadableStreamDefaultController<Uint8Array>;
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			controllerRef = controller;
		},
	});
	return {
		response: new Response(body),
		push: (frames) => controllerRef.enqueue(encoder.encode(frames)),
		close: () => controllerRef.close(),
	};
}

describe("steering a reply that is running", () => {
	it("a steer sent during a reply waits in the queue until its message lands", async () => {
		const stream = openStream();
		stream.push(sseFrames(partialUpdate([{ type: "text", text: "working" }])));
		const steerBodies: unknown[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === STEER_URL) {
				steerBodies.push(bodyOf(init));
				return Response.json({ ok: true });
			}
			if (url === STREAM_URL) return stream.response;
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;

		const m = model();
		const attaching = m.resumeStream(false);
		await new Promise((resolve) => setTimeout(resolve, 10));
		await m.steer("  also cover Venus  ");

		const [queued] = m.getState().steerQueue;
		assert.equal(queued!.text, "also cover Venus", "the steer is trimmed and queued");
		assert.deepEqual(
			visibleQueuedSteers(m.getState().steerQueue, m.getState().nativeMessages).map((item) => item.text),
			["also cover Venus"],
		);
		assert.deepEqual(steerBodies, [{ input: { type: "steer", id: queued!.id, text: "also cover Venus" } }]);

		const landed = { id: queued!.id, role: "user", content: "also cover Venus", timestamp: 3 } as LannaMessage;
		m.applyWireEvent({ type: "message_end", message: landed });
		assert.deepEqual(visibleQueuedSteers(m.getState().steerQueue, m.getState().nativeMessages), []);

		stream.close();
		await attaching;
	});

	it("a blank steer is not sent", async () => {
		let calls = 0;
		globalThis.fetch = (async () => {
			calls += 1;
			return Response.json({ ok: true });
		}) as Fetch;
		const m = model();
		await m.steer("   ");
		assert.equal(calls, 0);
		assert.deepEqual(m.getState().steerQueue, []);
	});

	it("a steer the server refuses as settled is sent as an ordinary message", async () => {
		const posts: unknown[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === STEER_URL) return new Response("settled", { status: 409 });
			if (url === TURN_URL) {
				posts.push(bodyOf(init));
				return Response.json({ ok: true });
			}
			if (url === RECORD_URL) return Response.json({ messages: [] });
			if (url === STREAM_URL) return sseResponse("[DONE]");
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;
		const m = model();
		await m.steer("plain words");
		assert.deepEqual(posts, [{ chatId: CHAT_ID, input: { type: "text", text: "plain words" } }]);
		assert.deepEqual(m.getState().steerQueue, []);
		assert.equal(m.status, "ready");
	});

	it("a steer the server refuses for another reason leaves the queue and shows the refusal", async () => {
		globalThis.fetch = (async () => new Response("steer refused", { status: 500 })) as Fetch;
		const m = model();
		await m.steer("hello");
		assert.deepEqual(m.getState().steerQueue, []);
		assert.equal(m.getState().error?.message, "steer refused");
	});
});

describe("dismissing a practice problem", () => {
	it("a practice problem dismissal shows at once and reaches the server", async () => {
		const dismissals: unknown[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === DISMISS_URL) {
				dismissals.push(bodyOf(init));
				return Response.json({ ok: true });
			}
			throw new Error(`unexpected fetch: ${url}`);
		}) as Fetch;
		const m = model();
		const dismissing = m.dismissProblem("call-1");
		assert.ok(
			m.getState().nativeMessages.some((entry) => entry.role === "custom" && entry.customType === "problem-dismissed"),
			"the dismissal marker is shown before the server answers",
		);
		await dismissing;
		assert.deepEqual(dismissals, [{ input: { type: "dismiss-problem", problemCallId: "call-1" } }]);
		assert.equal(m.getState().error, null);
	});

	it("a failed dismissal shows its error", async () => {
		globalThis.fetch = (async () => new Response("no", { status: 500 })) as Fetch;
		const m = model();
		await m.dismissProblem("call-1");
		assert.equal(m.getState().error?.message, "The dismissal failed (500).");
	});

	it("a dismissal is ignored while a turn runs", async () => {
		let calls = 0;
		globalThis.fetch = (async () => {
			calls += 1;
			return new Promise<Response>(() => {});
		}) as Fetch;
		const m = model();
		void m.send({ type: "text", text: "busy" });
		await m.dismissProblem("call-1");
		assert.equal(calls, 1, "only the send reaches the server");
		assert.equal(
			m.getState().nativeMessages.some((entry) => entry.role === "custom"),
			false,
			"no dismissal marker is added during a turn",
		);
	});
});
