import { WRITING_TARGETS } from "@/src/core";
import { BODY_LIMITS, bodyTooLarge, checkWriting, friendlyAiError, redactSecrets } from "@/src/server";

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { slugs?: unknown; text?: unknown } | null;
	if (
		!body ||
		typeof body.text !== "string" ||
		!Array.isArray(body.slugs) ||
		body.slugs.length > WRITING_TARGETS ||
		!body.slugs.every((slug) => typeof slug === "string" && slug.length <= 120)
	)
		return Response.json({ message: "A passage and up to three target words are required." }, { status: 400 });
	try {
		return Response.json(await checkWriting({ slugs: body.slugs, text: body.text }, { signal: req.signal }));
	} catch (error) {
		return Response.json({ message: redactSecrets(friendlyAiError(error)) }, { status: 400 });
	}
}
