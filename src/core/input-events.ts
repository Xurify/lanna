import {
	activeProblemOf,
	concludedByDismissalPair,
	newNextMessage,
	newProblemDismissedMarker,
	newThinkingMessage,
	newUserMessage,
	pendingProblemDismissalOf,
	type LannaMessage,
} from "./chat-messages.ts";

export type ChatInput =
	| { type: "text"; text: string }
	| { type: "continue" }
	| { type: "thinking"; problemCallId: string; text: string }
	| { type: "next" };

export type TurnInput = ChatInput;

type DismissInput = { type: "dismiss-problem"; problemCallId: string };

type UserSteerInput = { type: "steer"; id: string; text: string };

export class ChatInputError extends Error {}

export function parseChatInput(input: unknown): ChatInput {
	if (typeof input !== "object" || input === null) throw new ChatInputError("input must be an object");
	const i = input as Record<string, unknown>;
	switch (i.type) {
		case "text":
			if (typeof i.text !== "string" || (i.text as string).trim().length === 0) {
				throw new ChatInputError("text input requires non-empty text");
			}
			return { type: "text", text: i.text };
		case "continue":
			return { type: "continue" };
		case "thinking":
			if (typeof i.problemCallId !== "string" || i.problemCallId.length === 0) {
				throw new ChatInputError("thinking input requires problemCallId");
			}
			if (typeof i.text !== "string" || i.text.trim().length === 0) {
				throw new ChatInputError("thinking input requires non-empty text");
			}
			return { type: "thinking", problemCallId: i.problemCallId, text: i.text };
		case "next":
			return { type: "next" };
		default:
			throw new ChatInputError(`unknown input type: ${String(i.type)}`);
	}
}

export function inputAppends(record: { messages: LannaMessage[]; kind?: string }, input: ChatInput): LannaMessage[] {
	switch (input.type) {
		case "text":
			return [...dismissalConclusion(record), newUserMessage(input.text)];
		case "continue":
			return dismissalConclusion(record);
		case "thinking": {
			const active = activeProblemOf(record.messages);
			if (!active || active.toolCallId !== input.problemCallId) {
				throw new ChatInputError("thinking input targets no active problem");
			}
			return [...dismissalConclusion(record), newThinkingMessage(input.problemCallId, input.text)];
		}
		case "next": {
			if (record.kind !== "practice") {
				throw new ChatInputError("next input is a practice-session affordance");
			}
			if (activeProblemOf(record.messages)) {
				throw new ChatInputError("next input requires no active problem");
			}
			return [...dismissalConclusion(record), newNextMessage()];
		}
	}
}

export function parseDismissInput(input: unknown): DismissInput {
	if (typeof input !== "object" || input === null) throw new ChatInputError("input must be an object");
	const i = input as Record<string, unknown>;
	if (i.type !== "dismiss-problem") throw new ChatInputError(`unknown input type: ${String(i.type)}`);
	if (typeof i.problemCallId !== "string" || i.problemCallId.length === 0) {
		throw new ChatInputError("dismiss-problem input requires problemCallId");
	}
	return { type: "dismiss-problem", problemCallId: i.problemCallId };
}

export function dismissAppends(record: { messages: LannaMessage[] }, input: DismissInput): LannaMessage[] {
	const active = activeProblemOf(record.messages);
	if (!active || active.toolCallId !== input.problemCallId) {
		throw new ChatInputError("dismiss-problem input targets no active problem");
	}
	return [newProblemDismissedMarker(input.problemCallId)];
}

export function parseUserSteerInput(input: unknown): UserSteerInput {
	if (typeof input !== "object" || input === null) throw new ChatInputError("input must be an object");
	const i = input as Record<string, unknown>;
	if (i.type !== "steer") throw new ChatInputError(`unknown input type: ${String(i.type)}`);
	if (typeof i.id !== "string" || i.id.length === 0) {
		throw new ChatInputError("steer input requires a client-minted id");
	}
	if (typeof i.text !== "string" || i.text.trim().length === 0) {
		throw new ChatInputError("steer input requires non-empty text");
	}
	return { type: "steer", id: i.id, text: i.text };
}

function dismissalConclusion(record: { messages: LannaMessage[] }): LannaMessage[] {
	const problemCallId = pendingProblemDismissalOf(record.messages);
	return problemCallId ? concludedByDismissalPair(problemCallId) : [];
}
