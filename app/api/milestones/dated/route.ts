/**
 * /api/milestones/dated: scenes with a date (src/server/dated-scene.ts).
 * POST {text, date}: a scene in the learner's words on that day; returns the new report.
 * PUT {id, date}: move a scene to another day. PUT {id, outcome}: the line written
 * after its date. Both PUT answers return the report, so the page redraws in one step.
 */

import { addDatedScene, DatedSceneError, milestonesReport, recordSceneOutcome, scheduleScene } from "@/src/server";

export const dynamic = "force-dynamic";

const tzOf = (req: Request) => {
	const tz = Number(new URL(req.url).searchParams.get("tz"));
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
};

function failed(err: unknown) {
	if (err instanceof DatedSceneError) return Response.json({ message: err.message }, { status: err.status });
	return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 422 });
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { text?: unknown; date?: unknown } | null;
	if (!body || typeof body.text !== "string" || typeof body.date !== "string") return Response.json({ message: "text and date must be strings" }, { status: 400 });
	const tz = tzOf(req);
	try {
		const { record, reused } = await addDatedScene(body.text, body.date, { tz });
		return Response.json({ id: record.def.id, reused, report: milestonesReport(new Date(), tz) });
	} catch (err) {
		return failed(err);
	}
}

export async function PUT(req: Request) {
	const body = (await req.json().catch(() => null)) as { id?: unknown; date?: unknown; outcome?: unknown } | null;
	if (!body || typeof body.id !== "string") return Response.json({ message: "id must be a string" }, { status: 400 });
	const tz = tzOf(req);
	try {
		if (typeof body.date === "string") scheduleScene(body.id, body.date, { tz });
		else if (typeof body.outcome === "string") recordSceneOutcome(body.id, body.outcome, { tz });
		else return Response.json({ message: "Send a date or an outcome." }, { status: 400 });
		return Response.json({ report: milestonesReport(new Date(), tz) });
	} catch (err) {
		return failed(err);
	}
}
