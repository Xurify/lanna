/** POST /api/cheatsheets/overlap {markdown} — which kept sheets already have
 *  phrases of this guide, and how many would be new to each. */

import { CheatsheetParseError, CHEATSHEET_MAX_CHARS } from "@/src/core";
import { cheatsheetStore } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { markdown?: unknown } | null;
	if (typeof body?.markdown !== "string" || body.markdown.length > CHEATSHEET_MAX_CHARS) return Response.json({ overlaps: [] });
	try {
		return Response.json({ overlaps: cheatsheetStore.overlaps(body.markdown) });
	} catch (err) {
		if (err instanceof CheatsheetParseError) return Response.json({ overlaps: [] });
		throw err;
	}
}
