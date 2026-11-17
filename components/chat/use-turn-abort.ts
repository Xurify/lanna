import { useCallback } from "react";

interface TurnAbortInput {
	chatId: string;
	localStream: boolean;
	stop: () => void;
	releaseHeldAnswer: () => void;
}

export function useTurnAbort({ chatId, localStream, stop, releaseHeldAnswer }: TurnAbortInput): () => void {
	return useCallback(() => {
		releaseHeldAnswer();
		if (localStream) stop();
		void fetch("/api/activity/abort", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ kind: "turn", id: chatId }),
		}).catch(() => {});
	}, [chatId, localStream, stop, releaseHeldAnswer]);
}
