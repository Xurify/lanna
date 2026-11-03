/**
 * GET /api/watch?tz=<minutes> — the watch state: the library with every
 * video's watchings, whether a model is set (translation, questions),
 * whether audio can be transcribed, and what is being prepared.
 * ?id=<videoId> — one prepared video. ?status=<videoId> — the step a
 * preparation is at. ?thumb=<videoId> — the video's thumbnail (a JPEG),
 * fetched and kept on first use.
 * POST /api/watch {action: "add", url, transcribe?} — prepare a video
 * from a YouTube link (src/server/watch.ts): captions fetched, cut into
 * lines, translated on the cheap slot, glossed, questioned, kept under
 * data/profiles/<language>/videos/. Reused when already there.
 * POST /api/watch {action: "finish", videoId, mode, stats, answers,
 * tapped, ms?, tz?} — a finished watching: XP, the check, the words sent
 * to the review deck, a fresh summary.
 */

import type { SegmentStat, WatchMode } from "@/src/core";
import { NoCaptionsError, prepareStage, prepareVideo, recordWatch, thumbnailBytes, videoStore, watchState } from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(v: unknown): number | undefined {
	const tz = Number(v);
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	const thumb = url.searchParams.get("thumb");
	if (thumb) {
		const bytes = await thumbnailBytes(thumb);
		return bytes ? new Response(new Uint8Array(bytes), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" } }) : Response.json({ message: "no thumbnail" }, { status: 404 });
	}
	const id = url.searchParams.get("id");
	if (id) {
		const video = videoStore.get(id);
		return video ? Response.json(video) : Response.json({ message: "no such video" }, { status: 404 });
	}
	const status = url.searchParams.get("status");
	if (status) return Response.json(prepareStage(status) ?? { stage: videoStore.get(status) ? "done" : "captions" });
	return Response.json(watchState(tzOf(url.searchParams.get("tz"))));
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; url?: unknown; transcribe?: unknown; videoId?: unknown; mode?: unknown; stats?: unknown; answers?: unknown; tapped?: unknown; ms?: unknown; activeMs?: unknown; tz?: unknown } | null;
	if (!body) return Response.json({ message: "a JSON body is required" }, { status: 400 });
	if (body.action === "add") {
		if (typeof body.url !== "string" || !body.url.trim()) return Response.json({ message: "url is required" }, { status: 400 });
		try {
			return Response.json(await prepareVideo(body.url, { transcribe: body.transcribe === true }));
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (err instanceof NoCaptionsError) return Response.json({ message, noCaptions: true, canTranscribe: err.canTranscribe, meta: err.meta }, { status: 422 });
			return Response.json({ message }, { status: /No model is configured/.test(message) ? 503 : /not a YouTube link|minutes long/.test(message) ? 400 : 502 });
		}
	}
	if (body.action === "finish") {
		if (typeof body.videoId !== "string") return Response.json({ message: "videoId is required" }, { status: 400 });
		const answers = Array.isArray(body.answers) ? body.answers.map((a) => (typeof a === "number" ? a : -1)).slice(0, 8) : [];
		const tapped = Array.isArray(body.tapped) ? body.tapped.filter((t): t is string => typeof t === "string").slice(0, 400) : [];
		const mode: WatchMode = body.mode === "flow" ? "flow" : "step";
		const stats: SegmentStat[] = Array.isArray(body.stats)
			? body.stats
					.slice(0, 1000)
					.map((s: Record<string, unknown>): SegmentStat => ({
						i: Number(s.i),
						words: Math.max(0, Number(s.words) || 0),
						sec: Math.max(0, Number(s.sec) || 0),
						replays: Math.max(0, Math.floor(Number(s.replays) || 0)),
						slow: s.slow === true,
						revealed: s.revealed === true,
						got: s.got === "first" ? "first" : s.got === "after" ? "after" : "no",
					}))
					.filter((s: SegmentStat) => Number.isInteger(s.i))
			: [];
		try {
			return Response.json(recordWatch({ videoId: body.videoId, mode, stats, answers, tapped, ms: typeof body.ms === "number" ? body.ms : undefined, activeMs: typeof body.activeMs === "number" ? body.activeMs : undefined, tz: tzOf(body.tz) }));
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 404 });
		}
	}
	return Response.json({ message: "action must be add or finish" }, { status: 400 });
}
