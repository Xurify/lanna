/**
 * GET /api/placement?recheck=1 — the placement staircase (src/core/
 * onboarding.ts): every tier's reps, built locally from the lexicon, and
 * the tier to start at (a re-check starts where the learner is).
 * POST /api/placement {reps:[{tier, itemId, slug, kind, verdict, detail}], ms?, tz?}
 * — record the finished drill: tested-out units, weak units, the level
 * found and the chapter to start in; every rep goes to the lesson log.
 */

import { placementFor, recordPlacement, type RepResult } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const url = new URL(req.url);
	return Response.json(placementFor({ recheck: url.searchParams.get("recheck") === "1" }));
}

const KINDS = new Set(["choose", "type", "build", "listen"]);
const VERDICTS = new Set(["exact", "accents", "wrong"]);
const str = (v: unknown, max = 600) => (typeof v === "string" ? v.slice(0, max) : undefined);

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { reps?: unknown; ms?: unknown; tz?: unknown } | null;
	if (!body || !Array.isArray(body.reps)) return Response.json({ message: "reps are required" }, { status: 400 });
	const reps = body.reps.flatMap((r: unknown) => {
		const x = r as Partial<RepResult & { tier: string }> | null;
		if (!x || typeof x.tier !== "string" || typeof x.itemId !== "string" || typeof x.slug !== "string" || !KINDS.has(x.kind as string) || !VERDICTS.has(x.verdict as string)) return [];
		const d = (x.detail ?? {}) as Record<string, unknown>;
		return [
			{
				tier: x.tier.slice(0, 10),
				itemId: x.itemId,
				slug: x.slug,
				kind: x.kind!,
				verdict: x.verdict!,
				detail: {
					unit: str(d.unit, 40),
					lemma: str(d.lemma, 80),
					gloss: str(d.gloss, 200),
					sentence: str(d.sentence),
					translation: str(d.translation),
					answer: str(d.answer, 120),
					given: str(d.given),
					trigger: str(d.trigger, 40),
					options: Array.isArray(d.options) ? d.options.filter((o): o is string => typeof o === "string").slice(0, 8) : undefined,
				},
			},
		];
	});
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
	return Response.json(recordPlacement({ reps, ms: typeof body.ms === "number" ? body.ms : undefined, tz }));
}
