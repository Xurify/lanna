import {
	parseVerdict,
	SENTENCE_MAX_CHARS,
	SENTENCE_TARGETS,
	SENTENCE_XP,
	sentenceProblems,
	usesLemma,
} from "./sentences.ts";
import type { VideoRecord } from "./watch.ts";

export { parseVerdict, SENTENCE_MAX_CHARS, SENTENCE_TARGETS, SENTENCE_XP, sentenceProblems, usesLemma };

export interface SentenceTarget {
	lemma: string;
	slug?: string;
	gloss: string;
	line: string;
	at: number;
}

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

export function sentenceTargets(
	video: VideoRecord,
	tapped: readonly string[] = [],
	max = SENTENCE_TARGETS,
): SentenceTarget[] {
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
			if (tok.word && tok.slug && tapped.includes(tok.slug))
				add({ lemma: tok.lemma ?? tok.text, slug: tok.slug, gloss: tok.gloss ?? "", line: seg.sk, at: seg.i });
		}
	}
	for (const w of video.preTeach)
		add({ lemma: w.lemma, ...(w.slug ? { slug: w.slug } : {}), gloss: w.gloss, line: w.example, at: w.at });
	return out;
}
