/**
 * GET /api/milestones — the report: what the app knows about the learner
 * and, per milestone, the words and speed gaps and the dates
 * (src/server/milestones.ts).
 * POST /api/milestones {text} — a milestone in the learner's words, mapped
 * once by the cheap model slot and kept on disk; returns the new report.
 * DELETE /api/milestones?id= — hide a custom milestone (kept on disk).
 */

import { addCustomMilestone, milestonesReport, removeCustomMilestone } from "@/src/server";

export const dynamic = "force-dynamic";

const tzOf = (req: Request) => {
	const tz = Number(new URL(req.url).searchParams.get("tz"));
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
};

export async function GET(req: Request) {
	return Response.json(milestonesReport(new Date(), tzOf(req)));
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
	if (!body || typeof body.text !== "string") return Response.json({ message: "text must be a string" }, { status: 400 });
	try {
		const { record, reused } = await addCustomMilestone(body.text);
		return Response.json({ id: record.def.id, reused, report: milestonesReport(new Date(), tzOf(req)) });
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 422 });
	}
}

export async function DELETE(req: Request) {
	const id = new URL(req.url).searchParams.get("id") ?? "";
	if (!id.startsWith("custom-")) return Response.json({ message: "only custom milestones can be removed" }, { status: 400 });
	const removed = removeCustomMilestone(id);
	return Response.json({ removed, report: milestonesReport(new Date(), tzOf(req)) });
}
