/**
 * GET /api/notes — every note, newest first (src/server/notes.ts).
 * POST /api/notes {body?, video?} — a new note; video is a YouTube link.
 * PATCH /api/notes?id= {body?, video?} — change a note; video "" unlinks it.
 * DELETE /api/notes?id= — move a note to notes-trash.jsonl.
 */

import { BODY_LIMITS, bodyTooLarge, createNote, listNotes, removeNote, updateNote } from "@/src/server";

export const dynamic = "force-dynamic";

type NoteBody = { body?: unknown; video?: unknown } | null;

const idOf = (req: Request) => new URL(req.url).searchParams.get("id")?.slice(0, 64) ?? null;

export async function GET() {
	return Response.json({ notes: listNotes() });
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const out = await createNote((await req.json().catch(() => null)) as NoteBody);
	if (!out.ok) return Response.json({ message: out.message }, { status: out.status });
	return Response.json({ note: out.note });
}

export async function PATCH(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.json);
	if (oversized) return oversized;
	const id = idOf(req);
	if (!id) return Response.json({ message: "id is required" }, { status: 400 });
	const out = await updateNote(id, (await req.json().catch(() => null)) as NoteBody);
	if (!out.ok) return Response.json({ message: out.message }, { status: out.status });
	return Response.json({ note: out.note });
}

export async function DELETE(req: Request) {
	const id = idOf(req);
	if (!id) return Response.json({ message: "id is required" }, { status: 400 });
	if (!removeNote(id)) return Response.json({ message: "No such note" }, { status: 404 });
	return Response.json({ ok: true });
}
