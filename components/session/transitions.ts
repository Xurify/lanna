import type { ChatInput, LannaMessage } from "../../src/core";
import { absorbed } from "./absorb";
import { optimisticEntries } from "./optimistic";
import { type ConsumeEnd, type RunningTurn, type SessionData, type SessionStatus } from "./state";

export function admitsTurn(status: SessionStatus): boolean {
	return status === "ready" || status === "error";
}

export function withStatus(data: SessionData, status: SessionStatus): SessionData {
	const turn = status === "submitted" ? { ...data.turn, liveFailureId: null } : data.turn;
	return { ...data, status, turn };
}

export function withError(data: SessionData, message: string | null): SessionData {
	if (message === null) return { ...data, error: null };
	return { ...data, error: { message }, automaticContinuationBlocked: true };
}

export function appendTail(data: SessionData, entries: readonly LannaMessage[]): SessionData {
	return { ...data, tail: [...data.tail, ...entries] };
}

export function retireRunningTurn(data: SessionData): SessionData {
	const turn: RunningTurn = {
		...data.turn,
		executions: new Map(),
		streamingIds: new Set(),
		streamingMessageId: null,
	};
	return { ...data, turn };
}

export function cleanSlate(data: SessionData): SessionData {
	const turn = { ...data.turn, incompleteUsageIds: new Set<string>(), streamingMessageId: null };
	return { ...data, tail: [], turn };
}

export function replaceRecord(data: SessionData, record: readonly LannaMessage[], turnError?: string): SessionData {
	const replaced = cleanSlate({ ...data, record });
	return turnError === undefined ? replaced : withError(replaced, turnError);
}

export function adoptAppend(data: SessionData, record: readonly LannaMessage[]): SessionData {
	const recordIds = new Set(record.map((message) => message.id));
	if (data.record.some((message) => !recordIds.has(message.id))) return data;
	return { ...data, record, tail: data.tail.filter((message) => !absorbed(message, record)) };
}

export function beginSubmit(data: SessionData, input: ChatInput): SessionData {
	const submitting = withStatus(withError(data, null), "submitted");
	const unblocked = input.type === "continue" ? submitting : { ...submitting, automaticContinuationBlocked: false };
	return appendTail(unblocked, optimisticEntries(input));
}

export function settleConsume(data: SessionData, end: ConsumeEnd): SessionData {
	const retired = retireRunningTurn(data);
	const finished = end.kind === "done" || end.kind === "settled";
	return finished && retired.status !== "error" ? withStatus(retired, "ready") : retired;
}
