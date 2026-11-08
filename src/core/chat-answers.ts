export type ChatVerdict = "right" | "slip" | "wrong" | "dont_know";

export interface ChatAnswer {
	at: string;
	chatId: string;
	verdict: ChatVerdict;
	given: string;
	expected: string;
	focus: string;
	hinted: boolean;
}

export interface ChatScore {
	asked: number;
	firstTryRight: number;
	misses: string[];
}

type ToolPart = { type: string; input?: unknown };

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
			else if (part.type === "tool-grade") open = false;
		}
	}
	return open;
}
