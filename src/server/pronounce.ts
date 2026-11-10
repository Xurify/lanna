/**
 * Pronunciation service (LangHarness, 2026-10-28) — behind /api/pronounce.
 * Scores one recording against the line it should be (src/core/
 * pronounce.ts for the shape and the rules):
 *
 *   azure — Azure Speech pronunciation assessment, sound by sound, when
 *           AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are set (Settings →
 *           Keys). Wants 16 kHz mono PCM WAV, the recorder's only format.
 *   match — otherwise, intelligibility: the speech-to-text transcript
 *           against the expected words.
 *
 * The report reads every scored line in the fluency log and the recent
 * scenes, so the end screens can say which sounds and words to work on.
 */

import { activeLanguage } from "./active-language.ts";
import { matchScore, parseAzure, pronReport, type AzureResult, type PronEngine, type PronReport, type PronScore } from "../core/pronounce.ts";

export type { PronReport };
import { fluencyStore, speakStore } from "../store/speak.ts";
import { keyValue } from "./keys.ts";
import { sttEngine, transcribe } from "./speak.ts";

/** Azure's locale for the active language. */
const LOCALE: Record<string, string | undefined> = { sk: "sk-SK", ru: "ru-RU", cs: "cs-CZ", pl: "pl-PL", de: "de-DE", es: "es-ES", fr: "fr-FR", it: "it-IT", pt: "pt-PT", hu: "hu-HU", et: "et-EE", fi: "fi-FI", nl: "nl-NL", sv: "sv-SE", uk: "uk-UA" };

function azureKeys(): { key: string; region: string } | null {
	const key = keyValue("AZURE_SPEECH_KEY");
	const region = keyValue("AZURE_SPEECH_REGION");
	return key && region && /^[a-z0-9]{4,40}$/.test(region) ? { key, region } : null;
}

/** Dev only: LH_PRON_SCRIPT=1 scores every line without a key, with a
 *  made-up but steady result (for working on the screens). */
function scripted(): boolean {
	return process.env.NODE_ENV !== "production" && process.env.LH_PRON_SCRIPT === "1";
}

function scriptedScore(reference: string, heard?: string): PronScore {
	const hash = (t: string) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
	const words = reference
		.split(/\s+/)
		.map((w) => w.toLocaleLowerCase("sk-SK").replace(/[^\p{L}\p{N}']+/gu, ""))
		.filter(Boolean)
		.map((word) => {
			const h = hash(word);
			const score = 55 + (h % 46);
			const phonemes = [...word].slice(0, 5).map((ch, i) => ({ p: ch, score: Math.max(10, Math.min(100, score + ((h >> (i * 3)) % 31) - 15)) }));
			return score < 60 ? { word, score, error: "mispronunciation" as const, phonemes } : { word, score, phonemes };
		});
	const accuracy = words.length ? Math.round(words.reduce((n, w) => n + w.score, 0) / words.length) : 80;
	const fluency = 70 + (hash(reference) % 30);
	return { engine: "azure", accuracy, fluency, completeness: 100, prosody: 60 + (hash(reference + "p") % 40), overall: Math.round(accuracy * 0.7 + fluency * 0.3), words, heard: heard ?? reference };
}

/** Which engine would score a line; null when there is no way to hear it. */
export function pronounceEngine(): PronEngine | null {
	if (scripted()) return "azure";
	if (azureKeys()) return "azure";
	if (sttEngine()) return "match";
	return null;
}

interface AssessInput {
	audio: Uint8Array;
	/** The line expected. Empty for free speech: Azure then scores what it heard. */
	reference: string;
	/** A transcript already made (saves a second speech-to-text call on the match engine). */
	heard?: string;
	lang?: "sk" | "ru";
}

/** Score one recording (16 kHz mono WAV). Null when nothing could be heard.
 *  Throws when the engine refused or none is set. */
export async function assess(input: AssessInput): Promise<PronScore | null> {
	const engine = pronounceEngine();
	if (!engine) throw new Error("No way to score pronunciation: add an Azure Speech key (sound by sound) or a speech-to-text key in Settings → API keys.");
	if (input.audio.byteLength === 0) return null;
	if (scripted()) return scriptedScore(input.reference || input.heard || "", input.heard);
	const lang = input.lang ?? activeLanguage().code;
	if (engine === "azure") {
		const score = await assessAzure(input.audio, input.reference, LOCALE[lang] ?? `${lang}-${lang.toUpperCase()}`);
		if (score) return score;
		// Nothing recognized: fall through to the transcript when there is one.
		if (!input.heard) return null;
	}
	const heard = input.heard ?? (await transcribe(input.audio, lang)).text;
	if (!heard.trim()) return null;
	if (!input.reference.trim()) return null;
	return matchScore(input.reference, heard);
}

async function assessAzure(audio: Uint8Array, reference: string, locale: string): Promise<PronScore | null> {
	const { key, region } = azureKeys()!;
	const params = { ReferenceText: reference, GradingSystem: "HundredMark", Granularity: "Phoneme", Dimension: "Comprehensive", EnableProsodyAssessment: true, EnableMiscue: true };
	const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Ocp-Apim-Subscription-Key": key,
			"Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
			"Pronunciation-Assessment": Buffer.from(JSON.stringify(params), "utf-8").toString("base64"),
			Accept: "application/json",
		},
		body: audio as BodyInit,
	});
	if (!res.ok) throw new Error(`Azure Speech failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
	return parseAzure((await res.json()) as AzureResult);
}

/** Every scored line lately: the last rounds of "say it faster" and the
 *  last scenes. Oldest first. */
function recentScores(opts: { rounds?: number; scenes?: number } = {}): PronScore[] {
	const out: PronScore[] = [];
	const rounds = fluencyStore
		.list()
		.filter((e) => e.mode === "fast")
		.slice(-(opts.rounds ?? 12));
	for (const r of rounds) if (r.mode === "fast") for (const rep of r.reps) for (const p of rep.passes) if (p.pron) out.push(p.pron);
	const scenes = speakStore.list().slice(-(opts.scenes ?? 8));
	for (const entry of scenes) {
		const s = speakStore.get(entry.id);
		if (!s) continue;
		for (const t of s.turns) if (t.role === "learner" && t.pron) out.push(t.pron);
	}
	return out;
}

/** The sounds and words to work on, from the recent scored lines. */
export function pronunciationReport(): PronReport {
	return pronReport(recentScores(), { languageId: activeLanguage().id });
}
