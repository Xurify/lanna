import { NextResponse } from "next/server";
import { getExperimentState, syncDailyExperimentData } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const state = getExperimentState();
		return NextResponse.json(state);
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

export async function POST() {
	try {
		const now = new Date();
		syncDailyExperimentData(now);
		const state = getExperimentState();
		return NextResponse.json({ ok: true, state });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
