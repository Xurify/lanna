/**
 * The sentence step at the end of a Watch video (docs/plans/watch-sentences.md):
 * which words the learner writes with, what a program can see is wrong with
 * a sentence before any model is asked, and how a model's answer is read.
 * Pure: the server runs the model and keeps the verdicts.
 */

import { checkSlovak } from "./slovak-check.ts";
import type { VideoRecord } from "./watch.ts";

/** Words per video, at most. */
export const SENTENCE_TARGETS = 3;
/** XP the first time a word is accepted for a video. */
export const SENTENCE_XP = 5;
/** The longest sentence the step takes. */
export const SENTENCE_MAX_CHARS = 300;

export interface SentenceTarget {
	/** The dictionary form the sentence must use. */
	lemma: string;
	slug?: string;
	/** English meaning; shown after the first try. */
	gloss: string;
	/** The Slovak line the learner met the word in, and its segment index. */
	line: string;
	at: number;
}

/** One model verdict, as it is kept in sentences.jsonl. */
export interface SentenceCheckEntry {
	videoId: string;
	lemma: string;
	sentence: string;
	ok: boolean;
	corrected: string;
	why: string;
	model: string;
	at: string;
}

/** Up to three words for a video's sentence step: the words the learner
 *  tapped, in the order they come in the video, then the video's pre-teach
 *  words. A video whose captions are not in the learner's language gives
 *  none: its words are not the words being learned. */
export function sentenceTargets(video: VideoRecord, tapped: readonly string[] = [], max = SENTENCE_TARGETS): SentenceTarget[] {
	if (video.source.trackLang !== video.lang) return [];
	const out: SentenceTarget[] = [];
	const seen = new Set<string>();
	const add = (t: SentenceTarget): void => {
		const key = t.slug ?? t.lemma.toLocaleLowerCase("sk-SK");
		if (out.length >= max || seen.has(key)) return;
		seen.add(key);
		out.push(t);
	};
	for (const seg of video.segments) {
		for (const tok of seg.tokens) {
			if (tok.word && tok.slug && tapped.includes(tok.slug)) add({ lemma: tok.lemma ?? tok.text, slug: tok.slug, gloss: tok.gloss ?? "", line: seg.sk, at: seg.i });
		}
	}
	for (const w of video.preTeach) add({ lemma: w.lemma, ...(w.slug ? { slug: w.slug } : {}), gloss: w.gloss, line: w.example, at: w.at });
	return out;
}

/** Whether one of the words is the lemma or one of its forms. Forms are
 *  matched by their first letters: the lemma less its last letter, at least
 *  three letters ("káva" → "káv": kávu, kávy). A phrase is left to the model. */
export function usesLemma(words: readonly string[], lemma: string): boolean {
	const l = lemma.normalize("NFC").toLocaleLowerCase("sk-SK");
	if (/\s/.test(l)) return true;
	const stem = l.slice(0, Math.max(3, l.length - 1));
	return words.some((w) => w.toLocaleLowerCase("sk-SK").startsWith(stem));
}

/** The problems a program can see for certain in a sentence for `lemma`,
 *  before any model is asked. An empty list means none was found, not that
 *  the sentence is right. */
export function sentenceProblems(sentence: string, lemma: string): string[] {
	const text = sentence.normalize("NFC").trim();
	const words = text.match(/[\p{L}]+/gu) ?? [];
	if (words.length < 2) return ["Write a whole sentence, not only the word."];
	if (!usesLemma(words, lemma)) return [`Use "${lemma}" in the sentence, in any form.`];
	return checkSlovak(text).issues.map((i) => i.why);
}

export interface SentenceVerdict {
	ok: boolean;
	corrected: string;
	why: string;
}

/** Reads the model's answer: one JSON object with ok, corrected and why.
 *  Null when the answer is not that shape. */
export function parseVerdict(text: string, sentence: string): SentenceVerdict | null {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	let raw: unknown;
	try {
		raw = JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
	if (!raw || typeof raw !== "object") return null;
	const o = raw as { ok?: unknown; corrected?: unknown; why?: unknown };
	if (typeof o.ok !== "boolean" || typeof o.why !== "string" || !o.why.trim()) return null;
	const corrected = typeof o.corrected === "string" && o.corrected.trim() ? o.corrected.trim() : sentence;
	return { ok: o.ok, corrected, why: o.why.trim() };
}
