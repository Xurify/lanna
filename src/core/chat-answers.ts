export type ChatVerdict = "right" | "slip" | "wrong" | "dont_know";

export interface ChatAnswer {
	at: string;
	chatId: string;
	verdict: ChatVerdict;
	given: string;
	expected: string;
	focus: string;
	hinted: boolean;
	/** The course unit the question tested, when it tested one (a UnitId). */
	unit?: string;
}

export interface ChatScore {
	asked: number;
	firstTryRight: number;
	misses: string[];
}

type ToolPart = { type: string; input?: unknown };

export const CHAT_RECORD_TOOLS: ReadonlySet<string> = new Set(["pose", "grade", "add_to_review", "draw"]);
const CHAT_ONLY_TOOLS: ReadonlySet<string> = new Set(["pose", "grade", "draw"]);

type ReplyBlock = { type: string; name?: string; text?: string };

export function closesChatReply(content: readonly ReplyBlock[]): boolean {
	const calls = content.filter((b) => b.type === "toolCall");
	return (
		calls.length > 0 &&
		calls.every((b) => b.name !== undefined && CHAT_RECORD_TOOLS.has(b.name)) &&
		content.some((b) => b.type === "text" && (b.text ?? "").trim().length > 0)
	);
}

export function chatTurnEnded(content: readonly ReplyBlock[]): boolean {
	return (
		closesChatReply(content) &&
		content.some((b) => b.type === "toolCall" && b.name !== undefined && CHAT_ONLY_TOOLS.has(b.name))
	);
}

export function chatScore(messages: ReadonlyArray<{ role: string; parts: readonly ToolPart[] }>): ChatScore {
	let open = false;
	let asked = 0;
	let firstTryRight = 0;
	const misses: string[] = [];
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const part of message.parts) {
			if (part.type === "tool-pose") {
				open = true;
				asked++;
				continue;
			}
			if (part.type !== "tool-grade" || !open) continue;
			const input = part.input as { verdict?: ChatVerdict; hinted?: boolean; focus?: string } | undefined;
			if (!input?.verdict) continue;
			open = false;
			if ((input.verdict === "right" || input.verdict === "slip") && !input.hinted) firstTryRight++;
			else if (input.focus && !misses.includes(input.focus)) misses.push(input.focus);
		}
	}
	return { asked, firstTryRight, misses };
}

export function questionOpen(messages: ReadonlyArray<{ role: string; parts: readonly ToolPart[] }>): boolean {
	let open = false;
	for (const message of messages) {
		if (message.role !== "assistant") continue;
		for (const part of message.parts) {
			if (part.type === "tool-pose") open = true;
			else if (part.type === "tool-grade")
				open = (part.input as { verdict?: ChatVerdict } | undefined)?.verdict === "wrong";
		}
	}
	return open;
}
