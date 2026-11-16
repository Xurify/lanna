/**
 * Study sections for a prepared video (E62, src/server/watch-sections.ts).
 * GET ?id=<videoId> — the kept sections, or {sections: null}. No model call.
 * POST {action: "find", videoId, force?} — find them: the kept answer, or one
 *   cheap-slot request (always one with force). 503 when no model is set.
 * POST {action: "finish", videoId, section, results: [{id, verdict, assisted}],
 *   activeMs?, tz?} — a practiced section: XP, reps and minutes for the day,
 *   missed words to Review, missed lines back in Listen.
 */

import { isVideoId, type GapResult } from "@/src/core";
import { BODY_LIMITS, bodyTooLarge, findSections, keptSections, recordSection } from "@/src/server";

export const dynamic = "force-dynamic";

const VERDICTS = new Set(["exact", "accents", "wrong"]);

export async function GET(req: Request) {
	const id = new URL(req.url).searchParams.get("id");
	if (!id || !isVideoId(id)) return Response.json({ message: "id is required" }, { status: 400 });
	return Response.json({ sections: keptSections(id) });
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		action?: unknown;
		videoId?: unknown;
		force?: unknown;
		section?: unknown;
		results?: unknown;
		activeMs?: unknown;
		tz?: unknown;
	} | null;
	if (!body || typeof body.videoId !== "string" || !isVideoId(body.videoId))
		return Response.json({ message: "videoId is required" }, { status: 400 });
	if (body.action === "find") {
		try {
			return Response.json({ sections: await findSections(body.videoId, { force: body.force === true }) });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return Response.json(
				{ message },
				{
					status: /No model is configured/.test(message)
						? 503
						: /unknown video/.test(message)
							? 404
							: /not in the language/.test(message)
								? 400
								: 502,
				},
			);
		}
	}
	if (body.action === "finish") {
		const results: GapResult[] = Array.isArray(body.results)
			? body.results
					.slice(0, 50)
					.filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
					.filter((r) => typeof r.id === "string" && VERDICTS.has(String(r.verdict)))
					.map((r) => ({
						id: r.id as string,
						verdict: r.verdict as GapResult["verdict"],
						assisted: r.assisted === true,
					}))
			: [];
		const tz = Number(body.tz);
		try {
			return Response.json(
				recordSection({
					videoId: body.videoId,
					section: Number(body.section),
					results,
					activeMs: typeof body.activeMs === "number" && Number.isFinite(body.activeMs) ? body.activeMs : undefined,
					tz: Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined,
				}),
			);
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
		}
	}
	return Response.json({ message: "action must be find or finish" }, { status: 400 });
}
