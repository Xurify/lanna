/**
 * GET /api/speak/live — whether a live talk can start here, the scenes and
 * islands to pick from, and the last few talks.
 * POST /api/speak/live {kind, ref, provider} — a short-lived call credential
 * for the chosen engine, and what the browser needs to open it. The key stays
 * on this side.
 */

import { BODY_LIMITS, bodyTooLarge, livePage, liveStart } from "@/src/server";
import { LIVE_PROVIDERS, type LiveProviderId } from "@/src/core";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(livePage());
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { kind?: unknown; ref?: unknown; provider?: unknown } | null;
	const kind = body?.kind === "island" ? "island" : body?.kind === "scene" ? "scene" : null;
	const ref = typeof body?.ref === "string" ? body.ref.trim().slice(0, 80) : "";
	const provider = LIVE_PROVIDERS.find((p) => p.id === body?.provider)?.id as LiveProviderId | undefined;
	if (!kind || !ref) return Response.json({ message: "kind and ref are required" }, { status: 400 });
	try {
		return Response.json(await liveStart(kind, ref, provider));
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 422 });
	}
}
