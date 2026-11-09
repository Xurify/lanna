/**
 * Phonological Acquisition & Articulatory Diagnostics (LangHarness, 2026-11).
 *
 * Implements research-grounded phonological training:
 * 1. Articulatory motor cues & diagnostic guidance (Pillars 3 & 4; Ngo et al. 2024; Neri et al. 2008).
 * 2. Functional Load weighting in pronunciation scoring (Pillar 5; Catford 1987; Munro & Derwing 2006).
 * 3. Cross-linguistic contrast prioritization via PAM-L2 (Pillar 2; Best 1995; Best & Tyler 2007).
 * 4. Slovak voicing assimilation & orthographic de-biasing (Bassetti 2006; Nimz 2016).
 * 5. Minimal-Pair Ear Gym (HVPT) 2AFC drill generation (Pillar 1; Logan et al. 1991; Bradlow et al. 1997).
 *
 * Pure and browser-safe: no node builtins, bundled curriculum JSON.
 */

import phonologyPairsJson from "../../curriculum/slovak/phonology-pairs.json";
import type { LanguageId } from "./language.ts";
import { rng, shuffle } from "./lesson.ts";

// ─── Types ─────────────────────────────────────────────────────────────

export type PhonologyFamily =
	| "vowel_length"
	| "palatals"
	| "syllabic_liquids"
	| "diphthongs"
	| "voicing";

export type FunctionalLoadLevel = "high" | "medium" | "low";

export interface ArticulatoryCue {
	symbol: string;
	ipa: string;
	name: string;
	motor: string;
	commonPitfall: string;
	functionalLoad: FunctionalLoadLevel;
	drillWord: string;
}

export interface PhonologyPair {
	id: string;
	family: PhonologyFamily;
	a: string;
	b: string;
	ipaA: string;
	ipaB: string;
	meaningA: string;
	meaningB: string;
	contrast: string;
	functionalLoad: FunctionalLoadLevel;
	cue: string;
	exampleA: string;
	exampleB: string;
}

export interface PamPriority {
	category: "SC" | "TC" | "CG" | "UC";
	priority: "high" | "medium" | "low";
	rationale: string;
}

export interface EarGymExercise {
	pairId: string;
	family: PhonologyFamily;
	targetWord: string;
	targetMeaning: string;
	targetIpa: string;
	targetMember: "a" | "b";
	distractorWord: string;
	distractorMeaning: string;
	distractorIpa: string;
	options: Array<{ word: string; meaning: string; isCorrect: boolean }>;
	contrast: string;
	cue: string;
	functionalLoad: FunctionalLoadLevel;
	genderPrompt: "female" | "male";
}

// ─── Curated Articulatory Guidance Catalog ──────────────────────────────

export const ARTICULATORY_CUES: Record<string, ArticulatoryCue> = {
	"ť": {
		symbol: "ť",
		ipa: "c",
		name: "Voiceless palatal stop",
		motor: "Press the broad body/blade of your tongue flat against the hard palate (roof of the mouth). The tip stays down behind your lower front teeth.",
		commonPitfall: "English speakers often say 'ty' (/tj/) or standard alveolar [t]. Keep it a single unified palatal closure without a glide.",
		functionalLoad: "high",
		drillWord: "byť",
	},
	"ď": {
		symbol: "ď",
		ipa: "ɟ",
		name: "Voiced palatal stop",
		motor: "Same position as ť (tongue blade pressed flat against hard palate), but vibrate your vocal cords during the closure.",
		commonPitfall: "Avoid substituting English 'dy' (/dj/) or English 'j' (/dʒ/). Contact must be palatal, not affricated.",
		functionalLoad: "high",
		drillWord: "deň",
	},
	"ň": {
		symbol: "ň",
		ipa: "ɲ",
		name: "Palatal nasal",
		motor: "Broad tongue body against the hard palate with air flowing through your nose. Similar to Spanish 'ñ' or French/Italian 'gn'.",
		commonPitfall: "Do not divide into two sounds 'n + y'; execute it as a single palatal nasal gesture.",
		functionalLoad: "high",
		drillWord: "kôň",
	},
	"ľ": {
		symbol: "ľ",
		ipa: "ʎ",
		name: "Palatal lateral approximant",
		motor: "Tongue blade against the hard palate with air flowing along the sides. Soft, liquid /l/.",
		commonPitfall: "Merged with standard hard [l] in Western Slovak without loss of comprehension. Low priority for intelligibility.",
		functionalLoad: "low",
		drillWord: "ľudia",
	},
	"ô": {
		symbol: "ô",
		ipa: "uɔ",
		name: "Rising diphthong uo",
		motor: "Start with lips tightly rounded in a brief /u/, then immediately glide into an open /ɔ/ in a single syllable beat.",
		commonPitfall: "Do not pronounce as English 'oh' (/oʊ/) or long 'oo'. It is a rising diphthong ending in an open 'o'.",
		functionalLoad: "high",
		drillWord: "stôl",
	},
	"ä": {
		symbol: "ä",
		ipa: "ɛ",
		name: "Open-mid front vowel (široké e)",
		motor: "In standard contemporary Slovak, pronounced as a broad, open [ɛ] (like 'e' in 'pet').",
		commonPitfall: "Learners often overthink it as German ä (/ɛː/) or /æ/. Pronouncing it as standard Slovak [e/ɛ] is completely accepted.",
		functionalLoad: "low",
		drillWord: "mäso",
	},
	"ŕ": {
		symbol: "ŕ",
		ipa: "r̩ː",
		name: "Long syllabic trill",
		motor: "Tap the tongue tip against the alveolar ridge multiple times. Hold the trill for two full beats as the syllable nucleus.",
		commonPitfall: "Do not insert an epenthetic vowel before or after. The trill itself carries the syllable.",
		functionalLoad: "high",
		drillWord: "vŕba",
	},
	"ĺ": {
		symbol: "ĺ",
		ipa: "l̩ː",
		name: "Long syllabic lateral",
		motor: "Firm tongue tip on alveolar ridge with sustained vocal fold vibration for two beats.",
		commonPitfall: "Sustaining a consonant as a vowel feels unnatural to English speakers. Treat /l/ as the vowel core.",
		functionalLoad: "high",
		drillWord: "stĺp",
	},
	"r": {
		symbol: "r",
		ipa: "r",
		name: "Alveolar trill",
		motor: "Flutter the tip of your tongue against the ridge just behind your upper front teeth (1–3 taps).",
		commonPitfall: "Avoid the American bunched/retroflex /ɹ/. Tongue tip must make contact.",
		functionalLoad: "high",
		drillWord: "ruka",
	},
	"ch": {
		symbol: "ch",
		ipa: "x",
		name: "Voiceless velar fricative",
		motor: "Raise the back of your tongue toward the soft palate (velum) to create gentle friction, like Scottish 'loch' or German 'Bach'.",
		commonPitfall: "Do not pronounce as English /k/ or English /tʃ/ ('cheese'). Never stop the airflow.",
		functionalLoad: "high",
		drillWord: "chlieb",
	},
	"h": {
		symbol: "h",
		ipa: "ɦ",
		name: "Voiced glottal fricative",
		motor: "Unlike English voiceless 'h' (whispered air), Slovak 'h' is voiced: vibrate your vocal cords while exhaling.",
		commonPitfall: "English speakers produce a voiceless /h/. Feel your larynx buzz for Slovak /ɦ/.",
		functionalLoad: "medium",
		drillWord: "hrad",
	},
	"v": {
		symbol: "v",
		ipa: "v / ʋ",
		name: "Labiodental fricative / approximant",
		motor: "Upper teeth lightly touch lower lip. At word ends or before voiceless consonants, vocalizes to [w] or assimilates to [f].",
		commonPitfall: "Don't confuse with German 'v' (/f/) or Spanish bilabial.",
		functionalLoad: "medium",
		drillWord: "voda",
	},
	"á": {
		symbol: "á",
		ipa: "aː",
		name: "Long open central vowel",
		motor: "Open jaw, flat relaxed tongue. Hold duration for double the time of short /a/.",
		commonPitfall: "Do not shift quality into an English diphthong. Keep acoustic purity throughout.",
		functionalLoad: "high",
		drillWord: "pás",
	},
	"í": {
		symbol: "í",
		ipa: "iː",
		name: "Long close front vowel",
		motor: "Tongue arched high toward the front roof of mouth, lips spread. Double length of short /i/.",
		commonPitfall: "Note that Slovak 'í' and 'ý' have identical acoustic quality ([iː]); spelling reflects historical softness.",
		functionalLoad: "high",
		drillWord: "víno",
	},
	"ú": {
		symbol: "ú",
		ipa: "uː",
		name: "Long close back rounded vowel",
		motor: "Lips firmly rounded, tongue drawn back. Pure long tone.",
		commonPitfall: "Do not diphthongize as English 'oo' (/uːw/). Hold steady.",
		functionalLoad: "high",
		drillWord: "súd",
	},
	"é": {
		symbol: "é",
		ipa: "ɛː",
		name: "Long open-mid front vowel",
		motor: "Keep mouth mid-open, hold duration.",
		commonPitfall: "Never glide into English /eɪ/ ('say'). Pure monophthong.",
		functionalLoad: "high",
		drillWord: "dnes",
	},
	"ó": {
		symbol: "ó",
		ipa: "ɔː",
		name: "Long open-mid back rounded vowel",
		motor: "Rounded lips, open throat. Found mostly in loanwords.",
		commonPitfall: "Avoid English /oʊ/ glide.",
		functionalLoad: "medium",
		drillWord: "móda",
	},
	"dz": {
		symbol: "dz",
		ipa: "dz",
		name: "Voiced alveolar affricate",
		motor: "Tongue tip touches alveolar ridge for /d/, then immediately releases into /z/ with continuous vocal fold vibration.",
		commonPitfall: "Do not divide into two separate syllables or letters.",
		functionalLoad: "medium",
		drillWord: "medza",
	},
	"dž": {
		symbol: "dž",
		ipa: "dʒ",
		name: "Voiced postalveolar affricate",
		motor: "Tongue tip behind alveolar ridge, like English 'j' in 'jam'.",
		commonPitfall: "Keep lips slightly rounded and tongue firm.",
		functionalLoad: "medium",
		drillWord: "džús",
	},
};

/**
 * Retrieve articulatory motor cues for a given phoneme, letter, or digraph.
 */
export function getArticulatoryCue(target: string): ArticulatoryCue | null {
	const clean = target.trim().toLowerCase().normalize("NFC");
	return ARTICULATORY_CUES[clean] ?? null;
}

// ─── Functional Load Scoring ───────────────────────────────────────────

/**
 * Functional Load weights based on Catford (1987) & Munro & Derwing (2006):
 * - High FL (1.5): Vowel length (marks cases, noun plurals, verbal aspect),
 *   root consonant voicing, palatals that alter grammatical meaning.
 * - Medium FL (1.0): Standard consonants and monophthongs.
 * - Low FL (0.3): Allophonic or dialectally neutralized contrasts (e.g. soft ľ -> l,
 *   which is standard in Western Slovak and causes zero communicative breakdown).
 */
export function getFunctionalWeight(phoneme: string): number {
	const cue = getArticulatoryCue(phoneme);
	const load = cue?.functionalLoad ?? "medium";
	switch (load) {
		case "high":
			return 1.5;
		case "low":
			return 0.3;
		case "medium":
		default:
			return 1.0;
	}
}

/**
 * Calculate a weighted pronunciation accuracy score factoring in functional load.
 * Prevents over-penalizing benign regional mergers while penalizing meaning-altering errors.
 */
export function functionalLoadWeightedScore(
	phonemes: ReadonlyArray<{ p: string; score: number }>,
): number {
	if (!phonemes.length) return 0;
	let weightedSum = 0;
	let totalWeight = 0;

	for (const p of phonemes) {
		const w = getFunctionalWeight(p.p);
		weightedSum += p.score * w;
		totalWeight += w;
	}

	return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// ─── Cross-Linguistic Contrast Priority (PAM-L2) ───────────────────────

/**
 * Determine contrast difficulty and priority based on the learner's known languages.
 * Implements Catherine Best's Perceptual Assimilation Model (PAM-L2):
 * - TC (Two-Category): Known languages distinguish this contrast (Easy).
 * - SC (Single-Category): Both sounds map to one native category (Hardest, highest priority).
 * - CG (Category-Goodness): One maps as good native exemplar, one as deviant (Intermediate).
 * - UC (Uncategorized-Categorized): One sound is unknown / in phonetic white-space.
 */
export function getPamContrastPriority(
	family: PhonologyFamily,
	knownLanguages: readonly string[] = [],
): PamPriority {
	const langs = new Set(knownLanguages.map((l) => l.toLowerCase()));

	// Vowel quantity (short vs long vowels)
	if (family === "vowel_length") {
		// Languages with distinctive phonemic vowel quantity
		const hasVowelLength = ["et", "fi", "cs", "hu", "de", "ar", "ja"].some((l) => langs.has(l));
		if (hasVowelLength) {
			return {
				category: "TC",
				priority: "low",
				rationale: "Your known language possesses phonemic vowel quantity. Perception and production transfer readily.",
			};
		}
		// English, Spanish, Russian, Romance languages lack phonemic vowel duration
		return {
			category: "SC",
			priority: "high",
			rationale: "Your background lacks phonemic vowel duration. Learners often substitute vowel quality for length. High priority drill.",
		};
	}

	// Palatals (/t, d, n, l/ vs /c, ɟ, ɲ, ʎ/)
	if (family === "palatals") {
		if (langs.has("cs")) {
			return {
				category: "TC",
				priority: "low",
				rationale: "Czech shares ť, ď, ň with Slovak. Contrast transfers readily.",
			};
		}
		// Hungarian has ty / gy / ny
		if (langs.has("hu")) {
			return {
				category: "TC",
				priority: "low",
				rationale: "Hungarian ty, gy, ny share the exact palatal place of articulation with Slovak ť, ď, ň.",
			};
		}
		const hasSlavic = ["ru", "uk", "pl", "be"].some((l) => langs.has(l));
		if (hasSlavic) {
			return {
				category: "CG",
				priority: "medium",
				rationale: "Palatal contrasts exist in your background. Focus on Slovak's dorsal tongue contact without Russian-style iotation.",
			};
		}
		return {
			category: "SC",
			priority: "high",
			rationale: "Tongue-blade palatal stops assimilate into native dental/alveolar stops. Critical contrast for verb endings and noun cases.",
		};
	}

	// Syllabic liquids (/r̩, l̩/ vs /r̩ː, l̩ː/)
	if (family === "syllabic_liquids") {
		const hasCzechOrSouthSlavic = ["cs", "hr", "sr", "sl", "mk"].some((l) => langs.has(l));
		if (hasCzechOrSouthSlavic) {
			return {
				category: "TC",
				priority: "low",
				rationale: "Syllabic liquids acting as syllable nuclei are familiar from your background.",
			};
		}
		return {
			category: "UC",
			priority: "high",
			rationale: "Consonants acting as vowels without helping vowels are unfamiliar. Practice sustaining trills and laterals directly.",
		};
	}

	// Diphthongs (/uo/ ô)
	if (family === "diphthongs") {
		return {
			category: "CG",
			priority: "medium",
			rationale: "Rising diphthong [uɔ] must not glide into standard English 'oh' (/oʊ/).",
		};
	}

	// Voicing
	return {
		category: "CG",
		priority: "medium",
		rationale: "Neutralized at word boundaries by regressive assimilation (*spodobovanie*).",
	};
}

// ─── Slovak Voicing Assimilation (*Spodobovanie*) & Orthography ────────

export interface AssimilationRule {
	target: string;
	phonetic: string;
	rule: string;
}

const KNOWN_ASSIMILATIONS: Record<string, AssimilationRule> = {
	včera: {
		target: "včera",
		phonetic: "ftʃɛra",
		rule: "Regressive devoicing: 'v' before voiceless 'č' becomes voiceless [f].",
	},
	ťažko: {
		target: "ťažko",
		phonetic: "caʃkɔ",
		rule: "Regressive devoicing: 'ž' before voiceless 'k' becomes voiceless [ʃ].",
	},
	vchod: {
		target: "vchod",
		phonetic: "fxɔt",
		rule: "Regressive devoicing: 'v' before voiceless 'ch' [x] becomes [f].",
	},
	všetko: {
		target: "všetko",
		phonetic: "fʃɛtkɔ",
		rule: "Regressive devoicing: 'v' before voiceless 'š' becomes [f].",
	},
	chlap: {
		target: "chlap",
		phonetic: "xlap",
		rule: "Word-final devoicing: word ends in voiceless stop [p].",
	},
	dub: {
		target: "dub",
		phonetic: "dup",
		rule: "Word-final devoicing: final 'b' sounds like [p] in isolation.",
	},
	hrad: {
		target: "hrad",
		phonetic: "ɦrat",
		rule: "Word-final devoicing: final 'd' sounds like [t] in isolation.",
	},
};

/**
 * Returns deterministic phonetic transcription & assimilation explanation for words
 * that exhibit regular Slovak regressive voicing assimilation (*spodobovanie*).
 */
export function getVoicingAssimilationNotes(word: string): AssimilationRule | null {
	const clean = word.trim().toLowerCase().replace(/[.,!?;:]/g, "");
	return KNOWN_ASSIMILATIONS[clean] ?? null;
}

// ─── Curated Minimal Pairs & Ear Gym Generator ────────────────────────

export const PHONOLOGY_PAIRS: PhonologyPair[] = (phonologyPairsJson as { pairs: PhonologyPair[] }).pairs;

/**
 * Filter minimal pairs by contrast family or minimum functional load.
 */
export function getPhonologyPairs(opts: {
	family?: PhonologyFamily;
	minFunctionalLoad?: FunctionalLoadLevel;
} = {}): PhonologyPair[] {
	return PHONOLOGY_PAIRS.filter((p) => {
		if (opts.family && p.family !== opts.family) return false;
		if (opts.minFunctionalLoad === "high" && p.functionalLoad !== "high") return false;
		if (opts.minFunctionalLoad === "medium" && p.functionalLoad === "low") return false;
		return true;
	});
}

/**
 * Deterministically create a 2AFC (Two-Alternative Forced Choice) exercise for the Ear Gym.
 * In accordance with HVPT principles, alternates target member and speaker gender.
 */
export function createEarGymExercise(pair: PhonologyPair, seed: number = 0): EarGymExercise {
	const isB = (seed % 2) === 1;
	const isMale = (Math.floor(seed / 2) % 2) === 1;

	const targetWord = isB ? pair.b : pair.a;
	const targetMeaning = isB ? pair.meaningB : pair.meaningA;
	const targetIpa = isB ? pair.ipaB : pair.ipaA;
	const targetMember = isB ? "b" : "a";

	const distractorWord = isB ? pair.a : pair.b;
	const distractorMeaning = isB ? pair.meaningA : pair.meaningB;
	const distractorIpa = isB ? pair.ipaA : pair.ipaB;

	// Randomize option order based on seed
	const options = (seed % 3 === 0)
		? [
			{ word: targetWord, meaning: targetMeaning, isCorrect: true },
			{ word: distractorWord, meaning: distractorMeaning, isCorrect: false },
		]
		: [
			{ word: distractorWord, meaning: distractorMeaning, isCorrect: false },
			{ word: targetWord, meaning: targetMeaning, isCorrect: true },
		];

	return {
		pairId: pair.id,
		family: pair.family,
		targetWord,
		targetMeaning,
		targetIpa,
		targetMember,
		distractorWord,
		distractorMeaning,
		distractorIpa,
		options,
		contrast: pair.contrast,
		cue: pair.cue,
		functionalLoad: pair.functionalLoad,
		genderPrompt: isMale ? "male" : "female",
	};
}

export const EAR_GYM_ROUND = 10;

export function pickRoundPairs(pool: readonly PhonologyPair[], size: number, rand: () => number): PhonologyPair[] {
	if (pool.length === 0) return [];
	if (pool.length === 1) return Array.from({ length: size }, () => pool[0]!);
	const result: PhonologyPair[] = [];
	let lastId = "";
	while (result.length < size) {
		const shuffled = shuffle(pool, rand);
		for (const p of shuffled) {
			if (p.id === lastId && pool.length > 1) continue;
			result.push(p);
			lastId = p.id;
			if (result.length >= size) break;
		}
	}
	return result;
}

export function earGymRound(pool: readonly PhonologyPair[], seed: number, size: number = EAR_GYM_ROUND): EarGymExercise[] {
	if (pool.length === 0) return [];
	const rand = rng(seed);
	return pickRoundPairs(pool, size, rand).map((pair) => createEarGymExercise(pair, Math.floor(rand() * 4)));
}
