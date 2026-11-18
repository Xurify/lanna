/**
 * POST /api/islands/rehearsal {id, activeSec, transcript?, longestPauseMs?, tz?} — a
 * rehearsed monologue: the vault chunks heard, XP, and the day's Speaking minutes.
 */

import { BODY_LIMITS, bodyTooLarge, islandPage, recordRehearsal } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		id?: unknown;
		activeSec?: unknown;
		transcript?: unknown;
		longestPauseMs?: unknown;
		tz?: unknown;
	} | null;
	if (!body || typeof body.id !== "string" || !body.id.trim())
		return Response.json({ message: "id is required" }, { status: 400 });
	const activeSec = typeof body.activeSec === "number" && Number.isFinite(body.activeSec) ? body.activeSec : 0;
	const transcript = typeof body.transcript === "string" ? body.transcript.slice(0, 8000) : "";
	const longestPauseMs =
		typeof body.longestPauseMs === "number" && Number.isFinite(body.longestPauseMs) ? body.longestPauseMs : undefined;
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
	try {
		const outcome = recordRehearsal({
			id: body.id.trim(),
			activeSec,
			transcript,
			...(longestPauseMs !== undefined ? { longestPauseMs } : {}),
			...(tz !== undefined ? { tz } : {}),
		});
		const page = islandPage();
		return Response.json({ ...page, used: outcome.used, xp: outcome.xp, metTarget: outcome.metTarget });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return Response.json({ message }, { status: 400 });
	}
}
