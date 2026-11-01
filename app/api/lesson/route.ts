/**
 * GET /api/lesson?unit=<id> — a fresh 12-rep lesson for one unit, built
 * locally from the lexicon (no model call). ?mode=blitz — a choose-only
 * sprint across the units you have started. ?mode=mixups — the Mix-ups
 * lesson: the pairs of words you confuse and the pairs predicted from them.
 * POST /api/lesson {unit, mode, focus?, reps:[{itemId, slug, kind, verdict, assisted?, first?, detail?}], ms?, activeMs?, tz?, clientId?}
 * (`focus: "mixups"` records a Mix-ups lesson: no unit moves.)
 * (`first` is the answer before any cue — the first-try measure, src/core/first-try.ts.)
 * — record the finished lesson: XP, the day, the unit's level; missed
 * words go into the review deck; the whole lesson (every sentence and
 * answer, from `detail`) is appended to the lesson log. Returns the
 * outcome and a fresh summary.
 */

import { isAtlasGender, isUnitId, type FirstAnswer } from "@/src/core";
import { blitzFor, lessonFor, lessonWithBetterOptions, mixupsFor, recordLesson, type RepResult } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
	const url = new URL(req.url);
	if (url.searchParams.get("mode") === "blitz") return Response.json(blitzFor());
	if (url.searchParams.get("mode") === "mixups") return Response.json(mixupsFor());
	const unit = url.searchParams.get("unit");
	if (!isUnitId(unit)) return Response.json({ message: "unknown unit" }, { status: 400 });
	const rawGender = url.searchParams.get("gender");
	const gender = isAtlasGender(rawGender) ? rawGender : undefined;
	return Response.json(await lessonWithBetterOptions(lessonFor(unit, Date.now(), { gender })));
}

const KINDS = new Set(["meaning", "choose", "type", "build", "listen"]);

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.slice(0, max) : undefined);
const num = (v: unknown, min = 0, max = 300000) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : undefined);

/** The optional per-rep record for the lesson log: strings only, bounded. */
function repDetail(v: unknown): RepResult["detail"] {
	if (!v || typeof v !== "object") return undefined;
	const d = v as Record<string, unknown>;
	return {
		unit: str(d.unit, 40),
		lemma: str(d.lemma, 80),
		gloss: str(d.gloss, 200),
		sentence: str(d.sentence),
		translation: str(d.translation),
		answer: str(d.answer, 120),
		given: str(d.given),
		trigger: str(d.trigger, 40),
		options: Array.isArray(d.options) ? d.options.filter((o): o is string => typeof o === "string").slice(0, 8) : undefined,
		mixed: d.mixed === true,
		again: d.again === true,
		latencyMs: num(d.latencyMs),
	};
}
const VERDICTS = new Set(["exact", "accents", "wrong"]);

/** The first answer to a rep, as the client saw it before any cue (src/core/first-try.ts). */
function firstOf(v: unknown): FirstAnswer | undefined {
	if (!v || typeof v !== "object") return undefined;
	const f = v as Record<string, unknown>;
	const given = str(f.given);
	if (given === undefined || !VERDICTS.has(f.verdict as string)) return undefined;
	return { given, verdict: f.verdict as FirstAnswer["verdict"], ...(f.peeked === true ? { peeked: true } : {}) };
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as {
		unit?: unknown;
		mode?: unknown;
		reps?: unknown;
		ms?: unknown;
		activeMs?: unknown;
		tz?: unknown;
		clientId?: unknown;
		focus?: unknown;
	} | null;
	if (!body || !isUnitId(body.unit) || !Array.isArray(body.reps)) {
		return Response.json({ message: "unit and reps are required" }, { status: 400 });
	}
	const reps: RepResult[] = body.reps.flatMap((r: unknown) => {
		const x = r as Partial<RepResult> | null;
		if (!x || typeof x.itemId !== "string" || typeof x.slug !== "string" || !KINDS.has(x.kind as string) || !VERDICTS.has(x.verdict as string)) return [];
		const first = firstOf(x.first);
		const latencyMs = num(x.latencyMs);
		return [{ itemId: x.itemId, slug: x.slug, kind: x.kind!, verdict: x.verdict!, ...(x.assisted === true ? { assisted: true } : {}), ...(first ? { first } : {}), ...(latencyMs !== undefined ? { latencyMs } : {}), detail: repDetail(x.detail) }];
	});
	const tz = typeof body.tz === "number" && Math.abs(body.tz) <= 840 ? body.tz : undefined;
	const clientId = typeof body.clientId === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.clientId) ? body.clientId : undefined;
	return Response.json(
		recordLesson({
			unit: body.unit,
			mode: body.mode === "blitz" ? "blitz" : "lesson",
			...(body.focus === "mixups" && body.mode !== "blitz" ? { focus: "mixups" as const } : {}),
			reps,
			ms: typeof body.ms === "number" ? body.ms : undefined,
			activeMs: typeof body.activeMs === "number" ? body.activeMs : undefined,
			tz,
			clientId,
		}),
	);
}
