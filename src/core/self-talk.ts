/**
 * Guided Self-Talk (LangHarness, 2026-11-12) — solo speaking practice
 * inspired by Dr. Lýdia Machová's Language Mentoring methodology.
 *
 * Why (docs/research/comprehensible-input.md & Machová 2018):
 *   - Low-anxiety output: Speaking to a human or tutor triggers social
 *     anxiety and fear of making mistakes (affective filter, Krashen 1982).
 *     Self-talk provides deliberate output practice (Swain 1985) in a zero-judgment
 *     environment where the learner can speak freely out loud.
 *   - The 4 Stages: Describing immediate surroundings (A1), narrating daily
 *     actions in real time (A1-A2), describing pictures (A2-B1), and rehearsing
 *     imaginary monologues/opinions (B1-B2).
 *   - Useful chunks (scaffolding): Providing sentence starters prevents cognitive
 *     freezes without turning the exercise into rote reading.
 *
 * Pure and browser-safe. Time spent active counts toward the Speaking strand (P9 & P2).
 */

import type { Cefr } from "./curriculum.ts";
import { foldDiacritics } from "./language.ts";

export type SelfTalkCategory = "surroundings" | "routine" | "picture" | "opinion" | "story";

export interface UsefulChunk {
	sk: string;
	en: string;
}

export interface SelfTalkPrompt {
	id: string;
	category: SelfTalkCategory;
	level: Cefr;
	title: string;
	titleEn: string;
	prompt: string;
	promptEn: string;
	/** Suggested target duration in seconds (e.g. 60s for beginners, 90s for intermediate). */
	targetSec: number;
	/** Sentence starters to prevent freezing and maintain fluency. */
	starters: UsefulChunk[];
	/** High-frequency words relevant to the prompt. */
	suggestedWords: UsefulChunk[];
}

export const SELF_TALK_CATEGORIES: Array<{ id: SelfTalkCategory; label: string; description: string }> = [
	{ id: "surroundings", label: "Surroundings", description: "Name objects, colors, and positions around you (A1)" },
	{
		id: "routine",
		label: "Daily routine",
		description: "Narrate what you are doing right now or your daily rituals (A1-A2)",
	},
	{
		id: "picture",
		label: "Scenes and pictures",
		description: "Describe what people are doing and wearing in a scene (A2-B1)",
	},
	{
		id: "story",
		label: "Yesterday and tomorrow",
		description: "Tell what happened earlier or what you plan to do (A2-B1)",
	},
	{
		id: "opinion",
		label: "Thoughts and opinions",
		description: "Explain why you like something or share a perspective (B1-B2)",
	},
];

export const SELF_TALK_PROMPTS: SelfTalkPrompt[] = [
	{
		id: "around-room",
		category: "surroundings",
		level: "A1",
		title: "Čo vidím okolo seba",
		titleEn: "What I see around me",
		prompt: "Pozri sa okolo seba v izbe. Pomenuj 5 vecí, ich farby a kde sa nachádzajú.",
		promptEn: "Look around your room. Name 5 things, their colors, and where they are located.",
		targetSec: 60,
		starters: [
			{ sk: "Okolo seba vidím…", en: "Around me I see…" },
			{ sk: "Na stole je…", en: "On the table is…" },
			{ sk: "Vedľa okna sa nachádza…", en: "Next to the window is located…" },
			{ sk: "Táto vec má farbu…", en: "This thing has the color…" },
		],
		suggestedWords: [
			{ sk: "stôl", en: "table" },
			{ sk: "stolička", en: "chair" },
			{ sk: "okno", en: "window" },
			{ sk: "dvere", en: "door" },
			{ sk: "počítač", en: "computer" },
			{ sk: "kniha", en: "book" },
			{ sk: "veľký", en: "big" },
			{ sk: "malý", en: "small" },
		],
	},
	{
		id: "morning-ritual",
		category: "routine",
		level: "A1",
		title: "Môj ranný rituál",
		titleEn: "My morning ritual",
		prompt: "Povedz nahlas, čo robíš každé ráno po prebudení.",
		promptEn: "Say out loud what you do every morning after waking up.",
		targetSec: 60,
		starters: [
			{ sk: "Ráno zvyčajne vstávam o…", en: "In the morning I usually wake up at…" },
			{ sk: "Najprv idem do…", en: "First I go to…" },
			{ sk: "Potom si varím…", en: "Then I brew/cook…" },
			{ sk: "Na raňajky jem…", en: "For breakfast I eat…" },
		],
		suggestedWords: [
			{ sk: "vstávať", en: "to wake up / get up" },
			{ sk: "kúpeľňa", en: "bathroom" },
			{ sk: "káva", en: "coffee" },
			{ sk: "čaj", en: "tea" },
			{ sk: "zuby", en: "teeth" },
			{ sk: "raňajky", en: "breakfast" },
			{ sk: "voda", en: "water" },
		],
	},
	{
		id: "now-doing",
		category: "routine",
		level: "A1",
		title: "Čo teraz robím",
		titleEn: "What I am doing right now",
		prompt: "Komentuj svoje aktuálne činnosti ako športový komentátor.",
		promptEn: "Commentate on your current actions out loud like a sports commentator.",
		targetSec: 60,
		starters: [
			{ sk: "Práve teraz sedím…", en: "Right now I am sitting…" },
			{ sk: "V ruke držím…", en: "In my hand I am holding…" },
			{ sk: "Pozerám sa na…", en: "I am looking at…" },
			{ sk: "Cítim sa…", en: "I feel…" },
		],
		suggestedWords: [
			{ sk: "sedieť", en: "to sit" },
			{ sk: "hovoriť", en: "to speak" },
			{ sk: "počítač", en: "computer" },
			{ sk: "obrazovka", en: "screen" },
			{ sk: "ruka", en: "hand" },
			{ sk: "hlas", en: "voice" },
		],
	},
	{
		id: "cafe-scene",
		category: "picture",
		level: "A2",
		title: "Opis kaviarne",
		titleEn: "Describing a café",
		prompt: "Predstav si rušnú kaviareň. Opíš ľudí, čo robia, čo pijú a aká je tam atmosféra.",
		promptEn: "Imagine a busy café. Describe the people, what they are doing, drinking, and the atmosphere.",
		targetSec: 75,
		starters: [
			{ sk: "V kaviarni vidím veľa…", en: "In the café I see many…" },
			{ sk: "Čašník práve prináša…", en: "The waiter is just bringing…" },
			{ sk: "Pri stole pri okne sedí…", en: "At the table by the window sits…" },
			{ sk: "Atmosféra je veľmi…", en: "The atmosphere is very…" },
		],
		suggestedWords: [
			{ sk: "čašník", en: "waiter" },
			{ sk: "zákazník", en: "customer" },
			{ sk: "koláč", en: "cake" },
			{ sk: "káva", en: "coffee" },
			{ sk: "rozprávať sa", en: "to converse" },
			{ sk: "príjemný", en: "pleasant" },
			{ sk: "hudba", en: "music" },
		],
	},
	{
		id: "yesterday-recap",
		category: "story",
		level: "A2",
		title: "Čo som včera robil",
		titleEn: "What I did yesterday",
		prompt: "Povedz krátky príbeh o tom, ako vyzeral tvoj včerajší deň. Použi minulý čas.",
		promptEn: "Tell a short story about how your yesterday looked. Use past tense verbs.",
		targetSec: 75,
		starters: [
			{ sk: "Včera som sa zobudil…", en: "Yesterday I woke up…" },
			{ sk: "Dopoludnia som pracoval na…", en: "In the morning I worked on…" },
			{ sk: "Popoludní som išiel…", en: "In the afternoon I went…" },
			{ sk: "Večer som bol unavený, pretože…", en: "In the evening I was tired because…" },
		],
		suggestedWords: [
			{ sk: "včera", en: "yesterday" },
			{ sk: "práca", en: "work" },
			{ sk: "obed", en: "lunch" },
			{ sk: "stretol som", en: "I met" },
			{ sk: "večer", en: "evening" },
			{ sk: "film", en: "movie" },
			{ sk: "kniha", en: "book" },
		],
	},
	{
		id: "favorite-season",
		category: "opinion",
		level: "B1",
		title: "Moje obľúbené ročné obdobie",
		titleEn: "My favorite season",
		prompt: "Aké je tvoje obľúbené ročné obdobie a prečo? Porovnaj ho s iným obdobím.",
		promptEn: "What is your favorite season and why? Compare it to another season.",
		targetSec: 90,
		starters: [
			{ sk: "Mojím najobľúbenejším obdobím je…", en: "My most favorite season is…" },
			{ sk: "Mám ho rád hlavne preto, lebo…", en: "I like it mainly because…" },
			{ sk: "Na rozdiel od zimy / leta…", en: "Unlike winter / summer…" },
			{ sk: "V tomto období najradšej robím…", en: "During this season I most like to do…" },
		],
		suggestedWords: [
			{ sk: "jar", en: "spring" },
			{ sk: "leto", en: "summer" },
			{ sk: "jeseň", en: "autumn" },
			{ sk: "zima", en: "winter" },
			{ sk: "počasie", en: "weather" },
			{ sk: "teplo", en: "warm" },
			{ sk: "príroda", en: "nature" },
			{ sk: "slnko", en: "sun" },
		],
	},
	{
		id: "why-slovak",
		category: "opinion",
		level: "B1",
		title: "Prečo sa učím po slovensky",
		titleEn: "Why I am learning Slovak",
		prompt: "Vysvetli fiktívnemu kamarátovi, prečo sa učíš po slovensky a čo ťa na tom baví.",
		promptEn: "Explain to a fictitious friend why you are learning Slovak and what you enjoy about it.",
		targetSec: 90,
		starters: [
			{ sk: "Rozhodol som sa učiť po slovensky, pretože…", en: "I decided to learn Slovak because…" },
			{ sk: "Slovenčina je pre mňa zaujímavá, lebo…", en: "Slovak is interesting to me because…" },
			{ sk: "Najťažšia vec pre mňa je…, ale…", en: "The hardest thing for me is…, but…" },
			{ sk: "V budúcnosti by som chcel…", en: "In the future I would like to…" },
		],
		suggestedWords: [
			{ sk: "jazyk", en: "language" },
			{ sk: "Slovensko", en: "Slovakia" },
			{ sk: "rozprávať", en: "to speak" },
			{ sk: "ľudia", en: "people" },
			{ sk: "kultúra", en: "culture" },
			{ sk: "cesta", en: "journey / trip" },
			{ sk: "cieľ", en: "goal" },
		],
	},
];

/** Base XP for completing a self-talk session. */
export const SELF_TALK_BASE_XP = 15;
/** Bonus XP for meeting or exceeding the target speaking duration. */
export const SELF_TALK_BONUS_XP = 10;

/** Filter prompts by CEFR level and/or category. */
export function getSelfTalkPrompts(options?: { level?: Cefr; category?: SelfTalkCategory }): SelfTalkPrompt[] {
	return SELF_TALK_PROMPTS.filter((p) => {
		if (options?.level && p.level !== options.level) return false;
		if (options?.category && p.category !== options.category) return false;
		return true;
	});
}

/** Retrieve a specific prompt by its unique ID. */
export function getSelfTalkPromptById(id: string): SelfTalkPrompt | undefined {
	return SELF_TALK_PROMPTS.find((p) => p.id === id);
}

/** Select a random prompt, optionally scoped to a CEFR level. */
export function getRandomSelfTalkPrompt(level?: Cefr, seed?: number): SelfTalkPrompt {
	const pool = level ? getSelfTalkPrompts({ level }) : SELF_TALK_PROMPTS;
	const candidates = pool.length > 0 ? pool : SELF_TALK_PROMPTS;
	const index =
		typeof seed === "number" ? Math.abs(seed) % candidates.length : Math.floor(Math.random() * candidates.length);
	return (candidates[index] ?? SELF_TALK_PROMPTS[0]) as SelfTalkPrompt;
}

/** Calculate XP earned based on active speaking seconds vs prompt target. */
export function calculateSelfTalkXp(activeSec: number, targetSec: number): { xp: number; metTarget: boolean } {
	if (activeSec < 10) return { xp: 0, metTarget: false };
	const metTarget = activeSec >= targetSec;
	const xp = metTarget
		? SELF_TALK_BASE_XP + SELF_TALK_BONUS_XP
		: Math.max(5, Math.round(SELF_TALK_BASE_XP * (activeSec / targetSec)));
	return { xp, metTarget };
}

/** Check which of the prompt's suggested vocabulary words were uttered in the transcript. */
export function findUsedSuggestedWords(transcript: string, suggested: UsefulChunk[]): UsefulChunk[] {
	if (!transcript.trim()) return [];
	const foldedText = foldDiacritics(transcript.toLowerCase());
	return suggested.filter((item) => {
		const rawWord = item.sk.toLowerCase();
		const foldedWord = foldDiacritics(rawWord);
		// Check exact folded word
		if (foldedText.includes(foldedWord)) return true;
		// Check stem (strip last vowel or inflectional suffix for words of length >= 4)
		if (foldedWord.length >= 4) {
			const stem = foldedWord.slice(0, -1);
			if (foldedText.includes(stem)) return true;
		}
		return false;
	});
}
