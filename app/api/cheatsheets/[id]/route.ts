/**
 * GET /api/cheatsheets/<id> — one sheet, with how many of its words the
 *   dictionary knows and how many of those are in Review
 * DELETE /api/cheatsheets/<id> — move it to cheatsheets/trash/
 */

import { cheatsheetReviewState, cheatsheetStore } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const sheet = cheatsheetStore.get(id);
	if (!sheet) return Response.json({ message: "No such cheatsheet." }, { status: 404 });
	return Response.json({ sheet, review: cheatsheetReviewState(sheet) });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const removed = cheatsheetStore.remove(id);
	return Response.json({ removed }, { status: removed ? 200 : 404 });
}
