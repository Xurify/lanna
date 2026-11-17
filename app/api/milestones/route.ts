import { addCustomMilestone, BODY_LIMITS, bodyTooLarge, milestonesReport, setMilestoneHidden } from "@/src/server";

export const dynamic = "force-dynamic";

const tzOf = (req: Request) => {
	const tz = Number(new URL(req.url).searchParams.get("tz"));
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
};

export async function GET(req: Request) {
	return Response.json(milestonesReport(new Date(), tzOf(req)));
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
	if (!body || typeof body.text !== "string")
		return Response.json({ message: "text must be a string" }, { status: 400 });
	try {
		const { record, reused } = await addCustomMilestone(body.text);
		return Response.json({ id: record.def.id, reused, report: milestonesReport(new Date(), tzOf(req)) });
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 422 });
	}
}

export async function DELETE(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const id = new URL(req.url).searchParams.get("id") ?? "";
	const removed = setMilestoneHidden(id, true);
	if (!removed) return Response.json({ message: "That milestone is not on your list." }, { status: 404 });
	return Response.json({ removed, report: milestonesReport(new Date(), tzOf(req)) });
}

export async function PATCH(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
	if (!body || typeof body.id !== "string") return Response.json({ message: "id must be a string" }, { status: 400 });
	if (!setMilestoneHidden(body.id, false))
		return Response.json({ message: "That milestone is not on your list." }, { status: 404 });
	return Response.json({ report: milestonesReport(new Date(), tzOf(req)) });
}
