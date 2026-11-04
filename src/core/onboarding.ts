/**
 * Onboarding: how the app learns what the learner wants and where they stand, without a chat.
 * Three structured sources feed the plan:
 *   purposes  - what Slovak is for; derives the target level (overridable)
 *   placement - a staircase drill of lexicon sentences; passed tiers skip their chapters
 *   the ledger - lesson-screen measurements afterwards; "re-check my level" reruns the staircase
 * The tutor reads all of it as a profile block (learnerProfileText). Pure and browser-safe.
 */

import { CEFR_ORDER, CHAPTERS, curriculumUnit, GUIDED_HOURS, STAGES, type Cefr, type CurriculumState, type UnitEvidence } from "./curriculum.ts";
import { isUnitId, unitInfo, type LessonItem, type UnitId } from "./lesson.ts";
import { entryLemma, exampleText } from "./review.ts";
import { slipLine } from "./grammar.ts";
import type { FirstTally } from "./first-try.ts";
import { weakSpotList, weakSpotsLine, type WeakRecord } from "./weak-spots.ts";
import { flowTutorLine, type UnitZone } from "./flow.ts";
import { mixupList, mixupsLine, type MixupRecord } from "./mixups.ts";

// ─── What Slovak is for ─────────────────────────────────────────────────────

export type Purpose = "family" | "daily" | "work" | "offices" | "media" | "exam" | "curious" | "other";

export interface PurposeInfo {
	id: Purpose;
	title: string;
	blurb: string;
	/** lucide icon name (components/lesson/unit-icon.tsx). */
	glyph: string;
	/** The level this purpose needs, by the map's can-do goals. */
	level: Cefr;
	/** Can-do goals on the map (src/core/curriculum.ts) that serve it. */
	goals: string[];
	/** Talk scenes (components/lesson/tutor.ts) that prove it. */
	scenes: string[];
}

export const PURPOSES: PurposeInfo[] = [
	{
		id: "family",
		title: "Family and friends",
		blurb: "In-laws, a partner's family, friends who switch to Slovak",
		glyph: "users",
		level: "B1",
		goals: ["can-introduce", "can-family", "can-describe-day", "can-tell-day", "can-describe-people", "can-narrate", "can-opinion"],
		scenes: ["family", "colleague"],
	},
	{
		id: "daily",
		title: "Daily life in Slovakia",
		blurb: "Cafés, shops, the doctor, getting around",
		glyph: "coffee",
		level: "A2",
		goals: ["can-order", "can-directions", "can-shop", "can-appointment", "can-travel", "can-plan"],
		scenes: ["cafe", "way", "shop", "doctor"],
	},
	{
		id: "work",
		title: "Work",
		blurb: "Colleagues, meetings, emails, interviews",
		glyph: "briefcase",
		level: "B2",
		goals: ["can-interview", "can-opinion", "can-complain", "can-write-formal", "can-debate"],
		scenes: ["colleague"],
	},
	{
		id: "offices",
		title: "Offices and paperwork",
		blurb: "Forms, the foreigners' police, phone calls, complaints",
		glyph: "file-text",
		level: "B1",
		goals: ["can-appointment", "can-complain", "can-write-formal"],
		scenes: ["doctor", "shop"],
	},
	{
		id: "media",
		title: "News, books and film",
		blurb: "Read the news, follow a film, listen to a podcast",
		glyph: "newspaper",
		level: "B2",
		goals: ["can-read-news", "can-narrate", "can-follow-media"],
		scenes: ["colleague"],
	},
	{
		id: "exam",
		title: "An exam or citizenship",
		blurb: "A certificate at a set level, by a date",
		glyph: "graduation-cap",
		level: "B1",
		goals: ["can-interview", "can-opinion", "can-complain", "can-write-formal"],
		scenes: ["colleague", "family"],
	},
	{
		id: "curious",
		title: "Curiosity",
		blurb: "No deadline, the pleasure of a new language",
		glyph: "sparkles",
		level: "A2",
		goals: ["can-introduce", "can-order", "can-directions", "can-family"],
		scenes: ["cafe", "way", "family"],
	},
	{
		// Free-text catch-all: the learner's note goes to the tutor verbatim.
		id: "other",
		title: "Something else",
		blurb: "Say it in a sentence; the tutor reads it",
		glyph: "pen-line",
		level: "A2",
		goals: [],
		scenes: [],
	},
];

export const MAX_PURPOSES = 3;
export const MAX_PURPOSE_NOTE = 240;

export function isPurpose(v: unknown): v is Purpose {
	return typeof v === "string" && PURPOSES.some((p) => p.id === v);
}

export function purposeInfo(id: Purpose): PurposeInfo {
	return PURPOSES.find((p) => p.id === id)!;
}

/** "Daily life in Slovakia" → "daily life in Slovakia": for mid-sentence use. */
export function purposePhrase(id: Purpose): string {
	const t = purposeInfo(id).title;
	return t.charAt(0).toLowerCase() + t.slice(1);
}

/** The target the purposes imply: the highest level any of them needs
 *  (an exam's own level wins when given). Nothing picked → A2: enough to
 *  get by, and the map says how far it is from there. */
export function suggestedLevel(purposes: readonly Purpose[], examLevel?: Cefr): Cefr {
	let best: Cefr = "A2";
	for (const id of purposes) {
		const lv = purposeLevel(id, examLevel);
		if (CEFR_ORDER.indexOf(lv) > CEFR_ORDER.indexOf(best)) best = lv;
	}
	return best;
}

/** What each level buys in Slovak life, in plain words. Based on the CEFR Companion Volume (2020). */
export const LEVEL_CAN_DO: Record<Cefr, string> = {
	A1: "Say hello, order a coffee, count, ask the way. Set phrases and a lot of pointing; people switch to English fast.",
	A2: "Shop, book the doctor, say what you did today, get around town. Simple talk with people who slow down for you.",
	B1: "Chat with family and friends about everyday life, tell a story, give an opinion, get through an office visit. A vlog with clear speech is followable.",
	B2: "Hold your own at work and in an argument, follow the news and most films, write a formal email. Slovaks talk to you at their own speed.",
	C1: "Nuance, humour, long articles and novels, any meeting. Mistakes are rare and nobody slows down for you.",
};

/** The level a purpose needs: the exam's own level when given. */
export function purposeLevel(id: Purpose, examLevel?: Cefr): Cefr {
	return id === "exam" && examLevel ? examLevel : purposeInfo(id).level;
}

/** Which purposes a level covers and which need a higher one. "Something else" is skipped. */
export function levelFit(level: Cefr, purposes: readonly Purpose[], examLevel?: Cefr): { covered: Purpose[]; short: Array<{ purpose: Purpose; level: Cefr }> } {
	const covered: Purpose[] = [];
	const short: Array<{ purpose: Purpose; level: Cefr }> = [];
	for (const p of purposes) {
		if (p === "other") continue;
		const need = purposeLevel(p, examLevel);
		if (CEFR_ORDER.indexOf(need) <= CEFR_ORDER.indexOf(level)) covered.push(p);
		else short.push({ purpose: p, level: need });
	}
	return { covered, short };
}

/** One sentence on how `level` serves the purposes, or "" with none. */
export function levelFitLine(level: Cefr, purposes: readonly Purpose[], examLevel?: Cefr): string {
	const { covered, short } = levelFit(level, purposes, examLevel);
	const list = (ps: readonly Purpose[]) => ps.map(purposePhrase).join(", ");
	const parts: string[] = [];
	if (covered.length) parts.push(`Enough for ${list(covered)}.`);
	if (short.length) {
		const line = short.map((x) => `${purposePhrase(x.purpose)} needs ${x.level}`).join(", ");
		parts.push(`${line.charAt(0).toUpperCase()}${line.slice(1)}: at ${level} ${short.length === 1 ? "that part stays" : "those stay"} out of reach.`);
	}
	return parts.join(" ");
}

/** Goal unit ids the purposes serve (for the map's "your goal" marks). */
export function purposeGoals(purposes: readonly Purpose[]): Set<string> {
	return new Set(purposes.flatMap((p) => purposeInfo(p).goals));
}

export function purposeScenes(purposes: readonly Purpose[]): string[] {
	return [...new Set(purposes.flatMap((p) => purposeInfo(p).scenes))];
}

// ─── What the learner brings ────────────────────────────────────────────────

/** A language the learner may know. The `primary` ones are chips; the rest sit behind a searchable panel. */
export type Lang =
	| "et" | "fi" | "ru" | "de"
	| "cs" | "pl" | "uk" | "sl" | "hr" | "bg"
	| "hu" | "lv" | "lt"
	| "en" | "sv" | "nl" | "fr" | "es" | "it" | "pt"
	| "sr" | "mk" | "be" | "ro" | "el" | "tr" | "no" | "da" | "is" | "ga" | "cy" | "eu" | "ca" | "gl" | "sq" | "mt"
	| "ar" | "he" | "fa" | "hi" | "ur" | "bn" | "pa" | "ta" | "te" | "ml"
	| "ja" | "ko" | "zh" | "vi" | "th" | "id" | "ms" | "tl"
	| "sw" | "am" | "ka" | "hy" | "az" | "kk" | "uz" | "mn";

export type Prior = "none" | "words" | "sentences" | "reading";

/** The languages the lessons carry a bridge line for (src/core/unit-bridges.ts). */
export type BridgeLang = "et" | "fi" | "ru" | "de";
export const BRIDGE_LANGS: readonly BridgeLang[] = ["et", "fi", "ru", "de"];

/** CEFR level (A1 to C2) or "native". Sets how much weight the language carries in lessons. */
export type LangLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "native";
export const LANG_LEVELS: ReadonlyArray<{ id: LangLevel; title: string; line: string }> = [
	{ id: "A1", title: "A1", line: "A few words and set phrases" },
	{ id: "A2", title: "A2", line: "Simple texts and everyday talk, with help" },
	{ id: "B1", title: "B1", line: "I get by in most everyday situations" },
	{ id: "B2", title: "B2", line: "I read and talk comfortably about most things" },
	{ id: "C1", title: "C1", line: "Long, demanding texts; I rarely search for a word" },
	{ id: "C2", title: "C2", line: "Everything, with ease; near native" },
	{ id: "native", title: "Native", line: "I grew up with it" },
];
/** Level assumed when none is saved. */
export const DEFAULT_LANG_LEVEL: LangLevel = "B2";
const LEVEL_RANK: Record<LangLevel, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5, native: 6 };
/** Legacy three-step levels, read as CEFR. */
const LEGACY_LEVEL: Record<string, LangLevel> = { basic: "A2", good: "B2", fluent: "native" };
/** A level the learner still needs a hand with: lines in it stay short. */
export function isLowLevel(level: LangLevel): boolean {
	return LEVEL_RANK[level] <= LEVEL_RANK.A2;
}

export interface KnownLanguageInfo {
	id: Lang;
	title: string;
	/** What it brings to Slovak, in a few words (the chip's tooltip and the tutor's note). */
	line: string;
	/** Shown as a chip without opening the panel. */
	primary?: boolean;
}

/** Bridge languages first, then the Slavic family, then other case
 *  languages, then the rest of Europe; the panel holds everything else. */
export const KNOWN_LANGUAGES: readonly KnownLanguageInfo[] = [
	{ id: "et", title: "Estonian", line: "14 cases: the closest model for Slovak cases; the lessons show every form the Estonian way", primary: true },
	{ id: "fi", title: "Finnish", line: "15 cases: the lessons show every form the Finnish way", primary: true },
	{ id: "ru", title: "Russian", line: "The same six cases and aspect; cognates and false friends; the lessons show every form the Russian way", primary: true },
	{ id: "de", title: "German", line: "Four cases, gender and agreement; the lessons show every form the German way", primary: true },
	{ id: "cs", title: "Czech", line: "Nearly the same grammar, different sounds", primary: true },
	{ id: "pl", title: "Polish", line: "Cases and aspect carry over; cognates", primary: true },
	{ id: "uk", title: "Ukrainian", line: "Close vocabulary, the same case logic", primary: true },
	{ id: "sl", title: "Slovene", line: "Cases and aspect carry over; the dual is extra", primary: true },
	{ id: "hr", title: "Croatian", line: "Seven cases and aspect; many cognates", primary: true },
	{ id: "bg", title: "Bulgarian", line: "Aspect and vocabulary carry over; no cases to lean on", primary: true },
	{ id: "hu", title: "Hungarian", line: "Cases and agglutination: the idea of a case ending is familiar", primary: true },
	{ id: "lv", title: "Latvian", line: "Seven cases and gender", primary: true },
	{ id: "lt", title: "Lithuanian", line: "Seven cases, gender and aspect-like prefixes", primary: true },
	{ id: "en", title: "English", line: "The app explains in English", primary: true },
	{ id: "sv", title: "Swedish", line: "Gender and verb-second word order", primary: true },
	{ id: "nl", title: "Dutch", line: "Gender and verb-second word order", primary: true },
	{ id: "fr", title: "French", line: "Gender, agreement and verb endings", primary: true },
	{ id: "es", title: "Spanish", line: "Gender, agreement, verb endings and a perfective/imperfective past", primary: true },
	{ id: "it", title: "Italian", line: "Gender, agreement and verb endings", primary: true },
	{ id: "pt", title: "Portuguese", line: "Gender, agreement and verb endings", primary: true },
	{ id: "sr", title: "Serbian", line: "Seven cases and aspect; many cognates" },
	{ id: "mk", title: "Macedonian", line: "Aspect and vocabulary carry over; no cases to lean on" },
	{ id: "be", title: "Belarusian", line: "The same six cases and aspect; close vocabulary" },
	{ id: "ro", title: "Romanian", line: "Gender, a little case marking, and a Slavic layer in the vocabulary" },
	{ id: "el", title: "Greek", line: "Four cases, gender and agreement; aspect in the verb" },
	{ id: "tr", title: "Turkish", line: "Cases and agglutination" },
	{ id: "no", title: "Norwegian", line: "Gender and verb-second word order" },
	{ id: "da", title: "Danish", line: "Gender and verb-second word order" },
	{ id: "is", title: "Icelandic", line: "Four cases, gender and agreement" },
	{ id: "ga", title: "Irish", line: "Cases, gender and initial mutations" },
	{ id: "cy", title: "Welsh", line: "Gender and initial mutations; no cases" },
	{ id: "eu", title: "Basque", line: "Cases and agglutination; ergative" },
	{ id: "ca", title: "Catalan", line: "Gender, agreement and verb endings" },
	{ id: "gl", title: "Galician", line: "Gender, agreement and verb endings" },
	{ id: "sq", title: "Albanian", line: "Cases, gender and a definite ending" },
	{ id: "mt", title: "Maltese", line: "Gender and agreement; Semitic verb patterns" },
	{ id: "ar", title: "Arabic", line: "Case endings in the formal language; gender and agreement" },
	{ id: "he", title: "Hebrew", line: "Gender and agreement; no cases" },
	{ id: "fa", title: "Persian", line: "No gender or cases; an object marker" },
	{ id: "hi", title: "Hindi", line: "Gender, an oblique case and postpositions" },
	{ id: "ur", title: "Urdu", line: "Gender, an oblique case and postpositions" },
	{ id: "bn", title: "Bengali", line: "Case suffixes; no gender" },
	{ id: "pa", title: "Punjabi", line: "Gender, an oblique case and postpositions" },
	{ id: "ta", title: "Tamil", line: "Case suffixes and agglutination" },
	{ id: "te", title: "Telugu", line: "Case suffixes and agglutination" },
	{ id: "ml", title: "Malayalam", line: "Case suffixes and agglutination" },
	{ id: "ja", title: "Japanese", line: "Particles mark the role a case ending marks in Slovak" },
	{ id: "ko", title: "Korean", line: "Particles mark the role a case ending marks in Slovak" },
	{ id: "zh", title: "Chinese", line: "No endings at all: every Slovak ending is new" },
	{ id: "vi", title: "Vietnamese", line: "No endings at all: every Slovak ending is new" },
	{ id: "th", title: "Thai", line: "No endings at all: every Slovak ending is new" },
	{ id: "id", title: "Indonesian", line: "No cases or gender; affixes on the verb" },
	{ id: "ms", title: "Malay", line: "No cases or gender; affixes on the verb" },
	{ id: "tl", title: "Filipino", line: "Case markers on the noun phrase; focus on the verb" },
	{ id: "sw", title: "Swahili", line: "Noun classes and agreement, like gender with more classes" },
	{ id: "am", title: "Amharic", line: "Gender and agreement; an object marker" },
	{ id: "ka", title: "Georgian", line: "Seven cases and agglutination" },
	{ id: "hy", title: "Armenian", line: "Seven cases; no gender" },
	{ id: "az", title: "Azerbaijani", line: "Cases and agglutination" },
	{ id: "kk", title: "Kazakh", line: "Cases and agglutination" },
	{ id: "uz", title: "Uzbek", line: "Cases and agglutination" },
	{ id: "mn", title: "Mongolian", line: "Cases and agglutination" },
];

export const MAX_LANGUAGES = 12;
export const MAX_OTHER_LANGUAGES = 5;
export const MAX_OTHER_LANGUAGE_LENGTH = 40;

export function isLang(v: unknown): v is Lang {
	return typeof v === "string" && KNOWN_LANGUAGES.some((l) => l.id === v);
}
export function isLangLevel(v: unknown): v is LangLevel {
	return typeof v === "string" && LANG_LEVELS.some((l) => l.id === v);
}
/** A stored level, new or legacy, as a CEFR level; undefined when neither. */
export function normalizeLangLevel(v: unknown): LangLevel | undefined {
	if (isLangLevel(v)) return v;
	return typeof v === "string" ? LEGACY_LEVEL[v] : undefined;
}
export function isBridgeLang(v: unknown): v is BridgeLang {
	return typeof v === "string" && (BRIDGE_LANGS as readonly string[]).includes(v);
}
export function languageInfo(id: Lang): KnownLanguageInfo {
	return KNOWN_LANGUAGES.find((l) => l.id === id)!;
}
export function languageName(id: Lang): string {
	return languageInfo(id).title;
}

/** Legacy profiles kept one first language. */
const LEGACY_FIRST: Record<string, Lang | undefined> = { et: "et", en: "en" };

/** Every language the learner knows, strongest first. A profile that never said reads as Estonian and English. */
export function knownLanguages(goal: Pick<LearnerGoal, "languages" | "firstLanguage" | "bridges"> | null | undefined): Lang[] {
	if (goal?.languages) return goal.languages;
	if (goal?.firstLanguage || goal?.bridges?.length) {
		const first = LEGACY_FIRST[goal.firstLanguage ?? ""];
		return [...new Set([...(first ? [first] : []), ...(goal.bridges ?? []).filter(isLang), "en" as Lang])];
	}
	return ["et", "en"];
}

/** How well the learner knows a language (DEFAULT_LANG_LEVEL when unsaid). */
export function languageLevel(goal: Pick<LearnerGoal, "languageLevels"> | null | undefined, lang: Lang): LangLevel {
	return normalizeLangLevel(goal?.languageLevels?.[lang]) ?? DEFAULT_LANG_LEVEL;
}

/** The known languages the lessons can show a form in: the best-known
 *  first (a native or C-level one leads the retry hint, an A-level one is
 *  an aside), ties in the learner's own order. */
export function bridgeLanguages(goal: Pick<LearnerGoal, "languages" | "languageLevels" | "firstLanguage" | "bridges"> | null | undefined): BridgeLang[] {
	return knownLanguages(goal)
		.filter(isBridgeLang)
		.map((l, i) => ({ l, i, rank: LEVEL_RANK[languageLevel(goal, l)] }))
		.sort((a, b) => b.rank - a.rank || a.i - b.i)
		.map((x) => x.l);
}

export const MAX_EXPLAIN = 2;

/** Whether parallels from the learner's languages are shown (absent = on). */
export function parallelsOn(goal: Pick<LearnerGoal, "showParallels"> | null | undefined): boolean {
	return goal?.showParallels !== false;
}

/** One-line explanation of parallels, naming the learner's own languages that the lessons have a line for. */
export function parallelsLine(goal: Pick<LearnerGoal, "languages" | "languageLevels" | "firstLanguage" | "bridges"> | null | undefined): string {
	const langs = bridgeLanguages(goal);
	if (langs.length === 0) return "Explanations stay in English (or the language you pick below); no other language shows up in the lessons.";
	const names = langs.map(languageName);
	const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
	const example = langs[0] === "et" ? "v meste ≈ linnas" : langs[0] === "fi" ? "v meste ≈ kaupungissa" : langs[0] === "ru" ? "v meste ≈ в городе" : "v meste ≈ in der Stadt";
	return `When a Slovak rule mirrors one in ${list}, the Why? panel and the tutor's hints show that one line as a memory aid (${example}), ${names.length === 1 ? "" : "best-known first, "}never a lesson in ${names.length === 1 ? "that language" : "those languages"}. You can turn it off in Settings → Learning.`;
}

/** Explanation languages in order: the first carries the explanation, the second the key line and terms. English by default. */
export function explanationLanguages(goal: Pick<LearnerGoal, "explainIn"> | null | undefined): Lang[] {
	const raw = goal?.explainIn;
	const list = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(isLang);
	return list.length ? [...new Set(list)].slice(0, MAX_EXPLAIN) : ["en"];
}

export const PRIORS: Array<{ id: Prior; title: string; line: string }> = [
	{ id: "none", title: "Nothing yet", line: "Start at the very beginning" },
	{ id: "words", title: "A few words", line: "Greetings, numbers, some food" },
	{ id: "sentences", title: "Simple sentences", line: "I can introduce myself and order" },
	{ id: "reading", title: "I read some Slovak", line: "I follow texts but my endings are shaky" },
];

export function isPrior(v: unknown): v is Prior {
	return typeof v === "string" && PRIORS.some((p) => p.id === v);
}

// ─── The learner's goal record ──────────────────────────────────────────────

/** The goal record kept under `goal` in progress.json (src/store/progress.ts). */
export interface LearnerGoal {
	level: Cefr;
	minutesPerDay: number;
	daysPerWeek?: number;
	purposes?: Purpose[];
	/** The learner's own words for "other". */
	purposeNote?: string;
	/** Languages the learner knows, strongest first. */
	languages?: Lang[];
	/** Level per language as the learner pressed it; absent = none pressed yet (the tutor reads DEFAULT_LANG_LEVEL). Legacy "basic" | "good" | "fluent" are read via languageLevel(). */
	languageLevels?: Partial<Record<Lang, LangLevel>>;
	/** @deprecated Legacy free text; still read, no longer written. */
	otherLanguages?: string[];
	/** Languages the tutor explains in, up to MAX_EXPLAIN; the first leads. A single string is read as a list of one. */
	explainIn?: Lang[] | Lang;
	/** @deprecated Legacy; read through `knownLanguages()`. */
	firstLanguage?: string;
	/** @deprecated See `firstLanguage`. */
	bridges?: string[];
	prior?: Prior;
	/** Show parallels from the learner's languages in the Why? panel and tutor hints. Absent = on. */
	showParallels?: boolean;
	/** ISO time the setup was completed (or skipped). Absent = first run. */
	onboardedAt?: string;
	/** The last placement: when, the level it found, and the first chapter
	 *  the learner works in (every chapter before it is skipped on the map). */
	placedAt?: string;
	placedLevel?: Cefr;
	startChapter?: string;
	/** The Socratic stage's closing line from the last check: the edge in words. */
	placedNote?: string;
	/** The last vocabulary-size check (src/core/vocab-probe.ts): the
	 *  estimate in lemmas and when. The words calculator trusts it over
	 *  the level's band. */
	vocabulary?: { size: number; at: string; reliable: boolean };
}

export const DEFAULT_DAYS_PER_WEEK = 6;
/** Quick picks; the stepper accepts any value up to MAX_MINUTES. */
export const MINUTE_CHOICES = [10, 15, 20, 30, 45, 60, 90, 120] as const;
export const MAX_MINUTES = 600;

/** XP an hour before there is an hour of measured study to read it from: the first days of a real profile ran 105 to 160. */
export const DEFAULT_XP_PER_HOUR = 120;

/** The XP that counts as a day done: the plan's minutes a day at the learner's own XP an hour (a typical one until it is measured), to the nearest 10. The learner picks how long to study; this follows. */
export function xpForPlan(minutesPerDay: number, xpPerHour: number | null): number {
	return Math.max(10, Math.min(500, Math.round(((minutesPerDay / 60) * (xpPerHour ?? DEFAULT_XP_PER_HOUR)) / 10) * 10));
}

/** Guided hours a week at the planned minutes and days. */
export function weeklyHours(minutesPerDay: number, daysPerWeek = DEFAULT_DAYS_PER_WEEK): number {
	return (minutesPerDay / 60) * daysPerWeek;
}

/** The month the target is reached from zero, at the planned pace. */
export function etaFromScratch(level: Cefr, minutesPerDay: number, daysPerWeek: number, hoursDone: number, now: Date): string | null {
	const weekly = weeklyHours(minutesPerDay, daysPerWeek);
	if (weekly <= 0) return null;
	const left = Math.max(0, GUIDED_HOURS[level] - hoursDone);
	const d = new Date(now.getTime() + Math.round((left / weekly) * 7) * 86_400_000);
	return d.toISOString().slice(0, 10);
}

// ─── Placement: the staircase ───────────────────────────────────────────────

export interface PlacementTier {
	id: string;
	level: Cefr;
	title: string;
	/** Drill units probed, two reps each (choose, then type). */
	units: UnitId[];
	/** Chapters the tier stands for: passing it skips them on the map. */
	chapters: string[];
}

/** Four tiers, each the grammar of a stretch of the map. A tier passes at PASS_SHARE of its reps. */
export const PLACEMENT_TIERS: PlacementTier[] = [
	{ id: "a1a", level: "A1", title: "First steps", units: ["words", "present", "acc-fem", "loc"], chapters: ["hello", "cafe", "town"] },
	{ id: "a1b", level: "A1", title: "Everyday A1", units: ["acc-people", "gen", "ins", "past"], chapters: ["family", "everyday", "yesterday"] },
	{ id: "a2", level: "A2", title: "Getting around", units: ["present-ujem", "plural", "cond", "motion"], chapters: ["health", "shopping", "plans", "moving", "people", "work"] },
	{ id: "b1", level: "B1", title: "Independence", units: ["adj-cases", "numbers", "cases-mix", "verbs-mix"], chapters: ["stories", "opinions", "offices", "world"] },
];

export const REPS_PER_UNIT = 2;
export const PASS_SHARE = 0.75;

export function placementTier(id: string): PlacementTier | undefined {
	return PLACEMENT_TIERS.find((t) => t.id === id);
}

/** The tier to start a re-check from: the one whose chapters hold the
 *  learner's current chapter (or the first). */
export function tierForChapter(chapter: string | undefined): number {
	const i = PLACEMENT_TIERS.findIndex((t) => t.chapters.includes(chapter ?? ""));
	if (i >= 0) return i;
	// A chapter past the last tier's (B2: the check stops at B1 grammar)
	// re-checks from the last tier, not from the first.
	const idx = CHAPTERS.findIndex((c) => c.id === chapter);
	const last = CHAPTERS.findIndex((c) => c.id === PLACEMENT_TIERS[PLACEMENT_TIERS.length - 1]!.chapters.at(-1));
	return idx > last ? PLACEMENT_TIERS.length - 1 : 0;
}

export interface PlacementRep {
	tier: string;
	unit: UnitId;
	verdict: "exact" | "accents" | "wrong";
	/** "probe": the Socratic stage's verdict on the unit, folded into reps
	 *  (held = both right, slip = one, gap = none). Absent = the drill. */
	source?: "drill" | "probe";
	/** A typed miss the model accepted as a valid alternative (counts as right). */
	judged?: boolean;
}

export interface TierResult {
	id: string;
	level: Cefr;
	title: string;
	reps: number;
	correct: number;
	passed: boolean;
	/** A re-check started above this tier: it was not asked again and
	 *  stands as passed (the learner already works past it). */
	held?: boolean;
}

export interface PlacementOutcome {
	/** The level the learner works at now: the stage of the first chapter
	 *  after the tiers passed (A1 when none was). */
	level: Cefr;
	tiers: TierResult[];
	/** The tier the check started at (0 for a first placement). */
	from: number;
	/** Every tier passed: the check ran out, nothing above B1 grammar was
	 *  measured, so the level is a floor, not a reading. */
	ceiling: boolean;
	/** The first chapter to work in. */
	startChapter: string;
	/** Per probed unit: its reps and hits; `placed` marks it as evidence
	 *  from placement (both right = tested out). */
	units: Record<string, UnitEvidence & { placed: true }>;
	testedOut: UnitId[];
	weak: UnitId[];
}

/** Does a verdict count as right? Accent slips do, as in lessons. */
export const isHit = (v: PlacementRep["verdict"]) => v !== "wrong";

/** The hits a tier needs from `reps` answers. */
export function tierNeed(reps: number): number {
	return Math.ceil(reps * PASS_SHARE);
}

/**
 * Fold answered reps into the outcome. Pure. Tiers below `from` (a re-check start) were not asked and count as held.
 */
export function placementOutcome(reps: readonly PlacementRep[], opts: { from?: number } = {}): PlacementOutcome {
	const from = Math.max(0, Math.min(PLACEMENT_TIERS.length - 1, opts.from ?? 0));
	const tiers: TierResult[] = [];
	const units: PlacementOutcome["units"] = {};
	for (const [i, t] of PLACEMENT_TIERS.entries()) {
		if (i < from) {
			tiers.push({ id: t.id, level: t.level, title: t.title, reps: 0, correct: 0, passed: true, held: true });
			continue;
		}
		const mine = reps.filter((r) => r.tier === t.id);
		if (mine.length === 0) break;
		const correct = mine.filter((r) => isHit(r.verdict)).length;
		tiers.push({ id: t.id, level: t.level, title: t.title, reps: mine.length, correct, passed: mine.length >= t.units.length && correct / mine.length >= PASS_SHARE });
		for (const u of t.units) {
			const ours = mine.filter((r) => r.unit === u);
			if (ours.length === 0) continue;
			units[u] = { lessons: 0, reps: ours.length, correct: ours.filter((r) => isHit(r.verdict)).length, placed: true };
		}
	}
	let lastPassed = -1;
	for (let i = 0; i < tiers.length; i++) {
		if (tiers[i]!.passed) lastPassed = i;
		else break;
	}
	const startChapter = lastPassed >= 0 ? (CHAPTERS[CHAPTERS.findIndex((c) => c.id === PLACEMENT_TIERS[lastPassed]!.chapters.at(-1)) + 1]?.id ?? CHAPTERS.at(-1)!.id) : CHAPTERS[0]!.id;
	const level: Cefr = STAGES.find((st) => st.id === CHAPTERS.find((c) => c.id === startChapter)!.stage)!.level;
	const testedOut = Object.entries(units)
		.filter(([, e]) => e.reps >= REPS_PER_UNIT && e.correct === e.reps)
		.map(([id]) => id as UnitId);
	const weak = Object.entries(units)
		.filter(([, e]) => e.correct < e.reps)
		.map(([id]) => id as UnitId);
	return { level, tiers, from, ceiling: lastPassed === PLACEMENT_TIERS.length - 1, startChapter, units, testedOut, weak };
}

/** Should the staircase climb after this tier's reps? */
export function tierPassed(tier: PlacementTier, reps: readonly PlacementRep[]): boolean {
	const mine = reps.filter((r) => r.tier === tier.id);
	return mine.length >= tier.units.length && mine.filter((r) => isHit(r.verdict)).length / mine.length >= PASS_SHARE;
}

/** One more typed rep per unit when a tier lands on the line. */
export const EXTRA_REPS_PER_UNIT = 1;

/** Is the tier a close call after its base reps (one hit either side of the pass line)? If so, a third rep per unit is asked. */
export function tierBorderline(tier: PlacementTier, reps: readonly PlacementRep[]): boolean {
	const mine = reps.filter((r) => r.tier === tier.id);
	const base = tier.units.length * REPS_PER_UNIT;
	if (mine.length !== base) return false;
	const hits = mine.filter((r) => isHit(r.verdict)).length;
	const need = tierNeed(base);
	return hits === need || hits === need - 1;
}

/** The tier a unit belongs to (undefined for a unit no tier probes). */
export function tierOfUnit(unit: UnitId): PlacementTier | undefined {
	return PLACEMENT_TIERS.find((t) => t.units.includes(unit));
}

// ─── The edge: the Socratic stage ───────────────────────────────────────────

/** How the tutor read the learner's answers on one unit: held (produces
 *  the form and knows what decided it), slip (right form, shaky reason, or
 *  one miss in a row of hits), gap (cannot produce it). */
export type ProbeResult = "held" | "slip" | "gap";

export interface ProbeVerdict {
	unit: UnitId;
	result: ProbeResult;
	/** The evidence in one line: what was produced or missed. */
	note: string;
}

export interface ProbeAsk {
	unit: UnitId;
	/** The task in the explanation language ("Put the word in the right form.") */
	prompt: string;
	/** The Slovak frame: a sentence with ___ (and the word in brackets), or
	 *  a sentence to transform. */
	sk: string;
	/** produce: a form; why: say what decided a form the learner just gave. */
	kind: "produce" | "why";
}

export interface ProbeReply {
	/** One or two sentences to the learner: what the last answer showed. */
	say: string;
	verdict?: ProbeVerdict;
	ask?: ProbeAsk;
	/** The stage is over: two sentences on the edge found. */
	done?: string;
}

export interface ProbeTurn {
	reply: ProbeReply;
	/** The learner's answer to `reply.ask` (absent while open or when skipped). */
	answer?: string;
	at: string;
}

/** The most questions the stage asks: one or two per unit at the edge. */
export const PROBE_TURNS = 6;

/** The units the stage may probe, in order of value: the drill's misses
 *  first (slip or gap?), then the units of the first tier the drill never
 *  reached (a strong learner can be moved up on evidence). At most eight. */
export function probeUnits(outcome: PlacementOutcome): UnitId[] {
	const out: UnitId[] = [...outcome.weak];
	const stopped = outcome.tiers.findIndex((t) => !t.passed);
	const next = stopped < 0 ? PLACEMENT_TIERS[outcome.tiers.length] : undefined;
	const after = stopped >= 0 ? undefined : next;
	for (const u of after?.units ?? []) if (!out.includes(u)) out.push(u);
	// A failed tier's untested-out units too: the drill asked two reps each.
	if (stopped >= 0) for (const u of PLACEMENT_TIERS[stopped]!.units) if (!out.includes(u) && !outcome.testedOut.includes(u)) out.push(u);
	return out.slice(0, 8);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Read the tutor's JSON turn; anything malformed becomes a plain `say`.
 *  A verdict or an ask on a unit outside `units` is dropped. */
export function parseProbeReply(text: string, units: readonly UnitId[]): ProbeReply {
	let o: Record<string, unknown> | null = null;
	const m = text.match(/\{[\s\S]*\}/);
	if (m) {
		try {
			o = JSON.parse(m[0]) as Record<string, unknown>;
		} catch {
			o = null;
		}
	}
	if (!o) return { say: text.trim().replace(/^```[a-z]*\s*|\s*```$/g, "").slice(0, 600), done: "" };
	const reply: ProbeReply = { say: str(o.say, 600) };
	const v = o.verdict as Record<string, unknown> | null | undefined;
	if (v && typeof v === "object" && units.includes(str(v.unit, 40) as UnitId) && ["held", "slip", "gap"].includes(str(v.result, 10))) {
		reply.verdict = { unit: str(v.unit, 40) as UnitId, result: str(v.result, 10) as ProbeResult, note: str(v.note, 300) };
	}
	const a = o.ask as Record<string, unknown> | null | undefined;
	if (a && typeof a === "object" && units.includes(str(a.unit, 40) as UnitId) && str(a.sk, 400)) {
		reply.ask = { unit: str(a.unit, 40) as UnitId, prompt: str(a.prompt, 300), sk: str(a.sk, 400), kind: str(a.kind, 10) === "why" ? "why" : "produce" };
	}
	if (typeof o.done === "string" || o.done === true) reply.done = str(o.done, 600) || reply.say;
	if (!reply.ask && reply.done === undefined) reply.done = reply.say;
	return reply;
}

/** A verdict as placement reps: held = both right, slip = one of two,
 *  gap = none. Two reps, like the drill's, so a tier's pass rule holds. */
export function probeReps(verdicts: readonly ProbeVerdict[]): PlacementRep[] {
	const out: PlacementRep[] = [];
	for (const v of verdicts) {
		const tier = tierOfUnit(v.unit);
		if (!tier) continue;
		const hits = v.result === "held" ? 2 : v.result === "slip" ? 1 : 0;
		for (let i = 0; i < REPS_PER_UNIT; i++) out.push({ tier: tier.id, unit: v.unit, verdict: i < hits ? "exact" : "wrong", source: "probe" });
	}
	return out;
}

/** The drill's reps with the stage's verdicts folded in: a unit the tutor
 *  judged is scored by that judgement (the last one wins), not by its two
 *  drill reps. A tier the drill never reached scores from the stage alone. */
export function withProbe(drill: readonly PlacementRep[], verdicts: readonly ProbeVerdict[]): PlacementRep[] {
	const last = new Map<UnitId, ProbeVerdict>();
	for (const v of verdicts) last.set(v.unit, v);
	const kept = drill.filter((r) => !last.has(r.unit));
	return [...kept, ...probeReps([...last.values()])];
}

// ─── The profile the tutor reads ────────────────────────────────────────────

const PRIOR_LINE: Record<Prior, string> = {
	none: "started from nothing",
	words: "started with a few words",
	sentences: "started with simple sentences",
	reading: "started able to read some Slovak, with shaky endings",
};

/** One unit's line in the tutor's "Measured weak points": its unaided first
 *  tries when it has six (with the slips behind the wrong ones), else its
 *  lesson answers, labeled as such. Null when neither has six reps. */
export interface MeasuredWeak {
	accuracy: number;
	text: string;
}

export function measuredWeak(u: { title: string; reps: number; accuracy: number | null }, tally: FirstTally | undefined): MeasuredWeak | null {
	if (tally && tally.reps >= 6) {
		const accuracy = tally.right / tally.reps;
		const slips = slipLine(tally.slips);
		return { accuracy, text: `${u.title} ${Math.round(accuracy * 100)}% on first tries (${tally.right} of ${tally.reps} right${slips ? `; wrong: ${slips}` : ""})` };
	}
	if (u.reps >= 6 && u.accuracy !== null) return { accuracy: u.accuracy, text: `${u.title} ${Math.round(u.accuracy * 100)}% on lesson answers` };
	return null;
}

/** The learner as a short profile block for the tutor's system prompt. Null when nothing is known yet. `tries_` is each unit's first tries (src/core/first-try.ts); `mixups_` the pairs of words they confuse (src/core/mixups.ts). */
export function learnerProfileText(goal: LearnerGoal | undefined, state: CurriculumState | null, evidence: Record<string, UnitEvidence | undefined>, weak_?: WeakRecord, pace_?: { dailyAverage: number; days: number }, tries_?: Record<string, FirstTally | undefined>, mixups_?: MixupRecord, zones_?: Record<string, UnitZone>): string | null {
	if (!goal?.onboardedAt && !state) return null;
	const lines: string[] = [];
	const purposes = goal?.purposes ?? [];
	const note = goal?.purposeNote?.trim();
	if (purposes.length || note) {
		const named = purposes.filter((p) => p !== "other").map(purposePhrase);
		const goals = [...purposeGoals(purposes)].map((g) => `"${curriculumUnit(g)?.title ?? g}"`).slice(0, 5);
		lines.push(`- Slovak is for: ${[...named, ...(note ? [`in the learner's own words, "${note}"`] : purposes.includes("other") ? ["something the cards did not cover"] : [])].join("; ")}.${goals.length ? ` The goal is concrete: the map's can-do goals ${goals.join(", ")}.` : ""}${note ? " Shape examples and scenes around those words." : ""}`);
	}
	if (goal) lines.push(`- Target: ${goal.level} (about ${GUIDED_HOURS[goal.level]} guided hours), at ${goal.minutesPerDay} minutes a day, ${goal.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK} days a week.${pace_ ? ` Over the last ${pace_.days} days they actually averaged ${pace_.dailyAverage} minutes a day.` : ""}`);
	if (goal) {
		const known = knownLanguages(goal);
		const other = (goal.otherLanguages ?? []).filter(Boolean);
		const levelOf = (l: Lang) => {
			const lv = languageLevel(goal, l);
			return lv === "native" ? "native" : `${lv} on the CEFR`;
		};
		const names = [...known.map((l) => `${languageName(l)} (${levelOf(l)})`), ...other];
		const notes = known.filter((l) => l !== "en").map((l) => `${languageName(l)}: ${languageInfo(l).line.replace(/; the lessons show every form the \w+ way$/, "")}`);
		const [first, second] = explanationLanguages(goal);
		lines.push(
			`- Knows: ${names.join(", ")}.${notes.length ? ` ${notes.join(". ")}.` : ""}${parallelsOn(goal) ? ` When a form has a parallel in one of these, show it that way too, not only in English.${known.includes("et") ? "" : " Do not lean on Estonian bridges."}` : " The learner turned parallels off: do not compare Slovak to these languages unless asked; use them only to understand what the learner means."}`,
		);
		const lead = first === "en" ? "- Explanations in English." : `- Explain in ${languageName(first!)} (the learner's choice): prose and rules in ${languageName(first!)}, Slovak examples in Slovak, English only when asked.`;
		const simple = (l: Lang) => (isLowLevel(languageLevel(goal, l)) ? ` The learner knows ${languageName(l)} only at ${languageLevel(goal, l)}: keep those lines short and simple, and gloss a hard word.` : "");
		lines.push((second ? `${lead} Also ${languageName(second)}, which the learner is still learning and wants to see more of: after each rule, add its key line and the grammar terms in ${languageName(second)} (one short line, in parentheses or on its own line), not a second copy of everything.${simple(second)}` : lead) + (first !== "en" ? simple(first!) : ""));
	}
	if (goal?.prior) lines.push(`- Before the app: ${PRIOR_LINE[goal.prior]}.`);
	if (goal?.placedAt && goal.placedLevel) {
		const placed = Object.entries(evidence).filter(([, e]) => e?.placed);
		const out = placed.filter(([, e]) => e!.reps > 0 && e!.correct === e!.reps).map(([id]) => unitInfo(id as UnitId).title);
		const missed = placed.filter(([, e]) => e!.correct < e!.reps).map(([id, e]) => `${unitInfo(id as UnitId).title} (${e!.correct}/${e!.reps})`);
		lines.push(`- Placement check on ${goal.placedAt.slice(0, 10)}: works at ${goal.placedLevel}${out.length ? `; tested out of ${out.join(", ")}` : ""}${missed.length ? `; missed ${missed.join(", ")}` : ""}.${goal.placedNote ? ` The tutor's reading of the edge: ${goal.placedNote}` : ""}`);
	}
	if (goal?.vocabulary) lines.push(`- Vocabulary check on ${goal.vocabulary.at.slice(0, 10)}: about ${goal.vocabulary.size.toLocaleString("en-GB")} lemmas recognized${goal.vocabulary.reliable ? "" : " (over-claimed on the pseudowords: treat as generous)"}.`);
	if (state) {
		const cur = state.chapters.find((c) => c.id === state.current);
		const stage = STAGES.find((s) => s.id === cur?.stage);
		if (cur && stage) lines.push(`- Working now at ${stage.level}, chapter "${cur.title}" (${cur.doneCount}/${cur.total} units done; ${state.done}/${state.total} on the road to the target).`);
		const weak = state.chapters
			.flatMap((c) => c.units)
			.filter((u) => u.kind === "drill" || u.kind === "words")
			.map((u) => measuredWeak(u, tries_?.[u.id]))
			.filter((m): m is MeasuredWeak => m !== null && m.accuracy < 0.85)
			.sort((a, b) => a.accuracy - b.accuracy)
			.slice(0, 5);
		if (weak.length) lines.push(`- Measured weak points: ${weak.map((m) => m.text).join(", ")}.`);
		const spots = weakSpotsLine(weakSpotList(weak_));
		if (spots) lines.push(spots);
		const zoned = zones_ ? flowTutorLine(zones_, (id) => (isUnitId(id) ? unitInfo(id).title : id)) : null;
		if (zoned) lines.push(zoned);
		const mixed = mixupsLine(mixupList(mixups_));
		if (mixed) lines.push(mixed);
		const done = state.chapters.flatMap((c) => c.units).filter((u) => u.status === "done" && (u.kind === "drill" || u.kind === "words"));
		if (done.length) lines.push(`- Holds (units done on the map): ${done.slice(0, 12).map((u) => u.title).join(", ")}${done.length > 12 ? `, and ${done.length - 12} more` : ""}.`);
	}
	if (lines.length === 0) return null;
	return ["# This learner (from the app's profile and the lesson ledger)", ...lines, "Treat the goal as concrete and the level as measured: do not ask for either. Build from the units held, work on the weak points, and keep the purposes in the examples you choose."].join("\n");
}

// ─── The verdict on a missed item ───────────────────────────────────────────

/** What the miss footer says: the form, the judge's reason as clean
 *  sentences, and the unit's rule so the verdict teaches the pattern once
 *  instead of only naming the case. */
export interface MissVerdict {
	/** "The form here is kuchára" (the form is bolded by the UI). */
	form: string;
	/** The judge's note, normalized: no quotes around the Slovak words, no
	 *  semicolons, one full stop per sentence, none doubled. */
	reason: string | null;
	/** The unit's rule in one line, when it adds to the reason. */
	pattern: string | null;
}

/** Normalize a model's one-line note into prose: 'ponuku' → ponuku, a
 *  semicolon starts a new sentence, trailing punctuation is trimmed, the
 *  first letter is capitalised and exactly one full stop closes it. */
export function cleanNote(note: string | undefined | null): string | null {
	if (!note) return null;
	let t = note
		.normalize("NFC")
		.trim()
		.replace(/^["“”„]+|["“”„]+$/gu, "")
		.replace(/(^|[\s(])['‘’`]([^'‘’`]{1,40})['‘’`](?=[\s).,;:!?]|$)/gu, "$1$2")
		.replace(/\s*;\s*/gu, ". ")
		.replace(/\s+/gu, " ")
		.replace(/[\s.,;:]+$/u, "")
		.trim();
	if (!t) return null;
	t = t.replace(/\.\s+([a-záäčďéíĺľňóôŕšťúýž])/gu, (_m, c: string) => `. ${c.toLocaleUpperCase("sk-SK")}`);
	t = t.charAt(0).toLocaleUpperCase("sk-SK") + t.slice(1);
	return `${t}.`;
}

export function missVerdict(item: Pick<LessonItem, "answer" | "unit" | "trigger">, note?: string | null): MissVerdict {
	const reason = cleanNote(note);
	const info = unitInfo(item.unit);
	// A word unit's rule is advice, not a pattern: left out.
	const pattern = info && info.kind !== "words" ? info.rule : null;
	return { form: item.answer, reason, pattern };
}

// ─── Calm items for the check ───────────────────────────────────────────────

/** Grim vocabulary (crime, violence, death) kept out of the check's items. Matches Slovak and English. */
const GRIM = /\b(murder|kill|corpse|blood|weapon|gun|knife|war|rape|suicide|terror|bomb|hostage|victim|prison|jail|crime|criminal|thie(?:f|ves)|st(?:eal|ole|olen)|die[ds]?|dying|dead|death|police|shoot|shot|stab|attack|drugs?)\b|\b(vrah|vražd|zabi|zabíj|mŕtv|krv|zbra[ňn]|nož|vojn|znásil|samovra|teror|bomb|rukojem|obe[ťt]|väzen|väzn|zloči|trestn|zlode|ukrad|krádež|zomr|zomier|smrť|smrti|políc|strie[ľl]|zastrel|bodn|útok|útoč|drog)/iu;

export function isGrim(text: string): boolean {
	return GRIM.test(text.normalize("NFC"));
}

/** The lexicon without grim examples; entries left with no examples are dropped. */
export function calmEntries<E extends { lemma?: string; sk?: string; en: string; examples: Array<{ text?: string; sk?: string; en: string }> }>(entries: readonly E[]): E[] {
	const out: E[] = [];
	for (const e of entries) {
		if (isGrim(entryLemma(e)) || isGrim(e.en)) continue;
		const examples = e.examples.filter((x) => !isGrim(exampleText(x)) && !isGrim(x.en));
		if (!examples.length) continue;
		out.push(examples.length === e.examples.length ? e : { ...e, examples });
	}
	return out;
}
