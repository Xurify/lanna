/**
 * The chapter exam (Skúška, phase 6a, E14), record only:
 *   GET  /api/exam?chapter=<id>&seed=<n> — the eight choose items drawn
 *        from the chapter's own units (deterministic per seed).
 *   POST /api/exam {chapter, seed, answers} — the finished exam: graded
 *        here from the same seed's draw, the attempt kept on the record
 *        (progress.json's exams), nothing gated yet.
 */

import { BODY_LIMITS, bodyTooLarge, examFor, recordExam } from "@/src/server";

export const dynamic = "force-dynamic";

const fail = (err: unknown, status = 400) => Response.json({ message: err instanceof Error ? err.message : String(err) }, { status });

export async function GET(req: Request) {
	const url = new URL(req.url);
	const chapter = url.searchParams.get("chapter");
	if (!chapter) return Response.json({ message: "chapter is required" }, { status: 400 });
	const seed = Number(url.searchParams.get("seed"));
	try {
		return Response.json(examFor(chapter, Number.isFinite(seed) && seed > 0 ? seed : Date.now()));
	} catch (err) {
		return fail(err, 404);
	}
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { chapter?: unknown; seed?: unknown; answers?: unknown } | null;
	if (!body || typeof body.chapter !== "string") return Response.json({ message: "chapter is required" }, { status: 400 });
	if (typeof body.seed !== "number" || !Number.isFinite(body.seed)) return Response.json({ message: "seed is required" }, { status: 400 });
	const answers = Array.isArray(body.answers) ? body.answers.slice(0, 64) : [];
	try {
		return Response.json(recordExam({ chapterId: body.chapter, seed: body.seed, answers }));
	} catch (err) {
		return fail(err, 404);
	}
}
