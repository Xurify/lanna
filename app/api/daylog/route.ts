/**
 * GET /api/daylog?tz=<minutes>&day=<YYYY-MM-DD> — one day's log (src/core/daylog.ts);
 * without `day`, today on the learner's clock. With `list=<n>`: {today, days}, the
 * newest n days that have something. The browser sends its own offset, because the
 * server's clock may sit in another zone and then "today" would be the wrong day.
 */

import { dayLog, dayLogDays } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const q = new URL(req.url).searchParams;
	const tzn = Number(q.get("tz"));
	const tz = Number.isFinite(tzn) && Math.abs(tzn) <= 840 ? tzn : 0;
	const given = q.get("day");
	const today = new Date(Date.now() - tz * 60_000).toISOString().slice(0, 10);
	const day = given && /^\d{4}-\d{2}-\d{2}$/.test(given) ? given : today;
	const list = Number(q.get("list"));
	if (Number.isInteger(list) && list > 0) return Response.json({ today, days: dayLogDays(today, tz, Math.min(list, 120)) });
	return Response.json(dayLog(day, tz));
}
