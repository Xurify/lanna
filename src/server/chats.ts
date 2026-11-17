import { titleFromPrompt } from "../core/title.ts";
import { deletePastJobsForChat } from "../store/jobs.ts";
import { stores } from "./stores.ts";
import { isTurnRunning } from "./turn-liveness.ts";
import { clearTurnFailure } from "./turn-runs.ts";
import { discardChatSteers } from "./steers.ts";

/**
 * Server-side chat entries for the transport layer (app/api/chats*,
 * app/chat/[id]). Today these delegate straight to the ChatStore port; the
 * services stage carves the real orchestration behind this same surface.
 *
 * deleteChatSession is the one real orchestration here: a gate, then one
 * synchronous deletion block.
 */

export const { createChat, getChat, listChats } = stores.chatStore;
export { restoreChat, trashedChat } from "../store/chats.ts";
export { titleFromPrompt };

/** What deleteChatSession did — the route maps it straight to HTTP. */
type ChatDeleteOutcome =
	| { ok: false; status: 404; code: "not_found"; error: string }
	| { ok: false; status: 409; code: "turn_in_flight"; error: string }
	| { ok: true };

/** Delete a session. A turn in flight refuses with 409 (it writes the chat record; deleting mid-flight would corrupt the write-ahead flow); the UI retries once it ends. Job files of older chats go with the chat, which carried their cost. */
export function deleteChatSession(chatId: string): ChatDeleteOutcome {
	if (!stores.chatStore.getChat(chatId)) {
		return { ok: false, status: 404, code: "not_found", error: "No such session" };
	}
	if (isTurnRunning(chatId)) {
		return {
			ok: false,
			status: 409,
			code: "turn_in_flight",
			error: "A turn is running in this session — try again when it finishes",
		};
	}
	deletePastJobsForChat(chatId);
	if (stores.chatStore.deleteChat(chatId)) {
		discardChatSteers(chatId);
		clearTurnFailure(chatId);
	}
	return { ok: true };
}
