/**
 * GET /api/review[?tz=<minutes>][&peek] — the deck's counts and the next card
 * (minting today's new cards as needed; ?peek never mints).
 * POST /api/review {cardId, given, ms?, activeMs?, rating?, hints?, picked?, spans?, tz?} — grade one answer and
 * schedule the card (FSRS). Returns the verdict, the rating used and the
 * updated card, the XP the answer earned and `status`, the deck as GET returns it.
 */

import { answerReview, BODY_LIMITS, bodyTooLarge, recordReviewXp, reviewStatus, spansOf } from "@/src/server";

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
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		cardId?: unknown;
		given?: unknown;
		ms?: unknown;
		activeMs?: unknown;
		rating?: unknown;
		hints?: unknown;
		picked?: unknown;
		spans?: unknown;
		tz?: unknown;
	} | null;
	if (typeof body?.cardId !== "string" || typeof body.given !== "string") {
		return Response.json({ message: "cardId and given are required strings" }, { status: 400 });
	}
	const rating =
		body.rating === 1 || body.rating === 2 || body.rating === 3 || body.rating === 4 ? body.rating : undefined;
	const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : undefined;
	try {
		const hints = typeof body.hints === "number" && body.hints > 0 ? Math.min(2, Math.floor(body.hints)) : undefined;
		const spans = spansOf(body.spans);
		const outcome = answerReview({
			cardId: body.cardId,
			given: body.given,
			ms,
			rating,
			hints,
			picked: body.picked === true,
			spans,
		});
		// Reviews count toward the day's XP and the streak (Today screen).
		const activeMs = typeof body.activeMs === "number" && Number.isFinite(body.activeMs) ? body.activeMs : undefined;
		const xp = recordReviewXp(outcome.verdict, tzOf(req), new Date(), ms, activeMs);
		// The deck after this answer rides along, so the next card needs no second request.
		return Response.json({
			...outcome,
			xp,
			status: reviewStatus(new Date(), tzOf(req) ?? (typeof body.tz === "number" ? body.tz : undefined), {
				mint: true,
			}),
		});
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 404 });
	}
}
