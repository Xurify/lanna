import crypto from "node:crypto";
import { safeFetch } from "../agent/safe-fetch.ts";
import {
	normalizeLink,
	pageMeta,
	parseNoteBody,
	parseNoteLinks,
	parseNoteTitle,
	type Note,
	type NoteLink,
} from "../core/notes.ts";
import { notesStore, NOTE_IMAGE_TYPES } from "../store/notes.ts";
import { videoStore } from "../store/videos.ts";

export type LinkLookup = (link: Pick<NoteLink, "url" | "videoId">) => Promise<NoteLink>;

const BROWSER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const PAGE_MAX_BYTES = 1_000_000;
const IMAGE_MAX_BYTES = 3_000_000;
const LOOKUP_TIMEOUT_MS = 6000;

async function youTubeCard(link: Pick<NoteLink, "url" | "videoId">): Promise<NoteLink> {
	const card: NoteLink = {
		...link,
		site: "YouTube",
		image: `https://i.ytimg.com/vi/${link.videoId}/hqdefault.jpg`,
	};
	const kept = videoStore.get(link.videoId!)?.title;
	if (kept) return { ...card, title: kept };
	try {
		// oEmbed needs no key and answers for any public video (oembed.com).
		const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link.url)}`, {
			signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
		});
		if (!res.ok) return card;
		const body = (await res.json()) as { title?: unknown; author_name?: unknown };
		return {
			...card,
			...(typeof body.title === "string" ? { title: body.title.slice(0, 300) } : {}),
			...(typeof body.author_name === "string" ? { description: body.author_name.slice(0, 120) } : {}),
		};
	} catch {
		return card;
	}
}

async function keepImage(url: string): Promise<string | undefined> {
	try {
		const res = await safeFetch(url, {
			headers: { "User-Agent": BROWSER_AGENT, Accept: "image/*" },
			timeoutMs: LOOKUP_TIMEOUT_MS,
			maxBytes: IMAGE_MAX_BYTES,
		});
		const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
		const ext = NOTE_IMAGE_TYPES[type];
		if (!res.ok || !ext) return undefined;
		const bytes = Buffer.from(await res.arrayBuffer());
		const file = `${crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 24)}.${ext}`;
		notesStore.putImage(file, bytes);
		return `/api/notes/image?f=${file}`;
	} catch {
		return undefined;
	}
}

async function webCard(link: Pick<NoteLink, "url">): Promise<NoteLink> {
	let host = link.url;
	try {
		host = new URL(link.url).hostname.replace(/^www\./, "");
	} catch {}
	try {
		const res = await safeFetch(link.url, {
			headers: { "User-Agent": BROWSER_AGENT, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" },
			timeoutMs: LOOKUP_TIMEOUT_MS,
			maxBytes: PAGE_MAX_BYTES,
		});
		if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return { url: link.url, site: host };
		const meta = pageMeta(await res.text(), res.url || link.url);
		const [image, icon] = await Promise.all([
			meta.image ? keepImage(meta.image) : undefined,
			meta.icon ? keepImage(meta.icon) : undefined,
		]);
		return {
			url: link.url,
			...(meta.title ? { title: meta.title } : {}),
			site: meta.site ?? host,
			...(meta.description ? { description: meta.description } : {}),
			...(image ? { image } : {}),
			...(icon ? { icon } : {}),
		};
	} catch {
		return { url: link.url, site: host };
	}
}

/** A link's card: YouTube's own title and picture for a video, the page's preview tags for anything else. */
export const lookUpLink: LinkLookup = async (link) => {
	if (process.env.NODE_ENV === "test") return { ...link };
	if (!link.videoId) return webCard(link);
	const [card, icon] = await Promise.all([youTubeCard(link), keepImage("https://www.youtube.com/favicon.ico")]);
	return icon ? { ...card, icon } : card;
};

/** The card for a link, from link-previews.json when it was looked up before. */
async function cardFor(wanted: Pick<NoteLink, "url" | "videoId">, lookUp: LinkLookup): Promise<NoteLink> {
	const kept = notesStore.previews()[wanted.url];
	if (kept) {
		const { at: _at, ...card } = kept;
		return card;
	}
	const card = await lookUp(wanted);
	if (card.title || card.image || card.icon) notesStore.putPreview(card, new Date().toISOString());
	return card;
}

/** The card for one pasted link, for a mention; null when it is not a link. */
export async function previewLink(raw: string, lookUp: LinkLookup = lookUpLink): Promise<NoteLink | null> {
	const wanted = normalizeLink(raw);
	return wanted ? cardFor(wanted, lookUp) : null;
}

const newestFirst = (notes: Note[]) => [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export function listNotes(): Note[] {
	return newestFirst(notesStore.read().notes);
}

type Result = { ok: true; note: Note } | { ok: false; status: number; message: string };

type NoteChange = { title?: unknown; body?: unknown; links?: unknown } | null;

interface ParsedChange {
	title?: string;
	body?: string;
	links?: Array<Pick<NoteLink, "url" | "videoId">>;
}

function parseChange(change: NoteChange): { ok: true; parsed: ParsedChange } | { ok: false; message: string } {
	const parsed: ParsedChange = {};
	if (change?.body !== undefined) {
		const text = parseNoteBody(change.body);
		if (!text.ok) return text;
		parsed.body = text.body;
	}
	if (change?.title !== undefined) {
		const heading = parseNoteTitle(change.title);
		if (!heading.ok) return heading;
		parsed.title = heading.title;
	}
	if (change?.links !== undefined) {
		const links = parseNoteLinks(change.links);
		if (!links.ok) return links;
		parsed.links = links.links;
	}
	return { ok: true, parsed };
}

/** Cards for the links, reusing the ones the note already has so a link is looked up once. */
async function cardsFor(
	wanted: Array<Pick<NoteLink, "url" | "videoId">>,
	before: NoteLink[] | undefined,
	lookUp: LinkLookup,
): Promise<NoteLink[]> {
	return Promise.all(wanted.map((w) => before?.find((b) => b.url === w.url) ?? cardFor(w, lookUp)));
}

function applied(note: Note, parsed: ParsedChange, links: NoteLink[] | undefined, at: string): Note {
	const next: Note = { ...note, updatedAt: at };
	if (parsed.body !== undefined) next.body = parsed.body;
	if (parsed.title !== undefined) {
		if (parsed.title) next.title = parsed.title;
		else delete next.title;
	}
	if (links !== undefined) {
		if (links.length) next.links = links;
		else delete next.links;
	}
	return next;
}

export async function createNote(
	change: NoteChange,
	now = new Date(),
	lookUp: LinkLookup = lookUpLink,
): Promise<Result> {
	const out = parseChange(change);
	if (!out.ok) return { ok: false, status: 400, message: out.message };
	const links = out.parsed.links ? await cardsFor(out.parsed.links, undefined, lookUp) : undefined;
	const at = now.toISOString();
	const note = applied({ id: crypto.randomUUID(), body: "", createdAt: at, updatedAt: at }, out.parsed, links, at);
	const file = notesStore.read();
	file.notes.push(note);
	notesStore.write(file);
	return { ok: true, note };
}

export async function updateNote(
	id: string,
	change: NoteChange,
	now = new Date(),
	lookUp: LinkLookup = lookUpLink,
): Promise<Result> {
	const out = parseChange(change);
	if (!out.ok) return { ok: false, status: 400, message: out.message };
	const before = notesStore.read().notes.find((n) => n.id === id);
	if (!before) return { ok: false, status: 404, message: "No such note" };
	const links = out.parsed.links ? await cardsFor(out.parsed.links, before.links, lookUp) : undefined;
	const file = notesStore.read();
	const at = file.notes.findIndex((n) => n.id === id);
	if (at < 0) return { ok: false, status: 404, message: "No such note" };
	const note = applied(file.notes[at]!, out.parsed, links, now.toISOString());
	file.notes[at] = note;
	notesStore.write(file);
	return { ok: true, note };
}

export function removeNote(id: string, now = new Date()): boolean {
	const file = notesStore.read();
	const gone = file.notes.find((n) => n.id === id);
	if (!gone) return false;
	notesStore.trash(gone, now.toISOString());
	notesStore.write({ notes: file.notes.filter((n) => n.id !== id) });
	return true;
}

export function noteImage(file: string): { bytes: Buffer; type: string } | null {
	return notesStore.image(file);
}
