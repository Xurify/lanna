import type { Agent } from "@earendil-works/pi-agent-core";
import type { LannaMessage } from "../core/chat-messages.ts";

interface ParkedSteer {
	message: LannaMessage;
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

export function registerLiveAgent(chatId: string, agent: Agent): void {
	state().liveAgents.set(chatId, agent);
	handOff(chatId, agent);
}

export function unregisterLiveAgent(chatId: string): void {
	state().liveAgents.delete(chatId);
}

export function steerLiveChat(chatId: string, message: LannaMessage): boolean {
	const agent = state().liveAgents.get(chatId);
	if (!agent) return false;
	const queue = state().parked.get(chatId) ?? [];
	queue.push({ message, handedTo: agent });
	state().parked.set(chatId, queue);
	agent.steer(message);
	return true;
}

export function reconcileUserSteers(chatId: string, persisted: readonly LannaMessage[]): void {
	const queue = state().parked.get(chatId);
	if (!queue || queue.length === 0) return;
	const saved = new Set(persisted.map((m) => (m as { id?: string }).id));
	const kept = queue.filter((entry) => !saved.has(entry.message.id));
	if (kept.length === 0) state().parked.delete(chatId);
	else state().parked.set(chatId, kept);
}

export function discardChatSteers(chatId: string): void {
	state().parked.delete(chatId);
	state().liveAgents.delete(chatId);
}
