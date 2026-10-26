/**
 * Target languages (LangHarness) — pure facts about each language profile
 * and the answer comparison the drills share. Browser-safe: the review
 * page, the diacritic bar and the server all read from here.
 *
 * The profile NAMES are mirrored in config.ts (LANGUAGE_PROFILES): config
 * is a leaf the core may not import from, so the list lives twice and
 * tests/language.test.ts pins them equal.
 */

export type LanguageId = "slovak" | "russian";

export interface LanguageInfo {
	id: LanguageId;
	/** BCP-47 tag — TTS voices, speechSynthesis, toLocaleLowerCase. */
	tag: string;
	/** ISO 639-1 — the /api/tts ?lang= value. */
	code: "sk" | "ru";
	/** The language's own name. */
	endonym: string;
	english: string;
	/** Letters the learner's keyboard may lack — the diacritic bar. */
	specialLetters: string[];
	/** Edge neural voices (msedge-tts), first is the default. */
	edgeVoices: string[];
}

export const LANGUAGES: Record<LanguageId, LanguageInfo> = {
	slovak: {
		id: "slovak",
		tag: "sk-SK",
		code: "sk",
		endonym: "Slovenčina",
		english: "Slovak",
		specialLetters: ["á", "ä", "č", "ď", "é", "í", "ĺ", "ľ", "ň", "ó", "ô", "ŕ", "š", "ť", "ú", "ý", "ž"],
		edgeVoices: ["sk-SK-ViktoriaNeural", "sk-SK-LukasNeural"],
	},
	russian: {
		id: "russian",
		tag: "ru-RU",
		code: "ru",
		endonym: "Русский",
		english: "Russian",
		specialLetters: ["ё", "й", "ъ", "ь", "ы", "э", "щ", "ж", "ю", "я"],
		edgeVoices: ["ru-RU-SvetlanaNeural", "ru-RU-DmitryNeural"],
	},
};

export const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];

export function isLanguageId(v: unknown): v is LanguageId {
	return typeof v === "string" && v in LANGUAGES;
}

export function languageByCode(code: string): LanguageInfo | undefined {
	return LANGUAGE_IDS.map((id) => LANGUAGES[id]).find((l) => l.code === code);
}

/** Strip combining marks after NFD — "mäkčeň" → "makcen". Russian ё → е
 *  and й → и fall out of the same rule (both decompose). */
export function foldDiacritics(text: string): string {
	return text.normalize("NFD").replace(/\p{M}+/gu, "").normalize("NFC");
}

/** Lowercase, trim, collapse whitespace, drop sentence punctuation at the
 *  ends — what an answer box should not be graded on. */
export function normalizeAnswer(text: string, tag = "sk-SK"): string {
	return text
		.normalize("NFC")
		.toLocaleLowerCase(tag)
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^[\s"'„“”«»(¿¡]+|[\s"'„“”«».,!?;:)…]+$/gu, "");
}

/**
 * Grade a typed answer against the expected one.
 *
 * - "exact": same after case/space/end-punctuation normalization.
 * - "accents": right letters, wrong or missing diacritics (dĺžeň, mäkčeň,
 *   vokáň …) — the word is known, the spelling is not yet. Drills give
 *   partial credit and show the correct spelling.
 * - "wrong": anything else.
 *
 * Diacritics are never folded for the "exact" verdict: in Slovak they
 * change meaning (vina ≠ vína, chyba ≠ chýba).
 */
export type AnswerVerdict = "exact" | "accents" | "wrong";

export function compareAnswer(expected: string, given: string, tag = "sk-SK"): AnswerVerdict {
	const e = normalizeAnswer(expected, tag);
	const g = normalizeAnswer(given, tag);
	if (!g) return "wrong";
	if (e === g) return "exact";
	if (foldDiacritics(e) === foldDiacritics(g)) return "accents";
	return "wrong";
}

/** The positions (in the expected string) whose letter the learner got
 *  wrong only by its diacritic — to underline them in feedback. */
export function diacriticSlips(expected: string, given: string, tag = "sk-SK"): number[] {
	const e = [...expected.normalize("NFC")];
	const g = [...given.normalize("NFC").trim()];
	if (e.length !== g.length) return [];
	const out: number[] = [];
	for (let i = 0; i < e.length; i++) {
		const a = e[i]!.toLocaleLowerCase(tag);
		const b = g[i]!.toLocaleLowerCase(tag);
		if (a !== b && foldDiacritics(a) === foldDiacritics(b)) out.push(i);
	}
	return out;
}
