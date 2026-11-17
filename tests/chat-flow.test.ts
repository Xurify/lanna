/**
 * Scripted integration test — the chat loop with zero tokens:
 *
 *   learner sends a message → faux model replies and commits a question with
 *   `pose` → server streams + persists → the next message continues the chat.
 *
 * Drives handleChatRequest directly (plain Request/Response — no Next server
 * needed) with a scripted pi engine (pi-ai's faux provider). POSTs carry ONE
 * INPUT EVENT (never a client transcript), and the record is pi-native agent
 * history (read through the projection where a part shape is pinned).
 */

import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import {
	createFauxCore,
	fauxAssistantMessage,
	fauxText,
	fauxThinking,
	fauxToolCall,
	type FauxResponseStep,
} from "@earendil-works/pi-ai";
import { createChatAgent } from "../src/agent/teacher-agent.ts";
import { handleChatRequest } from "../src/server/turn/request.ts";
import { effectiveSettings } from "../src/server/stores.ts";
import { isTurnRunning } from "../src/server/turn/liveness.ts";
import { registerLiveAgent, steerLiveChat, unregisterLiveAgent } from "../src/server/steers.ts";
import { SessionModel } from "../components/session-core.ts";
import { abortTurn, runningTurn, settledTurnResponse } from "../src/server/turn/registry.ts";
import { chatStore } from "../src/store/chats.ts";
import { newUserMessage } from "../src/core/chat-messages.ts";
import { projectView } from "../src/core/view.ts";
import type { PiEngine } from "../src/agent/models.ts";
import type { LannaMessage } from "../src/core/chat-messages.ts";

// Route-level pins (the chat-birth-stamp pattern): the route handlers,
// driven directly. Env is the runner's (the same the static store imports
// already resolved under).
const steerRoute = await import("../app/api/chats/[id]/steer/route.ts");
const streamRoute = await import("../app/api/chats/[id]/stream/route.ts");
const recordRoute = await import("../app/api/chats/[id]/route.ts");
import { PATHS } from "../config.ts";

// The key-presence turn gate (provider-key interlude, 2026-09-25): scripted
// turns pin openrouter per chat — the gate reads env-first truth, so the
// key must be present in the test process like any real setup.
process.env.OPENROUTER_API_KEY ??= "test-key-presence-gate";

const POSE_INPUT = {
	answer: "Mercury",
	focus: "the planet closest to the sun",
};

/** Turn 1: a reply that commits its question with `pose` (the call closes the
 *  reply). Turn 2: plain text. Each response factory records the prompt it
 *  received (the transcript the model saw) — the old doStream capture,
 *  engine-shaped. */
function defaultLesson(calls: string[][]): FauxResponseStep[] {
	return [
		(context) => {
			calls.push(context.messages.map((m) => JSON.stringify((m as { content: unknown }).content)));
			return fauxAssistantMessage(
				[
					fauxThinking("Ask about the basics first."),
					fauxText("Which planet is closest to the sun?"),
					fauxToolCall("pose", POSE_INPUT, { id: "call-1" }),
				],
				{ stopReason: "toolUse" },
			);
		},
		(context) => {
			calls.push(context.messages.map((m) => JSON.stringify((m as { content: unknown }).content)));
			return fauxAssistantMessage([fauxText("Right — Mercury it is.")]);
		},
	];
}

/** A scripted pi engine: the response steps replace the model; `calls`
 *  collects what each step saw. */
function scriptedTeacher(steps: (calls: string[][]) => FauxResponseStep[]): {
	engine: PiEngine;
	calls: string[][];
} {
	const calls: string[][] = [];
	const faux = createFauxCore({});
	faux.setResponses(steps(calls));
	return { engine: { model: faux.getModel(), streamFn: faux.streamSimple }, calls };
}

/** The handler seam (stateless per turn): each request builds a fresh agent
 *  off the record it is about to run — the factory tests inject. Wave B: the
 *  handler hands the factory the NATIVE build options (the record IS the
 *  agent state — no adapter conversion). */
function agentFactory(engine: PiEngine): Parameters<typeof handleChatRequest>[1] {
	return (opts) => createChatAgent({}, { engine, messages: opts.messages });
}

/** Parse an SSE body into its wire events (verbatim pi AgentEvents +
 *  the app-level error/turn-settled terminals). Structural beats substring:
 *  key order never matters. */
function eventsOf(body: string): Array<Record<string, any>> {
	const out: Array<Record<string, any>> = [];
	for (const line of body.split("\n")) {
		if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
		out.push(JSON.parse(line.slice(6)));
	}
	return out;
}

async function drain(res: Response): Promise<string> {
	if (res.status !== 200) {
		assert.fail(`expected 200, got ${res.status}: ${await res.text()}`);
	}
	return res.text(); // consumes the SSE stream to completion (fires onFinish)
}

/** CONNECTION DIET B (owner, 2026-10-10 — parallel-session freeze postmortem):
 *  POST /api/chat no longer streams the turn — it acks and closes, and the
 *  submitter (like every view) attaches via the reattach stream. This
 *  mirrors drain(): assert the 200 ack, then drain the turn's SSE body to
 *  completion through runningTurn + subscribe — the same wire the GET
 *  route serves. Subscribe IMMEDIATELY after the ack: faux turns settle in
 *  microtask rounds, and the handle leaves the registry at settle. */
async function drainTurn(req: Request, factory: Parameters<typeof handleChatRequest>[1]): Promise<string> {
	const cloned = req.clone();
	const ack = await handleChatRequest(req, factory);
	if (ack.status !== 200) {
		assert.fail(`expected 200 ack, got ${ack.status}: ${await ack.text()}`);
	}
	const { chatId } = (await cloned.json()) as { chatId: string };
	const handle = runningTurn(chatId);
	if (!handle)
		// A short turn (a quick reply) can settle INSIDE the
		// handler's trailing awaits — the registry is already clear. There is
		// nothing to drain: completion happened. (Body-reading callers get "" —
		// their eventsOf asserts then fail loudly if this ever bites a long
		// turn, which is the honest outcome for a lost wire.)
		return "";
	return new Response(handle.subscribe()).text();
}

/** Drain a RUNNING turn's wire when the POST already happened (the ack
 *  path left nothing to consume — CONNECTION DIET B). Subscribe immediately:
 *  faux turns settle in microtask rounds. */
async function drainRunning(chatId: string): Promise<string> {
	const handle = runningTurn(chatId);
	if (!handle) assert.fail(`no running turn to drain: ${chatId}`);
	return new Response(handle.subscribe()).text();
}

function waitFor(cond: () => boolean, timeoutMs = 8000, what = "condition"): Promise<void> {
	return new Promise((resolve, reject) => {
		const started = Date.now();
		const tick = () => {
			if (cond()) return resolve();
			if (Date.now() - started > timeoutMs) return reject(new Error(`timeout waiting for ${what}`));
			setTimeout(tick, 25);
		};
		tick();
	});
}

/** A teacher whose step 1 blocks on an external gate — a turn held mid-run
 *  so view-cancel / reattach / abort timing is deterministic. */
function gatedTeacher(gate: Promise<void>): PiEngine {
	const faux = createFauxCore({});
	faux.setResponses([
		async () => {
			await gate;
			return fauxAssistantMessage([fauxText("Gated reply.")]);
		},
	]);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

/** A teacher that NEVER resolves except on abort: the only way this turn can
 *  end is the remote kill. */
function abortableTeacher(): PiEngine {
	const faux = createFauxCore({});
	faux.setResponses([
		((_ctx: unknown, opts: { signal?: AbortSignal } | undefined) =>
			new Promise((resolve) => {
				const sig = opts?.signal;
				if (sig?.aborted) return resolve(fauxAssistantMessage("late"));
				sig?.addEventListener("abort", () => resolve(fauxAssistantMessage("late")), { once: true });
			})) as unknown as FauxResponseStep,
	]);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}

function post(chatId: string, input: unknown): Request {
	return new Request("http://test/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		// Wave B: the input-events contract — one explicit event per POST,
		// never a client transcript.
		body: JSON.stringify({ chatId, input }),
	});
}

/** BYOK turn gate (owner, 2026-09-22): no factory floor — a chat needs a
 *  conversation model before any turn streams. The scripted tests give
 *  each chat a per-chat pin exactly like the setup flow does in
 *  production (the injected faux engine still runs the loop). */
function createConfiguredChat(title: string) {
	const chat = chatStore.createChat(title);
	chatStore.saveSettings(chat.id, { model: { provider: "openrouter", id: "z-ai/glm-5.3-flash" } });
	return chat;
}

const createdChats: string[] = [];
after(() => {
	for (const id of createdChats) {
		try {
			fs.unlinkSync(path.join(PATHS.chats, `${id}.json`));
		} catch {
			/* already gone */
		}
	}
});

describe("chat flow (scripted model)", () => {
	it("rejects unknown chats", async () => {
		const res = await handleChatRequest(post("chat_nonexistent", { type: "text", text: "hi" }));
		assert.equal(res.status, 404);
	});

	it("a null body is an unknown chat, not a crash", async () => {
		const res = await handleChatRequest(
			new Request("http://test/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "null",
			}),
		);
		assert.equal(res.status, 404);
	});

	it("refuses malformed inputs with a clean 400 — no liveness effects, no lockout", async () => {
		const chat = createConfiguredChat("Test: malformed input");
		createdChats.push(chat.id);

		// A text event with no text: refused at the parse boundary.
		const res = await handleChatRequest(
			post(chat.id, { type: "text" }),
			agentFactory(scriptedTeacher(defaultLesson).engine),
		);
		assert.equal(res.status, 400, "malformed input is a clean 400");
		assert.equal(isTurnRunning(chat.id), false, "the refusal never registered a turn");

		// An ANSWER with no dangling question call: the orphan-400 discipline
		// (the server owns the record — it validates the target call).
		const res2 = await handleChatRequest(
			post(chat.id, { type: "answer", toolCallId: "call-none", answer: { correct: true } }),
			agentFactory(scriptedTeacher(defaultLesson).engine),
		);
		assert.equal(res2.status, 400, "an answer with no pending question call is refused");
		assert.equal(isTurnRunning(chat.id), false);

		// And the chat is NOT locked: the next (valid) turn is accepted.
		const ok = await handleChatRequest(
			post(chat.id, { type: "text", text: "teach me" }),
			agentFactory(scriptedTeacher(defaultLesson).engine),
		);
		assert.equal(ok.status, 200);
		await drain(ok);
	});

	it("streams the toolCall partial before tool_execution_start/end (protocol pin for the writing indicator)", async () => {
		// Wave D: the wire is VERBATIM pi AgentEvents. The client's writing
		// indicator derives 'input-streaming' from a toolCall block seen in a
		// message_update with no execution yet; the dock mounts on a CLEAN
		// tool_execution_end. Pin the ordering that drives both — if the
		// passthrough ever stopped emitting one of these, the indicator or
		// the dock would silently die.
		const { engine } = scriptedTeacher(defaultLesson);
		const chat = createConfiguredChat("Test: protocol pin");
		createdChats.push(chat.id);
		const body = await drainTurn(post(chat.id, { type: "text", text: "teach me" }), agentFactory(engine));
		const events = eventsOf(body);
		const callSeen = events.findIndex(
			(e) => e.type === "message_update" && JSON.stringify(e.message?.content ?? []).includes('"type":"toolCall"'),
		);
		const execStart = events.findIndex((e) => e.type === "tool_execution_start" && e.toolCallId === "call-1");
		const execEnd = events.findIndex((e) => e.type === "tool_execution_end" && e.toolCallId === "call-1");
		assert.ok(callSeen !== -1, "a message_update carries the toolCall block (the indicator source)");
		assert.ok(execStart !== -1, "tool_execution_start present in the stream");
		assert.ok(execEnd !== -1, "tool_execution_end present in the stream");
		assert.ok(callSeen < execStart && execStart < execEnd, "partial → execution start → execution end");
		assert.equal(events[execEnd]!.isError, false, "the clean end is what the view settles on");
	});

	it("the view canon HOISTS reasoning above the message text (owner ruling 2026-09-26)", () => {
		// GLM emits trailing reasoning tokens — the persisted content lands
		// [text, thinking] (and [text, thinking, toolCall]), which arrival-order
		// presentation rendered as reasoning UNDER its message. The projection
		// stable-partitions: reasoning parts first (their own order), then the
		// rest — live partials and settled records alike.
		const baseMessage = {
			role: "assistant",
			api: "openai-completions",
			provider: "openrouter",
			model: "test",
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			timestamp: 1,
		};
		const trailingThink: LannaMessage = {
			...baseMessage,
			id: "a_trail",
			content: [
				{ type: "text", text: "The answer text." },
				{ type: "thinking", thinking: "Checked the map afterwards." },
				{
					type: "toolCall",
					id: "call-tr",
					name: "pose",
					arguments: { answer: "a", focus: "f" },
				},
			],
			stopReason: "toolUse",
		} as never;
		const view = projectView([{ id: "u0", role: "user", content: "hi", timestamp: 1 } as never, trailingThink]);
		assert.equal(view.length, 2);
		const parts = view[1]!.parts.filter((p) => p.type !== "step-start");
		const order = parts.map((p) => p.type);
		assert.equal(order[0], "reasoning", "reasoning renders FIRST regardless of content order");
		assert.ok(order.indexOf("text") > order.indexOf("reasoning"), "text follows the reasoning");
		assert.equal(order[order.length - 1], "tool-pose", "the tool call stays last");
		// The canonical think-first shape is unchanged.
		const leadingThink: LannaMessage = {
			...baseMessage,
			id: "a_lead",
			stopReason: "stop",
			content: [
				{ type: "thinking", thinking: "First." },
				{ type: "text", text: "The answer text." },
			],
		} as never;
		const view2 = projectView([{ id: "u1", role: "user", content: "hi", timestamp: 1 } as never, leadingThink]);
		assert.deepEqual(
			view2[1]!.parts.filter((p) => p.type !== "step-start").map((p) => p.type),
			["reasoning", "text"],
			"think-first messages project identically",
		);
	});

	it("an arrived-but-empty STREAMING message projects the thinking row; a settled empty one stays hidden (optimistic round 3)", () => {
		const emptyArrived: LannaMessage = {
			id: "a_empty",
			role: "assistant",
			content: [],
			stopReason: "stop",
		} as never;
		const live = {
			executions: new Map(),
			inFlight: true,
			streamingIds: new Set(["a_empty"]),
		} as never;
		// streaming: the message's ARRIVAL renders — one empty reasoning part
		// (chat.tsx Reasoning isStreamings the last part: same spinner +
		// shimmer as the placeholder it replaces — seamless handoff).
		const view = projectView([{ id: "u0", role: "user", content: "hi", timestamp: 1 } as never, emptyArrived], live);
		const parts = view[1]!.parts.filter((p) => p.type !== "step-start");
		assert.deepEqual(
			parts.map((p) => p.type),
			["reasoning"],
			"empty streaming message = the thinking row",
		);
		assert.equal(parts[0]!.text, "", "empty until the first token lands");
		// settled (no live window): presentation-only, hidden as always.
		const settled = projectView([{ id: "u0", role: "user", content: "hi", timestamp: 1 } as never, emptyArrived]);
		assert.equal(settled.length, 1, "a settled empty message renders nothing");
	});

	it("a cancelled view NEVER aborts the turn — it runs to completion (owner ruling 2026-09-25)", async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const engine = gatedTeacher(gate);
		const chat = createConfiguredChat("Test: view cancel");
		createdChats.push(chat.id);

		const res = await handleChatRequest(post(chat.id, { type: "text", text: "hold my turn" }), agentFactory(engine));
		assert.equal(res.status, 200);
		// CONNECTION DIET B (2026-10-10): the POST is a closed ack — the view
		// wire is the reattach stream. Attach, read one chunk, then cancel —
		// the browser view leaves mid-stream.
		const view = new Response(runningTurn(chat.id)!.subscribe());
		const reader = view.body!.getReader();
		await reader.read();
		await reader.cancel();
		// The turn is STILL a running background object — no view killed it.
		assert.equal(isTurnRunning(chat.id), true, "cancel detached the view only — the turn runs on");
		assert.ok(runningTurn(chat.id), "the running-turn registry still holds the handle");

		// It runs to FULL completion with nobody watching, then settles alone.
		release();
		await waitFor(() => !isTurnRunning(chat.id), 8000, "turn settle after view cancel");
		const saved = chatStore.getChat(chat.id)!;
		assert.equal(saved.messages.length, 2, "complete turn persisted — not a partial");
		assert.equal(runningTurn(chat.id), undefined, "handle unregistered at settle");
	});
});

describe("chat store", () => {
	it("round-trips and lists chats", async () => {
		const chat = chatStore.createChat("Store test");
		createdChats.push(chat.id);
		chatStore.saveMessages(chat.id, [{ id: "m1", role: "user", content: "hi", timestamp: 1 } as never]);
		const loaded = chatStore.getChat(chat.id)!;
		assert.equal(loaded.messages.length, 1);
		assert.equal(loaded.title, "Store test");
	});

	it("persist the per-chat model settings (replace-whole, no updatedAt churn)", async () => {
		const chat = chatStore.createChat("Settings test");
		createdChats.push(chat.id);
		const before = chatStore.getChat(chat.id)!.updatedAt;
		chatStore.saveSettings(chat.id, {
			model: { provider: "openrouter", id: "z-ai/glm-5.3-flash" },
			thinkingLevel: "high",
		});
		const saved = chatStore.getChat(chat.id)!;
		assert.deepEqual(saved.settings, {
			model: { provider: "openrouter", id: "z-ai/glm-5.3-flash" },
			thinkingLevel: "high",
		});
		assert.equal(saved.updatedAt, before, "a picker write is not conversation activity");
		// replace-whole: a settings-less write clears the override (an empty
		// object persists — every field absent = config defaults)
		chatStore.saveSettings(chat.id, {});
		assert.deepEqual(chatStore.getChat(chat.id)!.settings, {});
	});
});

describe("canonical persistence failures", () => {
	it("refuses a failed input save without building an agent or leaving a live turn", async () => {
		const { engine } = scriptedTeacher(defaultLesson);
		const chat = createConfiguredChat("Test: failed input write-ahead");
		createdChats.push(chat.id);
		await drainTurn(post(chat.id, { type: "text", text: "teach me" }), agentFactory(engine));
		const before = chatStore.getChat(chat.id)!.messages;
		const save = chatStore.saveMessages;
		let builds = 0;
		chatStore.saveMessages = () => {
			throw new Error("synthetic write-ahead failure");
		};
		try {
			const build = agentFactory(engine)!;
			const res = await handleChatRequest(post(chat.id, { type: "text", text: "one more" }), (opts) => {
				builds++;
				return build(opts);
			});
			const running = runningTurn(chat.id);
			if (running) await new Response(running.subscribe()).text();
			assert.equal(res.status, 500);
			assert.equal(await res.text(), "Your input could not be saved. Please try again.");
			assert.equal(builds, 0);
			assert.equal(isTurnRunning(chat.id), false);
			assert.equal(runningTurn(chat.id), undefined);
			assert.deepEqual(chatStore.getChat(chat.id)!.messages, before);
		} finally {
			chatStore.saveMessages = save;
		}
	});

	it("reports a failed reply save before DONE, and a late or missed view sees the same error", async () => {
		const { engine } = scriptedTeacher(defaultLesson);
		const chat = createConfiguredChat("Test: failed reply persistence");
		createdChats.push(chat.id);
		await drainTurn(post(chat.id, { type: "text", text: "teach me" }), agentFactory(engine));
		const save = chatStore.saveMessages;
		let writes = 0;
		chatStore.saveMessages = (id, messages) => {
			if (++writes === 2) throw new Error("synthetic reply save failure");
			return save(id, messages);
		};
		try {
			const body = await drainTurn(post(chat.id, { type: "text", text: "and then?" }), agentFactory(engine));
			const errors = eventsOf(body).filter((e) => e.type === "error");
			assert.equal(errors.length, 1);
			assert.equal(errors[0]!.errorText, "The reply could not be saved.");
			assert.ok(body.indexOf("The reply could not be saved.") < body.indexOf("[DONE]"));
			assert.equal(isTurnRunning(chat.id), false);
			assert.equal(runningTurn(chat.id), undefined);
			assert.equal(chatStore.getChat(chat.id)!.messages.at(-1)?.role, "user", "the accepted input is durable");
			// The normal submitter may not reach GET /stream until AFTER the
			// failing turn has left the live registry. It must still see it.
			const late = await streamRoute.GET(new Request("http://test/stream"), {
				params: Promise.resolve({ id: chat.id }),
			});
			assert.equal(
				eventsOf(await late.text()).find((e) => e.type === "error")?.errorText,
				"The reply could not be saved.",
			);
			// An already-open idle view can miss both the start and the wire
			// error, then learn of settlement only via a record synchronization.
			const snapshot = await (
				await recordRoute.GET(new Request("http://test/record"), { params: Promise.resolve({ id: chat.id }) })
			).json();
			let automaticPosts = 0;
			const missedView = new SessionModel({
				chatId: chat.id,
				initialMessages: [],
				fetch: async () => {
					automaticPosts++;
					return new Response("unexpected automatic retry", { status: 500 });
				},
			});
			missedView.setMessages(snapshot.messages, snapshot.turnError);
			await missedView.continueIfOwed(snapshot.messages);
			assert.equal(automaticPosts, 0, "the record notice must block replacement even without a stream attachment");
			assert.equal(missedView.getState().error?.message, "The reply could not be saved.");
		} finally {
			chatStore.saveMessages = save;
		}
	});

	it("does not redeliver a persisted learner steer after usage bookkeeping fails", async () => {
		const { engine } = scriptedTeacher(() => [() => fauxAssistantMessage([fauxText("Synthetic response")])]);
		const chat = createConfiguredChat("Test: post-save bookkeeping failure");
		createdChats.push(chat.id);
		const steer = newUserMessage("Synthetic learner steer");
		const appendUsage = chatStore.appendTurnUsage;
		chatStore.appendTurnUsage = () => {
			throw new Error("synthetic usage write failure");
		};
		try {
			const body = await drainTurn(post(chat.id, { type: "text", text: "go" }), (opts) => {
				const agent = createChatAgent({}, { engine, messages: opts.messages, onUsage: opts.onUsage });
				agent.subscribe((event) => {
					if (event.type === "agent_start") assert.equal(steerLiveChat(chat.id, steer), true);
				});
				return agent;
			});
			assert.equal(eventsOf(body).find((e) => e.type === "error")?.errorText, "An error occurred.");
			assert.ok(
				chatStore.getChat(chat.id)!.messages.some((m) => m.id === steer.id),
				"the steer was saved before bookkeeping failed",
			);
			const delivered: LannaMessage[] = [];
			const next = {
				steer: (message: LannaMessage) => delivered.push(message),
				state: { model: { provider: "faux" } },
			} as unknown as Parameters<typeof registerLiveAgent>[1];
			registerLiveAgent(chat.id, next);
			assert.deepEqual(delivered, [], "an already-saved learner steer must not reach another agent");
		} finally {
			chatStore.appendTurnUsage = appendUsage;
			unregisterLiveAgent(chat.id);
		}
	});
});

describe("mid-turn navigation (turn liveness + write-ahead)", () => {
	it("one turn per chat: a concurrent request is 409'd; the next one after finish is accepted", async () => {
		const { engine } = scriptedTeacher(defaultLesson);
		const chat = createConfiguredChat("Test: turn guard");
		createdChats.push(chat.id);

		await handleChatRequest(post(chat.id, { type: "text", text: "teach me the solar system" }), agentFactory(engine)); // acked; the turn runs as a background object (Diet B: no stream to hold)
		assert.equal(isTurnRunning(chat.id), true, "turn registered as in flight");
		const view1 = drainRunning(chat.id); // a live view — the turn would run on with none

		// A stale client (remount racing a live turn) tries to start a second turn.
		const res2 = await handleChatRequest(
			post(chat.id, { type: "text", text: "teach me the solar system" }),
			agentFactory(engine),
		);
		assert.equal(res2.status, 409, "concurrent turn rejected — last-writer-wins persist would clobber it");

		await view1; // finish → onFinish → endTurn
		assert.equal(isTurnRunning(chat.id), false, "registry cleared at finish");

		const res3 = await handleChatRequest(
			post(chat.id, { type: "text", text: "teach me the solar system" }),
			agentFactory(engine),
		);
		assert.equal(res3.status, 200, "the next turn is accepted after the previous finished");
		await drainRunning(chat.id);
	});
});

describe("renameChat (the header's click-to-edit title)", () => {
	it("persists the title and does NOT bump updatedAt — sidebar order must not churn", () => {
		const chat = chatStore.createChat("old title");
		createdChats.push(chat.id);
		const before = chatStore.getChat(chat.id)!.updatedAt;
		const renamed = chatStore.renameChat(chat.id, "  new title  ");
		assert.equal(renamed.title, "new title", "trimmed on the way in");
		assert.equal(chatStore.getChat(chat.id)!.title, "new title");
		assert.equal(chatStore.getChat(chat.id)!.updatedAt, before, "a rename is not conversation activity");
		assert.equal(
			chatStore.listChats().find((c) => c.id === chat.id)!.title,
			"new title",
			"the sidebar list view sees it",
		);
	});

	it("falls back to Untitled session on an all-whitespace title (the honest floor)", () => {
		const chat = chatStore.createChat("keep me");
		createdChats.push(chat.id);
		const renamed = chatStore.renameChat(chat.id, "   ");
		assert.equal(renamed.title, "Untitled session");
	});
});

describe("the BYOK turn gate (no factory floor — owner, 2026-09-22)", () => {
	it("a chat with no model refuses the turn with the 503 envelope — nothing lingers", async () => {
		const chat = chatStore.createChat("Test: unconfigured chat");
		createdChats.push(chat.id);

		// The record's strong slot belongs to settings-store.test.ts (the
		// one-fs-owner policy) — READ the resolved truth, never write it.
		// Refusal holds when the chain is empty; a record-carried strong
		// slot legitimately opens the gate (the chain is honest both ways).
		const expectRefusal = effectiveSettings().models.strong === null;

		const res = await handleChatRequest(
			post(chat.id, { type: "text", text: "teach me the solar system" }),
			agentFactory(scriptedTeacher(defaultLesson).engine),
		);

		if (expectRefusal) {
			assert.equal(res.status, 503, "the universal turn gate refuses before beginTurn");
			const body = (await res.json()) as { error: string; code: string; missing: string[] };
			assert.equal(body.code, "models_not_configured");
			assert.deepEqual(body.missing, ["strong"]);
			assert.match(body.error, /No model configured/);
		} else {
			assert.equal(res.status, 200, "the record's strong slot satisfies the conversation chain");
			await drainRunning(chat.id);
		}

		// Either way: no phantom liveness, nothing durable from a refused turn.
		if (expectRefusal) {
			assert.equal(isTurnRunning(chat.id), false, "the refusal never registers a live turn");
			const saved = chatStore.getChat(chat.id)!;
			assert.equal(saved.messages.length, 0, "no write-ahead persist before the gate");
		}
	});

	it("a per-chat model alone opens the gate (the setup flow's exact write)", async () => {
		const chat = createConfiguredChat("Test: per-chat pin only");
		createdChats.push(chat.id);
		const res = await handleChatRequest(
			post(chat.id, { type: "text", text: "teach me the solar system" }),
			agentFactory(scriptedTeacher(defaultLesson).engine),
		);
		assert.equal(res.status, 200, "chat.settings.model satisfies the chain without any record slot");
		await drainRunning(chat.id);
	});
});

// ─── the key-presence turn gate (provider-key interlude, owner, 2026-09-25) ─

describe("the key-presence turn gate (provider-key interlude, 2026-09-25)", () => {
	// The gate's truth is env-first (keyValue): in tests process.env is the
	// WHOLE truth (the throwaway data dir has no auth.json), so each test
	// pins its provider's env var explicitly and restores it after.
	it("a pinned provider whose key is gone refuses with 503 provider_key_missing — nothing lingers", async () => {
		const chat = chatStore.createChat("Test: keyless provider");
		createdChats.push(chat.id);
		const saved = process.env.TOGETHER_API_KEY;
		delete process.env.TOGETHER_API_KEY;
		try {
			// The chat's own model override pins the provider — the same
			// chain the strong slot rides. The gate fires BEFORE the engine
			// build, so the fake model id never hits the catalog.
			chatStore.saveSettings(chat.id, { model: { provider: "together", id: "no-such-model" } });
			const res = await handleChatRequest(
				post(chat.id, { type: "text", text: "teach me something" }),
				agentFactory(scriptedTeacher(defaultLesson).engine),
			);

			assert.equal(res.status, 503, "the key-presence gate refuses before beginTurn");
			const body = (await res.json()) as { error: string; code: string; provider: string; slots: string[] };
			assert.equal(body.code, "provider_key_missing");
			assert.equal(body.provider, "together", "the envelope names whose key is gone");
			assert.deepEqual(body.slots, ["strong"], "the conversation tier is the affected slot");
			assert.equal(
				body.error,
				"No Together key is set — add one in Settings → API keys",
				"the human line names the provider",
			);
			assert.equal(isTurnRunning(chat.id), false, "the refusal never registers a live turn");
			assert.equal(chatStore.getChat(chat.id)!.messages.length, 0, "no write-ahead persist before the gate");
		} finally {
			if (saved !== undefined) process.env.TOGETHER_API_KEY = saved;
		}
	});

	it("an env-present key passes the gate (gate by what would run)", async () => {
		const chat = chatStore.createChat("Test: env-keyed provider");
		createdChats.push(chat.id);
		const saved = process.env.OPENAI_API_KEY;
		process.env.OPENAI_API_KEY = "test-key-presence-gate";
		try {
			// A REAL catalog model: the engine build AFTER the gate must
			// resolve — the injected agent replaces the loop, not the build.
			chatStore.saveSettings(chat.id, { model: { provider: "openai", id: "gpt-4" } });
			const res = await handleChatRequest(
				post(chat.id, { type: "text", text: "teach me something" }),
				agentFactory(scriptedTeacher(defaultLesson).engine),
			);

			assert.equal(res.status, 200, "the env-shadowed key counts as present — the turn runs");
			await drainRunning(chat.id);
		} finally {
			if (saved !== undefined) process.env.OPENAI_API_KEY = saved;
			else delete process.env.OPENAI_API_KEY;
		}
	});
});

describe("background-turn runner (owner ruling 2026-09-25: every turn is a server-side process, clients are views)", () => {
	it("CONNECTION DIET B (owner, 2026-10-10): the POST acks and closes — the response never holds the turn's stream", async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const engine = gatedTeacher(gate);
		const chat = createConfiguredChat("Test: ack-and-close");
		createdChats.push(chat.id);

		const res = await handleChatRequest(post(chat.id, { type: "text", text: "hold it" }), agentFactory(engine));
		assert.equal(res.status, 200);
		// The body must be FULLY readable while the turn is still gated
		// mid-run — a closed JSON ack, not an open stream. (The freeze
		// postmortem: each held-open POST response pinned one of the
		// browser's 6-per-origin connections for the turn's whole life.)
		const body = JSON.parse(await res.text());
		assert.deepEqual(body, { ok: true }, "the ack is a tiny JSON envelope");
		assert.equal(isTurnRunning(chat.id), true, "the turn runs on with its response closed");

		release();
		await waitFor(() => !isTurnRunning(chat.id), 8000, "turn settle");
	});

	it("subscribe mid-turn: a second view gets the FULL replay, then live, same dialect", async () => {
		let release!: () => void;
		const gate = new Promise<void>((r) => (release = r));
		const engine = gatedTeacher(gate);
		const chat = createConfiguredChat("Test: reattach replay");
		createdChats.push(chat.id);

		const ack = await handleChatRequest(post(chat.id, { type: "text", text: "hold my turn" }), agentFactory(engine));
		assert.equal(ack.status, 200);
		// CONNECTION DIET B (2026-10-10): the POST acks and closes; the first
		// view consumes a little of the reattach wire (the start chunk is out).
		const firstHandle = runningTurn(chat.id)!;
		const firstView = new Response(firstHandle.subscribe());
		const reader = firstView.body!.getReader();
		await reader.read();

		// A SECOND view attaches mid-turn — a remount, another device.
		const handle = runningTurn(chat.id)!;
		assert.ok(handle, "the registry resolves the live turn");
		const secondText = new Response(handle.subscribe()).text();

		// Let the turn finish; both views close at settle.
		release();
		const text = await secondText;
		const replay = eventsOf(text);
		assert.equal(replay[0]!.type, "agent_start", "replay starts from the very first event");
		assert.ok(text.includes("Gated reply."), "replay carries the full streamed content");
		assert.ok(text.endsWith("data: [DONE]\n\n"), "live tail ends with the SSE terminal, same dialect as POST");
		// Wire honesty: a normal turn settles with NO error event (the live
		// smoke caught a close()-throw masked into the error path — unit
		// asserts never looked; these pins would have).
		assert.ok(!text.includes('"type":"error"'), "a clean turn never emits an error event");
		assert.ok(
			replay.some((e) => e.type === "message_end" && e.message?.stopReason === "stop"),
			"message_end carries the stop reason",
		);
		// And the first view also closes cleanly (no hang, no drop): read its
		// remaining chunks through the reader we already hold.
		const decoder = new TextDecoder();
		let firstTail = "";
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			firstTail += decoder.decode(value, { stream: true });
		}
		assert.ok(
			firstTail.endsWith("data: [DONE]\n\n"),
			"first view closes cleanly at settle, unaffected by the reattach",
		);
	});

	it("COMPACTION LAW (owner 2026-10-09): the log stores state, not chunks — a chunk burst coalesces to ONE update, slim wire, full content", async () => {
		// The parallel-session freeze postmortem: pi's message_update is a FULL
		// snapshot per provider chunk; retaining and re-serializing every one
		// made memory and replay quadratic in message length (one high-thinking
		// message = hundreds of MB retained; every reattach re-stringified the
		// whole history in one blocking stretch). Pins the fix end-to-end: faux
		// streams a long text as many immediate chunks (microtask pacing — all
		// inside one flush window), yet the wire carries exactly ONE
		// message_update for the run, it is the LATEST snapshot, and the wire
		// never carries pi's duplicate partial.
		const long = "quadratic blowup ".repeat(40); // ~40 faux chunks
		const faux = createFauxCore({});
		faux.setResponses([fauxAssistantMessage([fauxText(long)])]);
		const engine: PiEngine = { model: faux.getModel(), streamFn: faux.streamSimple };
		const chat = createConfiguredChat("Test: compaction law");
		createdChats.push(chat.id);
		const body = await drainTurn(post(chat.id, { type: "text", text: "go" }), agentFactory(engine));
		const events = eventsOf(body);
		const updates = events.filter((e) => e.type === "message_update");
		assert.equal(updates.length, 1, "a burst of chunks coalesces to exactly one update on the wire");
		assert.ok(
			JSON.stringify(updates[0]!.message?.content ?? []).includes(long),
			"the one update is the LATEST snapshot — the full streamed text",
		);
		assert.ok(!body.includes("assistantMessageEvent"), "WIRE DIET: the duplicate partial never crosses the boundary");
		const end = events.find(
			(e) => e.type === "message_end" && (e as { message?: { role?: string } }).message?.role === "assistant",
		);
		assert.ok(end, "message_end present");
		assert.ok(
			JSON.stringify((end as { message?: { content?: unknown[] } }).message?.content ?? []).includes(long),
			"message_end carries the full final message (authoritative, lossless)",
		);
		// And the persisted record never knew about chunks at all.
		const record = chatStore.getChat(chat.id)!;
		assert.ok(JSON.stringify(record.messages).includes(long), "persistTurn wrote the settled message in full");
	});

	it("remote abort: any client can stop a running turn; the partial persists; subscribers close cleanly", async () => {
		const engine = abortableTeacher();
		const chat = createConfiguredChat("Test: remote abort");
		createdChats.push(chat.id);

		const res = await handleChatRequest(post(chat.id, { type: "text", text: "wait forever" }), agentFactory(engine));
		assert.equal(res.status, 200);
		assert.ok(runningTurn(chat.id), "turn registered while in flight");
		const viewText = new Response(runningTurn(chat.id)!.subscribe()).text(); // the first view, reading to settle

		// The remote kill from a DIFFERENT view (the dock's abort).
		const outcome = abortTurn(chat.id);
		assert.deepEqual(outcome, { ok: true }, "abort resolves ok on a live turn");

		const text = await viewText;
		assert.ok(text.endsWith("data: [DONE]\n\n"), "subscriber closes cleanly at the aborted settle");

		await waitFor(() => !isTurnRunning(chat.id), 8000, "aborted turn settle");
		const saved = chatStore.getChat(chat.id)!;
		assert.ok(saved.messages.length >= 2, "the partial transcript persisted via the usual settle path");
		assert.equal(runningTurn(chat.id), undefined, "handle unregistered after the aborted settle");

		// Honest 409 semantics: there is nothing left to abort.
		assert.deepEqual(abortTurn(chat.id), { ok: false, reason: "not_running" }, "second abort is not_running");
	});

	it("subscribe after settle: the cheap terminal tells the client the record is current", async () => {
		const { engine } = scriptedTeacher(defaultLesson);
		const chat = createConfiguredChat("Test: settled terminal");
		createdChats.push(chat.id);

		// A quiet chat: no turn ever ran — the stream is the same terminal.
		const term = settledTurnResponse();
		assert.equal(
			await term.text(),
			'data: {"type":"turn-settled"}\n\ndata: [DONE]\n\n',
			"terminal is one event + [DONE]",
		);
		assert.equal(runningTurn(chat.id), undefined);

		// And after a settled turn, the registry is empty — the GET would
		// serve the same terminal, not a stale handle.
		await drainTurn(post(chat.id, { type: "text", text: "teach me" }), agentFactory(engine));
		assert.equal(runningTurn(chat.id), undefined, "no handle survives settle");
	});

	it("concurrent two-chat reattach: two turns in flight, two views, both settle independently", async () => {
		const releaseFns: Array<() => void> = [];
		const chats = [1, 2].map((n) => {
			const gate = new Promise<void>((r) => releaseFns.push(r));
			const engine = gatedTeacher(gate);
			const chat = createConfiguredChat(`Test: two-chat ${n}`);
			createdChats.push(chat.id);
			return { n, engine, chat };
		});

		const views = new Map<string, Promise<string>>();
		for (const { chat, engine } of chats) {
			const res = await handleChatRequest(post(chat.id, { type: "text", text: "hold my turn" }), agentFactory(engine));
			assert.equal(res.status, 200);
			const handle = runningTurn(chat.id)!;
			assert.ok(handle, `chat ${chat.id} has its own handle`);
			views.set(chat.id, new Response(handle.subscribe()).text());
			// The other chat's handle must not be this one (per-chat keying).
			const others = chats.filter((c) => c.chat.id !== chat.id).map((c) => runningTurn(c.chat.id));
			assert.ok(!others.includes(handle), "per-chat handles are distinct objects");
		}

		// Release both; both settle independently.
		for (const release of releaseFns) release();
		for (const { chat } of chats) {
			const text = await views.get(chat.id)!;
			assert.ok(text.includes("Gated reply."), `chat ${chat.id} view replayed its own turn`);
			assert.ok(text.endsWith("data: [DONE]\n\n"), `chat ${chat.id} view closed at settle`);
			await waitFor(() => !isTurnRunning(chat.id), 8000, `chat ${chat.id} settle`);
			assert.equal(chatStore.getChat(chat.id)!.messages.length, 2, `chat ${chat.id} persisted its full turn`);
		}
	});
});

describe("composer steering: POST /api/chats/[id]/steer", () => {
	const steerPost = (chatId: string, body: unknown): Promise<Response> =>
		steerRoute.POST(
			new Request(`http://test/api/chats/${chatId}/steer`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			}),
			{ params: Promise.resolve({ id: chatId }) },
		);

	it("honest rejections: 404 unknown chat, 400 bad input, 409 when no turn is live", async () => {
		const chat = createConfiguredChat("Test: steer rejections");
		createdChats.push(chat.id);
		assert.equal((await steerPost("chat_nope", { input: { type: "steer", id: "steer_1", text: "hi" } })).status, 404);
		assert.equal((await steerPost(chat.id, { input: { type: "steer", id: "", text: "hi" } })).status, 400);
		assert.equal((await steerPost(chat.id, { input: { type: "text", text: "hi" } })).status, 400);
		assert.equal((await steerPost(chat.id, { input: { type: "steer", id: "steer_1", text: "  " } })).status, 400);
		assert.equal((await steerPost(chat.id, { input: { type: "steer", id: "steer_1", text: "hi" } })).status, 409);
	});

	it("200 + the live steering queue when a turn runs; the drain lands the card and the model sees it", async () => {
		// A GATED engine (the scriptedTeacher seam): the first factory
		// awaits our release, holding the turn open mid-generation so the
		// steer POST lands while the run is genuinely live.
		const calls: string[][] = [];
		let release!: () => void;
		const gate = new Promise<void>((res) => {
			release = res;
		});
		const faux = createFauxCore({});
		faux.setResponses([
			async (context: { messages: unknown[] }) => {
				calls.push(context.messages.map((m) => JSON.stringify((m as { content: unknown }).content)));
				await gate;
				return fauxAssistantMessage([fauxText("Teaching the solar system…")]);
			},
			(context: { messages: unknown[] }) => {
				calls.push(context.messages.map((m) => JSON.stringify((m as { content: unknown }).content)));
				return fauxAssistantMessage([fauxText("Steered — covering Venus too.")]);
			},
		]);
		const engine = { model: faux.getModel(), streamFn: faux.streamSimple };

		const chat = createConfiguredChat("Test: steer live");
		createdChats.push(chat.id);

		// The turn starts and holds at the first model call.
		await handleChatRequest(post(chat.id, { type: "text", text: "teach me" }), agentFactory(engine as never));
		await waitFor(() => calls.length === 1, 8000, "first model call started");

		// The steer lands mid-turn: 200, handed to the live agent.
		const res = await steerPost(chat.id, { input: { type: "steer", id: "steer_live1", text: "also cover Venus" } });
		assert.equal(res.status, 200);
		assert.equal(((await res.json()) as { ok: boolean }).ok, true);

		// CONNECTION DIET B: the drain rides the reattach wire (the POST
		// acked long ago). Attach BEFORE releasing — a live view.
		const viewText = drainRunning(chat.id);
		release(); // the first response completes → the drain → the second call
		const body = await viewText;
		assert.match(body, /also cover Venus/, "the drained steer rode the live stream verbatim");

		// ONE turn: the second model call's context contains the steer
		// BETWEEN the user message and the continuing assistant text.
		assert.equal(calls.length, 2, "still one run — the steer continued it, not a new turn");
		assert.match(calls[1]!.join("\n"), /also cover Venus/, "the model saw the steer in its context");

		// The record persists the user steer in its true position.
		const saved = chatStore.getChat(chat.id)!;
		const roles = saved.messages.map((m) => (m as { role?: string }).role);
		assert.deepEqual(roles, ["user", "assistant", "user", "assistant"], "text → teaching → STEER → steered reply");
		const steerMsg = saved.messages[2] as { id?: string; content?: unknown };
		assert.equal(steerMsg.id, "steer_live1", "the client-minted id survived to the record");
		assert.equal(steerMsg.content, "also cover Venus");
	});
});

// ─── THE LACAN INCIDENT: per-response tool-call ids (owner fix 2026-10-04) ──
// DeepSeek (via OpenRouter) returns tool-call ids that reset every response —
// `call_0` for every turn's single call. Before the uniquifier, the duplicate
// ids corrupted the fold, answer routing, and the pending gate. Now the wire
// boundary remints colliding ids ONCE — the client, the record, and the next
// turn's provider context all see unique ids.

describe("duplicate provider tool-call ids (the Lacan fix)", () => {
	it("every `call_0` turn keeps its identity: each pose stays its own call, ids unique in the record", async () => {
		// BOTH turns name their single call `call_0` — the provider's shape.
		const { engine } = scriptedTeacher(() => [
			() =>
				fauxAssistantMessage([fauxText("First question."), fauxToolCall("pose", POSE_INPUT, { id: "call_0" })], {
					stopReason: "toolUse",
				}),
			() =>
				fauxAssistantMessage(
					[fauxText("Second question."), fauxToolCall("pose", { ...POSE_INPUT, answer: "Venus" }, { id: "call_0" })],
					{ stopReason: "toolUse" },
				),
		]);

		const chat = createConfiguredChat("Chat: duplicate call_0 turns");
		createdChats.push(chat.id);
		await drainTurn(post(chat.id, { type: "text", text: "teach me" }), agentFactory(engine));
		await drainTurn(post(chat.id, { type: "text", text: "next one" }), agentFactory(engine));

		const saved = chatStore.getChat(chat.id)!;
		// The invariant: CALL ids are unique among themselves (a call and its
		// own result share one id by design — that pair is the point).
		const callIds = saved.messages.flatMap((m) =>
			m.role === "assistant" ? (m.content ?? []).filter((c) => c.type === "toolCall").map((c) => c.id) : [],
		);
		assert.equal(new Set(callIds).size, callIds.length, "no duplicate tool-call ids persist");
		assert.equal(callIds[0], "call_0", "the first call keeps the provider's id");
		assert.match(callIds[1]!, /^call_0~\d+$/, "the second call_0 was reminted at the wire boundary");

		// Each pose resolved against its own call: both parts carry their output.
		const parts = projectView(saved.messages)
			.flatMap((v) => v.parts)
			.filter((p) => p.type === "tool-pose");
		assert.equal(parts.length, 2, "both pose calls project as tool parts");
		for (const part of parts) {
			assert.equal((part as { state?: string }).state, "output-available", "each pose got its own result");
		}
	});
});
