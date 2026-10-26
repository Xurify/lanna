/**
 * Speech synthesis (LangHarness, spec D4 / WF-03) — the four-tier cascade
 * behind GET /api/tts:
 *
 *   1. ElevenLabs   ELEVENLABS_API_KEY set (auth.json / .env.local).
 *                   Voice: ELEVENLABS_VOICE_ID_<SK|RU> → ELEVENLABS_VOICE_ID
 *                   → the slovak.wiki narrator voice (Slovak only).
 *   2. Edge         Microsoft's neural voices through msedge-tts — free,
 *                   no key, pure Node (works on Windows without Python).
 *   3. Piper        a local binary: PIPER_PATH + PIPER_MODEL_<SK|RU>
 *                   (.onnx). Fully offline.
 *   4. Browser      nothing above worked → 204 + "x-tts-fallback: browser";
 *                   the client speaks with window.speechSynthesis.
 *
 * Every synthesized clip is cached under <data>/cache/audio/<sha256>.<ext>
 * keyed by (language, voice preference, text), so a sentence is paid for
 * once and replays offline. Playback speed is the client's job
 * (HTMLAudioElement.playbackRate) and never splits the cache.
 */

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { languageByCode, type LanguageInfo } from "../core/language.ts";
import { keyValue } from "./keys.ts";

export type TtsTier = "elevenlabs" | "edge" | "piper";

export interface TtsRequest {
	text: string;
	/** "sk" | "ru" */
	lang: string;
	/** "female" | "male" — picks among the language's voices. */
	voice?: "female" | "male";
	/** Skip tiers (e.g. ["elevenlabs"] to save credits). */
	skip?: TtsTier[];
}

export interface TtsClip {
	file: string;
	contentType: string;
	tier: TtsTier | "cache";
}

export const TTS_MAX_CHARS = 600;

/** The slovak.wiki narrator voice ("Slovak Wiki Dictionary Neutral"). */
const DEFAULT_ELEVENLABS_VOICE: Record<string, string> = { sk: "YJsJ2Mt3VRr0gCiTY6DA" };

const EXT_TYPES: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav" };

export function ttsCacheKey(req: TtsRequest): string {
	const text = req.text.normalize("NFC").trim();
	return crypto.createHash("sha256").update(`${req.lang}\u0000${req.voice ?? "female"}\u0000${text}`).digest("hex");
}

function cached(key: string): TtsClip | null {
	for (const ext of Object.keys(EXT_TYPES)) {
		const file = path.join(PATHS.audioCache, `${key}.${ext}`);
		if (fs.existsSync(file) && fs.statSync(file).size > 0) return { file, contentType: EXT_TYPES[ext] ?? "audio/mpeg", tier: "cache" };
	}
	return null;
}

function store(key: string, ext: "mp3" | "wav", data: Buffer): string {
	fs.mkdirSync(PATHS.audioCache, { recursive: true });
	const file = path.join(PATHS.audioCache, `${key}.${ext}`);
	const tmp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(tmp, data);
	fs.renameSync(tmp, file);
	return file;
}

function envFor(name: string, code: string): string | undefined {
	return process.env[`${name}_${code.toUpperCase()}`] || process.env[name] || undefined;
}

async function elevenLabs(req: TtsRequest, lang: LanguageInfo): Promise<Buffer | null> {
	const key = keyValue("ELEVENLABS_API_KEY");
	if (!key) return null;
	const voice = envFor("ELEVENLABS_VOICE_ID", lang.code) ?? DEFAULT_ELEVENLABS_VOICE[lang.code];
	if (!voice) return null;
	const model = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
	const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
		method: "POST",
		headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
		body: JSON.stringify({
			text: req.text,
			model_id: model,
			// Only some models accept language_code; multilingual_v2 infers it.
			...(model.includes("flash") || model.includes("turbo") ? { language_code: lang.code } : {}),
			voice_settings: { stability: 0.65, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
		}),
		signal: AbortSignal.timeout(20_000),
	});
	if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
	return Buffer.from(await res.arrayBuffer());
}

async function edge(req: TtsRequest, lang: LanguageInfo): Promise<Buffer | null> {
	const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
	const voice = lang.edgeVoices[req.voice === "male" ? 1 : 0] ?? lang.edgeVoices[0];
	if (!voice) return null;
	const tts = new MsEdgeTTS();
	try {
		await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
		const { audioStream } = tts.toStream(escapeXml(req.text));
		const chunks: Buffer[] = [];
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error("Edge TTS timed out")), 20_000);
			audioStream.on("data", (c: Buffer) => chunks.push(c));
			audioStream.on("end", () => {
				clearTimeout(timer);
				resolve();
			});
			audioStream.on("error", (e: Error) => {
				clearTimeout(timer);
				reject(e);
			});
		});
		const audio = Buffer.concat(chunks);
		return audio.length > 0 ? audio : null;
	} finally {
		tts.close();
	}
}

async function piper(req: TtsRequest, lang: LanguageInfo): Promise<Buffer | null> {
	const bin = process.env.PIPER_PATH;
	const model = envFor("PIPER_MODEL", lang.code);
	if (!bin || !model) return null;
	const out = path.join(os.tmpdir(), `lh-piper-${process.pid}-${Date.now()}.wav`);
	await new Promise<void>((resolve, reject) => {
		const child = spawn(bin, ["--model", model, "--output_file", out], { stdio: ["pipe", "ignore", "pipe"] });
		let err = "";
		child.stderr.on("data", (d) => (err += String(d)));
		child.on("error", reject);
		child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`piper exited ${code}: ${err.slice(-200)}`))));
		child.stdin.end(req.text);
	});
	try {
		return fs.readFileSync(out);
	} finally {
		fs.rmSync(out, { force: true });
	}
}

function escapeXml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TIERS: Array<{ tier: TtsTier; ext: "mp3" | "wav"; run: (req: TtsRequest, lang: LanguageInfo) => Promise<Buffer | null> }> = [
	{ tier: "elevenlabs", ext: "mp3", run: elevenLabs },
	{ tier: "edge", ext: "mp3", run: edge },
	{ tier: "piper", ext: "wav", run: piper },
];

/** Cached clip, or the first tier that succeeds; null = use the browser. */
export async function synthesize(req: TtsRequest): Promise<TtsClip | null> {
	const lang = languageByCode(req.lang);
	if (!lang) throw new Error(`unsupported language "${req.lang}"`);
	const key = ttsCacheKey(req);
	const hit = cached(key);
	if (hit) return hit;
	for (const { tier, ext, run } of TIERS) {
		if (req.skip?.includes(tier)) continue;
		try {
			const audio = await run(req, lang);
			if (audio && audio.length > 0) return { file: store(key, ext, audio), contentType: EXT_TYPES[ext] ?? "audio/mpeg", tier };
		} catch (err) {
			console.warn(`[tts] ${tier} failed, falling through:`, err instanceof Error ? err.message : err);
		}
	}
	return null;
}

/** Which tiers are configured right now (the settings/status readout). */
export function ttsTiers(): Record<TtsTier, boolean> {
	return {
		elevenlabs: !!keyValue("ELEVENLABS_API_KEY"),
		edge: true,
		piper: !!process.env.PIPER_PATH && (!!process.env.PIPER_MODEL_SK || !!process.env.PIPER_MODEL),
	};
}
