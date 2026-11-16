/**
 * Study sections (LangHarness, 2026-11-07; docs/research/watch-sections.md):
 * a model picks the parts of a prepared video worth studying and the words in
 * them; the program builds the exercises from the real caption lines. The
 * model never writes a sentence (E27, E44): it returns line numbers and
 * words, and a word that is not a word of its line is dropped.
 * Pure: the server runs the model and keeps the answer.
 */

import { compareAnswer, type AnswerVerdict } from "./language.ts";
import type { StoryToken, StoryUsage } from "./reading.ts";

const MAX_SECTIONS = 3;
const SECTION_MIN_LINES = 3;
const SECTION_MAX_LINES = 20;
const FOCUS_MAX = 6;
/** Lines shown to the model at most; a longer video is offered from its start. */
export const SECTION_PROMPT_LINES = 400;

interface Line {
	i: number;
	start: number;
	end: number;
	sk: string;
	en: string;
	tokens: readonly StoryToken[];
}

export interface SectionFocus {
	/** The segment index of the line. */
	at: number;
	/** The token index of the word in that line. */
	token: number;
	/** The word as the line has it. */
	word: string;
	lemma?: string;
	slug?: string;
	gloss?: string;
}

export interface StudySection {
	/** First and last segment index, inclusive. */
	from: number;
	to: number;
	title: string;
	why: string;
	focus: SectionFocus[];
}

/** What is kept per video (videos/sections/<id>.json). */
export interface SectionsRecord {
	videoId: string;
	level: string;
	createdAt: string;
	model: string;
	sections: StudySection[];
	/** Lines the model saw, from the start of the video. */
	linesShown: number;
	usage: StoryUsage;
}

export function sectionsSystem(name: string): string {
	return `You help a beginner study a ${name} video. You are given its caption lines, numbered, each with an English translation; words the learner has not studied are marked [like this]. Pick the parts worth studying.

Answer with ONE JSON object and nothing else:
{"sections": [{"from": 12, "to": 20, "title": "...", "why": "...", "focus": [{"line": 14, "word": "..."}]}]}

Rules:
- 1 to ${MAX_SECTIONS} sections. Each is ${SECTION_MIN_LINES} to ${SECTION_MAX_LINES} consecutive lines that make sense on their own: one topic, one exchange, one story beat. They do not overlap.
- Prefer parts with clear speech about one thing, words that come back, and words useful in everyday life. Skip greetings, sponsor reads, outros and lines that are only names or noise.
- "title": what the part is about, at most 8 English words, sentence case.
- "why": one English sentence, at most 25 words: what the learner gets from it.
- "focus": 2 to ${FOCUS_MAX} words to practice, each copied EXACTLY as written in that line (same form, same accents), with the number of its line, inside the section. Prefer words the learner has not studied that carry the meaning; one word per line at most.
- Never invent, correct or translate ${name} text. Nothing outside the JSON.`;
}

/** The numbered lines, unstudied words marked, for the model. */
export function sectionsPrompt(video: { title: string; segments: readonly Line[] }, level: string): string {
	const lines = video.segments.slice(0, SECTION_PROMPT_LINES).map((s) => {
		const marked = s.tokens.map((t) => (t.word && t.fresh ? `[${t.text}]` : t.text)).join("");
		return `${s.i}. ${marked.trim()} — ${s.en.trim()}`;
	});
	const cut =
		video.segments.length > SECTION_PROMPT_LINES
			? `\n(The video has ${video.segments.length} lines; these are the first ${SECTION_PROMPT_LINES}.)`
			: "";
	return `The video: ${JSON.stringify(video.title)}. The learner's level: ${level}.${cut}\n\n${lines.join("\n")}`;
}

const norm = (s: string) => s.normalize("NFC").toLocaleLowerCase().trim();

function firstJson(text: string): unknown {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end < start) return null;
	try {
		return JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** The model's answer, kept only where it holds against the video: real line
 *  ranges of the allowed length that do not overlap, and focus words that are
 *  words of their line. A section with no focus word left is dropped. */
export function parseSections(text: string, video: { segments: readonly Line[] }): StudySection[] {
	const raw = firstJson(text) as { sections?: unknown } | null;
	if (!raw || !Array.isArray(raw.sections)) return [];
	const byIndex = new Map(video.segments.map((s) => [s.i, s]));
	const taken: Array<[number, number]> = [];
	const out: StudySection[] = [];
	for (const r of raw.sections.slice(0, MAX_SECTIONS * 2)) {
		if (out.length >= MAX_SECTIONS || !r || typeof r !== "object") continue;
		const s = r as Record<string, unknown>;
		const from = Number(s.from);
		let to = Number(s.to);
		if (!Number.isInteger(from) || !Number.isInteger(to) || !byIndex.has(from) || to < from) continue;
		to = Math.min(to, from + SECTION_MAX_LINES - 1);
		while (to > from && !byIndex.has(to)) to--;
		if (to - from + 1 < SECTION_MIN_LINES) continue;
		if (taken.some(([a, b]) => from <= b && to >= a)) continue;
		const used = new Set<number>();
		const focus: SectionFocus[] = [];
		for (const f of Array.isArray(s.focus) ? s.focus : []) {
			if (focus.length >= FOCUS_MAX || !f || typeof f !== "object") continue;
			const line = Number((f as Record<string, unknown>).line);
			const word = clip((f as Record<string, unknown>).word, 60);
			const seg = byIndex.get(line);
			if (!seg || line < from || line > to || used.has(line) || !word) continue;
			const token = seg.tokens.findIndex((t) => t.word && norm(t.text) === norm(word));
			if (token < 0) continue;
			const t = seg.tokens[token]!;
			used.add(line);
			focus.push({
				at: line,
				token,
				word: t.text,
				...(t.lemma ? { lemma: t.lemma } : {}),
				...(t.slug ? { slug: t.slug } : {}),
				...(t.gloss ? { gloss: t.gloss } : {}),
			});
		}
		if (!focus.length) continue;
		focus.sort((a, b) => a.at - b.at);
		taken.push([from, to]);
		out.push({ from, to, title: clip(s.title, 80) || `Lines ${from + 1} to ${to + 1}`, why: clip(s.why, 200), focus });
	}
	return out.sort((a, b) => a.from - b.from);
}

/** One typed gap in a real line. */
export interface SectionRep {
	id: string;
	at: number;
	/** The line around the gap, as written. */
	before: string;
	answer: string;
	after: string;
	line: string;
	en: string;
	start: number;
	end: number;
	lemma?: string;
	slug?: string;
	gloss?: string;
}

export function sectionRepId(videoId: string, at: number, token: number): string {
	return `${videoId}:${at}:${token}`;
}

/** The section's gaps, in line order, built from the stored lines alone. */
export function sectionReps(video: { id: string; segments: readonly Line[] }, section: StudySection): SectionRep[] {
	const byIndex = new Map(video.segments.map((s) => [s.i, s]));
	return section.focus.flatMap((f) => {
		const seg = byIndex.get(f.at);
		const t = seg?.tokens[f.token];
		if (!seg || !t || !t.word) return [];
		return [
			{
				id: sectionRepId(video.id, f.at, f.token),
				at: f.at,
				before: seg.tokens
					.slice(0, f.token)
					.map((x) => x.text)
					.join(""),
				answer: t.text,
				after: seg.tokens
					.slice(f.token + 1)
					.map((x) => x.text)
					.join(""),
				line: seg.sk,
				en: seg.en,
				start: seg.start,
				end: seg.end,
				...(f.lemma ? { lemma: f.lemma } : {}),
				...(f.slug ? { slug: f.slug } : {}),
				...(f.gloss ? { gloss: f.gloss } : {}),
			},
		];
	});
}

/** The typed word against the gap: case does not count, accents-only is its own verdict. */
export function gradeGap(answer: string, typed: string, tag: string): AnswerVerdict {
	return compareAnswer(answer.toLocaleLowerCase(), typed.toLocaleLowerCase(), tag);
}

/** The smallest cue after a first miss: the first letter and one dot per letter left. */
export function gapCue(answer: string): string {
	const letters = [...answer];
	return letters[0] + "·".repeat(Math.max(0, letters.length - 1));
}

/** One finished gap, as the client sends it. */
export interface GapResult {
	id: string;
	verdict: AnswerVerdict;
	/** Right only after the cue, or "I don't know". */
	assisted: boolean;
}
