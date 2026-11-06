/**
 * GET /api/watch/fragments?id=<videoId> — the stretches of a video worth
 * watching (src/server/fragments.ts): the facts of every caption line, so the
 * page can draw the strip and measure a stretch the learner picks, and the best
 * stretches found by src/core/fragments.ts. No model call; the first look at a
 * video downloads its captions, kept for the next.
 */

import { isVideoId } from "@/src/core";
import { analyzeFragments, NoCaptionsError } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const id = new URL(req.url).searchParams.get("id");
	if (!id || !isVideoId(id)) return Response.json({ message: "id is required" }, { status: 400 });
	try {
		return Response.json(await analyzeFragments(id, { signal: req.signal }));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (err instanceof NoCaptionsError) return Response.json({ message, noCaptions: true }, { status: 422 });
		return Response.json({ message }, { status: /minutes long|empty/.test(message) ? 422 : 502 });
	}
}
