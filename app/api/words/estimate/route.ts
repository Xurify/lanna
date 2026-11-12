import { recordEstimateDay } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const tzParam = Number(new URL(req.url).searchParams.get("tz"));
	const tz = Number.isFinite(tzParam) && Math.abs(tzParam) <= 840 ? tzParam : undefined;
	return Response.json(recordEstimateDay(new Date(), tz));
}
