import { newNextMessage, newThinkingMessage, newUserMessage, type ChatInput, type LannaMessage } from "../../src/core";
import { localId } from "./local-id";

export function optimisticEntries(input: ChatInput): LannaMessage[] {
	switch (input.type) {
		case "text":
			return [{ ...newUserMessage(input.text), id: localId() }];
		case "thinking":
			return [{ ...newThinkingMessage(input.problemCallId, input.text), id: localId() }];
		case "next":
			return [{ ...newNextMessage(), id: localId() }];
		case "continue":
			return [];
	}
}
