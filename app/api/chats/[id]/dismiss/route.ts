import { ChatInputError, dismissAppends, emit, parseDismissInput } from "@/src/core";
import { BODY_LIMITS, bodyTooLarge, getChat, isTurnRunning, parkDismissal, stores } from "@/src/server";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const { id } = await ctx.params;
	const chat = getChat(id);
	if (!chat) return Response.json({ error: "Unknown chat" }, { status: 404 });

	let input;
	try {
		// The POST-family convention: the body is { input } (chatId lives in
		// the URL here).
		const body = (await req.json().catch(() => null)) as { input?: unknown } | null;
		input = parseDismissInput(body?.input ?? null);
	} catch (err) {
		if (err instanceof ChatInputError) return Response.json({ error: err.message }, { status: 400 });
		throw err;
	}

	// A running turn owns the chat's record (its messages persist at
	// settle) — the dismissal cannot validate against stale truth, so it
	// is PARKED (owner, 2026-10-04): onFinish applies it to the settled
	// record if the dismissed question/problem really is pending there.
	// The dismissing client has also aborted the turn — this 202 is the
	// "noted, will land" contract.
	if (isTurnRunning(id)) {
		parkDismissal(id, input);
		return Response.json({ ok: true, parked: true }, { status: 202 });
	}

	let appends;
	try {
		appends = dismissAppends(chat, input);
	} catch (err) {
		if (err instanceof ChatInputError) return Response.json({ error: err.message }, { status: 400 });
		throw err;
	}

	// Write-ahead, turn-less: the record is the only state that moves.
	const merged = [...chat.messages, ...appends];
	stores.chatStore.saveMessages(id, merged);
	emit("record-changed", { chatId: id });
	return Response.json({ ok: true });
}
