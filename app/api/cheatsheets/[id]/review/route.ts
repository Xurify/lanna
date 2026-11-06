/** POST /api/cheatsheets/<id>/review — put the next batch of the sheet's
 *  dictionary words into the Review deck. Returns the slugs added and the
 *  sheet's review state after. */

import { cheatsheetStore, cheatsheetToReview } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const sheet = cheatsheetStore.get(id);
	if (!sheet) return Response.json({ message: "No such cheatsheet." }, { status: 404 });
	return Response.json(cheatsheetToReview(sheet));
}
