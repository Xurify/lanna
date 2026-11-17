import type { LannaMessage } from "../../src/core";
import { isLocalId } from "./local-id";

export function absorbed(message: LannaMessage, record: readonly LannaMessage[]): boolean {
	if (!isLocalId(message.id)) return false;
	switch (message.role) {
		case "user":
			return record.some((entry) => entry.role === "user" && entry.content === message.content);
		case "toolResult":
			return record.some((entry) => entry.role === "toolResult" && entry.toolCallId === message.toolCallId);
		case "custom":
			return record.some(
				(entry) =>
					entry.role === "custom" &&
					entry.customType === message.customType &&
					sameDetails(entry.details, message.details),
			);
		default:
			return false;
	}
}

function sameDetails(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}
