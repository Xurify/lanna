/**
 * Live speaking (2026-11-17) — behind /speak/live and /api/speak/live.
 * A full-duplex call with the tutor over Phonic-1: the microphone streams
 * to Phonic's speech-to-speech socket, the tutor's voice comes back as it
 * is generated, and both sides can interrupt each other. The session token
 * is minted here (the key never reaches the browser), the system prompt and
 * the tools are built here, and the call's transcript and timing are read
 * back on the server at the end (src/server/speaking-analysis.ts).
 *
 * Protocol: https://docs.phonic.ai — POST /v1/auth/session_token with a
 * bearer key returns { session_token, expires_at }; the socket is
 * wss://api.phonic.ai/v1/sts/ws?session_token=…; the server sends
 * ready_to_start_conversation, then the client sends one config message.
 */

import { briefParts, SPEAK_SCENES, type SpeakScene } from "../core/speak.ts";
import { islandReadiness, type Island } from "../core/islands.ts";
import {
	LIVE_MIN_TALK_SEC,
	LIVE_TOOLS,
	phonicCode,
	type LiveAvailability,
	type LiveCallInput,
	type LiveConfig,
	type LivePageData,
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

const TOKEN_TTL_SEC = 600;
const PHONIC_TOKEN_URL = "https://api.phonic.ai/v1/auth/session_token";
const PHONIC_SOCKET = "wss://api.phonic.ai/v1/sts/ws";

export function hasPhonicKey(): boolean {
	return !!keyValue("PHONIC_API_KEY");
}

export function liveAvailabilityNow(): LiveAvailability {
	const lang = activeLanguage();
	return liveStatusAvailability(lang.code, lang.english);
}

function liveStatusAvailability(code: string, english: string): LiveAvailability {
	if (!phonicCode(code))
		return {
			enabled: false,
			missing: "language",
			reason: `Live talk is not available in ${english} yet: Phonic does not speak it. Rehearse and the turn-by-turn scene still work.`,
		};
	if (!hasPhonicKey())
		return {
			enabled: false,
			missing: "key",
			reason:
				"Live talk needs a Phonic key. Add it in Settings → API keys; without one, Rehearse and the turn-by-turn scene still work.",
		};
	return { enabled: true, lang: phonicCode(code)! };
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

async function mintToken(): Promise<{ token: string; url: string }> {
	const key = keyValue("PHONIC_API_KEY");
	if (!key) throw new Error("Live talk needs a Phonic key: add PHONIC_API_KEY in Settings → API keys, then try again.");
	const res = await fetch(PHONIC_TOKEN_URL, {
		method: "POST",
		headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
		body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SEC }),
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

export async function liveStart(kind: "scene" | "island", ref: string): Promise<LiveStart> {
	const availability = liveAvailabilityNow();
	if (!availability.enabled) throw new Error(availability.reason);
	const code = activeLanguage().code;
	const scene = kind === "scene" ? sceneFor(ref) : null;
	const island = kind === "island" ? islandStore.get(ref) : null;
	if (kind === "scene" && !scene) throw new Error("No such scene.");
	if (kind === "island" && !island) throw new Error("No such island.");
	const { token, url } = await mintToken();
	const config: LiveConfig = {
		system_prompt: `${liveSystem()}\n\n${kind === "island" ? islandBrief(island!) : sceneBrief(scene!)}`,
		default_language: phonicCode(code)!,
		input_format: "pcm_16000",
		output_format: "pcm_24000",
		min_words_to_interrupt: 2,
		generate_welcome_message: true,
		tools: LIVE_TOOLS,
	};
	const kit = fillerKit();
	return {
		token,
		url,
		config,
		level: talkLevel(),
		title: island?.topic ?? scene!.title,
		kind,
		ref,
		vault: (island?.chunks ?? []).map((c) => ({ id: c.id, sk: c.sk, en: c.en })),
		fillers: kit?.entries.slice(0, 8).map((e) => e.sk) ?? [],
	};
}

export async function liveEnd(input: LiveCallInput, tz?: number): Promise<TalkOutcome> {
	return analyseTalk(input, { tz });
}

export function liveReports(): { reports: SpeakingReport[]; trends: SpeakingTrends } {
	const reports = speakingReports();
	return { reports: reports.slice(-12).reverse(), trends: speakingTrends(reports) };
}
