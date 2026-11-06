/**
 * GET /api/cheatsheets: the running language's cheatsheets, newest first
 * POST /api/cheatsheets {title, text}: a new one; 422 when the text has no phrase
 */

import { CheatsheetParseError, CHEATSHEET_MAX_CHARS } from "@/src/core";
import { cheatsheetStore } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ sheets: cheatsheetStore.list() });
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { title?: unknown; text?: unknown } | null;
	if (typeof body?.text !== "string" || !body.text.trim()) return Response.json({ message: "Add at least one phrase." }, { status: 400 });
	if (body.text.length > CHEATSHEET_MAX_CHARS) return Response.json({ message: "The text is too long for one cheatsheet." }, { status: 413 });
	try {
		return Response.json({ sheet: cheatsheetStore.create(typeof body.title === "string" ? body.title : "", body.text) });
	} catch (err) {
		if (err instanceof CheatsheetParseError) return Response.json({ message: err.message }, { status: 422 });
		throw err;
	}
}
