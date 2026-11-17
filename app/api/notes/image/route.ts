/** GET /api/notes/image?f=<file> — a preview picture kept for a note's link (src/store/notes.ts). */

import { noteImage } from "@/src/server";

export async function GET(req: Request) {
	const found = noteImage(new URL(req.url).searchParams.get("f") ?? "");
	if (!found) return new Response(null, { status: 404 });
	return new Response(new Uint8Array(found.bytes), {
		headers: { "content-type": found.type, "cache-control": "private, max-age=31536000, immutable" },
	});
}
