/**
 * "Why?" from a lesson (corpus, 2026-10-27) — behind
 * POST /api/why. The explanation for a (sentence, answer) pair is paid
 * for once: the profile's Why? index (data/profiles/<language>/lessons/
 * why-index.json, store/corpus.ts) remembers which chat answered it, and a
 * repeat question reopens that chat with no new model turn. A first
 * question creates the practice chat exactly as POST /api/chats does for
 * a Talk or Story (cheap slot) and records it in the index.
 */

import { activeLanguage } from "./active-language.ts";
import { chatStore } from "../store/chats.ts";
import { countWhyReuse, findWhy, forgetWhy, rememberWhy, whyKey } from "../store/corpus.ts";
import { readSettings } from "../store/settings.ts";
import { titleFromPrompt } from "../core/title.ts";
import { CHAT_THINKING_LEVEL } from "../core/settings.ts";

interface WhyRequest {
	title: string;
	sentence: string;
	answer: string;
	lemma: string;
	given: string;
}

interface WhyOutcome {
	id: string;
	/** True = an earlier chat for the same sentence was reopened; nothing was generated. */
	reused: boolean;
}

export function openWhy(req: WhyRequest, now = new Date()): WhyOutcome {
	const lang = activeLanguage().code;
	const key = whyKey(lang, req.sentence, req.answer);
	const known = findWhy(key);
	if (known) {
		if (chatStore.getChat(known.chatId)) {
			countWhyReuse(key);
			return { id: known.chatId, reused: true };
		}
		forgetWhy(key); // the chat was deleted — ask again
	}
	const chat = chatStore.createChat(titleFromPrompt(req.title || `Why ${req.answer}?`), "chat");
	const models = readSettings()?.models;
	const slot = (models?.cheap?.model ? models.cheap : models?.strong) ?? null;
	if (slot?.model) {
		chatStore.saveSettings(chat.id, {
			model: { provider: slot.model.provider, id: slot.model.id },
			thinkingLevel: CHAT_THINKING_LEVEL,
		});
	}
	rememberWhy({
		key,
		lang,
		sentence: req.sentence,
		answer: req.answer,
		lemma: req.lemma,
		given: req.given,
		chatId: chat.id,
		createdAt: now.toISOString(),
	});
	return { id: chat.id, reused: false };
}
