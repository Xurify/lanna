/**
 * GET /api/phrases — lists saved / bookmarked phrases
 * POST /api/phrases — saves a new phrase
 * DELETE /api/phrases — removes a saved phrase by id or text
 */

import { BODY_LIMITS, bodyTooLarge, savedPhraseStore } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	const phrases = savedPhraseStore.readPhrases();
	return Response.json({ phrases });
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		text?: unknown;
		translation?: unknown;
		source?: unknown;
		context?: unknown;
		tags?: unknown;
		notes?: unknown;
	} | null;

	if (typeof body?.text !== "string" || !body.text.trim()) {
		return Response.json({ message: "text is a required non-empty string" }, { status: 400 });
	}

	const source =
		body.source === "story" || body.source === "speak" || body.source === "lesson" || body.source === "review"
			? body.source
			: "manual";

	const saved = savedPhraseStore.savePhrase({
		text: body.text,
		translation: typeof body.translation === "string" ? body.translation : "",
		source,
		context: typeof body.context === "string" ? body.context : undefined,
		tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : undefined,
		notes: typeof body.notes === "string" ? body.notes : undefined,
	});

	return Response.json(saved);
}

export async function DELETE(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const url = new URL(req.url);
	let id = url.searchParams.get("id");
	let text = url.searchParams.get("text");

	if (!id && !text) {
		const body = (await req.json().catch(() => null)) as { id?: unknown; text?: unknown } | null;
		if (typeof body?.id === "string") id = body.id;
		if (typeof body?.text === "string") text = body.text;
	}

	if (id) {
		const removed = savedPhraseStore.removePhrase(id);
		return Response.json({ success: removed });
	}

	if (text) {
		const removed = savedPhraseStore.removeByText(text);
		return Response.json({ success: removed });
	}

	return Response.json({ message: "id or text query parameter is required" }, { status: 400 });
}
