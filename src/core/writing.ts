export const WRITING_MAX_CHARS = 1600;
export const WRITING_TARGETS = 3;

export interface WritingTarget {
	slug: string;
	lemma: string;
	gloss: string;
}

export interface WritingFeedback {
	ok: boolean;
	feedback: string;
}

export interface WritingEntry {
	targets: WritingTarget[];
	text: string;
	reply: WritingFeedback | null;
	raw: string;
	usage: import("./reading.ts").StoryUsage;
	at: string;
}

export function writingKey(slugs: readonly string[], text: string): string {
	return JSON.stringify([[...slugs].sort(), text.normalize("NFC").trim()]);
}

export function parseWritingFeedback(text: string): WritingFeedback | null {
	try {
		const value = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, unknown>;
		if (typeof value.ok !== "boolean" || typeof value.feedback !== "string" || !value.feedback.trim()) return null;
		return { ok: value.ok, feedback: value.feedback.trim().slice(0, 1200) };
	} catch {
		return null;
	}
}
