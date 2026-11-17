import type { LannaMessage, LannaViewMessage, LiveExecution } from "../../src/core";

export type SessionStatus = "ready" | "submitted" | "streaming" | "error";

export type SessionKind = "chat" | "practice";

export interface SessionError {
	message: string;
}

export interface SteerQueueItem {
	id: string;
	text: string;
}

export interface SessionState {
	messages: LannaViewMessage[];
	nativeMessages: LannaMessage[];
	contextTokens: number | null;
	status: SessionStatus;
	error: SessionError | null;
	steerQueue: SteerQueueItem[];
}

export interface RunningTurn {
	executions: ReadonlyMap<string, LiveExecution>;
	streamingIds: ReadonlySet<string>;
	streamingMessageId: string | null;
	incompleteUsageIds: ReadonlySet<string>;
	liveFailureId: string | null;
}

export interface SessionData {
	record: readonly LannaMessage[];
	tail: readonly LannaMessage[];
	turn: RunningTurn;
	status: SessionStatus;
	error: SessionError | null;
	automaticContinuationBlocked: boolean;
	steerQueue: readonly SteerQueueItem[];
}

export type ConsumeEnd = { kind: "done" } | { kind: "settled" } | { kind: "dropped" } | { kind: "aborted" };

export function isTurnRunning(status: SessionStatus): boolean {
	return status === "submitted" || status === "streaming";
}

export function emptyRunningTurn(): RunningTurn {
	return {
		executions: new Map(),
		streamingIds: new Set(),
		streamingMessageId: null,
		incompleteUsageIds: new Set(),
		liveFailureId: null,
	};
}

export function initialSessionData(initialMessages: LannaMessage[], initialError: string | undefined): SessionData {
	return {
		record: initialMessages,
		tail: [],
		turn: emptyRunningTurn(),
		status: "ready",
		error: initialError === undefined ? null : { message: initialError },
		automaticContinuationBlocked: initialError !== undefined,
		steerQueue: [],
	};
}
