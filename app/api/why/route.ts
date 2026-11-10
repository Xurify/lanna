/**
 * POST /api/why {title, sentence, answer, lemma, given} — the chat that
 * explains a lesson sentence (src/server/why.ts). {id, reused}: reused
 * means an earlier chat for the same sentence was reopened and the client
 * must NOT send the prompt again.
 */

import { BODY_LIMITS, bodyTooLarge, openWhy } from "@/src/server";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
	const sentence = str(body?.sentence);
	const answer = str(body?.answer, 120);
	if (!sentence || !answer) return Response.json({ message: "sentence and answer are required" }, { status: 400 });
	return Response.json(openWhy({ title: str(body?.title, 120), sentence, answer, lemma: str(body?.lemma, 80), given: str(body?.given) }));
}
