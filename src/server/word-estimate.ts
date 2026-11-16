import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import type { PiEngine } from "../agent/models.ts";
import { curriculumState, type Cefr } from "../core/curriculum.ts";
import { retrievability } from "../core/fsrs.ts";
import { rng } from "../core/lesson.ts";
import { creditedWords } from "../core/milestones.ts";
import { isGrim } from "../core/onboarding.ts";
import { grammarWord } from "../core/reading.ts";
import { dayKey, entryLemma, exampleText, pickClozeExample, type LexiconEntry } from "../core/review.ts";
import {
	ANSWERS_FOR_A_MEASURED_ESTIMATE,
	CHECK_LENGTH,
	answersForASteadyEstimate,
	dictionaryAccepts,
	estimateWords,
	fitKnowledgeCurve,
	meaningsInGloss,
	nextCheckWord,
	type CheckAnswer,
	type EstimateRange,
	type KnowledgeCurve,
	type RankedWord,
	type WordCheckFeedback,
	type WordCheckItem,
	type WordCheckMarker,
	type WordCheckResult,
	type WordCheckStart,
	type WordCheckVerdict,
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
import { frequencyOrder, usesInTheDictionarySentences, wordsWithNoPlaceInTheFrequencyOrder } from "./reading.ts";
import { canJudgeMeanings, judgeMeaning, wordCheckModel } from "./word-check-judge.ts";

const DAY_MS = 86_400_000;
const HISTORY_DAYS_SHOWN = 90;
const TYPED_LIMIT = 120;

interface Gathered {
	lexicon: Lexicon;
	ranked: RankedWord[];
	rankOf: Map<string, number>;
	evidence: Map<string, WordEvidence>;
	answers: CheckAnswer[];
	curve: KnowledgeCurve;
	level: Cefr;
}

const daysBetween = (from: string | undefined, now: Date) =>
	from ? Math.max(0, (now.getTime() - Date.parse(from)) / DAY_MS) : 0;

function gather(now: Date): Gathered | null {
	const lexicon = loadLexicon();
	if (!lexicon) return null;
	const uses = usesInTheDictionarySentences(lexicon);
	const ranked = frequencyOrder(lexicon).map((slug, i) => ({ slug, rank: i + 1, uses: uses.get(slug) ?? 0 }));
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
		if (rank === undefined || !a.verdict || a.verdict === "unchecked") continue;
		const answer = { slug: a.slug, rank, known: a.verdict === "known", ageDays: daysBetween(a.at, now) };
		answers.push(answer);
		evidenceOf(a.slug).check = { known: answer.known, ageDays: answer.ageDays };
	}
	const p = progressStore.read();
	const goal = p.goal ?? defaultGoal();
	const state = curriculumState(p.units, goal.level, { startChapter: goal.startChapter });
	const priorSize = creditedWords(goal.vocabulary, state.level, state.levelProgress);
	return {
		lexicon,
		ranked,
		rankOf,
		evidence,
		answers,
		curve: fitKnowledgeCurve(answers, priorSize, ranked.length),
		level: state.level,
	};
}

function isCheckable(entry: LexiconEntry, tag: string): boolean {
	const lemma = entryLemma(entry);
	if (entry.cat === "Places" || lemma.length < 2 || meaningsInGloss(entry.en).length === 0) return false;
	if (lemma.charAt(0) !== lemma.charAt(0).toLocaleLowerCase(tag)) return false;
	return !grammarWord(lemma) && !isGrim(lemma) && !isGrim(entry.en);
}

function untestedCheckableWords(g: Gathered, alsoSkip: ReadonlySet<string>): RankedWord[] {
	const tag = activeLanguage().tag;
	const inDeck = new Set(Object.values(reviewStore.readCards()).map((c) => c.slug));
	const unplaced = wordsWithNoPlaceInTheFrequencyOrder(g.lexicon);
	return g.ranked.filter(
		(w) =>
			!g.evidence.has(w.slug) &&
			!inDeck.has(w.slug) &&
			!alsoSkip.has(w.slug) &&
			!unplaced.has(w.slug) &&
			isCheckable(g.lexicon.bySlug.get(w.slug)!, tag),
	);
}

const rangeOf = (e: WordEstimate): EstimateRange => ({ total: e.total, low: e.low, high: e.high });

export function wordEstimateReport(now = new Date()): WordEstimateReport {
	const g = gather(now);
	const sessions = wordCheckStore.sessions();
	const history = Object.entries(wordCheckStore.history())
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(-HISTORY_DAYS_SHOWN)
		.map(([day, d]) => ({ day, total: d.total }));
	if (!g)
		return {
			estimate: null,
			measured: false,
			answersForASteadyEstimate: 0,
			level: null,
			checks: sessions.length,
			history,
			wordsLeftToCheck: 0,
			checkLength: CHECK_LENGTH,
		};
	const estimate = estimateWords(g.ranked, g.evidence, g.curve);
	const lastCheckAt = sessions.at(-1)?.endedAt;
	return {
		estimate,
		measured: estimate.answers >= ANSWERS_FOR_A_MEASURED_ESTIMATE,
		answersForASteadyEstimate: answersForASteadyEstimate(g.ranked.length),
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
	wordCheckStore.putDay(day, {
		...rangeOf(e),
		review: e.parts.review,
		marked: e.parts.marked,
		checked: e.parts.checked,
		inferred: e.parts.inferred,
		answers: e.answers,
	});
	return wordEstimateReport(now);
}

function itemOf(check: OpenWordCheck, lexicon: Lexicon): WordCheckItem | null {
	if (!check.pending) return null;
	const entry = lexicon.bySlug.get(check.pending.slug);
	if (!entry) return null;
	return { slug: entry.slug, word: entryLemma(entry) };
}

function drawNext(check: OpenWordCheck, g: Gathered): void {
	delete check.pending;
	if (check.asked.length >= CHECK_LENGTH) return;
	const rand = rng(check.seed + check.asked.length * 7919);
	const word = nextCheckWord(untestedCheckableWords(g, new Set(check.asked)), g.curve, check.asked.length, rand);
	const entry = word && g.lexicon.bySlug.get(word.slug);
	if (!entry) return;
	check.pending = { slug: entry.slug };
}

export function startWordCheck(now = new Date(), seed = now.getTime() % 1_000_000, engine?: PiEngine): WordCheckStart {
	const g = gather(now);
	if (!g) throw new Error("This language has no dictionary to check words against yet.");
	const check: OpenWordCheck = {
		id: `wc_${now.getTime().toString(36)}_${Math.floor(rng(seed)() * 46656).toString(36)}`,
		startedAt: now.toISOString(),
		seed,
		before: rangeOf(estimateWords(g.ranked, g.evidence, g.curve)),
		asked: [],
		usage: { model: wordCheckModel(engine), steps: [] },
	};
	drawNext(check, g);
	const item = itemOf(check, g.lexicon);
	if (!item) throw new Error("Every word in the dictionary has been checked or is in Review already.");
	wordCheckStore.putOpen(check);
	return { id: check.id, item, progress: { asked: 0, total: CHECK_LENGTH }, judges: canJudgeMeanings(engine) };
}

export interface WordCheckAnswerInput {
	id: string;
	slug: string;
	typed: string | null;
	ms?: number;
}

function meaningsOfTheWrittenWord(entry: LexiconEntry, lexicon: Lexicon): string[] {
	const tag = activeLanguage().tag;
	const written = entryLemma(entry).toLocaleLowerCase(tag);
	return [
		entry.en,
		...lexicon.entries
			.filter((e) => e.slug !== entry.slug && entryLemma(e).toLocaleLowerCase(tag) === written)
			.map((e) => e.en),
	];
}

async function markTyped(
	entry: LexiconEntry,
	glosses: readonly string[],
	typed: string | null,
	check: OpenWordCheck,
	now: Date,
	engine?: PiEngine,
): Promise<{ verdict: WordCheckVerdict; markedBy?: WordCheckMarker; note?: string }> {
	if (!typed) return { verdict: "dont-know" };
	if (dictionaryAccepts(glosses, typed)) return { verdict: "known", markedBy: "dictionary" };
	const judged = await judgeMeaning({ slug: entry.slug, word: entryLemma(entry), glosses, typed }, check.usage, {
		engine,
		now,
	});
	if (!judged) return { verdict: "unchecked" };
	return {
		verdict: judged.accepted ? "known" : "not-known",
		markedBy: "model",
		...(judged.note ? { note: judged.note } : {}),
	};
}

export async function answerWordCheck(
	input: WordCheckAnswerInput,
	now = new Date(),
	engine?: PiEngine,
): Promise<WordCheckFeedback> {
	const opened = wordCheckStore.open();
	if (!opened || opened.id !== input.id) throw new Error("No such word check.");
	if (opened.pending?.slug !== input.slug) throw new Error("That word was answered already.");
	const before = gather(now);
	const entry = before?.lexicon.bySlug.get(input.slug);
	if (!before || !entry) throw new Error("The dictionary has no such word.");
	const typed = input.typed?.trim().slice(0, TYPED_LIMIT) || null;
	const glosses = meaningsOfTheWrittenWord(entry, before.lexicon);
	const marked = await markTyped(entry, glosses, typed, opened, now, engine);
	const check = wordCheckStore.open();
	if (!check || check.id !== input.id || check.pending?.slug !== input.slug)
		throw new Error("That word was answered already.");
	check.usage = opened.usage;
	wordCheckStore.appendAnswer({
		at: now.toISOString(),
		session: check.id,
		slug: entry.slug,
		lemma: entryLemma(entry),
		rank: before.rankOf.get(entry.slug) ?? before.ranked.length,
		typed,
		...marked,
		...(input.ms !== undefined ? { ms: input.ms } : {}),
	});
	check.asked.push(entry.slug);
	const after = gather(now)!;
	drawNext(check, after);
	wordCheckStore.putOpen(check);
	const bestExample = entry.examples[pickClozeExample(entry) ?? -1];
	const example = bestExample && !isGrim(exampleText(bestExample)) && !isGrim(bestExample.en) ? bestExample : undefined;
	return {
		...marked,
		typed,
		lemma: entryLemma(entry),
		gloss: glosses.join("; "),
		...(example ? { example: { text: exampleText(example), translation: example.en } } : {}),
		item: itemOf(check, after.lexicon),
		progress: { asked: check.asked.length, total: CHECK_LENGTH },
	};
}

export function finishWordCheck(
	input: { id: string; activeMs?: number; tz?: number },
	now = new Date(),
): WordCheckResult {
	const check = wordCheckStore.open();
	if (!check || check.id !== input.id) throw new Error("No such word check.");
	const mine = wordCheckStore.answers().filter((a) => a.session === check.id);
	const measuredNow = recordEstimateDay(now, input.tz);
	if (!measuredNow.estimate) throw new Error("This language has no dictionary to check words against yet.");
	const after = rangeOf(measuredNow.estimate);
	const counted = mine.filter((a) => a.verdict !== "unchecked");
	const known = counted.filter((a) => a.verdict === "known").length;
	const unchecked = mine.length - counted.length;
	if (mine.length > 0) {
		wordCheckStore.appendSession({
			id: check.id,
			startedAt: check.startedAt,
			endedAt: now.toISOString(),
			answered: counted.length,
			known,
			unchecked,
			before: check.before,
			after,
			measured: measuredNow.measured,
			...(input.activeMs !== undefined ? { activeMs: input.activeMs } : {}),
			...(check.usage.steps.length > 0 ? { usage: check.usage } : {}),
		});
		if (input.activeMs !== undefined) recordActiveTime("wordcheck", input.activeMs, input.tz, now);
	}
	wordCheckStore.closeOpen();
	const lexicon = loadLexicon();
	const inDeck = new Set(Object.values(reviewStore.readCards()).map((c) => c.slug));
	const answers = counted
		.map((a) => ({
			slug: a.slug,
			lemma: a.lemma,
			gloss: lexicon?.bySlug.get(a.slug)?.en ?? "",
			rank: a.rank,
			verdict: a.verdict,
			typed: a.typed,
		}))
		.sort((x, y) => x.rank - y.rank);
	const missed = answers.filter((a) => a.verdict !== "known").map((a) => ({ ...a, inReview: inDeck.has(a.slug) }));
	return {
		before: check.before,
		after,
		answered: counted.length,
		known,
		unchecked,
		measured: measuredNow.measured,
		answers,
		missed,
		report: wordEstimateReport(now),
	};
}
