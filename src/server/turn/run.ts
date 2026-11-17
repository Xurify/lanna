import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { providerEventNote } from "../../agent/provider-events.ts";
import type { LannaMessage } from "../../core/chat-messages.ts";
import { ChatInputError, inputAppends, type TurnInput } from "../../core/input-events.ts";
import { reconcileUserSteers, registerLiveAgent, unregisterLiveAgent } from "../steers.ts";
import { stores } from "../stores.ts";
import { buildTurnAgent, withSlovakEvidence, type AgentFactory } from "./agent.ts";
import { collectToolCallIds } from "./call-ids.ts";
import { applyParkedDismissal } from "./dismissals.ts";
import { kickCompactionAfterSettle, modelIdOf, passTurnGates, unknownChatResponse } from "./gates.ts";
import { beginTurn, endTurn } from "./liveness.ts";
import { persistTurn, TurnPersistenceError } from "./persist.ts";
import { registerTurn, rememberTurnFailure, unregisterTurn } from "./registry.ts";
import { runPiTurn } from "./stream.ts";
import { createTurnUsage, type TurnUsageLedger } from "./usage.ts";

interface SettlingTurn {
	chatId: string;
	baseCount: number;
	usage: TurnUsageLedger;
	modelId: string;
}

function settlementErrorText(error: unknown): string {
	return error instanceof TurnPersistenceError ? error.message : "An error occurred.";
}

function updateFlushOverride(): { updateFlushMs?: number } {
	return process.env.LANNA_UPDATE_FLUSH_MS ? { updateFlushMs: Number(process.env.LANNA_UPDATE_FLUSH_MS) } : {};
}

function recordFirstAssistantUsage(
	chatId: string,
	stamped: LannaMessage[],
	usage: TurnUsageLedger,
	modelId: string,
): void {
	const response = stamped.find((message) => message.role === "assistant");
	if (!response || usage.steps.length === 0) return;
	stores.chatStore.appendTurnUsage(chatId, {
		id: usage.id,
		messageId: response.id,
		at: new Date().toISOString(),
		model: modelId,
		steps: usage.steps,
	});
}

function settleTurn(turn: SettlingTurn, finalMessages: AgentMessage[], isAborted: boolean): void {
	const stamped = persistTurn(stores.chatStore, turn.chatId, turn.baseCount, finalMessages, isAborted);
	recordFirstAssistantUsage(turn.chatId, stamped, turn.usage, turn.modelId);
	applyParkedDismissal(stores.chatStore, turn.chatId);
	endTurn(turn.chatId);
	unregisterTurn(turn.chatId);
	unregisterLiveAgent(turn.chatId);
	reconcileUserSteers(turn.chatId, stamped);
	if (process.env.NODE_ENV !== "test") kickCompactionAfterSettle(turn.chatId);
}

function failSettlement(chatId: string, error: unknown, reportedErrorText: string | undefined): void {
	rememberTurnFailure(chatId, reportedErrorText ?? settlementErrorText(error));
	endTurn(chatId);
	unregisterTurn(chatId);
	unregisterLiveAgent(chatId);
	reconcileUserSteers(chatId, stores.chatStore.getChat(chatId)?.messages ?? []);
}

export async function runTurn(chatId: string, input: TurnInput, buildAgent?: AgentFactory): Promise<Response> {
	const record = stores.chatStore.getChat(chatId);
	if (!record) return unknownChatResponse();
	const gates = await passTurnGates(chatId, record);
	if (gates.outcome === "refused") return gates.response;
	const { turn } = gates;

	let appends: LannaMessage[];
	try {
		appends = inputAppends(turn.record, input).map(withSlovakEvidence);
	} catch (err) {
		if (err instanceof ChatInputError) return Response.json({ error: err.message }, { status: 400 });
		throw err;
	}

	if (!beginTurn(chatId)) {
		console.info(`[chat ${chatId}] turn already in flight — request rejected`);
		return Response.json({ error: "A turn is already running for this session" }, { status: 409 });
	}

	const merged = [...turn.record.messages, ...appends];
	try {
		stores.chatStore.saveMessages(chatId, merged);
	} catch (err) {
		console.error(`[chat ${chatId}] write-ahead persist failed:`, err);
		endTurn(chatId);
		return new Response("Your input could not be saved. Please try again.", { status: 500 });
	}

	const usage = createTurnUsage();
	const settling = { chatId, baseCount: merged.length, usage, modelId: modelIdOf(turn.engine) };
	try {
		const agent = buildTurnAgent(
			{ chatId, kind: turn.record.kind, engine: turn.engine, messages: merged, usage, settings: turn.settings },
			buildAgent,
		);
		// pi-agent-core drains the steering queue synchronously when the loop starts, so the agent is registered before runPiTurn.
		registerLiveAgent(chatId, agent);
		providerEventNote(chatId, "turn", `run start (base: ${merged.length} messages)`);
		const handle = runPiTurn({
			agent,
			...updateFlushOverride(),
			usedToolCallIds: new Set(collectToolCallIds(merged)),
			onError: (error) => {
				console.error(`[chat ${chatId}] turn error:`, error);
				return "An error occurred.";
			},
			onSettleError: settlementErrorText,
			onSettleFailure: (error, reportedErrorText) => failSettlement(chatId, error, reportedErrorText),
			onFinish: (finalMessages, isAborted) => settleTurn(settling, finalMessages, isAborted),
		});
		registerTurn(chatId, handle);
		// Browsers allow six HTTP/1.1 connections per origin, so the POST acknowledges and closes; a view attaches through the stream route.
		return Response.json({ ok: true });
	} catch (err) {
		endTurn(chatId);
		unregisterLiveAgent(chatId);
		console.error(`[chat ${chatId}] turn failed to start:`, err);
		return Response.json({ error: "Failed to start the turn" }, { status: 500 });
	}
}
