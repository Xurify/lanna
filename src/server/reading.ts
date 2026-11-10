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

import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import { piEngineForSpec, type PiEngine } from "../agent/models.ts";
import { runSubagent } from "../agent/subagents/pi-run.ts";
import type { Usage } from "@earendil-works/pi-ai";
import { addMinutes, sessionMs } from "../core/active-time.ts";
import { curriculumState, allChapters, STAGES, type Cefr } from "../core/curriculum.ts";
import { creditedWords, LEVEL_VOCAB } from "../core/milestones.ts";
import { countryOf, foldDiacritics, type LanguageInfo } from "../core/language.ts";
import { activeLanguage } from "./active-language.ts";
import { allUnits } from "../core/lesson.ts";
import { purposeInfo, type Purpose } from "../core/onboarding.ts";
import {
	COVERAGE_FLOOR,
	grammarWord,
	knownCoverage,
	gradeAnswers,
	KNOWN_RANK,
	NEW_WORDS_MAX,
	parseStoryDraft,
	QUESTION_KIND_INFO,
	QUESTION_PLAN,
	genreInfo,
	pickStory,
	SHELF_DAILY_CAP,
	shelfNeeds,
	type PickReason,
	type StoryGenre,
	type WritingProgress,
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
	type StoryQuestion,
	type StoryToken,
	type StoryUsage,
	type StoryWord,
} from "../core/reading.ts";
import { dayKey, entryLemma, exampleText, type LexiconEntry } from "../core/review.ts";
import { ensureReadmes } from "../store/corpus.ts";
import { defaultGoal, progressStore } from "../store/progress.ts";
import { reviewStore } from "../store/review.ts";
import { knownWordStore } from "../store/known-words.ts";
import { readSettings } from "../store/settings.ts";
import { storyStore } from "../store/stories.ts";
import { assignVoices, availableVoiceIds, NARRATOR_VOICE } from "./voices.ts";
import { progressSummary, type ProgressSummary } from "./lesson.ts";
import { enqueueWords } from "./review.ts";
import { loadWorld, type World } from "./world.ts";

const STORY_SERIES = "robo";

const tag = () => activeLanguage().tag;
const code = () => activeLanguage().code;

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
	/** What Watch measures real speech against: `met`, plus the commonest
	 *  `expectedWords` words, plus the beginner set and place names. Smaller
	 *  than `known`, which is a tolerance for written texts. */
	expected: Set<string>;
	/** How many words the level credits beyond the ones met (the word check's
	 *  estimate, else the level's band through the progress made in it): the
	 *  figure the Milestones page uses. */
	expectedWords: number;
	/** Lemmas to hand the model as "use these", most useful first. */
	sample: string[];
	/** Grammar units held (titles), for the brief. */
	grammar: string[];
	/** Units with lessons behind them but not yet held: the i+1 grammar. */
	practicing: string[];
	purposes: Purpose[];
	/** "Something else", in the learner's own words (onboarding). */
	note?: string;
}

const orderCache = new WeakMap<Lexicon, string[]>();

/** Whether every word is ranked on one list (Estonian, Russian) rather than
 *  within its part of speech (Slovak): nearly all the ranks are different. */
export function isOneList(lexicon: Lexicon): boolean {
	const ranked = lexicon.entries.filter((e) => e.rank !== undefined);
	return ranked.length > 0 && new Set(ranked.map((e) => e.rank)).size > ranked.length * 0.9;
}

/** How far down its own list a word sits, 0 to 1. Slovak ranks restart in
 *  each part of speech (noun #1,500 of 3,000 sits beside verb #1,000 of
 *  2,000); a lexicon built from a corpus (Estonian, Russian) ranks every
 *  word on one list, where the rank itself is the order and the share is
 *  its place on that list. */
function rankShare(lexicon: Lexicon): (e: LexiconEntry) => number {
	const ranked = lexicon.entries.filter((e) => e.rank !== undefined);
	const oneList = isOneList(lexicon);
	const size = new Map<string, number>();
	for (const e of ranked) size.set(oneList ? "" : e.cat, Math.max(size.get(oneList ? "" : e.cat) ?? 0, e.rank!));
	return (e) => (e.rank === undefined ? 2 : e.rank / (size.get(oneList ? "" : e.cat) ?? e.rank));
}

/** Every dictionary word, commonest first, by how often its forms occur
 *  across the dictionary's example sentences. Words whose forms never occur
 *  keep their rank order after the rest. Computed once per process. */
export function frequencyOrder(lexicon: Lexicon): string[] {
	const hit = orderCache.get(lexicon);
	if (hit) return hit;
	const all = new Set(lexicon.entries.map((e) => e.slug));
	const counts = new Map<string, number>();
	for (const e of lexicon.entries)
		for (const ex of e.examples.filter((x) => !x.rejected))
			for (const t of tokenize(exampleText(ex))) {
				if (!t.word || /^\p{N}+$/u.test(t.text)) continue;
				const entry = resolveWord(lexicon, t.text, all, { stem: false });
				if (entry) counts.set(entry.slug, (counts.get(entry.slug) ?? 0) + 1);
			}
	const share = rankShare(lexicon);
	const order = [...lexicon.entries]
		.sort((x, y) => (counts.get(y.slug) ?? 0) - (counts.get(x.slug) ?? 0) || share(x) - share(y) || x.slug.localeCompare(y.slug))
		.map((e) => e.slug);
	orderCache.set(lexicon, order);
	return order;
}

const commonnessCache = new WeakMap<Lexicon, Map<string, number>>();

/** Where a word sits among all the dictionary's words by use (1 = commonest),
 *  the same in every language and part of speech. Thresholds on "how common"
 *  (what a new word is worth, what to pre-teach) read this, not the raw rank. */
export function commonness(lexicon: Lexicon | null): (slug: string) => number | undefined {
	if (!lexicon) return () => undefined;
	let pos = commonnessCache.get(lexicon);
	if (!pos) {
		pos = new Map(frequencyOrder(lexicon).map((slug, i) => [slug, i + 1]));
		commonnessCache.set(lexicon, pos);
	}
	return (slug) => pos.get(slug);
}

/** What the learner knows, as the brief and the coverage measure see it.
 *  `level` writes for another level than the learner's own (the shelf
 *  keeps a story one level down and one up): the met words stay, the
 *  frequency bound moves. */
export function knownWords(lexicon: Lexicon | null = loadLexicon(), level?: Cefr): KnownWords {
	const p = progressStore.read();
	const goal = p.goal ?? defaultGoal();
	const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	const at = level ?? state.level;
	const chapter = allChapters().find((c) => c.id === state.current);
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
	for (const u of allUnits()) {
		if (u.kind !== "words" || (p.units[u.id]?.lessons ?? 0) === 0) continue;
		for (const lemma of u.lemmas ?? []) {
			const entries = lexicon?.byForm.get(lemma.toLocaleLowerCase(tag())) ?? [];
			for (const e of entries) met.add(e.slug);
			if (!sample.includes(lemma)) sample.push(lemma);
		}
	}
	// Words the learner marked as known (E71) count as met wherever "known" is measured.
	for (const [slug, w] of Object.entries(knownWordStore.read().words)) {
		met.add(slug);
		if (!sample.includes(w.lemma)) sample.push(w.lemma);
	}
	const known = new Set(met);
	const bound = KNOWN_RANK[at];
	// The common words at the level, slovak.wiki's curated beginner set
	// (greetings, question words, pronouns) and place names (Bratislava is
	// not vocabulary to learn) count as known at every level.
	if (lexicon) {
		// A corpus-ranked lexicon has no per-class ranks: the level's whole band of commonest words stands in.
		const oneList = isOneList(lexicon);
		const wide = oneList ? new Set(frequencyOrder(lexicon).slice(0, LEVEL_VOCAB[at])) : null;
		for (const e of lexicon.entries) if ((wide ? wide.has(e.slug) : e.rank !== undefined && e.rank <= bound) || e.origin === "curated" || e.cat === "Places") known.add(e.slug);
	}
	// The same credit the Milestones page gives: the word check's estimate, or the level's band through the progress made in it.
	const expectedWords = level ? LEVEL_VOCAB[at] : creditedWords(goal.vocabulary, at, state.levelProgress);
	const expected = new Set(met);
	if (lexicon) {
		for (const slug of frequencyOrder(lexicon).slice(0, expectedWords)) expected.add(slug);
		for (const e of lexicon.entries) if (e.origin === "curated" || e.cat === "Places") expected.add(e.slug);
	}
	const all = state.chapters.flatMap((c) => c.units);
	const grammar = all.filter((u) => (u.kind === "drill" || u.kind === "tutor") && (u.status === "done" || u.status === "skipped")).map((u) => u.title);
	const practicing = all.filter((u) => u.kind === "drill" && u.status === "started").map((u) => u.title);
	return {
		level: at,
		chapter: state.current,
		chapterTitle: chapter?.title ?? state.current,
		met,
		known,
		expected,
		expectedWords,
		sample: sample.slice(0, 160),
		grammar,
		practicing,
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
	if (infinitive && folded.length > 3) {
		out.add(folded.slice(0, -1));
		// -ovať verbs conjugate with -uj- (pracovať → pracujem, potrebovať → potrebujem)
		if (folded.endsWith("ovat") && folded.length > 5) {
			out.add(folded.slice(0, -4) + "uj");
		}
		// Verb root before infinitive vowel (-iť, -ať, -ieť, -núť → robia, vidia)
		const root = folded.replace(/(?:iet|nut|at|it|ut)$/, "");
		if (root.length >= 3) out.add(root);
	} else {
		const bare = folded.replace(/[aeiouy]$/, "");
		if (bare.length >= 2) out.add(bare);
		// -ia / -ie nouns (reštaurácia → reštauráci-u, námestie → námest-ia)
		const bareMulti = folded.replace(/(?:ia|ie)$/, "");
		if (bareMulti.length >= 3) out.add(bareMulti);
		// Latin/Greek -um loanwords (múzeum → múze-a, centrum → centr-a, štúdium → štúdi-a)
		if (folded.endsWith("um") && folded.length > 4) {
			out.add(folded.slice(0, -2));
		}
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
		const rawSk = entryLemma(entry).toLocaleLowerCase(tag()).replace(/\s+s[ai]$/, "");
		if (/\s/.test(rawSk)) continue; // multi-word phrases (other than reflexive verbs) are matched whole
		const folded = foldDiacritics(rawSk);
		for (const stem of stemsOf(folded, rawSk.endsWith("ť"))) {
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
	const score = (s: Stemmed) => [s.stem.length, sharedPrefix(lower, entryLemma(s.entry).toLocaleLowerCase(tag())), known.has(s.entry.slug) ? 1 : 0, -(s.entry.rank ?? 1e9)];
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
		return shared(lower, entryLemma(stemmed).toLocaleLowerCase(tag())) > shared(lower, entryLemma(loose).toLocaleLowerCase(tag())) ? stemmed : loose;
	}
	return loose ?? stemmed;
}

/** Tokenize one sentence and gloss every word. A word the dictionary
 *  lacks keeps the story's own gloss when the model introduced it. */
/** The series cast: never vocabulary, whatever the dictionary says. */
export const STORY_NAMES: ReadonlySet<string> = new Set(["martin"]);

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

export function glossSentence(sk: string, en: string, lexicon: Lexicon | null, known: Set<string>, newWords: readonly StoryWord[], names: ReadonlySet<string> = STORY_NAMES, met?: ReadonlySet<string>): StorySentence {
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
		// be a name (Martin, Zuzka, Petržalka), is only claimed by a listed
		// dictionary form, never by a stem guess.
		const resolved = lexicon ? resolveWord(lexicon, t.text, known, { stem: !name }) : undefined;
		const grammar = grammarWord(t.text);
		// Only an exact dictionary form outranks the grammar table: a stem
		// or diacritics guess would turn "jedno" into "jednať" and "tri"
		// into "trio".
		const exact = !!resolved && !!lexicon?.byForm.get(t.text.toLocaleLowerCase(tag()))?.includes(resolved);
		const entry = grammar && !exact ? undefined : resolved;
		if (entry) {
			token.slug = entry.slug;
			token.lemma = entry.sk;
			token.gloss = entry.en;
			token.cat = entry.cat;
			if (entry.gender) token.gender = entry.gender;
			if (!known.has(entry.slug) && !grammar) token.fresh = true;
			else if (met && !grammar && entry.cat !== "Places" && !met.has(entry.slug)) token.assumed = true;
			return token;
		}
		const introduced = fresh.get(foldDiacritics(t.text.toLocaleLowerCase(tag())));
		if (introduced) {
			token.lemma = introduced.lemma;
			token.gloss = introduced.gloss;
		} else if (grammar) {
			// A pronoun form or particle the dictionary lacks: glossed from
			// the table, known at every level.
			token.lemma = grammar.lemma;
			token.gloss = grammar.gloss;
			token.cat = "Grammar";
			return token;
		}
		// A proper name is not fresh vocabulary; an unknown word is.
		if (!name) token.fresh = true;
		return token;
	});
	return { sk, en, tokens };
}

// ─── The brief ──────────────────────────────────────────────────────────────

/** The writer's instructions, for the running language and its story bible. */
export function storySystem(lang: Pick<LanguageInfo, "english" | "tag" | "country" | "promptExamples">, world: World | null): string {
	const name = lang.english;
	const lead = world?.cast[0];
	const logline = world?.logline ?? `one main character, a young person who has recently moved to a town in ${countryOf(lang)} (name them and the town in the first episode; the recaps carry them)`;
	const clauseWords = lang.promptExamples?.clauseWords;
	const leadName = lead?.name ?? "Name";
	return `You write graded ${name} reading texts for one learner inside a language app. You answer with ONE JSON object and nothing else: no prose, no code fences.

The brief says what kind of text to write (an episode of the running series about ${logline}; or a stand-alone piece: a conversation, messages, a diary page, a folk tale, a news item...). Plain, warm, a little funny where it fits; everyday life, nothing violent or sad. In the series keep the same people and places across episodes (the brief gives the earlier recaps).

Rules that matter more than the plot:
- Write at the learner's level and ONLY with the grammar listed as held. Simple main clauses at A1; a subordinate clause${clauseWords ? ` with ${clauseWords}` : ""} from A2.
- Use the learner's known words. About 97 of every 100 running words must be words a learner at this level knows; the brief gives the known words to lean on. Repeat words rather than reach for new ones.
- Introduce at most the number of new words the brief allows. Each new word appears at least three times in the text, in different sentences, so it can be learned from context. List every new word under newWords with its dictionary form and a short English gloss.
- Every sentence is something a ${name} speaker would really say or write in that situation. No filler that states the obvious ("I listen and you talk", "we are a family and you are a friend"); at A1 lean on the real exchanges of the situation: greetings, asking and answering, wanting and having, liking, where and when. A line of dialogue sounds like speech: short, with a reaction to what was just said.
- Correct ${name} spelling with all diacritics. Check case endings and verb forms; a wrong form teaches a wrong form.
- One sentence per array item; each 4 to 14 words; the whole text within the sentence count the brief gives. Narration and speech are separate items: never put a speech tag ("he says") and the quoted line in one item — the "who" field says who speaks, so quoted lines need no quotation marks and no tags.
- "cast" lists every person who speaks: name, gender ("f" or "m"), age ("child", "young", "adult" or "old"). Each sentence's "who" is "narrator" or one cast name exactly as listed.${lead ? ` In the series ${lead.name} is ${lead.gender === "f" ? "female" : "male"}, ${lead.age}.` : ""}
- "en" is a plain English translation of the sentence.
- Comprehension questions as the brief lists them: that many, of those kinds in that order, each with that many options, question and options in ${name} at the text's level. Mark each question with its "kind". Options are short and all the same shape; the wrong ones are plausible (things the text mentions, or a near meaning), never silly. The right one is at a different index each time. "answer" is the index of the right option. Questions test meaning, never grammar.
- "topic" is three to six English words saying what the text is about.
- "recap" is one English sentence saying what happened (for the next episode's brief).
- "title" is two to five ${name} words.

Shape: {"title": "...", "topic": "...", "cast": [{"name": "${leadName}", "gender": "m", "age": "young"}], "sentences": [{"who": "narrator", "sk": "...", "en": "..."}, {"who": "${leadName}", "sk": "...", "en": "..."}], "newWords": [{"sk": "lemma", "en": "gloss"}], "questions": [{"kind": "recall", "q": "...", "options": ["...", "...", "..."], "answer": 0}], "recap": "..."}`;
}

export interface StoryBrief {
	genre: StoryGenre;
	/** The episode number in the series; 0 for a stand-alone piece. */
	episode: number;
	theme: string;
	prompt: string;
}

/** Episode settings for a language whose story bible names none. */
const PLAIN_SETTINGS: Record<Purpose, string[]> = {
	family: ["a Sunday lunch with his girlfriend's family", "a phone call with his mother", "a friend's birthday at home"],
	daily: ["a café in the old town", "the market", "a tram ride across the city", "a visit to the doctor", "finding a flat"],
	work: ["his first week at a new job", "a meeting that goes wrong", "lunch with colleagues", "writing an email to the boss"],
	offices: ["the foreigners' police office", "a form that has to be filled in", "a phone call to the bank"],
	media: ["a film at the cinema", "the evening news on TV", "a podcast about the city"],
	exam: ["a language course in the evening", "a study day before an exam"],
	curious: ["a trip to the castle", "a day in the mountains", "a word that puzzles him"],
	// "Something else" is a note in the learner's words; the brief carries
	// it, the setting falls back to everyday life.
	other: [],
};

/** The setting for an episode: rotate through what the learner is learning
 *  for, with everyday life when nothing was picked. The story bible's own
 *  settings (Bratislava's market, the Tatras) come first. */
export function episodeTheme(purposes: readonly Purpose[], episode: number, world: World | null = null): string {
	const settings = (p: Purpose) => world?.settings?.[p] ?? PLAIN_SETTINGS[p] ?? [];
	const pool = (purposes.length ? purposes : (["daily"] as Purpose[])).flatMap(settings);
	if (pool.length === 0) return `a day in ${world?.city ?? "the city"}`;
	return pool[(episode - 1) % pool.length]!;
}

/** What the brief asks for in questions at a level: the plan spelled out. */
export function questionLine(level: Cefr): string {
	const plan = QUESTION_PLAN[level];
	const kinds = plan.kinds.map((kind, i) => `${i + 1}. ${kind}: ${QUESTION_KIND_INFO[kind].brief}`);
	return `Questions: ${plan.count}, each with ${plan.options} options, in this order:\n${kinds.map((l) => `  ${l}`).join("\n")}`;
}

/** The brief for one text. `previous` lists the shelf (every kept story):
 *  series episodes count the series, the others' topics are named so the
 *  new text is about something else. A series episode is seeded from the
 *  language's story bible (`world.json`, src/server/world.ts):
 *  its cast, its places, and the chapter the learner is in as this
 *  episode's plot beat. */
export function storyBrief(k: KnownWords, previous: readonly StoryIndexEntry[], recaps: readonly string[], now = new Date(), genre: StoryGenre = "robo", world: World | null = null, lang: Pick<LanguageInfo, "english" | "tag" | "country"> = activeLanguage()): StoryBrief {
	const robo = previous.filter((s) => (s.genre ?? "robo") === "robo");
	const episode = genre === "robo" ? robo.length + 1 : 0;
	const names = { series: world?.series ?? "The story", language: lang.english, country: countryOf(lang) };
	const theme = genre === "robo" ? episodeTheme(k.purposes, episode, world) : genreInfo(genre, names).label.toLowerCase();
	const lead = world?.cast[0]?.name;
	const len = STORY_LENGTH[k.level];
	const stage = STAGES.find((s) => s.level === k.level);
	const topics = previous.map((s) => s.topic).filter((t): t is string => !!t).slice(-12);
	const series = genre === "robo" && world?.cast.length ? world : null;
	const lines = [
		genre === "robo" ? `Text: episode ${episode} of the ${lead ? `${lead} series` : "running series"}. Setting: ${theme}.` : `Text: ${genreInfo(genre, names).brief}.`,
		series ? `Series bible, keep them as written — the cast: ${series.cast.map((c) => `${c.name} (${c.gender === "f" ? "woman" : "man"}, ${c.age}) ${c.role}`).join("; ")}.` : "",
		series ? `The places they meet at: ${series.places.map((p) => p.name).join(", ")}.` : "",
		series ? `This episode's beat: "${series.beats[k.chapter] ?? `another day in ${series.city ?? "the city"}`}" — build the episode on it.` : "",
		topics.length ? `Already on the shelf (write about something else): ${topics.join("; ")}.` : "",
		`Learner level: ${k.level}${stage ? ` (${stage.title})` : ""}, working in the chapter "${k.chapterTitle}".`,
		`Length: ${len.min} to ${len.max} sentences. New words allowed: at most ${NEW_WORDS_MAX[k.level]}.`,
		questionLine(k.level),
		k.grammar.length ? `Grammar held (use it freely): ${k.grammar.join("; ")}.` : "Grammar held: only the present tense of common verbs, nouns in the nominative and the accusative after common verbs, and short questions.",
		k.practicing.length ? `Grammar being practiced now (use it a few times, correctly): ${k.practicing.join("; ")}.` : "",
		k.sample.length ? `Known words to lean on: ${k.sample.join(", ")}.` : "The learner is at the very start: use only the most common words (greetings, family, food and drink, the home, going places, numbers to ten).",
		k.purposes.length ? `The learner is learning ${lang.english} for: ${k.purposes.map((p) => purposeInfo(p).title.toLowerCase()).join(", ")}.` : "",
		k.note ? `In their own words: "${k.note.replace(/\s+/g, " ").slice(0, 300)}". Let the setting serve this when it can.` : "",
		genre !== "robo" ? "" : recaps.length ? `Earlier episodes, oldest first:\n${recaps.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}` : `This is the first episode: introduce ${lead ?? "the main character"} and one other person.`,
		`Today is ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}; the season may show.`,
	].filter(Boolean);
	return { genre, episode, theme, prompt: lines.join("\n") };
}

// ─── Generation ─────────────────────────────────────────────────────────────

interface GenerateOptions {
	/** Test seam: a scripted engine replaces the cheap slot's. */
	engine?: PiEngine;
	now?: Date;
	/** The model's label for the record ("provider:id"); the engine's when absent. */
	model?: string;
	/** The level to write for; the learner's own when absent. */
	level?: Cefr;
	/** The kind of text; a series episode when absent. */
	genre?: StoryGenre;
	/** A reader is waiting for it (true) or the shelf is being filled. */
	wanted?: boolean;
}

/** The cheap slot (stories are reading input, not teaching), else the
 *  strong one; null when no model is configured. */
export function storyEngine(): { engine: PiEngine; model: string } | null {
	const models = readSettings()?.models;
	const slot = models?.cheap?.model ? models.cheap : models?.strong?.model ? models.strong : null;
	if (!slot?.model) return null;
	// Writing a short graded text needs no extended thinking: with the
	// slot's thinking on, the wait doubled for no better Slovak.
	const spec = { provider: slot.model.provider, id: slot.model.id, thinkingLevel: "off" as const };
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

/** The Slovak sentences in the model's text so far (a screen shows them
 *  while the rest is still being written). */
export function sentencesSoFar(partial: string): string[] {
	const out: string[] = [];
	for (const m of partial.matchAll(/"sk"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
		try {
			out.push(JSON.parse(`"${m[1]}"`) as string);
		} catch {
			// a half-escaped sequence at the cut: skip it
		}
	}
	return out;
}

async function draft(engine: PiEngine, prompt: string, usage: StoryUsage, onPartial?: (text: string) => void, chatId?: string): Promise<StoryDraft> {
	const { text } = await runSubagent([], {
		role: "researcher",
		engine,
		systemPrompt: storySystem(activeLanguage(), loadWorld()),
		prompt,
		maxTurns: 1,
		onUsage: (u) => usage.steps.push(stepOf(u)),
		onPartialText: onPartial,
		chatId,
	});
	return parseStoryDraft(text);
}

/** The level's share of the questions, each stamped with its kind when
 *  the model forgot (the plan's kind at that position). */
function withKinds(questions: readonly StoryQuestion[], level: Cefr): StoryQuestion[] {
	const plan = QUESTION_PLAN[level];
	return questions.slice(0, plan.count).map((q, i) => (q.kind ? q : { ...q, kind: plan.kinds[i] ?? "recall" }));
}

/** Turn a draft into the record: gloss, measure, number. */
export function assembleStory(d: StoryDraft, brief: StoryBrief, k: KnownWords, lexicon: Lexicon | null, usage: StoryUsage, drafts: number, now: Date, voices: ReadonlySet<string> | null = null): StoryRecord {
	const newWords: StoryWord[] = d.newWords.map((w) => {
		const entry = lexicon ? resolveWord(lexicon, w.sk, k.known) : undefined;
		return entry ? { lemma: entryLemma(entry), gloss: entry.en, slug: entry.slug } : { lemma: w.sk, gloss: w.en };
	});
	const names = storyNames(d.sentences, lexicon);
	const sentences = d.sentences.map((s) => ({ ...glossSentence(s.sk, s.en, lexicon, k.known, newWords, names, k.met), ...(s.who ? { who: s.who } : {}) }));
	const cast = assignVoices(d.cast, voices);
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
		id: brief.genre === "robo" ? storyId(brief.episode, d.title) : `${brief.genre}-${storyId(0, d.title).replace(/^ep-000-/, "")}`,
		lang: code(),
		series: brief.genre === "robo" ? STORY_SERIES : brief.genre,
		episode: brief.episode,
		title: d.title,
		level: k.level,
		chapter: k.chapter,
		theme: brief.theme,
		genre: brief.genre,
		...(d.topic ? { topic: d.topic } : {}),
		cast,
		narratorVoice: NARRATOR_VOICE,
		createdAt: now.toISOString(),
		sentences,
		questions: withKinds(d.questions, k.level),
		newWords: newWords.slice(0, 12),
		recap: d.recap || d.sentences.map((s) => s.en).join(" ").slice(0, 300),
		coverage: Math.round(coverage * 1000) / 1000,
		wordCount,
		usage,
		drafts,
	};
}

// One story at a time, in a queue: a reader's request and the shelf's
// background writing never run two model calls at once. On globalThis:
// Next dev gives each route its own module instances.
interface Writing {
	queue: Promise<unknown>;
	progress: WritingProgress | null;
	shelfRunning: boolean;
}
const g = globalThis as unknown as { __lhStoryWriting?: Writing };
const writing: Writing = (g.__lhStoryWriting ??= { queue: Promise.resolve(), progress: null, shelfRunning: false });

/** What is being written right now, if anything. */
export function generating(): WritingProgress | null {
	return writing.progress;
}

/** Write one story and keep it. Calls queue behind each other. */
export function generateStory(opts: GenerateOptions = {}): Promise<StoryRecord> {
	const run = writing.queue.then(() => writeStory(opts), () => writeStory(opts));
	writing.queue = run.catch(() => undefined);
	return run;
}

async function writeStory(opts: GenerateOptions): Promise<StoryRecord> {
	const now = opts.now ?? new Date();
	const lexicon = loadLexicon();
	const k = knownWords(lexicon, opts.level);
	const genre = opts.genre ?? "robo";
	const previous = storyStore.list();
	const recaps = previous
		.filter((s) => (s.genre ?? "robo") === "robo")
		.slice(-4)
		.map((s) => storyStore.get(s.id)?.recap)
		.filter((r): r is string => !!r);
	const brief = storyBrief(k, previous, recaps, now, genre, loadWorld());
	let engine = opts.engine;
	let model = opts.model;
	if (!engine) {
		const resolved = storyEngine();
		if (!resolved) throw new Error("No model is configured. Pick one in Settings → AI models.");
		engine = resolved.engine;
		model ??= resolved.model;
	}
	const usage: StoryUsage = { model: model ?? "faux:faux", steps: [] };
	const progress: WritingProgress = { level: k.level, genre, startedAt: now.toISOString(), sentences: [], wanted: opts.wanted ?? true };
	writing.progress = progress;
	const onPartial = (text: string) => {
		progress.sentences = sentencesSoFar(text);
	};
	try {
		const voices = opts.engine ? null : await availableVoiceIds();
		const d1 = await draft(engine, brief.prompt, usage, onPartial);
		let first = assembleStory(d1, brief, k, lexicon, usage, 1, now, voices);
		if (first.coverage < COVERAGE_FLOOR) {
			// Too many stray unknown words: once more, naming the ones to drop.
			const declared = new Set(d1.newWords.map((w) => foldDiacritics(w.sk.toLocaleLowerCase(tag()))));
			const stray = (t: StoryToken) => t.fresh && !declared.has(foldDiacritics((t.lemma ?? t.text).toLocaleLowerCase(tag())));
			const hard = [...new Set(first.sentences.flatMap((s) => s.tokens).filter(stray).map((t) => t.lemma ?? t.text))].slice(0, 30);
			const again = `${brief.prompt}\n\nYour first draft used too many words the learner does not know (${Math.round((1 - first.coverage) * 100)} in 100). Write the text again with simpler, more common words. Avoid these in particular: ${hard.join(", ")}. Keep the same plot.`;
			progress.sentences = [];
			try {
				const second = assembleStory(await draft(engine, again, usage, onPartial), brief, k, lexicon, usage, 2, now, voices);
				if (second.coverage >= first.coverage) first = second;
				else first = { ...first, usage, drafts: 2 };
			} catch {
				first = { ...first, usage, drafts: 2 };
			}
		}
		// Two texts on the same day cannot share an id.
		if (storyStore.get(first.id)) first = { ...first, id: `${first.id}-${now.getTime().toString(36).slice(-4)}` };
		storyStore.put(first);
		ensureReadmes();
		return first;
	} finally {
		if (writing.progress === progress) writing.progress = null;
	}
}

// ─── The shelf ──────────────────────────────────────────────────────────────

/** Unread stories, as full records (the picker reads their words). */
function unreadStories(): StoryRecord[] {
	return library()
		.filter((s) => s.reads === 0)
		.map((s) => storyStore.get(s.id))
		.filter((s): s is StoryRecord => s !== null);
}

function recentReads(): { genres: StoryGenre[]; topics: string[] } {
	const index = new Map(storyStore.list().map((s) => [s.id, s]));
	const reads = storyStore.reads().slice(-8);
	return {
		genres: reads.map((r) => index.get(r.storyId)?.genre ?? "robo"),
		topics: reads.map((r) => index.get(r.storyId)?.topic).filter((t): t is string => !!t),
	};
}

/** How many stories were written today (the shelf's spend guard). */
function writtenToday(now: Date): number {
	const day = now.toISOString().slice(0, 10);
	return storyStore.list().filter((s) => s.createdAt.slice(0, 10) === day).length;
}

/** Fill the shelf: the current chapter's story episode first (the arc's
 *  story step — one episode per chapter, seeded from the story bible),
 *  then what `shelfNeeds` lists, one story after the other on the cheap
 *  slot, within the day's cap. Returns how many were written. Safe to
 *  call often: a second call while one runs returns 0. */
export async function fillShelf(opts: GenerateOptions = {}): Promise<number> {
	if (writing.shelfRunning) return 0;
	if (!opts.engine && !storyEngine()) return 0;
	writing.shelfRunning = true;
	let written = 0;
	try {
		for (let round = 0; round < 12; round++) {
			const now = opts.now ?? new Date();
			if (writtenToday(now) >= SHELF_DAILY_CAP) break;
			const k = knownWords(loadLexicon());
			// The chapter's episode is written once, read or not (read ones
			// are listed too), before the shelf's generic top-up.
			if (!storyStore.list().some((s) => s.chapter === k.chapter)) {
				await generateStory({ ...opts, wanted: false });
				written++;
				continue;
			}
			const need = shelfNeeds(k.level, unreadStories(), recentReads().genres)[0];
			if (!need) break;
			await generateStory({ ...opts, level: need.level, genre: need.genre, wanted: false });
			written++;
		}
	} finally {
		writing.shelfRunning = false;
	}
	return written;
}

/** Start filling the shelf in the background; errors are logged, never thrown. */
function kickShelf(): void {
	void fillShelf().catch((err) => console.warn("[read] shelf:", err instanceof Error ? err.message : err));
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

/** The picker's choice among the unread stories, with its reason. The
 *  current chapter's unread episodes come before the fit scoring (the
 *  arc's story step). */
function pickNext(lexicon: Lexicon | null = loadLexicon()): { story: StoryRecord; reason: PickReason } | null {
	const k = knownWords(lexicon);
	const recent = recentReads();
	return pickStory(unreadStories(), { level: k.level, known: k.known, recentGenres: recent.genres, recentTopics: recent.topics, chapter: k.chapter });
}

export function readingState(tz?: number, now = new Date(), opts: { topUpShelf?: boolean } = {}): ReadingState {
	const lib = library();
	const today = dayKey(now, tz);
	const readToday = storyStore.reads().filter((r) => r.day === today).length;
	const canWrite = storyEngine() !== null;
	const pick = pickNext();
	if (canWrite && opts.topUpShelf !== false) kickShelf();
	return {
		current: pick?.story ?? null,
		library: lib,
		canWrite,
		generating: generating(),
		readToday,
		...(pick ? { pick: pick.reason } : {}),
	};
}

/** The story to read: an unread episode of the current chapter first (the
 *  arc's story step), else the shelf's best fit, else a new one written
 *  now — the chapter's episode when it has none yet, else a series episode
 *  or the genre the shelf lacks most. */
export async function nextStory(opts: GenerateOptions = {}): Promise<StoryRecord> {
	const pick = pickNext();
	if (pick) return pick.story;
	const k = knownWords(loadLexicon());
	if (!library().some((s) => s.chapter === k.chapter)) {
		const chapterStory = await generateStory({ ...opts, wanted: true });
		if (!opts.engine) kickShelf();
		return chapterStory;
	}
	const need = shelfNeeds(k.level, unreadStories(), recentReads().genres)[0];
	const story = await generateStory({ ...opts, level: need?.level ?? k.level, genre: need?.genre ?? "robo", wanted: true });
	if (!opts.engine) kickShelf();
	return story;
}

// ─── Recording a reading ────────────────────────────────────────────────────

interface ReadResultInput {
	storyId: string;
	answers: number[];
	/** Slugs tapped for a gloss. */
	tapped: string[];
	ms?: number;
	/** Active milliseconds since the last send (src/core/active-time.ts). */
	activeMs?: number;
	tz?: number;
}

interface ReadOutcome {
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
	addMinutes(d, "read", sessionMs(input));
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
	// Something read means a gap on the shelf: fill it while the learner
	// looks at the end screen.
	if (storyEngine()) kickShelf();
	return { xp, correct, total, queued, reread, summary: progressSummary(input.tz, now) };
}
