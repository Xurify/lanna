/**
 * Get ready (LangHarness, 2026-11-07; docs/research/pre-listening.md): what a
 * learner studies before a video they cannot yet follow. One cheap-slot
 * request reads the caption lines and returns a briefing:
 *
 *   about    what the video is and who speaks, in English;
 *   parts    the video in order, each part a range of real lines and one
 *            English statement of what is said there (an advance organizer:
 *            Herron 1994; declarative beats questions, Herron et al. 1998);
 *   keys     the words and short phrases that carry the topic, each copied
 *            from a real line (the program checks it is there);
 *   summary  the same content in a few short sentences in the language, at
 *            the learner's level, glossed and measured like a Read episode.
 *
 * Chang & Read (2006) found that telling learners what a passage is about
 * helped listening more than teaching its words did, and helped weaker
 * listeners most; so the briefing leads with the content and ends with the
 * words. The words are then typed into their real lines (retrieval, P3).
 *
 * The model never writes a caption line: a key that is not a word of its
 * line is dropped, and the summary is the only language it writes, kept as
 * graded input like a story (E27 covers drill sentences, not graded text).
 * Pure: the server runs the model, glosses the summary and keeps the answer.
 */

import { COVERAGE_FLOOR, type StoryToken, type StoryUsage, type StoryWord } from "./reading.ts";
import { sectionRepId, type SectionRep } from "./watch-sections.ts";

export const PREP_PARTS_MIN = 3;
export const PREP_PARTS_MAX = 8;
export const PREP_KEYS_MIN = 6;
export const PREP_KEYS_MAX = 12;
/** Words in one key: a word, or a phrase of up to three. */
export const PREP_KEY_WORDS_MAX = 3;
export const PREP_SUMMARY_MIN = 3;
export const PREP_SUMMARY_MAX = 10;
/** Lines shown to the model at most; a longer video is briefed from its start. */
export const PREP_PROMPT_LINES = 400;
/** Below this share of words the level expects (the keys counted as taught)
 *  the summary is written again once, like a Read episode. */
export const PREP_SUMMARY_FLOOR = COVERAGE_FLOOR;

interface Line {
	i: number;
	start: number;
	end: number;
	sk: string;
	en: string;
	tokens: readonly StoryToken[];
}

export interface PrepPart {
	/** First and last segment index, inclusive. */
	from: number;
	to: number;
	/** One English statement of what is said there. */
	what: string;
}

export interface PrepKey {
	/** The segment index of the line. */
	at: number;
	/** The index of the first word token in that line. */
	token: number;
	/** How many word tokens the key spans (1 for a word). */
	span: number;
	/** The key as the line has it. */
	text: string;
	/** What it means here, in a few English words. */
	why: string;
	lemma?: string;
	slug?: string;
	gloss?: string;
}

export interface PrepSentence {
	sk: string;
	en: string;
	tokens: StoryToken[];
}

/** What is kept per video (videos/prep/<id>.json). */
export interface PrepRecord {
	videoId: string;
	level: string;
	createdAt: string;
	model: string;
	about: string;
	parts: PrepPart[];
	keys: PrepKey[];
	summary: PrepSentence[];
	/** Share of the summary's words the learner has studied (grammar words,
	 *  names and numbers count), as Watch measures a video. */
	summaryKnown: number;
	/** The share a learner at the level is expected to know, the keys counted. */
	summaryExpected: number;
	/** How many times the summary was written (1, or 2 after a redraft). */
	drafts: number;
	/** Lines the model saw, from the start of the video. */
	linesShown: number;
	usage: StoryUsage;
	/** The last time the keys were typed into their lines. */
	done?: { at: string; right: number; total: number; xp: number };
}

export function prepSystem(name: string, level: string): string {
	return `You help a beginner get ready to watch a ${name} video they cannot yet follow. You are given its caption lines, numbered, each with an English translation; words the learner has not studied are marked [like this]. Write the briefing they study before watching.

Answer with ONE JSON object and nothing else:
{"about": "...", "parts": [{"from": 0, "to": 30, "what": "..."}], "keys": [{"line": 14, "words": "...", "why": "..."}], "summary": [{"sk": "...", "en": "..."}]}

Rules:
- "about": 1 to 3 English sentences, at most 60 words: what kind of video this is, who speaks (as far as the lines show), and what they talk about. Plain statements, no questions.
- "parts": ${PREP_PARTS_MIN} to ${PREP_PARTS_MAX} parts in order that together follow the video from its first line to its last. Each has "from" and "to" (line numbers, inclusive; parts do not overlap) and "what": one English sentence, at most 25 words, saying what happens or what is said there. Statements, not questions.
- "keys": ${PREP_KEYS_MIN} to ${PREP_KEYS_MAX} words or short phrases (1 to ${PREP_KEY_WORDS_MAX} consecutive words) the learner needs to follow this video: the ones that carry its topic, come back, and are useful beyond it. Each is copied EXACTLY as written in its line (same form, same accents, same order), with the number of that line; at most one key per line; prefer marked words. "why": at most 8 English words, what it means here.
- "summary": ${PREP_SUMMARY_MIN + 2} to ${PREP_SUMMARY_MAX - 2} short sentences in ${name}, each with its English, that say what the video says, in its order, for a learner at level ${level}: the commonest words, short main clauses, the keys above where they fit, at most 10 words a sentence. Use only names the lines give.
- Never correct, invent or translate the caption lines themselves. Nothing outside the JSON.`;
}

/** The numbered lines, unstudied words marked, for the model (the same view the study sections get). */
export function prepPrompt(video: { title: string; channel?: string; segments: readonly Line[] }, level: string): string {
	const lines = video.segments.slice(0, PREP_PROMPT_LINES).map((s) => {
		const marked = s.tokens.map((t) => (t.word && t.fresh ? `[${t.text}]` : t.text)).join("");
		return `${s.i}. ${marked.trim()} — ${s.en.trim()}`;
	});
	const cut = video.segments.length > PREP_PROMPT_LINES ? `\n(The video has ${video.segments.length} lines; these are the first ${PREP_PROMPT_LINES}.)` : "";
	const by = video.channel ? ` Channel: ${JSON.stringify(video.channel)}.` : "";
	return `The video: ${JSON.stringify(video.title)}.${by} The learner's level: ${level}.${cut}\n\n${lines.join("\n")}`;
}

/** The system prompt for the one redraft of the summary. */
export function summaryAgainSystem(name: string, level: string): string {
	return `You write a short summary in ${name} for a learner at level ${level}. Answer with ONE JSON object and nothing else: {"summary": [{"sk": "...", "en": "..."}]}. ${PREP_SUMMARY_MIN + 2} to ${PREP_SUMMARY_MAX - 2} sentences, at most 10 words each, the commonest words, short main clauses. Nothing outside the JSON.`;
}

export function summaryAgainPrompt(video: { title: string }, summary: readonly { sk: string; en: string }[], hard: readonly string[], keys: readonly string[]): string {
	return `The video: ${JSON.stringify(video.title)}.

Your summary used too many words the learner does not know. Write it again with simpler, more common words, saying the same things in the same order. Avoid these in particular: ${hard.join(", ")}.${keys.length ? ` These are fine, the learner is about to study them: ${keys.join(", ")}.` : ""}

The summary to rewrite:
${summary.map((s, i) => `${i + 1}. ${s.sk} — ${s.en}`).join("\n")}`;
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

/** The model's parts, kept where they are real line ranges in order that do
 *  not overlap, each with a statement. */
export function parseParts(raw: unknown, video: { segments: readonly Line[] }): PrepPart[] {
	if (!Array.isArray(raw)) return [];
	const byIndex = new Map(video.segments.map((s) => [s.i, s]));
	const picked: PrepPart[] = [];
	for (const r of raw.slice(0, PREP_PARTS_MAX * 2)) {
		if (!r || typeof r !== "object") continue;
		const p = r as Record<string, unknown>;
		const from = Number(p.from);
		let to = Number(p.to);
		const what = clip(p.what, 200);
		if (!Number.isInteger(from) || !Number.isInteger(to) || !byIndex.has(from) || to < from || !what) continue;
		while (to > from && !byIndex.has(to)) to--;
		picked.push({ from, to, what });
	}
	picked.sort((a, b) => a.from - b.from || a.to - b.to);
	const out: PrepPart[] = [];
	for (const p of picked) {
		const last = out[out.length - 1];
		if (last && p.from <= last.to) continue;
		out.push(p);
		if (out.length >= PREP_PARTS_MAX) break;
	}
	return out;
}

/** Where the words of a key sit in a line: the index of its first word
 *  token when the words follow each other with nothing but spaces between
 *  them, else -1. Case does not count; accents do. */
export function findSpan(tokens: readonly StoryToken[], words: readonly string[]): number {
	if (!words.length) return -1;
	const wanted = words.map(norm);
	for (let i = 0; i < tokens.length; i++) {
		if (!tokens[i]!.word || norm(tokens[i]!.text) !== wanted[0]) continue;
		let j = i;
		let k = 1;
		let ok = true;
		while (k < wanted.length) {
			j++;
			// Spaces between the words are fine; punctuation or the end is not.
			while (j < tokens.length && !tokens[j]!.word && /^\s+$/.test(tokens[j]!.text)) j++;
			if (j >= tokens.length || !tokens[j]!.word || norm(tokens[j]!.text) !== wanted[k]) {
				ok = false;
				break;
			}
			k++;
		}
		if (ok) return i;
	}
	return -1;
}

/** The index just past the last token of a span that starts at `token` and
 *  holds `span` words. */
export function spanEnd(tokens: readonly StoryToken[], token: number, span: number): number {
	let words = 0;
	let j = token;
	while (j < tokens.length) {
		if (tokens[j]!.word) words++;
		j++;
		if (words === span) break;
	}
	return j;
}

/** The model's keys, kept where each is a run of words of its line as
 *  written; one per line, no two the same. */
export function parseKeys(raw: unknown, video: { segments: readonly Line[] }): PrepKey[] {
	if (!Array.isArray(raw)) return [];
	const byIndex = new Map(video.segments.map((s) => [s.i, s]));
	const usedLines = new Set<number>();
	const usedText = new Set<string>();
	const out: PrepKey[] = [];
	for (const r of raw.slice(0, PREP_KEYS_MAX * 2)) {
		if (out.length >= PREP_KEYS_MAX || !r || typeof r !== "object") continue;
		const k = r as Record<string, unknown>;
		const line = Number(k.line);
		const words = clip(k.words ?? k.word, 80).split(/\s+/).filter(Boolean);
		const seg = byIndex.get(line);
		if (!seg || usedLines.has(line) || !words.length || words.length > PREP_KEY_WORDS_MAX) continue;
		const token = findSpan(seg.tokens, words);
		if (token < 0) continue;
		const end = spanEnd(seg.tokens, token, words.length);
		const text = seg.tokens.slice(token, end).map((t) => t.text).join("");
		if (usedText.has(norm(text))) continue;
		const t = seg.tokens[token]!;
		usedLines.add(line);
		usedText.add(norm(text));
		const single = words.length === 1;
		out.push({
			at: line,
			token,
			span: words.length,
			text,
			why: clip(k.why, 80),
			...(single && t.lemma ? { lemma: t.lemma } : {}),
			...(single && t.slug ? { slug: t.slug } : {}),
			...(single && t.gloss ? { gloss: t.gloss } : {}),
		});
	}
	return out.sort((a, b) => a.at - b.at);
}

/** The model's summary sentences: a sentence in the language with its English. */
export function parsePrepSummary(raw: unknown): Array<{ sk: string; en: string }> {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((s) => (s && typeof s === "object" ? { sk: clip((s as Record<string, unknown>).sk, 240), en: clip((s as Record<string, unknown>).en, 300) } : null))
		.filter((s): s is { sk: string; en: string } => !!s && s.sk.length > 0)
		.slice(0, PREP_SUMMARY_MAX);
}

export interface ParsedPrep {
	about: string;
	parts: PrepPart[];
	keys: PrepKey[];
	summary: Array<{ sk: string; en: string }>;
}

/** The model's answer, kept only where it holds against the video's own
 *  lines. Null when nothing usable came back: no parts and no keys and no
 *  summary. */
export function parsePrep(text: string, video: { segments: readonly Line[] }): ParsedPrep | null {
	const raw = firstJson(text) as Record<string, unknown> | null;
	if (!raw) return null;
	const parts = parseParts(raw.parts, video);
	const keys = parseKeys(raw.keys, video);
	const summary = parsePrepSummary(raw.summary);
	if (!parts.length && !keys.length && !summary.length) return null;
	return { about: clip(raw.about, 500), parts, keys, summary };
}

/** The keys as words a summary may use freely (they are about to be studied). */
export function keyWords(keys: readonly PrepKey[]): StoryWord[] {
	return keys.filter((k) => k.span === 1 && k.lemma).map((k) => ({ lemma: k.lemma!, gloss: k.gloss ?? k.why, ...(k.slug ? { slug: k.slug } : {}) }));
}

/** The keys as typed gaps in their real lines, in line order, built from the
 *  stored lines alone (the same shape the study sections drill). */
export function prepReps(video: { id: string; segments: readonly Line[] }, keys: readonly PrepKey[]): SectionRep[] {
	const byIndex = new Map(video.segments.map((s) => [s.i, s]));
	return keys.flatMap((k) => {
		const seg = byIndex.get(k.at);
		const t = seg?.tokens[k.token];
		if (!seg || !t || !t.word) return [];
		const end = spanEnd(seg.tokens, k.token, k.span);
		return [
			{
				id: prepRepId(video.id, k.at, k.token),
				at: k.at,
				before: seg.tokens.slice(0, k.token).map((x) => x.text).join(""),
				answer: seg.tokens.slice(k.token, end).map((x) => x.text).join(""),
				after: seg.tokens.slice(end).map((x) => x.text).join(""),
				line: seg.sk,
				en: seg.en,
				start: seg.start,
				end: seg.end,
				...(k.lemma ? { lemma: k.lemma } : {}),
				...(k.slug ? { slug: k.slug } : {}),
				...(k.gloss ? { gloss: k.gloss } : k.why ? { gloss: k.why } : {}),
			},
		];
	});
}

export function prepRepId(videoId: string, at: number, token: number): string {
	return `${sectionRepId(videoId, at, token)}:key`;
}
