import { useEffect, useRef } from "react";
import type { ChatInput, LannaMessage } from "@/src/core";
import type { SessionKind } from "@/components/session/state";

function initialPromptOwed(messages: readonly { role: string }[], prompt: string | undefined): boolean {
	if (!prompt) return false;
	return !messages.some((message) => message.role === "user" || message.role === "assistant");
}

interface SessionStartInput {
	initialMessages: LannaMessage[];
	initialPrompt: string | undefined;
	kind: SessionKind;
	turnInFlight: boolean;
	send: (input: ChatInput) => void;
	continueIfOwed: (record: readonly LannaMessage[], kind: SessionKind) => void;
}

export function useSessionStart({
	initialMessages,
	initialPrompt,
	kind,
	turnInFlight,
	send,
	continueIfOwed,
}: SessionStartInput): void {
	const sentInitial = useRef(false);
	useEffect(() => {
		if (sentInitial.current || !initialPrompt || !initialPromptOwed(initialMessages, initialPrompt)) return;
		sentInitial.current = true;
		send({ type: "text", text: initialPrompt });
	}, [initialPrompt, initialMessages, send]);

	const continuationChecked = useRef(false);
	useEffect(() => {
		if (continuationChecked.current) return;
		continuationChecked.current = true;
		if (!turnInFlight) continueIfOwed(initialMessages, kind);
	}, []);
}
