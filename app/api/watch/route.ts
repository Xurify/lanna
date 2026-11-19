import { dayKey, isVideoId, type SegmentStat, type WatchMode } from "@/src/core";
import {
	BODY_LIMITS,
	bodyTooLarge,
	briefError,
	checkSentence,
	currentVideo,
	importVideoToRead,
	NoCaptionsError,
	prepareStage,
	prepareVideo,
	prepareVideoInBackground,
	recordOnce,
	recordWatch,
	sessionClientId,
	videoStore,
	watchState,
} from "@/src/server";

export const dynamic = "force-dynamic";

function tzOf(v: unknown): number | undefined {
	const tz = Number(v);
	return Number.isFinite(tz) && Math.abs(tz) <= 840 ? tz : undefined;
}

export async function GET(req: Request) {
	const url = new URL(req.url);
	const id = url.searchParams.get("id");
	if (id) {
		const video = currentVideo(id);
		return video ? Response.json(video) : Response.json({ message: "no such video" }, { status: 404 });
	}
	const status = url.searchParams.get("status");
	if (status) return Response.json(prepareStage(status) ?? { stage: videoStore.get(status) ? "done" : "captions" });
	return Response.json(watchState(tzOf(url.searchParams.get("tz"))));
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const body = (await req.json().catch(() => null)) as {
		action?: unknown;
		url?: unknown;
		transcribe?: unknown;
		force?: unknown;
		range?: unknown;
		background?: unknown;
		videoId?: unknown;
		mode?: unknown;
		stats?: unknown;
		answers?: unknown;
		tapped?: unknown;
		ms?: unknown;
		activeMs?: unknown;
		tz?: unknown;
		lemma?: unknown;
		sentence?: unknown;
		clientId?: unknown;
	} | null;
	if (!body) return Response.json({ message: "a JSON body is required" }, { status: 400 });
	if (body.action === "add") {
		if (typeof body.url !== "string" || !body.url.trim())
			return Response.json({ message: "url is required" }, { status: 400 });
		try {
			const r = body.range as { startSec?: unknown; endSec?: unknown } | undefined;
			const range =
				r && typeof r.startSec === "number" && typeof r.endSec === "number"
					? { startSec: r.startSec, endSec: r.endSec }
					: undefined;
			if (body.range !== undefined && !range)
				return Response.json({ message: "range needs startSec and endSec in seconds" }, { status: 400 });
			const opts = { transcribe: body.transcribe === true, force: body.force === true, ...(range ? { range } : {}) };
			if (body.background === true) {
				const out = await prepareVideoInBackground(body.url, opts);
				return "background" in out ? Response.json(out, { status: 202 }) : Response.json(out);
			}
			return Response.json(await prepareVideo(body.url, opts));
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			if (err instanceof NoCaptionsError)
				return Response.json(
					{
						message: briefError(message),
						noCaptions: true,
						canTranscribe: err.canTranscribe,
						meta: err.meta,
						elsewhere: err.elsewhere,
					},
					{ status: 422 },
				);
			return Response.json(
				{ message: briefError(message) },
				{
					status: /No model is configured/.test(message)
						? 503
						: /not a YouTube|minutes long|A fragment is between|no speech in that stretch/.test(message)
							? 400
							: 502,
				},
			);
		}
	}
	if (body.action === "delete") {
		if (typeof body.videoId !== "string" || !isVideoId(body.videoId))
			return Response.json({ message: "videoId is required" }, { status: 400 });
		return videoStore.remove(body.videoId)
			? Response.json({ ok: true })
			: Response.json({ message: "no such video" }, { status: 404 });
	}
	if (body.action === "choose") {
		if (typeof body.videoId !== "string" || !isVideoId(body.videoId))
			return Response.json({ message: "videoId is required" }, { status: 400 });
		if (!videoStore.get(body.videoId)) return Response.json({ message: "no such video" }, { status: 404 });
		videoStore.choose(dayKey(new Date(), tzOf(body.tz)), body.videoId);
		return Response.json({ ok: true });
	}
	if (body.action === "import-read") {
		if (typeof body.videoId !== "string" || !isVideoId(body.videoId))
			return Response.json({ message: "videoId is required" }, { status: 400 });
		try {
			const story = importVideoToRead(body.videoId);
			return Response.json({ storyId: story.id, story });
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 404 });
		}
	}
	if (body.action === "finish") {
		if (typeof body.videoId !== "string") return Response.json({ message: "videoId is required" }, { status: 400 });
		const answers = Array.isArray(body.answers)
			? body.answers.map((a) => (typeof a === "number" ? a : -1)).slice(0, 8)
			: [];
		const tapped = Array.isArray(body.tapped)
			? body.tapped.filter((t): t is string => typeof t === "string").slice(0, 400)
			: [];
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
			const videoId = body.videoId;
			return Response.json(
				recordOnce("watch", sessionClientId(body.clientId), () =>
					recordWatch({
						videoId,
						mode,
						stats,
						answers,
						tapped,
						ms: typeof body.ms === "number" ? body.ms : undefined,
						activeMs: typeof body.activeMs === "number" ? body.activeMs : undefined,
						tz: tzOf(body.tz),
					}),
				),
			);
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 404 });
		}
	}
	if (body.action === "sentence") {
		if (typeof body.videoId !== "string" || typeof body.lemma !== "string" || typeof body.sentence !== "string")
			return Response.json({ message: "videoId, lemma and sentence are required" }, { status: 400 });
		try {
			return Response.json(
				await checkSentence({ videoId: body.videoId, lemma: body.lemma, sentence: body.sentence, tz: tzOf(body.tz) }),
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return Response.json(
				{ message: briefError(message) },
				{
					status: /No model is configured/.test(message)
						? 503
						: /is not a word|Write one sentence|not in the language|unknown video/.test(message)
							? 400
							: 502,
				},
			);
		}
	}
	return Response.json({ message: "action must be add, finish, import-read or sentence" }, { status: 400 });
}
