/** POST /api/cheatsheets/<id>/add {text}: add the phrases the sheet does not have yet. Returns the sheet and how many were added. */

import { CheatsheetParseError, CHEATSHEET_MAX_CHARS } from "@/src/core";
import { BODY_LIMITS, bodyTooLarge, cheatsheetStore } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.cheatsheet);
	if (oversized) return oversized;
	const { id } = await ctx.params;
	const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
	if (typeof body?.text !== "string" || !body.text.trim())
		return Response.json({ message: "Add at least one phrase." }, { status: 400 });
	if (body.text.length > CHEATSHEET_MAX_CHARS)
		return Response.json({ message: "The text is too long for one cheatsheet." }, { status: 413 });
	try {
		const result = cheatsheetStore.add(id, body.text);
		return result ? Response.json(result) : Response.json({ message: "No such cheatsheet." }, { status: 404 });
	} catch (err) {
		if (err instanceof CheatsheetParseError) return Response.json({ message: err.message }, { status: 422 });
		throw err;
	}
}
