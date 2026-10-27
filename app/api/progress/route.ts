/**
 * GET /api/progress?tz=<minutes> — the Today screen's numbers: XP and
 * level, today's XP against the daily goal, the streak and week strip,
 * every unit's level on the skill path, and the review deck's counts.
 * PUT /api/progress {dailyGoal} — change the daily XP goal;
 * PUT /api/progress {goal: {level?, minutesPerDay?}} — the target level and
 * planned minutes a day (the daily plan and the projection follow).
 * POST /api/progress {activity: "talk"|"story"|"tutor", unit?} — a tutor
 * session started from the Today page, for the day's speaking task.
 */

import { progressSummary, recordActivity, setDailyGoal, setGoal } from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(req: Request): number | undefined {
	const tz = Number(new URL(req.url).searchParams.get("tz"));
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
}

export async function GET(req: Request) {
	return Response.json(progressSummary(tzOf(req)));
}

export async function PUT(req: Request) {
	const body = (await req.json().catch(() => null)) as { dailyGoal?: unknown; goal?: { level?: unknown; minutesPerDay?: unknown } } | null;
	if (body?.goal && typeof body.goal === "object") {
		const level = typeof body.goal.level === "string" ? (body.goal.level as "A1" | "A2" | "B1" | "B2" | "C1") : undefined;
		const minutesPerDay = typeof body.goal.minutesPerDay === "number" ? body.goal.minutesPerDay : undefined;
		return Response.json(setGoal({ level, minutesPerDay }, tzOf(req)));
	}
	if (typeof body?.dailyGoal !== "number") return Response.json({ message: "dailyGoal must be a number" }, { status: 400 });
	return Response.json(setDailyGoal(body.dailyGoal));
}

const ACTIVITIES = new Set(["talk", "story", "tutor"]);

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { activity?: unknown; unit?: unknown } | null;
	if (!body || !ACTIVITIES.has(body.activity as string)) return Response.json({ message: "activity must be talk, story or tutor" }, { status: 400 });
	return Response.json(recordActivity(body.activity as "talk" | "story" | "tutor", typeof body.unit === "string" ? body.unit : undefined, tzOf(req)));
}
