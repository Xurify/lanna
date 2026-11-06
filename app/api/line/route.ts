/**
 * GET /api/line — today's line: the sentence to play (not shown until heard),
 * the morning and evening hearings, and the last 14 days (src/server/line.ts).
 * POST /api/line {phase, itemId, typed, plays?, activeMs?} — one hearing: the
 * typed words are scored against the sentence that was served, and the time
 * on the page counts as listening minutes.
 */

import { lineState, recordLine } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(lineState());
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { phase?: unknown; itemId?: unknown; typed?: unknown; plays?: unknown; activeMs?: unknown } | null;
	if (!body || (body.phase !== "morning" && body.phase !== "evening") || typeof body.itemId !== "string") {
		return Response.json({ message: "phase and itemId are required" }, { status: 400 });
	}
	const typed = typeof body.typed === "string" ? body.typed.slice(0, 300) : "";
	const plays = typeof body.plays === "number" && Number.isFinite(body.plays) ? Math.min(Math.max(0, Math.round(body.plays)), 50) : undefined;
	const activeMs = typeof body.activeMs === "number" && Number.isFinite(body.activeMs) ? Math.min(Math.max(0, Math.round(body.activeMs)), 600_000) : undefined;
	const out = recordLine({ phase: body.phase, itemId: body.itemId.slice(0, 120), typed, plays, activeMs });
	if (!out.ok) return Response.json({ message: out.message }, { status: out.status });
	return Response.json({ record: out.record, score: out.score, state: lineState() });
}
