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
import { ensureReadmes } from "../store/corpus.ts";
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
	/** "Something else", in the learner's own words (onboarding). */
	note?: string;
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
	// The common words at the level, slovak.wiki's curated beginner set
	// (greetings, question words, pronouns) and place names (Bratislava is
	// not vocabulary to learn) count as known at every level.
	if (lexicon) for (const e of lexicon.entries) if ((e.rank !== undefined && e.rank <= bound) || e.origin === "curated" || e.cat === "Places") known.add(e.slug);
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
		note: goal.purposeNote?.trim() || undefined,
	};
}

// ─── Glossing ───────────────────────────────────────────────────────────────

/**
 * Stems for the 4,000-odd entries the dictionary lists no forms for
 * (most nouns, many verbs): the lemma's letters without its ending, so
 * "kávu" finds káva and "pekného" finds pekný. Built once per lexicon.
 * Keyed by the folded stem's first four letters to keep the scan short.
 */
interface Stemmed {
	entry: LexiconEntry;
	/** The folded lemma without its ending ("kava" → "kav", "robit" → "robi"). */
	stem: string;
	folded: string;
}
const stemIndex = new WeakMap<Lexicon, Map<string, Stemmed[]>>();

/** The stems a lemma's forms can start with: the infinitive without -ť
 *  (robiť → robi-), a noun or adjective without its final vowel (káva →
 *  káv-, pekný → pekn-), and, for a lemma ending in consonant + e/o +
 *  consonant, the same without that fleeting vowel (cukor → cukr-,
 *  kaviareň → kaviarn-, začiatok → začiatk-). */
function stemsOf(folded: string, infinitive: boolean): string[] {
	const out = new Set<string>();
	if (infinitive && folded.length > 3) out.add(folded.slice(0, -1));
	else {
		const bare = folded.replace(/[aeiouy]$/, "");
		if (bare.length >= 2) out.add(bare);
		// The fleeting vowel: kaviareň → kaviarn-e, cukor → cukr-u, pes → ps-a.
		const m = /^(.*[^aeiouy])[eo]([^aeiouy])$/.exec(folded);
		if (m) out.add(m[1]! + m[2]!);
	}
	if (out.size === 0) out.add(folded);
	return [...out];
}

/** Endings a Slovak noun, adjective or verb form can carry after its stem
 *  (folded). A leftover outside this list is not a form of the stem. */
const ENDINGS = new Set(
	"|a|u|e|o|y|i|om|ou|am|ach|iach|och|ov|mi|ami|ia|ie|iu|eho|emu|ej|ych|ym|ymi|ych|l|la|lo|li|m|s|me|te|ju|u|em|es|eme|ete|im|is|ime|ite|aju|ia|ej|ov|ovi|ove|ovia|ami|ou|eni|ena|eny|eno|eniu|ene|eni|ani|ana|any|ano|ut|ute|uc|at|ajte|ite|ite|uj|ujem|ujes|uje|ujeme|ujete|uju|il|ila|ilo|ili|al|ala|alo|ali|el|ela|elo|eli|ol|ola|olo|oli|t|ti|ice|ica|icu|ici|iciach|icou|ic|iek|iam|iach|ami|ov|ou|ami".split("|"),
);

function stems(lexicon: Lexicon): Map<string, Stemmed[]> {
	let idx = stemIndex.get(lexicon);
	if (idx) return idx;
	idx = new Map();
	for (const entry of lexicon.entries) {
		if (/\s/.test(entry.sk)) continue; // phrases are matched whole, by form
		const folded = foldDiacritics(entry.sk.toLocaleLowerCase(tag()));
		for (const stem of stemsOf(folded, entry.sk.endsWith("ť"))) {
			const key = stem.slice(0, 2);
			const list = idx.get(key) ?? [];
			list.push({ entry, stem, folded });
			idx.set(key, list);
		}
	}
	stemIndex.set(lexicon, idx);
	return idx;
}

/** A form's entry by stem: the longest stem that starts the folded form,
 *  with at most four letters of ending left over; among ties the commonest
 *  word. Short forms (under four letters) are not guessed at. */
function byStem(lexicon: Lexicon, lower: string, folded: string, known: Set<string>): LexiconEntry | undefined {
	if (folded.length < 3) return undefined;
	const candidates = stems(lexicon).get(folded.slice(0, 2)) ?? [];
	const sharedPrefix = (a: string, b: string) => {
		let i = 0;
		while (i < a.length && i < b.length && a[i] === b[i]) i++;
		return i;
	};
	// Longest stem (the most specific lemma) first; then the lemma whose
	// letters WITH diacritics match furthest (chýba → chýbať, not chyba);
	// then a known word; then the commoner one.
	const score = (s: Stemmed) => [s.stem.length, sharedPrefix(lower, s.entry.sk.toLocaleLowerCase(tag())), known.has(s.entry.slug) ? 1 : 0, -(s.entry.rank ?? 1e9)];
	let best: Stemmed | undefined;
	let bestScore: number[] = [];
	for (const s of candidates) {
		// A two-letter stem is only the fleeting-vowel form of a three-letter
		// word (pes → psa, deň → dňa), and only with a short ending.
		const minStem = s.folded.length <= 3 ? 2 : 3;
		const rest = folded.slice(s.stem.length);
		if (s.stem.length < minStem || !folded.startsWith(s.stem) || rest.length > (s.stem.length < 3 ? 3 : 5) || !ENDINGS.has(rest)) continue;
		const sc = score(s);
		if (!best || sc.some((v, i) => v !== bestScore[i]) && sc.findIndex((v, i) => v !== bestScore[i]) >= 0 && sc[sc.findIndex((v, i) => v !== bestScore[i])]! > bestScore[sc.findIndex((v, i) => v !== bestScore[i])]!) {
			best = s;
			bestScore = sc;
		}
	}
	return best?.entry;
}

/** The dictionary entry a surface form most likely belongs to: an exact
 *  form match first (the commonest word when several share it, a known
 *  word before an unknown one), then the same letters without diacritics,
 *  then the stem heuristic for entries without a form list. */
export function resolveWord(lexicon: Lexicon, form: string, known: Set<string>, opts: { stem?: boolean } = {}): LexiconEntry | undefined {
	const lower = form.toLocaleLowerCase(tag());
	const pick = (list: LexiconEntry[] | undefined) => {
		if (!list?.length) return undefined;
		return [...list].sort((a, b) => Number(known.has(b.slug)) - Number(known.has(a.slug)) || (a.rank ?? 1e9) - (b.rank ?? 1e9))[0];
	};
	const folded = foldDiacritics(lower);
	const exact = pick(lexicon.byForm.get(lower));
	if (exact) return exact;
	// Without diacritics two words can collide (chýba / chyba): the one
	// whose own letters match the form furthest wins.
	const loose = pick(lexicon.byFolded.get(folded));
	const stemmed = opts.stem === false ? undefined : byStem(lexicon, lower, folded, known);
	if (loose && stemmed && stemmed !== loose) {
		const shared = (a: string, b: string) => {
			let i = 0;
			while (i < a.length && i < b.length && a[i] === b[i]) i++;
			return i;
		};
		return shared(lower, stemmed.sk.toLocaleLowerCase(tag())) > shared(lower, loose.sk.toLocaleLowerCase(tag())) ? stemmed : loose;
	}
	return loose ?? stemmed;
}

/** Tokenize one sentence and gloss every word. A word the dictionary
 *  lacks keeps the story's own gloss when the model introduced it. */
/** The series cast: never vocabulary, whatever the dictionary says. */
export const STORY_NAMES: ReadonlySet<string> = new Set(["robo"]);

/** The proper names in a text: capitalised words inside a sentence (not
 *  its first word) that no dictionary form claims — Zuzka, Petržalka. A
 *  sentence that starts with one of them is then read the same way. */
export function storyNames(sentences: readonly { sk: string }[], lexicon: Lexicon | null): Set<string> {
	const names = new Set(STORY_NAMES);
	for (const s of sentences) {
		let first = true;
		for (const t of tokenize(s.sk)) {
			if (!t.word) continue;
			const lower = t.text.toLocaleLowerCase(tag());
			const capital = t.text.charAt(0) !== lower.charAt(0);
			if (!first && capital && !/^\p{N}/u.test(t.text) && !lexicon?.byForm.get(lower)?.length) names.add(foldDiacritics(lower));
			first = false;
		}
	}
	return names;
}

export function glossSentence(sk: string, en: string, lexicon: Lexicon | null, known: Set<string>, newWords: readonly StoryWord[], names: ReadonlySet<string> = STORY_NAMES): StorySentence {
	const fresh = new Map(newWords.map((w) => [foldDiacritics(w.lemma.toLocaleLowerCase(tag())), w]));
	let seenWord = false;
	const tokens: StoryToken[] = tokenize(sk).map((t) => {
		if (!t.word) return { text: t.text, word: false };
		const token: StoryToken = { text: t.text, word: true };
		const first = !seenWord;
		seenWord = true;
		// Digits are not words to gloss.
		if (/^\p{N}+$/u.test(t.text)) return token;
		const capital = t.text.charAt(0) !== t.text.charAt(0).toLocaleLowerCase(tag());
		const name = capital && (names.has(foldDiacritics(t.text.toLocaleLowerCase(tag()))) || !first);
		// A capitalised word inside the sentence, or one the text showed to
		// be a name (Robo, Zuzka, Petržalka), is only claimed by a listed
		// dictionary form, never by a stem guess.
		const entry = lexicon ? resolveWord(lexicon, t.text, known, { stem: !name }) : undefined;
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
		// A proper name is not fresh vocabulary; an unknown word is.
		if (!name) token.fresh = true;
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
		// "Something else" is a note in the learner's words; the brief carries
		// it, the setting falls back to everyday life.
		other: [],
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
		k.note ? `In their own words: "${k.note.replace(/\s+/g, " ").slice(0, 300)}". Let the setting serve this when it can.` : "",
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
	const names = storyNames(d.sentences, lexicon);
	const sentences = d.sentences.map((s) => glossSentence(s.sk, s.en, lexicon, k.known, newWords, names));
	// Coverage counts the words the model introduced ON PURPOSE as taught,
	// not as unknown: they are the i+1. Every other fresh word is a stray.
	const coverage = knownCoverage(sentences, newWords);
	// A stray the dictionary knows is still a word met and glossed: on the
	// list after the deliberate ones, so it is queued for review too.
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
		coverage: Math.round(coverage * 1000) / 1000,
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
		const d1 = await draft(engine, brief.prompt, usage);
		let first = assembleStory(d1, brief, k, lexicon, usage, 1, now);
		if (first.coverage < COVERAGE_FLOOR) {
			// Too many stray unknown words: once more, naming the ones to drop.
			const declared = new Set(d1.newWords.map((w) => foldDiacritics(w.sk.toLocaleLowerCase(tag()))));
			const stray = (t: StoryToken) => t.fresh && !declared.has(foldDiacritics((t.lemma ?? t.text).toLocaleLowerCase(tag())));
			const hard = [...new Set(first.sentences.flatMap((s) => s.tokens).filter(stray).map((t) => t.lemma ?? t.text))].slice(0, 30);
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
		ensureReadmes();
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
