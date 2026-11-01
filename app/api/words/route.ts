/**
 * GET /api/words — paginated word bank with FSRS retention, filters, and summary stats
 */

import { getWordBank, type WordBankQuery } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const url = new URL(req.url);
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
		statusParam === "due"
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
