/**
 * POST /api/pronounce — one recording in (multipart: `audio`, `reference`
 * the line expected, optional `heard` transcript), its pronunciation
 * score out (src/server/pronounce.ts: Azure Speech sound by sound, else
 * intelligibility from speech-to-text). GET /api/pronounce — the engine
 * that would answer, or null, and what to work on lately.
 */

import { assess, BODY_LIMITS, bodyTooLarge, pronounceEngine, pronunciationReport, STT_MAX_BYTES } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ engine: pronounceEngine(), report: pronunciationReport() });
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.recording);
	if (oversized) return oversized;
	let form: FormData;
	try {
		form = await req.formData();
	} catch {
		return Response.json({ message: "multipart form with audio is required" }, { status: 400 });
	}
	const file = form.get("audio");
	if (!(file instanceof Blob) || file.size === 0)
		return Response.json({ message: "audio is required" }, { status: 400 });
	if (file.size > STT_MAX_BYTES) return Response.json({ message: "the recording is too long" }, { status: 413 });
	const reference = typeof form.get("reference") === "string" ? (form.get("reference") as string).slice(0, 600) : "";
	const heardRaw = form.get("heard");
	const heard = typeof heardRaw === "string" && heardRaw.trim() ? heardRaw.slice(0, 600) : undefined;
	try {
		const score = await assess({ audio: new Uint8Array(await file.arrayBuffer()), reference, heard });
		return Response.json({ score, engine: pronounceEngine() });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return Response.json({ message }, { status: /No way to score|No speech-to-text key/.test(message) ? 503 : 502 });
	}
}
