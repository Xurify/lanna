import { BODY_LIMITS, bodyTooLarge, getCommonWords, markCommonWordsKnown, unmarkCommonWords } from "@/src/server";

export const dynamic = "force-dynamic";

function validCount(count: unknown): count is number {
	return typeof count === "number" && Number.isSafeInteger(count) && count > 0 && count <= 100_000;
}

export async function GET(req: Request) {
	const count = Number(new URL(req.url).searchParams.get("count") ?? 200);
	if (!validCount(count))
		return Response.json({ message: "Choose a whole number of words between 1 and 100,000." }, { status: 400 });
	return Response.json(getCommonWords(count));
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { count?: unknown; from?: unknown; known?: unknown } | null;
	if (!validCount(body?.count))
		return Response.json({ message: "Choose a whole number of words between 1 and 100,000." }, { status: 400 });
	const from = body.from ?? 1;
	if (!validCount(from) || from > body.count)
		return Response.json({ message: "Choose a start between 1 and the count." }, { status: 400 });
	if (body.known === false) return Response.json(unmarkCommonWords(body.count, new Date(), from));
	return Response.json(markCommonWordsKnown(body.count, new Date(), from));
}
