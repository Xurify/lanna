import { emit } from "../../core/events.ts";
import { clearTurnFailure } from "./registry.ts";

interface TurnLivenessGlobal {
	__lhTurnRegistry?: Map<string, number>;
}

const STALE_TURN_MS = 30 * 60_000;

function startedAtByChat(): Map<string, number> {
	const g = globalThis as typeof globalThis & TurnLivenessGlobal;
	return (g.__lhTurnRegistry ??= new Map<string, number>());
}

export function beginTurn(chatId: string): boolean {
	if (isTurnRunning(chatId)) return false;
	clearTurnFailure(chatId);
	startedAtByChat().set(chatId, Date.now());
	emit("turn-started", { chatId });
	return true;
}

export function endTurn(chatId: string): void {
	if (startedAtByChat().delete(chatId)) emit("turn-settled", { chatId });
}

export function isTurnRunning(chatId: string): boolean {
	const startedAt = startedAtByChat().get(chatId);
	if (startedAt === undefined) return false;
	if (Date.now() - startedAt <= STALE_TURN_MS) return true;
	startedAtByChat().delete(chatId);
	return false;
}
