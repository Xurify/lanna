/**
 * Word Bank and Saved Phrases service.
 *
 * Unifies the learner's vocabulary from:
 * - Active review deck cards (FSRS retention and state)
 * - Curated Slovak lexicon (frequency rank, category, POS, examples)
 * - Favorited words and bookmarked phrases
 */

import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { loadLexicon, lookupWord, type Lexicon } from "../agent/lexicon.ts";
import { foldDiacritics, referenceLink, type LanguageInfo } from "../core/language.ts";
import { activeLanguage } from "./active-language.ts";
import { deeplTranslate } from "./deepl.ts";
import { keyValue } from "./keys.ts";
import type { TranslationEngine } from "../core/translation-engine.ts";
import { GRAMMAR_WORDS, grammarWord } from "../core/reading.ts";
import { reviewStore } from "../store/review.ts";
import { savedPhraseStore } from "../store/saved-phrases.ts";
import { knownWordStore } from "../store/known-words.ts";
import { storyStore } from "../store/stories.ts";
import { resolveWord } from "./reading.ts";
import { enqueueWords } from "./review.ts";
import {
	calculateRetention,
	classifyWordState,
	type WordBankItem,
	type WordBankSummary,
	type WordLearningState,
} from "../core/saved-phrases.ts";
import { slovakFormCells } from "../core/slovak-form-note.ts";
import { compareMatches, matchWord, type WordSearchMatch } from "../core/word-search.ts";
import { entryLemma, exampleText, type LexiconEntry, type ReviewCard } from "../core/review.ts";

function activeLang(): LanguageInfo {
	return activeLanguage();
}

interface SelectionLookupResult {
	query: string;
	found: boolean;
	/** ISO 639-1 language code of the active profile (e.g. "sk", "ru"). */
	langCode?: string;
	/** BCP-47 language tag of the active profile (e.g. "sk-SK", "ru-RU"). */
	langTag?: string;
	/** English language name for Wiktionary anchors (e.g. "Slovak", "Russian"). */
	langEnglish?: string;
	slug?: string;
	lemma?: string;
	/** Combined or primary gloss (surface translation + base dictionary meaning). */
	gloss?: string;
	/** Base dictionary meaning of the lemma (e.g. "to cry"). */
	dictionaryGloss?: string;
	/** Inflected surface meaning (e.g. "I don't know", "why is he crying"). */
	surfaceGloss?: string;
	/** Cached or live machine translation of the surface form (DeepL, Google Translate or MyMemory). */
	googleTranslation?: string;
	/** Which service produced `googleTranslation`; absent for cache entries written before it was recorded. */
	translatedBy?: TranslationEngine;
	/** Profile-aware reference site link (e.g. slovak.wiki when active profile has a referenceSite). */
	referenceUrl?: string;
	/** Label for `referenceUrl` (e.g. "slovak.wiki"). */
	referenceLabel?: string;
	pos?: string;
	gender?: string;
	formNote?: string;
	source?: "lexicon" | "stem" | "grammar" | "story" | "translated";
	alternatives?: string[];
	inDeck?: boolean;
	favorite?: boolean;
	/** The learner marked it as known (E71). */
	known?: boolean;
	state?: WordLearningState;
}

function referenceSiteLinkFor(
	slug?: string,
	query?: string,
	lang: LanguageInfo = activeLang(),
	lemma?: string,
): { url?: string; label?: string } {
	const site = lang.referenceSite;
	if (!site) return {};
	return { url: referenceLink(site, { slug, lemma: lemma ?? query, query }), label: site.label };
}

const CASE_NAMES = ["nominative", "genitive", "dative", "accusative", "locative", "instrumental"] as const;

const SURFACE_GLOSS_OVERRIDES: Record<string, string> = {
	neviem: "I don't know",
	nevieš: "you don't know",
	nevie: "doesn't know",
	nevieme: "we don't know",
	neviete: "you don't know",
	nevedia: "they don't know",
	nemám: "I don't have",
	nemáš: "you don't have",
	nemá: "doesn't have",
	nemáme: "we don't have",
	nemáte: "you don't have",
	nemajú: "they don't have",
	nemôžem: "I can't",
	nemôžeš: "you can't",
	nemôže: "can't",
	nemôžeme: "we can't",
	nemôžete: "you can't",
	nemôžu: "they can't",
	nechcem: "I don't want",
	nechceš: "you don't want",
	nechce: "doesn't want",
	nechceme: "we don't want",
	nechcete: "you don't want",
	nechcú: "they don't want",
	nerozumiem: "I don't understand",
	nerozumieš: "you don't understand",
	nerozumie: "doesn't understand",
	nepoznám: "I don't know / recognize",
	nevidím: "I don't see",
	nepočujem: "I don't hear",
	nemyslím: "I don't think",
};

/**
 * Normalizes phrasing like `"not to know"` -> `"to not know"` so English infinitive
 * glosses read naturally alongside positive base verbs.
 */
function normalizeEnglishGloss(gloss: string): string {
	return gloss.replace(/\bnot to ([a-z]+)/gi, "to not $1");
}

/**
 * If a lexicon entry is a negated verb (`nevedieť`, `nerobiť`, `nechcieť`, etc.),
 * resolves the underlying positive verb entry (`vedieť`, `robiť`, `chcieť`) when present in the lexicon.
 */
function findAffirmativeVerbBase(lexicon: Lexicon | null, entry: LexiconEntry): LexiconEntry | undefined {
	if (!lexicon) return undefined;
	const tag = activeLang().tag;
	const lemma = entryLemma(entry);
	const lower = lemma.toLocaleLowerCase(tag);
	const isVerb =
		(entry.pos ?? entry.cat ?? "").toLowerCase() === "verb" ||
		lower.endsWith("ť") ||
		lower.endsWith("ť sa") ||
		lower.endsWith("ť si");
	if (!isVerb || !lower.startsWith("ne") || lower.length < 5) return undefined;
	const positiveLemma = lower.slice(2);
	const candidate = lexicon.byForm
		.get(positiveLemma)
		?.find((lexEntry) => entryLemma(lexEntry).toLocaleLowerCase(tag) === positiveLemma);
	return candidate;
}

// Slovak present-tense endings (robím, robíš, robí, robíme, robíte, robia; píšu,
// nesú) and the past participle in -l, -la, -lo, -li.
function detectPersonLabel(surface: string): string | undefined {
	if (/me$/.test(surface)) return "1st person plural";
	if (/te$/.test(surface)) return "2nd person plural";
	if (/m$/.test(surface)) return "1st person singular";
	if (/š$/.test(surface)) return "2nd person singular";
	if (/(?:l|la|lo|li)$/.test(surface)) return "past tense";
	if (/(?:ia|ú|u)$/.test(surface)) return "3rd person plural";
	if (/[íáaei]$/.test(surface)) return "3rd person singular";
	return undefined;
}

function isSlovakVerb(lemmaLower: string): boolean {
	return lemmaLower.endsWith("ť") || lemmaLower.endsWith("ť sa") || lemmaLower.endsWith("ť si");
}

function detectFormNote(
	surface: string,
	entry: LexiconEntry,
	prefixNote?: string,
	affirmativeBase?: LexiconEntry,
): string | undefined {
	const lang = activeLang();
	const tag = lang.tag;
	const slovak = lang.code === "sk";
	const lower = surface.toLocaleLowerCase(tag);
	const lemma = entryLemma(entry);
	const lemmaLower = lemma.toLocaleLowerCase(tag);

	if (affirmativeBase) {
		const affirmativeLemma = entryLemma(affirmativeBase);
		const person = slovak && lower !== lemmaLower ? detectPersonLabel(lower) : undefined;
		if (person) {
			return `negative ${person} of ${affirmativeLemma} (${affirmativeBase.en})`;
		}
		return `negative form of ${affirmativeLemma} (${affirmativeBase.en})`;
	}

	if (prefixNote) return prefixNote;
	if (lower === lemmaLower) return undefined;
	if (lower.startsWith("ne") && !lemmaLower.startsWith("ne") && lower.length >= 4) {
		const person = slovak && isSlovakVerb(lemmaLower) ? detectPersonLabel(lower) : undefined;
		if (person) return `negative ${person} of ${lemma} (${entry.en})`;
		return `negative form of ${lemma} (${entry.en})`;
	}

	if (entry.declension) {
		const singularIndex = entry.declension.singular.findIndex((form) => form.toLocaleLowerCase(tag) === lower);
		if (singularIndex >= 0 && CASE_NAMES[singularIndex]) {
			return `${CASE_NAMES[singularIndex]} singular of ${lemma}`;
		}
		const pluralIndex = entry.declension.plural.findIndex((form) => form.toLocaleLowerCase(tag) === lower);
		if (pluralIndex >= 0 && CASE_NAMES[pluralIndex]) {
			return `${CASE_NAMES[pluralIndex]} plural of ${lemma}`;
		}
	}

	const tagged = Object.entries(entry.formTags ?? {}).find(([form]) => form.toLocaleLowerCase(tag) === lower)?.[1];
	if (tagged?.length) return `${tagged.join(", or ")} of ${lemma}`;

	if (!slovak) return `inflected form of ${lemma}`;

	if (isSlovakVerb(lemmaLower)) {
		const person = detectPersonLabel(lower);
		if (person) return `${person} of ${lemma}`;
		return `conjugated form of ${lemma}`;
	}

	const cells = slovakFormCells(lower, { lemma, pos: entry.pos, gender: entry.gender });
	if (cells) return `${cells} of ${lemma}`;
	return `inflected form of ${lemma}`;
}

interface CachedTranslation {
	gloss: string;
	engine?: TranslationEngine;
	pos?: string;
	lemma?: string;
	alternatives?: string[];
	updatedAt: string;
}

const translationCacheFile = () => path.join(PATHS.data, "translations-cache.json");
let memoryTranslationCache: { file: string; entries: Record<string, CachedTranslation> } | null = null;

function readTranslationCache(): Record<string, CachedTranslation> {
	const file = translationCacheFile();
	if (memoryTranslationCache?.file === file) return memoryTranslationCache.entries;
	let entries: Record<string, CachedTranslation>;
	try {
		entries = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, CachedTranslation>;
	} catch {
		entries = {};
	}
	memoryTranslationCache = { file, entries };
	return entries;
}

function writeTranslationCacheEntry(key: string, value: CachedTranslation): void {
	const cache = readTranslationCache();
	cache[key] = value;
	try {
		const file = translationCacheFile();
		fs.mkdirSync(path.dirname(file), { recursive: true });
		fs.writeFileSync(file, JSON.stringify(cache, null, "\t"), "utf-8");
	} catch {
		// ignore write errors in read-only environments
	}
}

function deriveVerbSurfaceGloss(surface: string, baseEn: string, isNegative: boolean): string | undefined {
	const cleanVerb = baseEn
		.split(/[;,]/)[0]
		?.trim()
		.replace(/^not\s+to\s+/i, "")
		.replace(/^to\s+not\s+/i, "")
		.replace(/^to\s+/i, "")
		.trim();
	if (!cleanVerb) return undefined;
	if (!isNegative) return undefined;
	const negated: Record<string, string> = {
		"1st person singular": "I don't",
		"2nd person singular": "you don't",
		"3rd person singular": "doesn't",
		"1st person plural": "we don't",
		"2nd person plural": "you don't",
		"3rd person plural": "they don't",
		"past tense": "didn't",
	};
	const person = detectPersonLabel(surface);
	return person && negated[person] ? `${negated[person]} ${cleanVerb}` : undefined;
}

function buildResultFromEntry(
	cleaned: string,
	entry: LexiconEntry,
	source: SelectionLookupResult["source"],
	customGloss?: string,
	prefixNote?: string,
): SelectionLookupResult {
	const lang = activeLang();
	const lexicon = loadLexicon();
	const affirmativeBase = findAffirmativeVerbBase(lexicon, entry);
	const canonicalEntry = affirmativeBase ?? entry;

	const cards = reviewStore.readCards();
	const card = Object.values(cards).find((c) => c.slug === canonicalEntry.slug || c.slug === entry.slug);
	const favorites = new Set(savedPhraseStore.readFavorites());
	const lower = cleaned.toLocaleLowerCase(lang.tag);
	const canonicalLemma = canonicalEntry.lemma ?? canonicalEntry.sk ?? "";
	const lemmaLower = canonicalLemma.toLocaleLowerCase(lang.tag);
	const isNegated =
		Boolean(affirmativeBase) || (lower.startsWith("ne") && !lemmaLower.startsWith("ne") && lower.length >= 4);

	const rawEntryGloss = normalizeEnglishGloss(entry.en);
	const baseGloss = normalizeEnglishGloss(canonicalEntry.en);

	// Check if we already have a cached Google Translate surface translation for this exact inflected form
	const cachedEntry = readTranslationCache()[lower];
	const cachedSurface = cachedEntry?.gloss;
	const cachedSurfaceEngine = cachedEntry?.engine;
	const surfaceOverride =
		SURFACE_GLOSS_OVERRIDES[lower] ??
		deriveVerbSurfaceGloss(lower, canonicalEntry.en, isNegated && lang.code === "sk" && isSlovakVerb(lemmaLower)) ??
		(lower !== lemmaLower ? cachedSurface : undefined);

	let gloss: string;
	if (customGloss) {
		gloss = normalizeEnglishGloss(customGloss);
	} else if (affirmativeBase) {
		// e.g. Neviem -> "I don't know (to not know)"
		const affLemma = affirmativeBase.lemma ?? affirmativeBase.sk ?? "";
		gloss = surfaceOverride ? `${surfaceOverride} (${rawEntryGloss})` : `${rawEntryGloss} (${affLemma} = ${baseGloss})`;
	} else if (isNegated) {
		const negInfinitive = baseGloss.startsWith("to ") ? `to not ${baseGloss.slice(3)}` : `not ${baseGloss}`;
		gloss = surfaceOverride ? `${surfaceOverride} (${negInfinitive})` : negInfinitive;
	} else if (surfaceOverride && lower !== lemmaLower && surfaceOverride.toLowerCase() !== rawEntryGloss.toLowerCase()) {
		// Inflected form with a cached surface translation (e.g. plače -> "he cries · to cry")
		gloss = `${surfaceOverride} · ${rawEntryGloss}`;
	} else {
		gloss = rawEntryGloss;
	}

	const refLink = referenceSiteLinkFor(canonicalEntry.slug, cleaned, lang, entryLemma(canonicalEntry));

	return {
		query: cleaned,
		found: true,
		langCode: lang.code,
		langTag: lang.tag,
		langEnglish: lang.english,
		slug: canonicalEntry.slug,
		lemma: canonicalLemma,
		gloss,
		dictionaryGloss: rawEntryGloss,
		surfaceGloss: surfaceOverride,
		googleTranslation: cachedSurface,
		translatedBy: cachedSurfaceEngine,
		referenceUrl: refLink.url,
		referenceLabel: refLink.label,
		pos: canonicalEntry.pos ?? canonicalEntry.cat,
		gender: canonicalEntry.gender,
		formNote: detectFormNote(cleaned, entry, prefixNote, affirmativeBase),
		source,
		inDeck: !!card,
		favorite: favorites.has(canonicalEntry.slug) || favorites.has(entry.slug),
		known: knownWordStore.has(canonicalEntry.slug) || knownWordStore.has(entry.slug),
		state: card ? classifyWordState(card) : "unseen",
	};
}

/**
 * Synchronous Tier-1 lookup:
 * 1. Exact/folded lexicon form match (`lookupWord`)
 * 2. Grammar & core table (`GRAMMAR_WORDS`)
 * 3. Morphological stemmer (`resolveWord`) + negative (`ne-`) / superlative (`naj-`) prefix stripping
 * 4. Story library `newWords` & glossed tokens
 * 5. Local persistent translation cache (`translations-cache.json`)
 * 6. Multi-word token-by-token offline breakdown (e.g. `"prečo plače"` -> `"prečo (why) + plakať (to cry)"`)
 */
export function lookupSelection(text: string): SelectionLookupResult {
	const lang = activeLang();
	const cleaned = text
		.trim()
		.replace(/^[.,!?;:"'„“”«»()[\]—–-]+|[.,!?;:"'„“”«»()[\]—–-]+$/g, "")
		.trim();
	if (!cleaned) return { query: text, found: false, langCode: lang.code, langTag: lang.tag, langEnglish: lang.english };

	const lexicon = loadLexicon();
	const lower = cleaned.toLocaleLowerCase(lang.tag);
	const folded = foldDiacritics(lower);
	const favorites = new Set(savedPhraseStore.readFavorites());
	const cards = reviewStore.readCards();

	// 1. Direct lexicon form/folded match (avoid English reverse-match collisions for target-language words)
	if (lexicon) {
		const exact = lexicon.byForm.get(lower)?.[0] ?? lexicon.byFolded.get(folded)?.[0];
		if (exact) {
			return buildResultFromEntry(cleaned, exact, "lexicon");
		}
	}

	// 2. Grammar & high-frequency inflected words table (GRAMMAR_WORDS)
	const grammarMatch =
		grammarWord(lower) ??
		(() => {
			for (const [grammarKey, grammarData] of Object.entries(GRAMMAR_WORDS)) {
				if (foldDiacritics(grammarKey) === folded) return { lemma: grammarData[0], gloss: grammarData[1] };
			}
			return undefined;
		})();
	if (grammarMatch) {
		const lexEntry = lexicon?.byForm.get(grammarMatch.lemma.toLocaleLowerCase(lang.tag))?.[0];
		const slug =
			lexEntry?.slug ?? foldDiacritics(grammarMatch.lemma.toLocaleLowerCase(lang.tag)).replace(/[^a-z0-9]+/g, "-");
		const card = Object.values(cards).find((cardEntry) => cardEntry.slug === slug);
		const isDifferent = lower !== grammarMatch.lemma.toLocaleLowerCase(lang.tag);
		const refLink = referenceSiteLinkFor(lexEntry?.slug, grammarMatch.lemma, lang, grammarMatch.lemma);
		return {
			query: cleaned,
			found: true,
			langCode: lang.code,
			langTag: lang.tag,
			langEnglish: lang.english,
			slug,
			lemma: grammarMatch.lemma,
			gloss: grammarMatch.gloss,
			dictionaryGloss: grammarMatch.gloss,
			referenceUrl: refLink.url,
			referenceLabel: refLink.label,
			pos: lexEntry?.pos ?? lexEntry?.cat ?? "Grammar",
			gender: lexEntry?.gender,
			formNote: isDifferent ? `form of ${grammarMatch.lemma}` : undefined,
			source: "grammar",
			inDeck: !!card,
			favorite: favorites.has(slug),
			state: card ? classifyWordState(card) : "unseen",
		};
	}

	// 3. Morphological stemmer + Negative (ne-) & Superlative (naj-) prefix stripping
	if (lexicon && !/\s/.test(cleaned)) {
		const stemmed = resolveWord(lexicon, cleaned, new Set(), { stem: true });
		if (stemmed) {
			return buildResultFromEntry(cleaned, stemmed, "stem");
		}

		if (lower.startsWith("ne") && lower.length >= 5) {
			const stripped = cleaned.slice(2);
			const baseEntry = resolveWord(lexicon, stripped, new Set(), { stem: true });
			if (baseEntry) {
				return buildResultFromEntry(cleaned, baseEntry, "stem");
			}
		}

		if (lower.startsWith("naj") && lower.length >= 6) {
			const stripped = cleaned.slice(3);
			const baseEntry = resolveWord(lexicon, stripped, new Set(), { stem: true });
			if (baseEntry) {
				return buildResultFromEntry(
					cleaned,
					baseEntry,
					"stem",
					`most / -est; ${baseEntry.en}`,
					`superlative of ${entryLemma(baseEntry)}`,
				);
			}
		}
	}

	// 4. Check story library newWords / tokens
	try {
		for (const storySummary of storyStore.list().slice(-25)) {
			const story = storyStore.get(storySummary.id);
			if (!story) continue;
			const matchedNewWord = story.newWords.find(
				(word) => foldDiacritics(word.lemma.toLocaleLowerCase(lang.tag)) === folded,
			);
			if (matchedNewWord) {
				const slug = matchedNewWord.slug ?? folded.replace(/[^a-z0-9]+/g, "-");
				const card = Object.values(cards).find((cardEntry) => cardEntry.slug === slug);
				const refLink = referenceSiteLinkFor(matchedNewWord.slug, matchedNewWord.lemma, lang, matchedNewWord.lemma);
				return {
					query: cleaned,
					found: true,
					langCode: lang.code,
					langTag: lang.tag,
					langEnglish: lang.english,
					slug,
					lemma: matchedNewWord.lemma,
					gloss: matchedNewWord.gloss,
					dictionaryGloss: matchedNewWord.gloss,
					referenceUrl: refLink.url,
					referenceLabel: refLink.label,
					pos: "Vocabulary",
					source: "story",
					inDeck: !!card,
					favorite: favorites.has(slug),
					state: card ? classifyWordState(card) : "unseen",
				};
			}
		}
	} catch {
		// ignore story scan errors
	}

	// 5. Check persistent translation cache
	const cached = readTranslationCache()[lower];
	if (cached) {
		const slug = folded.replace(/[^a-z0-9]+/g, "-");
		const card = Object.values(cards).find((c) => c.slug === slug);
		const refLink = referenceSiteLinkFor(undefined, cleaned, lang);
		return {
			query: cleaned,
			found: true,
			langCode: lang.code,
			langTag: lang.tag,
			langEnglish: lang.english,
			slug,
			lemma: cached.lemma ?? cleaned,
			gloss: cached.gloss,
			surfaceGloss: cached.gloss,
			googleTranslation: cached.gloss,
			translatedBy: cached.engine,
			referenceUrl: refLink.url,
			referenceLabel: refLink.label,
			pos: cached.pos ?? (/\s/.test(cleaned) ? "Phrase" : "Vocabulary"),
			alternatives: cached.alternatives,
			source: "translated",
			inDeck: !!card,
			favorite: favorites.has(slug),
			state: card ? classifyWordState(card) : "unseen",
		};
	}

	// 6. Multi-word phrase breakdown: if user highlighted multiple words (e.g. "prečo plače"),
	// resolve each word token locally so there is ALWAYS an immediate breakdown even offline!
	if (/\s/.test(cleaned)) {
		const rawTokens = cleaned.split(/\s+/).filter(Boolean).slice(0, 8);
		const resolvedParts: string[] = [];
		const glossParts: string[] = [];
		let matchedCount = 0;

		for (const token of rawTokens) {
			const subLookup = lookupSelection(token);
			if (subLookup.found && subLookup.gloss) {
				matchedCount++;
				const baseMeaning = subLookup.dictionaryGloss ?? subLookup.gloss;
				const shortGloss = subLookup.surfaceGloss ?? baseMeaning.split(/[;,]/)[0]?.trim() ?? baseMeaning;
				glossParts.push(shortGloss);
				resolvedParts.push(`${token} (${shortGloss})`);
			} else {
				glossParts.push(token);
			}
		}

		if (matchedCount > 0) {
			const slug = folded.replace(/[^a-z0-9]+/g, "-");
			const card = Object.values(cards).find((cardEntry) => cardEntry.slug === slug);
			const refLink = referenceSiteLinkFor(undefined, cleaned, lang);
			const breakdownGloss = glossParts.join(" · ");
			return {
				query: cleaned,
				found: true,
				langCode: lang.code,
				langTag: lang.tag,
				langEnglish: lang.english,
				slug,
				lemma: cleaned,
				gloss: breakdownGloss,
				dictionaryGloss: breakdownGloss,
				formNote: resolvedParts.join(" + "),
				referenceUrl: refLink.url,
				referenceLabel: refLink.label,
				pos: "Phrase",
				source: "grammar",
				inDeck: !!card,
				favorite: favorites.has(slug),
				state: card ? classifyWordState(card) : "unseen",
			};
		}
	}

	// Fallback English match in lexicon if user highlighted an English word
	const engRes = lookupWord(cleaned, undefined, 1);
	if (engRes.entries[0]) {
		return buildResultFromEntry(cleaned, engRes.entries[0], "lexicon");
	}

	const refLink = referenceSiteLinkFor(undefined, cleaned, lang);
	return {
		query: cleaned,
		found: false,
		langCode: lang.code,
		langTag: lang.tag,
		langEnglish: lang.english,
		referenceUrl: refLink.url,
		referenceLabel: refLink.label,
	};
}

/**
 * Queries DeepL when a key is set, then Google Translate (`dict-chrome-ex` + `clients5`), then MyMemory,
 * using the active language profile's ISO 639-1 code (`lang.code`, e.g. `sk` or `ru`),
 * and caches the result permanently in `translations-cache.json`. With a DeepL key, an entry another
 * service wrote is translated once more by DeepL; if DeepL fails, the older entry is kept.
 */
async function fetchAndCacheRemoteTranslation(cleaned: string): Promise<CachedTranslation | null> {
	const lang = activeLang();
	const sourceLang = lang.code;
	const targetLang = "en";
	const lower = cleaned.toLocaleLowerCase(lang.tag);
	const existing = readTranslationCache()[lower];
	const hasDeepl = Boolean(keyValue("DEEPL_API_KEY")?.trim());
	if (existing && (existing.engine === "deepl" || !hasDeepl)) return existing;

	if (hasDeepl) {
		const translated = await deeplTranslate(cleaned, sourceLang);
		if (translated) {
			const cachedEntry: CachedTranslation = {
				gloss: translated,
				engine: "deepl",
				pos: existing?.pos,
				lemma: cleaned,
				alternatives: existing?.alternatives,
				updatedAt: new Date().toISOString(),
			};
			writeTranslationCacheEntry(lower, cachedEntry);
			return cachedEntry;
		}
		if (existing) return existing;
	}

	// Tier A: translate.googleapis.com with client=dict-chrome-ex (returns both translation & dictionary POS/alternatives)
	try {
		const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&dt=bd&q=${encodeURIComponent(cleaned)}`;
		const response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
			signal: AbortSignal.timeout(2500),
		});
		if (response.ok) {
			const data = (await response.json()) as unknown[];
			const sentences = Array.isArray(data[0]) ? data[0] : [];
			const translated = sentences
				.map((sentence) => (Array.isArray(sentence) && typeof sentence[0] === "string" ? sentence[0] : ""))
				.join("")
				.trim();

			const dictionaryBlocks = Array.isArray(data[1]) ? data[1] : [];
			const firstDictionaryBlock = Array.isArray(dictionaryBlocks[0]) ? dictionaryBlocks[0] : undefined;
			const partOfSpeech = typeof firstDictionaryBlock?.[0] === "string" ? firstDictionaryBlock[0] : undefined;
			const alternatives = Array.isArray(firstDictionaryBlock?.[1])
				? (firstDictionaryBlock[1] as unknown[])
						.filter((alternative): alternative is string => typeof alternative === "string")
						.slice(0, 4)
				: undefined;

			if (translated) {
				const cachedEntry: CachedTranslation = {
					gloss: translated,
					engine: "google",
					pos: partOfSpeech,
					lemma: cleaned,
					alternatives,
					updatedAt: new Date().toISOString(),
				};
				writeTranslationCacheEntry(lower, cachedEntry);
				return cachedEntry;
			}
		}
	} catch {
		// fall through to Tier B
	}

	// Tier B: clients5.google.com/translate_a/t
	try {
		const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&q=${encodeURIComponent(cleaned)}`;
		const response = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0" },
			signal: AbortSignal.timeout(2500),
		});
		if (response.ok) {
			const data = (await response.json()) as unknown;
			const translated =
				Array.isArray(data) && typeof data[0] === "string"
					? data[0].trim()
					: Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === "string"
						? data[0][0].trim()
						: "";
			if (translated) {
				const cachedEntry: CachedTranslation = {
					gloss: translated,
					engine: "google",
					lemma: cleaned,
					updatedAt: new Date().toISOString(),
				};
				writeTranslationCacheEntry(lower, cachedEntry);
				return cachedEntry;
			}
		}
	} catch {
		// fall through to Tier C
	}

	// Tier C: MyMemory translated.net API (Tatoeba/MateCat backed)
	try {
		const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=${encodeURIComponent(sourceLang)}|${encodeURIComponent(targetLang)}`;
		const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
		if (response.ok) {
			const data = (await response.json()) as { responseData?: { translatedText?: string } };
			const translated = data?.responseData?.translatedText?.trim();
			if (translated && translated.toLocaleLowerCase(lang.tag) !== lower) {
				const cachedEntry: CachedTranslation = {
					gloss: translated,
					engine: "mymemory",
					lemma: cleaned,
					updatedAt: new Date().toISOString(),
				};
				writeTranslationCacheEntry(lower, cachedEntry);
				return cachedEntry;
			}
		}
	} catch {
		// ignore network errors
	}

	return null;
}

interface LookupAsyncOptions {
	/**
	 * When true, or when the query is a multi-word phrase or inflected form, also fetches & caches
	 * the natural Google Translate surface translation alongside the local dictionary entry.
	 */
	includeGoogleTranslate?: boolean;
}

/**
 * Asynchronous hybrid lookup:
 * 1. Runs synchronous 6-tier local lookup first (resolving lemma, grammar note, and FSRS Word Bank slug).
 * 2. Fetches & caches the natural Google Translate surface translation whenever:
 *    - the word wasn't found locally,
 *    - the selection is a multi-word phrase (e.g. `"prečo plače"` -> `"why is he crying"`),
 *    - `options.includeGoogleTranslate` is enabled (Hybrid / Google mode), or
 *    - the surface word is an inflected form that differs from its dictionary lemma (e.g. `"plače"` vs `"plakať"`).
 */
export async function lookupSelectionAsync(
	text: string,
	options: LookupAsyncOptions = {},
): Promise<SelectionLookupResult> {
	const lang = activeLang();
	const syncResult = lookupSelection(text);
	if (!syncResult.query) {
		return syncResult;
	}

	const cleaned = syncResult.query;
	const lower = cleaned.toLocaleLowerCase(lang.tag);
	const lemmaLower = (syncResult.lemma ?? cleaned).toLocaleLowerCase(lang.tag);
	const isMultiWord = /\s/.test(cleaned);
	const isInflected = syncResult.found && lower !== lemmaLower && !syncResult.surfaceGloss;
	const shouldFetchGoogle = !syncResult.found || isMultiWord || isInflected || Boolean(options.includeGoogleTranslate);

	if (!shouldFetchGoogle) {
		return syncResult;
	}

	const remote = await fetchAndCacheRemoteTranslation(cleaned);
	if (!remote) {
		return syncResult;
	}

	// If local lookup already found a lexicon/grammar/phrase breakdown, enrich it with Google Translate's natural surface translation!
	if (syncResult.found) {
		if (isMultiWord) {
			return {
				...syncResult,
				gloss: remote.gloss,
				surfaceGloss: remote.gloss,
				googleTranslation: remote.gloss,
				translatedBy: remote.engine,
				source: "translated",
			};
		}
		const baseMean = syncResult.dictionaryGloss ?? syncResult.gloss ?? "";
		const remoteClean = remote.gloss.trim();
		const differsFromBase =
			Boolean(remoteClean) &&
			remoteClean.toLowerCase() !== baseMean.toLowerCase() &&
			!baseMean.toLowerCase().startsWith(remoteClean.toLowerCase());
		const combinedGloss =
			lower !== lemmaLower && differsFromBase && !syncResult.surfaceGloss
				? `${remoteClean} (${baseMean})`
				: syncResult.gloss;
		return {
			...syncResult,
			gloss: combinedGloss,
			surfaceGloss: syncResult.surfaceGloss ?? (lower !== lemmaLower ? remoteClean : undefined),
			googleTranslation: remoteClean,
			translatedBy: remote.engine,
			alternatives: syncResult.alternatives ?? remote.alternatives,
		};
	}

	const folded = foldDiacritics(lower);
	const slug = folded.replace(/[^a-z0-9]+/g, "-") || "word";
	const favorites = new Set(savedPhraseStore.readFavorites());
	const cards = reviewStore.readCards();
	const card = Object.values(cards).find((c) => c.slug === slug);
	const refLink = referenceSiteLinkFor(undefined, cleaned, lang);

	return {
		query: cleaned,
		found: true,
		langCode: lang.code,
		langTag: lang.tag,
		langEnglish: lang.english,
		slug,
		lemma: cleaned,
		gloss: remote.gloss,
		surfaceGloss: remote.gloss,
		googleTranslation: remote.gloss,
		translatedBy: remote.engine,
		referenceUrl: refLink.url,
		referenceLabel: refLink.label,
		pos: remote.pos ?? (isMultiWord ? "Phrase" : "Vocabulary"),
		alternatives: remote.alternatives,
		source: "translated",
		inDeck: !!card,
		favorite: favorites.has(slug),
		state: card ? classifyWordState(card) : "unseen",
	};
}

export function addWordToBank(slugOrWord: string, markFavorite = false, customGloss?: string): SelectionLookupResult {
	const lexicon = loadLexicon();
	const cleaned = slugOrWord.trim();
	let entry = lexicon?.bySlug.get(cleaned);
	if (!entry && lexicon) {
		const res = lookupWord(cleaned, undefined, 1);
		entry = res.entries[0] ?? resolveWord(lexicon, cleaned, new Set(), { stem: true });
	}

	if (entry) {
		enqueueWords([entry.slug]);
		if (markFavorite) {
			savedPhraseStore.setFavorite(entry.slug, true);
		}
		const cards = reviewStore.readCards();
		const card = Object.values(cards).find((c) => c.slug === entry!.slug);
		const favorites = new Set(savedPhraseStore.readFavorites());

		return {
			query: slugOrWord,
			found: true,
			slug: entry.slug,
			lemma: entry.sk,
			gloss: entry.en,
			pos: entry.pos ?? entry.cat,
			gender: entry.gender,
			inDeck: !!card,
			favorite: favorites.has(entry.slug),
			state: card ? classifyWordState(card) : "new",
		};
	}

	// Universal fallback for words outside the base lexicon (e.g. GRAMMAR_WORDS, custom/translated words)
	const looked = lookupSelection(cleaned);
	const lemma = looked.lemma ?? cleaned;
	const gloss = customGloss || looked.gloss || "";
	const slug = looked.slug ?? (foldDiacritics(lemma.toLocaleLowerCase("sk-SK")).replace(/[^a-z0-9]+/g, "-") || "word");

	if (markFavorite) {
		savedPhraseStore.setFavorite(slug, true);
	}
	if (gloss) {
		writeTranslationCacheEntry(lemma.toLocaleLowerCase("sk-SK"), {
			gloss,
			lemma,
			pos: looked.pos ?? "Vocabulary",
			updatedAt: new Date().toISOString(),
		});
	}
	savedPhraseStore.savePhrase({
		text: lemma,
		translation: gloss,
		source: "manual",
	});

	return {
		query: slugOrWord,
		found: true,
		slug,
		lemma,
		gloss: gloss || undefined,
		pos: looked.pos ?? "Vocabulary",
		inDeck: true,
		favorite: savedPhraseStore.isFavorite(slug),
		state: "new",
	};
}

export interface WordBankQuery {
	search?: string;
	pos?: string;
	status?: "all" | "mastered" | "learning" | "new" | "unseen" | "favorite" | "due" | "known";
	limit?: number;
	offset?: number;
}

interface WordBankResult {
	items: WordBankItem[];
	total: number;
	summary: WordBankSummary;
}

const RANK = { start: 1, contains: 2, form: 3, meaning: 4, example: 5 } as const;

export function getWordBank(query: WordBankQuery = {}, now = new Date()): WordBankResult {
	const lexicon = loadLexicon();
	const cards = reviewStore.readCards();
	const favoritesSet = new Set(savedPhraseStore.readFavorites());
	const savedPhrases = savedPhraseStore.readPhrases();
	const knownSet = knownWordStore.slugs();

	// Map cards by lemma/slug for instant lookup
	const cardBySlug = new Map<string, ReviewCard>();
	for (const card of Object.values(cards)) {
		if (!cardBySlug.has(card.slug)) {
			cardBySlug.set(card.slug, card);
		}
	}

	const entries = lexicon?.entries ?? [];
	const items: WordBankItem[] = [];

	let wordsMastered = 0;
	let wordsLearning = 0;
	let wordsDue = 0;
	let wordsKnown = 0;
	let totalRetentionSum = 0;
	let cardsReviewedCount = 0;

	const searchText = query.search?.trim();
	const posFilter = query.pos?.trim().toLowerCase();

	for (const entry of entries) {
		const card = cardBySlug.get(entry.slug);
		const favorite = favoritesSet.has(entry.slug);
		const known = knownSet.has(entry.slug);
		const inDeck = !!card;

		let state: WordLearningState = "unseen";
		let retention = 0;
		let stability = 0;
		let reps = 0;
		let lapses = 0;
		let due: string | undefined;
		let lastReviewed: string | undefined;

		if (card) {
			reps = card.reps ?? 0;
			lapses = card.lapses ?? 0;
			stability = card.memory?.stability ?? 0;
			due = card.due;
			lastReviewed = card.lastReview;
			retention = calculateRetention(card);
			state = classifyWordState(card);

			if (state === "mastered") wordsMastered++;
			else if (state === "learning" && !known) wordsLearning++;

			if (card.due && new Date(card.due).getTime() <= now.getTime()) {
				wordsDue++;
			}

			if (reps > 0) {
				totalRetentionSum += retention;
				cardsReviewedCount++;
			}
		}

		// Apply filters
		if (known || state === "mastered") wordsKnown++;
		if (query.status === "favorite" && !favorite) continue;
		if (query.status === "known" && !known && state !== "mastered") continue;
		if (query.status === "mastered" && state !== "mastered") continue;
		if (query.status === "learning" && (state !== "learning" || known)) continue;
		if (query.status === "new" && state !== "new") continue;
		if (query.status === "unseen" && state !== "unseen") continue;
		if (query.status === "due" && (!due || new Date(due).getTime() > now.getTime())) continue;

		if (posFilter && posFilter !== "all") {
			const entryPos = (entry.pos ?? entry.cat ?? "").toLowerCase();
			if (!entryPos.includes(posFilter)) continue;
		}

		let match: WordSearchMatch | null = null;
		if (searchText) {
			match = matchWord(searchText, {
				lemma: entryLemma(entry),
				gloss: entry.en,
				forms: entry.forms,
				examples: (entry.examples ?? []).filter((e) => !e.rejected).map((e) => ({ sk: exampleText(e), en: e.en })),
			});
			if (!match) continue;
		}

		const firstExample = entry.examples?.find((e) => !e.rejected);
		const example = firstExample ? { sk: exampleText(firstExample), en: firstExample.en } : undefined;

		items.push({
			slug: entry.slug,
			lemma: entryLemma(entry),
			gloss: entry.en,
			pos: entry.pos ?? entry.cat,
			gender: entry.gender,
			rank: entry.rank,
			cat: entry.cat,
			state,
			stability,
			retention,
			reps,
			lapses,
			lastReviewed,
			due,
			example,
			favorite,
			known,
			inDeck,
			...(match ? { match: { kind: match.kind, span: match.span, via: match.via } } : {}),
		});
	}

	// Sort logic:
	// 1. Favorites and cards in deck come first if no explicit query
	// 2. Otherwise sort by frequency rank (lower rank = commoner)
	items.sort((a, b) => {
		// A search is ranked by how well it matched, then by frequency; with no search, your own words first.
		if (a.match && b.match)
			return compareMatches(
				{ match: { ...a.match, rank: RANK[a.match.kind] }, rank: a.rank },
				{ match: { ...b.match, rank: RANK[b.match.kind] }, rank: b.rank },
			);
		if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
		if (a.inDeck !== b.inDeck) return a.inDeck ? -1 : 1;
		const rankA = a.rank ?? 99999;
		const rankB = b.rank ?? 99999;
		return rankA - rankB;
	});

	const offset = query.offset ?? 0;
	const limit = query.limit ?? 50;
	const paginated = items.slice(offset, offset + limit);

	const summary: WordBankSummary = {
		totalWords: entries.length,
		wordsMastered,
		wordsLearning,
		wordsDue,
		wordsFavorited: favoritesSet.size,
		wordsKnown,
		savedPhrasesCount: savedPhrases.length,
		averageRetention: cardsReviewedCount > 0 ? Math.round(totalRetentionSum / cardsReviewedCount) : 0,
	};

	return {
		items: paginated,
		total: items.length,
		summary,
	};
}
