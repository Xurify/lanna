import { NextRequest, NextResponse } from "next/server";
import { ensureExperimentInitialized, recordWeeklyCheckResults } from "@/src/server/experiment";
import type { CheckItemRecord } from "@/src/core/experiment";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const week = Number(searchParams.get("week") || "1");
		const lang = (searchParams.get("lang") || "russian").toLowerCase();

		const { pool } = ensureExperimentInitialized();
		const langPool = lang === "slovak" ? pool.slovak : pool.russian;

		const probeStart = (week - 1) * 10;
		const probeEnd = probeStart + 10;
		const probes = langPool.probePool.slice(probeStart, probeEnd);

		const prodStart = (week - 1) * 5;
		const prodEnd = prodStart + 5;
		const production = langPool.productionPool.slice(prodStart, prodEnd);

		return NextResponse.json({
			week,
			language: lang,
			probes,
			production,
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const items = body.items as CheckItemRecord[];
		if (!Array.isArray(items) || items.length === 0) {
			return NextResponse.json({ error: "Missing or invalid items array" }, { status: 400 });
		}

		recordWeeklyCheckResults(items);
		return NextResponse.json({ ok: true, count: items.length });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
