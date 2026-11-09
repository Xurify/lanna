import type { ChatVerdict } from "./chat-answers.ts";
import { REPLIES_AFTER_AN_ANSWER, REPLIES_TO_A_QUESTION } from "./chat-replies.ts";

export interface AnswerGrade {
	verdict: ChatVerdict;
	hinted: boolean;
}

export type LearnerLine = { kind: "title" | "ask" | "request" } | { kind: "answer"; grade: AnswerGrade | null };

export type AnswerTone = "right" | "near" | "miss" | "shown";

export interface AnswerMark {
	tone: AnswerTone;
	label: string;
}

type Part = { type: string; text?: string; input?: unknown };
type Line = { role: string; parts: readonly Part[] };

const REQUESTS: ReadonlySet<string> = new Set([...REPLIES_TO_A_QUESTION, ...REPLIES_AFTER_AN_ANSWER]);

export function messageText(message: Line): string {
	return message.parts.flatMap((p) => (p.type === "text" && p.text ? [p.text] : [])).join("\n");
}

export function learnerLines(messages: readonly Line[]): Map<number, LearnerLine> {
	const lines = new Map<number, LearnerLine>();
	let questionOpen = false;
	let awaitingGrade: { kind: "answer"; grade: AnswerGrade | null } | null = null;
	for (const [index, message] of messages.entries()) {
		if (message.role === "assistant") {
			for (const part of message.parts) {
				if (part.type === "tool-pose") questionOpen = true;
				if (part.type !== "tool-grade") continue;
				const input = part.input as { verdict?: ChatVerdict; hinted?: boolean } | undefined;
				if (!input?.verdict) continue;
				if (awaitingGrade && !awaitingGrade.grade) awaitingGrade.grade = { verdict: input.verdict, hinted: input.hinted === true };
				questionOpen = input.verdict === "wrong";
			}
			continue;
		}
		if (message.role !== "user") continue;
		const text = messageText(message).trim();
		if (!text) continue;
		awaitingGrade = null;
		if (lines.size === 0) lines.set(index, { kind: "title" });
		else if (REQUESTS.has(text)) lines.set(index, { kind: "request" });
		else if (questionOpen && !text.endsWith("?")) {
			awaitingGrade = { kind: "answer", grade: null };
			lines.set(index, awaitingGrade);
		} else lines.set(index, { kind: "ask" });
	}
	return lines;
}

export function answerMark(grade: AnswerGrade): AnswerMark {
	if (grade.verdict === "wrong") return { tone: "miss", label: "Not yet" };
	if (grade.verdict === "dont_know") return { tone: "shown", label: "Skipped" };
	if (grade.verdict === "slip") return { tone: "near", label: "Right, check the spelling" };
	return grade.hinted ? { tone: "near", label: "Right, with a hint" } : { tone: "right", label: "Right" };
}
