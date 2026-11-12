import { answerWordCheck, BODY_LIMITS, bodyTooLarge, finishWordCheck, startWordCheck } from "@/src/server";

export const dynamic = "force-dynamic";

const MAX_ANSWER_MS = 10 * 60_000;
const MAX_ACTIVE_MS = 60 * 60_000;

interface Body {
	action?: unknown;
	id?: unknown;
	slug?: unknown;
	pick?: unknown;
	ms?: unknown;
	activeMs?: unknown;
	tz?: unknown;
}

const boundedMs = (value: unknown, max: number) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, max) : undefined);

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as Body | null;
	try {
		if (body?.action === "start") return Response.json(startWordCheck());
		if (typeof body?.id !== "string") return Response.json({ message: "id is required" }, { status: 400 });
		if (body.action === "answer") {
			if (typeof body.slug !== "string") return Response.json({ message: "slug is required" }, { status: 400 });
			const pick = typeof body.pick === "number" && Number.isInteger(body.pick) && body.pick >= 0 ? body.pick : null;
			return Response.json(answerWordCheck({ id: body.id, slug: body.slug, pick, ms: boundedMs(body.ms, MAX_ANSWER_MS) }));
		}
		if (body.action === "finish") {
			const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
			return Response.json(finishWordCheck({ id: body.id, activeMs: boundedMs(body.activeMs, MAX_ACTIVE_MS), tz }));
		}
		return Response.json({ message: "action must be start, answer or finish" }, { status: 400 });
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
	}
}
