/**
 * POST /api/stt — one recording in (multipart with the clip as `audio`), its
 * transcript out (src/server/speak.ts transcribe: ElevenLabs Scribe, else
 * Deepgram, in the active language, or in `lang` when the form names one.
 * The recording is a 16 kHz mono WAV, the one format the recorder keeps. GET /api/stt — which engine would
 * answer, or null. The recording is not kept here: the Speak task keeps
 * the learner's lines with the scene (POST /api/speak turn).
 */

import { BODY_LIMITS, bodyTooLarge, STT_MAX_BYTES, sttEngine, transcribe } from "@/src/server";

export const dynamic = "force-dynamic";

export async function GET() {
	return Response.json({ engine: sttEngine() });
}

export async function POST(req: Request) {
	const oversized = bodyTooLarge(req, BODY_LIMITS.recording);
	if (oversized) return oversized;
	const type = req.headers.get("content-type") ?? "";
	let data: Uint8Array;
	let lang: string | undefined;
	try {
		if (type.startsWith("multipart/form-data")) {
			const form = await req.formData();
			const file = form.get("audio");
			if (!(file instanceof Blob)) return Response.json({ message: "audio is required" }, { status: 400 });
			const asked = form.get("lang");
			if (typeof asked === "string" && /^[a-z]{2,3}$/.test(asked)) lang = asked;
			data = new Uint8Array(await file.arrayBuffer());
		} else data = new Uint8Array(await req.arrayBuffer());
	} catch {
		return Response.json({ message: "bad request" }, { status: 400 });
	}
	if (data.byteLength === 0) return Response.json({ message: "audio is required" }, { status: 400 });
	if (data.byteLength > STT_MAX_BYTES) return Response.json({ message: "the recording is too long" }, { status: 413 });
	try {
		return Response.json(await transcribe(data, lang));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return Response.json({ message }, { status: /No speech-to-text key/.test(message) ? 503 : 502 });
	}
}
