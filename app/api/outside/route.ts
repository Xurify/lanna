/**
 * GET /api/outside?tz= — listening logged outside the app: the last seven
 * days' entries and the 14-day summary (src/server/outside.ts).
 * POST /api/outside?tz= {minutes, attention: "focused" | "background", what?, day?} — log one stretch.
 * DELETE /api/outside?id=&tz= — remove one.
 */

import { BODY_LIMITS, bodyTooLarge, logOutside, outsideState, removeOutside } from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(req: Request): number | undefined {
	const raw = new URL(req.url).searchParams.get("tz");
	const n = raw === null ? NaN : Number(raw);
	return Number.isFinite(n) ? n : undefined;
}

export async function GET(req: Request) {
	return Response.json(outsideState(new Date(), tzOf(req)));
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		minutes?: unknown;
		attention?: unknown;
		what?: unknown;
		day?: unknown;
	} | null;
	const out = logOutside(body, new Date(), tzOf(req));
	if (!out.ok) return Response.json({ message: out.message }, { status: out.status });
	return Response.json({ entry: out.entry, state: out.state });
}

export async function DELETE(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const id = new URL(req.url).searchParams.get("id");
	if (!id) return Response.json({ message: "id is required" }, { status: 400 });
	const out = removeOutside(id.slice(0, 64), new Date(), tzOf(req));
	if (!out.ok) return Response.json({ message: "No such entry" }, { status: 404 });
	return Response.json({ state: out.state });
}
