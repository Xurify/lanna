import { useEffect, useRef } from "react";
import type { SessionStatus } from "@/components/session/state";

interface SettleSyncInput {
	status: SessionStatus;
	syncTurns: () => Promise<void>;
	syncFromServer: () => Promise<void>;
	settleAnnouncedRef: { current: boolean };
}

export function useSettleSync({ status, syncTurns, syncFromServer, settleAnnouncedRef }: SettleSyncInput): void {
	const previousStatus = useRef(status);

	useEffect(() => {
		const transitioned = previousStatus.current !== "ready" && status === "ready";
		previousStatus.current = status;
		if (!transitioned) return;
		void syncTurns();
		if (settleAnnouncedRef.current) {
			settleAnnouncedRef.current = false;
			void syncFromServer();
		}
	}, [status, syncTurns, syncFromServer, settleAnnouncedRef]);
}

interface StreamFailureInput {
	chatId: string;
	status: SessionStatus;
	setTurnInFlight: (inFlight: boolean) => void;
	syncFromServer: () => Promise<void>;
}

export function useStreamFailureRecovery({
	chatId,
	status,
	setTurnInFlight,
	syncFromServer,
}: StreamFailureInput): void {
	const previousStatus = useRef(status);

	useEffect(() => {
		const was = previousStatus.current;
		previousStatus.current = status;
		if (was === "error" || status !== "error") return;
		let cancelled = false;
		void (async () => {
			try {
				const response = await fetch(`/api/chats/${chatId}`);
				if (!response.ok || cancelled) return;
				const record = (await response.json()) as { turnInFlight?: boolean };
				if (cancelled) return;
				if (record.turnInFlight === true) setTurnInFlight(true);
				else void syncFromServer();
			} catch {
				return;
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [status, chatId, syncFromServer]);
}
