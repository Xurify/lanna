/**
 * GET /api/mistakes — the saved analysis of your answers (the first visit
 * takes one), the guide written from it if there is one, and whether it is
 * still current (src/server/mistakes.ts).
 * POST /api/mistakes {action: "analyse"} — read the lesson log again and
 * save a new snapshot with its time; no model call.
 * POST /api/mistakes {action: "guide", force?} — write the guide from the
 * saved analysis on the cheap model slot; the same facts reuse the saved one.
 */

import { analyseNow, mistakesReport, writeGuide } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(mistakesReport());
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; force?: unknown } | null;
	try {
		if (body?.action === "analyse") return Response.json(analyseNow());
		if (body?.action === "guide") return Response.json(await writeGuide({ force: body.force === true }));
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 422 });
	}
	return Response.json({ message: 'action must be "analyse" or "guide"' }, { status: 400 });
}
