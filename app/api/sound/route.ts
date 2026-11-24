import { BODY_LIMITS, bodyTooLarge, recordSound } from "@/src/server";

export const dynamic = "force-dynamic";

const MAX_MS = 3_600_000;

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		id?: unknown;
		clear?: unknown;
		lines?: unknown;
		ms?: unknown;
		tz?: unknown;
	} | null;
	const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 50 ? v : null);
	const clear = count(body?.clear);
	const lines = count(body?.lines);
	if (!body || typeof body.id !== "string" || clear === null || lines === null || lines === 0)
		return Response.json({ message: "id, clear and lines are required" }, { status: 400 });
	const ms = typeof body.ms === "number" && Number.isFinite(body.ms) && body.ms > 0 ? Math.min(body.ms, MAX_MS) : 0;
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
	if (!recordSound(body.id, clear, lines, ms, tz))
		return Response.json({ message: "unknown sound unit" }, { status: 404 });
	return Response.json({ recorded: true });
}
