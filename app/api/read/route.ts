/**
 * GET /api/read?tz=<minutes> — the reading state: the story to read now
 * (the shelf's best fit for the learner), the library with every story's
 * readings, whether a new one can be written, and what is being written in
 * the background. ?id=<story> — one story. ?progress — the story being
 * written right now, sentence by sentence.
 * POST /api/read {action: "next"} — the next episode: the newest unread
 * one, or a new one written on the cheap model slot and kept under
 * data/profiles/<language>/stories/ (src/server/reading.ts).
 * POST /api/read {action: "write"} — write a new episode on the cheap
 * model slot and keep it on disk, even if unread stories exist.
 * POST /api/read {action: "finish", storyId, answers, tapped, ms?, tz?} —
 * a finished reading: the comprehension score, XP, the words sent to the
 * review deck, and a fresh summary.
 */

import { BODY_LIMITS, bodyTooLarge, generating, nextStory, readingState, recordOnce, recordRead, sessionClientId, storyStore, writeNewStory } from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(v: unknown): number | undefined {
	const tz = Number(v);
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	// The sentences of the story being written so far (the writing screen
	// polls this and shows them as they arrive).
	if (url.searchParams.get("progress") !== null) return Response.json({ generating: generating() });
	const id = url.searchParams.get("id");
	if (id) {
		const story = storyStore.get(id);
		return story ? Response.json(story) : Response.json({ message: "no such story" }, { status: 404 });
	}
	return Response.json(readingState(tzOf(url.searchParams.get("tz"))));
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as { action?: unknown; storyId?: unknown; answers?: unknown; tapped?: unknown; ms?: unknown; activeMs?: unknown; tz?: unknown; clientId?: unknown } | null;
	if (!body) return Response.json({ message: "a JSON body is required" }, { status: 400 });
	if (body.action === "next") {
		try {
			return Response.json(await nextStory());
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return Response.json({ message }, { status: /No model is configured/.test(message) ? 503 : 502 });
		}
	}
	if (body.action === "write") {
		try {
			return Response.json(await writeNewStory());
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return Response.json({ message }, { status: /No model is configured/.test(message) ? 503 : 502 });
		}
	}
	if (body.action === "finish") {
		if (typeof body.storyId !== "string") return Response.json({ message: "storyId is required" }, { status: 400 });
		const storyId = body.storyId;
		const answers = Array.isArray(body.answers) ? body.answers.map((a) => (typeof a === "number" ? a : -1)).slice(0, 8) : [];
		const tapped = Array.isArray(body.tapped) ? body.tapped.filter((t): t is string => typeof t === "string").slice(0, 200) : [];
		try {
			return Response.json(recordOnce("read", sessionClientId(body.clientId), () => recordRead({ storyId, answers, tapped, ms: typeof body.ms === "number" ? body.ms : undefined, activeMs: typeof body.activeMs === "number" ? body.activeMs : undefined, tz: tzOf(body.tz) })));
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 404 });
		}
	}
	return Response.json({ message: "action must be next, write or finish" }, { status: 400 });
}
