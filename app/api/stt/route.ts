/**
 * POST /api/stt — one recording in, its transcript out (src/server/speak.ts
 * transcribe: ElevenLabs Scribe, else Deepgram, in the active language).
 * The body is the audio itself (Content-Type audio/webm, audio/ogg…) or
 * multipart with the clip as `audio`. GET /api/stt — which engine would
 * answer, or null. The recording is not kept here: the Speak task keeps
 * the learner's lines with the scene (POST /api/speak turn).
 */

import { sttEngine, STT_MAX_BYTES, transcribe } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ engine: sttEngine() });
}

export async function POST(req: Request) {
	const type = req.headers.get("content-type") ?? "";
	let data: Uint8Array;
	let mime = type.split(";")[0]!.trim();
	try {
		if (type.startsWith("multipart/form-data")) {
			const file = (await req.formData()).get("audio");
			if (!(file instanceof Blob)) return Response.json({ message: "audio is required" }, { status: 400 });
			mime = file.type || "audio/webm";
			data = new Uint8Array(await file.arrayBuffer());
		} else data = new Uint8Array(await req.arrayBuffer());
	} catch {
		return Response.json({ message: "bad request" }, { status: 400 });
	}
	if (data.byteLength === 0) return Response.json({ message: "audio is required" }, { status: 400 });
	if (data.byteLength > STT_MAX_BYTES) return Response.json({ message: "the recording is too long" }, { status: 413 });
	try {
		return Response.json(await transcribe(data, mime || "audio/webm"));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return Response.json({ message }, { status: /No speech-to-text key/.test(message) ? 503 : 502 });
	}
}
