import { useEffect } from "react";
import type { LannaMessage } from "@/src/core";
import type { SessionError } from "@/components/session/state";
import { parseModelsRefusal, parseProviderKeyRefusal } from "@/components/chat/refusals";

interface RefusalRecoveryInput {
	chatId: string;
	error: SessionError | null;
	setMessages: (record: LannaMessage[], turnError?: string) => void;
	clearError: () => void;
	draftRef: { current: string | null };
	applyText: (text: string) => void;
	openSetup: () => void;
}

export function useRefusalRecovery({
	chatId,
	error,
	setMessages,
	clearError,
	draftRef,
	applyText,
	openSetup,
}: RefusalRecoveryInput): void {
	useEffect(() => {
		if (!error) return;
		const refused = parseModelsRefusal(error.message) !== null || parseProviderKeyRefusal(error.message);
		if (!refused) return;
		let cancelled = false;
		void (async () => {
			const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
			if (!cancelled && response.ok) {
				const record = (await response.json().catch(() => null)) as { messages?: LannaMessage[] } | null;
				if (Array.isArray(record?.messages)) setMessages(record.messages);
			}
			if (cancelled) return;
			if (draftRef.current !== null) {
				applyText(draftRef.current);
				draftRef.current = null;
			}
			clearError();
			openSetup();
		})();
		return () => {
			cancelled = true;
		};
	}, [error, chatId]);
}
