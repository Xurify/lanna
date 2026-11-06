/** POST /api/cheatsheets/<id>/merge {markdown} — add the guide's phrases the
 *  sheet does not have yet; the version before goes to trash/. */

import { CheatsheetParseError, CHEATSHEET_MAX_CHARS } from "@/src/core";
import { cheatsheetStore } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const body = (await req.json().catch(() => null)) as { markdown?: unknown } | null;
	if (typeof body?.markdown !== "string" || !body.markdown.trim()) return Response.json({ message: "Paste the guide or choose a file first." }, { status: 400 });
	if (body.markdown.length > CHEATSHEET_MAX_CHARS) return Response.json({ message: "The text is too long for one cheatsheet." }, { status: 413 });
	try {
		const result = cheatsheetStore.merge(id, body.markdown);
		return result ? Response.json(result) : Response.json({ message: "No such cheatsheet." }, { status: 404 });
	} catch (err) {
		if (err instanceof CheatsheetParseError) return Response.json({ message: err.message }, { status: 422 });
		throw err;
	}
}
