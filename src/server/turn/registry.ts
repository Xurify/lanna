import { TURN_DONE_FRAME, TURN_STREAM_HEADERS, turnFrame, type PiTurnHandle } from "./stream.ts";

interface TurnRegistryGlobal {
	__lhTurnRuns?: Map<string, PiTurnHandle>;
	__lhTurnFailures?: Map<string, string>;
}

export type AbortTurnOutcome = { ok: true } | { ok: false; reason: "not_running" };

function runs(): Map<string, PiTurnHandle> {
	const g = globalThis as typeof globalThis & TurnRegistryGlobal;
	return (g.__lhTurnRuns ??= new Map<string, PiTurnHandle>());
}

function failures(): Map<string, string> {
	const g = globalThis as typeof globalThis & TurnRegistryGlobal;
	return (g.__lhTurnFailures ??= new Map<string, string>());
}

export function rememberTurnFailure(chatId: string, errorText: string): void {
	failures().set(chatId, errorText);
}

export function turnFailure(chatId: string): string | undefined {
	return failures().get(chatId);
}

export function clearTurnFailure(chatId: string): void {
	failures().delete(chatId);
}

export function registerTurn(chatId: string, handle: PiTurnHandle): void {
	runs().set(chatId, handle);
}

export function unregisterTurn(chatId: string): void {
	runs().delete(chatId);
}

export function runningTurn(chatId: string): PiTurnHandle | undefined {
	return runs().get(chatId);
}

export function abortTurn(chatId: string): AbortTurnOutcome {
	const handle = runs().get(chatId);
	if (!handle) return { ok: false, reason: "not_running" };
	handle.abort();
	return { ok: true };
}

export function settledTurnResponse(chatId?: string): Response {
	const errorText = chatId ? turnFailure(chatId) : undefined;
	const notice = errorText === undefined ? "" : turnFrame({ type: "error", errorText });
	return new Response(`${notice}${turnFrame({ type: "turn-settled" })}${TURN_DONE_FRAME}`, {
		headers: TURN_STREAM_HEADERS,
	});
}
