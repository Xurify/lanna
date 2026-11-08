/**
 * POST /api/progress/time {activity, ms, tz?} — active practice time that no
 * finished session carries: a lesson or card left unfinished, a tab closed
 * mid-session (the client sends it as it leaves). Adds minutes to the day
 * and to the activity, nothing else; counts and XP wait for a session that
 * finishes. Returns {minutes} added (src/core/active-time.ts).
 */

import { isTimedActivity, SHOWN_LANGUAGE_HEADER } from "@/src/core";
import { inShownLanguage, recordActiveTime } from "@/src/server";

export const dynamic = "force-dynamic";

/** No single send is longer than this (the tab was open, not the learner). */
const MAX_MS = 6 * 3_600_000;

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { activity?: unknown; ms?: unknown; tz?: unknown } | null;
	if (!body || !isTimedActivity(body.activity)) return Response.json({ message: "activity must be a timed activity" }, { status: 400 });
	if (typeof body.ms !== "number" || !Number.isFinite(body.ms) || body.ms < 0) return Response.json({ message: "ms must be a non-negative number" }, { status: 400 });
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
	const activity = body.activity;
	const ms = Math.min(body.ms, MAX_MS);
	return Response.json({ minutes: inShownLanguage(req.headers.get(SHOWN_LANGUAGE_HEADER), () => recordActiveTime(activity, ms, tz)) ?? 0 });
}
