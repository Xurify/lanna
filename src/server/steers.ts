/**
 * The learner's own mid-turn messages ("steers"): Enter while the tutor is
 * still answering hands the message to the running turn, which reads it at
 * its next boundary. This module keeps the running agent per chat and every
 * steer until the record holds it, so a steer that a turn could not take
 * (an abort, a finished problem pose) rides the chat's next turn.
 *
 * Memory only: a server restart drops parked steers, and the turn dies with
 * the restart anyway.
 */
import type { Agent } from "@earendil-works/pi-agent-core";
import type { LannaMessage } from "../core/native-messages.ts";

interface ParkedSteer {
	message: LannaMessage;
	/** The agent it was last handed to, so one run never gets it twice. */
	handedTo?: Agent;
}

interface SteerState {
	liveAgents: Map<string, Agent>;
	parked: Map<string, ParkedSteer[]>;
}

function state(): SteerState {
	const g = globalThis as typeof globalThis & { __lannaSteers?: SteerState };
	return (g.__lannaSteers ??= { liveAgents: new Map(), parked: new Map() });
}

function handOff(chatId: string, agent: Agent): void {
	for (const entry of state().parked.get(chatId) ?? []) {
		if (entry.handedTo === agent) continue;
		agent.steer(entry.message);
		entry.handedTo = agent;
	}
}

/** Register the turn's agent before runPiTurn: the loop reads steers at its first boundary inside that call. */
export function registerLiveAgent(chatId: string, agent: Agent): void {
	state().liveAgents.set(chatId, agent);
	handOff(chatId, agent);
}

export function unregisterLiveAgent(chatId: string): void {
	state().liveAgents.delete(chatId);
}

/** Hand a learner's message to the running turn; false when no turn runs (the client then sends it as a plain message). */
export function steerLiveChat(chatId: string, message: LannaMessage): boolean {
	const agent = state().liveAgents.get(chatId);
	if (!agent) return false;
	const queue = state().parked.get(chatId) ?? [];
	queue.push({ message, handedTo: agent });
	state().parked.set(chatId, queue);
	agent.steer(message);
	return true;
}

/** After a turn is saved: steers the record holds are done; the rest wait for the next turn. */
export function reconcileUserSteers(chatId: string, persisted: readonly LannaMessage[]): void {
	const queue = state().parked.get(chatId);
	if (!queue || queue.length === 0) return;
	const saved = new Set(persisted.map((m) => (m as { id?: string }).id));
	const kept = queue.filter((entry) => !saved.has(entry.message.id));
	if (kept.length === 0) state().parked.delete(chatId);
	else state().parked.set(chatId, kept);
}

/** A deleted chat keeps no parked steers. */
export function discardChatSteers(chatId: string): void {
	state().parked.delete(chatId);
	state().liveAgents.delete(chatId);
}
