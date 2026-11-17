import { measuredContextTokens, projectView, type LannaMessage } from "../../src/core";
import { isTurnRunning, type SessionData, type SessionError, type SessionState } from "./state";

type LiveView = NonNullable<Parameters<typeof projectView>[1]>;

const UNKNOWN_FAILURE_TEXT = "An error occurred.";

export function projectSessionState(data: SessionData): SessionState {
	const messages = transcriptOf(data);
	return {
		messages: projectView(messages, liveViewOf(data)),
		nativeMessages: messages,
		contextTokens: measuredContextTokens(messages, data.turn.incompleteUsageIds),
		status: data.status,
		error: data.error ?? failedReplyOf(messages, data),
		steerQueue: [...data.steerQueue],
	};
}

export function visibleError(data: SessionData): SessionError | null {
	return data.error ?? failedReplyOf(transcriptOf(data), data);
}

function transcriptOf(data: SessionData): LannaMessage[] {
	return [...data.record, ...data.tail];
}

function liveViewOf(data: SessionData): LiveView | undefined {
	if (!isTurnRunning(data.status)) return undefined;
	return { executions: data.turn.executions, inFlight: true, streamingIds: data.turn.streamingIds };
}

function failedReplyOf(messages: readonly LannaMessage[], data: SessionData): SessionError | null {
	const latest = messages.at(-1);
	if (latest?.role !== "assistant" || latest.stopReason !== "error") return null;
	if (data.turn.incompleteUsageIds.has(latest.id)) return null;
	if (isTurnRunning(data.status) && latest.id !== data.turn.liveFailureId) return null;
	return { message: latest.errorMessage ?? UNKNOWN_FAILURE_TEXT };
}
