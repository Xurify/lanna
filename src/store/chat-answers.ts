import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import type { ChatAnswer } from "../core/chat-answers.ts";

export function chatAnswersFile(): string {
	return path.join(PATHS.chats, "answers.jsonl");
}

export function appendChatAnswer(answer: ChatAnswer): void {
	fs.mkdirSync(PATHS.chats, { recursive: true });
	fs.appendFileSync(chatAnswersFile(), `${JSON.stringify(answer)}\n`);
}

export function readChatAnswers(): ChatAnswer[] {
	try {
		return fs
			.readFileSync(chatAnswersFile(), "utf-8")
			.split("\n")
			.filter(Boolean)
			.flatMap((line) => {
				try {
					return [JSON.parse(line) as ChatAnswer];
				} catch {
					return [];
				}
			});
	} catch {
		return [];
	}
}
