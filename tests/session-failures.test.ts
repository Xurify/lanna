import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { newCompactionMarker } from "../src/core/index.ts";
import { newThinkingMessage, newUserMessage, type LannaMessage } from "../src/core/chat-messages.ts";
import {
	assistantMessage,
	assistantWithCall,
	failedAssistant,
	model,
	resultMessage,
	sseFrames,
	sseResponse,
} from "./helpers/session-wire.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = realFetch;
});

const FIXTURE_FAILURE = "Google 500: fixture failure";

describe("a failed reply", () => {
	it("a failed reply saved in the record shows its error on load and on sync, without a transcript card", () => {
		const record = [newUserMessage("topic"), failedAssistant()];
		const m = model({ initialMessages: record });
		assert.equal(m.getState().error?.message, FIXTURE_FAILURE);
		assert.equal(m.getState().status, "ready");
		assert.equal(m.readyRef, true, "a restored failure does not block a retry");
		assert.deepEqual(m.getState().nativeMessages, record, "the saved history stays intact");
		assert.equal(m.getState().messages.length, 1, "only the user bubble, no permanent error card");

		const synced = model();
		synced.setMessages(record);
		assert.equal(synced.getState().error?.message, m.getState().error?.message);

		const adopted = model({ initialMessages: record.slice(0, 1) });
		adopted.adoptRecord(record);
		assert.equal(adopted.getState().error?.message, m.getState().error?.message);
	});

	it("a saved failure without error text shows the default wording", () => {
		const withoutText = { ...failedAssistant(), errorMessage: undefined } as LannaMessage;
		assert.equal(model({ initialMessages: [withoutText] }).getState().error?.message, "An error occurred.");
		assert.equal(model().getState().error, null);
	});

	it("any later entry supersedes a saved failure, including compaction markers and aborted replies", () => {
		const failure = failedAssistant();
		const laterEntries: LannaMessage[] = [
			newUserMessage("retry"),
			assistantMessage("success", "Hello"),
			{ ...assistantMessage("aborted", ""), stopReason: "aborted", errorMessage: "Aborted" } as LannaMessage,
			newThinkingMessage("problem", "my attempt"),
			resultMessage("call"),
			newCompactionMarker("summary", {
				firstKeptMessageId: failure.id,
				tokensBefore: 100,
				model: "fixture",
				at: "2026-01-01T00:00:00Z",
			}),
		];
		for (const entry of laterEntries) {
			const m = model({ initialMessages: [failure] });
			m.applyWireEvent({ type: "message_end", message: failure });
			assert.ok(m.getState().error, "the live failure is visible first");
			m.setMessages([failure, entry]);
			assert.equal(m.getState().error, null, `superseded by a ${entry.role} entry`);
			assert.equal(model({ initialMessages: [failure, entry] }).getState().error, null, "a reopened view agrees");
		}
	});

	it("a newer live message clears a failure before its reply finishes", () => {
		const m = model();
		m.applyWireEvent({ type: "message_end", message: failedAssistant() });
		assert.ok(m.getState().error);
		m.applyWireEvent({ type: "message_start", message: assistantMessage("next", "") });
		assert.equal(m.getState().error, null);
		m.applyWireEvent({ type: "message_end", message: assistantMessage("next", "Hello") });
		assert.equal(m.getState().error, null);
	});

	it("an unfinished reply's error-shaped partial is not a failure until it finishes", () => {
		const m = model();
		const failure = failedAssistant();
		m.applyWireEvent({ type: "message_start", message: failure });
		assert.equal(m.getState().error, null);
		m.applyWireEvent({ type: "message_update", message: failure });
		assert.equal(m.getState().error, null);
		m.applyWireEvent({ type: "message_end", message: failure });
		assert.equal(m.getState().error?.message, FIXTURE_FAILURE);
	});

	for (const input of [{ type: "text", text: "retry" }, { type: "continue" }] as const) {
		it(`a ${input.type} send hides the previous failure while it waits, then shows a new live failure`, async () => {
			let acknowledge!: (response: Response) => void;
			const acknowledgement = new Promise<Response>((resolve) => {
				acknowledge = resolve;
			});
			const previous = failedAssistant("old", "old failure");
			const fresh = failedAssistant("fresh", "new failure");
			let finish!: () => void;
			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					finish = () => {
						controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
						controller.close();
					};
				},
			});
			const m = model({
				initialMessages: [previous],
				fetch: async (url) => {
					if (url === "/api/chat") return acknowledgement;
					if (url === "/api/chats/chat_x") return Response.json({ messages: [previous] });
					if (url === "/api/chats/chat_x/stream") return new Response(stream);
					throw new Error(`unexpected fetch: ${url}`);
				},
			});
			assert.equal(m.getState().error?.message, "old failure");
			const sending = m.send(input);
			assert.equal(m.getState().status, "submitted");
			assert.equal(m.getState().error, null, "hidden even before the acknowledgement");
			acknowledge(Response.json({ ok: true }));
			await new Promise((resolve) => setTimeout(resolve, 0));
			assert.equal(m.getState().error, null, "refetching the old failed record does not bring it back");
			m.applyWireEvent({ type: "message_start", message: fresh });
			assert.equal(m.getState().error, null, "an unfinished partial is not an error");
			m.applyWireEvent({ type: "message_end", message: fresh });
			assert.equal(m.getState().status, "submitted");
			assert.equal(m.getState().error?.message, "new failure", "the new failure shows before the stream closes");
			finish();
			await sending;
			assert.equal(m.getState().error?.message, "new failure");
		});
	}

	it("a fresh reattach hides a saved failure, which returns when the turn settles idle", async () => {
		let settle!: (response: Response) => void;
		const response = new Promise<Response>((resolve) => {
			settle = resolve;
		});
		const m = model({ initialMessages: [failedAssistant()], fetch: async () => response });
		const attaching = m.resumeStream(false);
		assert.equal(m.getState().status, "submitted");
		assert.equal(m.getState().error, null);
		settle(sseResponse({ type: "turn-settled" }, "[DONE]"));
		await attaching;
		assert.equal(m.getState().error?.message, FIXTURE_FAILURE, "no newer entry superseded it");
	});

	it("a failure that settled before the stream attached is recovered from the record", async () => {
		const record = [newUserMessage("topic"), failedAssistant()];
		const m = model({
			fetch: async (url) => {
				if (url === "/api/chat") return Response.json({ ok: true });
				if (url === "/api/chats/chat_x") return Response.json({ messages: record });
				if (url === "/api/chats/chat_x/stream") return sseResponse({ type: "turn-settled" }, "[DONE]");
				throw new Error(`unexpected fetch: ${url}`);
			},
		});
		m.setReattachSettled(() => m.setMessages(record));
		await m.send({ type: "text", text: "topic" });
		assert.equal(m.getState().status, "ready");
		assert.equal(m.getState().error?.message, FIXTURE_FAILURE);
	});

	it("a newer live failure replaces an earlier attach error immediately", async () => {
		let attempts = 0;
		const seen: Array<{ status: string; error: string | undefined }> = [];
		const m = model({
			fetch: async () => {
				attempts += 1;
				if (attempts === 1) return new Response("earlier attach failure", { status: 500 });
				return sseResponse(
					{ type: "message_start", message: failedAssistant("new", "new provider failure") },
					{ type: "message_end", message: failedAssistant("new", "new provider failure") },
					"[DONE]",
				);
			},
		});
		await m.resumeStream(false);
		assert.equal(m.getState().error?.message, "earlier attach failure");
		m.onChange = () => {
			seen.push({ status: m.status, error: m.getState().error?.message });
		};
		await m.resumeStream(false);
		assert.ok(
			seen.some((entry) => entry.status === "streaming" && entry.error === "new provider failure"),
			"the new failure shows before the stream closes",
		);
		assert.equal(m.getState().error?.message, "new provider failure");
		assert.equal(
			model({ initialMessages: m.getState().nativeMessages }).getState().error?.message,
			"new provider failure",
			"the live and reopened views agree",
		);
	});

	it("an aborted older attempt cannot restore the old failure during a replacement attempt", async () => {
		let attempts = 0;
		let firstRead!: () => void;
		const reading = new Promise<void>((resolve) => {
			firstRead = resolve;
		});
		let settleReplacement!: (response: Response) => void;
		const replacement = new Promise<Response>((resolve) => {
			settleReplacement = resolve;
		});
		const m = model({
			initialMessages: [failedAssistant()],
			fetch: async (_url, init) => {
				attempts += 1;
				if (attempts > 1) return replacement;
				return new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(new TextEncoder().encode(sseFrames({ type: "agent_start" })));
							init?.signal?.addEventListener(
								"abort",
								() => controller.error(new DOMException("Aborted", "AbortError")),
								{
									once: true,
								},
							);
						},
						pull() {
							firstRead();
						},
					}),
				);
			},
		});
		const first = m.resumeStream(false);
		await reading;
		const second = m.resumeStream(false);
		await first;
		assert.equal(m.getState().status, "submitted", "the old attempt's cleanup does not settle the replacement");
		assert.equal(m.getState().error, null, "the old saved failure stays hidden during the replacement's wait");
		settleReplacement(
			sseResponse(
				{ type: "message_start", message: failedAssistant("new", "replacement failure") },
				{ type: "message_end", message: failedAssistant("new", "replacement failure") },
				"[DONE]",
			),
		);
		await second;
		assert.equal(m.getState().error?.message, "replacement failure");
	});

	it("loop and request errors are transient, clear on demand, and never become saved messages", async () => {
		const m = model({ initialMessages: [failedAssistant()] });
		m.applyWireEvent({ type: "error", errorText: "loop failure" });
		assert.equal(m.getState().error?.message, "loop failure");
		assert.equal(model({ initialMessages: m.getState().nativeMessages }).getState().error?.message, FIXTURE_FAILURE);
		m.clearError();
		assert.equal(m.getState().error?.message, FIXTURE_FAILURE);
		m.fetch = async () => new Response("request refused", { status: 500 });
		await m.send({ type: "text", text: "retry" });
		assert.equal(m.getState().error?.message, "request refused");
		assert.equal(
			model({ initialMessages: m.getState().nativeMessages }).getState().error,
			null,
			"request errors are not written into the saved messages",
		);
		m.clearError();
		assert.equal(m.getState().error, null);
	});

	it("a new server turn clears a retained notice without releasing the placeholder", () => {
		const answered = [assistantWithCall("dispatch", "r1", "research"), resultMessage("r1", "research")];
		const m = model({ initialMessages: answered, initialError: "The reply could not be saved." });
		assert.equal(m.getState().error?.message, "The reply could not be saved.");
		assert.equal(m.applyWireEvent({ type: "agent_start" }), false);
		assert.equal(m.getState().error, null, "the new turn's evidence replaces the old notice");
	});
});
