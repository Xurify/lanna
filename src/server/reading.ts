/**
 * Reading service (LangHarness, 2026-10-28) — behind /read and /api/read.
 * Writes graded episodes of an ongoing story at the learner's level on the
 * cheap model slot, glosses every word against the lexicon, keeps every
 * episode on disk (src/store/stories.ts), and records each reading: the
 * comprehension score, the words tapped, the words sent to review, the
 * XP and the minutes.
 *
 * The brief the model gets is built from what the app already knows:
 *   - the level and chapter the learner is working in (curriculum state),
 *   - the words they have met: the review deck and the word units with
 *     lessons behind them, plus the common words at the level,
 *   - the grammar held (units done), so the text uses it and nothing
 *     beyond it,
 *   - the setting, rotated through what Slovak is for (the profile's
 *     purposes), so an episode about the market comes to someone who
 *     picked daily life, and one about a meeting to someone who picked
 *     work,
 *   - the recaps of the last episodes, so people and places come back.
 *
 * After generation the text is measured (src/core/reading.ts knownCoverage):
 * a draft under the coverage floor is written again once, with the fresh
 * words it used named as the ones to drop. The second draft is kept
 * whatever its coverage — an episode a little hard beats no episode —
 * and the number of drafts is on the record.
 */

import { ACTIVE_PROFILE } from "../../config.ts";
import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import { piEngineForSpec, type PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import type { Usage } from "@earendil-works/pi-ai";
import { curriculumState, CHAPTERS, STAGES, type Cefr } from "../core/curriculum.ts";
import { foldDiacritics, LANGUAGES } from "../core/language.ts";
import { UNITS } from "../core/lesson.ts";
import { purposeInfo, type Purpose } from "../core/onboarding.ts";
import {
	COVERAGE_FLOOR,
	knownCoverage,
	gradeAnswers,
	KNOWN_RANK,
	NEW_WORDS_MAX,
	parseStoryDraft,
	QUESTIONS_PER_STORY,
	readXp,
	STORY_LENGTH,
	storyId,
	tokenize,
	type LibraryEntry,
	type ReadingState,
	type StoryIndexEntry,
	type ReadLogEntry,
	type StoryDraft,
	type StoryRecord,
	type StorySentence,
	type StoryToken,
	type StoryUsage,
	type StoryWord,
} from "../core/reading.ts";
import { dayKey, type LexiconEntry } from "../core/review.ts";
import { DEFAULT_GOAL, progressStore } from "../store/progress.ts";
import { reviewStore } from "../store/review.ts";
import { readSettings } from "../store/settings.ts";
import { storyStore } from "../store/stories.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { enqueueWords } from "./review.ts";

export const STORY_SERIES = "robo";

const tag = () => LANGUAGES[ACTIVE_PROFILE].tag;
const code = () => LANGUAGES[ACTIVE_PROFILE].code;

// ─── What the learner knows ─────────────────────────────────────────────────

export interface KnownWords {
	level: Cefr;
	chapter: string;
	chapterTitle: string;
	/** Lexicon slugs the learner has met: the deck, the word units with
	 *  lessons behind them. */
	met: Set<string>;
	/** Everything that counts as known for the coverage estimate: `met`
	 *  plus the common words at the level (rank ≤ KNOWN_RANK). */
	known: Set<string>;
	/** Lemmas to hand the model as "use these", most useful first. */
	sample: string[];
	/** Grammar units held (titles), for the brief. */
	grammar: string[];
	/** Units with lessons behind them but not yet held: the i+1 grammar. */
	practising: string[];
	purposes: Purpose[];
}

export function knownWords(lexicon: Lexicon | null = loadLexicon()): KnownWords {
	const p = progressStore.read();
	const goal = p.goal ?? DEFAULT_GOAL;
	const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	const chapter = CHAPTERS.find((c) => c.id === state.current);
	const met = new Set<string>();
	const sample: string[] = [];
	// The deck: every word the learner has been asked about. Stable words
	// first in the sample — they are the ones that read as "known".
	const cards = Object.values(reviewStore.readCards()).filter((c) => !c.suspended);
	cards.sort((a, b) => (b.memory?.stability ?? 0) - (a.memory?.stability ?? 0));
	for (const c of cards) {
		met.add(c.slug);
		sample.push(c.lemma);
	}
	// Word units with a lesson behind them: their clusters' lemmas.
	for (const u of UNITS) {
		if (u.kind !== "words" || (p.units[u.id]?.lessons ?? 0) === 0) continue;
		for (const lemma of u.lemmas ?? []) {
			const entries = lexicon?.byForm.get(lemma.toLocaleLowerCase(tag())) ?? [];
			for (const e of entries) met.add(e.slug);
			if (!sample.includes(lemma)) sample.push(lemma);
		}
	}
	const known = new Set(met);
	const bound = KNOWN_RANK[state.level];
	if (lexicon) for (const e of lexicon.entries) if (e.rank !== undefined && e.rank <= bound) known.add(e.slug);
	const all = state.chapters.flatMap((c) => c.units);
	const grammar = all.filter((u) => (u.kind === "drill" || u.kind === "tutor") && (u.status === "done" || u.status === "skipped")).map((u) => u.title);
	const practising = all.filter((u) => u.kind === "drill" && u.status === "started").map((u) => u.title);
	return {
		level: state.level,
		chapter: state.current,
		chapterTitle: chapter?.title ?? state.current,
		met,
		known,
		sample: sample.slice(0, 160),
		grammar,
		practising,
		purposes: goal.purposes ?? [],
	};
}

// ─── Glossing ───────────────────────────────────────────────────────────────

/** The dictionary entry a surface form most likely belongs to: an exact
 *  form match first (the commonest word when several share it, a known
 *  word before an unknown one), then the same letters without diacritics. */
export function resolveWord(lexicon: Lexicon, form: string, known: Set<string>): LexiconEntry | undefined {
	const lower = form.toLocaleLowerCase(tag());
	const pick = (list: LexiconEntry[] | undefined) => {
		if (!list?.length) return undefined;
		return [...list].sort((a, b) => Number(known.has(b.slug)) - Number(known.has(a.slug)) || (a.rank ?? 1e9) - (b.rank ?? 1e9))[0];
	};
	return pick(lexicon.byForm.get(lower)) ?? pick(lexicon.byFolded.get(foldDiacritics(lower)));
}

/** Tokenize one sentence and gloss every word. A word the dictionary
 *  lacks keeps the story's own gloss when the model introduced it. */
export function glossSentence(sk: string, en: string, lexicon: Lexicon | null, known: Set<string>, newWords: readonly StoryWord[]): StorySentence {
	const fresh = new Map(newWords.map((w) => [foldDiacritics(w.lemma.toLocaleLowerCase(tag())), w]));
	const tokens: StoryToken[] = tokenize(sk).map((t) => {
		if (!t.word) return { text: t.text, word: false };
		const token: StoryToken = { text: t.text, word: true };
		// Digits are not words to gloss.
		if (/^\p{N}+$/u.test(t.text)) return token;
		const entry = lexicon ? resolveWord(lexicon, t.text, known) : undefined;
		if (entry) {
			token.slug = entry.slug;
			token.lemma = entry.sk;
			token.gloss = entry.en;
			token.cat = entry.cat;
			if (entry.gender) token.gender = entry.gender;
			if (!known.has(entry.slug)) token.fresh = true;
			return token;
		}
		const introduced = fresh.get(foldDiacritics(t.text.toLocaleLowerCase(tag())));
		if (introduced) {
			token.lemma = introduced.lemma;
			token.gloss = introduced.gloss;
		}
		// Proper names (capitalised, mid-sentence or not) are not fresh
		// vocabulary; an unknown lowercase word is.
		const capital = t.text.charAt(0) !== t.text.charAt(0).toLocaleLowerCase(tag());
		if (!capital) token.fresh = true;
		return token;
	});
	return { sk, en, tokens };
}

// ─── The brief ──────────────────────────────────────────────────────────────

const SYSTEM = `You write graded Slovak reading texts for one learner inside a language app. You answer with ONE JSON object and nothing else: no prose, no code fences.

The text is an episode of an ongoing light story about Robo, a young man who has recently moved to Bratislava, and the people around him. Keep the same characters and places across episodes (the brief gives the earlier recaps). Plain, warm, a little funny; everyday life, nothing violent or sad.

Rules that matter more than the plot:
- Write at the learner's level and ONLY with the grammar listed as held. Simple main clauses at A1; a subordinate clause with "že", "keď", "lebo" from A2.
- Use the learner's known words. About 97 of every 100 running words must be words a learner at this level knows; the brief gives the known words to lean on. Repeat words rather than reach for new ones.
- Introduce at most the number of new words the brief allows. Each new word appears at least three times in the episode, in different sentences, so it can be learnt from context. List every new word under newWords with its dictionary form and a short English gloss.
- Correct Slovak spelling with all diacritics. Check case endings and verb forms; a wrong form teaches a wrong form.
- One sentence per array item; each 5 to 14 words; the whole episode within the sentence count the brief gives.
- "en" is a plain English translation of the sentence.
- Three comprehension questions in simple Slovak about what happened, each with three short options in Slovak and the index (0, 1 or 2) of the right one. Questions test meaning, never grammar.
- "recap" is one English sentence saying what happened, for the next episode's brief.
- "title" is two to five Slovak words.

Shape: {"title": "...", "sentences": [{"sk": "...", "en": "..."}], "newWords": [{"sk": "lemma", "en": "gloss"}], "questions": [{"q": "...", "options": ["...", "...", "..."], "answer": 0}], "recap": "..."}`;

export interface StoryBrief {
	episode: number;
	theme: string;
	prompt: string;
}

/** The setting for an episode: rotate through what Slovak is for, with
 *  everyday life when nothing was picked. */
export function episodeTheme(purposes: readonly Purpose[], episode: number): string {
	const SETTINGS: Record<Purpose, string[]> = {
		family: ["a Sunday lunch with his girlfriend's family", "a phone call with his mother", "a friend's birthday at home"],
		daily: ["a café in the old town", "the market at Miletičova", "a tram ride across the city", "a visit to the doctor", "finding a flat"],
		work: ["his first week at a new job", "a meeting that goes wrong", "lunch with colleagues", "writing an email to the boss"],
		offices: ["the foreigners' police office", "a form that has to be filled in", "a phone call to the bank"],
		media: ["a Slovak film at the cinema", "the evening news on TV", "a podcast about Bratislava"],
		exam: ["a language course in the evening", "a study day before an exam"],
		curious: ["a trip to the castle", "a day in the Tatras", "a Slovak word that puzzles him"],
	};
	const pool = (purposes.length ? purposes : (["daily"] as Purpose[])).flatMap((p) => SETTINGS[p] ?? []);
	if (pool.length === 0) return "a day in Bratislava";
	return pool[(episode - 1) % pool.length]!;
}

export function storyBrief(k: KnownWords, previous: readonly StoryIndexEntry[], recaps: readonly string[], now = new Date()): StoryBrief {
	const episode = previous.length + 1;
	const theme = episodeTheme(k.purposes, episode);
	const len = STORY_LENGTH[k.level];
	const stage = STAGES.find((s) => s.level === k.level);
	const lines = [
		`Episode ${episode}. Setting: ${theme}.`,
		`Learner level: ${k.level}${stage ? ` (${stage.title})` : ""}, working in the chapter "${k.chapterTitle}".`,
		`Length: ${len.min} to ${len.max} sentences. New words allowed: at most ${NEW_WORDS_MAX[k.level]}.`,
		k.grammar.length ? `Grammar held (use it freely): ${k.grammar.join("; ")}.` : "Grammar held: only the present tense of common verbs, nouns in the nominative and the accusative after common verbs, and short questions.",
		k.practising.length ? `Grammar being practised now (use it a few times, correctly): ${k.practising.join("; ")}.` : "",
		k.sample.length ? `Known words to lean on: ${k.sample.join(", ")}.` : "The learner is at the very start: use only the most common words (greetings, family, food and drink, the home, going places, numbers to ten).",
		k.purposes.length ? `The learner is learning Slovak for: ${k.purposes.map((p) => purposeInfo(p).title.toLowerCase()).join(", ")}.` : "",
		recaps.length ? `Earlier episodes, oldest first:\n${recaps.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}` : "This is the first episode: introduce Robo and one other person.",
		`Today is ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}; the season may show.`,
	].filter(Boolean);
	return { episode, theme, prompt: lines.join("\n") };
}

// ─── Generation ─────────────────────────────────────────────────────────────

export interface GenerateOptions {
	/** Test seam: a scripted engine replaces the cheap slot's. */
	engine?: PiEngine;
	now?: Date;
	/** The model's label for the record ("provider:id"); the engine's when absent. */
	model?: string;
}

/** The cheap slot (stories are reading input, not teaching), else the
 *  strong one; null when no model is configured. */
export function storyEngine(): { engine: PiEngine; model: string } | null {
	const models = readSettings()?.models;
	const slot = models?.cheap?.model ? models.cheap : models?.strong?.model ? models.strong : null;
	if (!slot?.model) return null;
	const spec = { provider: slot.model.provider, id: slot.model.id, thinkingLevel: slot.thinkingLevel };
	return { engine: piEngineForSpec(spec, true), model: `${spec.provider}:${spec.id}` };
}

function stepOf(u: Usage): StoryUsage["steps"][number] {
	return {
		inputTokens: u.input,
		outputTokens: u.output,
		cacheReadTokens: u.cacheRead,
		cacheWriteTokens: u.cacheWrite,
		cacheWrite1hTokens: u.cacheWrite1h ?? 0,
		reasoningTokens: u.reasoning,
	};
}

async function draft(engine: PiEngine, prompt: string, usage: StoryUsage, chatId?: string): Promise<StoryDraft> {
	const { text } = await runSubagent([], {
		role: "researcher",
		engine,
		systemPrompt: SYSTEM,
		prompt,
		maxTurns: 1,
		onUsage: (u) => usage.steps.push(stepOf(u)),
		chatId,
	});
	return parseStoryDraft(text);
}

/** Turn a draft into the record: gloss, measure, number. */
export function assembleStory(d: StoryDraft, brief: StoryBrief, k: KnownWords, lexicon: Lexicon | null, usage: StoryUsage, drafts: number, now: Date): StoryRecord {
	const newWords: StoryWord[] = d.newWords.map((w) => {
		const entry = lexicon ? resolveWord(lexicon, w.sk, k.known) : undefined;
		return entry ? { lemma: entry.sk, gloss: entry.en, slug: entry.slug } : { lemma: w.sk, gloss: w.en };
	});
	const sentences = d.sentences.map((s) => glossSentence(s.sk, s.en, lexicon, k.known, newWords));
	// A word the model introduced on purpose is fresh by design; make sure
	// it is on the list even when the dictionary knows it, so it is queued.
	for (const t of sentences.flatMap((s) => s.tokens)) {
		if (t.fresh && t.slug && !newWords.some((w) => w.slug === t.slug)) newWords.push({ lemma: t.lemma!, gloss: t.gloss ?? "", slug: t.slug });
	}
	const wordCount = sentences.reduce((n, s) => n + s.tokens.filter((t) => t.word).length, 0);
	return {
		id: storyId(brief.episode, d.title),
		lang: code(),
		series: STORY_SERIES,
		episode: brief.episode,
		title: d.title,
		level: k.level,
		chapter: k.chapter,
		theme: brief.theme,
		createdAt: now.toISOString(),
		sentences,
		questions: d.questions.slice(0, QUESTIONS_PER_STORY),
		newWords: newWords.slice(0, 12),
		recap: d.recap || d.sentences.map((s) => s.en).join(" ").slice(0, 300),
		coverage: Math.round(knownCoverage(sentences) * 1000) / 1000,
		wordCount,
		usage,
		drafts,
	};
}

let inFlight: Promise<StoryRecord> | null = null;

/** Write the next episode and keep it. One generation at a time: a second
 *  caller waits for the first. */
export function generateStory(opts: GenerateOptions = {}): Promise<StoryRecord> {
	if (inFlight) return inFlight;
	inFlight = (async () => {
		const now = opts.now ?? new Date();
		const lexicon = loadLexicon();
		const k = knownWords(lexicon);
		const previous = storyStore.list().filter((s) => s.series === STORY_SERIES);
		const recaps = previous
			.slice(-4)
			.map((s) => storyStore.get(s.id)?.recap)
			.filter((r): r is string => !!r);
		const brief = storyBrief(k, previous, recaps, now);
		let engine = opts.engine;
		let model = opts.model;
		if (!engine) {
			const resolved = storyEngine();
			if (!resolved) throw new Error("No model is configured. Set the cheap slot in Settings → Models.");
			engine = resolved.engine;
			model ??= resolved.model;
		}
		const usage: StoryUsage = { model: model ?? "faux:faux", steps: [] };
		let first = assembleStory(await draft(engine, brief.prompt, usage), brief, k, lexicon, usage, 1, now);
		if (first.coverage < COVERAGE_FLOOR) {
			// Too many unknown words: once more, naming the ones to drop.
			const hard = [...new Set(first.sentences.flatMap((s) => s.tokens).filter((t) => t.fresh && !first.newWords.some((w) => w.lemma === t.lemma)).map((t) => t.lemma ?? t.text))].slice(0, 30);
			const again = `${brief.prompt}\n\nYour first draft used too many words the learner does not know (${Math.round((1 - first.coverage) * 100)} in 100). Write the episode again with simpler, more common words. Avoid these in particular: ${hard.join(", ")}. Keep the same plot.`;
			try {
				const second = assembleStory(await draft(engine, again, usage), brief, k, lexicon, usage, 2, now);
				if (second.coverage >= first.coverage) first = second;
				else first = { ...first, usage, drafts: 2 };
			} catch {
				first = { ...first, usage, drafts: 2 };
			}
		}
		// Two episodes on the same day cannot share an id.
		if (storyStore.get(first.id)) first = { ...first, id: `${first.id}-${now.getTime().toString(36).slice(-4)}` };
		storyStore.put(first);
		return first;
	})();
	return inFlight.finally(() => {
		inFlight = null;
	});
}

export function generating(): boolean {
	return inFlight !== null;
}

// ─── What to read ───────────────────────────────────────────────────────────

export function library(): LibraryEntry[] {
	const reads = storyStore.reads();
	return storyStore.list().map((s) => {
		const mine = reads.filter((r) => r.storyId === s.id);
		const last = mine[mine.length - 1];
		return { ...s, reads: mine.length, ...(last ? { lastReadAt: last.at, lastScore: { correct: last.correct, total: last.total } } : {}) };
	});
}

export function readingState(tz?: number, now = new Date()): ReadingState {
	const lib = library();
	const unread = [...lib].reverse().find((s) => s.reads === 0);
	const today = dayKey(now, tz);
	const readToday = storyStore.reads().filter((r) => r.day === today).length;
	return {
		current: unread ? storyStore.get(unread.id) : null,
		library: lib,
		canWrite: storyEngine() !== null,
		generating: generating(),
		readToday,
	};
}

/** The story to read: the newest unread episode, else a new one. */
export async function nextStory(opts: GenerateOptions = {}): Promise<StoryRecord> {
	const unread = [...library()].reverse().find((s) => s.reads === 0);
	if (unread) {
		const story = storyStore.get(unread.id);
		if (story) return story;
	}
	return generateStory(opts);
}

// ─── Recording a reading ────────────────────────────────────────────────────

export interface ReadResultInput {
	storyId: string;
	answers: number[];
	/** Slugs tapped for a gloss. */
	tapped: string[];
	ms?: number;
	tz?: number;
}

export interface ReadOutcome {
	xp: number;
	correct: number;
	total: number;
	/** Words now in the review deck because of this reading. */
	queued: string[];
	reread: boolean;
	summary: ProgressSummary;
}

/** A finished reading: the check is graded, the new words and the words
 *  looked up go to the review deck (the next meetings, spaced), the day
 *  gets its XP and minutes, and the reading goes to the log. */
export function recordRead(input: ReadResultInput, now = new Date()): ReadOutcome {
	const story = storyStore.get(input.storyId);
	if (!story) throw new Error(`unknown story ${input.storyId}`);
	const reread = storyStore.reads().some((r) => r.storyId === story.id);
	const { correct, total } = gradeAnswers(story.questions, input.answers);
	const xp = readXp(story.sentences.length, correct, reread);
	const slugs = [...new Set([...story.newWords.map((w) => w.slug).filter((s): s is string => !!s), ...input.tapped.filter((s) => /^[a-z0-9-]+$/.test(s))])];
	const queued = slugs.length ? enqueueWords(slugs, now) : [];
	const p = progressStore.read();
	const day = dayKey(now, input.tz);
	const d = (p.days[day] ??= { xp: 0, lessons: 0, reps: 0, reviews: 0 });
	d.reads = (d.reads ?? 0) + 1;
	d.xp += xp;
	if (input.ms && Number.isFinite(input.ms)) d.minutes = (d.minutes ?? 0) + Math.min(20, input.ms / 60_000);
	p.xp += xp;
	progressStore.write(p);
	const entry: ReadLogEntry = {
		storyId: story.id,
		at: now.toISOString(),
		day,
		...(input.ms ? { ms: input.ms } : {}),
		correct,
		total,
		answers: story.questions.map((_, i) => (typeof input.answers[i] === "number" ? input.answers[i]! : -1)),
		tapped: input.tapped,
		queued,
		xp,
	};
	storyStore.appendRead(entry);
	return { xp, correct, total, queued, reread, summary: progressSummary(input.tz, now) };
}
