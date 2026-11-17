import { useEffect } from "react";
import { kbdEventForAction } from "@/src/core";
import { currentUserThinkingOpen, setAllUserThinkingOpen } from "@/components/thinking-block";

export function useThinkingToggle(): void {
	useEffect(() => {
		const eventName = kbdEventForAction("toggle-user-thinking");
		const onToggle = () => setAllUserThinkingOpen(!currentUserThinkingOpen());
		window.addEventListener(eventName, onToggle);
		return () => window.removeEventListener(eventName, onToggle);
	}, []);
}
