/**
 * What a conversation measures without a model. Speech rate and the mean
 * length of run between pauses predict how fluent listeners judge a
 * speaker (Kormos & Dénes 2004; de Jong et al. 2013); fast turn-taking is
 * what a conversation runs on (Stivers et al. 2009). Everything here is
 * counted from the timed turns and the pauses the microphone measured. Pure
 * and browser-safe.
 */

import type { LiveTurn } from "./live.ts";

/** Vowels per language, counted in groups: the syllable estimate. */
const VOWELS = /[aeiouyáäéíóôŕúýеёуыаоэяиюõ]/giu;

/** English words that are not also a word of Slovak, Russian or Estonian:
 *  "a", "no", "so", "do", "to", "my", "i" and "je" are, so counting them
 *  would report English in a target-language sentence. */
const ENGLISH = new Set([
	"the",
	"and",
	"but",
	"like",
	"just",
	"really",
	"maybe",
	"well",
	"yes",
	"are",
	"was",
	"were",
	"have",
	"had",
	"does",
	"not",
	"your",
	"it",
	"this",
	"that",
	"because",
	"want",
	"okay",
]);

export const PAUSE_FLOOR_MS = 1_000;
export const REPLY_BAR_MS = 2_500;
/** Syllables a minute a learner turn needs to count as a fluent turn. */
export const SPEECH_RATE_BAR = 90;

export interface SpeechMetrics {
	talkSec: number;
	learnerSec: number;
	tutorSec: number;
	learnerShare: number;
	learnerTurns: number;
	tutorTurns: number;
	words: number;
	targetWords: number;
	englishWords: number;
	englishShare: number;
	wordsPerTurn: number;
	longestTurnSec: number;
	syllables: number;
	syllablesPerMinute: number;
	meanRunSec: number;
	meanRunWords: number;
	pausesOver1s: number;
	pausesPerMinute: number;
	medianReplyMs: number | null;
	fastReplies: number;
	replyTurns: number;
	distinctWords: number;
}

function words(text: string): string[] {
	return (
		text
			.normalize("NFC")
			.toLocaleLowerCase()
			.match(/[\p{L}\p{N}]+/gu) ?? []
	).filter(Boolean);
}

function syllablesOf(text: string): number {
	const groups = text.match(VOWELS);
	return groups ? groups.length : 0;
}

export function median(values: readonly number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export function speechMetrics(turns: readonly LiveTurn[], pausesMs: readonly number[] = []): SpeechMetrics {
	const learner = turns.filter((t) => t.role === "learner" && t.text.trim());
	const tutor = turns.filter((t) => t.role === "tutor" && t.text.trim());
	const talkMs = turns.length ? Math.max(...turns.map((t) => t.end)) - Math.min(...turns.map((t) => t.start)) : 0;
	const learnerMs = learner.reduce((n, t) => n + Math.max(0, t.end - t.start), 0);
	const tutorMs = tutor.reduce((n, t) => n + Math.max(0, t.end - t.start), 0);
	const all = learner.flatMap((t) => words(t.text));
	const englishWords = all.filter((w) => ENGLISH.has(w)).length;
	const distinct = new Set(all);
	const syllables = learner.reduce((n, t) => n + syllablesOf(t.text), 0);
	const pauses = pausesMs.filter((ms) => ms >= PAUSE_FLOOR_MS);
	const runs = pauses.length + learner.length;
	const replies: number[] = [];
	for (const turn of turns) {
		if (turn.role !== "learner") continue;
		const before = turns.filter((t) => t.role === "tutor" && t.end <= turn.start + 1).sort((a, b) => b.end - a.end)[0];
		if (before) replies.push(Math.max(0, Math.round(turn.start - before.end)));
	}
	const minutes = learnerMs / 60_000;
	return {
		talkSec: Math.round(talkMs / 1000),
		learnerSec: Math.round(learnerMs / 1000),
		tutorSec: Math.round(tutorMs / 1000),
		learnerShare: talkMs > 0 ? learnerMs / talkMs : 0,
		learnerTurns: learner.length,
		tutorTurns: tutor.length,
		words: all.length,
		targetWords: all.length - englishWords,
		englishWords,
		englishShare: all.length ? englishWords / all.length : 0,
		wordsPerTurn: learner.length ? all.length / learner.length : 0,
		longestTurnSec: learner.length ? Math.round(Math.max(...learner.map((t) => t.end - t.start)) / 1000) : 0,
		syllables,
		syllablesPerMinute: minutes > 0 ? Math.round(syllables / minutes) : 0,
		meanRunSec: runs ? Math.round(learnerMs / runs / 100) / 10 : 0,
		meanRunWords: runs ? Math.round((all.length / runs) * 10) / 10 : 0,
		pausesOver1s: pauses.length,
		pausesPerMinute: minutes > 0 ? Math.round((pauses.length / minutes) * 10) / 10 : 0,
		medianReplyMs: median(replies),
		fastReplies: replies.filter((ms) => ms <= REPLY_BAR_MS).length,
		replyTurns: replies.length,
		distinctWords: distinct.size,
	};
}
