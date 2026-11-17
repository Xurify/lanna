import { reviewMiss, reviewMissWithNote, spansOf } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const cardId = url.searchParams.get("cardId");
	const given = url.searchParams.get("given");
	if (!cardId || given === null) return Response.json({ message: "cardId and given are required" }, { status: 400 });
	const spans = spansOf(
		url.searchParams
			.get("spans")
			?.split(",")
			.map((pair) => pair.split("-").map(Number)),
	);
	if (url.searchParams.get("note") === "write")
		return Response.json({ reason: await reviewMissWithNote(cardId, given, spans) });
	return Response.json({ reason: reviewMiss(cardId, given, spans) });
}
