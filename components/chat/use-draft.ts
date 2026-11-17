import { useCallback, useRef, useState } from "react";
import { splitDraft } from "@/src/core";

// A closure that awaits a promise cannot read a state value set meanwhile, so the ref mirror is the one read.
export function useDraft() {
	const [text, setText] = useState("");
	const textRef = useRef("");

	const applyText = useCallback((value: string) => {
		textRef.current = value;
		setText(value);
	}, []);

	return { text, textRef, applyText, parts: splitDraft(text) };
}
