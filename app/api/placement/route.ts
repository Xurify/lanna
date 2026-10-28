/**
 * The placement check (src/server/placement.ts):
 *   GET  /api/placement?recheck=1   start a check: its id, the first item,
 *                                   the tier a re-check starts at
 *   POST /api/placement {id, ms?, tz?}  finish: fold the ladder, the
 *                                   Socratic verdicts and the word check
 *                                   into the outcome and record it
 * The stages in between: /api/placement/answer, /probe, /words.
 */

import { finishPlacement, startPlacement } from "@/src/server";

export const dynamic = "force-dynamic";

const fail = (err: unknown, status = 400) => Response.json({ message: err instanceof Error ? err.message : String(err) }, { status });

export async function GET(req: Request) {
	const url = new URL(req.url);
	try {
		return Response.json(startPlacement({ recheck: url.searchParams.get("recheck") === "1" }));
	} catch (err) {
		return fail(err, 500);
	}
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { id?: unknown; ms?: unknown; tz?: unknown } | null;
	if (!body || typeof body.id !== "string") return Response.json({ message: "id is required" }, { status: 400 });
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
	try {
		return Response.json(finishPlacement({ id: body.id, ms: typeof body.ms === "number" ? body.ms : undefined, tz }));
	} catch (err) {
		return fail(err);
	}
}
