/**
 * GET /api/cheatsheets/<id> — one sheet, with how many of its words the
 *   dictionary knows and how many of those are in Review; ?source=1 returns
 *   the text as imported instead, for the edit dialog
 * PUT /api/cheatsheets/<id> {markdown, title?} — replace its text and title
 * DELETE /api/cheatsheets/<id> — move it to cheatsheets/trash/
 */

import { CheatsheetParseError, CHEATSHEET_MAX_CHARS } from "@/src/core";
import { cheatsheetReviewState, cheatsheetStore } from "@/src/server";

export const dynamic = "force-dynamic";

const NOT_FOUND = () => Response.json({ message: "No such cheatsheet." }, { status: 404 });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	if (new URL(req.url).searchParams.get("source") === "1") {
		const markdown = cheatsheetStore.source(id);
		const sheet = cheatsheetStore.get(id);
		return markdown === null || !sheet ? NOT_FOUND() : Response.json({ markdown, title: sheet.title });
	}
	const sheet = cheatsheetStore.get(id);
	if (!sheet) return NOT_FOUND();
	return Response.json({ sheet, review: cheatsheetReviewState(sheet) });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const body = (await req.json().catch(() => null)) as { markdown?: unknown; title?: unknown } | null;
	if (typeof body?.markdown !== "string" || !body.markdown.trim()) return Response.json({ message: "The sheet needs at least one phrase." }, { status: 400 });
	if (body.markdown.length > CHEATSHEET_MAX_CHARS) return Response.json({ message: "The text is too long for one cheatsheet." }, { status: 413 });
	try {
		const sheet = cheatsheetStore.update(id, body.markdown, typeof body.title === "string" ? body.title : undefined);
		return sheet ? Response.json({ sheet }) : NOT_FOUND();
	} catch (err) {
		if (err instanceof CheatsheetParseError) return Response.json({ message: err.message }, { status: 422 });
		throw err;
	}
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const removed = cheatsheetStore.remove(id);
	return Response.json({ removed }, { status: removed ? 200 : 404 });
}
