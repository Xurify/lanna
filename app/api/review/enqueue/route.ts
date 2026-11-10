/** POST /api/review/enqueue {slugs: string[]} — put specific words into the
 *  deck now (ahead of frequency order). Returns the slugs added. */

import { BODY_LIMITS, bodyTooLarge, enqueueWords } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { slugs?: unknown } | null;
	const slugs = Array.isArray(body?.slugs) ? body.slugs.filter((s): s is string => typeof s === "string").slice(0, 50) : [];
	return Response.json({ added: enqueueWords(slugs) });
}
