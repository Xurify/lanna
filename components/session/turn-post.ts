import type { ChatInput } from "../../src/core";
import { chatPath, jsonPost, type Fetch } from "./http";

export const TURN_PATH = "/api/chat";
export const TURN_RETRY_POLL_MS = 500;
export const TURN_RETRY_DEADLINE_MS = 30_000;

export interface TurnRetryTiming {
	pollMs: number;
	waitMaxMs: number;
}

export async function postTurnInput(
	fetchImplementation: Fetch,
	chatId: string,
	input: ChatInput,
	timing: TurnRetryTiming,
	signal?: AbortSignal,
): Promise<Response> {
	const init: RequestInit = { ...jsonPost({ chatId, input }), signal };
	let response = await fetchImplementation(TURN_PATH, init);
	let waitedMs = 0;
	while (response.status === 409) {
		await response.body?.cancel().catch(() => {});
		if (signal?.aborted || waitedMs >= timing.waitMaxMs) return response;
		await delay(timing.pollMs, signal);
		waitedMs += timing.pollMs;
		if (signal?.aborted) return response;
		if (!(await turnIsIdle(fetchImplementation, chatId))) continue;
		response = await fetchImplementation(TURN_PATH, init);
	}
	return response;
}

async function turnIsIdle(fetchImplementation: Fetch, chatId: string): Promise<boolean> {
	try {
		const response = await fetchImplementation(chatPath(chatId, "/turn"));
		if (!response.ok) return false;
		return ((await response.json()) as { turnInFlight?: unknown }).turnInFlight !== true;
	} catch {
		return false;
	}
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(new DOMException("Aborted", "AbortError"));
			},
			{ once: true },
		);
	});
}
