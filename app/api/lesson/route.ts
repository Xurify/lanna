/**
 * GET /api/lesson?unit=<id> — a fresh 12-rep lesson for one unit, built
 * locally from the lexicon (no model call). ?mode=blitz — a choose-only
 * sprint across the units you have started.
 * POST /api/lesson {unit, mode, reps:[{itemId, slug, kind, verdict}], ms?, tz?}
 * — record the finished lesson: XP, the day, the unit's level; missed
 * words go into the review deck. Returns the outcome and a fresh summary.
 */

import { isUnitId } from "@/src/core";
import { blitzFor, lessonFor, recordLesson, type RepResult } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const url = new URL(req.url);
	if (url.searchParams.get("mode") === "blitz") return Response.json(blitzFor());
	const unit = url.searchParams.get("unit");
	if (!isUnitId(unit)) return Response.json({ message: "unknown unit" }, { status: 400 });
	return Response.json(lessonFor(unit));
}

const KINDS = new Set(["choose", "type", "build", "listen"]);
const VERDICTS = new Set(["exact", "accents", "wrong"]);

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as {
		unit?: unknown;
		mode?: unknown;
		reps?: unknown;
		ms?: unknown;
		tz?: unknown;
	} | null;
	if (!body || !isUnitId(body.unit) || !Array.isArray(body.reps)) {
		return Response.json({ message: "unit and reps are required" }, { status: 400 });
	}
	const reps: RepResult[] = body.reps.flatMap((r: unknown) => {
		const x = r as Partial<RepResult> | null;
		return x && typeof x.itemId === "string" && typeof x.slug === "string" && KINDS.has(x.kind as string) && VERDICTS.has(x.verdict as string)
			? [{ itemId: x.itemId, slug: x.slug, kind: x.kind!, verdict: x.verdict! }]
			: [];
	});
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
	return Response.json(
		recordLesson({
			unit: body.unit,
			mode: body.mode === "blitz" ? "blitz" : "lesson",
			reps,
			ms: typeof body.ms === "number" ? body.ms : undefined,
			tz,
		}),
	);
}
