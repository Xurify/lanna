"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ChatInput, LannaMessage } from "@/src/core";
import { SessionModel, type SessionState } from "@/components/session-core";
import { isTurnRunning, type SessionKind, type SessionStatus } from "@/components/session/state";

interface UseChatSessionOptions {
	chatId: string;
	initialMessages: LannaMessage[];
	initialError?: string;
	initiallyInFlight?: boolean;
}

export function useChatSession({ chatId, initialMessages, initialError, initiallyInFlight }: UseChatSessionOptions) {
	const [model] = useState(() => new SessionModel({ chatId, initialMessages, initialError }));
	const [version, bump] = useReducer((count: number) => count + 1, 0);

	useEffect(() => {
		model.onChange = bump;
		return () => {
			model.onChange = undefined;
		};
	}, [model]);

	useEffect(() => {
		if (initiallyInFlight) void model.resumeStream(false);
		return () => {
			model.stop();
		};
	}, [initiallyInFlight, model]);

	const state = useMemo<SessionState>(() => model.getState(), [model, version]);
	useTurnStateBroadcast(chatId, state.status);
	const actions = useMemo(() => sessionActions(model), [model]);

	return {
		messages: state.messages,
		nativeMessages: state.nativeMessages,
		contextTokens: state.contextTokens,
		status: state.status,
		error: state.error,
		steerQueue: state.steerQueue,
		...actions,
	};
}

function useTurnStateBroadcast(chatId: string, status: SessionStatus): void {
	const previousStatus = useRef(status);
	useEffect(() => {
		const change = runningChange(previousStatus.current, status);
		previousStatus.current = status;
		if (change === null) return;
		window.dispatchEvent(new CustomEvent("lanna:turn-state", { detail: { id: chatId, running: change } }));
	}, [status, chatId]);
}

function runningChange(from: SessionStatus, to: SessionStatus): boolean | null {
	if (isTurnRunning(from) === isTurnRunning(to)) return null;
	return isTurnRunning(to);
}

function sessionActions(model: SessionModel) {
	return {
		send: (input: ChatInput) => void model.send(input),
		continueIfOwed: (record: readonly LannaMessage[], kind: SessionKind) => void model.continueIfOwed(record, kind),
		steer: (text: string) => void model.steer(text),
		dismissProblem: (problemCallId: string) => void model.dismissProblem(problemCallId),
		setMessages: (record: LannaMessage[], turnError?: string) => model.setMessages(record, turnError),
		adoptRecord: (record: LannaMessage[]) => model.adoptRecord(record),
		stop: () => model.stop(),
		clearError: () => model.clearError(),
		resumeStream: () => void model.resumeStream(),
		setReattachSettled: (fn: () => void) => model.setReattachSettled(fn),
	};
}
