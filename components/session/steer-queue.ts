import type { LannaMessage } from "../../src/core";
import { localId } from "./local-id";
import type { SessionData, SteerQueueItem } from "./state";

export function newSteerId(): string {
	return `steer_${localId()}`;
}

export function queueSteer(data: SessionData, item: SteerQueueItem): SessionData {
	return { ...data, steerQueue: [...data.steerQueue, item] };
}

export function dropSteer(data: SessionData, id: string): SessionData {
	return { ...data, steerQueue: data.steerQueue.filter((item) => item.id !== id) };
}

export function visibleQueuedSteers(
	queue: readonly SteerQueueItem[],
	messages: readonly LannaMessage[],
): SteerQueueItem[] {
	const landed = new Set(messages.map((message) => message.id));
	return queue.filter((item) => !landed.has(item.id));
}
