/**
 * GET /api/day?tz=<minutes> — today across every language in the list:
 * each language's plan, its minutes a day and what it has had today
 * (src/server/day-plan.ts).
 * PUT /api/day {minutes: {<language id>: <minutes a day>}} — split the day:
 * each named language's minutes a day, which its plan and estimates follow.
 */

import { BODY_LIMITS, bodyTooLarge, languageDay, setLanguageMinutes } from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(req: Request): number | undefined {
	const tz = Number(new URL(req.url).searchParams.get("tz"));
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
}

export async function GET(req: Request) {
	return Response.json(languageDay(tzOf(req)));
}

export async function PUT(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { minutes?: unknown } | null;
	const minutes = body?.minutes;
	if (!minutes || typeof minutes !== "object" || Array.isArray(minutes)) {
		return Response.json({ message: "body must be {minutes: {<language>: <minutes a day>}}" }, { status: 400 });
	}
	return Response.json(setLanguageMinutes(minutes as Record<string, number>, tzOf(req)));
}
