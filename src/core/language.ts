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

import { isVariantMatch, knownVariants } from "./variants.ts";
export { isVariantMatch, knownVariants };

export interface LanguageReferenceSite {
	/** Display label in popovers, e.g. "slovak.wiki" or "DEXonline". */
	label: string;
	/** Base origin, e.g. "https://www.slovak.wiki" (the bare domain redirects there). */
	baseUrl: string;
}

export interface LanguageInfo {
	id: LanguageId | string;
	/** BCP-47 tag — TTS voices, speechSynthesis, toLocaleLowerCase. */
	tag: string;
	/** ISO 639-1 — the /api/tts ?lang= value and translation source language code. */
	code: string;
	/** The language's own name. */
	endonym: string;
	english: string;
	/** Letters the learner's keyboard may lack — the diacritic bar. */
	specialLetters: string[];
	/** Edge neural voices (msedge-tts), first is the default. */
	edgeVoices: string[];
	/** Optional dedicated reference/dictionary site for this language profile. */
	referenceSite?: LanguageReferenceSite;
	/** Other languages a Watch video may be captioned in when it has none in
	 *  this one, most preferred first. Czech is near enough to Slovak to
	 *  follow; the video is labelled with the language it is in. */
	captionFallbacks?: Array<{ code: string; english: string }>;
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
		referenceSite: {
			label: "slovak.wiki",
			baseUrl: "https://www.slovak.wiki",
		},
		captionFallbacks: [{ code: "cs", english: "Czech" }],
	},
	russian: {
		id: "russian",
		tag: "ru-RU",
		code: "ru",
		endonym: "Русский",
		english: "Russian",
		specialLetters: ["ё", "й", "ъ", "ь", "ы", "э", "щ", "ж", "ю", "я"],
		edgeVoices: ["ru-RU-SvetlanaNeural", "ru-RU-DmitryNeural"],
		referenceSite: {
			label: "Wiktionary",
			baseUrl: "https://ru.wiktionary.org",
		},
	},
};

/** The English name of a caption language: a profile's own, or one of its
 *  fallbacks. Unknown codes come back as they are. */
export function captionLanguageName(code: string): string {
	for (const info of Object.values(LANGUAGES)) {
		if (info.code === code) return info.english;
		const fallback = info.captionFallbacks?.find((f) => f.code === code);
		if (fallback) return fallback.english;
	}
	return code;
}

/**
 * Pre-configured presets for languages that can be plugged into LangHarness.
 * Copy into LANGUAGES and config.ts LANGUAGE_PROFILES to activate.
 */
export const LANGUAGE_PRESETS: Record<string, LanguageInfo> = {
	czech: {
		id: "czech",
		tag: "cs-CZ",
		code: "cs",
		endonym: "Čeština",
		english: "Czech",
		specialLetters: ["á", "č", "ď", "é", "ě", "í", "ň", "ó", "ř", "š", "ť", "ú", "ů", "ý", "ž"],
		edgeVoices: ["cs-CZ-VlastaNeural", "cs-CZ-AntoninNeural"],
		referenceSite: {
			label: "Wiktionary",
			baseUrl: "https://cs.wiktionary.org",
		},
	},
	romanian: {
		id: "romanian",
		tag: "ro-RO",
		code: "ro",
		endonym: "Română",
		english: "Romanian",
		specialLetters: ["ă", "â", "î", "ș", "ț"],
		edgeVoices: ["ro-RO-AlinaNeural", "ro-RO-EmilNeural"],
		referenceSite: {
			label: "DEXonline",
			baseUrl: "https://dexonline.ro",
		},
	},
	german: {
		id: "german",
		tag: "de-DE",
		code: "de",
		endonym: "Deutsch",
		english: "German",
		specialLetters: ["ä", "ö", "ü", "ß"],
		edgeVoices: ["de-DE-KatjaNeural", "de-DE-ConradNeural"],
		referenceSite: {
			label: "Wiktionary",
			baseUrl: "https://de.wiktionary.org",
		},
	},
	spanish: {
		id: "spanish",
		tag: "es-ES",
		code: "es",
		endonym: "Español",
		english: "Spanish",
		specialLetters: ["á", "é", "í", "ó", "ú", "ü", "ñ", "¿", "¡"],
		edgeVoices: ["es-ES-ElviraNeural", "es-ES-AlvaroNeural"],
		referenceSite: {
			label: "Wiktionary",
			baseUrl: "https://es.wiktionary.org",
		},
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
 * - "exact": same after case/space/end-punctuation normalization, or a recognized
 *   valid variant / alternative (e.g. zas ↔ zase / zasa).
 * - "accents": right letters, wrong or missing diacritics (dĺžeň, mäkčeň,
 *   vokáň …) — the word is known, the spelling is not yet. Drills give
 *   partial credit and show the correct spelling.
 * - "wrong": anything else.
 *
 * Diacritics are never folded for the "exact" verdict: in Slovak they
 * change meaning (vina ≠ vína, chyba ≠ chýba).
 */
export type AnswerVerdict = "exact" | "accents" | "wrong";

export function compareAnswer(
	expected: string,
	given: string,
	tag = "sk-SK",
	alternatives: readonly string[] = [],
): AnswerVerdict {
	const e = normalizeAnswer(expected, tag);
	const g = normalizeAnswer(given, tag);
	if (!g) return "wrong";
	if (e === g) return "exact";
	if (foldDiacritics(e) === foldDiacritics(g)) return "accents";

	const allAlts = [...alternatives, ...knownVariants(expected, tag)];
	for (const alt of allAlts) {
		const a = normalizeAnswer(alt, tag);
		if (!a) continue;
		if (a === g) return "exact";
		if (foldDiacritics(a) === foldDiacritics(g)) return "accents";
	}

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
