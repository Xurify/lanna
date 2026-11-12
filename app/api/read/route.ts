/**
 * GET /api/read?tz=<minutes> — the reading state: the story to read now
 * (the shelf's best fit for the learner), the library with every story's
 * readings, whether a new one can be written, and what is being written in
 * the background. ?id=<story> — one story. ?progress — the story being
 * written right now, sentence by sentence.
 * POST /api/read {action: "next"} — the next episode: the newest unread
 * one, or a new one written on the cheap model slot and kept under
 * data/profiles/<language>/stories/ (src/server/reading.ts).
 * POST /api/read {action: "finish", storyId, answers, tapped, ms?, tz?} —
 * a finished reading: the comprehension score, XP, the words sent to the
 * review deck, and a fresh summary.
 * POST /api/read {action: "import", url? | text?, title?, difficulty?} — a
 * text of the learner's own: kept, cut into parts, and its first unread
 * part written (src/server/read-import.ts).
 * POST /api/read {action: "import", urls, difficulty?} — several links
 * at once: each is read and kept, the answer says how many were added and
 * which could not be read, and their first parts are written afterwards.
 * POST /api/read {action: "part", sourceId, part} — that part, written now
 * when it is not yet. {action: "remove-source", sourceId} hides a text.
 */

import { isReadingDifficulty, MAX_LINKS_PER_ADD, MAX_SOURCE_PARTS } from "@/src/core";
import { BODY_LIMITS, bodyTooLarge, generating, importLinks, importReading, nextStory, ReadImportError, readingState, recordOnce, recordRead, removeSource, sessionClientId, sourcePart, storyStore, UNKNOWN_TEXT } from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(v: unknown): number | undefined {
	const tz = Number(v);
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
}

export async function GET(req: Request) {
	const url = new URL(req.url);
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
	const body = (await req.json().catch(() => null)) as {
		action?: unknown;
		storyId?: unknown;
		answers?: unknown;
		tapped?: unknown;
		ms?: unknown;
		activeMs?: unknown;
		tz?: unknown;
		clientId?: unknown;
		text?: unknown;
		url?: unknown;
		urls?: unknown;
		title?: unknown;
		difficulty?: unknown;
		sourceId?: unknown;
		part?: unknown;
	} | null;
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
		const storyId = body.storyId;
		const answers = Array.isArray(body.answers) ? body.answers.map((a) => (typeof a === "number" ? a : -1)).slice(0, 8) : [];
		const tapped = Array.isArray(body.tapped) ? body.tapped.filter((t): t is string => typeof t === "string").slice(0, 200) : [];
		try {
			return Response.json(recordOnce("read", sessionClientId(body.clientId), () => recordRead({ storyId, answers, tapped, ms: typeof body.ms === "number" ? body.ms : undefined, activeMs: typeof body.activeMs === "number" ? body.activeMs : undefined, tz: tzOf(body.tz) })));
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 404 });
		}
	}
	if (body.action === "import" && Array.isArray(body.urls)) {
		const urls = body.urls.filter((u): u is string => typeof u === "string" && u.length <= MAX_URL_CHARS).slice(0, MAX_LINKS_PER_ADD);
		const difficulty = isReadingDifficulty(body.difficulty) ? body.difficulty : undefined;
		try {
			const { added, failed } = await importLinks(urls, difficulty);
			return Response.json({ added: added.length, failed });
		} catch (err) {
			return modelFailure(err);
		}
	}
	if (body.action === "import") {
		const url = typeof body.url === "string" ? body.url.slice(0, MAX_URL_CHARS) : undefined;
		const text = typeof body.text === "string" ? body.text : undefined;
		const title = typeof body.title === "string" ? body.title.slice(0, MAX_TITLE_CHARS) : undefined;
		const difficulty = isReadingDifficulty(body.difficulty) ? body.difficulty : undefined;
		try {
			return Response.json(await importReading({ url, text, title, difficulty }));
		} catch (err) {
			if (err instanceof ReadImportError) return Response.json({ message: err.message }, { status: 422 });
			return modelFailure(err);
		}
	}
	if (body.action === "part") {
		const part = Number(body.part);
		if (!validSourceId(body.sourceId) || !Number.isInteger(part) || part < 1 || part > MAX_SOURCE_PARTS) return Response.json({ message: "sourceId and part are required" }, { status: 400 });
		try {
			return Response.json(await sourcePart(body.sourceId, part));
		} catch (err) {
			return modelFailure(err);
		}
	}
	if (body.action === "remove-source") {
		if (!validSourceId(body.sourceId)) return Response.json({ message: "sourceId is required" }, { status: 400 });
		removeSource(body.sourceId);
		return Response.json({ ok: true });
	}
	return Response.json({ message: "action must be next, finish, import, part or remove-source" }, { status: 400 });
}

const MAX_URL_CHARS = 2000;
const MAX_TITLE_CHARS = 200;

function validSourceId(id: unknown): id is string {
	return typeof id === "string" && /^[a-z0-9][a-z0-9-]*$/.test(id);
}

function modelFailure(err: unknown): Response {
	const message = err instanceof Error ? err.message : String(err);
	const status = message.startsWith(UNKNOWN_TEXT) ? 404 : /No model is configured/.test(message) ? 503 : 502;
	return Response.json({ message }, { status });
}
