/**
 * GET /api/cheatsheets — the running language's cheatsheets, newest first
 * POST /api/cheatsheets {markdown, title?} — import one; 422 when no phrase is found
 */

import { CheatsheetParseError, CHEATSHEET_MAX_CHARS } from "@/src/core";
import { cheatsheetStore } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ sheets: cheatsheetStore.list() });
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { markdown?: unknown; title?: unknown } | null;
	if (typeof body?.markdown !== "string" || !body.markdown.trim()) {
		return Response.json({ message: "Paste the guide or choose a file first." }, { status: 400 });
	}
	if (body.markdown.length > CHEATSHEET_MAX_CHARS) {
		return Response.json({ message: "The text is too long for one cheatsheet." }, { status: 413 });
	}
	try {
		const sheet = cheatsheetStore.create(body.markdown, typeof body.title === "string" ? body.title : undefined);
		return Response.json({ sheet });
	} catch (err) {
		if (err instanceof CheatsheetParseError) return Response.json({ message: err.message }, { status: 422 });
		throw err;
	}
}
