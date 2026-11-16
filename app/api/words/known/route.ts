/**
 * Words the learner marked as known (E71, src/store/known-words.ts).
 * GET ?slug=<slug> — {slug, known}.
 * POST {slug, known: true|false} — mark or unmark a dictionary word; answers
 * {slug, lemma, known}. 404 for a slug the dictionary does not have.
 */

import { BODY_LIMITS, bodyTooLarge, knownWordStore, loadLexicon } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const slug = new URL(req.url).searchParams.get("slug");
	if (!slug) return Response.json({ message: "slug is required" }, { status: 400 });
	return Response.json({ slug, known: knownWordStore.has(slug) });
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { slug?: unknown; known?: unknown } | null;
	if (!body || typeof body.slug !== "string" || !body.slug.trim())
		return Response.json({ message: "slug is required" }, { status: 400 });
	const slug = body.slug.trim();
	const entry = loadLexicon()?.bySlug.get(slug);
	if (!entry) return Response.json({ message: "The dictionary has no such word." }, { status: 404 });
	const known = knownWordStore.set(slug, entry.sk ?? entry.lemma ?? slug, body.known !== false);
	return Response.json({ slug, lemma: entry.sk ?? entry.lemma ?? slug, known });
}
