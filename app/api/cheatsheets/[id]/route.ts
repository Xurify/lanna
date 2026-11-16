/**
 * GET /api/cheatsheets/<id>: the sheet, and how many of its words the dictionary knows and Review has
 * PUT /api/cheatsheets/<id> {title?, text}: replace the title and the phrases (the old version goes to trash/)
 * DELETE /api/cheatsheets/<id>: move it to trash/ (a repo sheet is removed by deleting its file, so this refuses it)
 */

import { CheatsheetParseError, CHEATSHEET_MAX_CHARS, REPO_PREFIX } from "@/src/core";
import { BODY_LIMITS, bodyTooLarge, cheatsheetReviewState, cheatsheetStore, sheetListenState } from "@/src/server";

export const dynamic = "force-dynamic";

const NOT_FOUND = () => Response.json({ message: "No such cheatsheet." }, { status: 404 });

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const sheet = cheatsheetStore.get(id);
	if (!sheet) return NOT_FOUND();
	return Response.json({ sheet, review: cheatsheetReviewState(sheet), listen: sheetListenState(sheet) });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.cheatsheet);
	if (oversized) return oversized;
	const { id } = await ctx.params;
	const body = (await req.json().catch(() => null)) as { title?: unknown; text?: unknown } | null;
	if (typeof body?.text !== "string" || !body.text.trim())
		return Response.json({ message: "Add at least one phrase." }, { status: 400 });
	if (body.text.length > CHEATSHEET_MAX_CHARS)
		return Response.json({ message: "The text is too long for one cheatsheet." }, { status: 413 });
	try {
		const sheet = cheatsheetStore.update(id, {
			title: typeof body.title === "string" ? body.title : undefined,
			text: body.text,
		});
		return sheet ? Response.json({ sheet }) : NOT_FOUND();
	} catch (err) {
		if (err instanceof CheatsheetParseError) return Response.json({ message: err.message }, { status: 422 });
		throw err;
	}
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	if (id.startsWith(REPO_PREFIX))
		return Response.json({ message: "This sheet is kept in the repo. Delete its file there." }, { status: 409 });
	const removed = cheatsheetStore.remove(id);
	return Response.json({ removed }, { status: removed ? 200 : 404 });
}
