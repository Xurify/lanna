/**
 * Picks for Watch (LangHarness, 2026-11-05; owner: "connect our YouTube
 * account and analyze your YouTube history and/or our recommended and then
 * pick videos or find videos based off that", and "import and save
 * creators so the process of adding YouTube videos is easier or more
 * automatic"). The pure half: what a pasted channel is, a channel's feed,
 * the videos and channels on a YouTube page, a Google Takeout export,
 * whether a video is spoken in the language, and which videos to offer.
 *
 * Why this shape:
 *   - YouTube's Data API returns neither the watch history nor the
 *     recommendations (both were withdrawn in 2016), so the account is read
 *     the way the YouTube site itself reads it (the desktop app's own signed-in
 *     window, electron/youtube.cjs) or from a Takeout export. Both land here
 *     as the same plain lists.
 *   - A video with Slovak subtitles is often not Slovak speech: farms upload
 *     machine-translated subtitle tracks in fifty languages, and YouTube's
 *     automatic captions have no Slovak model, so a Slovak speaker's automatic
 *     track is labelled Polish or Czech. `judgeSpoken` weighs the automatic
 *     track's language against how much of the original title and
 *     description reads as the language (measured with the lexicon).
 *   - The offer is ranked by the known-word share of the real transcript,
 *     measured locally with no model call (src/server/discover.ts), so a pick
 *     is input at the learner's level: 93–98% known is where listening works
 *     (the Watch task's LISTEN_FLOOR, van Zeeland & Schmitt 2013).
 *
 * Browser-safe: no file or network access.
 */

import type { Cefr } from "./curriculum.ts";
import { LISTEN_FLOOR } from "./listen.ts";
import { coverageBand, decodeEntities, parseVideoUrl } from "./watch.ts";

// ─── Records ────────────────────────────────────────────────────────────────

/** Where a saved creator came from. */
export type CreatorFrom = "link" | "subscriptions" | "history" | "recommended" | "search" | "takeout";

export interface Creator {
	/** The channel id ("UC" and 22 characters). */
	id: string;
	name: string;
	/** "@handle", when known. */
	handle?: string;
	addedAt: string;
	from: CreatorFrom;
}

/** Where a candidate video was found. */
export type PickSource = "creator" | "subscriptions" | "history" | "recommended" | "search";

/** Why a scanned video is not offered. */
export type SkipReason = "no-captions" | "other-language" | "too-long" | "too-short" | "live" | "unavailable";

/** One video checked for the offer (videos/discover/scans.json). The check
 *  is free: YouTube's player data and the caption track, glossed locally. */
export interface ScannedVideo {
	id: string;
	title: string;
	channelId?: string;
	channel?: string;
	durationSec: number;
	publishedAt?: string;
	scannedAt: string;
	/** The caption tracks the video has: "sk" for one made by people, "sk:asr" for YouTube's automatic one. */
	tracks: string[];
	/** Is the video spoken in the language (`judgeSpoken`)? */
	spoken: "yes" | "no" | "unsure";
	/** Share of the original title and description that reads as the language (0..1). */
	titleShare?: number;
	skip?: SkipReason;
	/** The track measured, and whether people made it. */
	trackLang?: string;
	captionKind?: "captions" | "auto-captions";
	/** Share of running words the learner knows (studied, or a grammar word,
	 *  name or number), with the level and day it was measured at. Absent for
	 *  captions in another language (Czech for Slovak), which are not matched
	 *  against the lexicon. */
	coverage?: number;
	/** The share a learner at the level is expected to know, the words the
	 *  level assumes included. */
	expected?: number;
	wordCount?: number;
	unknownCount?: number;
	level?: Cefr;
	measuredAt?: string;
	/** Caption words a minute of video: speech runs at 120–180; a cooking
	 *  video captioned only with its on-screen text runs under 30. */
	wordsPerMin?: number;
	sources: PickSource[];
	/** The search that found it (sources includes "search"). */
	query?: string;
}

/** YouTube makes a new upload's automatic captions hours after it is
 *  published; a video found without captions is looked at again until it is
 *  this old (counted from when it was first checked when the date of
 *  publishing is not known, as when a channel's page stands in for its feed). */
export const CAPTIONS_WAIT_MS = 3 * 86_400_000;

/** A fresh upload that had no captions when it was checked. */
export function awaitingCaptions(v: Pick<ScannedVideo, "skip" | "publishedAt" | "scannedAt">, now: Date): boolean {
	if (v.skip !== "no-captions") return false;
	const age = now.getTime() - Date.parse(v.publishedAt ?? v.scannedAt);
	return age >= 0 && age < CAPTIONS_WAIT_MS;
}

/** The channels in pasted text: links, @handles and ids, apart by spaces, commas or lines; each once. */
export function splitChannelInputs(text: string): string[] {
	return [...new Set(text.split(/[\s,;]+/).filter(Boolean))];
}

/** A video on a YouTube page or in an export, before it is checked. */
export interface FoundVideo {
	id: string;
	title: string;
	channel?: string;
	channelId?: string;
	durationSec?: number;
	/** When it was watched (history) or published (a feed). */
	at?: string;
}

export interface FoundChannel {
	id: string;
	name: string;
	handle?: string;
	avatar?: string;
}

// ─── Ids and links ──────────────────────────────────────────────────────────

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

export function isChannelId(id: string): boolean {
	return CHANNEL_ID.test(id);
}

export function channelUrl(c: { id: string; handle?: string }): string {
	return c.handle ? `https://www.youtube.com/${c.handle}` : `https://www.youtube.com/channel/${c.id}`;
}

export type ChannelInput = { kind: "channel"; id: string } | { kind: "page"; url: string; handle?: string } | { kind: "video"; id: string };

/** What a pasted creator is: a channel id or link, an @handle or a channel
 *  page (resolved on the server), or one of their videos. Null for anything
 *  else. */
export function parseChannelInput(input: string): ChannelInput | null {
	const s = input.trim();
	if (!s) return null;
	if (CHANNEL_ID.test(s)) return { kind: "channel", id: s };
	if (/^@[\p{L}\p{N}._-]{2,100}$/u.test(s)) return { kind: "page", url: `https://www.youtube.com/${s}`, handle: s };
	const video = parseVideoUrl(s);
	if (video && !/^[A-Za-z0-9_-]{11}$/.test(s)) return { kind: "video", id: video };
	let u: URL;
	try {
		u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
	} catch {
		return null;
	}
	const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
	if (host !== "youtube.com") return null;
	const parts = u.pathname.split("/").filter(Boolean).map((p) => decodeURIComponent(p));
	if (parts[0] === "channel" && parts[1] && CHANNEL_ID.test(parts[1])) return { kind: "channel", id: parts[1] };
	if (parts[0]?.startsWith("@")) return { kind: "page", url: `https://www.youtube.com/${encodeURIComponent(parts[0]).replace(/^%40/, "@")}`, handle: parts[0] };
	if ((parts[0] === "c" || parts[0] === "user") && parts[1]) return { kind: "page", url: `https://www.youtube.com/${parts[0]}/${encodeURIComponent(parts[1])}` };
	return null;
}

// ─── A channel's feed ───────────────────────────────────────────────────────

/** YouTube's Atom feed for a channel (the newest 15 uploads, no key needed). */
export function parseChannelFeed(xml: string): { channel: FoundChannel | null; videos: FoundVideo[] } {
	const tag = (src: string, name: string) => {
		const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(src);
		return m ? decodeEntities(m[1]!.trim()) : undefined;
	};
	const head = xml.split("<entry>")[0] ?? "";
	const rawId = tag(head, "yt:channelId");
	const id = rawId ? (rawId.startsWith("UC") ? rawId : `UC${rawId}`) : undefined;
	const name = tag(head, "title");
	const videos: FoundVideo[] = [];
	for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
		const e = m[1]!;
		const vid = tag(e, "yt:videoId");
		if (!vid || !/^[A-Za-z0-9_-]{11}$/.test(vid)) continue;
		const author = /<author>\s*<name>([\s\S]*?)<\/name>/.exec(e)?.[1];
		const channelId = tag(e, "yt:channelId");
		// A short's link is /shorts/<id>; the task needs a few minutes of speech.
		if (/href="https:\/\/www\.youtube\.com\/shorts\//.test(e)) continue;
		videos.push({
			id: vid,
			title: tag(e, "title") ?? vid,
			...(author ? { channel: decodeEntities(author.trim()) } : {}),
			...(channelId && CHANNEL_ID.test(channelId) ? { channelId } : id ? { channelId: id } : {}),
			...(tag(e, "published") ? { at: tag(e, "published") } : {}),
		});
	}
	return { channel: id && CHANNEL_ID.test(id) && name ? { id, name } : null, videos };
}

// ─── Videos and channels on a YouTube page ──────────────────────────────────

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);

/** The text of a YouTube text object: simpleText, runs, or a view model's content. */
function textOf(v: unknown): string | undefined {
	if (typeof v === "string") return v;
	if (!isObj(v)) return undefined;
	if (typeof v.simpleText === "string") return v.simpleText;
	if (typeof v.content === "string") return v.content;
	if (Array.isArray(v.runs)) return v.runs.map((r) => (isObj(r) && typeof r.text === "string" ? r.text : "")).join("");
	return undefined;
}

/** The first channel id a subtree links to. */
function channelIdIn(v: unknown, depth = 0): string | undefined {
	if (depth > 14 || !v || typeof v !== "object") return undefined;
	if (Array.isArray(v)) {
		for (const x of v) {
			const got = channelIdIn(x, depth + 1);
			if (got) return got;
		}
		return undefined;
	}
	const b = (v as Json).browseId;
	if (typeof b === "string" && CHANNEL_ID.test(b)) return b;
	for (const x of Object.values(v)) {
		const got = channelIdIn(x, depth + 1);
		if (got) return got;
	}
	return undefined;
}

/** The first "12:34" or "1:02:03" a subtree shows: a thumbnail's length badge. */
function clockIn(v: unknown, depth = 0): number | undefined {
	if (depth > 14 || v === null || v === undefined) return undefined;
	if (typeof v === "string") return /^\d{1,2}(:\d{2}){1,2}$/.test(v.trim()) ? parseClock(v) : undefined;
	if (typeof v !== "object") return undefined;
	for (const x of Array.isArray(v) ? v : Object.values(v)) {
		const got = clockIn(x, depth + 1);
		if (got !== undefined) return got;
	}
	return undefined;
}

export function parseClock(s: string): number | undefined {
	const parts = s.trim().split(":").map(Number);
	if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return undefined;
	return parts.reduce((sum, n) => sum * 60 + n, 0);
}

/** The video renderers YouTube has used for a list item, old and new. */
const VIDEO_RENDERERS = new Set(["videoRenderer", "gridVideoRenderer", "compactVideoRenderer", "playlistVideoRenderer", "videoWithContextRenderer", "playlistPanelVideoRenderer"]);

function fromRenderer(v: Json): FoundVideo | null {
	const id = v.videoId;
	if (typeof id !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
	const title = textOf(v.title) ?? textOf(v.headline);
	if (!title) return null;
	const owner = v.ownerText ?? v.shortBylineText ?? v.longBylineText;
	const channel = textOf(owner);
	const channelId = channelIdIn(owner);
	const durationSec = typeof v.lengthSeconds === "string" || typeof v.lengthSeconds === "number" ? Number(v.lengthSeconds) : textOf(v.lengthText) ? parseClock(textOf(v.lengthText)!) : undefined;
	return { id, title, ...(channel ? { channel } : {}), ...(channelId ? { channelId } : {}), ...(durationSec ? { durationSec } : {}) };
}

/** The lockup view model (2024 on): title and channel in its metadata rows. */
function fromLockup(v: Json): FoundVideo | null {
	if (v.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO" || typeof v.contentId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(v.contentId)) return null;
	const meta = isObj(v.metadata) && isObj(v.metadata.lockupMetadataViewModel) ? v.metadata.lockupMetadataViewModel : null;
	const title = textOf(meta?.title);
	if (!title) return null;
	const rows = (isObj(meta?.metadata) && isObj(meta.metadata.contentMetadataViewModel) && Array.isArray(meta.metadata.contentMetadataViewModel.metadataRows) ? meta.metadata.contentMetadataViewModel.metadataRows : []) as Json[];
	const firstPart = Array.isArray(rows[0]?.metadataParts) ? (rows[0]!.metadataParts as Json[])[0] : undefined;
	const channel = textOf(firstPart?.text);
	const channelId = channelIdIn(meta);
	const durationSec = clockIn(v.contentImage);
	return { id: v.contentId, title, ...(channel ? { channel } : {}), ...(channelId ? { channelId } : {}), ...(durationSec ? { durationSec } : {}) };
}

/** Every video listed on a YouTube page's data (ytInitialData, or an
 *  innertube answer): the history, the home page's recommendations, a
 *  search, a channel's videos. In page order, each once; shorts are left
 *  out (the task needs minutes of speech, not seconds). */
export function extractVideos(data: unknown): FoundVideo[] {
	const out = new Map<string, FoundVideo>();
	const walk = (v: unknown, depth: number) => {
		if (depth > 60 || !v || typeof v !== "object") return;
		if (Array.isArray(v)) {
			for (const x of v) walk(x, depth + 1);
			return;
		}
		for (const [k, x] of Object.entries(v)) {
			if (/^(reelItemRenderer|shortsLockupViewModel|reelShelfRenderer)$/.test(k)) continue;
			if (isObj(x)) {
				const found = VIDEO_RENDERERS.has(k) ? fromRenderer(x) : k === "lockupViewModel" ? fromLockup(x) : null;
				if (found) {
					if (!out.has(found.id)) out.set(found.id, found);
					continue;
				}
			}
			walk(x, depth + 1);
		}
	};
	walk(data, 0);
	return [...out.values()];
}

/** The biggest picture in a `thumbnails` list that sits on Google's image
 *  hosts, resized to a small round crop. Anything else is dropped, so a page
 *  cannot make the app load an image from another site. */
export function channelImage(thumbnails: unknown): string | undefined {
	const list = isObj(thumbnails) && Array.isArray(thumbnails.thumbnails) ? thumbnails.thumbnails : Array.isArray(thumbnails) ? thumbnails : [];
	let best: { url: string; width: number } | undefined;
	for (const t of list) {
		if (!isObj(t) || typeof t.url !== "string") continue;
		const width = typeof t.width === "number" ? t.width : 0;
		if (!best || width >= best.width) best = { url: t.url, width };
	}
	if (!best) return undefined;
	let url: URL;
	try {
		url = new URL(best.url.startsWith("//") ? `https:${best.url}` : best.url);
	} catch {
		return undefined;
	}
	if (url.protocol !== "https:" || !/^yt[34]\.(ggpht|googleusercontent)\.com$/.test(url.hostname)) return undefined;
	// The picture's own size and crop come after the "=".
	return `${url.origin}${url.pathname.split("=")[0]}=s96-c-k-c0x00ffffff-no-rj`;
}

/** Every channel listed on a page's data (the subscriptions page lists
 *  them as channel renderers). */
export function extractChannels(data: unknown): FoundChannel[] {
	const out = new Map<string, FoundChannel>();
	const walk = (v: unknown, depth: number) => {
		if (depth > 60 || !v || typeof v !== "object") return;
		if (Array.isArray(v)) {
			for (const x of v) walk(x, depth + 1);
			return;
		}
		for (const [k, x] of Object.entries(v)) {
			if ((k === "channelRenderer" || k === "gridChannelRenderer") && isObj(x) && typeof x.channelId === "string" && CHANNEL_ID.test(x.channelId)) {
				const name = textOf(x.title);
				const handle = textOf(x.subscriberCountText)?.trim();
				const avatar = channelImage(x.thumbnail);
				if (name && !out.has(x.channelId)) out.set(x.channelId, { id: x.channelId, name, ...(handle?.startsWith("@") ? { handle } : {}), ...(avatar ? { avatar } : {}) });
				continue;
			}
			walk(x, depth + 1);
		}
	};
	walk(data, 0);
	return [...out.values()];
}

// ─── Google Takeout ─────────────────────────────────────────────────────────

/** "Watched <title>" in the export's language; only the title is kept. */
const WATCHED_PREFIX = /^(Watched|Pozreli ste si|Zhlédnuto|Vaadatud|Просмотрено:?|Viděli jste|Obejrzano:?|Angesehen:?|Vous avez regardé)\s+/i;

/** A Takeout watch history, JSON or HTML (Takeout's default), newest first.
 *  Ads ("From Google Ads") and removed videos are left out. */
export function parseTakeoutHistory(text: string): FoundVideo[] {
	const s = text.trim();
	const out: FoundVideo[] = [];
	const seen = new Set<string>();
	const push = (v: FoundVideo) => {
		if (seen.has(v.id)) return;
		seen.add(v.id);
		out.push(v);
	};
	if (s.startsWith("[")) {
		let items: unknown;
		try {
			items = JSON.parse(s);
		} catch {
			return [];
		}
		if (!Array.isArray(items)) return [];
		for (const raw of items) {
			if (!isObj(raw) || typeof raw.titleUrl !== "string") continue;
			if (Array.isArray(raw.details) && raw.details.some((d) => isObj(d) && typeof d.name === "string" && /Google Ads/i.test(d.name))) continue;
			const id = parseVideoUrl(raw.titleUrl);
			if (!id) continue;
			const sub = Array.isArray(raw.subtitles) && isObj(raw.subtitles[0]) ? raw.subtitles[0] : null;
			const channelId = typeof sub?.url === "string" ? /\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(sub.url)?.[1] : undefined;
			push({
				id,
				title: typeof raw.title === "string" ? raw.title.replace(WATCHED_PREFIX, "") : id,
				...(typeof sub?.name === "string" ? { channel: sub.name } : {}),
				...(channelId ? { channelId } : {}),
				...(typeof raw.time === "string" ? { at: raw.time } : {}),
			});
		}
		return out;
	}
	for (const cell of s.split(/class="outer-cell/).slice(1)) {
		if (/Google Ads/i.test(cell)) continue;
		const video = /<a href="(https:\/\/www\.youtube\.com\/watch\?v=[^"]+)">([\s\S]*?)<\/a>/.exec(cell);
		if (!video) continue;
		const id = parseVideoUrl(decodeEntities(video[1]!));
		if (!id) continue;
		const channel = /<a href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})">([\s\S]*?)<\/a>/.exec(cell);
		push({ id, title: decodeEntities(video[2]!.replace(/<[^>]+>/g, "")).trim() || id, ...(channel ? { channelId: channel[1]!, channel: decodeEntities(channel[2]!).trim() } : {}) });
	}
	return out;
}

/** One CSV line's fields, quotes respected. */
function csvFields(line: string): string[] {
	const out: string[] = [];
	let cur = "";
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i]!;
		if (quoted) {
			if (ch === '"' && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else if (ch === '"') quoted = false;
			else cur += ch;
		} else if (ch === '"') quoted = true;
		else if (ch === ",") {
			out.push(cur);
			cur = "";
		} else cur += ch;
	}
	out.push(cur);
	return out.map((f) => f.trim());
}

/** A Takeout subscriptions.csv (Channel Id, Channel Url, Channel Title; the
 *  header is in the account's language, so rows are read by shape). */
export function parseTakeoutSubscriptions(text: string): FoundChannel[] {
	const out = new Map<string, FoundChannel>();
	for (const line of text.split(/\r?\n/)) {
		const f = csvFields(line);
		const id = f.find((x) => CHANNEL_ID.test(x));
		if (!id) continue;
		const name = f.filter((x) => x && x !== id && !/^https?:\/\//.test(x)).at(-1);
		if (name && !out.has(id)) out.set(id, { id, name });
	}
	return [...out.values()];
}

/** Which Takeout file this is, by its content. */
export function takeoutKind(text: string): "history" | "subscriptions" | null {
	const head = text.slice(0, 20_000);
	if (/youtube\.com\/watch\?v=/.test(head) && (/"titleUrl"/.test(head) || /outer-cell/.test(head))) return "history";
	if (/UC[A-Za-z0-9_-]{22}/.test(head) && /,/.test(head) && !/<html/i.test(head)) return "subscriptions";
	return null;
}

// ─── Is it spoken in the language? ──────────────────────────────────────────

/** Uploaded subtitle languages from which a set reads as translations. */
export const TRANSLATED_SET = 5;

/** Spoken in the language, from the caption tracks and how much of the
 *  original title and description reads as the language:
 *   - YouTube's automatic track is in the language, or in one of its
 *     caption fallbacks: yes;
 *   - the title reads as the language (half its words or more are the
 *     language's): yes, unless the video carries subtitles uploaded in five
 *     languages or more, a translated set that says nothing of the speech
 *     (unsure). The automatic track is sometimes missing or labelled with a
 *     neighbor's language (Polish for a Slovak speaker);
 *   - a fifth or less: no (a German cooking video with uploaded Slovak
 *     subtitles);
 *   - otherwise, or with under three words to go on: unsure. */
export function judgeSpoken(input: { tracks: readonly string[]; lang: string; fallbacks?: readonly string[]; titleShare?: number; titleWords?: number }): "yes" | "no" | "unsure" {
	const own = new Set([input.lang, ...(input.fallbacks ?? [])]);
	const asr = input.tracks.filter((t) => t.endsWith(":asr")).map((t) => t.split(":")[0]!.split("-")[0]!);
	if (asr.some((l) => own.has(l))) return "yes";
	if (input.titleShare === undefined || (input.titleWords ?? 0) < 3) return "unsure";
	if (input.titleShare <= 0.2) return "no";
	const uploaded = input.tracks.filter((t) => !t.endsWith(":asr")).length;
	if (input.titleShare >= 0.5 && uploaded < TRANSLATED_SET) return "yes";
	return "unsure";
}

/** Under this many caption words a minute the video is mostly music or
 *  pictures, not speech. */
export const SPARSE_SPEECH_WPM = 30;

/** The tracks in the "sk" / "sk:asr" shape. */
export function trackTags(tracks: readonly { languageCode: string; kind?: string }[]): string[] {
	return [...new Set(tracks.map((t) => `${t.languageCode.toLowerCase().split("-")[0]}${t.kind === "asr" ? ":asr" : ""}`))];
}

// ─── The offer ──────────────────────────────────────────────────────────────

export interface PickedVideo extends ScannedVideo {
	/** The channel's picture, when known. */
	avatar?: string;
	score: number;
	/** coverageBand's word ("comfortable", "stretch"…), or "unmeasured" for
	 *  captions in another language. */
	band: string;
}

/** Shorter than this is a clip, not a session. */
export const MIN_PICK_SEC = 60;

/** How well a video fits as input today, 0..~1.2. Coverage first (93–98%
 *  known is listening that works; 88–93% a stretch the step mode carries),
 *  then speech that fills the video, captions made by people, a length that
 *  fits a session, and fresh uploads. A video only "unsure" to be spoken in
 *  the language counts less. */
export function pickScore(v: ScannedVideo, now = new Date()): number {
	let fit: number;
	if (v.coverage === undefined) fit = 0.4;
	else if (v.coverage >= 0.98) fit = 0.9;
	else if (v.coverage >= LISTEN_FLOOR) fit = 1;
	else if (v.coverage >= 0.88) fit = 0.75;
	else if (v.coverage >= 0.8) fit = 0.35;
	else fit = 0.02 + 0.06 * (v.coverage / 0.8);
	let score = fit;
	if (v.spoken === "unsure") score *= 0.7;
	if (v.wordsPerMin !== undefined) score *= v.wordsPerMin < SPARSE_SPEECH_WPM ? 0.3 : v.wordsPerMin < 50 ? 0.85 : 1;
	if (v.captionKind === "auto-captions") score *= 0.85;
	if (v.durationSec > 25 * 60) score *= 0.8;
	else if (v.durationSec < 2 * 60) score *= 0.85;
	if (v.sources.includes("creator")) score *= 1.1;
	if (v.publishedAt) {
		const days = (now.getTime() - Date.parse(v.publishedAt)) / 86_400_000;
		if (Number.isFinite(days) && days >= 0) score += 0.1 * Math.exp(-days / 30);
	}
	return Math.round(score * 1000) / 1000;
}

/** Whether a scanned video can be offered at all. */
export function pickable(v: ScannedVideo): boolean {
	return !v.skip && v.spoken !== "no" && !!v.trackLang;
}

/** The videos to offer, best first: checked, spoken in the language (or not
 *  ruled out), not in the library, not dismissed. */
export function rankPicks(videos: readonly ScannedVideo[], opts: { exclude?: ReadonlySet<string>; now?: Date } = {}): PickedVideo[] {
	return videos
		.filter((v) => pickable(v) && !opts.exclude?.has(v.id))
		.map((v) => ({ ...v, score: pickScore(v, opts.now), band: v.coverage === undefined ? "unmeasured" : coverageBand(v.coverage).band }))
		.sort((a, b) => b.score - a.score || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

// ─── One creator's videos ────────────────────────────────────────────────────

const AGO = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i;
const AGO_UNITS: Record<string, number> = { second: 1 / 86_400, minute: 1 / 1_440, hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 };

/** YouTube's English relative date ("3 weeks ago", "Streamed 2 days ago")
 *  as the date that far back. Only as exact as the text: good enough to sort
 *  search results by date, which is all it is used for. */
export function agoToIso(text: string, now: Date): string | undefined {
	const m = AGO.exec(text);
	if (!m) return undefined;
	const days = Number(m[1]) * AGO_UNITS[m[2]!.toLowerCase()]!;
	return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** Each video's relative publish date on a YouTube page (English pages only), by id. */
export function publishedTimes(data: unknown): Map<string, string> {
	const out = new Map<string, string>();
	const walk = (v: unknown, depth: number) => {
		if (depth > 60 || !v || typeof v !== "object") return;
		if (Array.isArray(v)) {
			for (const x of v) walk(x, depth + 1);
			return;
		}
		const o = v as Json;
		if (typeof o.videoId === "string" && o.publishedTimeText !== undefined) {
			const t = textOf(o.publishedTimeText);
			if (t && !out.has(o.videoId)) out.set(o.videoId, t);
		}
		// The lockup (2024 on) keeps the date as one of its metadata row texts.
		if (o.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" && typeof o.contentId === "string" && !out.has(o.contentId)) {
			const t = firstAgo(o.metadata, 0);
			if (t) out.set(o.contentId, t);
		}
		for (const x of Object.values(o)) walk(x, depth + 1);
	};
	walk(data, 0);
	return out;
}

function firstAgo(v: unknown, depth: number): string | undefined {
	if (depth > 12 || !v || typeof v !== "object") return undefined;
	for (const x of Array.isArray(v) ? v : Object.values(v)) {
		if (typeof x === "string" && AGO.test(x)) return x;
		const found = firstAgo(x, depth + 1);
		if (found) return found;
	}
	return undefined;
}

/** Why a creator's video is or is not offered. */
export type CreatorVideoStatus = "offered" | "in-library" | "dismissed" | SkipReason | "not-in-language";

export interface CreatorVideo extends PickedVideo {
	status: CreatorVideoStatus;
}

/** A creator's videos as checked, in the order given, each with why it is
 *  or is not offered. Only offered ones carry a score; the rest score 0. */
export function creatorVideoRows(videos: readonly ScannedVideo[], opts: { library: ReadonlySet<string>; dismissed: ReadonlySet<string>; now?: Date }): CreatorVideo[] {
	return videos.map((v) => {
		const status: CreatorVideoStatus = opts.library.has(v.id) ? "in-library" : opts.dismissed.has(v.id) ? "dismissed" : v.skip ? v.skip : v.spoken === "no" || !v.trackLang ? "not-in-language" : "offered";
		const offered = status === "offered";
		return { ...v, status, score: offered ? pickScore(v, opts.now) : 0, band: v.coverage === undefined ? "unmeasured" : coverageBand(v.coverage).band };
	});
}

/** Best for you: offered videos by score, then the rest, newest first. Newest: by date alone; an undated video goes last. */
export function sortCreatorVideos(rows: readonly CreatorVideo[], by: "best" | "newest"): CreatorVideo[] {
	const newest = (a: CreatorVideo, b: CreatorVideo) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
	return [...rows].sort(by === "newest" ? newest : (a, b) => b.score - a.score || newest(a, b));
}

export interface CreatorSuggestion extends FoundChannel {
	/** Its videos found spoken in the language. */
	videos: number;
	from: PickSource[];
	subscribed: boolean;
}

/** Channels worth saving: the ones whose videos turned out to be spoken in
 *  the language, from the history, the recommendations and searches, most
 *  such videos first. Saved channels are left out. */
export function suggestCreators(videos: readonly ScannedVideo[], saved: ReadonlySet<string>, subscriptions: readonly FoundChannel[] = []): CreatorSuggestion[] {
	const subs = new Map(subscriptions.map((c) => [c.id, c]));
	const by = new Map<string, CreatorSuggestion>();
	for (const v of videos) {
		if (!v.channelId || saved.has(v.channelId) || v.spoken !== "yes" || !v.trackLang || v.skip) continue;
		if (v.wordsPerMin !== undefined && v.wordsPerMin < SPARSE_SPEECH_WPM) continue;
		const c = by.get(v.channelId) ?? { id: v.channelId, name: v.channel ?? subs.get(v.channelId)?.name ?? v.channelId, videos: 0, from: [], subscribed: subs.has(v.channelId), ...(subs.get(v.channelId)?.avatar ? { avatar: subs.get(v.channelId)!.avatar } : {}) };
		c.videos++;
		for (const s of v.sources) if (s !== "creator" && !c.from.includes(s)) c.from.push(s);
		by.set(v.channelId, c);
	}
	return [...by.values()].sort((a, b) => Number(b.subscribed) - Number(a.subscribed) || b.videos - a.videos || a.name.localeCompare(b.name));
}

/** The read from YouTube that the Watch page shows: which lists, when, how many. */
export type YouTubeListName = "history" | "recommended" | "subscriptions";

/** What GET /api/watch/discover answers (src/server/discover.ts discoverState). */
export interface DiscoverStateView {
	creators: Array<
		Creator & {
			picks: number;
			avatar?: string;
			/** Its best picks, to watch from its row. */
			videos: PickedVideo[];
			/** Checked but not offered: over the length of a session. */
			tooLong: number;
			/** Videos without captions that are looked at again (see awaitingCaptions). */
			awaitingCaptions: number;
		}
	>;
	picks: PickedVideo[];
	suggestions: CreatorSuggestion[];
	keepReady: boolean;
	refreshedAt?: string;
	refresh: { running: boolean; step?: string; done: number; total: number; error?: string; finishedAt?: string };
	youtube: Partial<Record<YouTubeListName, { at: string; via: "account" | "takeout"; count: number }>>;
	searches: string[];
	/** A model is set: searches can be written and a pick prepared. */
	canSearch: boolean;
	/** Videos checked so far, and how many of them are offered. */
	checked: number;
	offered: number;
}
