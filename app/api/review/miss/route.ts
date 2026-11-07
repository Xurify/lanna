import { reviewMiss } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const cardId = url.searchParams.get("cardId");
	const given = url.searchParams.get("given");
	if (!cardId || given === null) return Response.json({ message: "cardId and given are required" }, { status: 400 });
	return Response.json({ reason: reviewMiss(cardId, given) });
}
