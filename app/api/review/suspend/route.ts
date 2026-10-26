/** POST /api/review/suspend {cardId, suspended?} — hide a card (bad
 *  sentence, word already known) or bring it back. */

import { suspendCard } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { cardId?: unknown; suspended?: unknown } | null;
	if (typeof body?.cardId !== "string") return Response.json({ message: "cardId is required" }, { status: 400 });
	suspendCard(body.cardId, body.suspended !== false);
	return Response.json({ ok: true });
}
