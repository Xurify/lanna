/**
 * Live talk (Phonic-1): full-duplex speech with the tutor, alongside the
 * turn-by-turn scene. Supported languages and their codes are Phonic's own
 * list (https://docs.phonic.ai/docs/build/agents/supported_languages); a
 * language Phonic does not speak is never hidden, only disabled with the
 * reason. Pure and browser-safe.
 */

import type { Cefr } from "./curriculum.ts";
import type { Island } from "./islands.ts";
import type { SpeakingReport } from "./speaking-trends.ts";

export interface LiveLanguage {
	code: string;
	english: string;
}

/** ISO 639-1 code → the code Phonic expects. Estonian is absent. */
const PHONIC_LANGUAGES: Readonly<Record<string, string>> = { sk: "sk", ru: "ru" };

export function phonicCode(code: string): string | null {
	return PHONIC_LANGUAGES[code] ?? null;
}

export type LiveAvailability =
	| { enabled: true; lang: string }
	| { enabled: false; reason: string; missing: "language" | "key" };

export function liveAvailability(language: LiveLanguage, hasKey: boolean): LiveAvailability {
	const lang = phonicCode(language.code);
	if (!lang)
		return {
			enabled: false,
			missing: "language",
			reason: `Live talk is not available in ${language.english} yet: Phonic does not speak it. Rehearse and the turn-by-turn scene still work.`,
		};
	if (!hasKey)
		return {
			enabled: false,
			missing: "key",
			reason:
				"Live talk needs a Phonic key. Add it in Settings → API keys; without one, Rehearse and the turn-by-turn scene still work.",
		};
	return { enabled: true, lang };
}

/** A short live talk, and the bars the ladder's Holding step needs. */
export const LIVE_MIN_TALK_SEC = 180;

export interface LiveTurn {
	role: "tutor" | "learner";
	/** The transcript: verbatim from the local clip for a learner turn, Phonic's for the tutor. */
	text: string;
	/** Ms from the first turn of the talk. */
	start: number;
	end: number;
	/** The learner's words came from Phonic only: accuracy is approximate. */
	approximate?: boolean;
}

export interface LiveToolEvent {
	tool: "prompt_repair" | "vault_word_used" | "new_chunk" | "filler_used" | "end_talk";
	at: number;
	yours?: string;
	hint?: string;
	kind?: string;
	lemma?: string;
	sk?: string;
	en?: string;
}

export interface LiveCallInput {
	kind: "scene" | "island";
	/** The scene id, or the island id. */
	ref: string;
	/** The scene's or island's title, as the screen had it. */
	title?: string;
	turns: LiveTurn[];
	/** Gaps over one second inside the learner's own turns, measured from the mic. */
	pausesMs: number[];
	/** Every learner turn used Phonic's transcript, not a local one. */
	approximate: boolean;
	startedAt: string;
	endedAt: string;
	tools: LiveToolEvent[];
	conversationId?: string;
}

export const PROMPT_REPAIR_TOOL = {
	type: "custom_websocket" as const,
	tool_schema: {
		type: "function" as const,
		function: {
			name: "prompt_repair",
			description:
				"Show the learner a repair hint on screen when they said a form wrong. Use only for a case, verb or aspect slip that is worth repairing now.",
			parameters: {
				type: "object",
				properties: {
					yours: { type: "string", description: "The learner's words with the slip, quoted." },
					hint: {
						type: "string",
						description: "A short hint in the target language that starts the right form without giving it.",
					},
					kind: { type: "string", enum: ["case", "verb", "aspect"] },
				},
				required: ["yours", "hint", "kind"],
				additionalProperties: false,
			},
			strict: true,
		},
	},
	execution_mode: "sync" as const,
	tool_call_output_timeout_ms: 5000,
};

export const VAULT_WORD_TOOL = {
	type: "custom_websocket" as const,
	tool_schema: {
		type: "function" as const,
		function: {
			name: "vault_word_used",
			description: "Mark a word from the island's vault that the learner has just said themselves.",
			parameters: {
				type: "object",
				properties: { lemma: { type: "string" } },
				required: ["lemma"],
				additionalProperties: false,
			},
			strict: true,
		},
	},
	execution_mode: "async" as const,
};

export const NEW_CHUNK_TOOL = {
	type: "custom_websocket" as const,
	tool_schema: {
		type: "function" as const,
		function: {
			name: "new_chunk",
			description:
				"Offer a useful phrase from the talk as a new chunk for the vault. Only phrases the tutor said that are worth keeping.",
			parameters: {
				type: "object",
				properties: {
					sk: { type: "string" },
					en: { type: "string" },
				},
				required: ["sk", "en"],
				additionalProperties: false,
			},
			strict: true,
		},
	},
	execution_mode: "async" as const,
};

export const FILLER_TOOL = {
	type: "custom_websocket" as const,
	tool_schema: {
		type: "function" as const,
		function: {
			name: "filler_used",
			description: "Count a filler or reaction from the kit that the learner has just said.",
			parameters: {
				type: "object",
				properties: { lemma: { type: "string" } },
				required: ["lemma"],
				additionalProperties: false,
			},
			strict: true,
		},
	},
	execution_mode: "async" as const,
};

export const END_TALK_TOOL = {
	type: "custom_websocket" as const,
	tool_schema: {
		type: "function" as const,
		function: {
			name: "end_talk",
			description: "End the talk. Call it only when the learner asks to stop or the talk has clearly reached its end.",
			parameters: { type: "object", properties: {}, additionalProperties: false },
			strict: true,
		},
	},
	execution_mode: "sync" as const,
	tool_call_output_timeout_ms: 5000,
};

export const LIVE_TOOLS = [PROMPT_REPAIR_TOOL, VAULT_WORD_TOOL, NEW_CHUNK_TOOL, FILLER_TOOL, END_TALK_TOOL];

export interface LiveSceneRow {
	id: string;
	title: string;
	task: string;
	level: Cefr;
}

export interface LiveIslandRow {
	id: string;
	topic: string;
	step: string;
	needs: string[];
}

export interface LivePageData {
	availability: LiveAvailability;
	level: Cefr;
	scenes: LiveSceneRow[];
	islands: LiveIslandRow[];
	minTalkSec: number;
	kit: boolean;
	recent: SpeakingReport[];
}

export interface LiveTalkResult {
	report: SpeakingReport;
	xp: number;
	queued: string[];
	island: Island | null;
	next: { step: string; needs: string[] } | null;
}

export interface LiveConfig {
	system_prompt: string;
	default_language: string;
	input_format: "pcm_16000";
	output_format: "pcm_24000";
	min_words_to_interrupt: number;
	generate_welcome_message: boolean;
	tools: typeof LIVE_TOOLS;
}

export interface LiveStart {
	token: string;
	url: string;
	config: LiveConfig;
	level: Cefr;
	title: string;
	kind: "scene" | "island";
	ref: string;
	/** The island's chunks, shown as chips while talking. */
	vault: Array<{ id: string; sk: string; en: string }>;
	/** Fillers from the language's kit the learner might reach for. */
	fillers: string[];
}

export function liveXp(sec: number, learnerTurns: number): number {
	if (learnerTurns === 0) return 0;
	return Math.round(Math.min(learnerTurns, 30) * 2 + (Math.min(sec, 900) / 60) * 4) + 10;
}

/** What the review model answered, read leniently: a shape the prompt asked
 *  for, bounded strings, nothing invented when a field is missing. */
export interface LiveReview {
	slips: Array<{ turn: number; yours: string; right: string; kind: string; rule: string; lemma: string }>;
	strengths: string[];
	improve: Array<{ turn: number; yours: string; right: string; why: string }>;
	complexity: { past: boolean; future: boolean; clauses: string[]; aspectPairs: number; note: string } | null;
	newChunks: Array<{ sk: string; en: string }>;
}

const text = (v: unknown, max = 400): string =>
	typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

function jsonOf(raw: string): Record<string, unknown> | null {
	const from = raw.indexOf("{");
	const to = raw.lastIndexOf("}");
	if (from < 0 || to <= from) return null;
	try {
		const parsed = JSON.parse(raw.slice(from, to + 1)) as unknown;
		return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

// Phonic rejects an audio_chunk longer than 40 ms, and the capture worklet posts
// 128 ms frames, so the remainder is carried into the next frame rather than
// sent whole.
export function pcmChunks(
	carry: Int16Array | null,
	frame: Int16Array,
	size: number,
): { chunks: Int16Array[]; carry: Int16Array | null } {
	const all = new Int16Array((carry?.length ?? 0) + frame.length);
	if (carry) all.set(carry, 0);
	all.set(frame, carry?.length ?? 0);
	const chunks: Int16Array[] = [];
	let at = 0;
	while (all.length - at >= size) {
		chunks.push(all.subarray(at, at + size));
		at += size;
	}
	const rest = all.subarray(at);
	return { chunks, carry: rest.length > 0 ? rest.slice() : null };
}

export function parseLiveReview(raw: string): LiveReview | null {
	const json = jsonOf(raw);
	if (!json) return null;
	const list = (v: unknown) => (Array.isArray(v) ? v : []);
	const slips = list(json.slips)
		.map((row) => {
			const r = (row ?? {}) as Record<string, unknown>;
			const yours = text(r.yours, 200);
			const right = text(r.right, 200);
			if (!yours || !right) return null;
			return {
				turn: num(r.turn),
				yours,
				right,
				kind: text(r.kind, 20) || "other",
				rule: text(r.rule, 160),
				lemma: text(r.lemma, 60),
			};
		})
		.filter((s): s is NonNullable<typeof s> => !!s)
		.slice(0, 4);
	const improve = list(json.improve)
		.map((row) => {
			const r = (row ?? {}) as Record<string, unknown>;
			const yours = text(r.yours, 200);
			const right = text(r.right, 200);
			if (!yours || !right) return null;
			return { turn: num(r.turn), yours, right, why: text(r.why, 200) };
		})
		.filter((s): s is NonNullable<typeof s> => !!s)
		.slice(0, 3);
	const c = (json.complexity ?? null) as Record<string, unknown> | null;
	const complexity = c
		? {
				past: c.past === true,
				future: c.future === true,
				clauses: list(c.clauses)
					.map((x) => text(x, 40))
					.filter(Boolean)
					.slice(0, 6),
				aspectPairs: num(c.aspectPairs),
				note: text(c.note, 200),
			}
		: null;
	const newChunks = list(json.newChunks)
		.map((row) => {
			const r = (row ?? {}) as Record<string, unknown>;
			const sk = text(r.sk, 120);
			const en = text(r.en, 160);
			return sk && en ? { sk, en } : null;
		})
		.filter((c2): c2 is NonNullable<typeof c2> => !!c2)
		.slice(0, 4);
	return {
		slips,
		strengths: list(json.strengths)
			.map((x) => text(x, 200))
			.filter(Boolean)
			.slice(0, 4),
		improve,
		complexity,
		newChunks,
	};
}
