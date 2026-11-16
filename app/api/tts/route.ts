/**
 * GET /api/tts?text=…&lang=sk|ru[&voice=female|male|<voice id>][&gender=female|male][&style=narration|dialogue][&skip=elevenlabs] —
 * speech for a word or sentence (src/server/tts.ts: ElevenLabs → Edge →
 * Piper, cached on disk). 200 = audio; 204 + x-tts-fallback: browser =
 * no tier worked, speak it with window.speechSynthesis.
 */

import fs from "node:fs";
import { synthesize, TTS_MAX_CHARS, ttsTiers, ttsVoice, type TtsTier } from "@/src/server";

export const dynamic = "force-dynamic";

const TIERS = new Set<TtsTier>(["elevenlabs", "edge", "piper"]);

export async function GET(req: Request) {
	const url = new URL(req.url);
	if (url.searchParams.get("status") !== null) return Response.json({ tiers: ttsTiers() });
	const text = (url.searchParams.get("text") ?? "").trim();
	const lang = url.searchParams.get("lang") ?? "sk";
	const voice = ttsVoice(url.searchParams.get("voice"));
	const gender = url.searchParams.get("gender") === "male" ? "male" : "female";
	const style = url.searchParams.get("style") === "dialogue" ? "dialogue" : "narration";
	const skip = (url.searchParams.get("skip") ?? "").split(",").filter((t): t is TtsTier => TIERS.has(t as TtsTier));
	if (!text) return Response.json({ message: "text is required" }, { status: 400 });
	if (text.length > TTS_MAX_CHARS)
		return Response.json({ message: `text is longer than ${TTS_MAX_CHARS} characters` }, { status: 413 });
	try {
		const clip = await synthesize({ text, lang, voice, gender, style, skip });
		if (!clip) return new Response(null, { status: 204, headers: { "x-tts-fallback": "browser" } });
		const data = fs.readFileSync(clip.file);
		return new Response(new Uint8Array(data), {
			headers: {
				"content-type": clip.contentType,
				"content-length": String(data.length),
				"cache-control": "private, max-age=31536000, immutable",
				"x-tts-tier": clip.tier,
			},
		});
	} catch (err) {
		return Response.json({ message: err instanceof Error ? err.message : String(err) }, { status: 400 });
	}
}
