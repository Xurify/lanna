/**
 * GET /api/catch — the item to answer now (src/server/catch-mistake.ts): the one waiting, or a new one.
 * POST /api/catch {id, sentence, token, typed} — the answer: whether the tap found the wrong word, the typed
 * word's verdict, and the whole item with its translations.
 */

import { answerCatch, BODY_LIMITS, bodyTooLarge, nextCatchItem } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		return Response.json(await nextCatchItem());
	} catch (err) {
		return Response.json(
			{ message: err instanceof Error ? err.message : "The item could not be made." },
			{ status: 500 },
		);
	}
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		id?: unknown;
		sentence?: unknown;
		token?: unknown;
		typed?: unknown;
	} | null;
	if (!body || typeof body.id !== "string" || !Number.isInteger(body.sentence) || !Number.isInteger(body.token)) {
		return Response.json({ message: "id, sentence and token are required" }, { status: 400 });
	}
	const typed = typeof body.typed === "string" ? body.typed.slice(0, 200) : "";
	const out = answerCatch(body.id, { sentence: body.sentence as number, token: body.token as number, typed });
	if (!out.ok) return Response.json({ message: out.message }, { status: out.status });
	return Response.json(out.result);
}
