/**
 * GET /api/islands — the islands, their topics and what is fading.
 * POST /api/islands {topicId?, topic?} — a new island, its vault written and checked.
 * PATCH /api/islands {id, action: "review" | "remove" | "add", chunkId?, sk?, en?} — a vault change.
 * DELETE /api/islands?id= — drop an island.
 */

import { BODY_LIMITS, bodyTooLarge, createIsland, editVault, islandPage, removeIsland } from "@/src/server";

export const dynamic = "force-dynamic";

type Body = {
	id?: unknown;
	action?: unknown;
	chunkId?: unknown;
	sk?: unknown;
	en?: unknown;
	topicId?: unknown;
	topic?: unknown;
} | null;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET() {
	return Response.json(islandPage());
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as Body;
	const topicId = str(body?.topicId, 40) || undefined;
	const topic = str(body?.topic, 80) || undefined;
	if (!topicId && !topic) return Response.json({ message: "Pick a topic first." }, { status: 400 });
	try {
		const island = await createIsland({ ...(topicId ? { topicId } : {}), ...(topic ? { topic } : {}) });
		const page = islandPage();
		return Response.json({ ...page, id: island.id });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return Response.json({ message }, { status: 400 });
	}
}

export async function PATCH(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as Body;
	const id = str(body?.id, 64);
	const chunkId = str(body?.chunkId, 80);
	if (!id) return Response.json({ message: "id is required" }, { status: 400 });
	try {
		if (body?.action === "review" && chunkId) editVault(id, { action: "review", chunkId });
		else if (body?.action === "remove" && chunkId) editVault(id, { action: "remove", chunkId });
		else if (body?.action === "add") editVault(id, { action: "add", sk: str(body.sk, 120), en: str(body.en, 160) });
		else return Response.json({ message: "Unknown vault change" }, { status: 400 });
		return Response.json(islandPage());
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return Response.json({ message }, { status: 400 });
	}
}

export async function DELETE(req: Request) {
	const id = new URL(req.url).searchParams.get("id")?.slice(0, 64) ?? "";
	if (!id) return Response.json({ message: "id is required" }, { status: 400 });
	if (!removeIsland(id)) return Response.json({ message: "No such island" }, { status: 404 });
	return Response.json(islandPage());
}
