/**
 * POST /api/placement/answer {id, itemId, given, verdict, ms?} — one
 * answer on the ladder: the server may ask the model whether a typed miss
 * is a valid alternative, folds the verdict in, and returns the next item
 * (null when the ladder is done) with the bracket so far.
 */

import { answerPlacement, BODY_LIMITS, bodyTooLarge } from "@/src/server";

export const dynamic = "force-dynamic";

const VERDICTS = new Set(["exact", "accents", "wrong"]);

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { id?: unknown; itemId?: unknown; given?: unknown; verdict?: unknown; ms?: unknown } | null;
	if (!body || typeof body.id !== "string" || typeof body.itemId !== "string" || !VERDICTS.has(body.verdict as string)) return Response.json({ message: "id, itemId and verdict are required" }, { status: 400 });
	try {
		return Response.json(await answerPlacement({ id: body.id, itemId: body.itemId, given: typeof body.given === "string" ? body.given.slice(0, 200) : "", verdict: body.verdict as "exact" | "accents" | "wrong", ms: typeof body.ms === "number" ? body.ms : undefined }));
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
	}
}
