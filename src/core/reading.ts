/**
 * Reading (LangHarness, 2026-10-28; Xurify: "do we have a reading
 * part/task in our app? Where we could read a story or whatnot?") — the
 * pure model behind the Read task: graded stories at the learner's level,
 * every word tappable for its meaning and form, every sentence spoken, a
 * light comprehension check, and the words looked up flowing into the
 * review deck. Browser-safe: types, the tokenizer, the grading, the
 * length and coverage rules. The generation and the lexicon lookups live
 * in src/server/reading.ts; the files in src/store/stories.ts.
 *
 * Why this shape (the research the Read task is built on):
 *   - Extensive reading works when the text is EASY: about 95–98% of the
 *     running words known (Hu & Nation 2000; Nation 2006). Below that the
 *     learner decodes instead of reads and picks up nothing incidentally.
 *     So the story is written against the learner's own known words, the
 *     coverage is measured after generation (COVERAGE_FLOOR), and a text
 *     that misses is written again with a tighter brief.
 *   - New words stick with repeated meetings in context (Webb 2007 puts
 *     the useful range at ~10). Each episode brings at most a few new
 *     words, uses each several times, and sends them to the spaced deck,
 *     where the next meetings are scheduled.
 *   - A gloss on demand (tap the word) keeps the eyes on the text (Ko
 *     2012: glossed reading beats dictionary look-up for both
 *     comprehension and retention). The gloss is the lexicon's (the same
 *     slovak.wiki forms the lessons grade against), never the model's
 *     guess, when the word is in the dictionary.
 *   - Reading while listening (sentence audio, Play all) lifts
 *     comprehension and reading fluency for learners whose decoding is
 *     slower than their listening (Chang & Millett 2015).
 *   - The comprehension check is light and meaning-only: three questions
 *     in Slovak, tapped. Grading grammar in a reading check teaches
 *     learners to avoid reading.
 */

import type { Cefr } from "./curriculum.ts";

// ─── The story record ───────────────────────────────────────────────────────

/** One piece of a sentence as rendered: a word (tappable, glossed when
 *  the dictionary knows it) or the space/punctuation between words. */
export interface StoryToken {
	/** The exact text, as in the sentence. */
	text: string;
	/** True for a word; false for whitespace and punctuation. */
	word: boolean;
	/** Dictionary match (src/core/review.ts LexiconEntry.slug), when any. */
	slug?: string;
	/** The dictionary form ("kávu" → "káva"). */
	lemma?: string;
	/** English meaning, from the dictionary (or the story's own gloss for a
	 *  word the dictionary lacks). */
	gloss?: string;
	/** Part of speech / category ("Nouns", "Verbs", …) and gender. */
	cat?: string;
	gender?: string;
	/** A word the learner has not met (not in the deck, not in a unit done,
	 *  not in the common words at this level): the i+1 of the episode. */
	fresh?: boolean;
	/** Counted as known only because the learner's level is expected to know
	 *  it (Watch, and Read's word card): not in the deck, not in a finished unit. */
	assumed?: boolean;
}

export interface StorySentence {
	sk: string;
	en: string;
	tokens: StoryToken[];
	who?: string;
	startsParagraph?: boolean;
}

/** A person in the story. The voice is a TTS voice id chosen when the
 *  story is kept (src/server/voices.ts), stable for a recurring name. */
export interface StoryCharacter {
	name: string;
	gender: "f" | "m";
	age: "child" | "young" | "adult" | "old";
	voice?: string;
}

// ─── Genres ─────────────────────────────────────────────────────────────────

/** What kinds of text the shelf holds. Martin is the running series; the
 *  rest are stand-alone pieces so a learner meets the text types the CEFR
 *  describes for the level (messages and dialogues at A1, diary and
 *  tales at A2, news and interviews at B1, opinion and history at B2). */
export type StoryGenre = "robo" | "dialogue" | "message" | "diary" | "folk" | "travel" | "fable" | "news" | "interview" | "work" | "opinion" | "history" | "own";

interface GenreInfo {
	id: StoryGenre;
	label: string;
	from: Cefr;
	brief: string;
}

const STORY_GENRES: readonly GenreInfo[] = [
	{ id: "robo", label: "{series}", from: "A1", brief: "an episode of the running series (see the earlier recaps); mostly dialogue with a little narration" },
	{ id: "dialogue", label: "A conversation", from: "A1", brief: "a stand-alone conversation between two people in an everyday place (a shop, a bus, a kitchen, a reception desk); almost every line is speech, with one narrator line to set the scene" },
	{ id: "message", label: "Messages", from: "A1", brief: "an exchange of short text messages or a short email and its reply between two named people; each sentence is one message or one line of a message" },
	{ id: "diary", label: "A diary page", from: "A2", brief: "a diary entry written in the first person by a named person about one day; narration only" },
	{ id: "folk", label: "A folk tale", from: "A2", brief: "a {language} folk tale or legend retold simply; narration with a few lines of speech" },
	{ id: "travel", label: "A place in {country}", from: "A2", brief: "a short piece about a real town, region or custom in {country}, as a friendly guide would tell it; narration only" },
	{ id: "fable", label: "A fable", from: "A2", brief: "a short fable with animals and a one-line moral at the end; narration with lines of speech" },
	{ id: "news", label: "A news item", from: "B1", brief: "a short local news item in plain newspaper {language} about an everyday event (a new tram line, a festival, a lost dog found); one quoted person" },
	{ id: "interview", label: "An interview", from: "B1", brief: "a short interview: a named interviewer's questions and a named person's answers about their work or hobby" },
	{ id: "work", label: "At work", from: "B1", brief: "a scene at work (a meeting, a phone call with a client, an email thread) with two or three named colleagues; mostly speech" },
	{ id: "opinion", label: "An opinion piece", from: "B2", brief: "a short opinion column that argues one point about life in {country} and admits one counter-argument; narration only" },
	{ id: "history", label: "From history", from: "B2", brief: "a short piece about a person, place or event from the history of {country}, told as a story; narration with at most two lines of speech" },
	{ id: "own", label: "Your reading", from: "A1", brief: "" },
];

/** The names a genre's label and brief are filled with. */
interface StoryNames {
	/** The running series, from the language's story bible. */
	series: string;
	language: string;
	country: string;
}

/** Without a language at hand (a label in a list), the words stay general. */
const PLAIN_NAMES: StoryNames = { series: "The story", language: "local", country: "the country" };

export function genreInfo(id: string, names: StoryNames = PLAIN_NAMES): GenreInfo {
	const g = STORY_GENRES.find((x) => x.id === id) ?? STORY_GENRES[0]!;
	const fill = (t: string) => t.replace(/\{(series|language|country)\}/g, (_, k: keyof StoryNames) => names[k]);
	return { ...g, label: fill(g.label), brief: fill(g.brief) };
}

const LEVEL_ORDER: readonly Cefr[] = ["A1", "A2", "B1", "B2", "C1"];

function levelIndex(level: Cefr): number {
	return Math.max(0, LEVEL_ORDER.indexOf(level));
}

function genresAt(level: Cefr): GenreInfo[] {
	return STORY_GENRES.filter((g) => g.id !== "own" && levelIndex(g.from) <= levelIndex(level));
}

/** What a comprehension question asks for. The kinds grow with the
 *  level (QUESTION_PLAN): a beginner is asked what happened; an
 *  intermediate reader is asked why, what a word meant here and what a
 *  sentence said in other words; an advanced one what was implied and
 *  how someone felt. */
export type StoryQuestionKind = "recall" | "inference" | "vocab" | "paraphrase" | "attitude";

const STORY_QUESTION_KINDS: readonly StoryQuestionKind[] = ["recall", "inference", "vocab", "paraphrase", "attitude"];

/** How each kind is shown over the question, and what the model is told
 *  to write. */
export const QUESTION_KIND_INFO: Readonly<Record<StoryQuestionKind, { label: string; brief: string }>> = {
	recall: { label: "What happened?", brief: "a literal question about what happened (who, what, where, when) answered directly by the text" },
	inference: { label: "Between the lines", brief: "a question the text answers only indirectly (why someone did something, what will probably happen next, what a character wants)" },
	vocab: { label: "A word from the text", brief: "what one word or phrase from the text means IN THIS SENTENCE, with options that are other plausible meanings; quote the word in the question" },
	paraphrase: { label: "In other words", brief: "which option says the same as one sentence of the text in different words; the distractors change one detail" },
	attitude: { label: "How they feel", brief: "how a character feels or what their attitude or intention is, shown by what they say or do, never stated outright" },
};

/** The questions an episode gets at each level: how many, how many
 *  options each, and of which kinds in order. */
export const QUESTION_PLAN: Readonly<Record<Cefr, { count: number; options: number; kinds: readonly StoryQuestionKind[] }>> = {
	A1: { count: 3, options: 3, kinds: ["recall", "recall", "recall"] },
	A2: { count: 3, options: 3, kinds: ["recall", "recall", "inference"] },
	B1: { count: 4, options: 4, kinds: ["recall", "inference", "vocab", "paraphrase"] },
	B2: { count: 5, options: 4, kinds: ["inference", "vocab", "paraphrase", "attitude", "recall"] },
	C1: { count: 5, options: 4, kinds: ["inference", "attitude", "paraphrase", "vocab", "inference"] },
};

/** The most questions an episode can carry. */
const MAX_QUESTIONS = 5;

/** One comprehension question in Slovak: three or four options, one right. */
export interface StoryQuestion {
	q: string;
	options: string[];
	answer: number;
	kind?: StoryQuestionKind;
}

export interface StoryWord {
	/** The lemma as the dictionary (or the model) writes it. */
	lemma: string;
	gloss: string;
	slug?: string;
}

/** What the generation cost: the same accounting shape as a chat turn,
 *  priced at read time by the usage report. */
export interface StoryUsage {
	/** "provider:id" */
	model: string;
	steps: Array<{
		inputTokens: number | undefined;
		outputTokens: number | undefined;
		cacheReadTokens: number | undefined;
		cacheWriteTokens: number | undefined;
		cacheWrite1hTokens?: number;
		reasoningTokens: number | undefined;
	}>;
}

export interface StorySource {
	id: string;
	title: string;
	url?: string;
	site?: string;
	part: number;
	parts: number;
	difficulty?: ReadingDifficulty;
}

export interface SourceEntry {
	id: string;
	title: string;
	url?: string;
	site?: string;
	addedAt: string;
	parts: number;
	written: number;
	read: number;
	nextPart: number;
	nextStoryId?: string;
	finished: boolean;
	shortened: boolean;
	difficulty: ReadingDifficulty;
	level: Cefr;
	wordCount: number;
	preparing: boolean;
	truncated: boolean;
}

export interface StoryRecord {
	id: string;
	lang: string;
	series: string;
	episode: number;
	title: string;
	level: Cefr;
	chapter: string;
	theme: string;
	genre?: StoryGenre;
	topic?: string;
	cast?: StoryCharacter[];
	narratorVoice?: string;
	createdAt: string;
	sentences: StorySentence[];
	questions: StoryQuestion[];
	newWords: StoryWord[];
	recap: string;
	coverage: number;
	wordCount: number;
	usage: StoryUsage;
	drafts: number;
	source?: StorySource;
	original?: string;
	ruleIssues?: number;
}

export interface StoryIndexEntry {
	id: string;
	series: string;
	episode: number;
	title: string;
	level: Cefr;
	theme: string;
	chapter?: string;
	genre?: StoryGenre;
	topic?: string;
	createdAt: string;
	wordCount: number;
	coverage: number;
	newWords: string[];
	model: string;
	source?: StorySource;
}

export interface ReadLogEntry {
	storyId: string;
	at: string;
	day: string;
	ms?: number;
	correct: number;
	total: number;
	answers: number[];
	tapped: string[];
	queued: string[];
	xp: number;
}

export interface LibraryEntry extends StoryIndexEntry {
	reads: number;
	lastReadAt?: string;
	lastScore?: { correct: number; total: number };
}

export interface ReadingState {
	current: StoryRecord | null;
	library: LibraryEntry[];
	canWrite: boolean;
	generating: WritingProgress | null;
	readToday: number;
	sources: SourceEntry[];
	pick?: PickReason;
}

export interface WritingProgress {
	level: Cefr;
	genre: StoryGenre;
	topic?: string;
	startedAt: string;
	sentences: string[];
	wanted: boolean;
	title?: string;
}

export interface PickReason {
	score: number;
	coverage: number;
	line: string;
}

// ─── The shelf ──────────────────────────────────────────────────────────────

/** How many unread stories the shelf keeps ready at the learner's own
 *  level and at the levels either side of it. */
const SHELF_OWN = 3;
const SHELF_NEAR = 1;
/** The most stories written in one day for the shelf (the spend guard). */
export const SHELF_DAILY_CAP = 8;

/** Which (level, genre) to write next so the shelf stays stocked: the
 *  learner's level first until it holds SHELF_OWN unread stories, then one
 *  at the level below and one above; genres rotate so no level holds two
 *  unread stories of one kind, and series episodes stay in the mix. */
export function shelfNeeds(level: Cefr, unread: readonly { level: Cefr; genre?: StoryGenre }[], recentGenres: readonly StoryGenre[] = []): Array<{ level: Cefr; genre: StoryGenre }> {
	const li = levelIndex(level);
	const wants: Array<{ level: Cefr; want: number }> = [{ level, want: SHELF_OWN }];
	if (li > 0) wants.push({ level: LEVEL_ORDER[li - 1]!, want: SHELF_NEAR });
	if (li < LEVEL_ORDER.length - 1) wants.push({ level: LEVEL_ORDER[li + 1]!, want: SHELF_NEAR });
	const out: Array<{ level: Cefr; genre: StoryGenre }> = [];
	for (const w of wants) {
		const have = unread.filter((u) => u.level === w.level).map((u) => u.genre ?? "robo");
		const taken = new Set<StoryGenre>([...have, ...out.filter((o) => o.level === w.level).map((o) => o.genre)]);
		for (let n = have.length; n < w.want; n++) {
			const pool = genresAt(w.level).map((g) => g.id).filter((g) => !taken.has(g));
			// Martin first when the level has no episode waiting, then the
			// genre read least recently.
			const pick = pool.includes("robo") && !taken.has("robo") ? "robo" : [...pool].sort((a, b) => lastSeen(a, recentGenres) - lastSeen(b, recentGenres))[0];
			if (!pick) break;
			taken.add(pick);
			out.push({ level: w.level, genre: pick });
		}
	}
	return out;
}

function lastSeen(genre: StoryGenre, recent: readonly StoryGenre[]): number {
	const i = recent.lastIndexOf(genre);
	return i < 0 ? -1 : recent.length - i;
}

/** Share of a kept story's words the learner knows NOW (the known set
 *  grows; a story written for a level stays what it is). Words the story
 *  teaches on purpose count as known, as do names, numbers and grammar
 *  words. */
export function storyCoverage(story: Pick<StoryRecord, "sentences" | "newWords">, known: ReadonlySet<string>): number {
	const taught = new Set(story.newWords.map((w) => w.slug).filter((x): x is string => !!x));
	const words = wordTokens(story.sentences);
	if (words.length === 0) return 1;
	const ok = words.filter((t) => {
		if (t.slug) return known.has(t.slug) || taught.has(t.slug);
		if (t.cat === "Grammar") return true;
		return !t.fresh;
	}).length;
	return ok / words.length;
}

interface PickInput {
	level: Cefr;
	known: ReadonlySet<string>;
	/** Genres of the last readings, newest last. */
	recentGenres: readonly StoryGenre[];
	/** Topics of the last readings, newest last. */
	recentTopics: readonly string[];
	/** The chapter the learner is working in (the arc's story step):
	 *  its unread episodes come first, publication order (written order). */
	chapter?: string;
}

/** The plain score a story gets from the picker (coverage and level fit,
 *  variety against the last few readings, the series bonus). Shared by the
 *  normal best-fit pick and the chapter preference, which keeps the reason
 *  honest while returning the chapter's episode whatever its score. */
function fitScore(story: StoryRecord, input: PickInput): PickReason {
	const genre = story.genre ?? "robo";
	const coverage = storyCoverage(story, input.known);
	// 0.96 is the sweet spot; each 0.01 away costs 0.08, so 0.92 → 0.68 and 0.88 → 0.36.
	const fit = Math.max(0, 1 - Math.abs(coverage - 0.96) * 8);
	const dist = Math.abs(levelIndex(story.level) - levelIndex(input.level));
	const levelScore = dist === 0 ? 1 : dist === 1 ? 0.7 : 0.3;
	const recentG = input.recentGenres.slice(-2);
	const variety = (recentG.includes(genre) ? 0 : 0.15) + (story.topic && input.recentTopics.slice(-3).includes(story.topic) ? 0 : 0.1);
	const series = genre === "robo" ? 0.1 : 0;
	const score = Math.round((fit * 0.55 + levelScore * 0.25 + variety + series) * 100) / 100;
	const line = `${Math.round(coverage * 100)} of 100 words known · ${story.level} · ${genreInfo(genre).label}${recentG.includes(genre) ? " (read lately)" : ""}`;
	return { score, coverage, line };
}

export const SOURCE_WORDS_PER_PART: Record<Cefr, number> = { A1: 250, A2: 300, B1: 375, B2: 450, C1: 550 };
export const MAX_SOURCE_PARTS = 8;
export const MIN_SOURCE_WORDS = 40;
export const MAX_SOURCE_WORDS = 6000;
export const MAX_LINKS_PER_ADD = 20;
const UNSIMPLIFIED_WORDS_PER_PART = 200;

export const READING_DIFFICULTIES = ["level", "harder", "full"] as const;
export type ReadingDifficulty = (typeof READING_DIFFICULTIES)[number];

export function isReadingDifficulty(value: unknown): value is ReadingDifficulty {
	return (READING_DIFFICULTIES as readonly unknown[]).includes(value);
}

export function harderLevel(level: Cefr): Cefr {
	return LEVEL_ORDER[Math.min(levelIndex(level) + 1, LEVEL_ORDER.length - 1)]!;
}

export function sourceWordsPerPart(level: Cefr, difficulty: ReadingDifficulty = "level"): number {
	if (difficulty === "full") return UNSIMPLIFIED_WORDS_PER_PART;
	return SOURCE_WORDS_PER_PART[difficulty === "harder" ? harderLevel(level) : level];
}

function countWords(s: string): number {
	return s.trim().split(/\s+/).filter(Boolean).length;
}

function cutParagraph(para: string, target: number): string[] {
	if (countWords(para) <= target) return [para];
	const sentences = para.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
	if (sentences.length <= 1) return [para];
	const pieces: string[] = [];
	let current: string[] = [];
	let currentWords = 0;
	for (const s of sentences) {
		const words = countWords(s);
		if (current.length > 0 && currentWords + words > target) {
			pieces.push(current.join(" "));
			current = [s];
			currentWords = words;
		} else {
			current.push(s);
			currentWords += words;
		}
	}
	if (current.length > 0) pieces.push(current.join(" "));
	return pieces;
}

export function splitIntoSections(text: string, level: Cefr, difficulty: ReadingDifficulty = "level"): string[] {
	const paragraphs = text
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
	if (paragraphs.length === 0) return [];
	const totalWords = paragraphs.reduce((sum, p) => sum + countWords(p), 0);
	const target = Math.max(sourceWordsPerPart(level, difficulty), Math.ceil(totalWords / MAX_SOURCE_PARTS));
	const pieces = paragraphs.flatMap((p) => cutParagraph(p, target));

	const sections: string[][] = [];
	let curSection: string[] = [];
	let curWords = 0;
	for (const piece of pieces) {
		const w = countWords(piece);
		if (curSection.length > 0 && curWords + w > target * 1.15) {
			sections.push(curSection);
			curSection = [piece];
			curWords = w;
		} else {
			curSection.push(piece);
			curWords += w;
		}
	}
	if (curSection.length > 0) sections.push(curSection);

	if (sections.length > 1) {
		const lastWords = sections[sections.length - 1]!.reduce((n, p) => n + countWords(p), 0);
		if (lastWords < target * 0.4) {
			const last = sections.pop()!;
			sections[sections.length - 1]!.push(...last);
		}
	}

	while (sections.length > MAX_SOURCE_PARTS) {
		let minSum = Infinity;
		let minIdx = 0;
		for (let i = 0; i < sections.length - 1; i++) {
			const sum =
				sections[i]!.reduce((n, p) => n + countWords(p), 0) +
				sections[i + 1]!.reduce((n, p) => n + countWords(p), 0);
			if (sum < minSum) {
				minSum = sum;
				minIdx = i;
			}
		}
		sections[minIdx]!.push(...sections[minIdx + 1]!);
		sections.splice(minIdx + 1, 1);
	}

	return sections.map((sec) => sec.join("\n\n"));
}

export function ownStoryId(sourceId: string, part: number): string {
	return `${sourceId}-p${String(part).padStart(2, "0")}`;
}

export function sourceIsShortened(wordCount: number, parts: number, level: Cefr, difficulty: ReadingDifficulty = "level"): boolean {
	return difficulty !== "full" && wordCount / parts > sourceWordsPerPart(level, difficulty) * 1.25;
}

export function pickStory(stories: readonly StoryRecord[], input: PickInput): { story: StoryRecord; reason: PickReason } | null {
	const ownStories = stories.filter((s) => s.source);
	if (ownStories.length > 0) {
		const bySource = new Map<string, StoryRecord>();
		for (const s of ownStories) {
			const existing = bySource.get(s.source!.id);
			if (!existing || s.source!.part < existing.source!.part) {
				bySource.set(s.source!.id, s);
			}
		}
		const candidates = [...bySource.values()].sort((a, b) => {
			const aProgress = a.source!.part > 1 ? 0 : 1;
			const bProgress = b.source!.part > 1 ? 0 : 1;
			if (aProgress !== bProgress) return aProgress - bProgress;
			return a.createdAt.localeCompare(b.createdAt);
		});
		if (candidates[0]) return { story: candidates[0], reason: fitScore(candidates[0], input) };
	}
	const regularStories = stories.filter((s) => !s.source);
	const mine = input.chapter ? regularStories.filter((s) => s.chapter === input.chapter).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
	if (mine[0]) return { story: mine[0], reason: fitScore(mine[0], input) };
	const roboNext = Math.min(...regularStories.filter((s) => (s.genre ?? "robo") === "robo").map((s) => s.episode), Infinity);
	let best: { story: StoryRecord; reason: PickReason } | null = null;
	for (const story of regularStories) {
		if ((story.genre ?? "robo") === "robo" && story.episode > roboNext) continue;
		const reason = fitScore(story, input);
		if (!best || reason.score > best.reason.score) best = { story, reason };
	}
	if (best && (best.reason.score < 0.5 || best.reason.coverage < 0.86)) return null;
	return best;
}

// ─── Level rules ────────────────────────────────────────────────────────────

/** Sentences per episode by level. One assigned episode a day is graded
 *  reading; extensive reading (Nakanishi 2015; Jeon & Day 2016) means reading
 *  a great deal, easy and chosen for pleasure, which this does not measure. */
export const STORY_LENGTH: Record<Cefr, { min: number; max: number }> = {
	A1: { min: 20, max: 25 },
	A2: { min: 22, max: 28 },
	B1: { min: 25, max: 32 },
	B2: { min: 28, max: 36 },
	C1: { min: 30, max: 40 },
};

/** New words an episode may bring in on purpose, by level. */
export const NEW_WORDS_MAX: Record<Cefr, number> = { A1: 3, A2: 4, B1: 5, B2: 6, C1: 8 };

/** How far down each part of speech's frequency list a written text may
 *  reach and still count as "common at this level" (Read, Listen, Speed).
 *  The rank is WITHIN a part of speech, so A1 = 500 means 500 verbs, 500
 *  nouns and so on: about 2,000 words. That is a tolerance for texts the
 *  model writes at the level, not a claim about what the learner knows; the
 *  claim is `creditedWords` (src/core/milestones.ts). */
export const KNOWN_RANK: Record<Cefr, number> = { A1: 500, A2: 1000, B1: 2000, B2: 3000, C1: 5000 };

/** Below this share of known running words the draft is written again. */
export const COVERAGE_FLOOR = 0.92;// ─── XP ─────────────────────────────────────────────────────────────────────

/** A finished reading earns XP for the text read and the questions right;
 *  a reread earns the questions only (the words are not new work). */
export function readXp(sentences: number, correct: number, reread: boolean): number {
	return (reread ? 0 : sentences * 2) + correct * 5;
}

// ─── Tokenizing ─────────────────────────────────────────────────────────────

/** Letters, digits, and the inner apostrophe/hyphen of a word. */
const WORD = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;

/** Split a sentence into words and the pieces between them, keeping every
 *  character so the tokens join back to the sentence exactly. */
export function tokenize(sentence: string): Array<{ text: string; word: boolean }> {
	const out: Array<{ text: string; word: boolean }> = [];
	let at = 0;
	for (const m of sentence.matchAll(WORD)) {
		const start = m.index ?? 0;
		if (start > at) out.push({ text: sentence.slice(at, start), word: false });
		out.push({ text: m[0], word: true });
		at = start + m[0].length;
	}
	if (at < sentence.length) out.push({ text: sentence.slice(at), word: false });
	return out;
}

export function wordTokens(sentences: readonly { tokens: readonly StoryToken[] }[]): StoryToken[] {
	return sentences.flatMap((s) => s.tokens.filter((t) => t.word));
}

/** Grammar words the slovak.wiki lexicon has no entry for: declined
 *  pronouns, the reflexive particle, a few prepositions, conjunctions and
 *  adverbs. Keyed by the lowercase form as written; each is [lemma, gloss].
 *  They are read as known at every level: a learner meets "sa" and "jeho"
 *  in the first week, and a text is not harder for using them. */
export const GRAMMAR_WORDS: Readonly<Record<string, readonly [string, string]>> = {
	ono: ["ono", "it"], ony: ["ony", "they (things, women)"],
	mňa: ["ja", "me"], mi: ["ja", "to me"], mne: ["ja", "(to) me"], mnou: ["ja", "(with) me"],
	ťa: ["ty", "you (object)"], teba: ["ty", "you (object)"], ti: ["ty", "to you"], tebe: ["ty", "(to) you"], tebou: ["ty", "(with) you"],
	ho: ["on", "him; it"], jeho: ["on", "his; him"], mu: ["on", "to him"], jemu: ["on", "to him"], ňom: ["on", "him (after a preposition)"], ním: ["on", "(with) him"],
	ňou: ["ona", "her (after a preposition)"], nej: ["ona", "her; to her"], ju: ["ona", "her"], jej: ["ona", "her; to her"], ňu: ["ona", "her (after a preposition)"],
	nás: ["my", "us"], nám: ["my", "to us"], nami: ["my", "(with) us"], vás: ["vy", "you (plural, object)"], vám: ["vy", "to you (plural)"], vami: ["vy", "(with) you (plural)"],
	ich: ["oni", "them; their"], im: ["oni", "to them"], nich: ["oni", "them (after a preposition)"], nimi: ["oni", "(with) them"],
	sa: ["sa", "oneself (reflexive particle)"], si: ["si", "to oneself / you are"], seba: ["seba", "oneself"], sebe: ["seba", "(to) oneself"], sebou: ["seba", "(with) oneself"],
	moja: ["môj", "my"], moje: ["môj", "my"], môjho: ["môj", "my"], mojho: ["môj", "my"], mojej: ["môj", "my"], môjmu: ["môj", "to my"], mojom: ["môj", "(in/on) my"], mojím: ["môj", "(with) my"], moji: ["môj", "my (plural)"], mojich: ["môj", "my (plural)"],
	tvoja: ["tvoj", "your"], tvoje: ["tvoj", "your"], tvojho: ["tvoj", "your"], tvojej: ["tvoj", "your"], naša: ["náš", "our"], naše: ["náš", "our"], nášho: ["náš", "our"], našej: ["náš", "our"], našich: ["náš", "our"], vaša: ["váš", "your (plural)"], vaše: ["váš", "your (plural)"], vášho: ["váš", "your (plural)"], vašej: ["váš", "your (plural)"],
	svoja: ["svoj", "one's own"], svoje: ["svoj", "one's own"], svojho: ["svoj", "one's own"], svojej: ["svoj", "one's own"], svojom: ["svoj", "(in/on) one's own"], svojím: ["svoj", "(with) one's own"],
	tá: ["ten", "that; this (feminine)"], tí: ["ten", "those"], tie: ["ten", "those"], toho: ["ten", "that (object)"], tomu: ["ten", "to that"], tom: ["ten", "that (after a preposition)"], tým: ["ten", "(with) that"], tej: ["ten", "that (feminine)"], tú: ["ten", "that (feminine, object)"], tých: ["ten", "those (object)"], tými: ["ten", "(with) those"],
	toto: ["tento", "this"], táto: ["tento", "this (feminine)"], títo: ["tento", "these"], tieto: ["tento", "these"], tohto: ["tento", "this (object)"], tejto: ["tento", "this (feminine)"], týmto: ["tento", "(with) this; (to) these"], tomto: ["tento", "(in/on) this"],
	tomuto: ["tento", "to this"], túto: ["tento", "this (feminine, object)"], touto: ["tento", "(with) this (feminine)"], týchto: ["tento", "these (object)"], týmito: ["tento", "(with) these"],
	tamten: ["tamten", "that over there"], tamtá: ["tamten", "that over there (feminine)"], tamto: ["tamten", "that over there (neuter)"], tamtí: ["tamten", "those over there"], tamtie: ["tamten", "those over there"],
	tamtoho: ["tamten", "that over there (object)"], tamtej: ["tamten", "that over there (feminine)"], tamtomu: ["tamten", "to that over there"], tamtom: ["tamten", "that over there (after a preposition)"], tamtým: ["tamten", "(with) that over there; (to) those over there"],
	tamtú: ["tamten", "that over there (feminine, object)"], tamtou: ["tamten", "(with) that over there (feminine)"], tamtých: ["tamten", "those over there (object)"], tamtými: ["tamten", "(with) those over there"],
	ktorá: ["ktorý", "which; who (feminine)"], ktoré: ["ktorý", "which; that"], ktorí: ["ktorý", "who; which (plural)"], ktorú: ["ktorý", "which (object)"], ktorého: ["ktorý", "whose; which"], ktorému: ["ktorý", "to which; to whom"], ktorej: ["ktorý", "whose; in/to which"], ktorom: ["ktorý", "(in/on) which"], ktorým: ["ktorý", "(with) which"], ktorých: ["ktorý", "of which; whose"],
	sem: ["sem", "(to) here"], koho: ["kto", "whom"], komu: ["kto", "to whom"], kým: ["kto", "(with) whom / while"], čom: ["čo", "what (after a preposition)"], čím: ["čo", "(with) what"], čoho: ["čo", "of what"], čomu: ["čo", "to what"],
	i: ["aj", "and; also"], aj: ["aj", "also; too"], ak: ["ak", "if"], aby: ["aby", "so that; in order to"], no: ["no", "well; but"], však: ["však", "however; after all"], iba: ["iba", "only"],
	vždy: ["vždy", "always"], nikdy: ["nikdy", "never"], niekedy: ["niekedy", "sometimes"], nikde: ["nikde", "nowhere"], niekde: ["niekde", "somewhere"], všetko: ["všetko", "everything"], všetci: ["všetci", "everyone"], všetkých: ["všetci", "all; everyone"], všetkým: ["všetci", "to everyone; everything"],
	tak: ["tak", "so; like that"], taký: ["taký", "such"], taká: ["taký", "such"], také: ["taký", "such"], takto: ["takto", "like this"],
	vo: ["v", "in"], k: ["k", "to; towards"], ku: ["k", "to; towards"], u: ["u", "at (someone's place)"], pred: ["pred", "in front of; before"], nad: ["nad", "above"], pod: ["pod", "under"], medzi: ["medzi", "between; among"], bez: ["bez", "without"], cez: ["cez", "through; across"], pri: ["pri", "at; by; near"], proti: ["proti", "against"], podľa: ["podľa", "according to"], okolo: ["okolo", "around; past"],
	až: ["až", "until; as much as"], ani: ["ani", "not even; nor"], než: ["než", "than"], nech: ["nech", "let (may)"], by: ["by", "would (conditional)"],
	keby: ["keby", "if (conditional)"], napríklad: ["napríklad", "for example"],
	hm: ["hm", "hm (filler)"], hmm: ["hm", "hm (filler)"], eh: ["eh", "eh (filler)"], ehm: ["eh", "um (filler)"], aha: ["aha", "aha"], wow: ["wow", "wow"],
	nejaký: ["nejaký", "some; a certain"], nejaká: ["nejaký", "some; a certain"], nejaké: ["nejaký", "some; a certain"], nejakého: ["nejaký", "some; a certain"], nejakej: ["nejaký", "some; a certain"], nejakému: ["nejaký", "some; a certain"], nejakom: ["nejaký", "some; a certain"], nejakým: ["nejaký", "some; a certain"], nejakú: ["nejaký", "some; a certain"], nejakou: ["nejaký", "some; a certain"], nejakí: ["nejaký", "some; a certain"], nejakých: ["nejaký", "some; a certain"], nejakými: ["nejaký", "some; a certain"], nejako: ["nejako", "somehow"], nejak: ["nejako", "somehow"],
	iný: ["iný", "other; different"], iná: ["iný", "other; different"], iné: ["iný", "other; different"], iného: ["iný", "other; different"], inej: ["iný", "other; different"], inému: ["iný", "other; different"], inom: ["iný", "other; different"], iným: ["iný", "other; different"], inú: ["iný", "other; different"], inou: ["iný", "other; different"], iní: ["iný", "other; different"], iných: ["iný", "other; different"], inými: ["iný", "other; different"],
	takého: ["taký", "such"], takej: ["taký", "such"], takému: ["taký", "such"], takom: ["taký", "such"], takým: ["taký", "such"], takú: ["taký", "such"], takou: ["taký", "such"], takí: ["taký", "such"], takých: ["taký", "such"], takými: ["taký", "such"],
	jeden: ["jeden", "one"], jedna: ["jeden", "one"], jedno: ["jeden", "one"], jedného: ["jeden", "one"], jednej: ["jeden", "one"], jednému: ["jeden", "one"], jednom: ["jeden", "one"], jedným: ["jeden", "one"], jednu: ["jeden", "one"], jednou: ["jeden", "one"],
	dva: ["dva", "two"], dve: ["dva", "two"], dvaja: ["dva", "two (men)"], dvoch: ["dva", "two"], dvom: ["dva", "to two"], dvomi: ["dva", "(with) two"],
	tri: ["tri", "three"], troch: ["tri", "three"], trom: ["tri", "to three"], tromi: ["tri", "(with) three"],
	štyri: ["štyri", "four"], štyroch: ["štyri", "four"], štyrom: ["štyri", "to four"], štyrmi: ["štyri", "(with) four"],
	päť: ["päť", "five"], šesť: ["šesť", "six"], sedem: ["sedem", "seven"], osem: ["osem", "eight"], deväť: ["deväť", "nine"], desať: ["desať", "ten"],
	centrum: ["centrum", "center; downtown"], centra: ["centrum", "center; downtown (genitive)"], centre: ["centrum", "in the center (locative)"], centrom: ["centrum", "through/with the center"], centru: ["centrum", "towards the center"],
	hora: ["hora", "mountain; forest"], hory: ["hora", "mountains; of the mountain"], hore: ["hora", "up; on the mountain"], horu: ["hora", "mountain (accusative)"], horou: ["hora", "through the mountain"], hôr: ["hora", "of the mountains"], horám: ["hora", "to the mountains"], horách: ["hora", "in the mountains (locative plural)"], horami: ["hora", "through/with the mountains"],
};

/** The grammar word a form is, if the table has it. */
export function grammarWord(form: string): { lemma: string; gloss: string } | undefined {
	const hit = GRAMMAR_WORDS[form.toLocaleLowerCase()];
	return hit ? { lemma: hit[0], gloss: hit[1] } : undefined;
}

/** Share of word tokens the learner can read: known words, plus the
 *  words the episode introduces on purpose (glossed, repeated, queued —
 *  the i+1). What is left are stray unknowns, the ones the floor limits. */
export function knownCoverage(sentences: readonly { tokens: readonly StoryToken[] }[], introduced: readonly StoryWord[] = []): number {
	const words = wordTokens(sentences);
	if (words.length === 0) return 1;
	const taught = new Set(introduced.flatMap((w) => [w.slug, w.lemma.toLocaleLowerCase()]).filter((x): x is string => !!x));
	return words.filter((t) => !t.fresh || (t.slug && taught.has(t.slug)) || (t.lemma && taught.has(t.lemma.toLocaleLowerCase()))).length / words.length;
}

// ─── The model's answer ─────────────────────────────────────────────────────

/** The JSON the generator asks the model for. */
export interface StoryDraft {
	title: string;
	topic: string;
	cast: StoryCharacter[];
	sentences: Array<{ sk: string; en: string; who?: string; p?: boolean }>;
	newWords: Array<{ sk: string; en: string }>;
	questions: StoryQuestion[];
	recap: string;
}

/** The usable questions in a model's list: a question with two to four
 *  options and a valid answer index (a number, or the right option's text);
 *  a known `kind` is kept. Anything else is dropped, never fatal. Shared
 *  by the Read task's draft and the Watch task's questions. */
export function questionsFrom(raw: unknown): StoryQuestion[] {
	const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
	if (!Array.isArray(raw)) return [];
	return raw
		.map((q) => {
			if (!q || typeof q !== "object") return null;
			const qq = q as { q?: unknown; options?: unknown; answer?: unknown; kind?: unknown };
			const options = Array.isArray(qq.options) ? qq.options.map(str).filter(Boolean) : [];
			const answer = typeof qq.answer === "number" ? qq.answer : typeof qq.answer === "string" ? options.indexOf(qq.answer.trim()) : -1;
			if (!str(qq.q) || options.length < 2 || answer < 0 || answer >= Math.min(options.length, 4)) return null;
			const kind = (STORY_QUESTION_KINDS as readonly string[]).includes(str(qq.kind)) ? (str(qq.kind) as StoryQuestionKind) : undefined;
			return { q: str(qq.q), options: options.slice(0, 4), answer, ...(kind ? { kind } : {}) };
		})
		.filter((q): q is StoryQuestion => q !== null);
}

/** Pull the draft out of the model's text: the first {...} block, fences
 *  and prose around it ignored. Throws on anything that is not a usable
 *  story, so the caller can redo the draft. */
export function parseStoryDraft(text: string): StoryDraft {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) throw new Error("no JSON object in the model's answer");
	let raw: unknown;
	try {
		raw = JSON.parse(text.slice(start, end + 1));
	} catch (err) {
		throw new Error(`the model's JSON does not parse: ${err instanceof Error ? err.message : String(err)}`);
	}
	const o = raw as Partial<Record<keyof StoryDraft, unknown>>;
	const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
	const cast: StoryCharacter[] = Array.isArray(o.cast)
		? o.cast
				.map((c) => {
					if (!c || typeof c !== "object") return null;
					const cc = c as { name?: unknown; gender?: unknown; age?: unknown };
					const name = str(cc.name);
					if (!name) return null;
					const g = str(cc.gender).toLowerCase();
					const a = str(cc.age).toLowerCase();
					return {
						name,
						gender: g.startsWith("f") || g === "woman" || g === "girl" ? "f" : "m",
						age: a === "child" || a === "young" || a === "old" ? a : "adult",
					} as StoryCharacter;
				})
				.filter((c): c is StoryCharacter => c !== null)
				.slice(0, 6)
		: [];
	const names = new Set(cast.map((c) => c.name.toLocaleLowerCase()));
	const sentences = Array.isArray(o.sentences)
		? o.sentences
				.map((s) => {
					if (!s || typeof s !== "object") return null;
					const ss = s as { sk?: unknown; en?: unknown; who?: unknown; p?: unknown };
					const who = str(ss.who);
					const known = who && who.toLocaleLowerCase() !== "narrator" && names.has(who.toLocaleLowerCase()) ? cast.find((c) => c.name.toLocaleLowerCase() === who.toLocaleLowerCase())!.name : undefined;
					const p = ss.p === true ? true : undefined;
					return { sk: str(ss.sk), en: str(ss.en), ...(known ? { who: known } : {}), ...(p ? { p: true } : {}) };
				})
				.filter((s): s is { sk: string; en: string; who?: string; p?: boolean } => !!s && s.sk.length > 0)
		: [];
	if (sentences.length < 3) throw new Error(`the draft has ${sentences.length} sentences`);
	const newWords = Array.isArray(o.newWords)
		? o.newWords
				.map((w) => (w && typeof w === "object" ? { sk: str((w as { sk?: unknown }).sk), en: str((w as { en?: unknown }).en) } : null))
				.filter((w): w is { sk: string; en: string } => !!w && w.sk.length > 0)
		: [];
	const questions = questionsFrom(o.questions);
	return {
		title: str(o.title) || sentences[0]!.sk.replace(/[.!?…]+$/, ""),
		topic: str(o.topic).slice(0, 80),
		cast,
		sentences,
		newWords,
		questions: questions.slice(0, MAX_QUESTIONS),
		recap: str(o.recap),
	};
}

// ─── Grading the check ──────────────────────────────────────────────────────

export function gradeAnswers(questions: readonly StoryQuestion[], answers: readonly number[]): { correct: number; total: number } {
	let correct = 0;
	questions.forEach((q, i) => {
		if (answers[i] === q.answer) correct++;
	});
	return { correct, total: questions.length };
}

/** "ep-003-robo-na-trhu" */
export function storyId(episode: number, title: string): string {
	const slug = title
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40)
		.replace(/-+$/g, "");
	return `ep-${String(episode).padStart(3, "0")}-${slug || "story"}`;
}
