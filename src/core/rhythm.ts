/**
 * Slovak Rhythmic Law & Suprasegmental Cadence Engine (LangHarness, 2026-11).
 *
 * Implements:
 * 1. Syllable segmentation and quantity classification (short vs long mora).
 * 2. Slovak Rhythmic Law (Rytmický zákon) validation and suffix shortening.
 * 3. Fixed initial stress cadence formatting for syllable-timed entrainment.
 *
 * Grounded in:
 * - Dupoux et al. (2001, 2008): L2 stress deafness in fixed-stress vs variable-stress systems.
 * - Kráľ (1988), Pauliny (1979), Rubach (1993): Slovak phonotactics and the Rhythmic Law.
 */

export type SyllableQuantity = "short" | "long";

export interface Syllable {
	index: number;
	text: string;
	nucleus: string;
	quantity: SyllableQuantity;
}

export interface NucleusSpan {
	nucleus: string;
	quantity: SyllableQuantity;
	start: number;
	end: number;
}

export interface RhythmicLawResult {
	form: string;
	shortened: boolean;
	stem: string;
	stemQuantity: SyllableQuantity;
	suffixOriginal: string;
	suffixApplied: string;
	explanation: string;
}

export interface RhythmicAnalysis {
	word: string;
	syllables: Syllable[];
	hasViolation: boolean;
	isException: boolean;
	exceptionReason?: string;
	violations: Array<{ first: Syllable; second: Syllable }>;
	explanation: string;
}

/** Standard Slovak vowels. */
const VOWELS_SHORT = new Set(["a", "ä", "e", "i", "y", "o", "u"]);
const VOWELS_LONG = new Set(["á", "é", "í", "ý", "ó", "ú"]);

/** Syllabic liquid consonants (can act as syllable nuclei between consonants). */
const LIQUIDS_SHORT = new Set(["r", "l"]);
const LIQUIDS_LONG = new Set(["ŕ", "ĺ"]);

function isVowel(char: string): boolean {
	const c = char.toLowerCase();
	return VOWELS_SHORT.has(c) || VOWELS_LONG.has(c);
}

function isConsonant(char: string): boolean {
	const c = char.toLowerCase();
	return /[\p{L}]/u.test(c) && !isVowel(c);
}

/**
 * Finds all syllable nuclei in a Slovak word with their position and length.
 * Diphthongs: ia, ie, iu, ô (always long).
 * Long vowels: á, é, í, ó, ú, ý (always long).
 * Long syllabic liquids: ŕ, ĺ between consonants (always long).
 * Short vowels: a, ä, e, i, o, u, y (short).
 * Short syllabic liquids: r, l between consonants (short).
 */
export function findNuclei(word: string): NucleusSpan[] {
	const w = word.toLowerCase();
	const nuclei: NucleusSpan[] = [];
	let i = 0;

	while (i < w.length) {
		const c = w[i]!;

		// Check rising diphthongs starting with 'i' (ia, ie, iu)
		if (c === "i" && i + 1 < w.length && "aeu".includes(w[i + 1]!)) {
			nuclei.push({
				nucleus: w.slice(i, i + 2),
				quantity: "long",
				start: i,
				end: i + 2,
			});
			i += 2;
			continue;
		}

		// Diphthong 'ô' [uo]
		if (c === "ô") {
			nuclei.push({
				nucleus: "ô",
				quantity: "long",
				start: i,
				end: i + 1,
			});
			i++;
			continue;
		}

		// Long monophthongs
		if (VOWELS_LONG.has(c)) {
			nuclei.push({
				nucleus: c,
				quantity: "long",
				start: i,
				end: i + 1,
			});
			i++;
			continue;
		}

		// Short vowels
		if (VOWELS_SHORT.has(c)) {
			nuclei.push({
				nucleus: c,
				quantity: "short",
				start: i,
				end: i + 1,
			});
			i++;
			continue;
		}

		// Syllabic liquids: r, l, ŕ, ĺ
		if (LIQUIDS_SHORT.has(c) || LIQUIDS_LONG.has(c)) {
			const prevIsConsonant = i === 0 || isConsonant(w[i - 1]!);
			const nextIsConsonant = i + 1 === w.length || isConsonant(w[i + 1]!);

			if (prevIsConsonant && nextIsConsonant && w.length > 1) {
				const isLong = LIQUIDS_LONG.has(c);
				nuclei.push({
					nucleus: c,
					quantity: isLong ? "long" : "short",
					start: i,
					end: i + 1,
				});
				i++;
				continue;
			}
		}

		i++;
	}

	return nuclei;
}

/**
 * Segments a Slovak word into syllables and classifies each syllable's quantity.
 */
export function segmentSyllables(word: string): Syllable[] {
	const clean = word.trim();
	if (!clean) return [];

	const nuclei = findNuclei(clean);
	if (nuclei.length === 0) {
		return [{ index: 0, text: clean, nucleus: "", quantity: "short" }];
	}

	const syllables: Syllable[] = [];

	for (let i = 0; i < nuclei.length; i++) {
		const cur = nuclei[i]!;
		let start = 0;
		let end = clean.length;

		if (i === 0) {
			start = 0;
		} else {
			const prev = nuclei[i - 1]!;
			// Split consonants between previous nucleus and current nucleus
			const betweenStart = prev.end;
			const betweenEnd = cur.start;
			const consonantCount = betweenEnd - betweenStart;

			if (consonantCount <= 1) {
				// Single consonant goes to current onset: vo-lať, že-na
				start = betweenStart + (consonantCount === 1 ? 0 : 0);
			} else {
				// Multiple consonants: first consonant coda, rest onset: krás-ny, chvá-lim
				start = betweenStart + 1;
			}
		}

		if (i < nuclei.length - 1) {
			const next = nuclei[i + 1]!;
			const betweenStart = cur.end;
			const betweenEnd = next.start;
			const consonantCount = betweenEnd - betweenStart;

			if (consonantCount <= 1) {
				end = betweenStart;
			} else {
				end = betweenStart + 1;
			}
		} else {
			end = clean.length;
		}

		syllables.push({
			index: i,
			text: clean.slice(start, end),
			nucleus: cur.nucleus,
			quantity: cur.quantity,
		});
	}

	return syllables;
}

/**
 * Checks if a syllable or stem ends in a long quantity.
 */
export function isLongQuantity(text: string): boolean {
	const nuclei = findNuclei(text);
	if (nuclei.length === 0) return false;
	return nuclei[nuclei.length - 1]!.quantity === "long";
}

/**
 * Shortens a long vowel, diphthong, or suffix according to standard Slovak morphophonology:
 * á -> a, é -> e, í -> i, ó -> o, ú -> u, ý -> y
 * ia -> a, ie -> e, iu -> u, ô -> o
 */
export function shortenEnding(suffix: string): string {
	let s = suffix;

	// Diphthongs
	s = s.replace(/ia/g, "a");
	s = s.replace(/ie/g, "e");
	s = s.replace(/iu/g, "u");
	s = s.replace(/ô/g, "o");

	// Long vowels
	s = s.replace(/á/g, "a");
	s = s.replace(/é/g, "e");
	s = s.replace(/í/g, "i");
	s = s.replace(/ó/g, "o");
	s = s.replace(/ú/g, "u");
	s = s.replace(/ý/g, "y");

	return s;
}

/**
 * Applies the Slovak Rhythmic Law to a stem + suffix combination.
 * If the stem's final syllable is long and the suffix begins with a long nucleus,
 * the suffix is systematically shortened.
 */
export function applyRhythmicLaw(stem: string, suffix: string): RhythmicLawResult {
	const stemNuclei = findNuclei(stem);
	const lastStemNucleus = stemNuclei.length > 0 ? stemNuclei[stemNuclei.length - 1]! : null;
	const stemIsLong = lastStemNucleus?.quantity === "long";

	const suffixNuclei = findNuclei(suffix);
	const firstSuffixNucleus = suffixNuclei.length > 0 ? suffixNuclei[0]! : null;
	const suffixIsLong = firstSuffixNucleus?.quantity === "long";

	if (stemIsLong && suffixIsLong) {
		const shortenedSuffix = shortenEnding(suffix);
		return {
			form: `${stem}${shortenedSuffix}`,
			shortened: true,
			stem,
			stemQuantity: "long",
			suffixOriginal: suffix,
			suffixApplied: shortenedSuffix,
			explanation: `Rhythmic shortening applied: long stem '${stem}' causes long suffix '${suffix}' to shorten to '${shortenedSuffix}'. Two long syllables cannot occur in succession.`,
		};
	}

	return {
		form: `${stem}${suffix}`,
		shortened: false,
		stem,
		stemQuantity: stemIsLong ? "long" : "short",
		suffixOriginal: suffix,
		suffixApplied: suffix,
		explanation: stemIsLong
			? `No shortening: suffix '${suffix}' is already short.`
			: `No shortening: stem '${stem}' is short, so long suffix '${suffix}' remains long.`,
	};
}

/** Known lexical patterns that are genuine exceptions to the Rhythmic Law in standard Slovak. */
const EXCEPTION_PATTERNS: Array<{ regex: RegExp; reason: string }> = [
	{ regex: /(?:páv|líšč|orl|vtáč|kamzíč|žab)[í|ie|ia]/i, reason: "Animal adjectives (model páví) retain long endings" },
	{ regex: /(?:líst|prút|skál|tŕn)ie/i, reason: "Neuter collective nouns in -ie (model vysvedčenie) retain long endings" },
	{ regex: /básní$/i, reason: "Genitive plural in -í retains length" },
	{ regex: /(?:chvál|súd|píš)(?:iaci|iaca|iace)/i, reason: "Present active participles in -iaci retain diphthong" },
];

/**
 * Analyzes an existing word for Rhythmic Law compliance.
 * Identifies whether consecutive long syllables exist, and whether they represent an exception.
 */
export function analyzeRhythmicLaw(word: string): RhythmicAnalysis {
	const clean = word.trim();
	const syllables = segmentSyllables(clean);
	const violations: Array<{ first: Syllable; second: Syllable }> = [];

	for (let i = 0; i < syllables.length - 1; i++) {
		const cur = syllables[i]!;
		const next = syllables[i + 1]!;
		if (cur.quantity === "long" && next.quantity === "long") {
			violations.push({ first: cur, second: next });
		}
	}

	let isException = false;
	let exceptionReason: string | undefined;

	if (violations.length > 0) {
		for (const pat of EXCEPTION_PATTERNS) {
			if (pat.regex.test(clean)) {
				isException = true;
				exceptionReason = pat.reason;
				break;
			}
		}
	}

	const hasViolation = violations.length > 0 && !isException;

	let explanation = "Follows the Slovak Rhythmic Law.";
	if (hasViolation) {
		const pair = violations[0]!;
		explanation = `Violates the Rhythmic Law: adjacent syllables '${pair.first.text}' and '${pair.second.text}' are both long. In native Slovak words, the second syllable should shorten.`;
	} else if (isException) {
		explanation = `Standard exception: ${exceptionReason}.`;
	}

	return {
		word: clean,
		syllables,
		hasViolation,
		isException,
		exceptionReason,
		violations,
		explanation,
	};
}

/**
 * Formats a Slovak sentence with primary word-initial stress accents ('ˈ')
 * and syllable hyphenation to entrain syllable-timed cadence.
 *
 * Example:
 * "Chválime Slovensko" -> "ˈchvá-li-me ˈSlo-ven-sko"
 */
export function formatStressCadence(text: string): string {
	const tokens = text.split(/(\s+|[.,!?;:"'—–]+)/);
	const clitics = new Set(["v", "na", "do", "z", "k", "o", "u", "s", "za", "po", "pri", "od", "ku", "zo", "vo"]);

	return tokens
		.map((token) => {
			if (!token.trim() || !/[\p{L}]/u.test(token)) {
				return token;
			}

			const lower = token.toLowerCase();
			if (clitics.has(lower)) {
				return token;
			}

			const syllables = segmentSyllables(token);
			if (syllables.length <= 1) {
				return `ˈ${token}`;
			}

			const joined = syllables.map((s) => s.text).join("-");
			return `ˈ${joined}`;
		})
		.join("");
}
