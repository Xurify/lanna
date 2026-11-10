/**
 * GET  /api/placement/words?id=…            the word check's items
 * POST /api/placement/words {id, answers}   the ticks → the estimate
 */

import { BODY_LIMITS, bodyTooLarge, recordWords, wordsFor } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const id = new URL(req.url).searchParams.get("id");
	if (!id) return Response.json({ message: "id is required" }, { status: 400 });
	try {
		return Response.json({ items: wordsFor(id) });
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
	}
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { id?: unknown; answers?: unknown } | null;
	if (!body || typeof body.id !== "string" || !Array.isArray(body.answers)) return Response.json({ message: "id and answers are required" }, { status: 400 });
	const answers = body.answers.flatMap((a: unknown) => {
		const x = a as { id?: unknown; yes?: unknown } | null;
		return x && typeof x.id === "string" ? [{ id: x.id, yes: x.yes === true }] : [];
	});
	try {
		return Response.json(recordWords(body.id, answers));
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
	}
}
