/** PUT /api/review/settings {newPerDay?, retention?, blankWords?} — the deck's knobs. */

import { BODY_LIMITS, bodyTooLarge, updateReviewSettings } from "@/src/server";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		newPerDay?: unknown;
		retention?: unknown;
		blankWords?: unknown;
	} | null;
	return Response.json({
		settings: updateReviewSettings({
			...(typeof body?.newPerDay === "number" ? { newPerDay: body.newPerDay } : {}),
			...(typeof body?.retention === "number" ? { retention: body.retention } : {}),
			...(typeof body?.blankWords === "number" ? { blankWords: body.blankWords } : {}),
		}),
	});
}
