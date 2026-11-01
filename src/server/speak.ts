/**
 * Speak service (LangHarness, 2026-10-28) — behind /speak and /api/speak.
 * A spoken scene with the tutor on the cheap model slot: one model call a
 * turn, no tools, the whole dialogue sent each time (a scene is ten short
 * lines; the transcript is far smaller than a chat's tool-laden prompt).
 * Every line, prompt and the end summary are kept in
 * data/profiles/<lang>/speak/<id>.json (src/store/speak.ts); the
 * learner's own recordings sit next to it. The tutor's lines are spoken
 * through the shared audio library (paid for once per sentence).
 *
 * Speech-to-text for the learner's lines (POST /api/stt): ElevenLabs
 * Scribe when the ElevenLabs key is set (the same key the voice uses),
 * else Deepgram's prerecorded endpoint when that key is set, else none
 * (the screen says so and takes typing). Short clips, one request a line,
 * nothing streamed.
 */

import { createFauxCore, fauxAssistantMessage } from "@earendil-works/pi-ai";
import fs from "node:fs";
import { ACTIVE_PROFILE } from "../../config.ts";
import { learnerProfileSegment } from "../agent/learner-profile.ts";
import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import type { Usage } from "@earendil-works/pi-ai";
import { CHAPTERS, curriculumState } from "../core/curriculum.ts";
import { LANGUAGES } from "../core/language.ts";
import { purposeScenes } from "../core/onboarding.ts";
import type { PronEngine, PronScore } from "../core/pronounce.ts";
import type { StoryUsage } from "../core/reading.ts";
import { addMinutes, sessionMs } from "../core/active-time.ts";
import { recordSpokenSlip, spokenSlip, type FirstTryCell } from "../core/first-try.ts";
import type { FormSlip } from "../core/form-slip.ts";
import { atlasCellOf } from "../core/grammar.ts";
import type { UnitId } from "../core/lesson.ts";
import { dayKey } from "../core/review.ts";
import {
	parseSummary,
	parseTutorReply,
	SPEAK_SCENES,
	SPEAK_TURNS,
	speakCounts,
	speakId,
	speakScene,
	speakXp,
	type SpeakCorrection,
	type SpeakIndexEntry,
	type SpeakScene,
	type SpeakSession,
	type SpeakTurn,
	type TutorReply,
} from "../core/speak.ts";
import { appendLessonLog, ensureReadmes } from "../store/corpus.ts";
import { DEFAULT_GOAL, progressStore } from "../store/progress.ts";
import { speakStore } from "../store/speak.ts";
import { keyValue } from "./keys.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { pronounceEngine, pronunciationReport, type PronReport } from "./pronounce.ts";
import { resolveWord, storyEngine } from "./reading.ts";
import { enqueueWords } from "./review.ts";

const code = () => LANGUAGES[ACTIVE_PROFILE].code;
const tag = () => LANGUAGES[ACTIVE_PROFILE].tag;

// ─── The prompt ─────────────────────────────────────────────────────────────

const SYSTEM = `You play one role in a short spoken scene with a learner of Slovak inside a language app. The learner SAYS each line into a microphone (speech-to-text turns it into the text you see; small transcription slips in diacritics or word boundaries are not the learner's fault), and your reply is read out loud to them. You answer with ONE JSON object and nothing else: no prose, no code fences.

Reply shape, every turn:
{"sk": "<your line in Slovak, 1–2 short sentences at the learner's level>", "en": "<its meaning in the explanation language>", "prompt": null | {"yours": "<the learner's words with the slip, quoted>", "hint": "<a Slovak hint in brackets that names the trigger and starts the right form without giving it, e.g. (do škol…? skús ešte raz) or (včera — bol, bola…?)>", "kind": "case" | "verb" | "aspect"}, "repaired": true | false, "end": true | false}

The rules:
- Stay in the scene and in character. Slovak only in "sk". One exchange at a time; end your line so the learner has something to say next (a question, an offer, a choice).
- Keep the scene moving: meaning first. Never explain grammar mid-scene.
- Prompts, not recasts. When the learner's last line has a slip in a CASE ending, a VERB ending or ASPECT, give ONE prompt: the exact words of theirs in "yours", a Slovak hint in "hint" that makes them repair it themselves (the trigger word plus the opening of the form and "skús ešte raz"), and the kind. At most one prompt a turn; pick the most useful slip. Everything else (word choice, word order, spelling, a missing diacritic, transcription noise) you let go or use correctly in your own line without comment.
- When the turn before yours carried a prompt and the learner's new line repairs it (or says it right in other words), set "repaired": true and carry on warmly. If they did not repair it, do not prompt the same thing again; move on.
- The learner's level sets your language: short, common words, no idioms a learner would not know. If the profile says explain in a language, "en" is in that language; otherwise English.
- After the learner's ${SPEAK_TURNS}th line, or sooner when the scene reaches its natural end, say a closing line (a goodbye, a thank-you) and set "end": true. Never end before the learner has said at least 3 lines.`;

const SUMMARY_SYSTEM = `You are a Slovak tutor summing up a short spoken scene a learner just did. You answer with ONE JSON object and nothing else: no prose, no code fences.

{"corrections": [{"yours": "<the learner's words>", "right": "<the right Slovak>", "rule": "<the rule in at most twelve words, in the explanation language>", "kind": "case" | "verb" | "aspect" | "word" | "order" | "spelling" | "other", "lemma": "<dictionary form of the word the slip was on>"}], "keep": ["<a useful Slovak phrase from the scene>", "<another>"], "note": "<one encouraging sentence in the explanation language about what went well>"}

- At most THREE corrections, the most useful first: case, verb and aspect slips before word choice; never a diacritic alone, never transcription noise.
- "right" is the learner's own line put right, not a different sentence.
- Exactly two phrases in "keep": things the tutor or the learner said that are worth remembering as chunks.
- If the learner made no real slips, "corrections" is [] and the note says so.`;

function transcript(s: SpeakSession): string {
	return s.turns
		.map((t) => {
			if (t.role === "learner") return `Learner: ${t.text}`;
			const p = t.prompt ? ` [prompt on "${t.prompt.yours}": ${t.prompt.hint}]` : "";
			return `You: ${t.text}${p}`;
		})
		.join("\n");
}

function sceneBrief(scene: SpeakScene, s: SpeakSession): string {
	const profile = learnerProfileSegment();
	return [
		`The scene: you are ${scene.brief}.`,
		`The learner's task: ${scene.task}`,
		`Level: ${s.level}. Chapter on the map: ${CHAPTERS.find((c) => c.id === s.chapter)?.title ?? s.chapter}.`,
		profile ? `\n${profile}` : "",
	]
		.filter(Boolean)
		.join("\n");
}

// ─── The engine ─────────────────────────────────────────────────────────────

export interface SpeakOptions {
	/** Test seam: a scripted engine replaces the cheap slot's. */
	engine?: PiEngine;
	model?: string;
	now?: Date;
}

/** A scripted tutor for screenshots and UI work without a key:
 *  LH_SPEAK_SCRIPT=<path to a JSON array of reply objects>. Dev only;
 *  never set in the desktop app. Each call answers with the next entry
 *  (the last one repeats). */
let scripted: { file: string; engine: PiEngine; model: string } | null = null;
function scriptedEngine(): { engine: PiEngine; model: string } | null {
	const file = process.env.LH_SPEAK_SCRIPT;
	if (!file || process.env.NODE_ENV === "production") return null;
	// One reader per process, so the replies advance across calls.
	if (scripted?.file === file) return scripted;
	try {
		const replies = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown[];
		if (!Array.isArray(replies) || replies.length === 0) return null;
		const faux = createFauxCore({ tokenSize: { min: 32, max: 32 } });
		let i = 0;
		const next = () => replies[Math.min(i++, replies.length - 1)]!;
		faux.setResponses([]);
		const engine: PiEngine = {
			model: faux.getModel(),
			streamFn: (model, context, options) => {
				// A new scene starts the script over.
				const last = context.messages[context.messages.length - 1];
				const text = last && typeof last.content === "string" ? last.content : Array.isArray(last?.content) ? last.content.map((c) => ("text" in c ? c.text : "")).join("") : "";
				if (/Open the scene with your first line/.test(text)) i = 0;
				faux.setResponses([fauxAssistantMessage(JSON.stringify(next()))]);
				return faux.streamSimple(model, context, options);
			},
		};
		scripted = { file, engine, model: "faux:script" };
		return scripted;
	} catch {
		return null;
	}
}

function resolveEngine(opts: SpeakOptions): { engine: PiEngine; model: string } {
	if (opts.engine) return { engine: opts.engine, model: opts.model ?? "faux:test" };
	const scripted = scriptedEngine();
	if (scripted) return scripted;
	const real = storyEngine();
	if (!real) throw new Error("No model is configured. Set the cheap slot in Settings → Models.");
	return real;
}

function stepOf(u: Usage): StoryUsage["steps"][number] {
	return {
		inputTokens: u.input,
		outputTokens: u.output,
		cacheReadTokens: u.cacheRead,
		cacheWriteTokens: u.cacheWrite,
		cacheWrite1hTokens: u.cacheWrite1h ?? 0,
		reasoningTokens: u.reasoning,
	};
}

async function ask(engine: PiEngine, systemPrompt: string, prompt: string, usage: StoryUsage): Promise<string> {
	const { text } = await runSubagent([], {
		role: "researcher",
		engine,
		systemPrompt,
		prompt,
		maxTurns: 1,
		onUsage: (u) => usage.steps.push(stepOf(u)),
	});
	return text;
}

// ─── Speech-to-text ─────────────────────────────────────────────────────────

export type SttEngine = "elevenlabs" | "deepgram" | "groq";

/** Which speech-to-text engine a line would go to; null when neither key
 *  is set (the screen then takes typing only). */
/** Dev only: LH_STT_SCRIPT=<text> answers every recording with that
 *  transcript, so the spoken flow runs without a key. */
const sttScript = () => (process.env.NODE_ENV !== "production" ? process.env.LH_STT_SCRIPT : undefined);

export function sttEngine(): SttEngine | null {
	if (sttScript()) return "elevenlabs";
	if (keyValue("ELEVENLABS_API_KEY")) return "elevenlabs";
	if (keyValue("GROQ_API_KEY")) return "groq";
	if (keyValue("DEEPGRAM_API_KEY")) return "deepgram";
	return null;
}

export const STT_MAX_BYTES = 8 * 1024 * 1024;

/** ElevenLabs's language codes are ISO 639-3. */
const ISO3: Record<string, string> = { sk: "slk", ru: "rus" };

/** Transcribe one recording (16 kHz mono WAV) in the active language.
 *  Throws when the engine refuses; returns "" for silence. */
export async function transcribe(audio: Uint8Array, lang = code()): Promise<{ text: string; engine: SttEngine }> {
	const engine = sttEngine();
	if (!engine) throw new Error("No speech-to-text key: add an ElevenLabs, Groq, or Deepgram key in Settings → Keys, or type your line.");
	if (audio.byteLength === 0) return { text: "", engine };
	if (sttScript()) return { text: sttScript()!, engine };
	if (engine === "groq") {
		const form = new FormData();
		form.set("model", "whisper-large-v3-turbo");
		form.set("language", lang);
		form.set("response_format", "json");
		form.set("file", new Blob([audio as BlobPart], { type: "audio/wav" }), "line.wav");
		const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
			method: "POST",
			headers: { Authorization: `Bearer ${keyValue("GROQ_API_KEY")!}` },
			body: form,
		});
		if (!res.ok) throw new Error(`Groq Whisper speech-to-text failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
		const data = (await res.json()) as { text?: string };
		return { text: (data.text ?? "").trim(), engine };
	}
	if (engine === "elevenlabs") {
		const form = new FormData();
		form.set("model_id", "scribe_v2");
		form.set("language_code", ISO3[lang] ?? lang);
		form.set("tag_audio_events", "false");
		form.set("diarize", "false");
		form.set("file", new Blob([audio as BlobPart], { type: "audio/wav" }), "line.wav");
		const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": keyValue("ELEVENLABS_API_KEY")! }, body: form });
		if (!res.ok) throw new Error(`ElevenLabs speech-to-text failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
		const data = (await res.json()) as { text?: string };
		return { text: (data.text ?? "").trim(), engine };
	}
	const url = `https://api.deepgram.com/v1/listen?model=nova-2&language=${encodeURIComponent(lang)}&smart_format=true&punctuate=true`;
	const res = await fetch(url, { method: "POST", headers: { Authorization: `Token ${keyValue("DEEPGRAM_API_KEY")!}`, "Content-Type": "audio/wav" }, body: audio as BodyInit });
	if (!res.ok) throw new Error(`Deepgram failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
	const data = (await res.json()) as { results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> } };
	return { text: (data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "").trim(), engine };
}

// ─── The scenes ─────────────────────────────────────────────────────────────

export interface SpeakState {
	/** The scenes, the chapter's and the purposes' first. */
	scenes: Array<SpeakScene & { suggested: boolean; done: number }>;
	canSpeak: boolean;
	stt: SttEngine | null;
	/** How spoken lines are scored for clarity: sound by sound, from the transcript, or not at all. */
	pron: PronEngine | null;
	/** A scene started and not finished (reopen or drop). */
	unfinished: { id: string; scene: string; sceneTitle: string; turns: number } | null;
	recent: SpeakIndexEntry[];
}

export function speakState(): SpeakState {
	const p = progressStore.read();
	const goal = p.goal ?? DEFAULT_GOAL;
	const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	const chapterScene = state.chapters.find((c) => c.id === state.current)?.units.find((u) => u.kind === "goal")?.scene;
	const wanted = [...new Set([chapterScene, ...purposeScenes(goal.purposes ?? [])].filter((s): s is string => !!s))];
	const done = speakStore.list();
	const count = (id: string) => done.filter((d) => d.scene === id).length;
	const scenes = [...SPEAK_SCENES]
		.sort((a, b) => Number(wanted.includes(b.id)) - Number(wanted.includes(a.id)) || wanted.indexOf(a.id) - wanted.indexOf(b.id))
		.map((s) => ({ ...s, suggested: wanted.includes(s.id), done: count(s.id) }));
	const open = speakStore.unfinished()[0];
	return {
		scenes,
		canSpeak: storyEngine() !== null || scriptedEngine() !== null,
		stt: sttEngine(),
		pron: pronounceEngine(),
		unfinished: open && open.turns.some((t) => t.role === "learner") ? { id: open.id, scene: open.scene, sceneTitle: open.sceneTitle, turns: speakCounts(open.turns).learner } : null,
		recent: done.slice(-8).reverse(),
	};
}

// ─── A scene, turn by turn ──────────────────────────────────────────────────

let inFlight: Promise<unknown> | null = null;

/** One model call at a time across the process (a double click never
 *  pays twice). */
function serial<T>(run: () => Promise<T>): Promise<T> {
	const next = (inFlight ?? Promise.resolve()).then(run, run);
	inFlight = next.catch(() => undefined);
	return next;
}

/** Open a scene: the record, the tutor's first line. */
export function speakStart(sceneId: string, opts: SpeakOptions = {}): Promise<SpeakSession> {
	return serial(async () => {
		const scene = speakScene(sceneId);
		if (!scene) throw new Error(`unknown scene ${sceneId}`);
		const now = opts.now ?? new Date();
		const p = progressStore.read();
		const goal = p.goal ?? DEFAULT_GOAL;
		const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
		const { engine, model } = resolveEngine(opts);
		const s: SpeakSession = {
			id: speakId(now, scene.id),
			lang: code(),
			scene: scene.id,
			sceneTitle: scene.title,
			level: state.level,
			chapter: state.current,
			startedAt: now.toISOString(),
			turns: [],
			usage: { model, steps: [] },
		};
		const reply = parseTutorReply(await ask(engine, SYSTEM, `${sceneBrief(scene, s)}\n\nOpen the scene with your first line.`, s.usage));
		s.turns.push(tutorTurn(reply, now));
		speakStore.put(s);
		ensureReadmes();
		return s;
	});
}

function tutorTurn(reply: TutorReply, now: Date): SpeakTurn {
	return {
		role: "tutor",
		text: reply.sk,
		en: reply.en,
		...(reply.prompt ? { prompt: reply.prompt } : {}),
		...(reply.repaired ? { repaired: true } : {}),
		at: now.toISOString(),
	};
}

export interface SpeakTurnInput {
	id: string;
	text: string;
	via: "voice" | "typed";
	ms?: number;
	/** The learner's recording, kept next to the session as `NN.wav`. */
	audio?: { data: Uint8Array };
	/** How clearly the line was said, scored by /api/pronounce on the way in. */
	pron?: PronScore;
}

export interface SpeakTurnOutcome {
	session: SpeakSession;
	/** The tutor's new line. */
	reply: SpeakTurn;
	/** The scene is over: call speakEnd for the summary. */
	end: boolean;
}

/** The learner said a line: keep it (and the recording), get the tutor's. */
export function speakTurn(input: SpeakTurnInput, opts: SpeakOptions = {}): Promise<SpeakTurnOutcome> {
	return serial(async () => {
		const s = speakStore.get(input.id);
		if (!s) throw new Error(`unknown scene ${input.id}`);
		if (s.endedAt) throw new Error("this scene is over");
		const scene = speakScene(s.scene)!;
		const now = opts.now ?? new Date();
		const text = input.text.replace(/\s+/g, " ").trim().slice(0, 600);
		if (!text) throw new Error("say something first");
		const n = speakCounts(s.turns).learner + 1;
		const turn: SpeakTurn = { role: "learner", text, via: input.via, at: now.toISOString(), ...(input.ms ? { ms: input.ms } : {}), ...(input.pron ? { pron: input.pron } : {}) };
		if (input.audio && input.audio.data.byteLength > 0) {
			try {
				turn.audio = speakStore.putRecording(s.id, n, input.audio.data);
			} catch (err) {
				console.warn("[speak] could not keep the recording:", err instanceof Error ? err.message : err);
			}
		}
		s.turns.push(turn);
		speakStore.put(s);
		const { engine } = resolveEngine({ ...opts, model: s.usage.model });
		const prompt = [
			sceneBrief(scene, s),
			`\nThe scene so far:\n${transcript(s)}`,
			`\nThe learner has said ${n} line${n === 1 ? "" : "s"}${n >= SPEAK_TURNS ? ` — this was the last one, so close the scene now ("end": true)` : ""}. Answer the last line.`,
		].join("\n");
		let reply: TutorReply;
		try {
			reply = parseTutorReply(await ask(engine, SYSTEM, prompt, s.usage));
		} catch (err) {
			// The line got no answer: take it back out, so a retry does not
			// say it twice or spend a second turn of the cap.
			s.turns.pop();
			speakStore.put(s);
			throw err;
		}
		const forced = n >= SPEAK_TURNS;
		const t = tutorTurn(reply, now);
		s.turns.push(t);
		speakStore.put(s);
		return { session: s, reply: t, end: forced || reply.end === true };
	});
}

export interface SpeakEndInput {
	id: string;
	ms?: number;
	/** Active milliseconds since the last send (src/core/active-time.ts). */
	activeMs?: number;
	tz?: number;
}

export interface SpeakOutcome {
	session: SpeakSession;
	xp: number;
	queued: string[];
	summary: ProgressSummary;
	/** What to work on in pronunciation, across recent scenes and rounds. */
	report: PronReport;
}

/** The scene is over: the summary, the day's speaking, XP, the slips'
 *  words into the review deck, and the index line. A second call on an
 *  ended scene returns it as it is. */
export function speakEnd(input: SpeakEndInput, opts: SpeakOptions = {}): Promise<SpeakOutcome> {
	return serial(async () => {
		const s = speakStore.get(input.id);
		if (!s) throw new Error(`unknown scene ${input.id}`);
		const now = opts.now ?? new Date();
		if (s.endedAt) return { session: s, xp: s.xp ?? 0, queued: s.queued ?? [], summary: progressSummary(input.tz, now), report: pronunciationReport() };
		const learner = speakCounts(s.turns).learner;
		if (learner === 0) throw new Error("nothing was said");
		const scene = speakScene(s.scene)!;
		const { engine } = resolveEngine({ ...opts, model: s.usage.model });
		const lexicon = loadLexicon();
		let summary = parseSummary(await ask(engine, SUMMARY_SYSTEM, `${sceneBrief(scene, s)}\n\nThe scene:\n${transcript(s)}\n\nSum it up.`, s.usage));
		summary = { ...summary, corrections: summary.corrections.map((c) => withSlug(c, lexicon)) };
		s.summary = summary;
		s.endedAt = now.toISOString();
		if (input.ms && Number.isFinite(input.ms)) s.ms = Math.round(input.ms);
		const counts = speakCounts(s.turns);
		const xp = speakXp(counts.learner, counts.repaired, counts.clear);
		s.xp = xp;
		const scored = s.turns.filter((t) => t.role === "learner" && t.pron);
		if (scored.length) s.pron = { average: Math.round(scored.reduce((n, t) => n + t.pron!.overall, 0) / scored.length), lines: scored.length, clear: counts.clear, engine: scored[scored.length - 1]!.pron!.engine };
		const slugs = [...new Set(summary.corrections.map((c) => c.slug).filter((x): x is string => !!x))];
		const queued = slugs.length ? enqueueWords(slugs, now) : [];
		s.queued = queued;
		speakStore.put(s);
		speakStore.index(s);
		// The day's ledger: the speaking task, XP, minutes.
		const p = progressStore.read();
		const key = dayKey(now, input.tz);
		const day = (p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
		day.speaks = (day.speaks ?? 0) + 1;
		day.xp += xp;
		addMinutes(day, "speak", sessionMs({ ms: s.ms, activeMs: input.activeMs }));
		p.xp += xp;
		// The slips on case forms, said in Speak, go to their drill and atlas cell.
		const slips = summary.corrections.map((c) => correctionSlip(c, lexicon));
		for (const hit of slips) {
			if (hit) p.units[hit.drill] = recordSpokenSlip(p.units[hit.drill] ?? { lessons: 0, reps: 0, correct: 0 }, hit.cell, hit.slip);
		}
		progressStore.write(p);
		try {
			appendLessonLog({
				id: s.id,
				at: now.toISOString(),
				day: key,
				unit: s.scene,
				mode: "speak",
				ms: s.ms,
				xp,
				correct: counts.repaired,
				total: counts.prompts,
				perfect: summary.corrections.length === 0 && !summary.unreadable,
				queued,
				reps: summary.corrections.map((c, i) => {
					const hit = slips[i];
					return {
						itemId: `${s.id}#${i}`,
						kind: c.kind,
						unit: s.scene,
						slug: c.slug ?? "",
						lemma: c.lemma ?? "",
						gloss: "",
						sentence: c.right,
						translation: "",
						answer: c.right,
						given: c.yours,
						verdict: "wrong",
						assisted: false,
						hint: c.rule,
						...(hit ? { drill: hit.drill, slip: hit.slip, ...(hit.gender ? { gender: hit.gender } : {}) } : {}),
					};
				}),
			});
		} catch (err) {
			console.warn("[speak] could not append the lesson log:", err instanceof Error ? err.message : err);
		}
		return { session: s, xp, queued, summary: progressSummary(input.tz, now), report: pronunciationReport() };
	});
}

/** A correction's slip on a case form, located on the atlas: the drill the
 *  phrase puts the word in, the cell its gender fills (null when the gender
 *  has no column), and the slip. Null when the correction is not about a
 *  case form. */
export function correctionSlip(c: SpeakCorrection, lexicon: Lexicon | null): { drill: UnitId; slip: FormSlip; cell: FirstTryCell; gender?: string } | null {
	const entry = c.slug ? lexicon?.bySlug.get(c.slug) : undefined;
	const hit = entry ? spokenSlip(entry, c.yours, c.right, tag()) : undefined;
	if (!entry || !hit) return null;
	return { drill: hit.drill, slip: hit.slip, cell: atlasCellOf(hit.drill, entry.gender), ...(entry.gender ? { gender: entry.gender } : {}) };
}

/** The dictionary word a correction is about, so it can join the deck:
 *  the lemma the model named, else the first word of the right line that
 *  differs from the learner's. */
function withSlug(c: SpeakCorrection, lexicon: Lexicon | null): SpeakCorrection {
	if (!lexicon) return c;
	const none = new Set<string>();
	const tryForm = (form: string) => resolveWord(lexicon, form, none, { stem: true });
	let entry = c.lemma ? tryForm(c.lemma) : undefined;
	if (!entry) {
		const mine = new Set(c.yours.toLocaleLowerCase(tag()).split(/[^\p{L}]+/u));
		for (const w of c.right.split(/[^\p{L}]+/u)) {
			if (!w || mine.has(w.toLocaleLowerCase(tag()))) continue;
			entry = tryForm(w);
			if (entry) break;
		}
	}
	return entry ? { ...c, lemma: entry.sk, slug: entry.slug } : c;
}

/** Drop a scene that never got going (no learner line), so the next
 *  visit does not offer to resume it. */
export function speakDrop(id: string): void {
	const s = speakStore.get(id);
	if (!s || s.endedAt) return;
	s.endedAt = new Date().toISOString();
	speakStore.put(s);
	speakStore.index(s);
}
