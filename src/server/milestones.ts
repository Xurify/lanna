/**
 * Milestones service (LangHarness, 2026-10-28) — behind /milestones and
 * /api/milestones. Gathers what the app knows about the learner into
 * LearnerFacts (src/core/milestones.ts) and estimates each milestone:
 *
 *   words  — the deck (src/store/review.ts) and the word units with
 *            lessons behind them are the words MET; the level (placement
 *            when there was one, else the map) credits the commonest
 *            words up to Milton's figure for that level as ASSUMED; the
 *            working vocabulary is the union. "Commonest" is by how often
 *            each dictionary word's forms occur in the dictionary's own
 *            30,000 example sentences, a unified frequency order the
 *            per-part-of-speech ranks cannot give.
 *   speed  — every Listen rep since the player started timing them
 *            (lesson log, mode "listen": ms, heardMs, replays, peeked,
 *            words) and every Watch record (videos/watches.jsonl, when the
 *            Watch task exists), read into words a minute of understanding.
 *   pace   — the goal's minutes and days, the last 14 days' minutes, new
 *            words a day planned (deck setting + input tasks) and real
 *            (cards minted in the last 14 days).
 *
 * A milestone in the learner's own words is mapped once by the cheap model
 * slot to a genre, a coverage target, a speaker rate and the support the
 * situation gives; the mapping is kept on disk (src/store/milestones.ts).
 */

import type { Usage } from "@earendil-works/pi-ai";
import fs from "node:fs";
import path from "node:path";
import { PATHS } from "../../config.ts";
import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import { curriculumState, GUIDED_HOURS, hoursDone, type Cefr } from "../core/curriculum.ts";
import { UNITS } from "../core/lesson.ts";
import {
	creditedSpeed,
	customId,
	customMilestone,
	estimateMilestone,
	GENRES,
	levelVocabulary,
	MILESTONES,
	normalizeCustomText,
	parseCustomMapping,
	speedFromSamples,
	speedTrend,
	type CustomMapping,
	type LearnerFacts,
	type MilestoneDef,
	type MilestoneEstimate,
	type SpeedSample,
	type TrendPoint,
} from "../core/milestones.ts";
import { grammarWord, tokenize } from "../core/reading.ts";
import { dayKey, DEFAULT_REVIEW_SETTINGS, type LexiconEntry } from "../core/review.ts";
import { readLessonLog } from "../store/corpus.ts";
import { milestoneStore, type CustomMilestoneRecord } from "../store/milestones.ts";
import { DEFAULT_GOAL, progressStore } from "../store/progress.ts";
import { reviewStore } from "../store/review.ts";
import { readSettings } from "../store/settings.ts";
import { DEFAULT_DAYS_PER_WEEK } from "../core/onboarding.ts";
import { resolveWord, storyEngine } from "./reading.ts";

// ─── A unified frequency order ──────────────────────────────────────────────

const orderCache = new WeakMap<Lexicon, string[]>();

/** Every dictionary word, commonest first, by how often its forms occur
 *  across the dictionary's example sentences (170,000 running words).
 *  Words whose forms never occur keep their part-of-speech rank order
 *  after the rest. Computed once per process. */
export function frequencyOrder(lexicon: Lexicon): string[] {
	const hit = orderCache.get(lexicon);
	if (hit) return hit;
	const all = new Set(lexicon.entries.map((e) => e.slug));
	const counts = new Map<string, number>();
	for (const e of lexicon.entries)
		for (const ex of e.examples)
			for (const t of tokenize(ex.sk)) {
				if (!t.word || /^\p{N}+$/u.test(t.text)) continue;
				const entry = resolveWord(lexicon, t.text, all, { stem: false });
				if (entry) counts.set(entry.slug, (counts.get(entry.slug) ?? 0) + 1);
			}
	// Ties (and the long tail the sentences never reach) fall back to the
	// part-of-speech rank as a share of its list, so noun #1,500 of 3,000
	// sits beside verb #1,000 of 2,000 rather than after adverb #1,000.
	const size = new Map<string, number>();
	for (const e of lexicon.entries) if (e.rank !== undefined) size.set(e.cat, Math.max(size.get(e.cat) ?? 0, e.rank));
	const share = (e: LexiconEntry) => (e.rank === undefined ? 2 : e.rank / (size.get(e.cat) ?? e.rank));
	const order = [...lexicon.entries]
		.sort((a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0) || share(a) - share(b) || a.slug.localeCompare(b.slug))
		.map((e) => e.slug);
	orderCache.set(lexicon, order);
	return order;
}

// ─── What the learner knows ─────────────────────────────────────────────────

export interface WordSets {
	met: Set<string>;
	solid: number;
	assumed: Set<string>;
	/** met ∪ assumed */
	known: Set<string>;
	/** Where the map has the learner now. */
	level: Cefr;
	levelProgress: number;
	/** A placement check was done at some point. */
	placed: boolean;
	/** The lemmas credited beyond the ones met: the word check's estimate
	 *  when there was one, else the band of the level completed plus the
	 *  progress through the current one. */
	credited: number;
	basis: "measured" | "level";
	measuredAt?: string;
	measuredReliable?: boolean;
}

/** New words a day the input tasks add on top of the deck's setting:
 *  Listen's stretch words and Read's deliberate new words. */
export const INPUT_WORDS_PER_DAY = 5;
/** Days of history the real rates need before they are shown. */
export const PACE_DAYS = 14;

export function wordSets(lexicon: Lexicon | null): WordSets {
	const p = progressStore.read();
	const goal = p.goal ?? DEFAULT_GOAL;
	const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	// The level is where the map has the learner: placement set its start,
	// every lesson since has moved it. (It used to pin goal.placedLevel for
	// good, and to credit the whole band of the level being entered.)
	const placed = !!goal.placedAt;
	const level: Cefr = state.level;
	const measured = goal.vocabulary;
	const credited = measured ? measured.size : levelVocabulary(level, state.levelProgress);
	const met = new Set<string>();
	let solid = 0;
	const cards = Object.values(reviewStore.readCards()).filter((c) => !c.suspended);
	for (const c of cards) {
		met.add(c.slug);
		if ((c.memory?.stability ?? 0) >= 7 && c.reps > 0) solid++;
	}
	for (const u of UNITS) {
		if (u.kind !== "words" || (p.units[u.id]?.lessons ?? 0) === 0) continue;
		for (const lemma of u.lemmas ?? []) for (const e of lexicon?.byForm.get(lemma.toLocaleLowerCase("sk-SK")) ?? []) met.add(e.slug);
	}
	const assumed = new Set<string>();
	if (lexicon) for (const slug of frequencyOrder(lexicon).slice(0, credited)) if (!met.has(slug)) assumed.add(slug);
	return { met, solid, assumed, known: new Set([...met, ...assumed]), level, levelProgress: state.levelProgress, placed, credited, basis: measured ? "measured" : "level", ...(measured ? { measuredAt: measured.at, measuredReliable: measured.reliable } : {}) };
}

// ─── Speed evidence ─────────────────────────────────────────────────────────

interface WatchLine {
	at?: string;
	segments?: number;
	gotFirst?: number;
	stats?: Array<{ words?: number; sec?: number; replays?: number; got?: string }>;
}

/** The Watch task's records (another thread's store); absent until it exists. */
function readWatches(): WatchLine[] {
	try {
		return fs
			.readFileSync(path.join(PATHS.data, "videos", "watches.jsonl"), "utf-8")
			.split("\n")
			.filter(Boolean)
			.flatMap((l) => {
				try {
					return [JSON.parse(l) as WatchLine];
				} catch {
					return [];
				}
			});
	} catch {
		return [];
	}
}

/** Minutes studied per local day, from the progress ledger. */
function minutesByDay(): Map<string, number> {
	const p = progressStore.read();
	return new Map(Object.entries(p.days).map(([d, r]) => [d, r.minutes ?? 0]));
}

export function learnerFacts(lexicon: Lexicon | null = loadLexicon(), now = new Date(), tz?: number): LearnerFacts {
	const p = progressStore.read();
	const goal = p.goal ?? DEFAULT_GOAL;
	const sets = wordSets(lexicon);
	const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	const daysPerWeek = goal.daysPerWeek ?? DEFAULT_DAYS_PER_WEEK;

	// Pace: the last 14 days' minutes.
	let paceTotal = 0;
	let paceDays = 0;
	for (let i = PACE_DAYS - 1; i >= 0; i--) {
		const m = p.days[dayKey(new Date(now.getTime() - i * 86_400_000), tz)]?.minutes ?? 0;
		paceTotal += m;
		if (m > 0) paceDays++;
	}
	const hoursLogged = Object.values(p.days).reduce((n, d) => n + (d.minutes ?? 0), 0) / 60;

	// Words a day: planned = the deck's setting + the input tasks; real =
	// cards minted in the last 14 days, once the deck is that old.
	const newPerDay = reviewStore.readMeta().settings.newPerDay ?? DEFAULT_REVIEW_SETTINGS.newPerDay;
	const cards = Object.values(reviewStore.readCards());
	const since = now.getTime() - PACE_DAYS * 86_400_000;
	const oldest = cards.reduce((t, c) => Math.min(t, Date.parse(c.createdAt) || t), now.getTime());
	const minted = cards.filter((c) => (Date.parse(c.createdAt) || 0) >= since).length;
	const wordsPerDayReal = now.getTime() - oldest >= PACE_DAYS * 86_400_000 ? minted / PACE_DAYS : null;

	// Listen: every timed rep; a trend point per session at the study
	// hours the learner had by then.
	const log = readLessonLog().filter((e) => e.mode === "listen");
	const minutes = minutesByDay();
	const days = [...minutes.keys()].sort();
	const hoursBy = (day: string) => days.filter((d) => d <= day).reduce((n, d) => n + (minutes.get(d) ?? 0), 0) / 60;
	const samples: SpeedSample[] = [];
	const points: TrendPoint[] = [];
	const knownSentences = { total: 0, right: 0 };
	for (const e of log) {
		const own: SpeedSample[] = [];
		for (const r of e.reps) {
			if (r.ms === undefined) continue;
			own.push({ words: r.words ?? r.sentence.split(/\s+/).length, ms: r.ms, heardMs: r.heardMs, replays: r.replays, correct: r.verdict === "exact", peeked: r.peeked, at: e.at });
		}
		samples.push(...own);
		const reading = speedFromSamples(own);
		if (reading && reading.samples >= 4) points.push({ hours: hoursBy(e.day), wpm: reading.wpm, at: e.at });
	}
	// Known-sentence trust: the Listen log keeps each rep's stretch slugs
	// only in the queued list, so count sentences whose word was not queued.
	for (const e of log) {
		const queued = new Set(e.queued);
		for (const r of e.reps) {
			if (queued.has(r.slug)) continue;
			knownSentences.total++;
			if (r.verdict === "exact") knownSentences.right++;
		}
	}
	const listenReading = speedFromSamples(samples);
	const trend = speedTrend(points);

	// Watch: segments understood on the first unaided pass, at the
	// speaker's own rate; the time of every segment counts, replays too.
	const watches = readWatches();
	let watch: LearnerFacts["watch"] = null;
	if (watches.length) {
		let segments = 0;
		let gotFirst = 0;
		const wsamples: SpeedSample[] = [];
		for (const w of watches) {
			segments += w.segments ?? w.stats?.length ?? 0;
			gotFirst += w.gotFirst ?? w.stats?.filter((s) => s.got === "first").length ?? 0;
			for (const s of w.stats ?? []) {
				if (!s.words || !s.sec) continue;
				const audio = s.sec * 1000;
				wsamples.push({ words: s.words, ms: audio * (1 + (s.replays ?? 0)) * (s.got === "first" ? 1 : s.got === "after" ? 1.5 : 3), heardMs: audio, replays: s.replays, correct: s.got === "first" || s.got === "after", at: w.at ?? now.toISOString() });
			}
		}
		watch = { videos: watches.length, segments, gotFirst, reading: speedFromSamples(wsamples) };
	}

	const base: Omit<LearnerFacts, "speed"> = {
		level: sets.level,
		levelProgress: sets.levelProgress,
		placed: sets.placed,
		words: { basis: sets.basis, credited: sets.credited, ...(sets.measuredAt ? { measuredAt: sets.measuredAt, reliable: sets.measuredReliable ?? true } : {}) },
		met: sets.met.size,
		solid: sets.solid,
		assumed: sets.assumed.size,
		vocabulary: sets.known.size,
		wordsPerDayPlanned: newPerDay + INPUT_WORDS_PER_DAY,
		wordsPerDayReal,
		minutesPerDay: goal.minutesPerDay,
		daysPerWeek,
		paceMinutes: Math.round(paceTotal / PACE_DAYS),
		paceDays,
		hoursDone: hoursDone(state),
		hoursLogged: Math.round(hoursLogged * 10) / 10,
		listen: { sessions: log.length, reading: listenReading, trend: trend ? { slope: trend.slope, points: trend.points } : null, knownSentences },
		watch,
	};
	return { ...base, speed: creditedSpeed(base) };
}

// ─── The report ─────────────────────────────────────────────────────────────

export interface NextWord {
	slug: string;
	lemma: string;
	gloss: string;
	cat: string;
	/** Position in the unified frequency order (1 = commonest). */
	rank: number;
}

export interface MilestonesReport {
	facts: LearnerFacts;
	milestones: MilestoneEstimate[];
	/** The commonest dictionary words the learner is not credited with. */
	nextWords: NextWord[];
	/** The map's can-do goals, by id: title and whether they are done. */
	goals: Record<string, { title: string; done: boolean; open: boolean }>;
	guidedHours: Record<Cefr, number>;
	generatedAt: string;
}

export const NEXT_WORDS = 24;

export function allMilestones(): MilestoneDef[] {
	return [...MILESTONES, ...milestoneStore.active().map((c) => c.def)];
}

export function milestonesReport(now = new Date(), tz?: number): MilestonesReport {
	const lexicon = loadLexicon();
	const facts = learnerFacts(lexicon, now, tz);
	const milestones = allMilestones().map((def) => estimateMilestone(def, facts, { now }));
	const sets = wordSets(lexicon);
	const nextWords: NextWord[] = [];
	if (lexicon) {
		const order = frequencyOrder(lexicon);
		for (let i = 0; i < order.length && nextWords.length < NEXT_WORDS; i++) {
			const slug = order[i]!;
			if (sets.known.has(slug)) continue;
			const e = lexicon.bySlug.get(slug) as LexiconEntry | undefined;
			// Not vocabulary to learn: places, names and their adjectives
			// (Ježišov), and the grammar words the dictionary happens to hold.
			if (!e || e.cat === "Places" || grammarWord(e.sk) || e.sk.charAt(0) !== e.sk.charAt(0).toLocaleLowerCase("sk-SK")) continue;
			nextWords.push({ slug, lemma: e.sk, gloss: e.en, cat: e.cat, rank: i + 1 });
		}
	}
	const p = progressStore.read();
	const goal = p.goal ?? DEFAULT_GOAL;
	const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	const goals: MilestonesReport["goals"] = {};
	for (const c of state.chapters) for (const u of c.units) if (u.kind === "goal") goals[u.id] = { title: u.title, done: u.status === "done" || u.status === "skipped", open: u.status === "open" || u.status === "started" };
	return { facts, milestones, nextWords, goals, guidedHours: GUIDED_HOURS, generatedAt: now.toISOString() };
}

// ─── Custom milestones ──────────────────────────────────────────────────────

const SYSTEM = `You classify a language learner's goal for a Slovak learning app. You answer with ONE JSON object and nothing else: no prose, no code fences.

The learner writes a situation they want to handle in Slovak, in their own words. Map it to the kind of language it involves and how it is delivered, so the app can estimate when they will get there from published word-coverage and listening-speed research. Fields:
- "title": the situation as a short can-do line in English, at most 8 words, starting with a verb or noun phrase ("Follow my mother-in-law's phone calls").
- "line": one sentence, at most 25 words, saying what "most of it" means here.
- "genre": the closest kind of material, one of: ${Object.keys(GENRES).join(", ")}. Everyday talk, phone calls, family, shops, friends → conversation. YouTube, podcasts, radio, TV → tv (children's cartoons → children). Cinema, series drama → film. Newspapers, news sites → news. Books → fiction. Offices, contracts, letters, official forms, lectures → formal. Music → songs.
- "coverage": how much of the words must be known: 0.9 when the learner can ask again or the stakes are low, 0.95 to follow comfortably (the usual), 0.98 for unassisted reading or listening with no help at all.
- "wpm": the speaker's words a minute: 0 when the learner sets the pace (reading, texting), 100 for slow careful speech, 130 for a calm podcast or a news reader, 150 for natural speech, 170 for fast or heated talk.
- "support": "interactive" when the learner can ask for a repeat (any live conversation), "subtitles" when text runs with the speech, "visual" when pictures or action carry meaning (video, film, being there), "none" for audio alone or plain text.
- "icon": one of monitor-play (video sites), video, headphones (podcasts, radio), newspaper, coffee, users, captions, clapperboard, radio, book-open, message-circle, briefcase, music, phone, mail, landmark, tv, mic, baby, gamepad-2, map, sparkles.
- "cefr": the CEFR listening or reading descriptor this matches, at most 15 words ("B1: can follow clearly articulated speech directed at me").`;

export interface CustomOptions {
	engine?: PiEngine;
	model?: string;
	now?: Date;
}

function stepOf(u: Usage) {
	return { inputTokens: u.input, outputTokens: u.output, cacheReadTokens: u.cacheRead, cacheWriteTokens: u.cacheWrite, cacheWrite1hTokens: u.cacheWrite1h ?? 0, reasoningTokens: u.reasoning };
}

/** A milestone in the learner's words: mapped once by the cheap model,
 *  kept on disk; the same words again (or a removed one) cost nothing. */
export async function addCustomMilestone(textRaw: string, opts: CustomOptions = {}): Promise<{ record: CustomMilestoneRecord; reused: boolean }> {
	const text = normalizeCustomText(textRaw);
	if (text.length < 3) throw new Error("Say what you want to be able to do, in a few words.");
	const id = customId(text);
	const existing = milestoneStore.find(id);
	if (existing) {
		milestoneStore.upsert(existing);
		return { record: { ...existing, removedAt: undefined }, reused: true };
	}
	const now = opts.now ?? new Date();
	const resolved = opts.engine ? { engine: opts.engine, model: opts.model ?? "faux:faux" } : storyEngine();
	if (!resolved) throw new Error("No model is configured. Set the cheap slot in Settings → Models.");
	const usage = { model: resolved.model, steps: [] as ReturnType<typeof stepOf>[] };
	const { text: answer } = await runSubagent([], {
		role: "researcher",
		engine: resolved.engine,
		systemPrompt: SYSTEM,
		prompt: `The learner wrote: "${text}"`,
		maxTurns: 1,
		onUsage: (u) => usage.steps.push(stepOf(u)),
	});
	const mapping: CustomMapping = parseCustomMapping(answer, text);
	const record: CustomMilestoneRecord = { def: customMilestone(text, mapping), text, mapping, model: resolved.model, usage, createdAt: now.toISOString() };
	milestoneStore.upsert(record);
	return { record, reused: false };
}

export function removeCustomMilestone(id: string, now = new Date()): boolean {
	return milestoneStore.remove(id, now);
}

/** Whether a model is configured for the custom mapping. */
export function customMilestonesAvailable(): boolean {
	const models = readSettings()?.models;
	return !!(models?.cheap?.model || models?.strong?.model);
}
