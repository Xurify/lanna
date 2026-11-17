import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { LannaMessage } from "../../core/chat-messages.ts";
import { newMessageId } from "../../core/chat-messages.ts";
import type { ChatStore } from "../../core/ports.ts";
import { recordActivity } from "../lesson.ts";

const OPENING_USER_MESSAGES = 1;

export class TurnPersistenceError extends Error {
	constructor(cause: unknown) {
		super("The reply could not be saved.", { cause });
		this.name = "TurnPersistenceError";
	}
}

function withMessageId(message: LannaMessage): LannaMessage {
	return message.id ? message : ({ ...message, id: newMessageId() } as LannaMessage);
}

function learnerHasTyped(messages: readonly LannaMessage[]): boolean {
	return messages.filter((message) => message.role === "user").length > OPENING_USER_MESSAGES;
}

export function persistTurn(
	chatStore: ChatStore,
	chatId: string,
	baseCount: number,
	turnMessages: readonly AgentMessage[],
	isAborted: boolean,
): LannaMessage[] {
	try {
		const record = chatStore.getChat(chatId);
		if (!record) throw new Error(`Chat not found: ${chatId}`);
		const stamped = turnMessages.slice(baseCount).map((message) => withMessageId(message as LannaMessage));
		const messages = [...record.messages, ...stamped];
		chatStore.saveMessages(chatId, messages);
		if (record.tutorUnit && !record.tutorCounted && learnerHasTyped(messages)) {
			chatStore.markTutorCounted(chatId);
			recordActivity("tutor", record.tutorUnit);
		}
		return stamped;
	} catch (err) {
		console.error(`[chat ${chatId}] persist failed:`, err, { isAborted });
		throw new TurnPersistenceError(err);
	}
}
