/**
 * Speech synthesis (LangHarness, spec D4 / WF-03) — the four-tier cascade
 * behind GET /api/tts. Before it: slovak.wiki's own clip for a dictionary
 * word or example (wiki-audio.ts), free, kept on first use.
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
 * Every synthesized clip is KEPT under <data>/audio/<lang>/<voice>/
 * <slug>-<key>.mp3 and listed in <data>/audio/index.jsonl (text, voice,
 * tier, date — src/store/corpus.ts), keyed by (language, voice preference,
 * text), so a sentence is paid for once, replays offline, and stays
 * reusable outside the app. Playback speed is the client's job
 * (HTMLAudioElement.playbackRate) and never splits the key. Clips from
 * the pre-index location (<data>/cache/audio/<sha256>.mp3) are moved into
 * the tree on the first request, their texts recovered by hashing every
 * phrase the app could have spoken.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ACTIVE_PROFILE } from "../../config.ts";
import { loadLexicon } from "../agent/lexicon.ts";
import { languageByCode, LANGUAGES, type LanguageInfo } from "../core/language.ts";
import { entryLemma, exampleText } from "../core/review.ts";
import { chatStore } from "../store/chats.ts";
import { audioKey, findAudioClip, migrateLegacyAudio, storeAudioClip, type MigrationCandidate } from "../store/corpus.ts";
import { reviewStore } from "../store/review.ts";
import { keyValue } from "./keys.ts";
import { wikiClip } from "./wiki-audio.ts";

export type TtsTier = "elevenlabs" | "edge" | "piper";

export interface TtsRequest {
	text: string;
	/** "sk" | "ru" */
	lang: string;
	/** "female" | "male" (the language's default voice of that gender) or
	 *  an ElevenLabs voice id (a story character). Part of the cache key. */
	voice?: string;
	/** The speaker's gender when `voice` is an id: picks the Edge voice
	 *  when ElevenLabs is not available. */
	gender?: "female" | "male";
	/** How to read it: narration (steady) or a line of dialogue (livelier).
	 *  Not part of the cache key. */
	style?: "narration" | "dialogue";
	/** Skip tiers (e.g. ["elevenlabs"] to save credits). */
	skip?: TtsTier[];
}

const VOICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** A voice the request may name: the two gender words or a voice id. */
export function ttsVoice(v: string | null | undefined): string {
	if (v === "male" || v === "female") return v;
	return v && VOICE_ID.test(v) ? v : "female";
}

export interface TtsClip {
	file: string;
	contentType: string;
	tier: TtsTier | "cache" | "wiki";
	/** Playback rate that brings the clip to a normal speaking pace (see
	 *  paceRate); the client multiplies the speed button by it. */
	baseRate?: number;
}

/** Syllables a second at rate 1, the median over the Slovak clips kept in
 *  data/audio (measured 2026-11-01 on speech from the first to the last
 *  sound, pauses between words included). slovak.wiki records slowly (0.88×)
 *  for learners and Edge reads slowly too; ElevenLabs is nearer a native pace. */
const PACE: Record<string, number> = { wiki: 4.55, "slovak-wiki": 4.55, edge: 4.55, elevenlabs: 5 };
/** The same, for story-character voices (an ElevenLabs id, or Edge by gender). */
const PACE_CHARACTER = 5.7;
/** A normal conversational pace. The owner heard 1× as slow and 1.25× as
 *  normal; 1.25 × the old wiki rate is 6.5, so 6 sits just under it. */
const PACE_TARGET = 6;

/** The playback rate that makes a clip sound like a normal speaker, whichever
 *  voice made it. Only measured for Slovak; other languages and unknown
 *  sources play as recorded. */
export function paceRate(lang: string, tier: string, voice: string | undefined): number {
	if (lang !== "sk") return 1;
	const gendered = voice === undefined || voice === "female" || voice === "male";
	const pace = gendered ? PACE[tier] : tier === "elevenlabs" || tier === "edge" ? PACE_CHARACTER : undefined;
	return pace ? Math.round((PACE_TARGET / pace) * 1000) / 1000 : 1;
}

export const TTS_MAX_CHARS = 600;

/** The slovak.wiki narrator voice ("Slovak Wiki Dictionary Neutral"). */
const DEFAULT_ELEVENLABS_VOICE: Record<string, string> = { sk: "YJsJ2Mt3VRr0gCiTY6DA" };

const EXT_TYPES: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav" };

export function ttsCacheKey(req: TtsRequest): string {
	return audioKey(req.lang, req.voice ?? "female", req.text);
}

const SAY_SPAN = /`say:\s*([^`]+)`/g;

/**
 * Every phrase the app could have spoken so far — the texts behind the
 * hash-named clips of the old cache: `say:` spans in every chat (both
 * voices), the lexicon's example sentences and lemmas, and the review
 * cards' sentences, for every language with a lexicon.
 */
function* spokenPhrases(): Generator<MigrationCandidate> {
	const voices: Array<"female" | "male"> = ["female", "male"];
	const seen = new Set<string>();
	const emit = function* (lang: string, text: string) {
		const t = text.normalize("NFC").trim();
		if (!t || seen.has(`${lang}\u0000${t}`)) return;
		seen.add(`${lang}\u0000${t}`);
		for (const voice of voices) yield { lang, voice, text: t };
	};
	for (const [profile, info] of Object.entries(LANGUAGES)) {
		const lex = loadLexicon(profile);
		if (!lex) continue;
		for (const e of lex.entries) {
			yield* emit(info.code, entryLemma(e));
			for (const ex of e.examples) if (!ex.rejected) yield* emit(info.code, exampleText(ex));
		}
	}
	const active = LANGUAGES[ACTIVE_PROFILE].code;
	for (const card of Object.values(reviewStore.readCards())) yield* emit(active, card.sentence);
	for (const summary of chatStore.listChats()) {
		const chat = chatStore.getChat(summary.id);
		if (!chat) continue;
		for (const m of chat.messages) {
			const blocks = Array.isArray(m.content) ? m.content : [{ type: "text", text: String(m.content ?? "") }];
			for (const b of blocks as Array<{ type?: string; text?: string }>) {
				if (b.type !== "text" || typeof b.text !== "string") continue;
				for (const match of b.text.matchAll(SAY_SPAN)) yield* emit(active, match[1]!);
			}
		}
	}
}

let migrated = false;

/** Once per process: move the old hash-only cache into the indexed tree. */
export function migrateAudioOnce(): { moved: number; matched: number } | null {
	if (migrated) return null;
	migrated = true;
	try {
		const result = migrateLegacyAudio(spokenPhrases);
		if (result.moved > 0) console.log(`[tts] moved ${result.moved} clips into data/audio (${result.matched} texts recovered)`);
		return result;
	} catch (err) {
		console.warn("[tts] audio migration failed:", err instanceof Error ? err.message : err);
		return null;
	}
}

function cached(key: string, lang: string): TtsClip | null {
	const hit = findAudioClip(key);
	if (!hit) return null;
	const ext = hit.file.endsWith(".wav") ? "wav" : "mp3";
	return { file: hit.absolute, contentType: EXT_TYPES[ext] ?? "audio/mpeg", tier: "cache", baseRate: paceRate(lang, hit.tier, hit.voice) };
}

function envFor(name: string, code: string): string | undefined {
	return process.env[`${name}_${code.toUpperCase()}`] || process.env[name] || undefined;
}

async function elevenLabs(req: TtsRequest, lang: LanguageInfo): Promise<Buffer | null> {
	const key = keyValue("ELEVENLABS_API_KEY");
	if (!key) return null;
	const custom = req.voice && req.voice !== "male" && req.voice !== "female" ? req.voice : undefined;
	const voice = custom ?? envFor("ELEVENLABS_VOICE_ID", lang.code) ?? DEFAULT_ELEVENLABS_VOICE[lang.code];
	if (!voice) return null;
	// A line of speech wants more expression than narration; stability
	// down, style up. Narration keeps the steady slovak.wiki reading.
	const settings = req.style === "dialogue" ? { stability: 0.45, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true } : { stability: 0.65, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true };
	const model = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
	const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
		method: "POST",
		headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
		body: JSON.stringify({
			text: req.text,
			model_id: model,
			// Only some models accept language_code; multilingual_v2 infers it.
			...(model.includes("flash") || model.includes("turbo") ? { language_code: lang.code } : {}),
			voice_settings: settings,
		}),
		signal: AbortSignal.timeout(20_000),
	});
	if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
	return Buffer.from(await res.arrayBuffer());
}

/** The library's default pace (rate 1.0) sounds slower than native Slovak;
 *  +15% brings it up to a little slower than native. */
const EDGE_RATE = "+15%";

async function edge(req: TtsRequest, lang: LanguageInfo): Promise<Buffer | null> {
	const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
	const male = req.voice === "male" || (req.voice !== "female" && req.gender === "male");
	const voice = lang.edgeVoices[male ? 1 : 0] ?? lang.edgeVoices[0];
	if (!voice) return null;
	const tts = new MsEdgeTTS();
	try {
		await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
		const { audioStream } = tts.toStream(escapeXml(req.text), { rate: EDGE_RATE });
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
	migrateAudioOnce();
	// slovak.wiki's own recording beats any clip made here, for the default voice.
	if (lang.code === "sk" && (req.voice === undefined || req.voice === "female")) {
		const wiki = await wikiClip("slovak", lang.code, req.text);
		if (wiki) return { file: wiki.file, contentType: "audio/mpeg", tier: "wiki", baseRate: paceRate(lang.code, "wiki", req.voice) };
	}
	const key = ttsCacheKey(req);
	const hit = cached(key, lang.code);
	if (hit) return hit;
	for (const { tier, ext, run } of TIERS) {
		if (req.skip?.includes(tier)) continue;
		try {
			const audio = await run(req, lang);
			if (audio && audio.length > 0) {
				const stored = storeAudioClip({ key, lang: lang.code, voice: req.voice ?? "female", tier, text: req.text, ext, data: audio });
				return { file: stored.absolute, contentType: EXT_TYPES[ext] ?? "audio/mpeg", tier, baseRate: paceRate(lang.code, tier, req.voice) };
			}
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
