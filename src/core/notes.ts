import { formatClock, isSpotifyId, parseVideoUrl, videoUrl } from "./watch.ts";

export interface NoteVideo {
	id: string;
	url: string;
	title?: string;
}

export interface Note {
	id: string;
	body: string;
	video?: NoteVideo;
	createdAt: string;
	updatedAt: string;
}

export const MAX_NOTE_CHARS = 20_000;

export interface NoteMoment {
	sec: number;
	/** The rest of the line the stamp sits on. */
	text: string;
}

const STAMP = /\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]/g;

const plainLine = (line: string) =>
	line
		.replace(STAMP, "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^(?:[-*•]|#+)\s*/, "");

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

export function noteHeading(note: Pick<Note, "body" | "video">): string {
	const first = note.body.split("\n").map(plainLine).find(Boolean);
	return first ?? note.video?.title ?? "Untitled note";
}

export type NoteVideoInput = { ok: true; video: NoteVideo | null } | { ok: false; message: string };

/** A pasted link becomes the note's video; an empty one unlinks it. */
export function parseNoteVideo(raw: unknown): NoteVideoInput {
	if (raw === null || raw === "") return { ok: true, video: null };
	if (typeof raw !== "string") return { ok: false, message: "video must be a link" };
	const id = parseVideoUrl(raw);
	if (!id || isSpotifyId(id)) return { ok: false, message: "That is not a YouTube link." };
	return { ok: true, video: { id, url: videoUrl(id) } };
}

export function parseNoteBody(raw: unknown): { ok: true; body: string } | { ok: false; message: string } {
	if (typeof raw !== "string") return { ok: false, message: "body must be text" };
	const body = raw.replace(/\r\n/g, "\n");
	if (body.length > MAX_NOTE_CHARS) return { ok: false, message: `A note holds up to ${MAX_NOTE_CHARS} characters.` };
	return { ok: true, body };
}
