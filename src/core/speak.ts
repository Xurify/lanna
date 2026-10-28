/**
 * Speak (LangHarness, 2026-10-28) — the output strand's voice-first task:
 * a role-play scene from what Slovak is for, where the learner SAYS each
 * line (dictation into text; typing is the fallback), the tutor answers
 * in Slovak out loud and in writing, and every slip in a case, verb or
 * aspect ending gets a prompt to repair, not a silent recast. The scene
 * ends with a short summary of the slips, which feeds the review deck.
 *
 * Why (the research behind the shape; docs/research/comprehensible-input.md):
 *   - Input alone leaves accuracy gaps: learners who read well and speak
 *     badly are the immersion profile (Swain 1985). Output with feedback
 *     is one of Nation's four strands, and before this task the app's
 *     only output was a text chat.
 *   - Prompts beat recasts: a correction the learner has to produce
 *     themselves ("do škol…? skús ešte raz") changes their grammar; a
 *     recast is often not even noticed (Lyster & Ranta 1997; Lyster &
 *     Saito 2010). One prompt per reply, on the known weak points only;
 *     everything else is let go so the scene keeps moving.
 *   - Saying it, not writing it: speaking at a conversational pace is a
 *     different skill from composing in a text box, and the one the
 *     learner lacks. Voice in, voice out; the text is there to read along.
 *
 * Pure and browser-safe. The model calls, the files and the speech-to-
 * text live in src/server/speak.ts.
 */

import type { Cefr } from "./curriculum.ts";
import { foldDiacritics } from "./language.ts";
import type { PronEngine, PronScore } from "./pronounce.ts";
import type { StoryUsage } from "./reading.ts";

// ─── Scenes ─────────────────────────────────────────────────────────────────

export interface SpeakScene {
	id: string;
	/** Slovak title. */
	title: string;
	/** One line in English. */
	blurb: string;
	/** The tutor's role, as the first message states it. */
	brief: string;
	/** What the learner is there to do, for the screen. */
	task: string;
}

/** The six scenes the Talk task has always had, now spoken. The ids are
 *  what the curriculum's goals and the purposes point at
 *  (src/core/onboarding.ts PURPOSES[].scenes). */
export const SPEAK_SCENES: SpeakScene[] = [
	{ id: "cafe", title: "Kaviareň", blurb: "Order coffee and cake in Bratislava", brief: "a waiter in a small café in Bratislava's old town; I want to order coffee and something sweet, and ask what's good", task: "Order a coffee and something sweet, and ask what is good." },
	{ id: "way", title: "Na ulici", blurb: "Ask a stranger the way to the station", brief: "a friendly local on Obchodná ulica; I am lost and need to get to the main train station", task: "You are lost. Find out how to get to the main station." },
	{ id: "colleague", title: "Nový kolega", blurb: "Meet a new colleague on day one", brief: "my new colleague at the office; we meet at the coffee machine on my first day and get to know each other", task: "It is your first day. Get to know your new colleague." },
	{ id: "shop", title: "Na trhu", blurb: "Buy vegetables at the market", brief: "a stallholder at the Miletičova market; I want vegetables and fruit for a soup, and to ask about prices", task: "Buy what you need for a soup, and ask about prices." },
	{ id: "doctor", title: "U lekára", blurb: "Explain to a doctor what hurts", brief: "a GP in a Slovak clinic; I have a sore throat and a headache since yesterday", task: "Tell the doctor what hurts and since when." },
	{ id: "family", title: "Rodina", blurb: "Talk about your family with a new friend", brief: "a new Slovak friend at a party who asks about my family, where they live and what they do", task: "Tell a new friend about your family." },
];

export function speakScene(id: string): SpeakScene | undefined {
	return SPEAK_SCENES.find((s) => s.id === id);
}

// ─── The session record ─────────────────────────────────────────────────────

/** What kind of slip a prompt or correction is about. Case, verb and
 *  aspect are the learner's known weak points and the only ones prompted
 *  mid-scene; the rest are kept for the end. */
export type SlipKind = "case" | "verb" | "aspect" | "word" | "order" | "spelling" | "other";

export const SLIP_KINDS: readonly SlipKind[] = ["case", "verb", "aspect", "word", "order", "spelling", "other"];

export const SLIP_LABEL: Readonly<Record<SlipKind, string>> = {
	case: "case ending",
	verb: "verb ending",
	aspect: "aspect",
	word: "word choice",
	order: "word order",
	spelling: "spelling",
	other: "form",
};

/** A repair prompt on the learner's last line: the slip quoted, and the
 *  Slovak hint the tutor opens with, in brackets ("do škol…? skús ešte raz"). */
export interface SpeakPrompt {
	/** The learner's words with the slip. */
	yours: string;
	/** The tutor's hint in Slovak: the trigger plus an opening, never the form. */
	hint: string;
	kind: SlipKind;
}

export interface SpeakTurn {
	role: "tutor" | "learner";
	/** Slovak. */
	text: string;
	/** English meaning (tutor turns; shown on demand). */
	en?: string;
	/** Tutor turn: a prompt on the learner's line before it. */
	prompt?: SpeakPrompt;
	/** Tutor turn after a prompt: the learner repaired the form. */
	repaired?: boolean;
	/** Learner turn: how the line arrived. */
	via?: "voice" | "typed";
	/** Learner turn: the recording's file name in the session folder. */
	audio?: string;
	/** Learner turn: how long the recording was. */
	ms?: number;
	/** Learner turn: how clearly it was said (src/core/pronounce.ts). */
	pron?: PronScore;
	at: string;
}

/** One correction in the end-of-scene summary. */
export interface SpeakCorrection {
	yours: string;
	right: string;
	/** The rule in a few words, in English. */
	rule: string;
	kind: SlipKind;
	/** The dictionary form of the word the slip was on, when there is one. */
	lemma?: string;
	/** Its lexicon slug, resolved by the server; feeds the review deck. */
	slug?: string;
}

export interface SpeakSummary {
	corrections: SpeakCorrection[];
	/** Two phrases from the scene worth keeping (Slovak). */
	keep: string[];
	/** One encouraging line in English about what went well. */
	note?: string;
}

export interface SpeakSession {
	/** "sp-<date>-<scene>-<rand>" */
	id: string;
	lang: string;
	scene: string;
	sceneTitle: string;
	level: Cefr;
	chapter: string;
	startedAt: string;
	endedAt?: string;
	turns: SpeakTurn[];
	summary?: SpeakSummary;
	/** The model and every call's tokens (priced at read time). */
	usage: StoryUsage;
	xp?: number;
	/** Slugs sent to the review deck at the end. */
	queued?: string[];
	/** Wall time of the whole scene. */
	ms?: number;
	/** Pronunciation across the spoken turns, set at the end. */
	pron?: { average: number; lines: number; clear: number; engine: PronEngine };
}

/** data/profiles/<lang>/speak/index.jsonl: one line per scene. */
export interface SpeakIndexEntry {
	id: string;
	scene: string;
	sceneTitle: string;
	level: Cefr;
	startedAt: string;
	endedAt?: string;
	/** Learner lines. */
	turns: number;
	prompts: number;
	repaired: number;
	corrections: number;
	model: string;
	xp?: number;
}

export function speakId(now: Date, scene: string): string {
	const day = now.toISOString().slice(0, 10);
	return `sp-${day}-${scene}-${now.getTime().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
}

// ─── The rules ──────────────────────────────────────────────────────────────

export const SPEAK_MINUTES = 6;
/** Learner lines in a scene before the tutor wraps it up. */
export const SPEAK_TURNS = 8;
export const SPEAK_TURN_XP = 3;
export const SPEAK_REPAIR_XP = 5;
export const SPEAK_BONUS = 10;
/** A line needs this many words to be worth a scene turn (a bare "áno"
 *  is a turn too, but the XP cap stops padding). */
export const SPEAK_XP_TURNS_CAP = 10;

/** A spoken line scored "clear" (src/core/pronounce.ts PRON_GOOD) earns this on top. */
export const SPEAK_CLEAR_XP = 2;

export function speakXp(learnerTurns: number, repaired: number, clear = 0): number {
	if (learnerTurns === 0) return 0;
	return Math.min(learnerTurns, SPEAK_XP_TURNS_CAP) * SPEAK_TURN_XP + repaired * SPEAK_REPAIR_XP + Math.min(clear, SPEAK_XP_TURNS_CAP) * SPEAK_CLEAR_XP + SPEAK_BONUS;
}

/** The counts the index and the end screen show. */
export function speakCounts(turns: readonly SpeakTurn[]): { learner: number; prompts: number; repaired: number; spoken: number; clear: number } {
	let learner = 0;
	let prompts = 0;
	let repaired = 0;
	let spoken = 0;
	let clear = 0;
	for (const t of turns) {
		if (t.role === "learner") {
			learner++;
			if (t.pron) {
				spoken++;
				if (t.pron.overall >= 85) clear++;
			}
		} else {
			if (t.prompt) prompts++;
			if (t.repaired) repaired++;
		}
	}
	return { learner, prompts, repaired, spoken, clear };
}

// ─── What the model writes ──────────────────────────────────────────────────

/** One tutor reply, as the model's JSON says it. */
export interface TutorReply {
	sk: string;
	en: string;
	prompt?: SpeakPrompt;
	/** The learner's last line repaired the slip prompted before it. */
	repaired?: boolean;
	/** The scene is over (the tutor said goodbye); the summary follows. */
	end?: boolean;
}

function unfence(text: string): string {
	const t = text.trim();
	const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
	return m ? m[1]! : t;
}

function firstObject(text: string): unknown {
	const t = unfence(text);
	try {
		return JSON.parse(t);
	} catch {
		// prose around the object: take the outermost braces
	}
	const start = t.indexOf("{");
	const end = t.lastIndexOf("}");
	if (start >= 0 && end > start) {
		try {
			return JSON.parse(t.slice(start, end + 1));
		} catch {
			return null;
		}
	}
	return null;
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function slipKind(v: unknown): SlipKind {
	return typeof v === "string" && (SLIP_KINDS as readonly string[]).includes(v) ? (v as SlipKind) : "other";
}

function promptOf(v: unknown): SpeakPrompt | undefined {
	if (!v || typeof v !== "object") return undefined;
	const o = v as Record<string, unknown>;
	const hint = str(o.hint, 160);
	const yours = str(o.yours, 200);
	if (!hint || !yours) return undefined;
	return { yours, hint, kind: slipKind(o.kind) };
}

/**
 * Read the tutor's reply. The model is asked for one JSON object
 * {sk, en, prompt, repaired, end}; a reply that is not JSON is taken as
 * the Slovak line itself (the scene keeps moving; the meaning is empty).
 * A prompt with no hint or no quoted slip is dropped: a half prompt is
 * worse than none.
 */
export function parseTutorReply(text: string): TutorReply {
	const o = firstObject(text);
	if (!o || typeof o !== "object") {
		const plain = text.trim().replace(/^```[a-z]*\s*|\s*```$/g, "");
		return { sk: plain.slice(0, 600), en: "" };
	}
	const r = o as Record<string, unknown>;
	const sk = str(r.sk ?? r.text ?? r.reply);
	const reply: TutorReply = { sk: sk || str(text), en: str(r.en ?? r.translation) };
	const prompt = promptOf(r.prompt);
	if (prompt) reply.prompt = prompt;
	if (r.repaired === true) reply.repaired = true;
	if (r.end === true) reply.end = true;
	return reply;
}

/** Read the end-of-scene summary: at most three corrections, two
 *  phrases to keep, one line of encouragement. */
export function parseSummary(text: string): SpeakSummary {
	const o = firstObject(text);
	const out: SpeakSummary = { corrections: [], keep: [] };
	if (!o || typeof o !== "object") return out;
	const r = o as Record<string, unknown>;
	if (Array.isArray(r.corrections)) {
		for (const c of r.corrections) {
			if (out.corrections.length >= 3) break;
			if (!c || typeof c !== "object") continue;
			const x = c as Record<string, unknown>;
			const yours = str(x.yours, 200);
			const right = str(x.right, 200);
			if (!yours || !right) continue;
			const lemma = str(x.lemma, 60);
			out.corrections.push({ yours, right, rule: str(x.rule, 200), kind: slipKind(x.kind), ...(lemma ? { lemma } : {}) });
		}
	}
	if (Array.isArray(r.keep)) out.keep = r.keep.map((k) => str(k, 200)).filter(Boolean).slice(0, 3);
	const note = str(r.note, 300);
	if (note) out.note = note;
	return out;
}

// ─── Matching what was said ─────────────────────────────────────────────────

/** Words of a line, folded for comparison: lowercase, no diacritics, no
 *  punctuation. "Dobrý deň, prosím kávu." → ["dobry", "den", "prosim", "kavu"]. */
export function foldedWords(text: string, tag = "sk-SK"): string[] {
	return foldDiacritics(text.toLocaleLowerCase(tag))
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
}

export interface WordMatch {
	/** Share of the expected words heard (0..1). */
	score: number;
	/** Expected words not heard. */
	missing: string[];
	/** Heard words not expected. */
	extra: string[];
}

/** How much of an expected line a transcript contains, word by word and
 *  order-blind (speech-to-text drops and swaps; the ear forgives order).
 *  Used by the fluency "say it faster" check and the speak screen's
 *  "did it hear me" line. */
export function wordMatch(expected: string, heard: string): WordMatch {
	const want = foldedWords(expected);
	const got = foldedWords(heard);
	if (want.length === 0) return { score: 1, missing: [], extra: got };
	const pool = new Map<string, number>();
	for (const w of got) pool.set(w, (pool.get(w) ?? 0) + 1);
	let hit = 0;
	const missing: string[] = [];
	for (const w of want) {
		const n = pool.get(w) ?? 0;
		if (n > 0) {
			hit++;
			pool.set(w, n - 1);
		} else missing.push(w);
	}
	const extra = [...pool.entries()].flatMap(([w, n]) => Array.from({ length: n }, () => w));
	return { score: hit / want.length, missing, extra };
}
