/**
 * GET /api/review[?tz=<minutes>][&peek] — the deck's counts and the next card
 * (minting today's new cards as needed; ?peek never mints).
 * POST /api/review {cardId, given, ms?, rating?} — grade one answer and
 * schedule the card (FSRS). Returns the verdict, the rating used and the
 * updated card, plus the XP the answer earned.
 */

import { answerReview, recordReviewXp, reviewStatus } from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(req: Request): number | undefined {
	const tz = Number(new URL(req.url).searchParams.get("tz"));
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
}

export async function GET(req: Request) {
	// ?peek: counts only — never mints a new card (the sidebar badge).
	const peek = new URL(req.url).searchParams.get("peek") !== null;
	return Response.json(reviewStatus(new Date(), tzOf(req), { mint: !peek }));
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { cardId?: unknown; given?: unknown; ms?: unknown; rating?: unknown } | null;
	if (typeof body?.cardId !== "string" || typeof body.given !== "string") {
		return Response.json({ message: "cardId and given are required strings" }, { status: 400 });
	}
	const rating = body.rating === 1 || body.rating === 2 || body.rating === 3 || body.rating === 4 ? body.rating : undefined;
	const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : undefined;
	try {
		const outcome = answerReview({ cardId: body.cardId, given: body.given, ms, rating });
		// Reviews count toward the day's XP and the streak (Today screen).
		const xp = recordReviewXp(outcome.verdict, tzOf(req), new Date(), ms);
		return Response.json({ ...outcome, xp });
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 404 });
	}
}
