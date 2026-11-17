import { useCallback, useEffect, useState } from "react";
import type { LannaMessage, SessionPricing, TurnUsage } from "@/src/core";
import type { SessionKind } from "@/components/session/state";

interface SessionRecordInput {
	chatId: string;
	kind: SessionKind;
	setMessages: (record: LannaMessage[], turnError?: string) => void;
	continueIfOwed: (record: readonly LannaMessage[], kind: SessionKind) => void;
	adoptRecord: (record: LannaMessage[]) => void;
}

interface RecordPayload {
	messages?: LannaMessage[];
	turns?: TurnUsage[];
	pricing?: SessionPricing;
	turnError?: string;
}

export function useSessionRecord({ chatId, kind, setMessages, continueIfOwed, adoptRecord }: SessionRecordInput) {
	const [turns, setTurns] = useState<TurnUsage[]>([]);
	const [pricing, setPricing] = useState<SessionPricing | undefined>();

	const syncTurns = useCallback(async () => {
		try {
			const response = await fetch(`/api/chats/${chatId}`);
			if (!response.ok) return;
			const record = (await response.json()) as RecordPayload;
			if (Array.isArray(record.turns)) setTurns(record.turns);
			setPricing(record.pricing);
		} catch {
			return;
		}
	}, [chatId]);

	useEffect(() => {
		void syncTurns();
	}, [syncTurns]);

	const syncFromServer = useCallback(async () => {
		const response = await fetch(`/api/chats/${chatId}`);
		if (!response.ok) return;
		const record = (await response.json()) as RecordPayload;
		if (Array.isArray(record.turns)) setTurns(record.turns);
		setPricing(record.pricing);
		if (!Array.isArray(record.messages)) return;
		setMessages(record.messages, record.turnError);
		continueIfOwed(record.messages, kind);
	}, [chatId, setMessages, continueIfOwed, kind]);

	const adoptAppendOnly = useCallback(async () => {
		try {
			const response = await fetch(`/api/chats/${chatId}`);
			if (!response.ok) return;
			const record = (await response.json()) as { messages?: LannaMessage[] };
			if (!Array.isArray(record.messages)) return;
			adoptRecord(record.messages);
		} catch {
			return;
		}
	}, [chatId, adoptRecord]);

	return { turns, pricing, syncTurns, syncFromServer, adoptAppendOnly };
}
