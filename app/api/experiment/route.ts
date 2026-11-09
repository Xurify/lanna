import { getExperimentState, syncDailyExperimentData } from "@/src/server/experiment";

export const dynamic = "force-dynamic";

export async function GET() {
	try {
		const state = getExperimentState();
		return Response.json(state);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return Response.json({ error: message }, { status: 500 });
	}
}

export async function POST() {
	try {
		const { daily, summary } = syncDailyExperimentData();
		return Response.json({ success: true, daily, summary });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return Response.json({ error: message }, { status: 500 });
	}
}
