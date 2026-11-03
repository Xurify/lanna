/**
 * Pace: how fast a clip is spoken, in syllables a second, and the playback
 * rate that brings it to the pace the learner asked for.
 *
 * The speed setting (0.75×, 1×, 1.25×) used to be a plain multiplier on whatever
 * was recorded, but the clips are not recorded at one pace: measured on 49
 * slovak.wiki clips (2026-11-03) the pace runs from 2.3 to 5.4 syllables a second
 * (median 3.9), short sentences slowest, and the other voices (ElevenLabs, Edge at
 * +15%, Piper) have their own base pace. So "1×" meant a different speed on
 * every sentence, and the snail meant "very slow" on one clip and "normal" on
 * another. Here the setting is a multiplier of a fixed pace instead, and each
 * clip is played at the rate that reaches it. Research: docs/research/voice-pace.md.
 */

/** The pace "1×" means: about the median of the slovak.wiki clips, so a typical clip plays at about 1.0. */
export const NORMAL_SYLLABLES_PER_SECOND = 4;

/** Below this a clip is a word or two, and its length is mostly the onset and the tail, so the multiplier is used as it is. */
const MIN_SECONDS = 0.8;
const MIN_SYLLABLES = 3;
/** How far a clip may be corrected toward the pace, before the setting is applied. A slow recording sped up by more than about a third no longer sounds like the same speaker at an easy pace: it sounds rushed (a sentence recorded at 2.5 syllables a second, corrected by 1.58×, was heard as "very very fast" next to one that was left alone). So the correction narrows the spread (2.3× across the library) to about 1.4× instead of removing it. */
const MIN_CORRECTION = 0.8;
const MAX_CORRECTION = 1.3;
/** The absolute limits on the final rate: under 0.6× the browser's pitch-keeping time-stretch smears the voice, over 1.8× it chatters. */
const MIN_RATE = 0.6;
const MAX_RATE = 1.8;

const SK_VOWELS = "aeiouyáäéíóôúý";
const RU_VOWELS = "аеёиоуыэюя";

/** Syllables in a text. Slovak: a vowel is a syllable, ia / ie / iu count once (diphthongs), and r, l, ŕ, ĺ between consonants carry one (vlk, krk). Russian: one per vowel. Anything else: vowel groups. An estimate (±1 on a long word), good enough for a rate. */
export function countSyllables(text: string, lang = "sk"): number {
	const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
	let n = 0;
	for (const w of words) {
		if (lang === "ru") {
			for (const c of w) if (RU_VOWELS.includes(c)) n++;
			continue;
		}
		for (let i = 0; i < w.length; i++) {
			const c = w[i]!;
			if (SK_VOWELS.includes(c)) {
				if (c === "i" && i + 1 < w.length && "aeu".includes(w[i + 1]!)) i++;
				n++;
			} else if ("rlŕĺ".includes(c) && w.length > 1 && (i === 0 || !SK_VOWELS.includes(w[i - 1]!)) && (i + 1 === w.length || !SK_VOWELS.includes(w[i + 1]!))) {
				n++;
			}
		}
	}
	return n;
}

/**
 * The playback rate for one clip. `multiplier` is the learner's setting (0.75, 1, 1.25, or the slow button's 0.6–0.7).
 * The clip's own pace is syllables over seconds; it is nudged toward NORMAL by at most MIN_CORRECTION..MAX_CORRECTION, and the setting multiplies that.
 */
export function paceRate(syllables: number, seconds: number, multiplier: number): number {
	if (!Number.isFinite(seconds) || seconds < MIN_SECONDS || syllables < MIN_SYLLABLES) return multiplier;
	const clipPace = syllables / seconds;
	const correction = Math.min(MAX_CORRECTION, Math.max(MIN_CORRECTION, NORMAL_SYLLABLES_PER_SECOND / clipPace));
	return Math.min(MAX_RATE, Math.max(MIN_RATE, correction * multiplier));
}
