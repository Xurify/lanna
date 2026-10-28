/**
 * GET /api/read?tz=<minutes> — the reading state: the episode to read now
 * (the newest unread one), the library with every episode's readings, and
 * whether a new episode can be written. ?id=<story> — one story.
 * POST /api/read {action: "next"} — the next episode: the newest unread
 * one, or a new one written on the cheap model slot and kept under
 * data/profiles/<language>/stories/ (src/server/reading.ts).
 * POST /api/read {action: "finish", storyId, answers, tapped, ms?, tz?} —
 * a finished reading: the comprehension score, XP, the words sent to the
 * review deck, and a fresh summary.
 */

import { nextStory, readingState, recordRead, storyStore } from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(v: unknown): number | undefined {
	const tz = Number(v);
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	const id = url.searchParams.get("id");
	if (id) {
		const story = storyStore.get(id);
		return story ? Response.json(story) : Response.json({ message: "no such story" }, { status: 404 });
	}
	return Response.json(readingState(tzOf(url.searchParams.get("tz"))));
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; storyId?: unknown; answers?: unknown; tapped?: unknown; ms?: unknown; tz?: unknown } | null;
	if (!body) return Response.json({ message: "a JSON body is required" }, { status: 400 });
	if (body.action === "next") {
		try {
			return Response.json(await nextStory());
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return Response.json({ message }, { status: /No model is configured/.test(message) ? 503 : 502 });
		}
	}
	if (body.action === "finish") {
		if (typeof body.storyId !== "string") return Response.json({ message: "storyId is required" }, { status: 400 });
		const answers = Array.isArray(body.answers) ? body.answers.map((a) => (typeof a === "number" ? a : -1)).slice(0, 8) : [];
		const tapped = Array.isArray(body.tapped) ? body.tapped.filter((t): t is string => typeof t === "string").slice(0, 200) : [];
		try {
			return Response.json(recordRead({ storyId: body.storyId, answers, tapped, ms: typeof body.ms === "number" ? body.ms : undefined, tz: tzOf(body.tz) }));
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 404 });
		}
	}
	return Response.json({ message: "action must be next or finish" }, { status: 400 });
}
