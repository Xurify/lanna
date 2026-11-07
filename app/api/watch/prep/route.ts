/**
 * Get ready for a video (E70, src/server/watch-prep.ts): the briefing a
 * learner studies before a video they cannot yet follow.
 * GET ?id=<videoId> — the kept briefing, or {prep: null}. No model call.
 * POST {action: "make", videoId, force?} — the kept briefing, or one
 *   cheap-slot request (two when the summary is written again; always
 *   fresh with force). 503 when no model is set.
 * POST {action: "finish", videoId, results: [{id, verdict, assisted}],
 *   activeMs?, tz?} — the keys typed into their lines: XP, reps and minutes
 *   for the day, missed words to Review, missed lines back in Listen.
 */

import { isVideoId, type GapResult } from "@/src/core";
import { keptPrep, makePrep, recordPrep } from "@/src/server";

export const dynamic = "force-dynamic";

const VERDICTS = new Set(["exact", "accents", "wrong"]);

export async function GET(req: Request) {
	const id = new URL(req.url).searchParams.get("id");
	if (!id || !isVideoId(id)) return Response.json({ message: "id is required" }, { status: 400 });
	return Response.json({ prep: keptPrep(id) });
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; videoId?: unknown; force?: unknown; results?: unknown; activeMs?: unknown; tz?: unknown } | null;
	if (!body || typeof body.videoId !== "string" || !isVideoId(body.videoId)) return Response.json({ message: "videoId is required" }, { status: 400 });
	if (body.action === "make") {
		try {
			return Response.json({ prep: await makePrep(body.videoId, { force: body.force === true }) });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return Response.json({ message }, { status: /No model is configured/.test(message) ? 503 : /unknown video/.test(message) ? 404 : /not in the language/.test(message) ? 400 : 502 });
		}
	}
	if (body.action === "finish") {
		const results: GapResult[] = Array.isArray(body.results)
			? body.results
					.slice(0, 50)
					.filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
					.filter((r) => typeof r.id === "string" && VERDICTS.has(String(r.verdict)))
					.map((r) => ({ id: r.id as string, verdict: r.verdict as GapResult["verdict"], assisted: r.assisted === true }))
			: [];
		const tz = Number(body.tz);
		try {
			return Response.json(
				recordPrep({
					videoId: body.videoId,
					results,
					activeMs: typeof body.activeMs === "number" && Number.isFinite(body.activeMs) ? body.activeMs : undefined,
					tz: Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined,
				}),
			);
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
		}
	}
	return Response.json({ message: "action must be make or finish" }, { status: 400 });
}
