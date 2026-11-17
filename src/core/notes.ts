import { decodeEntities, formatClock, isSpotifyId, parseVideoUrl, videoUrl } from "./watch.ts";

export interface NoteLink {
	url: string;
	title?: string;
	site?: string;
	description?: string;
	/** An https picture, or /api/notes/image?f=<file> for one kept in data/. */
	image?: string;
	/** The site's own icon, kept like the picture. */
	icon?: string;
	/** Set when the link is a YouTube video, which can play beside the note. */
	videoId?: string;
}

export interface Note {
	id: string;
	title?: string;
	body: string;
	links?: NoteLink[];
	createdAt: string;
	updatedAt: string;
}

export const MAX_NOTE_CHARS = 20_000;
export const MAX_NOTE_TITLE = 200;
export const MAX_NOTE_LINKS = 20;
const MAX_LINK_CHARS = 2048;

export interface NoteMoment {
	sec: number;
	/** The rest of the line the stamp sits on. */
	text: string;
}

const STAMP = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\](?!\()/g;

/** A mention in a note's Markdown: `@[Title](https://…)`. A plain Markdown link stays `[text](https://…)`. */
export const MENTION = /@\[((?:\\.|[^\]\\\n])*)\]\((https?:\/\/[^\s)]+)\)/g;

export function mentionMarkdown(title: string, url: string): string {
	return `@[${title.replace(/[\\\]]/g, (c) => `\\${c}`).replace(/\n/g, " ")}](${url.replace(/\)/g, "%29")})`;
}

/** The words of a note's Markdown without its markup: a mention or a link reads as its title. */
export function plainText(markdown: string): string {
	return markdown
		.replace(MENTION, (_, title: string) => title.replace(/\\(.)/g, "$1"))
		.replace(/!?\[([^\]\n]*)\]\((?:[^)\s]+)\)/g, "$1")
		.replace(/(\*\*|__|~~|`)/g, "")
		.replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
		.replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, "$1");
}

const plainLine = (line: string) =>
	plainText(line)
		.replace(STAMP, "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^(?:[-*•]|#+)\s*/, "");

export function noteWords(markdown: string): number {
	const text = plainText(markdown).replace(STAMP, " ").trim();
	return text ? text.split(/\s+/).length : 0;
}

export function stampFor(sec: number): string {
	return `[${formatClock(sec)}]`;
}

export function noteMoments(body: string): NoteMoment[] {
	const moments: NoteMoment[] = [];
	for (const line of body.split("\n")) {
		for (const m of line.matchAll(STAMP)) {
			const [h, min, s] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])];
			if (s > 59 || (m[1] !== undefined && min > 59)) continue;
			moments.push({ sec: h * 3600 + min * 60 + s, text: plainLine(line) });
		}
	}
	return moments;
}

/** The YouTube video that plays beside the note: its first YouTube link. */
export function noteVideo(note: Pick<Note, "links">): NoteLink | undefined {
	return note.links?.find((l) => l.videoId);
}

export function noteHeading(note: Pick<Note, "title" | "body" | "links">): string {
	if (note.title?.trim()) return note.title.trim();
	const first = note.body.split("\n").map(plainLine).find(Boolean);
	return first ?? note.links?.[0]?.title ?? "Untitled note";
}

/** A pasted link as the note keeps it: a YouTube video in its watch form, anything else as plain http(s). */
export function normalizeLink(raw: string): Pick<NoteLink, "url" | "videoId"> | null {
	const s = raw.trim();
	if (!s || s.length > MAX_LINK_CHARS || /\s/.test(s)) return null;
	const video = parseVideoUrl(s);
	if (video && !isSpotifyId(video) && s !== video) return { url: videoUrl(video), videoId: video };
	let url: URL;
	try {
		url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
	} catch {
		return null;
	}
	if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
	if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
	return { url: url.toString() };
}

/** The one link in a paste, or null when the paste is anything more than a link. */
export function pastedLink(text: string): string | null {
	const s = text.trim();
	return /^https?:\/\/\S+$/i.test(s) && normalizeLink(s) ? s : null;
}

export type NoteLinksInput =
	| { ok: true; links: Array<Pick<NoteLink, "url" | "videoId">> }
	| { ok: false; message: string };

export function parseNoteLinks(raw: unknown): NoteLinksInput {
	if (!Array.isArray(raw)) return { ok: false, message: "links must be a list" };
	const links: Array<Pick<NoteLink, "url" | "videoId">> = [];
	for (const item of raw) {
		const link = typeof item === "string" ? normalizeLink(item) : null;
		if (!link) return { ok: false, message: "That is not a link." };
		if (!links.some((l) => l.url === link.url)) links.push(link);
	}
	if (links.length > MAX_NOTE_LINKS) return { ok: false, message: `A note holds up to ${MAX_NOTE_LINKS} links.` };
	return { ok: true, links };
}

export function parseNoteTitle(raw: unknown): { ok: true; title: string } | { ok: false; message: string } {
	if (typeof raw !== "string") return { ok: false, message: "title must be text" };
	const title = raw.replace(/\s+/g, " ").trim();
	if (title.length > MAX_NOTE_TITLE) return { ok: false, message: `A title holds up to ${MAX_NOTE_TITLE} characters.` };
	return { ok: true, title };
}

export function parseNoteBody(raw: unknown): { ok: true; body: string } | { ok: false; message: string } {
	if (typeof raw !== "string") return { ok: false, message: "body must be text" };
	const body = raw.replace(/\r\n/g, "\n");
	if (body.length > MAX_NOTE_CHARS) return { ok: false, message: `A note holds up to ${MAX_NOTE_CHARS} characters.` };
	return { ok: true, body };
}

export interface PageMeta {
	title?: string;
	site?: string;
	description?: string;
	/** Absolute http(s) address of the preview picture. */
	image?: string;
	/** Absolute http(s) address of the site's icon: a touch icon first (the biggest), then the plain icon, then /favicon.ico. */
	icon?: string;
}

function absoluteHttp(raw: string | undefined, base: string): string | undefined {
	if (!raw) return undefined;
	try {
		const u = new URL(raw, base);
		return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
	} catch {
		return undefined;
	}
}

const ATTR = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function attrsOf(tag: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const m of tag.matchAll(ATTR)) out[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
	return out;
}

const tidy = (s: string | undefined, max: number) => {
	const t = s?.replace(/\s+/g, " ").trim();
	if (!t) return undefined;
	return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** What a page says about itself for a link preview: Open Graph first (ogp.me), then Twitter cards, then plain HTML. */
export function pageMeta(html: string, pageUrl: string): PageMeta {
	const head = html.slice(0, 300_000);
	const meta: Record<string, string> = {};
	for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
		const a = attrsOf(m[0]);
		const key = (a.property ?? a.name ?? "").toLowerCase();
		if (key && a.content && !(key in meta)) meta[key] = a.content;
	}
	const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
	const image = absoluteHttp(
		meta["og:image:secure_url"] ?? meta["og:image"] ?? meta["og:image:url"] ?? meta["twitter:image"],
		pageUrl,
	);
	const icons: Record<string, string> = {};
	for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
		const a = attrsOf(m[0]);
		const rel = (a.rel ?? "").toLowerCase();
		if (!a.href || /\.svg(\?|$)/i.test(a.href) || a.type === "image/svg+xml") continue;
		for (const kind of ["apple-touch-icon", "icon"])
			if (rel.split(/\s+/).includes(kind) && !icons[kind]) icons[kind] = a.href;
	}
	const icon = absoluteHttp(icons["apple-touch-icon"] ?? icons.icon ?? "/favicon.ico", pageUrl);
	let host: string | undefined;
	try {
		host = new URL(pageUrl).hostname.replace(/^www\./, "");
	} catch {}
	return {
		title: tidy(meta["og:title"] ?? meta["twitter:title"] ?? (titleTag ? decodeEntities(titleTag) : undefined), 300),
		site: tidy(meta["og:site_name"], 80) ?? host,
		description: tidy(meta["og:description"] ?? meta["twitter:description"] ?? meta.description, 300),
		image,
		icon,
	};
}
