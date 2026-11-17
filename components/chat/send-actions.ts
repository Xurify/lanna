import type { ChatInput } from "@/src/core";
import type { SessionKind } from "@/components/session/state";
import type { ChatDictation } from "@/components/chat/use-chat-dictation";

export interface SendActionsInput {
	kind: SessionKind;
	busy: boolean;
	compacting: boolean;
	dictation: ChatDictation;
	textRef: { readonly current: string };
	applyText: (text: string) => void;
	draftRef: { current: string | null };
	send: (input: ChatInput) => void;
	steer: (text: string) => void;
	holdAnswer: (text: string) => void;
}

export interface SendActions {
	onSend: () => void;
	sendQuickReply: (reply: string) => void;
}

export function sendActionsFor(input: SendActionsInput): SendActions {
	const sendDraft = () => {
		if (input.busy || input.compacting) return;
		const text = input.textRef.current.trim();
		if (!text) return;
		input.draftRef.current = text;
		input.applyText("");
		input.send({ type: "text", text });
	};

	const steerOrSend = () => {
		if (input.compacting) return;
		const text = input.textRef.current.trim();
		if (!text) return;
		if (input.busy && input.kind === "chat") {
			input.applyText("");
			input.holdAnswer(text);
			return;
		}
		if (input.busy) {
			input.applyText("");
			input.steer(text);
			return;
		}
		sendDraft();
	};

	return {
		onSend: () => {
			if (input.compacting) return;
			if (!input.dictation.active) {
				steerOrSend();
				return;
			}
			void input.dictation.finish().then(steerOrSend);
		},
		sendQuickReply: (reply: string) => {
			if (input.busy || input.compacting) return;
			input.send({ type: "text", text: reply });
		},
	};
}
