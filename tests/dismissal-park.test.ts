/**
 * PARKED DISMISSALS (owner, 2026-10-04): ESC-discard while the turn is
 * still working. Mid-turn the stored record holds no pending question or
 * problem (the turn's messages land at settle), so the dismiss route
 * cannot validate — it PARKS the intent (202) and the turn's settle path
 * applies it against the freshly persisted record, only if the dismissed
 * thing really is pending there.
 *
 * These pins hold both halves: the pure park registry + apply against
 * fixture records, and the route's park contract under an isolated
 * LANNA_DATA_DIR (the birth-stamp discipline — the seam is set before any
 * config-loading import, every app-module import dynamic).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

// ── the seam, BEFORE any config-loading import ──────────────────────────────
const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-dismissals-"));
process.env.LANNA_DATA_DIR = TMP_DATA;

const { chatStore } = await import("../src/store/chats.ts");
const { applyParkedDismissal, parkDismissal, takeParkedDismissal } = await import("../src/server/turn/dismissals.ts");
const { subscribe } = await import("../src/core/events.ts");
const { activeProblemOf } = await import("../src/core/index.ts");
const newMessageId = (await import("../src/core/chat-messages.ts")).newMessageId;

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

/** A record whose newest assistant message carries a DANGLING quiz call —
 *  the settled state a mid-turn dismissal parks against. */
function chatWithDanglingQuiz(id: string): string {
	const chat = chatStore.createChat("park: dangling quiz");
	chatStore.saveMessages(chat.id, [
		{
			id: newMessageId(),
			role: "assistant",
			content: [
				{ type: "text", text: "Quick check:" },
				{
					type: "toolCall",
					id: `${id}-q1`,
					name: "quiz",
					arguments: { question: "What is a cyclic group?" },
				},
			],
		} as never,
	]);
	return chat.id;
}

/** A record with an ACTIVE problem — the settled practice state a
 *  dismiss-problem park applies against. */
function chatWithActiveProblem(): string {
	const chat = chatStore.createChat("park: active problem");
	const assistant = {
		id: newMessageId(),
		role: "assistant",
		content: [
			{
				type: "toolCall",
				id: "call-prob-1",
				name: "problem",
				arguments: { statement: "Prove |G|=p ⇒ cyclic", mode: "recall" },
			},
		],
	} as never;
	chatStore.saveMessages(chat.id, [assistant]);
	return chat.id;
}

describe("the park registry", () => {
	it("parks and takes (take drains — the second read is null)", () => {
		parkDismissal("chat_x", { type: "dismiss-problem", problemCallId: "p" });
		assert.deepEqual(takeParkedDismissal("chat_x"), { type: "dismiss-problem", problemCallId: "p" });
		assert.equal(takeParkedDismissal("chat_x"), null);
	});

	it("apply with nothing parked is a no-op (no write, no emit)", () => {
		const chat = chatWithDanglingQuiz("noop");
		const before = chatStore.getChat(chat)!.messages.length;
		let emitted = 0;
		const off = subscribe((e) => {
			if (e.type === "record-changed" && e.chatId === chat) emitted++;
		});
		applyParkedDismissal(chatStore, chat);
		off();
		assert.equal(emitted, 0);
		assert.equal(chatStore.getChat(chat)!.messages.length, before);
	});
});

describe("applyParkedDismissal — against real records", () => {
	it("applies a parked problem dismissal to the active problem", () => {
		const chat = chatWithActiveProblem();
		parkDismissal(chat, { type: "dismiss-problem", problemCallId: "call-prob-1" });
		applyParkedDismissal(chatStore, chat);
		// The marker freed the slot — no active problem remains.
		assert.equal(activeProblemOf(chatStore.getChat(chat)!.messages), null);
	});

	it("drops a park that targets nothing (never materialized — silence)", () => {
		const chat = chatWithDanglingQuiz("drop");
		const before = chatStore.getChat(chat)!.messages.length;
		parkDismissal(chat, { type: "dismiss-problem", problemCallId: "call-ghost" });
		let emitted = 0;
		const off = subscribe((e) => {
			if (e.type === "record-changed" && e.chatId === chat) emitted++;
		});
		applyParkedDismissal(chatStore, chat);
		off();
		assert.equal(emitted, 0);
		assert.equal(chatStore.getChat(chat)!.messages.length, before);
		assert.equal(takeParkedDismissal(chat), null);
	});
});

describe("the dismiss route — the park contract (202)", () => {
	it("still refuses honestly (400) with no turn and nothing active", async () => {
		const chat = chatStore.createChat("park: nothing active").id;
		const dismissRoute = await import("../app/api/chats/[id]/dismiss/route.ts");
		const res = await dismissRoute.POST(
			new Request(`http://test/api/chats/${chat}/dismiss`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: { type: "dismiss-problem", problemCallId: "call-nowhere" } }),
			}),
			{ params: Promise.resolve({ id: chat }) },
		);
		assert.equal(res.status, 400);
	});
});
