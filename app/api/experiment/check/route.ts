import { BODY_LIMITS, bodyTooLarge, ensureExperimentInitialized, recordWeeklyCheckResults } from "@/src/server";
import type { CheckItemRecord } from "@/src/core";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const weekParam = url.searchParams.get("week");
		const langParam = (url.searchParams.get("lang") || "russian").toLowerCase();

		const { pool, config } = ensureExperimentInitialized();
		const currentWeek = weekParam ? Math.max(1, Math.min(6, parseInt(weekParam, 10))) : 1;

		const langPool = langParam === "slovak" ? pool.slovak : pool.russian;
		const probeStartIndex = (currentWeek - 1) * 10;
		const prodStartIndex = (currentWeek - 1) * 5;

		const weeklyProbes = langPool.probePool.slice(probeStartIndex, probeStartIndex + 10);
		const weeklyProduction = langPool.productionPool.slice(prodStartIndex, prodStartIndex + 5);

		return Response.json({
			week: currentWeek,
			language: langParam,
			probes: weeklyProbes,
			production: weeklyProduction,
			startDate: config.startDate,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return Response.json({ error: message }, { status: 500 });
	}
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	try {
		const body = await req.json();
		const items = body.items as CheckItemRecord[];
		if (!Array.isArray(items) || items.length === 0) {
			return Response.json({ error: "items array is required" }, { status: 400 });
		}

		recordWeeklyCheckResults(items);
		return Response.json({ success: true, count: items.length });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return Response.json({ error: message }, { status: 500 });
	}
}
