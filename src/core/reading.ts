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
}

export interface StorySentence {
	sk: string;
	en: string;
	tokens: StoryToken[];
}

/** One comprehension question: Slovak, three options, one right. */
export interface StoryQuestion {
	q: string;
	options: string[];
	answer: number;
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

export interface StoryRecord {
	/** "ep-003-robo-na-trhu": the episode number and the title's slug. */
	id: string;
	lang: string;
	/** The series the episode belongs to (one so far: Robo in Bratislava). */
	series: string;
	episode: number;
	title: string;
	/** The level the text was written for (the learner's working level). */
	level: Cefr;
	/** The chapter the learner was in when it was written. */
	chapter: string;
	/** The setting the episode was asked to use (from the learner's purposes). */
	theme: string;
	createdAt: string;
	sentences: StorySentence[];
	questions: StoryQuestion[];
	/** The words the episode introduces on purpose (glossed in the text). */
	newWords: StoryWord[];
	/** One English line of what happened, for the next episode's brief. */
	recap: string;
	/** Share of word tokens the learner is expected to know (0..1). */
	coverage: number;
	wordCount: number;
	usage: StoryUsage;
	/** How many drafts it took (a draft under the coverage floor is redone once). */
	drafts: number;
}

/** The index line (data/profiles/<lang>/stories/index.jsonl): enough to
 *  list the library without opening every file. */
export interface StoryIndexEntry {
	id: string;
	series: string;
	episode: number;
	title: string;
	level: Cefr;
	theme: string;
	createdAt: string;
	wordCount: number;
	coverage: number;
	newWords: string[];
	model: string;
}

/** One reading of a story (stories/reads.jsonl, append-only). */
export interface ReadLogEntry {
	storyId: string;
	at: string;
	day: string;
	ms?: number;
	/** Comprehension: right answers over questions asked. */
	correct: number;
	total: number;
	/** The questions' answers as picked (index per question, -1 = skipped). */
	answers: number[];
	/** Words tapped for a gloss (slugs; words the dictionary lacks by text). */
	tapped: string[];
	/** Words sent to the review deck by this reading. */
	queued: string[];
	xp: number;
}

/** An index line with how it has been read (the library the reader lists). */
export interface LibraryEntry extends StoryIndexEntry {
	/** Readings so far, and the last comprehension score. */
	reads: number;
	lastReadAt?: string;
	lastScore?: { correct: number; total: number };
}

/** What GET /api/read answers: the episode to read now, the library,
 *  whether a new one can be written. */
export interface ReadingState {
	/** The newest episode not yet read, or null when every episode has
	 *  been read (the next one has to be written). */
	current: StoryRecord | null;
	library: LibraryEntry[];
	/** A model is configured, so a new episode can be written. */
	canWrite: boolean;
	generating: boolean;
	/** Episodes read today (the daily plan's Read task). */
	readToday: number;
}

// ─── Level rules ────────────────────────────────────────────────────────────

/** Sentences per episode by level: short enough to finish in one sitting
 *  at the planned pace (about four minutes with the audio). */
export const STORY_LENGTH: Record<Cefr, { min: number; max: number }> = {
	A1: { min: 6, max: 8 },
	A2: { min: 8, max: 11 },
	B1: { min: 11, max: 14 },
	B2: { min: 14, max: 18 },
	C1: { min: 16, max: 20 },
};

/** New words an episode may bring in on purpose, by level. */
export const NEW_WORDS_MAX: Record<Cefr, number> = { A1: 3, A2: 4, B1: 5, B2: 6, C1: 8 };

/** Frequency rank (within part of speech) up to which a word counts as
 *  "common at this level" for the coverage estimate — the words a learner
 *  at the level has met in the app's own word bands. */
export const KNOWN_RANK: Record<Cefr, number> = { A1: 300, A2: 700, B1: 1500, B2: 3000, C1: 5000 };

/** Below this share of known running words the draft is written again. */
export const COVERAGE_FLOOR = 0.92;

export const QUESTIONS_PER_STORY = 3;

/** Minutes the daily plan books for a Read task. */
export const READ_MINUTES = 4;

// ─── XP ─────────────────────────────────────────────────────────────────────

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

/** Share of word tokens that are not fresh. */
export function knownCoverage(sentences: readonly { tokens: readonly StoryToken[] }[]): number {
	const words = wordTokens(sentences);
	if (words.length === 0) return 1;
	return words.filter((t) => !t.fresh).length / words.length;
}

// ─── The model's answer ─────────────────────────────────────────────────────

/** The JSON the generator asks the model for. */
export interface StoryDraft {
	title: string;
	sentences: Array<{ sk: string; en: string }>;
	newWords: Array<{ sk: string; en: string }>;
	questions: StoryQuestion[];
	recap: string;
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
	const sentences = Array.isArray(o.sentences)
		? o.sentences
				.map((s) => (s && typeof s === "object" ? { sk: str((s as { sk?: unknown }).sk), en: str((s as { en?: unknown }).en) } : null))
				.filter((s): s is { sk: string; en: string } => !!s && s.sk.length > 0)
		: [];
	if (sentences.length < 3) throw new Error(`the draft has ${sentences.length} sentences`);
	const newWords = Array.isArray(o.newWords)
		? o.newWords
				.map((w) => (w && typeof w === "object" ? { sk: str((w as { sk?: unknown }).sk), en: str((w as { en?: unknown }).en) } : null))
				.filter((w): w is { sk: string; en: string } => !!w && w.sk.length > 0)
		: [];
	const questions = Array.isArray(o.questions)
		? o.questions
				.map((q) => {
					if (!q || typeof q !== "object") return null;
					const qq = q as { q?: unknown; options?: unknown; answer?: unknown };
					const options = Array.isArray(qq.options) ? qq.options.map(str).filter(Boolean) : [];
					const answer = typeof qq.answer === "number" ? qq.answer : typeof qq.answer === "string" ? options.indexOf(qq.answer.trim()) : -1;
					if (!str(qq.q) || options.length < 2 || answer < 0 || answer >= options.length) return null;
					return { q: str(qq.q), options: options.slice(0, 4), answer: Math.min(answer, 3) };
				})
				.filter((q): q is StoryQuestion => q !== null)
		: [];
	return {
		title: str(o.title) || sentences[0]!.sk.replace(/[.!?…]+$/, ""),
		sentences,
		newWords,
		questions: questions.slice(0, QUESTIONS_PER_STORY),
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
