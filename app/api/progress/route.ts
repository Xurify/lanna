/**
 * GET /api/progress?tz=<minutes> — the Today screen's numbers: XP and
 * level, today's XP against the daily goal, the streak and week strip,
 * every unit's level on the skill path, and the review deck's counts.
 * PUT /api/progress {dailyGoal} — change the daily XP goal;
 * PUT /api/progress {goal: {level?, minutesPerDay?, daysPerWeek?, purposes?,
 * firstLanguage?, bridges?, prior?, onboarded?}} — the goal and profile
 * the setup wizard writes (src/core/onboarding.ts); the daily plan, the
 * projection and the tutor's profile block follow.
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
	const body = (await req.json().catch(() => null)) as { dailyGoal?: unknown; goal?: Record<string, unknown> } | null;
	if (body?.goal && typeof body.goal === "object") {
		const g = body.goal;
		const level = typeof g.level === "string" ? (g.level as "A1" | "A2" | "B1" | "B2" | "C1") : undefined;
		const num = (v: unknown) => (typeof v === "number" ? v : undefined);
		const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 8) : undefined);
		return Response.json(
			setGoal(
				{
					level,
					minutesPerDay: num(g.minutesPerDay),
					daysPerWeek: num(g.daysPerWeek),
					purposes: strs(g.purposes) as never,
					firstLanguage: typeof g.firstLanguage === "string" ? (g.firstLanguage as never) : undefined,
					bridges: strs(g.bridges) as never,
					prior: typeof g.prior === "string" ? (g.prior as never) : undefined,
					onboarded: g.onboarded === true,
				},
				tzOf(req),
			),
		);
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
