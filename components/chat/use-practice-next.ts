import { useCallback } from "react";
import { useEnterSubmits } from "@/components/enter-submits";
import type { LannaMessage } from "@/src/core";
import type { SessionKind } from "@/components/session/state";
import type { ActivePracticeProblem } from "@/components/chat/practice-dock";

function isProblemCall(block: unknown): boolean {
	const call = block as { type?: unknown; name?: unknown };
	return call.type === "toolCall" && call.name === "problem";
}

function postsProblemCall(message: LannaMessage): boolean {
	const { role, content } = message as { role?: unknown; content?: unknown };
	return role === "assistant" && Array.isArray(content) && content.some(isProblemCall);
}

interface PracticeNextInput {
	kind: SessionKind;
	activeProblem: ActivePracticeProblem | null;
	compacting: boolean;
	busy: boolean;
	nativeMessages: LannaMessage[];
	send: (input: { type: "next" }) => void;
}

export function usePracticeNext({ kind, activeProblem, compacting, busy, nativeMessages, send }: PracticeNextInput) {
	const nextReady =
		kind === "practice" && !activeProblem && !compacting && !busy && nativeMessages.some(postsProblemCall);

	const sendNext = useCallback(() => {
		if (!nextReady) return;
		send({ type: "next" });
	}, [nextReady, send]);

	useEnterSubmits(sendNext);

	return { nextReady, sendNext };
}
