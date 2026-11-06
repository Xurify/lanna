/**
 * GET /api/watch/discover — the picks for Watch (src/server/discover.ts):
 * the saved creators, the videos offered (best first), channels worth
 * saving, what was read from YouTube, and the refresh's progress. A visit
 * starts a refresh in the background when the picks are over six hours old.
 * POST {action: "add-creator", input} — save a channel (link, @handle or
 *   one of its videos), then refresh.
 * POST {action: "remove-creator", id}
 * POST {action: "refresh"} — read the feeds and lists again now.
 * POST {action: "import", list: "history" | "recommended" | "subscriptions",
 *   via: "account" | "takeout", html? | videos? | channels?} — keep a list
 *   read from YouTube (a signed-in page from the desktop app, or the items
 *   of a Takeout file parsed in the browser). The page refreshes after the last list.
 * POST {action: "forget-youtube"} — drop every list read from YouTube.
 * POST {action: "dismiss", videoId} — never offer this video again.
 * POST {action: "keep-ready", on} — prepare the best pick when no video waits.
 */

import { isChannelId } from "@/src/core";
import { addCreator, discoverState, dismissPick, fillAvatars, forgetYouTube, importYouTube, refreshDiscover, refreshIfStale, removeCreator, setKeepReady } from "@/src/server";

export const dynamic = "force-dynamic";

const LISTS = new Set(["history", "recommended", "subscriptions"]);

export async function GET() {
	refreshIfStale();
	await fillAvatars(AbortSignal.timeout(4000)).catch(() => {});
	return Response.json(discoverState());
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; input?: unknown; id?: unknown; list?: unknown; via?: unknown; html?: unknown; videos?: unknown; channels?: unknown; videoId?: unknown; on?: unknown } | null;
	if (!body) return Response.json({ message: "a JSON body is required" }, { status: 400 });
	if (body.action === "add-creator") {
		if (typeof body.input !== "string" || !body.input.trim()) return Response.json({ message: "input is required" }, { status: 400 });
		try {
			const creator = await addCreator(body.input);
			void refreshDiscover();
			return Response.json({ creator, state: discoverState() });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return Response.json({ message }, { status: /not a YouTube channel|has no channel/.test(message) ? 400 : 502 });
		}
	}
	if (body.action === "remove-creator") {
		if (typeof body.id !== "string" || !isChannelId(body.id)) return Response.json({ message: "id is required" }, { status: 400 });
		removeCreator(body.id);
		return Response.json(discoverState());
	}
	if (body.action === "refresh") {
		void refreshDiscover();
		return Response.json(discoverState());
	}
	if (body.action === "import") {
		if (typeof body.list !== "string" || !LISTS.has(body.list)) return Response.json({ message: "list must be history, recommended or subscriptions" }, { status: 400 });
		const list = body.list as "history" | "recommended" | "subscriptions";
		try {
			const count = importYouTube(
				list,
				{
					...(typeof body.html === "string" ? { html: body.html.slice(0, 12_000_000) } : {}),
					...(Array.isArray(body.videos) ? { videos: body.videos } : {}),
					...(Array.isArray(body.channels) ? { channels: body.channels } : {}),
				},
				body.via === "takeout" ? "takeout" : "account",
			);
			return Response.json({ count, state: discoverState() });
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 422 });
		}
	}
	if (body.action === "forget-youtube") {
		forgetYouTube();
		return Response.json(discoverState());
	}
	if (body.action === "dismiss") {
		if (typeof body.videoId !== "string") return Response.json({ message: "videoId is required" }, { status: 400 });
		dismissPick(body.videoId);
		return Response.json(discoverState());
	}
	if (body.action === "keep-ready") {
		setKeepReady(body.on === true);
		return Response.json(discoverState());
	}
	return Response.json({ message: "unknown action" }, { status: 400 });
}
