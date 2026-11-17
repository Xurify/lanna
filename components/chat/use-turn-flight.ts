import { useCallback, useEffect, useState } from "react";
import type { SessionStatus } from "@/components/session/state";

interface TurnFlightInput {
	initiallyInFlight: boolean | undefined;
	status: SessionStatus;
	resumeStream: () => void;
	syncFromServer: () => Promise<void>;
}

export function useTurnFlight({ initiallyInFlight, status, resumeStream, syncFromServer }: TurnFlightInput) {
	const [turnInFlight, setTurnInFlight] = useState(initiallyInFlight ?? false);

	useEffect(() => {
		if (turnInFlight && (status === "submitted" || status === "streaming")) setTurnInFlight(false);
	}, [status, turnInFlight]);

	const attachToRunningTurn = useCallback(() => {
		setTurnInFlight(true);
		resumeStream();
	}, [resumeStream]);

	const settleAttachedTurn = useCallback(() => {
		setTurnInFlight(false);
		void syncFromServer();
	}, [syncFromServer]);

	return { turnInFlight, setTurnInFlight, attachToRunningTurn, settleAttachedTurn };
}
