/**
 * POST /api/words/favorite — toggle or set favorite status for a word slug
 * GET /api/words/favorite?slug=<slug> — check favorite status for a word slug
 */

import { savedPhraseStore } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const slug = url.searchParams.get("slug");
	if (!slug) {
		return Response.json({ message: "slug query parameter is required" }, { status: 400 });
	}
	const isFav = savedPhraseStore.isFavorite(slug);
	return Response.json({ slug, favorite: isFav });
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as {
		slug?: unknown;
		favorite?: unknown;
	} | null;

	if (typeof body?.slug !== "string" || !body.slug.trim()) {
		return Response.json({ message: "slug is a required string" }, { status: 400 });
	}

	const slug = body.slug.trim();
	let isFav: boolean;

	if (typeof body.favorite === "boolean") {
		savedPhraseStore.setFavorite(slug, body.favorite);
		isFav = body.favorite;
	} else {
		isFav = savedPhraseStore.toggleFavorite(slug);
	}

	return Response.json({ slug, favorite: isFav });
}
