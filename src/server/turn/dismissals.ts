import { ChatInputError, dismissAppends, emit, parseDismissInput } from "../../core";
import type { LannaMessage } from "../../core/chat-messages.ts";
import type { ChatStore } from "../../core/ports.ts";

type ParkedDismissal = ReturnType<typeof parseDismissInput>;

interface ParkedDismissalGlobal {
	__lhParkedDismissals?: Map<string, ParkedDismissal>;
}

function parkedByChat(): Map<string, ParkedDismissal> {
	const g = globalThis as typeof globalThis & ParkedDismissalGlobal;
	return (g.__lhParkedDismissals ??= new Map<string, ParkedDismissal>());
}

export function parkDismissal(chatId: string, dismissal: ParkedDismissal): void {
	parkedByChat().set(chatId, dismissal);
}

export function takeParkedDismissal(chatId: string): ParkedDismissal | null {
	const parked = parkedByChat().get(chatId) ?? null;
	parkedByChat().delete(chatId);
	return parked;
}

function dismissalAppends(record: { messages: LannaMessage[] }, dismissal: ParkedDismissal): LannaMessage[] | null {
	try {
		return dismissAppends(record, dismissal);
	} catch (err) {
		if (err instanceof ChatInputError) return null;
		throw err;
	}
}

export function applyParkedDismissal(chatStore: ChatStore, chatId: string): void {
	const dismissal = takeParkedDismissal(chatId);
	if (dismissal === null) return;
	const record = chatStore.getChat(chatId);
	if (!record) return;
	const appends = dismissalAppends(record, dismissal);
	if (!appends) return;
	chatStore.saveMessages(chatId, [...record.messages, ...appends]);
	emit("record-changed", { chatId });
}
