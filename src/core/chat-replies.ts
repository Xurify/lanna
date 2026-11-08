export const REPLIES_TO_A_QUESTION = ["Hint", "I don't know", "Explain it another way"] as const;
export const REPLIES_AFTER_AN_ANSWER = ["Quiz me", "Explain it another way", "Draw it"] as const;

export function endsWithQuestion(reply: string): boolean {
	const prose = reply.replace(/```[\s\S]*?(?:```|$)/g, "").trim();
	const lastParagraph = prose.split(/\n\s*\n/).at(-1)?.trim() ?? "";
	return /\?["'”’)*_\s]*$/.test(lastParagraph);
}

export function quickReplies(reply: string, open?: boolean): readonly string[] {
	if (reply.trim().length === 0) return [];
	return (open ?? endsWithQuestion(reply)) ? REPLIES_TO_A_QUESTION : REPLIES_AFTER_AN_ANSWER;
}

export function repeatsEarlierText(parts: ReadonlyArray<{ type: string; text?: string }>, index: number): boolean {
	const text = parts[index]?.text?.trim();
	if (!text) return false;
	return parts.slice(0, index).some((part) => part.type === "text" && part.text?.trim() === text);
}
