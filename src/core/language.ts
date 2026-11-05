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
 * 2018) has its own short code. Each was checked to exist on 2026-11-05;
 * `frequency` is absent where FrequencyWords has no list. The voices were
 * checked against the Edge voice list the same day.
 */
export interface CatalogLanguage extends LanguageInfo {
	tatoeba: string;
	wiktionary: string;
	frequency?: string;
}

type CatalogRow = [id: string, tag: string, endonym: string, english: string, voices: [string, string], tatoeba: string, wiktionary: string, frequency?: string];

const CATALOG_ROWS: CatalogRow[] = [
	["albanian", "sq-AL", "Shqip", "Albanian", ["sq-AL-AnilaNeural", "sq-AL-IlirNeural"], "sqi", "Albanian", "sq"],
	["bulgarian", "bg-BG", "Български", "Bulgarian", ["bg-BG-KalinaNeural", "bg-BG-BorislavNeural"], "bul", "Bulgarian", "bg"],
	["catalan", "ca-ES", "Català", "Catalan", ["ca-ES-JoanaNeural", "ca-ES-EnricNeural"], "cat", "Catalan", "ca"],
	["croatian", "hr-HR", "Hrvatski", "Croatian", ["hr-HR-GabrijelaNeural", "hr-HR-SreckoNeural"], "hrv", "Serbo-Croatian", "hr"],
	["czech", "cs-CZ", "Čeština", "Czech", ["cs-CZ-VlastaNeural", "cs-CZ-AntoninNeural"], "ces", "Czech", "cs"],
	["danish", "da-DK", "Dansk", "Danish", ["da-DK-ChristelNeural", "da-DK-JeppeNeural"], "dan", "Danish", "da"],
	["dutch", "nl-NL", "Nederlands", "Dutch", ["nl-NL-ColetteNeural", "nl-NL-MaartenNeural"], "nld", "Dutch", "nl"],
	["estonian", "et-EE", "Eesti", "Estonian", ["et-EE-AnuNeural", "et-EE-KertNeural"], "est", "Estonian", "et"],
	["finnish", "fi-FI", "Suomi", "Finnish", ["fi-FI-NooraNeural", "fi-FI-HarriNeural"], "fin", "Finnish", "fi"],
	["french", "fr-FR", "Français", "French", ["fr-FR-DeniseNeural", "fr-FR-HenriNeural"], "fra", "French", "fr"],
	["galician", "gl-ES", "Galego", "Galician", ["gl-ES-SabelaNeural", "gl-ES-RoiNeural"], "glg", "Galician", "gl"],
	["german", "de-DE", "Deutsch", "German", ["de-DE-KatjaNeural", "de-DE-ConradNeural"], "deu", "German", "de"],
	["greek", "el-GR", "Ελληνικά", "Greek", ["el-GR-AthinaNeural", "el-GR-NestorasNeural"], "ell", "Greek", "el"],
	["hungarian", "hu-HU", "Magyar", "Hungarian", ["hu-HU-NoemiNeural", "hu-HU-TamasNeural"], "hun", "Hungarian", "hu"],
	["icelandic", "is-IS", "Íslenska", "Icelandic", ["is-IS-GudrunNeural", "is-IS-GunnarNeural"], "isl", "Icelandic", "is"],
	["indonesian", "id-ID", "Bahasa Indonesia", "Indonesian", ["id-ID-GadisNeural", "id-ID-ArdiNeural"], "ind", "Indonesian", "id"],
	["irish", "ga-IE", "Gaeilge", "Irish", ["ga-IE-OrlaNeural", "ga-IE-ColmNeural"], "gle", "Irish"],
	["italian", "it-IT", "Italiano", "Italian", ["it-IT-ElsaNeural", "it-IT-DiegoNeural"], "ita", "Italian", "it"],
	["latvian", "lv-LV", "Latviešu", "Latvian", ["lv-LV-EveritaNeural", "lv-LV-NilsNeural"], "lvs", "Latvian", "lv"],
	["lithuanian", "lt-LT", "Lietuvių", "Lithuanian", ["lt-LT-OnaNeural", "lt-LT-LeonasNeural"], "lit", "Lithuanian", "lt"],
	["macedonian", "mk-MK", "Македонски", "Macedonian", ["mk-MK-MarijaNeural", "mk-MK-AleksandarNeural"], "mkd", "Macedonian", "mk"],
	["norwegian", "nb-NO", "Norsk bokmål", "Norwegian", ["nb-NO-PernilleNeural", "nb-NO-FinnNeural"], "nob", "Norwegian Bokmål", "no"],
	["polish", "pl-PL", "Polski", "Polish", ["pl-PL-ZofiaNeural", "pl-PL-MarekNeural"], "pol", "Polish", "pl"],
	["portuguese", "pt-PT", "Português", "Portuguese", ["pt-PT-RaquelNeural", "pt-PT-DuarteNeural"], "por", "Portuguese", "pt"],
	["romanian", "ro-RO", "Română", "Romanian", ["ro-RO-AlinaNeural", "ro-RO-EmilNeural"], "ron", "Romanian", "ro"],
	["russian", "ru-RU", "Русский", "Russian", ["ru-RU-SvetlanaNeural", "ru-RU-DmitryNeural"], "rus", "Russian", "ru"],
	["slovene", "sl-SI", "Slovenščina", "Slovene", ["sl-SI-PetraNeural", "sl-SI-RokNeural"], "slv", "Slovene", "sl"],
	["spanish", "es-ES", "Español", "Spanish", ["es-ES-ElviraNeural", "es-ES-AlvaroNeural"], "spa", "Spanish", "es"],
	["swedish", "sv-SE", "Svenska", "Swedish", ["sv-SE-SofieNeural", "sv-SE-MattiasNeural"], "swe", "Swedish", "sv"],
	["turkish", "tr-TR", "Türkçe", "Turkish", ["tr-TR-EmelNeural", "tr-TR-AhmetNeural"], "tur", "Turkish", "tr"],
	["ukrainian", "uk-UA", "Українська", "Ukrainian", ["uk-UA-PolinaNeural", "uk-UA-OstapNeural"], "ukr", "Ukrainian", "uk"],
	["welsh", "cy-GB", "Cymraeg", "Welsh", ["cy-GB-NiaNeural", "cy-GB-AledNeural"], "cym", "Welsh"],
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
	return {
		id,
		tag,
		code,
		endonym: str(r.endonym) ?? id,
		english: str(r.english) ?? id,
		specialLetters: strs(r.specialLetters),
		edgeVoices: strs(r.edgeVoices),
		...(label && baseUrl ? { referenceSite: { label, baseUrl, ...(wordUrl ? { wordUrl } : {}) } } : {}),
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
