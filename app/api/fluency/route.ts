/**
 * GET /api/fluency?mode=reread[&id=…] — an episode read before, timed,
 * with the pace to beat and one of its questions; null when nothing has
 * been read. GET /api/fluency?mode=fast — six sentences every word of
 * which is known (src/server/fluency.ts). Built locally; no model.
 * POST /api/fluency {mode: "reread", storyId, ms, questionIndex, answer, tz?}
 * POST /api/fluency {mode: "fast", reps, ms?, activeMs?, tz?} — a finished round:
 * XP, the day's fluency work, the log line.
 */

import { isPronScore, type FastRep } from "@/src/core";
import { BODY_LIMITS, bodyTooLarge, fastFor, recordFast, recordReread, rereadFor } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const tz = Number(url.searchParams.get("tz"));
	if (url.searchParams.get("mode") === "reread") {
		const id = url.searchParams.get("id") ?? undefined;
		return Response.json(
			rereadFor({
				id: id && /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : undefined,
				tz: Number.isFinite(tz) ? tz : undefined,
			}),
		);
	}
	return Response.json(fastFor());
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body) return Response.json({ message: "bad request" }, { status: 400 });
	const tz = Number(body.tz);
	const tzOk = Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
	const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
	const str = (v: unknown, max = 600) => (typeof v === "string" ? v.slice(0, max) : "");
	try {
		if (body.mode === "reread") {
			const storyId = str(body.storyId, 120);
			const ms = num(body.ms);
			if (!/^[a-z0-9][a-z0-9-]*$/.test(storyId) || ms === undefined)
				return Response.json({ message: "storyId and ms are required" }, { status: 400 });
			return Response.json(
				recordReread({
					storyId,
					ms,
					questionIndex: num(body.questionIndex) ?? 0,
					answer: num(body.answer) ?? -1,
					tz: tzOk,
				}),
			);
		}
		if (body.mode === "fast") {
			if (!Array.isArray(body.reps)) return Response.json({ message: "reps must be an array" }, { status: 400 });
			const reps: FastRep[] = body.reps.slice(0, 12).map((r: Record<string, unknown>) => ({
				itemId: str(r.itemId, 120),
				slug: str(r.slug, 80),
				sentence: str(r.sentence),
				translation: str(r.translation),
				passes: Array.isArray(r.passes)
					? r.passes.slice(0, 4).map((p: Record<string, unknown>) => ({
							ms: num(p.ms) ?? 0,
							window: num(p.window) ?? 0,
							made: p.made === true,
							...(typeof p.inWindow === "boolean" ? { inWindow: p.inWindow } : {}),
							...(p.unchecked === true ? { unchecked: true } : {}),
							...(num(p.speechMs) !== undefined ? { speechMs: num(p.speechMs) } : {}),
							...(isPronScore(p.pron) ? { pron: p.pron } : {}),
							...(typeof p.heard === "string" ? { heard: p.heard.slice(0, 300) } : {}),
							...(num(p.match) !== undefined ? { match: num(p.match) } : {}),
						}))
					: [],
			}));
			return Response.json(recordFast({ reps, ms: num(body.ms), activeMs: num(body.activeMs), tz: tzOk }));
		}
		return Response.json({ message: "mode must be reread or fast" }, { status: 400 });
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
	}
}
