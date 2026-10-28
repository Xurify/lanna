import { getChat, restoreChat, trashedChat } from "@/src/server";

/** Put a deleted session back in the list (deletion moves the record to
 *  chats/trash/, so a deleted session is never really gone). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	if (getChat(id)) return Response.json({ ok: true, already: true });
	if (!trashedChat(id)) return Response.json({ error: "Not in the trash" }, { status: 404 });
	if (!restoreChat(id)) return Response.json({ error: "Could not restore the session" }, { status: 500 });
	return Response.json({ ok: true });
}
