import crypto from "node:crypto";
import { parseNoteBody, parseNoteVideo, type Note, type NoteVideo } from "../core/notes.ts";
import { notesStore } from "../store/notes.ts";
import { videoStore } from "../store/videos.ts";

export type TitleLookup = (video: NoteVideo) => Promise<string | undefined>;

/** The title from the Media library when the video is there, else YouTube's oEmbed, which needs no key. */
export const lookUpTitle: TitleLookup = async (video) => {
	const kept = videoStore.get(video.id)?.title;
	if (kept) return kept;
	if (process.env.NODE_ENV === "test") return undefined;
	try {
		const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(video.url)}`, {
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) return undefined;
		const body = (await res.json()) as { title?: unknown };
		return typeof body.title === "string" ? body.title.slice(0, 300) : undefined;
	} catch {
		return undefined;
	}
};

const newestFirst = (notes: Note[]) => [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export function listNotes(): Note[] {
	return newestFirst(notesStore.read().notes);
}

type Result = { ok: true; note: Note } | { ok: false; status: number; message: string };

async function withTitle(video: NoteVideo | null, before: NoteVideo | undefined, lookUp: TitleLookup) {
	if (!video) return undefined;
	if (before?.id === video.id) return before;
	const title = await lookUp(video);
	return title ? { ...video, title } : video;
}

export async function createNote(
	body: { body?: unknown; video?: unknown } | null,
	now = new Date(),
	lookUp: TitleLookup = lookUpTitle,
): Promise<Result> {
	const text = parseNoteBody(body?.body ?? "");
	if (!text.ok) return { ok: false, status: 400, message: text.message };
	const link = parseNoteVideo(body?.video ?? null);
	if (!link.ok) return { ok: false, status: 400, message: link.message };
	const at = now.toISOString();
	const video = await withTitle(link.video, undefined, lookUp);
	const note: Note = {
		id: crypto.randomUUID(),
		body: text.body,
		...(video ? { video } : {}),
		createdAt: at,
		updatedAt: at,
	};
	const file = notesStore.read();
	file.notes.push(note);
	notesStore.write(file);
	return { ok: true, note };
}

export async function updateNote(
	id: string,
	body: { body?: unknown; video?: unknown } | null,
	now = new Date(),
	lookUp: TitleLookup = lookUpTitle,
): Promise<Result> {
	const file = notesStore.read();
	const at = file.notes.findIndex((n) => n.id === id);
	if (at < 0) return { ok: false, status: 404, message: "No such note" };
	const note = { ...file.notes[at]! };
	if (body?.body !== undefined) {
		const text = parseNoteBody(body.body);
		if (!text.ok) return { ok: false, status: 400, message: text.message };
		note.body = text.body;
	}
	if (body?.video !== undefined) {
		const link = parseNoteVideo(body.video);
		if (!link.ok) return { ok: false, status: 400, message: link.message };
		const video = await withTitle(link.video, note.video, lookUp);
		if (video) note.video = video;
		else delete note.video;
	}
	note.updatedAt = now.toISOString();
	const fresh = notesStore.read();
	const still = fresh.notes.findIndex((n) => n.id === id);
	if (still < 0) return { ok: false, status: 404, message: "No such note" };
	fresh.notes[still] = note;
	notesStore.write(fresh);
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
