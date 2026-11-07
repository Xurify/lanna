/**
 * GET /api/watch/discover — the picks for Watch (src/server/discover.ts):
 * the saved creators, the videos offered (best first), channels worth
 * saving, what was read from YouTube, and the refresh's progress. A visit
 * starts a refresh in the background when the picks are over six hours old.
 * POST {action: "add-creator", input} — save a channel (link, @handle or
 *   one of its videos), then refresh.
 * POST {action: "add-creators", input} — save every channel in pasted text
 *   (links, @handles, videos; apart by spaces, commas or lines); the answer
 *   names the ones that failed.
 * POST {action: "save-suggestions", ids?} — save the channels suggested (all, or the ones named).
 * POST {action: "dismiss-channel", id} — stop suggesting a channel.
 * POST {action: "remove-creator", id}
 * POST {action: "refresh"} — read the feeds and lists again now.
 * POST {action: "import", list: "history" | "recommended" | "subscriptions",
 *   via: "account" | "takeout", html? | videos? | channels?} — keep a list
 *   read from YouTube (a signed-in page from the desktop app, or the items
 *   of a Takeout file parsed in the browser). The page refreshes after the last list.
 * POST {action: "forget-youtube"} — drop every list read from YouTube.
 * POST {action: "account", text} — who the desktop app's YouTube session is
 * signed in as, from the account switcher's answer: name, handle, picture.
 * POST {action: "forget-account"} — signed out: drop who it was.
 * POST {action: "dismiss", videoId} — never offer this video again.
 * POST {action: "keep-ready", on} — prepare the best pick when no video waits.
 * POST {action: "creator-videos", id, query?} — a saved creator's newest
 *   uploads, or what a search of the channel finds, each checked for free.
 *   Answers {videos} (CreatorVideo[]), in the channel's own order.
 */

import { isChannelId, splitChannelInputs } from "@/src/core";
import { addCreator, addCreators, creatorVideos, discoverState, dismissSuggestion, saveSuggestions, dismissPick, fillAvatars, forgetYouTube, forgetYouTubeAccount, importYouTube, importYouTubeAccount, refreshDiscover, refreshIfStale, removeCreator, setKeepReady } from "@/src/server";

export const dynamic = "force-dynamic";

const LISTS = new Set(["history", "recommended", "subscriptions"]);

export async function GET() {
	refreshIfStale();
	void fillAvatars(AbortSignal.timeout(8000)).catch(() => {});
	return Response.json(discoverState());
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => null)) as { action?: unknown; input?: unknown; id?: unknown; list?: unknown; via?: unknown; html?: unknown; videos?: unknown; channels?: unknown; videoId?: unknown; on?: unknown; ids?: unknown; query?: unknown; text?: unknown } | null;
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
	if (body.action === "add-creators") {
		if (typeof body.input !== "string") return Response.json({ message: "input is required" }, { status: 400 });
		const inputs = splitChannelInputs(body.input).slice(0, 40);
		if (!inputs.length) return Response.json({ message: "input is required" }, { status: 400 });
		const { saved, failed } = await addCreators(inputs);
		if (saved.length) void refreshDiscover();
		return Response.json({ saved: saved.length, failed, state: discoverState() });
	}
	if (body.action === "save-suggestions") {
		const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string" && isChannelId(x)) : undefined;
		const saved = saveSuggestions(ids);
		if (saved.length) void refreshDiscover();
		return Response.json({ saved: saved.length, state: discoverState() });
	}
	if (body.action === "dismiss-channel") {
		if (typeof body.id !== "string" || !isChannelId(body.id)) return Response.json({ message: "id is required" }, { status: 400 });
		dismissSuggestion(body.id);
		return Response.json(discoverState());
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
	if (body.action === "account") {
		if (typeof body.text !== "string") return Response.json({ message: "text is required" }, { status: 400 });
		try {
			importYouTubeAccount(body.text.slice(0, 2_000_000));
			return Response.json(discoverState());
		} catch (err) {
			return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 422 });
		}
	}
	if (body.action === "forget-account") {
		forgetYouTubeAccount();
		return Response.json(discoverState());
	}
	if (body.action === "dismiss") {
		if (typeof body.videoId !== "string") return Response.json({ message: "videoId is required" }, { status: 400 });
		dismissPick(body.videoId);
		return Response.json(discoverState());
	}
	if (body.action === "creator-videos") {
		if (typeof body.id !== "string" || !isChannelId(body.id)) return Response.json({ message: "id is required" }, { status: 400 });
		try {
			const videos = await creatorVideos(body.id, { query: typeof body.query === "string" ? body.query : undefined, signal: AbortSignal.timeout(60_000) });
			return Response.json({ videos });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return Response.json({ message }, { status: /not saved/.test(message) ? 404 : 502 });
		}
	}
	if (body.action === "keep-ready") {
		setKeepReady(body.on === true);
		return Response.json(discoverState());
	}
	return Response.json({ message: "unknown action" }, { status: 400 });
}
