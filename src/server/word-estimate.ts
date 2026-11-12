import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import { curriculumState, type Cefr } from "../core/curriculum.ts";
import { retrievability } from "../core/fsrs.ts";
import { rng, shortGloss, shuffle } from "../core/lesson.ts";
import { creditedWords } from "../core/milestones.ts";
import { isGrim } from "../core/onboarding.ts";
import { grammarWord } from "../core/reading.ts";
import { dayKey, entryLemma, exampleText, pickClozeExample, type LexiconEntry } from "../core/review.ts";
import {
	ANSWERS_FOR_A_MEASURED_ESTIMATE,
	CHECK_LENGTH,
	estimateWords,
	fitKnowledgeCurve,
	nextCheckWord,
	type CheckAnswer,
	type EstimateRange,
	type KnowledgeCurve,
	type RankedWord,
	type WordCheckFeedback,
	type WordCheckItem,
	type WordCheckResult,
	type WordCheckStart,
	type WordEstimate,
	type WordEstimateReport,
	type WordEvidence,
} from "../core/word-estimate.ts";
import { knownWordStore } from "../store/known-words.ts";
import { defaultGoal, progressStore } from "../store/progress.ts";
import { reviewStore } from "../store/review.ts";
import { wordCheckStore, type OpenWordCheck } from "../store/word-check.ts";
import { activeLanguage } from "./active-language.ts";
import { recordActiveTime } from "./lesson.ts";
import { frequencyOrder, wordsWithNoPlaceInTheFrequencyOrder } from "./reading.ts";

const DAY_MS = 86_400_000;
const DISTRACTORS = 3;
const HISTORY_DAYS_SHOWN = 90;
const GLOSS_WORDS_THAT_SAY_NOTHING = new Set(["the", "and", "for", "not", "with", "from", "into", "onto", "about", "sth", "something", "someone", "somebody", "oneself", "one's", "that", "this"]);

interface Gathered {
	lexicon: Lexicon;
	ranked: RankedWord[];
	rankOf: Map<string, number>;
	evidence: Map<string, WordEvidence>;
	answers: CheckAnswer[];
	curve: KnowledgeCurve;
	level: Cefr;
}

const daysBetween = (from: string | undefined, now: Date) => (from ? Math.max(0, (now.getTime() - Date.parse(from)) / DAY_MS) : 0);

function gather(now: Date): Gathered | null {
	const lexicon = loadLexicon();
	if (!lexicon) return null;
	const ranked = frequencyOrder(lexicon).map((slug, i) => ({ slug, rank: i + 1 }));
	const rankOf = new Map(ranked.map((w) => [w.slug, w.rank]));
	const evidence = new Map<string, WordEvidence>();
	const evidenceOf = (slug: string) => {
		let e = evidence.get(slug);
		if (!e) evidence.set(slug, (e = {}));
		return e;
	};
	for (const card of Object.values(reviewStore.readCards())) {
		if (card.suspended || card.reps === 0 || !card.memory) continue;
		const recall = retrievability(daysBetween(card.lastReview, now), card.memory.stability);
		const e = evidenceOf(card.slug);
		e.reviewRecall = Math.max(e.reviewRecall ?? 0, recall);
	}
	for (const slug of knownWordStore.slugs()) evidenceOf(slug).marked = true;
	const answers: CheckAnswer[] = [];
	for (const a of wordCheckStore.answers()) {
		const rank = rankOf.get(a.slug);
		if (rank === undefined) continue;
		const answer = { slug: a.slug, rank, known: a.known, saidDontKnow: a.picked === null, ageDays: daysBetween(a.at, now) };
		answers.push(answer);
		evidenceOf(a.slug).check = { known: answer.known, ageDays: answer.ageDays };
	}
	const p = progressStore.read();
	const goal = p.goal ?? defaultGoal();
	const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	const priorSize = creditedWords(goal.vocabulary, state.level, state.levelProgress);
	return { lexicon, ranked, rankOf, evidence, answers, curve: fitKnowledgeCurve(answers, priorSize, ranked.length), level: state.level };
}

export function meaningOffered(entry: Pick<LexiconEntry, "en">): string {
	return shortGloss(entry.en)
		.replace(/\s*\([^)]*\)/g, "")
		.trim();
}

function isCheckable(entry: LexiconEntry, tag: string): boolean {
	const lemma = entryLemma(entry);
	if (entry.cat === "Places" || lemma.length < 2 || !meaningOffered(entry)) return false;
	if (lemma.charAt(0) !== lemma.charAt(0).toLocaleLowerCase(tag)) return false;
	return !grammarWord(lemma) && !isGrim(lemma) && !isGrim(entry.en);
}

function untestedCheckableWords(g: Gathered, alsoSkip: ReadonlySet<string>): RankedWord[] {
	const tag = activeLanguage().tag;
	const inDeck = new Set(Object.values(reviewStore.readCards()).map((c) => c.slug));
	const unplaced = wordsWithNoPlaceInTheFrequencyOrder(g.lexicon);
	return g.ranked.filter((w) => !g.evidence.has(w.slug) && !inDeck.has(w.slug) && !alsoSkip.has(w.slug) && !unplaced.has(w.slug) && isCheckable(g.lexicon.bySlug.get(w.slug)!, tag));
}

const rangeOf = (e: WordEstimate): EstimateRange => ({ total: e.total, low: e.low, high: e.high });

export function wordEstimateReport(now = new Date()): WordEstimateReport {
	const g = gather(now);
	const sessions = wordCheckStore.sessions();
	const history = Object.entries(wordCheckStore.history())
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(-HISTORY_DAYS_SHOWN)
		.map(([day, d]) => ({ day, total: d.total }));
	if (!g) return { estimate: null, measured: false, level: null, checks: sessions.length, history, wordsLeftToCheck: 0, checkLength: CHECK_LENGTH };
	const estimate = estimateWords(g.ranked, g.evidence, g.curve);
	const lastCheckAt = sessions.at(-1)?.endedAt;
	return {
		estimate,
		measured: estimate.answers >= ANSWERS_FOR_A_MEASURED_ESTIMATE,
		level: g.level,
		checks: sessions.length,
		...(lastCheckAt ? { lastCheckAt } : {}),
		history,
		wordsLeftToCheck: untestedCheckableWords(g, new Set()).length,
		checkLength: CHECK_LENGTH,
	};
}

export function recordEstimateDay(now = new Date(), tz?: number): WordEstimateReport {
	const report = wordEstimateReport(now);
	const e = report.estimate;
	if (!e) return report;
	const day = dayKey(now, tz ?? now.getTimezoneOffset());
	wordCheckStore.putDay(day, { ...rangeOf(e), review: e.parts.review, marked: e.parts.marked, checked: e.parts.checked, inferred: e.parts.inferred, answers: e.answers });
	return wordEstimateReport(now);
}

const contentWords = (gloss: string) =>
	new Set(
		gloss
			.toLowerCase()
			.split(/[^a-z']+/)
			.filter((w) => w.length >= 3 && !GLOSS_WORDS_THAT_SAY_NOTHING.has(w)),
	);

function distractorsFor(target: LexiconEntry, g: Gathered, rand: () => number): LexiconEntry[] {
	const tag = activeLanguage().tag;
	const rank = g.rankOf.get(target.slug) ?? g.ranked.length;
	const targetWords = contentWords(target.en);
	const taken = new Set([meaningOffered(target).toLowerCase()]);
	const usable = (e: LexiconEntry) => e.slug !== target.slug && isCheckable(e, tag) && ![...contentWords(e.en)].some((w) => targetWords.has(w));
	const near = (e: LexiconEntry) => {
		const r = g.rankOf.get(e.slug) ?? Infinity;
		return r >= rank / 2 - 50 && r <= rank * 2 + 200;
	};
	const sameKind = g.lexicon.entries.filter((e) => e.cat === target.cat && usable(e));
	const picks: LexiconEntry[] = [];
	for (const pool of [sameKind.filter(near), sameKind, g.lexicon.entries.filter(usable)]) {
		for (const e of shuffle(pool, rand)) {
			if (picks.length >= DISTRACTORS) return picks;
			const gloss = meaningOffered(e).toLowerCase();
			if (taken.has(gloss)) continue;
			taken.add(gloss);
			picks.push(e);
		}
	}
	return picks;
}

function itemOf(check: OpenWordCheck, lexicon: Lexicon): WordCheckItem | null {
	if (!check.pending) return null;
	const entry = lexicon.bySlug.get(check.pending.slug);
	if (!entry) return null;
	return { slug: entry.slug, word: entryLemma(entry), options: check.pending.options.map((slug) => meaningOffered(lexicon.bySlug.get(slug) ?? { en: "" })) };
}

function drawNext(check: OpenWordCheck, g: Gathered): void {
	delete check.pending;
	if (check.asked.length >= CHECK_LENGTH) return;
	const rand = rng(check.seed + check.asked.length * 7919);
	const word = nextCheckWord(untestedCheckableWords(g, new Set(check.asked)), g.curve, check.asked.length, rand);
	const entry = word && g.lexicon.bySlug.get(word.slug);
	if (!entry) return;
	check.pending = { slug: entry.slug, options: shuffle([entry, ...distractorsFor(entry, g, rand)], rand).map((e) => e.slug) };
}

export function startWordCheck(now = new Date(), seed = now.getTime() % 1_000_000): WordCheckStart {
	const g = gather(now);
	if (!g) throw new Error("This language has no dictionary to check words against yet.");
	const check: OpenWordCheck = {
		id: `wc_${now.getTime().toString(36)}_${Math.floor(rng(seed)() * 46656).toString(36)}`,
		startedAt: now.toISOString(),
		seed,
		before: rangeOf(estimateWords(g.ranked, g.evidence, g.curve)),
		asked: [],
	};
	drawNext(check, g);
	const item = itemOf(check, g.lexicon);
	if (!item) throw new Error("Every word in the dictionary has been checked or is in Review already.");
	wordCheckStore.putOpen(check);
	return { id: check.id, item, progress: { asked: 0, total: CHECK_LENGTH } };
}

export interface WordCheckAnswerInput {
	id: string;
	slug: string;
	pick: number | null;
	ms?: number;
}

export function answerWordCheck(input: WordCheckAnswerInput, now = new Date()): WordCheckFeedback {
	const check = wordCheckStore.open();
	if (!check || check.id !== input.id) throw new Error("No such word check.");
	const pending = check.pending;
	if (!pending || pending.slug !== input.slug) throw new Error("That word was answered already.");
	const before = gather(now);
	const entry = before?.lexicon.bySlug.get(pending.slug);
	if (!before || !entry) throw new Error("The dictionary has no such word.");
	const picked = input.pick === null ? null : (pending.options[input.pick] ?? null);
	const known = picked === pending.slug;
	wordCheckStore.appendAnswer({
		at: now.toISOString(),
		session: check.id,
		slug: entry.slug,
		lemma: entryLemma(entry),
		rank: before.rankOf.get(entry.slug) ?? before.ranked.length,
		options: pending.options,
		picked,
		known,
		...(input.ms !== undefined ? { ms: input.ms } : {}),
	});
	check.asked.push(entry.slug);
	const after = gather(now)!;
	drawNext(check, after);
	wordCheckStore.putOpen(check);
	const bestExample = entry.examples[pickClozeExample(entry) ?? -1];
	const example = bestExample && !isGrim(exampleText(bestExample)) && !isGrim(bestExample.en) ? bestExample : undefined;
	return {
		known,
		correctOption: pending.options.indexOf(pending.slug),
		lemma: entryLemma(entry),
		gloss: entry.en,
		...(example ? { example: { text: exampleText(example), translation: example.en } } : {}),
		item: itemOf(check, after.lexicon),
		progress: { asked: check.asked.length, total: CHECK_LENGTH },
	};
}

export function finishWordCheck(input: { id: string; activeMs?: number; tz?: number }, now = new Date()): WordCheckResult {
	const check = wordCheckStore.open();
	if (!check || check.id !== input.id) throw new Error("No such word check.");
	const mine = wordCheckStore.answers().filter((a) => a.session === check.id);
	const measuredNow = recordEstimateDay(now, input.tz);
	if (!measuredNow.estimate) throw new Error("This language has no dictionary to check words against yet.");
	const after = rangeOf(measuredNow.estimate);
	const known = mine.filter((a) => a.known).length;
	if (mine.length > 0) {
		wordCheckStore.appendSession({
			id: check.id,
			startedAt: check.startedAt,
			endedAt: now.toISOString(),
			answered: mine.length,
			known,
			before: check.before,
			after,
			measured: measuredNow.measured,
			...(input.activeMs !== undefined ? { activeMs: input.activeMs } : {}),
		});
		if (input.activeMs !== undefined) recordActiveTime("wordcheck", input.activeMs, input.tz, now);
	}
	wordCheckStore.closeOpen();
	const lexicon = loadLexicon();
	const inDeck = new Set(Object.values(reviewStore.readCards()).map((c) => c.slug));
	const missed = mine.filter((a) => !a.known).map((a) => ({ slug: a.slug, lemma: a.lemma, gloss: lexicon?.bySlug.get(a.slug)?.en ?? "", inReview: inDeck.has(a.slug) }));
	return { before: check.before, after, answered: mine.length, known, measured: measuredNow.measured, missed, report: wordEstimateReport(now) };
}
