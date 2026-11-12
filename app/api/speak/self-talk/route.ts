/**
 * POST /api/speak/self-talk — completes a guided self-talk session.
 * Awards XP and logs active practice time to the Speaking strand.
 */

import { BODY_LIMITS, bodyTooLarge, completeSelfTalk } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;

	const body = (await req.json().catch(() => null)) as {
		promptId?: unknown;
		activeSec?: unknown;
		transcript?: unknown;
		tz?: unknown;
	} | null;

	if (!body || typeof body.promptId !== "string" || !body.promptId.trim()) {
		return Response.json({ message: "promptId is required" }, { status: 400 });
	}

	const activeSec = typeof body.activeSec === "number" && Number.isFinite(body.activeSec) ? body.activeSec : 0;
	const transcript = typeof body.transcript === "string" ? body.transcript.slice(0, 5000) : "";
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;

	try {
		const outcome = completeSelfTalk({
			promptId: body.promptId.trim(),
			activeSec,
			transcript,
			tz,
		});
		return Response.json(outcome);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return Response.json({ message }, { status: 400 });
	}
}
