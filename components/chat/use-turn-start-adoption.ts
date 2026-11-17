import { useEffect, useRef } from "react";
import type { SessionStatus } from "@/components/session/state";

const TURN_START_FETCH_DELAYS_MS = [400, 1000, 2000];

export function useTurnStartAdoption(status: SessionStatus, adoptAppendOnly: () => Promise<void>): void {
	const previousStatus = useRef(status);
	const windowOpen = useRef(false);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

	useEffect(() => {
		const was = previousStatus.current;
		previousStatus.current = status;
		if (was === "submitted" || status !== "submitted") return;
		windowOpen.current = true;
		for (const delay of TURN_START_FETCH_DELAYS_MS) {
			timers.current.push(
				setTimeout(() => {
					if (windowOpen.current) void adoptAppendOnly();
				}, delay),
			);
		}
	}, [status, adoptAppendOnly]);

	useEffect(() => {
		return () => {
			windowOpen.current = false;
			timers.current.forEach((timer) => clearTimeout(timer));
			timers.current = [];
		};
	}, []);
}
