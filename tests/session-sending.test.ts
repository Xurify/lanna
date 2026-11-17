import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { ChatInput } from "../src/core/input-events.ts";
import { model, partialUpdate, sseResponse, turnFetch, userRecord, type Fetch } from "./helpers/session-wire.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

interface Call {
	url: string;
	body: string | undefined;
}

const TURN_PATH = "/api/chat";
const isTurnProbe = (url: string): boolean => /^\/api\/chats\/[^/]+\/turn$/.test(url);

function installTurnRoutes(routes: {
	post: (call: Call, attempt: number) => Response;
	turnInFlight?: (poll: number) => boolean;
}): Call[] {
	const calls: Call[] = [];
	let polls = 0;
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		calls.push({ url, body: init?.body as string | undefined });
		if (url === TURN_PATH && init?.method === "POST") {
			const attempt = calls.filter((call) => call.url === TURN_PATH).length;
			return routes.post(calls.at(-1)!, attempt);
		}
		if (isTurnProbe(url)) return Response.json({ turnInFlight: routes.turnInFlight?.(++polls) ?? false });
		throw new Error(`unexpected fetch: ${url}`);
	}) as Fetch;
	return calls;
}

describe("the turn request", { skip: process.env.NO_SLOW ? true : undefined }, () => {
	it("the default fetch calls the browser's fetch on the global object", async () => {
		let calledOnGlobal = false;
		globalThis.fetch = function (this: unknown) {
			if (this !== globalThis) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
			calledOnGlobal = true;
			return Promise.resolve(sseResponse("[DONE]"));
		} as typeof fetch;
		const response = await model().postInputEvent({ type: "text", text: "hi" });
		assert.equal(response.status, 200);
		assert.ok(calledOnGlobal);
	});

	it("a reply that is not busy passes through the turn request unchanged", async () => {
		const calls = installTurnRoutes({ post: () => new Response("stream", { status: 200 }) });
		const response = await model({ pollMs: 10, waitMaxMs: 100 }).postInputEvent({ type: "text", text: "hi" });
		assert.equal(response.status, 200);
		assert.equal(calls.length, 1, "no polling and a single request");
		assert.deepEqual(JSON.parse(calls[0]!.body!), { chatId: "chat_x", input: { type: "text", text: "hi" } });
	});

	it("a busy turn is waited out, then the same input is sent again", async () => {
		const event: ChatInput = { type: "text", text: "my question while the wake turn ran" };
		const calls = installTurnRoutes({
			post: (_call, attempt) =>
				attempt === 1 ? new Response("busy", { status: 409 }) : new Response("ok", { status: 200 }),
			turnInFlight: (poll) => poll <= 1,
		});
		const response = await model({ pollMs: 10, waitMaxMs: 100 }).postInputEvent(event);
		assert.equal(response.status, 200);
		const posts = calls.filter((call) => call.url === TURN_PATH);
		assert.equal(posts.length, 2, "one busy answer, one retry");
		assert.equal(posts[1]!.body, posts[0]!.body, "the request body is byte-identical");
	});

	it("the retry reads no record: the input is the only payload", async () => {
		const calls = installTurnRoutes({
			post: (_call, attempt) =>
				attempt === 1 ? new Response("busy", { status: 409 }) : new Response("ok", { status: 200 }),
		});
		assert.equal((await model({ pollMs: 10, waitMaxMs: 100 }).postInputEvent({ type: "text", text: "q" })).status, 200);
		const recordReads = calls.filter((call) => call.url.startsWith("/api/chats/") && !isTurnProbe(call.url));
		assert.equal(recordReads.length, 0);
	});

	it("repeated busy answers are retried with the same input each time", async () => {
		const event: ChatInput = { type: "text", text: "try again" };
		const calls = installTurnRoutes({
			post: (_call, attempt) =>
				attempt <= 2 ? new Response("busy", { status: 409 }) : new Response("ok", { status: 200 }),
		});
		assert.equal((await model({ pollMs: 10, waitMaxMs: 100 }).postInputEvent(event)).status, 200);
		const posts = calls.filter((call) => call.url === TURN_PATH);
		assert.equal(posts.length, 3);
		assert.ok(
			posts.every((call) => call.body === posts[0]!.body),
			"every attempt carries the same input",
		);
	});

	it("the turn request gives up at its deadline and returns the last busy answer", async () => {
		const calls = installTurnRoutes({
			post: () => new Response("busy", { status: 409 }),
			turnInFlight: () => true,
		});
		const response = await model({ pollMs: 10, waitMaxMs: 100 }).postInputEvent({ type: "text", text: "q" });
		assert.equal(response.status, 409);
		const polls = calls.filter((call) => isTurnProbe(call.url)).length;
		assert.ok(polls <= 15, `polling stays within the deadline, got ${polls} probes`);
	});
});

describe("sending a message", () => {
	it("a sent message shows at once, is posted as one input, and settles with the streamed reply", async () => {
		const posts: string[] = [];
		globalThis.fetch = turnFetch({
			onPost: (body) => posts.push(body),
			userText: "my topic",
			stream: () =>
				sseResponse(
					{ type: "agent_start" },
					{ type: "message_start", message: { role: "assistant", content: [] } },
					partialUpdate([{ type: "text", text: "hello there" }]),
					{
						type: "message_end",
						message: { role: "assistant", content: [{ type: "text", text: "hello there" }], stopReason: "stop" },
					},
					{ type: "agent_end", messages: [] },
					"[DONE]",
				),
		});

		const m = model();
		const sending = m.send({ type: "text", text: "my topic" });
		assert.equal(m.getState().status, "submitted");
		assert.match((m.getState().nativeMessages.at(-1) as { id?: string }).id ?? "", /^c_/);
		assert.equal(m.getState().messages.at(-1)!.parts[0]!.text, "my topic");
		await sending;
		assert.deepEqual(JSON.parse(posts[0]!), { chatId: "chat_x", input: { type: "text", text: "my topic" } });
		assert.equal(m.getState().status, "ready");
		const view = m.getState().messages;
		assert.equal(view.at(-1)!.role, "assistant");
		assert.equal(view.at(-1)!.parts.at(-1)!.text, "hello there");
	});

	it("a reply streamed in chunks grows in one message, never one message per chunk", async () => {
		let push: (event: unknown) => void = () => {};
		const encoder = new TextEncoder();
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				push = (event) =>
					controller.enqueue(
						encoder.encode(event === "[DONE]" ? "data: [DONE]\n\n" : `data: ${JSON.stringify(event)}\n\n`),
					);
			},
		});
		globalThis.fetch = turnFetch({ userText: "go", stream: () => new Response(body, { status: 200 }) });
		const m = model();
		const sending = m.send({ type: "text", text: "go" });
		const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

		push({ type: "message_start", message: { role: "assistant", content: [{ type: "thinking", thinking: "hmm" }] } });
		for (const text of ["Hel", "Hello", "Hello wor", "Hello world"]) {
			push(
				partialUpdate([
					{ type: "thinking", thinking: "hmm" },
					{ type: "text", text },
				]),
			);
			await settle();
		}
		const assistantsMid = m.getState().nativeMessages.filter((entry) => entry.role === "assistant");
		assert.equal(assistantsMid.length, 1, "one streaming message, replaced in place");
		assert.equal(
			m
				.getState()
				.messages.at(-1)!
				.parts.filter((part) => part.type === "text").length,
			1,
		);
		assert.equal(m.getState().messages.at(-1)!.parts.at(-1)!.text, "Hello world");
		const slotId = (assistantsMid[0] as { id?: string }).id;
		assert.match(slotId ?? "", /^c_/, "the slot has a client id");

		push({
			type: "message_end",
			message: {
				role: "assistant",
				content: [
					{ type: "thinking", thinking: "hmm" },
					{ type: "text", text: "Hello world" },
				],
				stopReason: "stop",
			},
		});
		push({ type: "agent_end", messages: [] });
		push("[DONE]");
		await sending;
		const assistantsFinal = m.getState().nativeMessages.filter((entry) => entry.role === "assistant");
		assert.equal(assistantsFinal.length, 1);
		assert.equal((assistantsFinal[0] as { id?: string }).id, slotId, "the same slot through message_end");
	});

	it("a send shows its placeholder before the server answers anything", async () => {
		let release!: (response: Response) => void;
		const answer = new Promise<Response>((resolve) => {
			release = resolve;
		});
		globalThis.fetch = turnFetch({ stream: () => sseResponse("[DONE]"), post: () => answer });
		const m = model();
		const sending = m.send({ type: "text", text: "q" });
		assert.equal(m.getState().status, "submitted", "the placeholder is up before the first answer");
		assert.equal(m.getState().messages.at(-1)!.role, "user", "the optimistic bubble is up");
		release(Response.json({ ok: true }));
		await sending;
		assert.equal(m.status, "ready");
	});

	it("a send while a turn runs is ignored", async () => {
		const posts: string[] = [];
		let release!: (response: Response) => void;
		const answer = new Promise<Response>((resolve) => {
			release = resolve;
		});
		globalThis.fetch = turnFetch({
			stream: () => sseResponse("[DONE]"),
			post: () => answer,
			onPost: (body) => posts.push(body),
		});
		const m = model();
		const first = m.send({ type: "text", text: "first" });
		await m.send({ type: "text", text: "second" });
		assert.equal(posts.length, 1, "only the first send reaches the server");
		const learnerBubbles = m.getState().nativeMessages.filter((entry) => entry.role === "user");
		assert.deepEqual(
			learnerBubbles.map((entry) => entry.content),
			["first"],
		);
		release(Response.json({ ok: true }));
		await first;
	});

	it("a refused send shows the server's refusal text exactly", async () => {
		const refusal = JSON.stringify({ code: "models_not_configured", missing: ["strong"] });
		globalThis.fetch = (async () => new Response(refusal, { status: 503 })) as Fetch;
		const m = model();
		await m.send({ type: "text", text: "q" });
		const state = m.getState();
		assert.equal(state.status, "error");
		assert.equal(state.error!.message, refusal, "the banner carries the raw envelope, for the refusal flow to parse");
	});

	it("a steer that arrives mid-run is shown once, keyed by its id", () => {
		const m = model({ fetch: () => new Promise<Response>(() => {}) });
		m.adoptRecord([userRecord("u1", "hello")]);
		void m.send({ type: "text", text: "hello" });

		const steer = { id: "steer_live_1", role: "user", content: "also cover Venus", timestamp: 2 };
		m.applyWireEvent({ type: "message_start", message: steer });
		m.applyWireEvent({ type: "message_end", message: steer });

		const state = m.getState();
		assert.ok(state.messages.length >= 2, "the steer produced a view message");
		const tail = state.messages.at(-1)!;
		assert.equal(tail.role, "user", "a steer projects as a user-role view message");
		assert.match(JSON.stringify(tail.parts), /also cover Venus/);

		m.applyWireEvent({ type: "message_end", message: steer });
		assert.equal(m.getState().messages.length, state.messages.length, "the same id upserts, never appends a copy");
	});

	it("a provider error shows its own text, and the session is ready again", async () => {
		globalThis.fetch = turnFetch({
			userText: "q",
			stream: () =>
				sseResponse(
					partialUpdate([{ type: "text", text: "" }]),
					{
						type: "message_end",
						message: {
							role: "assistant",
							content: [{ type: "text", text: "" }],
							stopReason: "error",
							errorMessage: "OpenRouter 429: rate limited",
						},
					},
					{ type: "agent_end", messages: [] },
					"[DONE]",
				),
		});
		const m = model();
		await m.send({ type: "text", text: "q" });
		assert.equal(m.getState().status, "ready");
		assert.equal(m.getState().error!.message, "OpenRouter 429: rate limited");
	});
});
