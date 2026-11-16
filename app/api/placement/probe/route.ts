/**
 * POST /api/placement/probe {id, answer?, skip?} — the Socratic stage:
 * the first call opens it (the tutor asks), each later call carries the
 * learner's answer and gets the next question or the closing line; skip
 * leaves it where it is.
 */

import { BODY_LIMITS, bodyTooLarge, probePlacement, skipProbe } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { id?: unknown; answer?: unknown; skip?: unknown } | null;
	if (!body || typeof body.id !== "string") return Response.json({ message: "id is required" }, { status: 400 });
	try {
		if (body.skip === true) {
			skipProbe(body.id);
			return Response.json({ ok: true });
		}
		return Response.json(
			await probePlacement({ id: body.id, answer: typeof body.answer === "string" ? body.answer : undefined }),
		);
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
	}
}
