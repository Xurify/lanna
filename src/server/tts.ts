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
import { loadLexicon } from "../agent/lexicon.ts";
import { processWide } from "../core/process-wide.ts";
import { languageByCode, LANGUAGES, type LanguageInfo } from "../core/language.ts";
import { activeLanguage } from "./active-language.ts";
import { entryLemma, exampleText } from "../core/review.ts";
import { chatStore } from "../store/chats.ts";
import {
	audioKey,
	findAudioClip,
	migrateLegacyAudio,
	storeAudioClip,
	type MigrationCandidate,
} from "../store/corpus.ts";
import { reviewStore } from "../store/review.ts";
import { keyValue, redactSecrets } from "./keys.ts";
import { wikiClip } from "./wiki-audio.ts";

export type TtsTier = "elevenlabs" | "edge" | "piper";

interface TtsRequest {
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

interface TtsClip {
	file: string;
	contentType: string;
	tier: TtsTier | "cache" | "wiki";
}

export const TTS_MAX_CHARS = 600;

/** The slovak.wiki narrator voice ("Slovak Wiki Dictionary Neutral"). */
const DEFAULT_ELEVENLABS_VOICE: Record<string, string> = { sk: "YJsJ2Mt3VRr0gCiTY6DA" };

/** The languages ElevenLabs' models read (elevenlabs.io/docs/overview/models,
 *  read 2026-11-07). Multilingual v2 reads 29 and not Estonian; flash v2.5 adds Hungarian, Norwegian and Vietnamese; v3 reads
 *  70+ and v4 90+, both with Estonian. */
const ELEVENLABS_V2 = new Set([
	"en",
	"ja",
	"zh",
	"de",
	"hi",
	"fr",
	"ko",
	"pt",
	"it",
	"es",
	"id",
	"nl",
	"tr",
	"fil",
	"pl",
	"sv",
	"bg",
	"ro",
	"ar",
	"cs",
	"el",
	"fi",
	"hr",
	"ms",
	"sk",
	"da",
	"ta",
	"uk",
	"ru",
]);
const ELEVENLABS_V25 = new Set([...ELEVENLABS_V2, "hu", "no", "nb", "vi"]);
const ELEVENLABS_V3 = new Set([
	"af",
	"ar",
	"hy",
	"as",
	"ast",
	"az",
	"be",
	"bn",
	"bs",
	"bg",
	"my",
	"yue",
	"ca",
	"ceb",
	"ny",
	"hr",
	"cs",
	"da",
	"nl",
	"en",
	"et",
	"fil",
	"fi",
	"fr",
	"gl",
	"ka",
	"de",
	"el",
	"gu",
	"ha",
	"he",
	"hi",
	"hu",
	"is",
	"id",
	"ga",
	"it",
	"ja",
	"jv",
	"kn",
	"kk",
	"ky",
	"ko",
	"lv",
	"ln",
	"lt",
	"lb",
	"mk",
	"ms",
	"ml",
	"mt",
	"zh",
	"mi",
	"mr",
	"mn",
	"ne",
	"no",
	"nb",
	"oc",
	"or",
	"ps",
	"fa",
	"pl",
	"pt",
	"pa",
	"ro",
	"ru",
	"sr",
	"sd",
	"sk",
	"sl",
	"so",
	"es",
	"sw",
	"sv",
	"tg",
	"ta",
	"te",
	"th",
	"tr",
	"uk",
	"ur",
	"uz",
	"vi",
	"cy",
	"yo",
]);
const ELEVENLABS_V4 = new Set([...ELEVENLABS_V3, "am", "ff", "kam", "lg", "ckb", "sn", "wo", "zu"]);

/** The model every language is read with: v4, the newest, unless ELEVENLABS_MODEL_ID names another. */
const DEFAULT_MODEL = "eleven_v4";
/** If the account cannot use the first choice, the next that reads the language. */
const FALLBACK_MODELS = ["eleven_v4", "eleven_v3", "eleven_multilingual_v2"];
/** Clips stored before the model was recorded were made by multilingual v2 (or the configured model). */
const LEGACY_MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

function configuredModel(): string {
	return process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL;
}

export function elevenLabsReads(code: string, model: string = configuredModel()): boolean {
	if (model.includes("v4")) return ELEVENLABS_V4.has(code);
	if (model.includes("v3")) return ELEVENLABS_V3.has(code);
	if (model.includes("flash") || model.includes("turbo")) return ELEVENLABS_V25.has(code);
	return ELEVENLABS_V2.has(code);
}

/** A model the account refused (not on the plan, unknown id) is skipped for
 *  an hour, so every line does not pay a failed call first. */
const refused = processWide("tts.refused", () => new Map<string, number>());
const REFUSED_MS = 3_600_000;

/** The models to try for a language, in order: the configured one, then the
 *  fallbacks, each only if it reads the language and was not refused within
 *  the hour. Empty: ElevenLabs is skipped and Edge reads the line. */
export function elevenLabsModelsFor(code: string, now = Date.now()): string[] {
	return [...new Set([configuredModel(), ...FALLBACK_MODELS])].filter(
		(m) => elevenLabsReads(code, m) && !((refused.get(m) ?? 0) > now),
	);
}

/** What a tier made: the audio, and for ElevenLabs the model that spoke it. */
interface Spoken {
	data: Buffer;
	model?: string;
}

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
	const active = activeLanguage().code;
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
		if (result.moved > 0)
			console.log(`[tts] moved ${result.moved} clips into data/audio (${result.matched} texts recovered)`);
		return result;
	} catch (err) {
		console.warn("[tts] audio migration failed:", err instanceof Error ? err.message : err);
		return null;
	}
}

function cached(key: string, lang: string): TtsClip | null {
	const hit = findAudioClip(key);
	if (!hit) return null;
	// A clip ElevenLabs made with a model that cannot read the language (Estonian
	// read by multilingual v2, before 2026-11-07) is made again. Clips from before
	// the model was recorded were made by the configured model.
	if (hit.tier === "elevenlabs" && !elevenLabsReads(lang, hit.model ?? LEGACY_MODEL)) return null;
	const ext = hit.file.endsWith(".wav") ? "wav" : "mp3";
	return { file: hit.absolute, contentType: EXT_TYPES[ext] ?? "audio/mpeg", tier: "cache" };
}

function envFor(name: string, code: string): string | undefined {
	return process.env[`${name}_${code.toUpperCase()}`] || process.env[name] || undefined;
}

/** The ElevenLabs voice for a clip's voice field: its own id, or the
 *  language's voice for "female" / "male". Undefined: Edge reads it. */
export function elevenLabsVoiceFor(voice: string | undefined, code: string): string | undefined {
	const custom = voice && voice !== "male" && voice !== "female" ? voice : undefined;
	return custom ?? envFor("ELEVENLABS_VOICE_ID", code) ?? DEFAULT_ELEVENLABS_VOICE[code];
}

/** The model new clips are made with when the account allows it. */
export function latestElevenLabsModel(): string {
	return configuredModel();
}

/** One clip from ElevenLabs, past the cache (the regeneration uses it). */
export async function elevenLabs(req: TtsRequest, lang: LanguageInfo): Promise<Spoken | null> {
	const key = keyValue("ELEVENLABS_API_KEY");
	const models = key ? elevenLabsModelsFor(lang.code) : [];
	if (!key || models.length === 0) return null;
	const voice = elevenLabsVoiceFor(req.voice, lang.code);
	if (!voice) return null;
	// A line of speech wants more expression than narration; stability
	// down, style up. Narration keeps the steady slovak.wiki reading.
	const settings =
		req.style === "dialogue"
			? { stability: 0.45, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true }
			: { stability: 0.65, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true };
	let last: Error | null = null;
	for (const model of models) {
		const res = await fetch(
			`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
			{
				method: "POST",
				headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
				body: JSON.stringify({
					text: req.text,
					model_id: model,
					// multilingual v2 does not take language_code and infers the language; the others are told.
					...(model.includes("multilingual") ? {} : { language_code: lang.code }),
					voice_settings: settings,
				}),
				signal: AbortSignal.timeout(20_000),
			},
		);
		if (res.ok) return { data: Buffer.from(await res.arrayBuffer()), model };
		last = new Error(`ElevenLabs ${model} ${res.status}: ${redactSecrets(await res.text()).slice(0, 200)}`);
		// A refusal of the model is remembered; a rate limit or a server hiccup is not.
		if (res.status >= 400 && res.status < 500 && res.status !== 429) refused.set(model, Date.now() + REFUSED_MS);
	}
	throw last ?? new Error("ElevenLabs: no model");
}

/** The library's default pace (rate 1.0) sounds slower than native Slovak;
 *  +15% brings it up to a little slower than native. */
const EDGE_RATE = "+15%";

// Microsoft's service often accepts an Estonian request, sends no audio and
// hangs up after about 3 s (msedge-tts: "no turn.end received"). Measured
// 2026-11-08: about half of the Estonian requests, no Slovak ones. Failures
// come in bursts and parallel tries fail together; a try a little later
// usually works.
const EDGE_ATTEMPTS = 6;
const EDGE_RETRY_PAUSE_MS = 500;

export async function withRetries<T>(run: () => Promise<T>, attempts: number, pauseMs: number): Promise<T> {
	let last: unknown;
	for (let i = 0; i < attempts; i++) {
		if (i > 0) await new Promise((r) => setTimeout(r, pauseMs * i));
		try {
			return await run();
		} catch (err) {
			last = err;
		}
	}
	throw last;
}

async function edge(req: TtsRequest, lang: LanguageInfo): Promise<Spoken | null> {
	const male = req.voice === "male" || (req.voice !== "female" && req.gender === "male");
	const voice = lang.edgeVoices[male ? 1 : 0] ?? lang.edgeVoices[0];
	if (!voice) return null;
	return withRetries(() => edgeOnce(req.text, voice), EDGE_ATTEMPTS, EDGE_RETRY_PAUSE_MS);
}

async function edgeOnce(text: string, voice: string): Promise<Spoken | null> {
	const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
	const tts = new MsEdgeTTS();
	try {
		await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
		const { audioStream } = tts.toStream(escapeXml(text), { rate: EDGE_RATE });
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
		return audio.length > 0 ? { data: audio } : null;
	} finally {
		tts.close();
	}
}

async function piper(req: TtsRequest, lang: LanguageInfo): Promise<Spoken | null> {
	const bin = process.env.PIPER_PATH;
	const model = envFor("PIPER_MODEL", lang.code);
	if (!bin || !model) return null;
	const out = path.join(os.tmpdir(), `lh-piper-${process.pid}-${Date.now()}.wav`);
	await new Promise<void>((resolve, reject) => {
		const child = spawn(bin, ["--model", model, "--output_file", out], { stdio: ["pipe", "ignore", "pipe"] });
		let err = "";
		child.stderr.on("data", (d) => (err += String(d)));
		child.on("error", reject);
		child.on("close", (code) =>
			code === 0 ? resolve() : reject(new Error(`piper exited ${code}: ${err.slice(-200)}`)),
		);
		child.stdin.end(req.text);
	});
	try {
		return { data: fs.readFileSync(out) };
	} finally {
		fs.rmSync(out, { force: true });
	}
}

function escapeXml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TIERS: Array<{
	tier: TtsTier;
	ext: "mp3" | "wav";
	run: (req: TtsRequest, lang: LanguageInfo) => Promise<Spoken | null>;
}> = [
	{ tier: "elevenlabs", ext: "mp3", run: elevenLabs },
	{ tier: "edge", ext: "mp3", run: edge },
	{ tier: "piper", ext: "wav", run: piper },
];

/** Cached clip, or the first tier that succeeds; null = use the browser. */
export async function synthesize(req: TtsRequest): Promise<TtsClip | null> {
	const lang = languageByCode(req.lang) ?? [activeLanguage()].find((l) => l.code === req.lang);
	if (!lang) throw new Error(`unsupported language "${req.lang}"`);
	migrateAudioOnce();
	// slovak.wiki's own recording beats any clip made here, for the default voice.
	if (lang.code === "sk" && (req.voice === undefined || req.voice === "female")) {
		const wiki = await wikiClip("slovak", lang.code, req.text);
		if (wiki) return { file: wiki.file, contentType: "audio/mpeg", tier: "wiki" };
	}
	const key = ttsCacheKey(req);
	const hit = cached(key, lang.code);
	if (hit) return hit;
	const job = `${key}|${req.skip?.join(",") ?? ""}`;
	const pending = inFlight.get(job);
	if (pending) return pending;
	const made = synthesizeFresh(req, lang, key).finally(() => inFlight.delete(job));
	inFlight.set(job, made);
	return made;
}

const inFlight = processWide("tts.inFlight", () => new Map<string, Promise<TtsClip | null>>());

async function synthesizeFresh(req: TtsRequest, lang: LanguageInfo, key: string): Promise<TtsClip | null> {
	for (const { tier, ext, run } of TIERS) {
		if (req.skip?.includes(tier)) continue;
		try {
			const spoken = await run(req, lang);
			if (spoken && spoken.data.length > 0) {
				const stored = storeAudioClip({
					key,
					lang: lang.code,
					voice: req.voice ?? "female",
					tier,
					text: req.text,
					ext,
					data: spoken.data,
					...(spoken.model ? { model: spoken.model } : {}),
				});
				return { file: stored.absolute, contentType: EXT_TYPES[ext] ?? "audio/mpeg", tier };
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
