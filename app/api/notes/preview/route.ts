/** GET /api/notes/preview?url= — the card for one link, for a mention, kept in link-previews.json after the first look (src/server/notes.ts). */

import { previewLink } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const card = await previewLink(new URL(req.url).searchParams.get("url") ?? "");
	if (!card) return Response.json({ message: "That is not a link." }, { status: 400 });
	return Response.json({ card });
}
