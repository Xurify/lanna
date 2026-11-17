import { randomUUID } from "node:crypto";
import type { PiEngine } from "../agent/models.ts";
import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import {
	addMinutes,
	dayKey,
	foldDiacritics,
	type Cefr,
	type ChunkCandidate,
	type Island,
	type IslandPageData,
	type IslandSummary,
	type LexiconMatch,
	type VaultChunk,
} from "../core/index.ts";
import {
	confirmedChunks,
	chunkId,
	islandPageData,
	islandSummary,
	parseVaultChunks,
	rehearsalXp,
	REHEARSE_MAX_PAUSE_MS,
	topicById,
	usedChunkIds,
} from "../core/islands.ts";
import { progressStore } from "../store/progress.ts";
import { islandStore } from "../store/islands.ts";
import { reviewStore } from "../store/review.ts";
import { appendLessonLog } from "../store/corpus.ts";
import { aiMissing, aiStatus } from "./ai-status.ts";
import { activeLanguage } from "./active-language.ts";
import { enqueueWords } from "./review.ts";
import { storyEngine } from "./reading.ts";

const CREATE_CANDIDATES = 24;

function reviewedSlugs(): Set<string> {
	const cards = reviewStore.readCards();
	return new Set(
		Object.values(cards)
			.filter((card) => (card.reps ?? 0) > 0)
			.map((card) => card.slug),
	);
}

function learnerLevel(): Cefr {
	return progressStore.read().goal?.level ?? "A2";
}

function lookupIn(lexicon: Lexicon): (form: string) => LexiconMatch | undefined {
	const tag = activeLanguage().tag;
	return (form) => {
		const lower = form.toLocaleLowerCase(tag);
		const hit = lexicon.byForm.get(lower)?.[0] ?? lexicon.byFolded.get(foldDiacritics(lower))?.[0];
		return hit ? { slug: hit.slug, lemma: hit.lemma ?? hit.sk ?? form } : undefined;
	};
}

function vaultSystem(english: string, level: Cefr): string {
	return `You build what the learner needs for one topic in ${english}: about two dozen chunks they can actually say out loud in a conversation on it, at CEFR ${level}.

Rules:
- ${english} goes in "sk". "en" is a short English meaning, never a sentence about grammar.
- Phrases first (about two thirds of the list), then single words that the topic needs.
- Stay at ${level}: the vocabulary and the grammar of that level, not above it.
- Every form must be standard written ${english}. Never invent a word, an ending or a pair; if a form is unsure, choose a simpler phrase you are sure about.
- Everyday, sayable things: not dictionary examples, not textbook slogans.
- No duplicates, no proper names, nothing grim.

Reply with one JSON object and nothing else: {"chunks":[{"sk":"","en":""}]}`;
}

async function askForVault(
	resolved: { engine: PiEngine; model: string },
	topic: string,
	prompt: string,
	level: Cefr,
): Promise<ChunkCandidate[]> {
	const { text } = await runSubagent([], {
		role: "researcher",
		engine: resolved.engine,
		systemPrompt: vaultSystem(activeLanguage().english, level),
		prompt: `Topic: ${topic}\nThe learner would talk about it like this: ${prompt}\nWrite ${CREATE_CANDIDATES} chunks.`,
		maxTurns: 1,
	});
	return parseVaultChunks(text, CREATE_CANDIDATES);
}

function newIslandId(topic: string): string {
	return `${chunkId(topic).slice(0, 40) || "island"}-${randomUUID().slice(0, 6)}`;
}

export interface CreateIslandInput {
	topicId?: string;
	topic?: string;
	engine?: PiEngine;
	model?: string;
}

export async function createIsland(input: CreateIslandInput = {}, now = new Date()): Promise<Island> {
	const topicDef = input.topicId ? topicById(input.topicId) : undefined;
	const topic = (input.topic ?? topicDef?.title ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
	if (!topic) throw new Error("Pick a topic first.");
	const prompt = topicDef?.prompt ?? `Tell me about ${topic.toLowerCase()}.`;
	const lexicon = loadLexicon();
	if (!lexicon) throw new Error("This language has no dictionary yet, so the chunks could not be checked against it.");
	const resolved = input.engine ? { engine: input.engine, model: input.model ?? "faux:faux" } : storyEngine();
	if (!resolved) throw new Error(aiMissing(aiStatus("cheap")));
	const candidates = await askForVault(resolved, topic, prompt, learnerLevel());
	const { chunks } = confirmedChunks(candidates, lookupIn(lexicon), {
		at: now.toISOString(),
		limit: CREATE_CANDIDATES,
	});
	if (!chunks.length)
		throw new Error(
			"The dictionary could not confirm any chunk for this topic, so nothing was kept. Try another topic, or add chunks yourself.",
		);
	const island: Island = {
		id: newIslandId(topic),
		topic,
		...(topicDef ? { topicId: topicDef.id } : {}),
		level: learnerLevel(),
		chunks,
		rehearsals: [],
		talks: [],
		createdAt: now.toISOString(),
	};
	islandStore.put(island);
	queueWords(island, now);
	return island;
}

function queueWords(island: Island, now: Date): void {
	const slugs = island.chunks.flatMap((chunk) => (chunk.kind === "word" && chunk.slug ? [chunk.slug] : []));
	if (!slugs.length) return;
	try {
		enqueueWords(slugs, now);
	} catch (err) {
		console.warn("[islands] could not queue the vault words:", err instanceof Error ? err.message : err);
	}
}

export type VaultAction =
	| { action: "review"; chunkId: string }
	| { action: "remove"; chunkId: string }
	| { action: "add"; sk: string; en: string };

export function editVault(id: string, change: VaultAction, now = new Date()): Island {
	const island = islandStore.get(id);
	if (!island) throw new Error("No such island.");
	if (change.action === "review") {
		const chunk = island.chunks.find((c) => c.id === change.chunkId);
		if (!chunk) throw new Error("No such chunk.");
		chunk.reviewedAt = now.toISOString();
		islandStore.put(island);
		return island;
	}
	if (change.action === "remove") {
		const kept = island.chunks.filter((c) => c.id !== change.chunkId);
		if (kept.length === island.chunks.length) throw new Error("No such chunk.");
		island.chunks = kept;
		islandStore.put(island);
		return island;
	}
	const sk = change.sk.replace(/\s+/g, " ").trim().slice(0, 120);
	const en = change.en.replace(/\s+/g, " ").trim().slice(0, 160);
	if (!sk || !en) throw new Error("Both the chunk and its meaning are needed.");
	if (island.chunks.some((c) => c.id === chunkId(sk) || c.sk.toLocaleLowerCase() === sk.toLocaleLowerCase()))
		throw new Error("That chunk is already in the vault.");
	const lexicon = loadLexicon();
	if (!lexicon) throw new Error("This language has no dictionary yet, so the chunk could not be checked.");
	const { chunks, dropped } = confirmedChunks([{ sk, en }], lookupIn(lexicon), { at: now.toISOString(), limit: 1 });
	if (!chunks.length) throw new Error(`The dictionary does not confirm "${dropped[0] ?? sk}", so it was not added.`);
	island.chunks.push(chunks[0]!);
	islandStore.put(island);
	if (chunks[0]!.slug) {
		try {
			enqueueWords([chunks[0]!.slug], now);
		} catch (err) {
			console.warn("[islands] could not queue the new word:", err instanceof Error ? err.message : err);
		}
	}
	return island;
}

export function removeIsland(id: string): boolean {
	return islandStore.remove(id);
}

export interface RehearsalInput {
	id: string;
	activeSec: number;
	transcript?: string;
	longestPauseMs?: number;
	tz?: number;
}

export interface RehearsalOutcome {
	island: Island;
	used: string[];
	xp: number;
	metTarget: boolean;
}

export function recordRehearsal(input: RehearsalInput, now = new Date()): RehearsalOutcome {
	const island = islandStore.get(input.id);
	if (!island) throw new Error("No such island.");
	const sec = Math.max(0, Math.min(600, Math.round(input.activeSec)));
	const transcript = (input.transcript ?? "").trim().slice(0, 8000);
	const at = now.toISOString();
	const used = usedChunkIds(transcript, island.chunks);
	for (const chunk of island.chunks) if (used.includes(chunk.id)) chunk.saidAt = at;
	const pause =
		typeof input.longestPauseMs === "number" && Number.isFinite(input.longestPauseMs)
			? Math.max(0, Math.round(input.longestPauseMs))
			: REHEARSE_MAX_PAUSE_MS + 1;
	island.rehearsals.push({ at, sec, used, longestPauseMs: pause });
	islandStore.put(island);
	const { xp, metTarget } = rehearsalXp(sec);
	const p = progressStore.read();
	const key = dayKey(now, input.tz);
	const day = (p.days[key] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	day.speaks = (day.speaks ?? 0) + 1;
	day.xp += xp;
	addMinutes(day, "speak", sec * 1000);
	p.xp += xp;
	progressStore.write(p);
	try {
		appendLessonLog({
			id: `island-rehearsal-${Date.now()}`,
			at,
			day: key,
			unit: `island:${island.id}`,
			mode: "speak",
			ms: sec * 1000,
			xp,
			correct: metTarget ? 1 : 0,
			total: 1,
			perfect: metTarget,
			queued: [],
			reps: [],
		});
	} catch (err) {
		console.warn("[islands] could not append lesson log:", err instanceof Error ? err.message : err);
	}
	return { island, used, xp, metTarget };
}

export function listIslandSummaries(now = new Date()): IslandSummary[] {
	return islandPageData(islandStore.list(), { reviewed: reviewedSlugs(), now }).islands;
}

export function islandPage(now = new Date()): IslandPageData {
	const goal = progressStore.read().goal;
	return islandPageData(islandStore.list(), {
		...(goal ? { goal: { ...goal, level: goal.level ?? learnerLevel() } } : {}),
		reviewed: reviewedSlugs(),
		now,
	});
}

export function getIslandSummary(id: string, now = new Date()): IslandSummary | null {
	const islands = islandStore.list();
	const island = islands.find((i) => i.id === id);
	if (!island) return null;
	const page = islandPageData(islands, { reviewed: reviewedSlugs(), now });
	return page.islands.find((s) => s.island.id === id) ?? islandSummary(island, { reviewed: reviewedSlugs(), now });
}

export function chunkOf(island: Island, id: string): VaultChunk | undefined {
	return island.chunks.find((chunk) => chunk.id === id);
}
