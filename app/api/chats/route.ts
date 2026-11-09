import { BODY_LIMITS, bodyTooLarge, compactionInFlight, createChat, isTurnRunning, listChats, readSettingsRecord, stores, titleFromPrompt } from "@/src/server";
import type { ChatListItem } from "@/src/core";

/** The session picker's list: record-derived summaries (phase, pending
 *  question) + live liveness — a running turn marks the session busy
 *  (contracts.ts ChatListItem; the store can't see liveness, the route is
 *  the merge point). Owner, minimal-color round: background jobs NO LONGER
 *  count — the sidebar's Background agents section is their channel now
 *  (a running spinner per row would double-signal them), so busy means
 *  exactly "a teach turn is in flight". */
export async function GET() {
	const chats: ChatListItem[] = listChats().map((c) => ({
		...c,
		busy: isTurnRunning(c.id),
		compacting: compactionInFlight(c.id),
	}));
	return Response.json({ chats });
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => ({}))) as { title?: unknown; kind?: unknown; tutorUnit?: unknown };
	const title = typeof body.title === "string" ? body.title : "";
	// Practice sessions (owner, 2026-10-04): kind "practice" marks the
	// record — the practice agent + its tools from turn 1, no extraction.
	const kind = body.kind === "practice" ? ("practice" as const) : undefined;
	const chat = createChat(titleFromPrompt(title || "Untitled session"), kind);
	if (typeof body.tutorUnit === "string" && body.tutorUnit) stores.chatStore.setTutorUnit(chat.id, body.tutorUnit.slice(0, 64));
	// PER-SESSION MODELS (owner, 2026-09-28): a session owns its model +
	// thinking level from birth — stamped verbatim from the STRONG slot,
	// the new-session default. From here the strong slot never reaches
	// this session again: in-session picks write the session's own record
	// (PUT /api/chats/:id/settings). No strong slot configured (fresh BYOK
	// boot) → no stamp; the turn gate's 503 models_not_configured envelope
	// refuses honestly until the setup flow fills the slot.
	// LangHarness (Xurify, 2026-10-27): a practice session (Talk, Story,
	// Why?, Practice a topic) is a conversation or a quick drill, not a
	// course, so it is born on the CHEAP slot — the slot for the assistants
	// that grade work. Learn-a-topic (prober + teacher) keeps the strong
	// slot. No cheap slot configured → strong, as before.
	const models = readSettingsRecord()?.models;
	const slot = (kind === "practice" && models?.cheap?.model ? models.cheap : models?.strong) ?? null;
	if (slot?.model) {
		stores.chatStore.saveSettings(chat.id, {
			model: { provider: slot.model.provider, id: slot.model.id },
			thinkingLevel: slot.thinkingLevel,
		});
	}
	return Response.json({ id: chat.id, title: chat.title });
}
