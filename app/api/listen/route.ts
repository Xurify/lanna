/**
 * GET /api/listen — a Listen session: ten dictionary sentences of mostly
 * known words, each with its stretch words glossed (src/server/listen.ts). Built locally; the wrong meanings are
 * close ones (src/server/distractors.ts), and a cheap-model near-miss is
 * asked for only when the dictionary has none close, then kept.
 * POST /api/listen {reps, ms?, activeMs?, tz?} — a finished session: XP, the day's
 * listening, the stretch words sent to the review deck, a fresh summary.
 */

import { listenFor, listenWithBetterOptions, recordListen, type ListenRep } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json(await listenWithBetterOptions(listenFor()));
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { reps?: unknown; ms?: unknown; activeMs?: unknown; tz?: unknown } | null;
	if (!body || !Array.isArray(body.reps)) return Response.json({ message: "reps must be an array" }, { status: 400 });
	const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 600) : "");
	const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(Math.min(v, 3_600_000)) : undefined);
	const reps: ListenRep[] = body.reps.slice(0, 40).map((r: Record<string, unknown>) => ({
		itemId: str(r.itemId),
		slug: str(r.slug),
		lemma: str(r.lemma),
		gloss: str(r.gloss),
		sentence: str(r.sentence),
		translation: str(r.translation),
		given: str(r.given),
		// Without this a typed sentence was taken for a picked meaning: not graded again here, logged as a meaning, and an accents-only answer counted as wrong.
		answer: r.answer === "type" ? "type" : "pick",
		verdict: r.verdict === "exact" ? "exact" : "wrong",
		options: Array.isArray(r.options) ? r.options.filter((o): o is string => typeof o === "string").slice(0, 4) : undefined,
		stretch: Array.isArray(r.stretch) ? r.stretch.filter((s): s is string => typeof s === "string").slice(0, 4) : [],
		...(num(r.ms) !== undefined ? { ms: num(r.ms) } : {}),
		...(num(r.heardMs) !== undefined ? { heardMs: num(r.heardMs) } : {}),
		...(num(r.replays) !== undefined ? { replays: num(r.replays) } : {}),
		...(typeof r.peeked === "boolean" ? { peeked: r.peeked } : {}),
		...(num(r.words) !== undefined ? { words: num(r.words) } : {}),
		...(Array.isArray(r.stretchText) ? { stretchText: r.stretchText.filter((w): w is string => typeof w === "string").map((w) => w.slice(0, 60)).slice(0, 4) } : {}),
	}));
	const tz = Number(body.tz);
	return Response.json(recordListen({ reps, ms: typeof body.ms === "number" ? body.ms : undefined, activeMs: typeof body.activeMs === "number" ? body.activeMs : undefined, tz: Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined }));
}
