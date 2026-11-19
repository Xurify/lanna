import { BODY_LIMITS, bodyTooLarge, checkPracticeSentence } from "@/src/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		lemma?: unknown;
		slug?: unknown;
		gloss?: unknown;
		sentence?: unknown;
		source?: unknown;
		tz?: unknown;
	} | null;
	if (!body || typeof body.lemma !== "string" || typeof body.sentence !== "string") {
		return Response.json({ message: "lemma and sentence are required" }, { status: 400 });
	}
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
	const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim().slice(0, 120) : undefined;
	const gloss = typeof body.gloss === "string" && body.gloss.trim() ? body.gloss.trim().slice(0, 200) : undefined;
	const source = body.source === "practice" ? "practice" : "hardwords";
	try {
		return Response.json(
			await checkPracticeSentence({
				lemma: body.lemma,
				slug,
				gloss,
				sentence: body.sentence,
				source,
				tz,
			}),
		);
	} catch (err) {
		return Response.json(
			{ message: err instanceof Error ? err.message : "Could not check the sentence." },
			{ status: 400 },
		);
	}
}
