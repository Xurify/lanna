/** POST /api/cheatsheets/<id>/to-repo: move a local sheet into the repo as curriculum/<language>/cheatsheets/<title>.txt.
 *  Returns the repo sheet; its id is new ("repo-<name>"). The local copy goes to trash/. */

import { cheatsheetStore } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	try {
		const sheet = cheatsheetStore.toRepo(id);
		return sheet ? Response.json({ sheet }) : Response.json({ message: "No such cheatsheet on this device." }, { status: 404 });
	} catch {
		return Response.json({ message: "The repo folder could not be written. Is the app running from its repo?" }, { status: 500 });
	}
}
