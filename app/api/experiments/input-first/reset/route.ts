import { NextRequest, NextResponse } from "next/server";
import { BODY_LIMITS, bodyTooLarge, resetExperiment, getExperimentState } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	try {
		let startDate: string | undefined;
		try {
			const body = await req.json();
			if (body && typeof body.startDate === "string") {
				startDate = body.startDate;
			}
		} catch {
			// empty body is fine
		}

		resetExperiment(startDate);
		const state = getExperimentState();
		return NextResponse.json({ ok: true, message: "Experiment reset successfully", state });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
