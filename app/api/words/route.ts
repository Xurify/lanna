/**
 * GET /api/words — paginated word bank with FSRS retention, filters, summary stats, or single word lookup
 * POST /api/words — adds a word to the active FSRS word bank / review deck (and optionally favorites it)
 */

import {
	addWordToBank,
	BODY_LIMITS,
	bodyTooLarge,
	getWordBank,
	lookupSelectionAsync,
	type WordBankQuery,
} from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const lookup = url.searchParams.get("lookup");
	if (lookup !== null) {
		const includeGoogleTranslate = url.searchParams.get("gt") === "1";
		const res = await lookupSelectionAsync(lookup, { includeGoogleTranslate });
		return Response.json(res);
	}

	const search = url.searchParams.get("search") ?? undefined;
	const pos = url.searchParams.get("pos") ?? undefined;
	const statusParam = url.searchParams.get("status");
	const status =
		statusParam === "all" ||
		statusParam === "mastered" ||
		statusParam === "learning" ||
		statusParam === "new" ||
		statusParam === "unseen" ||
		statusParam === "favorite" ||
		statusParam === "due" ||
		statusParam === "known"
			? statusParam
			: undefined;

	const limitParam = Number(url.searchParams.get("limit"));
	const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(100, limitParam) : 40;

	const offsetParam = Number(url.searchParams.get("offset"));
	const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	const query: WordBankQuery = {
		search,
		pos,
		status,
		limit,
		offset,
	};

	const result = getWordBank(query);
	return Response.json(result);
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		slug?: unknown;
		word?: unknown;
		gloss?: unknown;
		favorite?: unknown;
	} | null;

	const target =
		typeof body?.slug === "string" && body.slug.trim()
			? body.slug.trim()
			: typeof body?.word === "string" && body.word.trim()
				? body.word.trim()
				: "";

	if (!target) {
		return Response.json({ message: "slug or word is required" }, { status: 400 });
	}

	const customGloss = typeof body?.gloss === "string" ? body.gloss.trim() : undefined;
	const result = addWordToBank(target, body?.favorite === true, customGloss);
	return Response.json(result);
}
