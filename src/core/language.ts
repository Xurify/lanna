/**
 * Target languages (LangHarness) — pure facts about each language profile
 * and the answer comparison the drills share. Browser-safe: the review
 * page, the diacritic bar and the server all read from here.
 *
 * The built-in profile NAMES are mirrored in config.ts (LANGUAGE_PROFILES):
 * config is a leaf the core may not import from, so the list lives twice and
 * tests/langharness.test.ts pins them equal. A language the learner adds
 * from the app (LANGUAGE_CATALOG) is registered at run time from
 * <data>/languages/<id>/language.json.
 */

export type LanguageId = "slovak" | "russian";

import { isVariantMatch, knownVariants } from "./variants.ts";
export { isVariantMatch, knownVariants };

export interface LanguageReferenceSite {
	/** Display label in popovers, e.g. "slovak.wiki" or "DEXonline". */
	label: string;
	/** Base origin, e.g. "https://www.slovak.wiki" (the bare domain redirects there). */
	baseUrl: string;
	/** A page per word, with `{word}` standing for the lemma. Without it the
	 *  site is laid out like slovak.wiki: /dictionary/<slug> and /search?q=. */
	wordUrl?: string;
}

/** The reference page for a word: its own page when the site has one per
 *  word, else slovak.wiki's dictionary or search page. */
export function referenceLink(site: LanguageReferenceSite, word: { slug?: string; lemma?: string; query?: string }): string {
	const query = (word.query ?? "").trim();
	if (site.wordUrl) {
		const lemma = (word.lemma ?? query).trim();
		return lemma ? site.wordUrl.replace("{word}", encodeURIComponent(lemma)) : site.baseUrl;
	}
	if (word.slug && !word.slug.includes(" ") && word.slug !== "word") return `${site.baseUrl}/dictionary/${encodeURIComponent(word.slug)}`;
	return query ? `${site.baseUrl}/search?q=${encodeURIComponent(query)}` : `${site.baseUrl}/dictionary`;
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
	/** Where the language is at home, when the tag's region does not say it
	 *  (Catalan is ca-ES, but its home is Catalonia). */
	country?: string;
	/** Short examples a model prompt shows next to a rule. A language
	 *  without one gets the rule alone. */
	promptExamples?: PromptExamples;
	/** The U.S. Foreign Service Institute's difficulty category for an
	 *  English speaker: I (French, Norwegian, Romanian) takes 600–750 class
	 *  hours, III (Slovak, Czech, Polish, Russian, Estonian) about 1,100. */
	fsiCategory?: 1 | 2 | 3 | 4;
}

/** Examples in the language itself, written by someone who knows it. */
export interface PromptExamples {
	/** The subordinating words a learner meets at A2, quoted: "že", "keď", "lebo". */
	clauseWords?: string;
	/** What automatic captions get wrong, quoted: a repeat and a false start. */
	captionNoise?: string;
	/** Repair prompts in brackets that name the trigger and start the form. */
	repairHints?: string;
	/** "Try again", as a repair prompt ends. */
	tryAgain?: string;
	/** Two words a diacritic tells apart: vina ≠ vína. */
	diacriticPair?: string;
	/** A judge's note on a missed ending, naming the case and the pattern. */
	caseNote?: string;
	/** A frame with ___ and the dictionary word in brackets. */
	frame?: string;
	/** A present-tense sentence to put in the past. */
	pastSentence?: string;
	/** Listening slips that are spelling rules, not the ear. */
	spellingSlips?: string;
}

/** The country or region a language is at home in, in English. */
export function countryOf(info: Pick<LanguageInfo, "tag" | "country">): string {
	if (info.country) return info.country;
	const region = info.tag.split("-")[1];
	try {
		return (region && new Intl.DisplayNames(["en"], { type: "region" }).of(region)) || "the country";
	} catch {
		return "the country";
	}
}

/** ` (e.g. …)`, or nothing when the language has no example. */
export function eg(example: string | undefined): string {
	return example ? ` (e.g. ${example})` : "";
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
		fsiCategory: 3,
		promptExamples: {
			clauseWords: `"že", "keď", "lebo"`,
			captionNoise: `"tak, tak", "ktoré to nie sú veci, ktoré to nie sú"`,
			repairHints: "(do škol…? skús ešte raz) or (včera — bol, bola…?)",
			tryAgain: "skús ešte raz",
			diacriticPair: "vina ≠ vína",
			caseNote: `"After prijal the object is accusative, and feminine -a nouns take -u there"`,
			frame: "Idem do ___ (škola).",
			pastSentence: "Píšem list.",
			spellingSlips: "A consonant written as it is said (had as hat) and i against y are spelling rules",
		},
	},
	russian: {
		id: "russian",
		tag: "ru-RU",
		code: "ru",
		endonym: "Русский",
		english: "Russian",
		specialLetters: ["ё", "й", "ъ", "ь", "ы", "э", "щ", "ж", "ю", "я"],
		edgeVoices: ["ru-RU-SvetlanaNeural", "ru-RU-DmitryNeural"],
		fsiCategory: 3,
		referenceSite: {
			label: "Wiktionary",
			baseUrl: "https://ru.wiktionary.org",
			wordUrl: "https://ru.wiktionary.org/wiki/{word}",
		},
	},
};

/** The English name of a caption language: a profile's own, or one of its
 *  fallbacks. Unknown codes come back as they are. */
export function captionLanguageName(code: string): string {
	for (const info of [...Object.values(LANGUAGES), ...registry().values()]) {
		if (info.code === code) return info.english;
		const fallback = info.captionFallbacks?.find((f) => f.code === code);
		if (fallback) return fallback.english;
	}
	return code;
}

/**
 * A language the learner can add from the app. The sources are named per
 * language because their codes differ: Tatoeba uses ISO 639-3, kaikki.org
 * names a Wiktionary language in English, and FrequencyWords (OpenSubtitles
 * 2018) has its own short code. Each was checked to exist on 2026-11-05,
 * and the voices against the Edge voice list the same day. A language
 * FrequencyWords lacks leaves `frequency` out and is ranked from its
 * Tatoeba sentences instead.
 */
export interface CatalogLanguage extends LanguageInfo {
	tatoeba: string;
	wiktionary: string;
	frequency?: string;
}

type CatalogRow = [id: string, tag: string, endonym: string, english: string, voices: [string, string], tatoeba: string, wiktionary: string, frequency?: string];

/** FSI categories, from state.gov, "Foreign Language Training". */
const FSI: Record<string, 1 | 3> = { bulgarian: 3, czech: 3, estonian: 3, norwegian: 1, polish: 3, romanian: 1, russian: 3 };

const CATALOG_ROWS: CatalogRow[] = [
	["bulgarian", "bg-BG", "Български", "Bulgarian", ["bg-BG-KalinaNeural", "bg-BG-BorislavNeural"], "bul", "Bulgarian", "bg"],
	["czech", "cs-CZ", "Čeština", "Czech", ["cs-CZ-VlastaNeural", "cs-CZ-AntoninNeural"], "ces", "Czech", "cs"],
	["estonian", "et-EE", "Eesti", "Estonian", ["et-EE-AnuNeural", "et-EE-KertNeural"], "est", "Estonian", "et"],
	["norwegian", "nb-NO", "Norsk bokmål", "Norwegian", ["nb-NO-PernilleNeural", "nb-NO-FinnNeural"], "nob", "Norwegian Bokmål", "no"],
	["polish", "pl-PL", "Polski", "Polish", ["pl-PL-ZofiaNeural", "pl-PL-MarekNeural"], "pol", "Polish", "pl"],
	["romanian", "ro-RO", "Română", "Romanian", ["ro-RO-AlinaNeural", "ro-RO-EmilNeural"], "ron", "Romanian", "ro"],
	["russian", "ru-RU", "Русский", "Russian", ["ru-RU-SvetlanaNeural", "ru-RU-DmitryNeural"], "rus", "Russian", "ru"],
];

/** Every language the app can add by itself. Russian is here too: its
 *  profile is built in but ships no words. */
export const LANGUAGE_CATALOG: CatalogLanguage[] = CATALOG_ROWS.map(([id, tag, endonym, english, voices, tatoeba, wiktionary, frequency]) => ({
	id,
	tag,
	code: tag.split("-")[0]!,
	endonym,
	english,
	specialLetters: [],
	edgeVoices: [...voices],
	referenceSite: { label: "Wiktionary", baseUrl: "https://en.wiktionary.org", wordUrl: `https://en.wiktionary.org/wiki/{word}#${wiktionary.replace(/ /g, "_")}` },
	tatoeba,
	wiktionary,
	...(frequency ? { frequency } : {}),
	...(FSI[id] ? { fsiCategory: FSI[id] } : {}),
}));

export function catalogLanguage(id: string): CatalogLanguage | undefined {
	return LANGUAGE_CATALOG.find((l) => l.id === id);
}

// Added languages live on globalThis: `next dev` evaluates this module once
// per route, and a language registered by one route must be known to all.
const REGISTRY_KEY = "__lhLanguages";
function registry(): Map<string, LanguageInfo> {
	const g = globalThis as unknown as Record<string, Map<string, LanguageInfo> | undefined>;
	return (g[REGISTRY_KEY] ??= new Map());
}

/** Make an added language known. A built-in id is never replaced. */
export function registerLanguage(info: LanguageInfo): void {
	if (info.id in LANGUAGES) return;
	registry().set(info.id, info);
}

/** A built-in or registered language, by profile id. */
export function languageById(id: string): LanguageInfo | undefined {
	return (LANGUAGES as Record<string, LanguageInfo>)[id] ?? registry().get(id);
}

/** Read an added language's language.json. Anything malformed is null. */
export function parseLanguageInfo(raw: unknown): LanguageInfo | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
	const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
	const id = str(r.id);
	const tag = str(r.tag);
	const code = str(r.code);
	if (!id || !LANGUAGE_ID_RE.test(id) || !tag || !code) return null;
	const site = r.referenceSite as Record<string, unknown> | undefined;
	const label = str(site?.label);
	const baseUrl = str(site?.baseUrl);
	const wordUrl = str(site?.wordUrl);
	const fsi = r.fsiCategory;
	return {
		id,
		tag,
		code,
		endonym: str(r.endonym) ?? id,
		english: str(r.english) ?? id,
		specialLetters: strs(r.specialLetters),
		edgeVoices: strs(r.edgeVoices),
		...(label && baseUrl ? { referenceSite: { label, baseUrl, ...(wordUrl ? { wordUrl } : {}) } } : {}),
		...(fsi === 1 || fsi === 2 || fsi === 3 || fsi === 4 ? { fsiCategory: fsi } : {}),
	};
}

/** What a profile id may look like: it names a folder under data/. */
export const LANGUAGE_ID_RE = /^[a-z][a-z-]{1,31}$/;

export const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];

export function isLanguageId(v: unknown): v is LanguageId {
	return typeof v === "string" && v in LANGUAGES;
}

export function languageByCode(code: string): LanguageInfo | undefined {
	return [...Object.values(LANGUAGES), ...registry().values()].find((l) => l.code === code);
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
