/**
 * Language islands: one topic prepared well enough to talk about, as Benny
 * Lewis describes it from Shekhtman's "How to Improve Your Foreign Language
 * Immediately". The numbers below are starting values, not research results.
 * Pure and browser-safe: the list, the ladder and the bars are read by the
 * screen and the server alike.
 */

import type { Cefr } from "./curriculum.ts";
import { foldDiacritics } from "./language.ts";
import { purposeInfo, type Purpose } from "./onboarding.ts";
import type { UsefulChunk } from "./self-talk.ts";

export type IslandStep = "started" | "built" | "rehearsed" | "holding" | "fluent";

export const ISLAND_STEPS: readonly Exclude<IslandStep, "started">[] = ["built", "rehearsed", "holding", "fluent"];

export const ISLAND_STEP_LABELS: Record<IslandStep, string> = {
	started: "Started",
	built: "Built",
	rehearsed: "Rehearsed",
	holding: "Holding",
	fluent: "Fluent",
};

export interface VaultChunk {
	id: string;
	sk: string;
	en: string;
	kind: "phrase" | "word";
	/** The dictionary slug of a single word the lexicon confirmed. */
	slug?: string;
	addedAt: string;
	/** A phrase the learner marked as got; a word is reviewed in the deck. */
	reviewedAt?: string;
	/** The last time the learner said it out loud in a rehearsal. */
	saidAt?: string;
}

export interface VaultRehearsal {
	at: string;
	sec: number;
	/** The vault chunk ids heard in the transcript (empty without a transcript). */
	used: string[];
	longestPauseMs: number;
}

export interface IslandTalk {
	at: string;
	sec: number;
	learnerShare: number;
	medianReplyMs: number;
	englishShare: number;
	bridgeUsed: boolean;
}

export interface Island {
	id: string;
	topic: string;
	topicId?: string;
	level: Cefr;
	chunks: VaultChunk[];
	rehearsals: VaultRehearsal[];
	talks: IslandTalk[];
	createdAt: string;
}

const DAY_MS = 86_400_000;

export const VAULT_MIN_CHUNKS = 20;
export const REHEARSE_TARGET_SEC = 90;
export const REHEARSE_MIN_CHUNKS_USED = 8;
export const REHEARSE_MAX_PAUSE_MS = 3_000;
export const HOLDING_TALK_SEC = 180;
export const FLUENT_TALK_SEC = 300;
/** A learner who talks less than this share of a talk is being carried. */
export const HOLDING_MIN_SHARE = 0.4;
export const HOLDING_MAX_REPLY_MS = 2_500;
export const ENGLISH_MAX_SHARE = 0.05;
/** Fluent has to be passed on this many different days. */
export const FLUENT_TALK_DAYS = 2;
export const FLUENT_FADE_DAYS = 30;
export const FADE_WARNING_DAYS = 7;
export const BRIDGE_MIN_SHARED = 3;
export const REHEARSAL_BASE_XP = 15;
export const REHEARSAL_BONUS_XP = 10;
export const LONGEST_REHEARSAL_MS = 300_000;

export interface IslandTopic {
	id: string;
	title: string;
	prompt: string;
	line: string;
}

export const COMMON_TOPICS: readonly IslandTopic[] = [
	{
		id: "yourself",
		title: "About yourself",
		prompt: "Tell me who you are: your name, where you come from and what you do.",
		line: "Your name, your home, your work and a little of your story.",
	},
	{
		id: "family",
		title: "Family",
		prompt: "Tell me about your family: who they are and what they are like.",
		line: "Parents, siblings, a partner, children.",
	},
	{
		id: "work",
		title: "Work or studies",
		prompt: "Tell me what you do all day, and whether you like it.",
		line: "Your job or your course, the people there, the good and the bad.",
	},
	{
		id: "home",
		title: "Home",
		prompt: "Describe the place you live in and the room you are in now.",
		line: "Your flat or house, the rooms, the street.",
	},
	{
		id: "food",
		title: "Food and cooking",
		prompt: "Tell me what you cook and what you like to eat.",
		line: "What you cook, what you order, what you never eat.",
	},
	{
		id: "weather",
		title: "Weather and seasons",
		prompt: "Tell me what the weather is like where you are, and which season you prefer.",
		line: "Heat, rain, snow, and the season you wait for.",
	},
	{
		id: "free-time",
		title: "Free time",
		prompt: "Tell me what you do when there is nothing you have to do.",
		line: "Hobbies, sport, films, music, the weekend.",
	},
	{
		id: "travel",
		title: "Travel",
		prompt: "Tell me about a trip you made, or one you want to make.",
		line: "Where you went, how you got there, what you saw.",
	},
	{
		id: "plans",
		title: "Plans",
		prompt: "Tell me what you are going to do next week and next year.",
		line: "Tomorrow, the weekend, next year.",
	},
	{
		id: "health",
		title: "Health",
		prompt: "Tell me how you keep well and what you do when you are ill.",
		line: "The doctor, sleep, sport, how you feel.",
	},
];

const PURPOSE_TOPICS: Record<Purpose, readonly string[]> = {
	family: ["family", "yourself"],
	daily: ["food", "home", "weather"],
	work: ["work", "plans"],
	offices: ["plans", "health"],
	media: ["free-time", "travel"],
	exam: ["yourself", "plans"],
	curious: ["free-time", "travel"],
	other: [],
};

const NEARBY_TOPICS: Record<string, readonly string[]> = {
	yourself: ["family", "work"],
	family: ["home", "yourself"],
	home: ["family", "food"],
	food: ["home", "health"],
	work: ["plans", "yourself"],
	plans: ["work", "travel"],
	travel: ["free-time", "plans"],
	"free-time": ["travel", "weather"],
	weather: ["free-time", "home"],
	health: ["food", "plans"],
};

export function topicById(id: string): IslandTopic | undefined {
	return COMMON_TOPICS.find((t) => t.id === id);
}

function tokensOf(text: string): string[] {
	return text
		.normalize("NFC")
		.toLocaleLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((t) => t.length > 0);
}

export function chunkId(text: string): string {
	const folded = foldDiacritics(text.normalize("NFC").toLocaleLowerCase());
	return (
		folded
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "chunk"
	);
}

// Function words carry no topic, so they do not make two islands kin.
const FUNCTION_WORDS = new Set([
	"a",
	"aby",
	"aj",
	"ako",
	"ale",
	"asi",
	"bez",
	"bol",
	"bola",
	"boli",
	"by",
	"čo",
	"do",
	"ho",
	"i",
	"ich",
	"je",
	"jeho",
	"jej",
	"ju",
	"kde",
	"kedy",
	"keď",
	"kto",
	"ma",
	"má",
	"mi",
	"na",
	"nad",
	"nie",
	"no",
	"o",
	"od",
	"po",
	"pod",
	"pre",
	"pred",
	"pri",
	"sa",
	"si",
	"sme",
	"som",
	"ste",
	"sú",
	"ta",
	"tak",
	"tam",
	"ten",
	"to",
	"tu",
	"u",
	"už",
	"v",
	"vo",
	"vy",
	"z",
	"za",
	"že",
	"в",
	"во",
	"и",
	"на",
	"не",
	"с",
	"со",
	"по",
	"к",
	"о",
	"об",
	"от",
	"до",
	"за",
	"из",
	"у",
	"же",
	"бы",
	"что",
	"как",
	"это",
	"я",
	"ты",
	"он",
	"она",
	"они",
	"мы",
	"вы",
	"ja",
	"et",
	"ei",
	"see",
	"on",
	"ja",
	"ka",
	"the",
	"and",
	"is",
	"of",
	"to",
]);

function topicWords(chunks: readonly VaultChunk[]): Set<string> {
	const out = new Set<string>();
	for (const chunk of chunks)
		for (const token of tokensOf(chunk.sk)) if (token.length >= 3 && !FUNCTION_WORDS.has(token)) out.add(token);
	return out;
}

export interface IslandBridge {
	a: string;
	b: string;
	shared: string[];
}

export function bridges(islands: readonly Island[]): IslandBridge[] {
	const words = islands.map((island) => ({ island, words: topicWords(island.chunks) }));
	const out: IslandBridge[] = [];
	for (let i = 0; i < words.length; i++) {
		for (let j = i + 1; j < words.length; j++) {
			const mine = words[i]!;
			const theirs = words[j]!;
			const shared = [...mine.words].filter((w) => theirs.words.has(w)).sort();
			if (shared.length >= BRIDGE_MIN_SHARED) out.push({ a: mine.island.id, b: theirs.island.id, shared });
		}
	}
	return out;
}

export interface VaultStats {
	chunks: number;
	reviewed: number;
	said: number;
	words: number;
	phrases: number;
}

export function vaultStats(island: Island, reviewed?: ReadonlySet<string>): VaultStats {
	let reviewedCount = 0;
	let said = 0;
	let words = 0;
	for (const chunk of island.chunks) {
		if (chunkReviewed(chunk, reviewed)) reviewedCount++;
		if (chunk.saidAt) said++;
		if (chunk.kind === "word") words++;
	}
	return {
		chunks: island.chunks.length,
		reviewed: reviewedCount,
		said,
		words,
		phrases: island.chunks.length - words,
	};
}

function chunkReviewed(chunk: VaultChunk, reviewed?: ReadonlySet<string>): boolean {
	if (chunk.reviewedAt) return true;
	return !!chunk.slug && !!reviewed?.has(chunk.slug);
}

function meetsTalkBars(talk: IslandTalk): boolean {
	return (
		talk.learnerShare >= HOLDING_MIN_SHARE &&
		talk.medianReplyMs <= HOLDING_MAX_REPLY_MS &&
		talk.englishShare < ENGLISH_MAX_SHARE
	);
}

export interface IslandReadiness {
	step: IslandStep;
	next: Exclude<IslandStep, "started"> | null;
	stats: VaultStats;
	rehearsals: number;
	talks: number;
	/** What the next step still needs, in the learner's words. */
	needs: string[];
	/** The last talk that met the Fluent bars, and when the island fades. */
	lastFluentAt?: string;
	fadesAt?: string;
	everFluent: boolean;
	faded: boolean;
}

export function islandReadiness(
	island: Island,
	opts: { reviewed?: ReadonlySet<string>; now?: Date } = {},
): IslandReadiness {
	const now = opts.now ?? new Date();
	const stats = vaultStats(island, opts.reviewed);
	const built = stats.chunks >= VAULT_MIN_CHUNKS && stats.reviewed >= VAULT_MIN_CHUNKS;
	const rehearsed = island.rehearsals.some(
		(r) =>
			r.sec >= REHEARSE_TARGET_SEC &&
			r.used.length >= REHEARSE_MIN_CHUNKS_USED &&
			r.longestPauseMs <= REHEARSE_MAX_PAUSE_MS,
	);
	const talks = [...island.talks].sort((a, b) => a.at.localeCompare(b.at));
	const holding = talks.some((t) => t.sec >= HOLDING_TALK_SEC && meetsTalkBars(t));
	const fluentPasses = talks.filter((t) => t.sec >= FLUENT_TALK_SEC && meetsTalkBars(t) && t.bridgeUsed);
	const fluentDays = [...new Set(fluentPasses.map((t) => t.at.slice(0, 10)))];
	const everFluent = fluentDays.length >= FLUENT_TALK_DAYS;
	const lastPass = fluentPasses.at(-1);
	const lastFluentAt = lastPass?.at;
	const fadesAt = lastFluentAt
		? new Date(Date.parse(lastFluentAt) + FLUENT_FADE_DAYS * DAY_MS).toISOString()
		: undefined;
	const fresh = !!lastFluentAt && now.getTime() - Date.parse(lastFluentAt) < FLUENT_FADE_DAYS * DAY_MS;
	const fluent = everFluent && fresh;
	const faded = everFluent && !fresh;
	const step: IslandStep = fluent
		? "fluent"
		: holding
			? "holding"
			: rehearsed
				? "rehearsed"
				: built
					? "built"
					: "started";
	const next: IslandReadiness["next"] = fluent
		? null
		: holding
			? "fluent"
			: rehearsed
				? "holding"
				: built
					? "rehearsed"
					: "built";
	return {
		step,
		next,
		stats,
		rehearsals: island.rehearsals.length,
		talks: island.talks.length,
		needs: next ? stepNeeds(next, { built, rehearsed, holding, stats, island, now }) : [],
		...(lastFluentAt ? { lastFluentAt } : {}),
		...(fadesAt ? { fadesAt } : {}),
		everFluent,
		faded,
	};
}

function stepNeeds(
	next: Exclude<IslandStep, "started">,
	state: {
		built: boolean;
		rehearsed: boolean;
		holding: boolean;
		stats: VaultStats;
		island: Island;
		now: Date;
	},
): string[] {
	if (next === "built") {
		const needs: string[] = [];
		const short = VAULT_MIN_CHUNKS - state.stats.chunks;
		if (short > 0) needs.push(`${short} more ${short === 1 ? "chunk" : "chunks"} to reach ${VAULT_MIN_CHUNKS}.`);
		const unreviewed = VAULT_MIN_CHUNKS - state.stats.reviewed;
		if (unreviewed > 0)
			needs.push(
				`${unreviewed} ${unreviewed === 1 ? "chunk" : "chunks"} still to review (words in the deck, phrases with "Got it").`,
			);
		return needs;
	}
	if (next === "rehearsed")
		return [
			`A ${REHEARSE_TARGET_SEC}-second monologue that uses ${REHEARSE_MIN_CHUNKS_USED} vault chunks, with no pause over ${REHEARSE_MAX_PAUSE_MS / 1000} seconds.`,
		];
	if (next === "holding")
		return [
			`A ${HOLDING_TALK_SEC / 60}-minute live talk: you speak at least ${Math.round(HOLDING_MIN_SHARE * 100)}% of the time, start your replies within ${HOLDING_MAX_REPLY_MS / 1000} seconds, and stay under ${Math.round(ENGLISH_MAX_SHARE * 100)}% English.`,
		];
	const fluentDays = [
		...new Set(
			state.island.talks
				.filter((t) => t.sec >= FLUENT_TALK_SEC && meetsTalkBars(t) && t.bridgeUsed)
				.map((t) => t.at.slice(0, 10)),
		),
	];
	if (fluentDays.length < FLUENT_TALK_DAYS)
		return [
			`A ${FLUENT_TALK_SEC / 60}-minute talk at the same bars, on ${FLUENT_TALK_DAYS} different days, with a detour to a bridged island and back.`,
		];
	return [`A ${FLUENT_TALK_SEC / 60}-minute talk at the same bars to bring it back; the two-day pass is already done.`];
}

export function islandStep(island: Island, now = new Date()): IslandStep {
	return islandReadiness(island, { now }).step;
}

export interface IslandDue {
	id: string;
	topic: string;
	daysLeft: number;
	faded: boolean;
}

export function fadingIslands(islands: readonly Island[], now = new Date()): IslandDue[] {
	const out: IslandDue[] = [];
	for (const island of islands) {
		const readiness = islandReadiness(island, { now });
		if (!readiness.everFluent || !readiness.fadesAt) continue;
		const daysLeft = Math.ceil((Date.parse(readiness.fadesAt) - now.getTime()) / DAY_MS);
		if (readiness.faded || daysLeft <= FADE_WARNING_DAYS)
			out.push({ id: island.id, topic: island.topic, daysLeft: Math.max(0, daysLeft), faded: readiness.faded });
	}
	return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface IslandPrompt {
	topic: string;
	prompt: string;
	targetSec: number;
	starters: UsefulChunk[];
	suggestedWords: UsefulChunk[];
}

export function islandPrompt(island: Island): IslandPrompt {
	const topic = topicById(island.topicId ?? "");
	const chunks = island.chunks.map((c) => ({ sk: c.sk, en: c.en }));
	return {
		topic: island.topic,
		prompt: topic?.prompt ?? `Tell me about ${island.topic.toLowerCase()}.`,
		targetSec: REHEARSE_TARGET_SEC,
		starters: chunks.filter((c) => c.sk.trim().split(/\s+/).length > 1).slice(0, 4),
		suggestedWords: chunks.filter((c) => c.sk.trim().split(/\s+/).length === 1).slice(0, 8),
	};
}

export function rehearsalXp(sec: number): { xp: number; metTarget: boolean } {
	if (sec < 10) return { xp: 0, metTarget: false };
	if (sec >= REHEARSE_TARGET_SEC) return { xp: REHEARSAL_BASE_XP + REHEARSAL_BONUS_XP, metTarget: true };
	return { xp: Math.max(5, Math.round(REHEARSAL_BASE_XP * (sec / REHEARSE_TARGET_SEC))), metTarget: false };
}

export interface ChunkCandidate {
	sk: string;
	en: string;
}

export interface LexiconMatch {
	slug: string;
	lemma: string;
}

/** What the model replied, read as candidates: the outermost braces, bounded strings, no duplicates. */
export function parseVaultChunks(text: string, cap = 24): ChunkCandidate[] {
	const from = text.indexOf("{");
	const to = text.lastIndexOf("}");
	if (from < 0 || to <= from) return [];
	let raw: unknown;
	try {
		raw = (JSON.parse(text.slice(from, to + 1)) as { chunks?: unknown }).chunks;
	} catch {
		return [];
	}
	if (!Array.isArray(raw)) return [];
	const out: ChunkCandidate[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const row = item as { sk?: unknown; en?: unknown };
		const sk = typeof row.sk === "string" ? row.sk.replace(/\s+/g, " ").trim().slice(0, 120) : "";
		const en = typeof row.en === "string" ? row.en.replace(/\s+/g, " ").trim().slice(0, 160) : "";
		if (!sk || !en) continue;
		const key = foldDiacritics(sk.toLocaleLowerCase());
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ sk, en });
		if (out.length >= cap) break;
	}
	return out;
}

/** Keep only the chunks the dictionary confirms: a single word must be an entry; every word of a phrase must be a known form. */
export function confirmedChunks(
	candidates: readonly ChunkCandidate[],
	lookup: (form: string) => LexiconMatch | undefined,
	opts: { at: string; limit?: number },
): { chunks: VaultChunk[]; dropped: string[] } {
	const limit = opts.limit ?? 24;
	const chunks: VaultChunk[] = [];
	const dropped: string[] = [];
	const seen = new Set<string>();
	for (const candidate of candidates) {
		const sk = candidate.sk.replace(/\s+/g, " ").trim();
		const en = candidate.en.replace(/\s+/g, " ").trim();
		if (!sk || !en) continue;
		const key = foldDiacritics(sk.toLocaleLowerCase());
		if (seen.has(key)) continue;
		const tokens = tokensOf(sk);
		const words = tokens.filter((t) => /\p{L}/u.test(t));
		if (words.length === 0) {
			dropped.push(sk);
			continue;
		}
		const matches = words.map((w) => lookup(w));
		if (matches.some((m) => !m)) {
			dropped.push(sk);
			continue;
		}
		seen.add(key);
		const single = tokens.length === 1;
		const word = single ? matches[0] : undefined;
		chunks.push({
			id: chunkId(sk),
			sk,
			en,
			kind: single ? "word" : "phrase",
			...(word ? { slug: word.slug } : {}),
			addedAt: opts.at,
		});
		if (chunks.length >= limit) break;
	}
	return { chunks, dropped };
}

/** The chunks the learner's own transcript shows: a word by its stem, a phrase by its longest word. */
export function usedChunkIds(transcript: string, chunks: readonly VaultChunk[]): string[] {
	const text = ` ${foldDiacritics(transcript.normalize("NFC").toLocaleLowerCase())} `;
	if (text.trim().length === 0) return [];
	const out: string[] = [];
	for (const chunk of chunks) {
		const words = tokensOf(chunk.sk).filter((t) => t.length >= 3);
		const longest = [...words].sort((a, b) => b.length - a.length)[0];
		if (!longest) continue;
		const stem = foldDiacritics(longest).slice(0, Math.min(longest.length, Math.max(4, Math.min(longest.length, 6))));
		if (stem.length >= 4 && text.includes(stem)) out.push(chunk.id);
	}
	return out;
}

export interface TopicSuggestion {
	/** The common topic's id, or null for the learner's own words. */
	topicId: string | null;
	title: string;
	prompt: string;
	reason: string;
}

export function suggestedTopics(
	goal: { purposes?: readonly Purpose[]; purposeNote?: string } | undefined,
	islands: readonly Island[],
	limit = 6,
): TopicSuggestion[] {
	const started = new Set(islands.map((i) => i.topicId).filter((id): id is string => typeof id === "string"));
	const out: TopicSuggestion[] = [];
	const add = (topic: IslandTopic, reason: string) => {
		if (started.has(topic.id) || out.some((o) => o.topicId === topic.id)) return;
		out.push({ topicId: topic.id, title: topic.title, prompt: topic.prompt, reason });
	};
	for (const island of islands) {
		if (!island.topicId) continue;
		for (const near of NEARBY_TOPICS[island.topicId] ?? []) {
			const topic = topicById(near);
			if (topic) add(topic, `Shares words with ${island.topic}.`);
		}
	}
	for (const purpose of goal?.purposes ?? []) {
		const title = purposeInfo(purpose).title.toLowerCase();
		for (const id of PURPOSE_TOPICS[purpose] ?? []) {
			const topic = topicById(id);
			if (topic) add(topic, `You said ${title} is what the language is for.`);
		}
	}
	if (goal?.purposeNote?.trim())
		out.push({
			topicId: null,
			title: goal.purposeNote.trim().slice(0, 80),
			prompt: `Tell me about this, in your own words: ${goal.purposeNote.trim().slice(0, 200)}`,
			reason: "Your own words from setup.",
		});
	for (const topic of COMMON_TOPICS) add(topic, topic.line);
	return out.slice(0, limit);
}

export interface IslandSummary {
	island: Island;
	readiness: IslandReadiness;
	bridges: Array<{ id: string; topic?: string; shared: number }>;
}

export function islandSummary(
	island: Island,
	opts: { reviewed?: ReadonlySet<string>; bridges?: readonly IslandBridge[]; now?: Date } = {},
): IslandSummary {
	const kin: Array<{ id: string; topic?: string; shared: number }> = [];
	for (const bridge of opts.bridges ?? []) {
		if (bridge.a === island.id) kin.push({ id: bridge.b, shared: bridge.shared.length });
		else if (bridge.b === island.id) kin.push({ id: bridge.a, shared: bridge.shared.length });
	}
	return {
		island,
		readiness: islandReadiness(island, opts),
		bridges: kin,
	};
}

export interface IslandPageData {
	islands: IslandSummary[];
	topics: TopicSuggestion[];
	due: IslandDue[];
	level: Cefr;
}

export function islandPageData(
	islands: readonly Island[],
	opts: {
		goal?: { purposes?: readonly Purpose[]; purposeNote?: string; level: Cefr };
		reviewed?: ReadonlySet<string>;
		now?: Date;
	} = {},
): IslandPageData {
	const now = opts.now ?? new Date();
	const kin = bridges(islands);
	const summaries = islands.map((island) => islandSummary(island, { ...opts, bridges: kin, now }));
	const titles = new Map(islands.map((i) => [i.id, i.topic]));
	const withTitles = summaries.map((s) => ({
		...s,
		bridges: s.bridges.map((b) => ({ ...b, topic: titles.get(b.id) ?? "Another island" })),
	}));
	return {
		islands: withTitles,
		topics: suggestedTopics(opts.goal, islands),
		due: fadingIslands(islands, now),
		level: opts.goal?.level ?? "A2",
	};
}
