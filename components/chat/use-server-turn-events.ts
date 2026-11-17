import { useServerEvent } from "@/components/server-events";
import type { SessionStatus } from "@/components/session/state";

interface ServerTurnEventsInput {
	chatId: string;
	status: SessionStatus;
	localStream: boolean;
	turnInFlight: boolean;
	attachToRunningTurn: () => void;
	setTurnInFlight: (inFlight: boolean) => void;
	clearError: () => void;
	syncFromServer: () => Promise<void>;
	settleAnnouncedRef: { current: boolean };
}

export function useServerTurnEvents({
	chatId,
	status,
	localStream,
	turnInFlight,
	attachToRunningTurn,
	setTurnInFlight,
	clearError,
	syncFromServer,
	settleAnnouncedRef,
}: ServerTurnEventsInput): void {
	useServerEvent("turn-started", (payload) => {
		if (payload.chatId !== chatId) return;
		if (localStream || turnInFlight) return;
		attachToRunningTurn();
	});

	useServerEvent("turn-settled", (payload) => {
		if (payload.chatId !== chatId) return;
		if (localStream) {
			settleAnnouncedRef.current = true;
			return;
		}
		if (turnInFlight) {
			if (status === "error") {
				setTurnInFlight(false);
				clearError();
				void syncFromServer();
			}
			return;
		}
		void syncFromServer();
	});

	useServerEvent("record-changed", (payload) => {
		if (payload.chatId !== chatId) return;
		if (localStream || turnInFlight) return;
		void syncFromServer();
	});
}
