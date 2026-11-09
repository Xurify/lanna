export type BoardPhrase = { phrase: string; meaning: string };

const GLOSSED = /`say:\s*([^`]+?)\s*`\s*(?:=\s*|\(\s*)(?:["“]([^"”\n]+)["”]|([^"”)\n]+?)\s*(?:\)|[.,;:]|$|\s(?=[A-Z])))/gm;

export function boardPhrases(replies: readonly string[]): BoardPhrase[] {
	const seen = new Set<string>();
	const found: BoardPhrase[] = [];
	for (const reply of replies) {
		for (const match of reply.replace(/```[\s\S]*?(?:```|$)/g, "").matchAll(GLOSSED)) {
			const phrase = match[1]!.trim();
			const meaning = (match[2] ?? match[3] ?? "").trim().replace(/[.,;:]+$/, "");
			const key = phrase.toLowerCase();
			if (!meaning || seen.has(key)) continue;
			seen.add(key);
			found.push({ phrase, meaning });
		}
	}
	return found;
}

export function latestDrawing(replies: readonly string[]): string | null {
	for (let i = replies.length - 1; i >= 0; i--) {
		const fences = [...replies[i]!.matchAll(/```svg\s*\n([\s\S]*?)```/g)];
		if (fences.length > 0) return fences.at(-1)![1]!;
	}
	return null;
}
