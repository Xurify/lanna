/**
 * Counting syllables, for measuring how fast a recording is spoken
 * (scripts/audio-pace.ts). It is NOT used to change playback: an attempt to
 * even out the pace of the slovak.wiki clips at playback time was made twice
 * before (6ed7944) and once more on 2026-11-03, and failed each time, because
 * the clips are recorded at a deliberately slow ElevenLabs speed and their pace
 * varies with the sentence. Clips play as recorded; see docs/research/voice-pace.md
 * and decision E37.
 */

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
			} else if (
				"rlŕĺ".includes(c) &&
				w.length > 1 &&
				(i === 0 || !SK_VOWELS.includes(w[i - 1]!)) &&
				(i + 1 === w.length || !SK_VOWELS.includes(w[i + 1]!))
			) {
				n++;
			}
		}
	}
	return n;
}
