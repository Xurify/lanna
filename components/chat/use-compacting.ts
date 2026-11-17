import { useState } from "react";
import { useServerEvent } from "@/components/server-events";

export function useCompacting(chatId: string, initiallyCompacting: boolean): boolean {
	const [compacting, setCompacting] = useState(initiallyCompacting);

	useServerEvent("compaction-changed", (payload) => {
		if (payload.chatId === chatId) setCompacting(payload.running);
	});

	return compacting;
}
