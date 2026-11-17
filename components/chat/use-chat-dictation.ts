import { useEffect, useRef, type RefObject } from "react";
import { joinDictation, useDictation } from "@/components/dictation";

interface ChatDictationInput {
	textRef: { readonly current: string };
	applyText: (text: string) => void;
	composerInputRef: RefObject<HTMLTextAreaElement | null>;
}

export function useChatDictation({ textRef, applyText, composerInputRef }: ChatDictationInput) {
	const dictation = useDictation({ append: (text) => applyText(joinDictation(textRef.current, text)) });
	const wasActiveRef = useRef(false);

	useEffect(() => {
		if (dictation.active) {
			wasActiveRef.current = true;
		} else if (wasActiveRef.current) {
			wasActiveRef.current = false;
			composerInputRef.current?.focus();
		}
	}, [dictation.active]);

	return dictation;
}

export type ChatDictation = ReturnType<typeof useChatDictation>;
