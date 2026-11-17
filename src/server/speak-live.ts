/**
 * Live speaking (2026-11-17) — behind /speak/live and /api/speak/live.
 * A full-duplex call with the tutor on one of two engines, both with the
 * learner's own key. Phonic-1: POST /v1/auth/session_token with a bearer key
 * returns { session_token, expires_at }, and the browser opens
 * wss://api.phonic.ai/v1/sts/ws?session_token=… (docs.phonic.ai). OpenAI:
 * POST /v1/realtime/client_secrets returns an ek_ client secret the browser
 * posts its SDP offer with to /v1/realtime/calls (GA Realtime API). The key
 * never reaches the browser, the prompt and the tools are built here, and the
 * talk's transcript and timing are read back at the end
 * (src/server/speaking-analysis.ts).
 */

import { briefParts, SPEAK_SCENES, type SpeakScene } from "../core/speak.ts";
import { islandReadiness, type Island } from "../core/islands.ts";
import {
	LIVE_MIN_TALK_SEC,
	LIVE_TOOLS,
	LIVE_TOOL_SCHEMAS,
	liveAvailability,
	phonicCode,
	type LiveAvailability,
	type LiveCallInput,
	type LiveConfig,
	type LivePageData,
	type LiveProviderId,
	type LiveStart,
} from "../core/live.ts";
import type { SpeakingReport, SpeakingTrends } from "../core/speaking-trends.ts";
import { speakingTrends } from "../core/speaking-trends.ts";
import { islandStore } from "../store/islands.ts";
import { speakingStore } from "../store/speaking.ts";
import { activeLanguage } from "./active-language.ts";
import { fillerKit } from "./fillers.ts";
import { keyValue, redactSecrets } from "./keys.ts";
import { sceneFor } from "./speak.ts";
import { analyseTalk, speakingReports, talkLevel, type TalkOutcome } from "./speaking-analysis.ts";

const PHONIC_TOKEN_URL = "https://api.phonic.ai/v1/auth/session_token";
const PHONIC_SOCKET = "wss://api.phonic.ai/v1/sts/ws";
const PHONIC_TTL_SEC = 600;
// GA Realtime API: the server mints the client secret, the browser posts its
// SDP offer to this URL with it (developers.openai.com/api/docs/guides/realtime-webrtc).
const OPENAI_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
const OPENAI_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const OPENAI_MODEL = "gpt-realtime-2.1";
const OPENAI_TRANSCRIBE = "gpt-4o-transcribe";
const OPENAI_VOICE = "marin";

export function hasPhonicKey(): boolean {
	return !!keyValue("PHONIC_API_KEY");
}

function providerKeys(): Partial<Record<LiveProviderId, boolean>> {
	return { phonic: hasPhonicKey(), openai: !!keyValue("OPENAI_API_KEY") };
}

export function liveAvailabilityNow(): LiveAvailability {
	return liveAvailability(activeLanguage(), providerKeys());
}

export function livePage(now = new Date()): LivePageData {
	const availability = liveAvailabilityNow();
	const level = talkLevel();
	const scenes = SPEAK_SCENES.map((s) => sceneFor(s.id))
		.filter((s): s is SpeakScene => !!s)
		.map((s) => ({ id: s.id, title: s.title, task: s.task, level }))
		.slice(0, 12);
	const islands = islandStore.list().map((island) => {
		const r = islandReadiness(island, { now });
		return { id: island.id, topic: island.topic, step: r.step, needs: r.needs };
	});
	return {
		availability,
		level,
		scenes,
		islands,
		minTalkSec: LIVE_MIN_TALK_SEC,
		kit: !!fillerKit(),
		recent: speakingStore.list().slice(-6).reverse(),
	};
}

// ─── The prompt ─────────────────────────────────────────────────────────────

function liveSystem(): string {
	const lang = activeLanguage();
	return `You are a ${lang.english} conversation partner on a live voice call with one learner. You hear them speak and they hear you. This is a real conversation, not a lesson: you are the other person in the situation, and you keep it going.

How you talk:
- ${lang.english} only, at ${talkLevel()}: short, common words and short sentences. Two or three sentences a turn, then stop and let them answer. Never a monologue.
- Ask one question at a time and make it answerable at their level. React to what they actually said before you ask.
- Never correct them out loud and never explain grammar. If a form is wrong, use the right form naturally in your own reply and carry on.
- If they go quiet, help: offer a choice, or say the beginning of an answer they can finish.
- If they speak English, answer in ${lang.english} and give them an easy way back into it.

Your screen tools (use them, they do not interrupt the talk):
- prompt_repair: ONLY when a case, verb or aspect slip is worth repairing right now. Give their exact words, a short ${lang.english} hint that starts the right form without giving it, and the kind. At most once every few turns, never twice in a row for the same thing.
- vault_word_used: when the learner says one of the island's vault chunks themselves.
- new_chunk: a useful ${lang.english} phrase from the talk worth keeping, with its meaning.
- filler_used: a filler or reaction from the kit they just said.
- end_talk: only when they ask to stop or the conversation has clearly reached its end.

Never read the tools out, never mention the screen, never say you are an AI. You are the person in the scene.`;
}

function islandBrief(island: Island): string {
	const chunks = island.chunks
		.slice(0, 40)
		.map((c) => `- ${c.sk} — ${c.en}`)
		.join("\n");
	const readiness = islandReadiness(island);
	return `The learner has prepared this island: ${island.topic}. This call is their chance to hold it with you.\nTheir vault (each line is ${activeLanguage().english}, then its meaning):\n${chunks}\n\nThe island is at step "${readiness.step}".${
		readiness.needs.length ? ` To move on it needs: ${readiness.needs.join(" ")}` : ""
	}

Open by asking them about the topic in one short question, then follow what they say. Stay on the island for most of the talk; if they bring up something they have another island for, follow them there for a turn or two and come back. Use the vault chunks in your own lines so they hear them, and mark the ones they say with vault_word_used.`;
}

function sceneBrief(scene: SpeakScene): string {
	const { role, situation } = briefParts(scene.brief);
	return `The scene: you are ${role}${situation ? `; ${situation}` : ""}.\nThe learner's task: ${scene.task}\n\nOpen the scene in character with one short line, then let them answer.`;
}

// ─── The call ───────────────────────────────────────────────────────────────

async function mintPhonic(): Promise<{ token: string; url: string }> {
	const key = keyValue("PHONIC_API_KEY");
	if (!key) throw new Error("Live talk needs a Phonic key: add PHONIC_API_KEY in Settings → API keys, then try again.");
	const res = await fetch(PHONIC_TOKEN_URL, {
		method: "POST",
		headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
		body: JSON.stringify({ ttl_seconds: PHONIC_TTL_SEC }),
	});
	const raw = await res.text();
	if (!res.ok) throw new Error(`Phonic refused the session token (${res.status}): ${redactSecrets(raw).slice(0, 200)}`);
	let token = "";
	try {
		const body = JSON.parse(raw) as { session_token?: unknown };
		token = typeof body.session_token === "string" ? body.session_token : "";
	} catch {
		token = "";
	}
	if (!token) throw new Error("Phonic answered without a session token.");
	return { token, url: `${PHONIC_SOCKET}?session_token=${encodeURIComponent(token)}` };
}

async function mintOpenAI({
	instructions,
	language,
}: {
	instructions: string;
	language: string;
}): Promise<{ token: string; model: string }> {
	const key = keyValue("OPENAI_API_KEY");
	if (!key)
		throw new Error("Live talk needs an OpenAI key: add OPENAI_API_KEY in Settings → API keys, then try again.");
	const res = await fetch(OPENAI_SECRETS_URL, {
		method: "POST",
		headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
		body: JSON.stringify({
			session: {
				type: "realtime",
				model: OPENAI_MODEL,
				instructions,
				audio: {
					input: {
						transcription: { model: OPENAI_TRANSCRIBE, language },
						turn_detection: { type: "semantic_vad" },
					},
					output: { voice: OPENAI_VOICE },
				},
				tools: LIVE_TOOL_SCHEMAS.map((tool) => ({
					type: "function",
					name: tool.name,
					description: tool.description,
					parameters: tool.parameters,
				})),
			},
		}),
	});
	const raw = await res.text();
	if (!res.ok) throw new Error(`OpenAI refused the call (${res.status}): ${redactSecrets(raw).slice(0, 200)}`);
	let token = "";
	try {
		const body = JSON.parse(raw) as { value?: unknown };
		token = typeof body.value === "string" ? body.value : "";
	} catch {
		token = "";
	}
	if (!token) throw new Error("OpenAI answered without a client secret.");
	return { token, model: OPENAI_MODEL };
}

export async function liveStart(kind: "scene" | "island", ref: string, provider?: LiveProviderId): Promise<LiveStart> {
	const availability = liveAvailabilityNow();
	if (!availability.enabled) throw new Error(availability.reason);
	const option = availability.options.find((o) => o.id === (provider ?? availability.provider));
	if (!option) throw new Error("That voice engine does not speak this language.");
	if (!option.enabled) throw new Error(option.reason);
	const code = activeLanguage().code;
	const scene = kind === "scene" ? sceneFor(ref) : null;
	const island = kind === "island" ? islandStore.get(ref) : null;
	if (kind === "scene" && !scene) throw new Error("No such scene.");
	if (kind === "island" && !island) throw new Error("No such island.");
	const instructions = `${liveSystem()}\n\n${kind === "island" ? islandBrief(island!) : sceneBrief(scene!)}`;
	const kit = fillerKit();
	const common = {
		level: talkLevel(),
		language: option.lang,
		title: island?.topic ?? scene!.title,
		kind,
		ref,
		vault: (island?.chunks ?? []).map((c) => ({ id: c.id, sk: c.sk, en: c.en })),
		fillers: kit?.entries.slice(0, 8).map((e) => e.sk) ?? [],
	};
	if (option.id === "openai") {
		const { token, model } = await mintOpenAI({ instructions, language: option.lang });
		return { ...common, provider: "openai", token, callUrl: OPENAI_CALLS_URL, model };
	}
	const { token, url } = await mintPhonic();
	const config: LiveConfig = {
		system_prompt: instructions,
		default_language: phonicCode(code)!,
		input_format: "pcm_16000",
		output_format: "pcm_24000",
		min_words_to_interrupt: 2,
		generate_welcome_message: true,
		tools: LIVE_TOOLS,
	};
	return { ...common, provider: "phonic", token, url, config };
}

export async function liveEnd(input: LiveCallInput, tz?: number): Promise<TalkOutcome> {
	return analyseTalk(input, { tz });
}

export function liveReports(): { reports: SpeakingReport[]; trends: SpeakingTrends } {
	const reports = speakingReports();
	return { reports: reports.slice(-12).reverse(), trends: speakingTrends(reports) };
}
