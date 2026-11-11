import type { ChatAnswer } from "../core/chat-answers.ts";
import { chatMissesOnUnit } from "../core/chat-analysis.ts";
import { noteChatAnswer } from "../core/weak-spots.ts";
import { appendChatAnswer, readChatAnswers } from "../store/chat-answers.ts";
import { progressStore } from "../store/progress.ts";
import { refreshChatSnapshot } from "./mistakes-snapshot.ts";

export function recordChatAnswer(answer: ChatAnswer, now = new Date()): void {
	appendChatAnswer(answer);
	try {
		if (answer.unit) {
			const p = progressStore.read();
			const weak = noteChatAnswer(p.weak ?? {}, answer, chatMissesOnUnit(readChatAnswers(), answer.unit, now), now);
			if (weak !== (p.weak ?? {})) {
				p.weak = weak;
				progressStore.write(p);
			}
		}
		refreshChatSnapshot(now);
	} catch (err) {
		console.warn("[chat] could not update the weak spots from a graded answer:", err instanceof Error ? err.message : err);
	}
}
