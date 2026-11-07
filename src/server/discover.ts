/**
 * Picks for Watch (LangHarness, 2026-11-05) — behind /api/watch/discover.
 * The learner saves creators (a channel link, an @handle or one of their
 * videos); the app reads their newest uploads from the channel's feed,
 * and the videos from the learner's YouTube history, recommendations and
 * subscriptions when those were read (the desktop app's signed-in window,
 * electron/youtube.cjs, or a Google Takeout export). With a model set, the
 * cheap slot writes a handful of searches in the language from those
 * interests, once, and YouTube's search finds videos with subtitles.
 *
 * Every candidate is checked for free: YouTube's player data says which
 * caption tracks it has; `judgeSpoken` decides from the automatic track and
 * the original title whether it is spoken in the language; the track is
 * fetched and glossed locally for the known-word share. No model reads a
 * transcript here: a video is translated only when the learner picks it
 * (src/server/watch.ts prepareVideo), or when "keep one ready" prepares the
 * best pick because no video is waiting.
 *
 * Nothing about the account is kept but the lists themselves: the cookies
 * stay in the desktop app's own browser session.
 */

import { createHash } from "node:crypto";
import { activeProfile } from "../../config.ts";
import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import type { Usage } from "@earendil-works/pi-ai";
import {
	agoToIso,
	channelImage,
	awaitingCaptions,
	creatorVideoRows,
	publishedTimes,
	type CreatorVideo,
	extractChannels,
	extractVideos,
	judgeSpoken,
	MIN_PICK_SEC,
	parseChannelFeed,
	parseChannelInput,
	rankPicks,
	suggestCreators,
	trackTags,
	type Creator,
	type CreatorSuggestion,
	type DiscoverStateView,
	type YouTubeListName,
	type CreatorFrom,
	type FoundChannel,
	type FoundVideo,
	type PickedVideo,
	type PickSource,
	type ScannedVideo,
	accountFromPage,
	accountFromSwitcher,
	type YouTubeAccount,
} from "../core/discover.ts";
import { tokenize, type StoryUsage } from "../core/reading.ts";
import { TtlMemo } from "../core/ttl-memo.ts";
import { MAX_SEGMENTS, MAX_VIDEO_SEC, segmentCues, videoCoverage, videoExpected, videoUrl } from "../core/watch.ts";
import { discoverStore, type YouTubeSignals } from "../store/discover.ts";
import { knownWordStore } from "../store/known-words.ts";
import { videoStore } from "../store/videos.ts";
import { activeLanguage } from "./active-language.ts";
import { knownWords, storyEngine, type KnownWords } from "./reading.ts";
import { extractJsonAfter, fetchTrack, fetchVideoMeta, glossSegments, pickTrack, prepareStage, prepareVideo, watchState } from "./watch.ts";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const WEB_VERSION = "2.20251101.00.00";
/** YouTube's search filter for videos with subtitles or CC. */
const SUBTITLES_FILTER = "EgIoAQ==";
/** A channel's videos tab, for the browse fallback when the feed fails. */
const VIDEOS_TAB = "EgZ2aWRlb3PyBgQKAjoA";
/** A channel's search tab: browse with this and a `query`. */
const CHANNEL_SEARCH = "EgZzZWFyY2jyBgQKAloA";

/** How long the picks stay fresh before a visit reads the feeds again. */
export const REFRESH_AFTER_MS = 6 * 3_600_000;
/** Newest uploads read per creator, and per subscribed channel not saved. */
const PER_CREATOR = 12;
const PER_SUBSCRIPTION = 2;
const MAX_SUBSCRIPTIONS = 120;
/** History and recommendations checked per refresh, newest first. */
const MAX_HISTORY = 60;
const MAX_RECOMMENDED = 60;
/** Videos checked per refresh at most; the rest wait for the next one. */
const MAX_SCANS = 250;
const SEARCH_COUNT = 6;
const PER_SEARCH = 8;
/** Searches are written again after this long, or when the interests change. */
const SEARCHES_AFTER_MS = 14 * 86_400_000;
/** A measured share older than this is measured again (the learner learns). */
const REMEASURE_AFTER_MS = 7 * 86_400_000;
/** Below this the best pick is not prepared on its own: it would cost a model call for a video that is too hard. */
const KEEP_READY_FLOOR = 0.88;
/** Channels suggested on the Watch page. */
const SUGGESTIONS_SHOWN = 12;
/** Videos listed under a creator on the Watch page. */
const CREATOR_VIDEOS = 4;
/** Videos checked when the learner lists a creator's newest or searches the channel. */
const CREATOR_LIST = 20;

const captionLangs = (): string[] => [activeLanguage().code, ...(activeLanguage().captionFallbacks ?? []).map((f) => f.code)];
const region = (): string | undefined => activeLanguage().tag.split("-")[1]?.toUpperCase();

type Json = Record<string, unknown>;

async function innertube(endpoint: string, body: Json, signal?: AbortSignal, hl: string = activeLanguage().code): Promise<Json | null> {
	const gl = region();
	const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
		method: "POST",
		headers: { "content-type": "application/json", "user-agent": UA },
		body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: WEB_VERSION, hl, ...(gl ? { gl } : {}) } }, ...body }),
		signal,
	});
	if (!res.ok) return null;
	return (await res.json()) as Json;
}

/** Up to `n` jobs at a time. */
async function pool<T>(items: readonly T[], n: number, job: (item: T) => Promise<void>, signal?: AbortSignal): Promise<void> {
	let at = 0;
	const worker = async () => {
		while (at < items.length) {
			signal?.throwIfAborted();
			const item = items[at++]!;
			try {
				await job(item);
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") throw err;
			}
		}
	};
	await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

// ─── Channels ───────────────────────────────────────────────────────────────

/** A channel's newest uploads: its feed, or its videos tab when the feed fails. */
export async function channelVideos(channelId: string, signal?: AbortSignal): Promise<{ channel: FoundChannel | null; videos: FoundVideo[] }> {
	try {
		const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, { headers: { "user-agent": UA }, signal });
		if (res.ok) {
			const feed = parseChannelFeed(await res.text());
			if (feed.channel || feed.videos.length) return feed;
		}
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") throw err;
	}
	const data = await innertube("browse", { browseId: channelId, params: VIDEOS_TAB }, signal);
	if (!data) return { channel: null, videos: [] };
	const meta = (data.metadata as Json | undefined)?.channelMetadataRenderer as Json | undefined;
	const name = typeof meta?.title === "string" ? meta.title : undefined;
	const vanity = typeof meta?.vanityChannelUrl === "string" ? /\/(@[^/?#]+)/.exec(meta.vanityChannelUrl)?.[1] : undefined;
	const avatar = channelImage(meta?.avatar);
	return {
		channel: name ? { id: channelId, name, ...(vanity ? { handle: decodeURIComponent(vanity) } : {}), ...(avatar ? { avatar } : {}) } : null,
		videos: extractVideos(data).map((v) => ({ ...v, channelId, ...(name && !v.channel ? { channel: name } : {}) })),
	};
}

/** Videos in one channel that match `query`, as YouTube's channel search
 *  ranks them. The page is read twice: in the language for the titles as
 *  written (an English page translates them), and in English for the
 *  relative dates, which only English can be read in. */
export async function channelSearch(channelId: string, query: string, opts: { signal?: AbortSignal; now?: Date } = {}): Promise<FoundVideo[]> {
	return withDates(channelId, { browseId: channelId, params: CHANNEL_SEARCH, query }, opts);
}

/** A browse page's videos with titles from the page in the language and dates from the page in English. */
async function withDates(channelId: string, body: Json, opts: { signal?: AbortSignal; now?: Date }, exact: ReadonlyMap<string, string> = new Map()): Promise<FoundVideo[]> {
	const now = opts.now ?? new Date();
	const [page, english] = await Promise.all([innertube("browse", body, opts.signal).catch(() => null), innertube("browse", body, opts.signal, "en").catch(() => null)]);
	const when = english ? publishedTimes(english) : new Map<string, string>();
	return extractVideos(page ?? english ?? {}).map((v) => {
		const at = exact.get(v.id) ?? (when.has(v.id) ? agoToIso(when.get(v.id)!, now) : undefined);
		return { ...v, channelId: v.channelId ?? channelId, ...(at ? { at } : {}) };
	});
}

/** A channel's uploads, newest first, from its videos tab (withDates), with
 *  the feed's exact dates where the feed has the video. The feed alone lists
 *  only a few, and no older ones. */
export async function channelUploads(channelId: string, opts: { signal?: AbortSignal; now?: Date } = {}): Promise<FoundVideo[]> {
	const feed = await channelVideos(channelId, opts.signal).catch(() => ({ channel: null, videos: [] as FoundVideo[] }));
	const exact = new Map(feed.videos.filter((v) => v.at).map((v) => [v.id, v.at!]));
	const listed = await withDates(channelId, { browseId: channelId, params: VIDEOS_TAB }, opts, exact);
	return listed.length ? listed : feed.videos;
}

/** A saved creator's newest uploads (channelUploads), or the videos a search of
 *  the channel finds, each checked as for a pick (free: player data and
 *  captions, glossed locally; no model). A video checked before is not
 *  fetched again. The checks are kept, so they feed the picks as well. */
/** What YouTube listed for a channel, kept so opening a creator again, or
 *  switching Best and Newest, is not three more requests to YouTube. The
 *  list is what is kept; whether each video is in the library, dismissed or
 *  checked is read fresh each time. "Check again" clears it. */
const CREATOR_LIST_TTL_MS = 10 * 60_000;
const listings = (): TtlMemo<FoundVideo[]> => ((globalThis as { __lhListings?: TtlMemo<FoundVideo[]> }).__lhListings ??= new TtlMemo({ ttlMs: CREATOR_LIST_TTL_MS, max: 60 }));
/** A shared load is not the caller's to cancel: it finishes and is kept, so a click that was left is not wasted. */
const LISTING_TIMEOUT_MS = 45_000;

export async function creatorVideos(id: string, opts: { query?: string; signal?: AbortSignal; now?: Date } = {}): Promise<CreatorVideo[]> {
	const creator = discoverStore.creators().creators.find((c) => c.id === id);
	if (!creator) throw new Error("That creator is not saved.");
	const now = opts.now ?? new Date();
	const query = opts.query?.trim().slice(0, 100);
	const listed = await listings().run(`${activeProfile()}|${id}|${query ?? ""}`, async () => {
		const signal = AbortSignal.timeout(LISTING_TIMEOUT_MS);
		return (query ? await channelSearch(id, query, { signal, now }) : await channelUploads(id, { signal, now })).slice(0, CREATOR_LIST);
	});
	const found = listed.map((v) => ({ ...v, channelId: v.channelId ?? id, channel: v.channel ?? creator.name }));
	const kept = discoverStore.scans();
	const fresh: Record<string, ScannedVideo> = {};
	const lexicon = loadLexicon();
	const k = knownWords(lexicon);
	await pool(found.filter((v) => !kept[v.id] || awaitingCaptions(kept[v.id]!, now)), 4, async (v) => {
		fresh[v.id] = await scanVideo(v, ["creator"], { lexicon, k, now, signal: opts.signal });
	}, opts.signal);
	const scans = { ...discoverStore.scans(), ...fresh };
	for (const v of found) {
		const s = scans[v.id];
		if (!s) continue;
		// A failed check kept the title it was found with, which an English page had translated.
		const title = s.skip === "unavailable" ? v.title : s.title;
		if ((v.at && !s.publishedAt) || title !== s.title) scans[v.id] = { ...s, title, ...(v.at && !s.publishedAt ? { publishedAt: v.at } : {}) };
	}
	discoverStore.putScans(scans);
	const library = new Set(videoStore.list().map((v) => v.id));
	const pics = discoverStore.avatars();
	return creatorVideoRows(found.map((v) => scans[v.id]).filter((v): v is ScannedVideo => !!v), { library, dismissed: discoverStore.dismissed(), now }).map((v) => (pics[id] ? { ...v, avatar: pics[id] } : v));
}

/** The channel a pasted link, @handle or video belongs to. */
export async function resolveChannel(input: string, signal?: AbortSignal): Promise<FoundChannel> {
	const parsed = parseChannelInput(input);
	if (!parsed) throw new Error("That is not a YouTube channel. Paste a channel link, an @handle or one of their videos.");
	let id: string | undefined;
	let name: string | undefined;
	let handle: string | undefined;
	if (parsed.kind === "channel") id = parsed.id;
	else if (parsed.kind === "video") {
		const meta = await fetchVideoMeta(parsed.id, signal);
		if (!meta?.channelId) throw new Error("YouTube did not say whose video that is. Paste the channel's link instead.");
		id = meta.channelId;
		name = meta.channel;
	} else {
		handle = parsed.handle;
		const resolved = await innertube("navigation/resolve_url", { url: parsed.url }, signal).catch(() => null);
		const browseId = ((resolved?.endpoint as Json | undefined)?.browseEndpoint as Json | undefined)?.browseId;
		if (typeof browseId === "string" && browseId.startsWith("UC")) id = browseId;
		else {
			const res = await fetch(parsed.url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9", cookie: "CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg" }, signal });
			if (res.ok) {
				const html = await res.text();
				id = /"externalId":"(UC[A-Za-z0-9_-]{22})"/.exec(html)?.[1] ?? /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/.exec(html)?.[1];
			}
		}
		if (!id) throw new Error(`YouTube has no channel at ${parsed.handle ?? parsed.url}.`);
	}
	const feed = await channelVideos(id, signal);
	name = feed.channel?.name ?? name;
	if (!name) throw new Error("YouTube did not answer for that channel. Try again in a minute.");
	// The feed has no picture; the channel page does.
	const avatar = feed.channel?.avatar ?? (await channelAvatar(id, signal));
	return { id, name, ...((handle ?? feed.channel?.handle) ? { handle: handle ?? feed.channel?.handle } : {}), ...(avatar ? { avatar } : {}) };
}

/** A channel's picture, from its page; undefined when YouTube gives none. */
async function channelAvatar(channelId: string, signal?: AbortSignal): Promise<string | undefined> {
	try {
		const data = await innertube("browse", { browseId: channelId, params: VIDEOS_TAB }, signal);
		return channelImage(((data?.metadata as Json | undefined)?.channelMetadataRenderer as Json | undefined)?.avatar);
	} catch (err) {
		if (err instanceof Error && err.name === "AbortError") throw err;
		return undefined;
	}
}

/** Channels worth saving: not saved, not turned down. */
function suggestions(): CreatorSuggestion[] {
	const skip = new Set([...discoverStore.creators().creators.map((c) => c.id), ...discoverStore.dismissedChannels()]);
	return suggestCreators(Object.values(discoverStore.scans()), skip, discoverStore.youtube().subscriptions?.channels).slice(0, SUGGESTIONS_SHOWN);
}

function rememberAvatars(found: Record<string, string>): void {
	discoverStore.putAvatars({ ...discoverStore.avatars(), ...found });
}

// A channel YouTube gave no picture for is asked again on the next server run, not on every visit.
const noAvatar = (): Set<string> => ((globalThis as { __lhNoAvatar?: Set<string> }).__lhNoAvatar ??= new Set());

/** Fetch the picture of every saved creator and suggested channel that has
 *  none yet: creators saved before pictures were kept, and channels read
 *  from the account's history. */
export function fillAvatars(signal?: AbortSignal): Promise<void> {
	const g = globalThis as { __lhFillAvatars?: Promise<void> };
	// One fill at a time: a page and the poll that follows it share the same requests.
	return (g.__lhFillAvatars ??= fillAvatarsNow(signal).finally(() => {
		g.__lhFillAvatars = undefined;
	}));
}

async function fillAvatarsNow(signal?: AbortSignal): Promise<void> {
	const missed = noAvatar();
	const have = discoverStore.avatars();
	const saved = discoverStore.creators().creators;
	const suggested = suggestions();
	const todo = [...saved.map((c) => c.id), ...suggested.map((c) => c.id)].filter((id, i, all) => !have[id] && !missed.has(id) && all.indexOf(id) === i);
	if (!todo.length) return;
	const found: Record<string, string> = {};
	await pool(todo, 4, async (id) => {
		const avatar = await channelAvatar(id, signal);
		if (avatar) found[id] = avatar;
		else missed.add(id);
	}, signal);
	if (Object.keys(found).length) rememberAvatars(found);
}

export function listCreators(): Creator[] {
	return discoverStore.creators().creators;
}

/** Save a creator; a creator already saved is returned as it is. */
export async function addCreator(input: string, from: CreatorFrom = "link", opts: { now?: Date; signal?: AbortSignal; known?: FoundChannel } = {}): Promise<Creator> {
	const found = opts.known ?? (await resolveChannel(input, opts.signal));
	const f = discoverStore.creators();
	const kept = f.creators.find((c) => c.id === found.id);
	if (kept) return kept;
	const creator: Creator = { id: found.id, name: found.name, ...(found.handle ? { handle: found.handle } : {}), addedAt: (opts.now ?? new Date()).toISOString(), from };
	discoverStore.putCreators({ ...f, creators: [...f.creators, creator] });
	if (found.avatar) rememberAvatars({ [found.id]: found.avatar });
	return creator;
}

/** Save several channels from pasted text; the ones that fail are named. */
export async function addCreators(inputs: readonly string[], opts: { signal?: AbortSignal } = {}): Promise<{ saved: Creator[]; failed: Array<{ input: string; message: string }> }> {
	const saved: Creator[] = [];
	const failed: Array<{ input: string; message: string }> = [];
	await pool(
		inputs,
		3,
		async (input) => {
			try {
				saved.push(await addCreator(input, "link", opts));
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") throw err;
				failed.push({ input, message: err instanceof Error ? err.message : String(err) });
			}
		},
		opts.signal,
	);
	return { saved, failed };
}

/** Save the suggested channels (all, or the ones named) as the page shows them: no request to YouTube is needed. */
export function saveSuggestions(ids?: readonly string[]): Creator[] {
	const want = ids ? new Set(ids) : null;
	const out: Creator[] = [];
	for (const s of suggestions()) {
		if (want && !want.has(s.id)) continue;
		const f = discoverStore.creators();
		if (f.creators.some((c) => c.id === s.id)) continue;
		const creator: Creator = { id: s.id, name: s.name, ...(s.handle ? { handle: s.handle } : {}), addedAt: new Date().toISOString(), from: s.from.find((x): x is Exclude<PickSource, "creator"> => x !== "creator") ?? "history" };
		discoverStore.putCreators({ ...f, creators: [...f.creators, creator] });
		if (s.avatar) rememberAvatars({ [s.id]: s.avatar });
		out.push(creator);
	}
	return out;
}

export function dismissSuggestion(id: string): void {
	discoverStore.dismissChannel(id);
}

export function removeCreator(id: string): boolean {
	const f = discoverStore.creators();
	const creators = f.creators.filter((c) => c.id !== id);
	if (creators.length === f.creators.length) return false;
	discoverStore.putCreators({ ...f, creators });
	return true;
}

export function setKeepReady(on: boolean): void {
	discoverStore.putCreators({ ...discoverStore.creators(), keepReady: on });
}

// ─── Checking a video ───────────────────────────────────────────────────────

/** Share of a text's words that are words of the language (the lexicon's
 *  forms), lowercased so a title in capitals counts. */
export function languageShare(text: string, lexicon: Lexicon | null): { share: number; words: number } {
	if (!lexicon) return { share: 0, words: 0 };
	const tag = activeLanguage().tag;
	const words = tokenize(text)
		.filter((t) => t.word && !/^\p{N}+$/u.test(t.text))
		.map((t) => t.text.toLocaleLowerCase(tag));
	if (!words.length) return { share: 0, words: 0 };
	const hits = words.filter((w) => lexicon.byForm.has(w)).length;
	return { share: Math.round((hits / words.length) * 100) / 100, words: words.length };
}

/** The known-word share of a video's caption lines, measured locally. */
export function measureLines(lines: readonly string[], lexicon: Lexicon | null, k: KnownWords): { coverage: number; expected: number; wordCount: number; unknownCount: number } {
	const segments = glossSegments(
		lines.map((sk, i) => ({ start: i, end: i + 1, sk })),
		[],
		lexicon,
		k,
	);
	const words = segments.flatMap((s) => s.tokens.filter((t) => t.word));
	const tag = activeLanguage().tag;
	return {
		coverage: Math.round(videoCoverage(segments) * 1000) / 1000,
		expected: Math.round(videoExpected(segments) * 1000) / 1000,
		wordCount: words.length,
		unknownCount: new Set(words.filter((t) => t.fresh || t.assumed).map((t) => t.slug ?? t.text.toLocaleLowerCase(tag))).size,
	};
}

/** Check one video for the offer: its tracks, whether it is spoken in the
 *  language, and the known-word share of its captions. No model call. */
export async function scanVideo(found: FoundVideo, sources: readonly PickSource[], ctx: { lexicon: Lexicon | null; k: KnownWords; now?: Date; query?: string; signal?: AbortSignal }): Promise<ScannedVideo> {
	const now = (ctx.now ?? new Date()).toISOString();
	const base = { id: found.id, title: found.title, ...(found.channel ? { channel: found.channel } : {}), ...(found.channelId ? { channelId: found.channelId } : {}), scannedAt: now, sources: [...sources], ...(ctx.query ? { query: ctx.query } : {}) };
	const meta = await fetchVideoMeta(found.id, ctx.signal);
	if (!meta) return { ...base, durationSec: found.durationSec ?? 0, tracks: [], spoken: "unsure", skip: "unavailable" };
	const langs = captionLangs();
	const tracks = trackTags(meta.tracks);
	const title = meta.title || found.title;
	const share = languageShare(`${title} ${meta.description ?? ""}`, ctx.lexicon);
	const spoken = judgeSpoken({ tracks, lang: langs[0]!, fallbacks: langs.slice(1), titleShare: share.share, titleWords: share.words });
	const v: ScannedVideo = {
		...base,
		title,
		...(meta.channel ? { channel: meta.channel } : {}),
		...(meta.channelId ? { channelId: meta.channelId } : {}),
		durationSec: meta.durationSec,
		...(found.at && sources.includes("creator") ? { publishedAt: found.at } : {}),
		tracks,
		spoken,
		titleShare: share.share,
	};
	if (meta.live) return { ...v, skip: "live" };
	if (meta.durationSec > MAX_VIDEO_SEC) return { ...v, skip: "too-long" };
	if (meta.durationSec && meta.durationSec < MIN_PICK_SEC) return { ...v, skip: "too-short" };
	const track = pickTrack(meta.tracks, langs);
	if (!track) return { ...v, skip: "no-captions" };
	if (spoken === "no") return { ...v, skip: "other-language" };
	const trackLang = track.languageCode.toLowerCase().split("-")[0]!;
	const scanned: ScannedVideo = { ...v, trackLang, captionKind: track.kind === "asr" ? "auto-captions" : "captions" };
	const got = await fetchTrack(track, ctx.signal);
	if (!got) return { ...scanned, skip: "no-captions" };
	const lines = segmentCues(got.cues).slice(0, MAX_SEGMENTS).map((l) => l.sk);
	if (!lines.length) return { ...scanned, skip: "no-captions" };
	discoverStore.putText(found.id, trackLang, lines);
	const words = lines.join(" ").split(/\s+/).filter(Boolean).length;
	const wordsPerMin = meta.durationSec ? Math.round(words / (meta.durationSec / 60)) : undefined;
	const withSpeed = { ...scanned, ...(wordsPerMin !== undefined ? { wordsPerMin } : {}) };
	if (trackLang !== langs[0]) return withSpeed;
	return { ...withSpeed, ...measureLines(lines, ctx.lexicon, ctx.k), level: ctx.k.level, measuredAt: now };
}

// ─── Searches from the learner's interests ──────────────────────────────────

export function searchSystem(name: string = activeLanguage().english): string {
	return `You write YouTube searches in ${name} for someone learning ${name}. From the titles of videos they watch (in any language) and the channels they follow, work out what they are interested in, then write searches a ${name} speaker would type to find videos SPOKEN in ${name} on those interests. You answer with ONE JSON object and nothing else: {"queries": ["...", "..."]}.

Rules:
- Each search 1 to 4 words, in ${name}, the way people type into YouTube's search box. No quotes, hashtags or English.
- Topics where people talk: vlogs, explanations, reviews, cooking, travel, interviews, hobbies. Not music, not gaming streams with no speech.
- Cover different interests; never two searches for the same thing.`;
}

function hashOf(parts: readonly string[]): string {
	return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 16);
}

function stepOf(u: Usage): StoryUsage["steps"][number] {
	return { inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, cacheWrite1hTokens: u.cacheWrite1h ?? 0, reasoningTokens: u.reasoning };
}

/** The interests the searches are written from: the history and
 *  recommendations (titles and channels), the subscriptions, the creators. */
function interestLines(yt: YouTubeSignals, creators: readonly Creator[]): string[] {
	const titles = [...(yt.history?.videos ?? []).slice(0, 60), ...(yt.recommended?.videos ?? []).slice(0, 30)].map((v) => `${v.title}${v.channel ? ` — ${v.channel}` : ""}`);
	const channels = [...(yt.subscriptions?.channels ?? []).slice(0, 40).map((c) => c.name), ...creators.map((c) => c.name)];
	return [...titles, ...(channels.length ? [`Channels: ${[...new Set(channels)].join(", ")}`] : [])];
}

/** The searches, written once per set of interests on the cheap slot and
 *  kept; reused for two weeks or until the interests change. */
export async function interestSearches(opts: { engine?: PiEngine; model?: string; now?: Date; force?: boolean } = {}): Promise<string[]> {
	const yt = discoverStore.youtube();
	const lines = interestLines(yt, listCreators());
	if (lines.length < 3) return [];
	const key = hashOf([activeLanguage().code, ...lines]);
	const now = opts.now ?? new Date();
	const kept = discoverStore.searches();
	if (kept && !opts.force && kept.key === key && now.getTime() - Date.parse(kept.at) < SEARCHES_AFTER_MS) return kept.queries;
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "test" } : storyEngine();
	if (!resolved) return kept?.queries ?? [];
	const usage: StoryUsage = { model: resolved.model, steps: [] };
	const prompt = `Write ${SEARCH_COUNT} searches.\n\nWhat they watch and follow:\n${lines.map((l) => `- ${l}`).join("\n")}`;
	const { text } = await runSubagent([], { role: "researcher", engine: resolved.engine, systemPrompt: searchSystem(), prompt, maxTurns: 1, onUsage: (u) => usage.steps.push(stepOf(u)) });
	let queries: string[] = [];
	try {
		const raw = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { queries?: unknown };
		if (Array.isArray(raw.queries)) queries = raw.queries.filter((q): q is string => typeof q === "string").map((q) => q.replace(/["#]/g, "").trim()).filter((q) => q.length >= 2 && q.length <= 60);
	} catch {
		queries = [];
	}
	queries = [...new Set(queries)].slice(0, SEARCH_COUNT);
	if (!queries.length) return kept?.queries ?? [];
	discoverStore.putSearches({ key, at: now.toISOString(), queries, model: resolved.model, usage });
	return queries;
}

/** YouTube's search for videos with subtitles, in the language's region. */
export async function searchVideos(query: string, signal?: AbortSignal): Promise<FoundVideo[]> {
	const data = await innertube("search", { query, params: SUBTITLES_FILTER }, signal);
	return data ? extractVideos(data) : [];
}

// ─── Reading YouTube ────────────────────────────────────────────────────────

export type YouTubeList = YouTubeListName;

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : undefined);

function cleanVideos(list: readonly unknown[]): FoundVideo[] {
	const out: FoundVideo[] = [];
	const seen = new Set<string>();
	for (const raw of list.slice(0, 2000)) {
		const v = raw as Partial<FoundVideo> | null;
		if (!v || typeof v.id !== "string" || !VIDEO_ID.test(v.id) || seen.has(v.id)) continue;
		seen.add(v.id);
		const channel = clip(v.channel, 200);
		const at = clip(v.at, 40);
		out.push({ id: v.id, title: clip(v.title, 300) ?? v.id, ...(channel ? { channel } : {}), ...(typeof v.channelId === "string" && CHANNEL_ID.test(v.channelId) ? { channelId: v.channelId } : {}), ...(typeof v.durationSec === "number" && v.durationSec > 0 ? { durationSec: Math.round(v.durationSec) } : {}), ...(at ? { at } : {}) });
	}
	return out;
}

function cleanChannels(list: readonly unknown[]): FoundChannel[] {
	const out = new Map<string, FoundChannel>();
	for (const raw of list.slice(0, 2000)) {
		const c = raw as Partial<FoundChannel> | null;
		if (!c || typeof c.id !== "string" || !CHANNEL_ID.test(c.id) || typeof c.name !== "string" || out.has(c.id)) continue;
		const handle = clip(c.handle, 100);
		out.set(c.id, { id: c.id, name: c.name.slice(0, 200), ...(handle?.startsWith("@") ? { handle } : {}) });
	}
	return [...out.values()];
}

/** The lists out of a YouTube page the desktop app read while signed in,
 *  and the signed-in account's picture from its top bar when the page has one. */
export function listsFromPage(list: YouTubeList, html: string): { videos: FoundVideo[]; channels: FoundChannel[]; account?: YouTubeAccount } {
	const data = extractJsonAfter(html, /ytInitialData\s*=\s*/) ?? extractJsonAfter(html, /window\["ytInitialData"\]\s*=\s*/);
	if (!data) throw new Error("YouTube sent a page without the list. Sign in again and retry.");
	const context = ((data as Json).responseContext as Json | undefined)?.mainAppWebResponseContext as Json | undefined;
	if (context?.loggedOut === true) throw new Error("YouTube no longer counts this window as signed in. Connect again.");
	const account = accountFromPage(data);
	return { ...(list === "subscriptions" ? { videos: [], channels: extractChannels(data) } : { videos: extractVideos(data), channels: [] }), ...(account ? { account } : {}) };
}

/** Keep what was read from YouTube. Returns how many items the list has. */
export function importYouTube(list: YouTubeList, payload: { html?: string; videos?: unknown[]; channels?: unknown[] }, via: "account" | "takeout", now = new Date()): number {
	const read = payload.html ? listsFromPage(list, payload.html) : { videos: cleanVideos(payload.videos ?? []), channels: cleanChannels(payload.channels ?? []), account: undefined };
	const yt = discoverStore.youtube();
	const at = now.toISOString();
	if (list === "subscriptions") yt.subscriptions = { at, via, channels: read.channels };
	else if (list === "history") yt.history = { at, via, videos: read.videos };
	else yt.recommended = { at, via: "account", videos: read.videos };
	// The page's top bar carries the signed-in picture; the account switcher, read after the lists, adds the name.
	if (read.account?.photo) yt.account = { ...(yt.account ?? {}), at, photo: read.account.photo };
	discoverStore.putYoutube(yt);
	return list === "subscriptions" ? read.channels.length : read.videos.length;
}

/** Keep who the YouTube session is signed in as, from the account switcher's
 *  answer the desktop app read: the name, the @handle and the picture link.
 *  The email in that answer is never kept. */
export function importYouTubeAccount(text: string, now = new Date()): YouTubeAccount & { at: string } {
	const account = accountFromSwitcher(text);
	if (!account) throw new Error("YouTube did not say who is signed in.");
	const yt = discoverStore.youtube();
	yt.account = { at: now.toISOString(), ...account };
	discoverStore.putYoutube(yt);
	return yt.account;
}

/** Signed out: who it was is dropped; what was read stays until forgotten. */
export function forgetYouTubeAccount(): void {
	const yt = discoverStore.youtube();
	if (!yt.account) return;
	delete yt.account;
	discoverStore.putYoutube(yt);
}

export function forgetYouTube(): void {
	discoverStore.clearYoutube();
	const scans = discoverStore.scans();
	let changed = false;
	for (const [id, v] of Object.entries(scans)) {
		const sources = v.sources.filter((s) => s === "creator" || s === "search");
		if (sources.length === v.sources.length) continue;
		changed = true;
		if (sources.length) scans[id] = { ...v, sources };
		else delete scans[id];
	}
	if (changed) discoverStore.putScans(scans);
}

// ─── The refresh ────────────────────────────────────────────────────────────

export type RefreshStatus = DiscoverStateView["refresh"];

interface RefreshState extends RefreshStatus {
	job?: Promise<void>;
	abort?: AbortController;
}

const KEY = "__lhDiscover";
function refreshState(): RefreshState {
	const g = globalThis as unknown as Record<string, RefreshState | undefined>;
	return (g[KEY] ??= { running: false, done: 0, total: 0 });
}

export function refreshStatus(): RefreshStatus {
	const { job: _job, abort: _abort, ...status } = refreshState();
	return status;
}

/** Read the creators' feeds and the YouTube lists, search, check the new
 *  videos, measure the old ones again, keep one video ready. One refresh at
 *  a time; a second caller shares the first. */
export function refreshDiscover(opts: { now?: Date; engine?: PiEngine; model?: string; keepReady?: boolean } = {}): Promise<void> {
	const s = refreshState();
	if (s.job) return s.job;
	const abort = new AbortController();
	const profile = activeProfile();
	listings().forget();
	Object.assign(s, { running: true, step: "Reading your creators' newest videos", done: 0, total: 0, error: undefined, abort });
	const job = (async () => {
		const signal = abort.signal;
		const now = opts.now ?? new Date();
		const lexicon = loadLexicon();
		const k = knownWords(lexicon);
		const f = discoverStore.creators();
		const yt = discoverStore.youtube();
		const scans = discoverStore.scans();
		const queue = new Map<string, { found: FoundVideo; sources: Set<PickSource>; query?: string }>();
		const add = (v: FoundVideo, source: PickSource, query?: string) => {
			const kept = scans[v.id];
			if (kept && (awaitingCaptions(kept, now) || (kept.skip === "too-long" && kept.durationSec <= MAX_VIDEO_SEC))) {
				// Its captions may have arrived since, or the longest video taken may have grown: check it again, keeping what found it.
				const q = queue.get(v.id) ?? { found: { ...v, at: kept.publishedAt }, sources: new Set<PickSource>(kept.sources), ...(kept.query ? { query: kept.query } : {}) };
				q.sources.add(source);
				queue.set(v.id, q);
			} else if (kept) {
				if (!kept.sources.includes(source)) kept.sources = [...kept.sources, source];
				if (source === "creator" && v.at && !kept.publishedAt) kept.publishedAt = v.at;
				return;
			}
			const q = queue.get(v.id) ?? { found: v, sources: new Set<PickSource>(), ...(query ? { query } : {}) };
			q.sources.add(source);
			if (!q.found.at && v.at) q.found = { ...q.found, at: v.at };
			queue.set(v.id, q);
		};

		await pool(f.creators, 4, async (c) => {
			const { videos } = await channelVideos(c.id, signal);
			for (const v of videos.slice(0, PER_CREATOR)) add({ ...v, channelId: v.channelId ?? c.id, channel: v.channel ?? c.name }, "creator");
		}, signal);
		const saved = new Set(f.creators.map((c) => c.id));
		const subs = (yt.subscriptions?.channels ?? []).filter((c) => !saved.has(c.id)).slice(0, MAX_SUBSCRIPTIONS);
		if (subs.length) {
			s.step = "Reading the channels you subscribe to";
			await pool(subs, 6, async (c) => {
				const { videos } = await channelVideos(c.id, signal);
				for (const v of videos.slice(0, PER_SUBSCRIPTION)) add({ ...v, channelId: c.id, channel: v.channel ?? c.name }, "subscriptions");
			}, signal);
		}
		for (const v of (yt.history?.videos ?? []).slice(0, MAX_HISTORY)) add(v, "history");
		for (const v of (yt.recommended?.videos ?? []).slice(0, MAX_RECOMMENDED)) add(v, "recommended");

		try {
			const queries = await interestSearches({ now, engine: opts.engine, model: opts.model });
			if (queries.length) s.step = "Searching YouTube for your interests";
			await pool(queries, 3, async (q) => {
				for (const v of (await searchVideos(q, signal)).slice(0, PER_SEARCH)) add(v, "search", q);
			}, signal);
		} catch (err) {
			if (err instanceof Error && err.name === "AbortError") throw err;
		}

		const todo = [...queue.values()].slice(0, MAX_SCANS);
		s.step = "Checking the videos";
		s.total = todo.length;
		await pool(todo, 4, async (q) => {
			try {
				const prev = scans[q.found.id];
				const next = await scanVideo(q.found, [...q.sources], { lexicon, k, now, query: q.query, signal });
				// Still no captions: the wait is counted from the first check.
				scans[q.found.id] = prev?.skip === "no-captions" && next.skip === "no-captions" ? { ...next, scannedAt: prev.scannedAt } : next;
			} finally {
				s.done++;
			}
		}, signal);

		s.step = "Measuring what you know of each";
		const tooOld = now.getTime() - REMEASURE_AFTER_MS;
		// A pick measured before the learner marked words as known (E69) is measured again.
		const marked = knownWordStore.updatedAt();
		for (const v of Object.values(scans)) {
			if (v.coverage === undefined || !v.trackLang) continue;
			if (v.level === k.level && v.measuredAt && Date.parse(v.measuredAt) > tooOld && !(marked && v.measuredAt < marked)) continue;
			const lines = discoverStore.text(v.id, v.trackLang);
			if (!lines) continue;
			Object.assign(v, measureLines(lines, lexicon, k), { level: k.level, measuredAt: now.toISOString() });
		}
		if (activeProfile() !== profile) return;
		discoverStore.putScans(scans);
		discoverStore.putCreators({ ...discoverStore.creators(), refreshedAt: now.toISOString() });
		await fillAvatars(signal).catch(() => {});
		if (opts.keepReady !== false) keepOneReady();
	})();
	s.job = job;
	return job
		.catch((err) => {
			s.error = err instanceof Error && err.name === "AbortError" ? "Stopped." : err instanceof Error ? err.message : String(err);
		})
		.finally(() => {
			Object.assign(s, { running: false, step: undefined, job: undefined, abort: undefined, finishedAt: new Date().toISOString() });
		});
}

/** Refresh when the picks are stale and there is something to read. */
export function refreshIfStale(now = new Date()): void {
	if (refreshState().running) return;
	const f = discoverStore.creators();
	const yt = discoverStore.youtube();
	if (!f.creators.length && !yt.history && !yt.recommended && !yt.subscriptions) return;
	if (f.refreshedAt && now.getTime() - Date.parse(f.refreshedAt) < REFRESH_AFTER_MS) return;
	void refreshDiscover();
}

// ─── The offer ──────────────────────────────────────────────────────────────

/** Videos already in the library or dismissed are not offered. */
function excluded(): Set<string> {
	const out = discoverStore.dismissed();
	for (const v of videoStore.list()) out.add(v.id);
	return out;
}

export function picks(now = new Date()): PickedVideo[] {
	return rankPicks(Object.values(discoverStore.scans()), { exclude: excluded(), now });
}

/** When no video waits and a model is set, prepare the best pick in the
 *  background (one or two cheap requests), so Today's Watch task has one.
 *  Only a pick the learner can follow (88% known or more). */
export function keepOneReady(): string | null {
	if (!discoverStore.creators().keepReady || !storyEngine()) return null;
	const watched = new Set(videoStore.watches().map((w) => w.videoId));
	if (videoStore.list().some((v) => !watched.has(v.id)) || watchState().preparing.length > 0) return null;
	const top = picks().find((p) => p.coverage !== undefined && p.coverage >= KEEP_READY_FLOOR && p.spoken === "yes" && (p.wordsPerMin ?? 0) >= 50);
	if (!top || prepareStage(top.id)) return null;
	void prepareVideo(videoUrl(top.id)).catch(() => {
		const scans = discoverStore.scans();
		if (scans[top.id]) discoverStore.putScans({ ...scans, [top.id]: { ...scans[top.id]!, skip: "unavailable" } });
	});
	return top.id;
}

export function dismissPick(id: string): void {
	discoverStore.dismiss(id);
}

export function discoverState(now = new Date()): DiscoverStateView {
	const f = discoverStore.creators();
	const yt = discoverStore.youtube();
	const scans = Object.values(discoverStore.scans());
	const all = picks(now);
	const pics = discoverStore.avatars();
	const dismissed = discoverStore.dismissed();
	const picture = (id: string) => (pics[id] ? { avatar: pics[id] } : {});
	const withPicture = (p: PickedVideo): PickedVideo => (p.channelId && pics[p.channelId] ? { ...p, avatar: pics[p.channelId]! } : p);
	return {
		creators: f.creators.map((c) => ({
			...c,
			picks: all.filter((p) => p.channelId === c.id).length,
			videos: all.filter((p) => p.channelId === c.id).slice(0, CREATOR_VIDEOS).map(withPicture),
			tooLong: scans.filter((v) => v.channelId === c.id && v.skip === "too-long" && !dismissed.has(v.id)).length,
			awaitingCaptions: scans.filter((v) => v.channelId === c.id && awaitingCaptions(v, now)).length,
			...picture(c.id),
		})),
		picks: all.slice(0, 40).map(withPicture),
		suggestions: suggestions().map((s) => ({ ...s, ...picture(s.id) })),
		keepReady: f.keepReady,
		...(f.refreshedAt ? { refreshedAt: f.refreshedAt } : {}),
		refresh: refreshStatus(),
		youtube: {
			...(yt.history ? { history: { at: yt.history.at, via: yt.history.via, count: yt.history.videos.length } } : {}),
			...(yt.recommended ? { recommended: { at: yt.recommended.at, via: yt.recommended.via, count: yt.recommended.videos.length } } : {}),
			...(yt.subscriptions ? { subscriptions: { at: yt.subscriptions.at, via: yt.subscriptions.via, count: yt.subscriptions.channels.length } } : {}),
		},
		...(yt.account && (yt.account.name || yt.account.photo) ? { youtubeAccount: yt.account } : {}),
		searches: discoverStore.searches()?.queries ?? [],
		canSearch: storyEngine() !== null,
		checked: scans.length,
		offered: all.length,
	};
}
