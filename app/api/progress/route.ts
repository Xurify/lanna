/**
 * GET /api/progress?tz=<minutes> — the Today screen's numbers: XP and
 * level, today's XP against the daily goal, the streak and week strip,
 * every unit's level on the skill path, and the review deck's counts.
 * PUT /api/progress {dailyGoal} — change the daily XP goal.
 */

import { progressSummary, setDailyGoal } from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(req: Request): number | undefined {
	const tz = Number(new URL(req.url).searchParams.get("tz"));
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
}

export async function GET(req: Request) {
	return Response.json(progressSummary(tzOf(req)));
}

export async function PUT(req: Request) {
	const body = (await req.json().catch(() => null)) as { dailyGoal?: unknown } | null;
	if (typeof body?.dailyGoal !== "number") return Response.json({ message: "dailyGoal must be a number" }, { status: 400 });
	return Response.json(setDailyGoal(body.dailyGoal));
}
