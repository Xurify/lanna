import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatInput } from "@/src/core";
import type { SessionError } from "@/components/session/state";

interface HeldAnswerInput {
	busy: boolean;
	compacting: boolean;
	error: SessionError | null;
	send: (input: ChatInput) => void;
	applyText: (text: string) => void;
	draftRef: { current: string | null };
}

export function useHeldAnswer({ busy, compacting, error, send, applyText, draftRef }: HeldAnswerInput) {
	const heldRef = useRef<string | null>(null);
	const [heldAnswer, setHeldAnswer] = useState<string | null>(null);

	const holdAnswer = useCallback((text: string) => {
		const next = heldRef.current ? `${heldRef.current}\n${text}` : text;
		heldRef.current = next;
		setHeldAnswer(next);
	}, []);

	const releaseHeldAnswer = useCallback(() => {
		if (heldRef.current === null) return;
		applyText(heldRef.current);
		heldRef.current = null;
		setHeldAnswer(null);
	}, [applyText]);

	useEffect(() => {
		if (busy || compacting || heldAnswer === null) return;
		if (error) {
			applyText(heldAnswer);
			heldRef.current = null;
			setHeldAnswer(null);
			return;
		}
		draftRef.current = heldAnswer;
		heldRef.current = null;
		setHeldAnswer(null);
		send({ type: "text", text: heldAnswer });
	}, [busy, compacting, error, heldAnswer, send, applyText]);

	return { heldAnswer, holdAnswer, releaseHeldAnswer };
}
