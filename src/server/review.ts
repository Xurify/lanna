/**
 * Spaced review service — the cloze deck behind /review and
 * /api/review. Mints cards from the lexicon (agent/lexicon.ts) in
 * frequency order, a daily budget of new ones, and schedules every answer
 * with FSRS (core/fsrs.ts). Persistence: src/store/review.ts.
 */

import { activeProfile } from "../../config.ts";
import { processWide } from "../core/process-wide.ts";
import { loadLexicon } from "../agent/lexicon.ts";
import { compareAnswer, foldDiacritics } from "../core/language.ts";
import { activeLanguage } from "./active-language.ts";
import { nextDue, previewIntervals, review, type Rating } from "../core/fsrs.ts";
import { caseOfUnit, classifyExample, describeForm, shortGloss, triggerOf } from "../core/lesson.ts";
import { knownForms } from "../core/form-slip.ts";
import { grammarWord } from "../core/reading.ts";
import { missReason, missWordOf, startsQuestion, type MissReason, type MissWord } from "../core/review-miss.ts";
import { languageReference } from "../agent/language-reference.ts";
import { knownWords } from "./reading.ts";
import {
	ASSUMED_KNOWN,
	blankAround,
	blankAtSpans,
	blankFromSpans,
	blankSizeFor,
	dayKey,
	dueCards,
	entryLemma,
	lexiconOrder,
	mintCard,
	pickClozeExample,
	ratingCeiling,
	ratingFor,
	targetWordOf,
	type Blank,
	type LexiconEntry,
	type ReviewCard,
	type ReviewHelp,
	type ReviewLogEntry,
	type ReviewSettings,
	type Span,
	type WordStrength,
} from "../core/review.ts";
import { reviewStore } from "../store/review.ts";
import { progressStore } from "../store/progress.ts";
import { flagWeak, tallyWeak, WEAK_REVIEW_LAPSES } from "../core/weak-spots.ts";
import { firstTryOf, recordFirstTry } from "../core/first-try.ts";
import { noteReviewMixup } from "./mixups.ts";
import { aiStatus } from "./ai-status.ts";
import { cachedMissNote, ensureMissNote } from "./miss-note.ts";
import { enoughEvidence, missNoteEvidence } from "../core/miss-note.ts";
import { activeHardWords } from "./hard-words.ts";

const DAY_MS = 86_400_000;
const INFLECTING_CATEGORIES = new Set(["Nouns", "Verbs", "Adjectives"]);
const tag = () => activeLanguage().tag;

const orderedByProfile = processWide("review.ordered", () => new Map<string, LexiconEntry[]>());
function orderedLexicon(): LexiconEntry[] {
	const profile = activeProfile();
	const hit = orderedByProfile.get(profile);
	if (hit) return hit;
	const lexicon = loadLexicon();
	const list = lexicon ? [...lexicon.entries].sort(lexiconOrder) : [];
	orderedByProfile.set(profile, list);
	return list;
}

/** Parse the lexicon and sort the deck order now, so the first card does not pay for it. */
export function warmLexicon(): void {
	orderedLexicon();
}

/** Mint the next unseen word's best sentence. Words already in the deck
 *  (any example) are skipped: one card per word until it is learned. */
function mintNext(cards: Record<string, ReviewCard>, now: Date, preferSlugs: string[] = []): ReviewCard | undefined {
	const have = new Set(Object.values(cards).map((c) => c.slug));
	const lexicon = loadLexicon();
	const candidates = [
		...preferSlugs.map((s) => lexicon?.bySlug.get(s)).filter((e): e is LexiconEntry => !!e),
		...orderedLexicon(),
	];
	for (const entry of candidates) {
		if (have.has(entry.slug)) continue;
		const idx = pickClozeExample(entry);
		if (idx === undefined) continue;
		const card = mintCard(entry, idx, now);
		if (card) return card;
	}
	return undefined;
}

interface ReviewPrompt {
	card: ReviewCard;
	/** The sentence around and between the gaps (one more piece than gaps). */
	pieces: string[];
	/** The hidden words in sentence order: the card's word, and other words of the sentence when the card hides several. */
	gaps: string[];
	/** What is graded: the gaps joined by spaces. */
	answer: string;
	/** Words the blank hides, and which of them is the card's word. */
	words: number;
	target: number;
	/** Where the gaps sit in the sentence; the answer sends them back, so it is graded against the blank that was on screen. */
	spans: Span[];
	/** Days each rating would schedule — the button labels. */
	intervals: Record<Rating, number>;
	/** Four choices including the answer, for multiple-choice mode. */
	options: string[];
	/** The word's facts for the verdict chips (see the lesson footer). */
	rank?: number;
	cat?: string;
	form?: string;
	/** Where the sentence comes from: the dictionary's own curated text or Tatoeba. */
	sentenceSource?: string;
}

export interface AnsweredLine {
	cardId: string;
	reviewedAt: string;
	pieces: string[];
	gaps: string[];
	translation: string;
	rating: Rating;
	verdict: ReviewLogEntry["verdict"];
	helped: boolean;
}

export const ANSWERED_LINES = 30;

interface ReviewStatus {
	profile: string;
	available: boolean;
	counts: {
		due: number;
		learning: number;
		newToday: number;
		newLeft: number;
		total: number;
		reviewedToday: number;
		cardsToday: number;
		dueUntouched: number;
		pendingNew: number;
		dueLater: number;
	};
	settings: ReviewSettings;
	next: ReviewPrompt | null;
	answered: AnsweredLine[];
	leeches: Array<{ id: string; slug: string; lemma: string; gloss: string; lapses: number; wrongs: number }>;
}

function distractors(card: ReviewCard): string[] {
	const lexicon = loadLexicon();
	const entry = lexicon?.bySlug.get(card.slug);
	const pool = orderedLexicon().filter((e) => e.slug !== card.slug && e.cat === entry?.cat);
	// Neighbors in frequency: plausible, not trivially wrong.
	const at = Math.max(
		0,
		pool.findIndex((e) => (e.rank ?? 1e9) >= (entry?.rank ?? 0)),
	);
	const window = pool.slice(Math.max(0, at - 40), at + 40);
	const seen = new Set([card.answer.toLocaleLowerCase(tag())]);
	const picks: string[] = [];
	const capital = card.answer.charAt(0) === card.answer.charAt(0).toLocaleUpperCase(tag());
	// The best wrong answers are the word's own other forms (hovorím next to
	// hovoríš, hovorí, hovoria): the choice is the ending, which is the point.
	// A form that differs only by accents is a typo, not a wrong answer.
	const folded = new Set([foldDiacritics(card.answer).toLocaleLowerCase(tag())]);
	const own = [
		...new Set([...(entry?.forms ?? []), ...(entry?.declension?.singular ?? []), ...(entry?.declension?.plural ?? [])]),
	];
	for (const f of own.sort((x, y) => hash(x + card.id) - hash(y + card.id))) {
		const k = f.toLocaleLowerCase(tag());
		const fk = foldDiacritics(k);
		if (!f.trim() || /\s/.test(f) || seen.has(k) || folded.has(fk)) continue;
		seen.add(k);
		folded.add(fk);
		picks.push(capital ? f.charAt(0).toLocaleUpperCase(tag()) + f.slice(1) : k);
		if (picks.length === 3) break;
	}
	// Prefer forms with the same ending as the answer (same case/person).
	const ending = card.answer.slice(-2).toLocaleLowerCase(tag());
	const scored = window
		.flatMap((e) => e.examples.filter((x) => x.cloze && !x.rejected).map((x) => x.cloze!.answer))
		.map((a) => ({ a, s: a.toLocaleLowerCase(tag()).endsWith(ending) ? 0 : 1 }))
		.sort((x, y) => x.s - y.s || hash(x.a + card.id) - hash(y.a + card.id));
	for (const { a } of scored) {
		if (picks.length >= 3) break;
		const k = a.toLocaleLowerCase(tag());
		if (seen.has(k)) continue;
		seen.add(k);
		picks.push(capital ? a.charAt(0).toLocaleUpperCase(tag()) + a.slice(1) : a.toLocaleLowerCase(tag()));
		if (picks.length === 3) break;
	}
	const options = [card.answer, ...picks];
	return options.sort((x, y) => hash(x + card.id) - hash(y + card.id));
}

function hash(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return h >>> 0;
}

/** What the learner knows of each word. The deck is the evidence: a word with a card counts by its strongest card's stability, and a card not yet past learning counts as nothing. A word with no card counts as assumed when the learner's level, lessons or own marking say it is known. */
function wordStrength(cards: Record<string, ReviewCard>): WordStrength {
	const stabilityBySlug = new Map<string, number>();
	for (const c of Object.values(cards))
		if (!c.suspended)
			stabilityBySlug.set(
				c.slug,
				Math.max(stabilityBySlug.get(c.slug) ?? 0, c.state === "review" ? (c.memory?.stability ?? 0) : 0),
			);
	const lexicon = loadLexicon();
	const assumed = knownWords(lexicon).known;
	return (word) => {
		const entries = lexicon?.byForm.get(word.toLocaleLowerCase(tag())) ?? [];
		const tested = entries.filter((e) => stabilityBySlug.has(e.slug));
		if (tested.length > 0) return Math.max(...tested.map((e) => stabilityBySlug.get(e.slug)!));
		return entries.some((e) => assumed.has(e.slug)) ? ASSUMED_KNOWN : undefined;
	};
}

/** Spans as a request carried them: pairs of whole numbers, or undefined. Whether they fit the sentence is `blankAtSpans`' check. */
export function spansOf(raw: unknown): Span[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const spans = raw.filter(
		(pair): pair is Span =>
			Array.isArray(pair) && pair.length === 2 && pair.every((n) => Number.isInteger(n) && n >= 0),
	);
	return spans.length === raw.length ? spans : undefined;
}

/** The card's blank: the spans the screen showed when they still fit the sentence, otherwise sized by the card's memory and filled with words the deck proves. */
export function blankOf(card: ReviewCard, spans?: readonly Span[], cards = reviewStore.readCards()): Blank {
	const shown = card.state === "new" ? undefined : blankAtSpans(card, spans);
	return shown ?? blankAround(card, blankSizeFor(card), hash(`${card.id}:${card.reps}`), wordStrength(cards));
}

/** The blank an answer in the log was given to. A line logged before spans were kept, or one whose sentence has changed since, shows the card's word alone. */
function loggedBlank(card: ReviewCard, spans: Span[] | undefined): Blank {
	const own: Span = [card.at, card.at + card.answer.length];
	const target = spans?.findIndex(([from, to]) => from === own[0] && to === own[1]) ?? -1;
	const ordered =
		!!spans &&
		spans.every(([from, to], i) => from < to && to <= card.sentence.length && (i === 0 || spans[i - 1]![1] <= from));
	return target >= 0 && ordered
		? blankFromSpans(card.sentence, spans!, target)
		: blankFromSpans(card.sentence, [own], 0);
}

function prompt(
	card: ReviewCard,
	now: Date,
	settings: ReviewSettings,
	cards: Record<string, ReviewCard>,
): ReviewPrompt {
	const elapsed = card.lastReview ? (now.getTime() - Date.parse(card.lastReview)) / DAY_MS : 0;
	const entry = loadLexicon()?.bySlug.get(card.slug);
	const unit = entry
		? classifyExample(entry, { sk: card.sentence, cloze: { answer: card.answer, at: card.at } })
		: null;
	const form = entry && unit ? describeForm(entry, card.answer, unit) : undefined;
	const sentenceSource = entry?.examples[Number(card.id.split("#")[1])]?.src;
	const blank = blankOf(card, undefined, cards);
	return {
		card,
		pieces: blank.pieces,
		gaps: blank.gaps,
		answer: blank.answer,
		words: blank.words,
		target: blank.target,
		spans: blank.spans,
		intervals: previewIntervals(card.memory, elapsed, { retention: settings.retention }),
		options: distractors(card),
		...(entry?.rank !== undefined ? { rank: entry.rank } : {}),
		...(entry?.cat ? { cat: entry.cat } : {}),
		...(form ? { form } : {}),
		...(sentenceSource ? { sentenceSource } : {}),
	};
}

/** Reviews logged on a local day. The log is chronological, so walk back from the newest line and
 *  stop two days short of now (no time zone is further off than 14 hours): the whole log is not scanned. */
function reviewedOn(
	today: string,
	now: Date,
	deck: Record<string, ReviewCard>,
	tzOffset?: number,
): { answers: number; cards: Set<string>; lines: AnsweredLine[] } {
	const log = reviewStore.readLog();
	const floor = now.getTime() - 2 * DAY_MS;
	let answers = 0;
	const cards = new Set<string>();
	const lines: AnsweredLine[] = [];
	for (let i = log.length - 1; i >= 0; i--) {
		const entry = log[i]!;
		const at = Date.parse(entry.reviewedAt ?? "");
		if (Number.isNaN(at)) continue;
		if (at < floor) break;
		if (dayKey(new Date(at), tzOffset) !== today) continue;
		answers++;
		cards.add(entry.cardId);
		const card = deck[entry.cardId];
		if (card && lines.length < ANSWERED_LINES) {
			const { pieces, gaps } = loggedBlank(card, entry.spans);
			lines.push({
				cardId: card.id,
				reviewedAt: entry.reviewedAt,
				pieces,
				gaps,
				translation: card.translation,
				rating: entry.rating,
				verdict: entry.verdict,
				helped: !!entry.hints || !!entry.picked,
			});
		}
	}
	return { answers, cards, lines };
}

export function reviewStatus(now = new Date(), tzOffset?: number, opts: { mint?: boolean } = {}): ReviewStatus {
	const cards = reviewStore.readCards();
	const meta = reviewStore.readMeta();
	const today = dayKey(now, tzOffset);
	const introduced = meta.introduced[today] ?? 0;
	const list = Object.values(cards);
	const due = dueCards(list, now);
	const answeredToday = reviewedOn(today, now, cards, tzOffset);
	const endOfDay = Date.parse(`${today}T00:00:00Z`) + (tzOffset ?? now.getTimezoneOffset()) * 60_000 + DAY_MS;
	const reviewedToday = answeredToday.answers;
	let next: ReviewCard | undefined = due[0];
	// Pending new cards first-come: a card minted but not yet answered.
	if (!next) next = list.find((c) => c.state === "new" && !c.suspended);
	if (!next && opts.mint !== false && introduced < meta.settings.newPerDay) {
		const minted = mintNext(cards, now);
		if (minted) {
			cards[minted.id] = minted;
			reviewStore.writeCards(cards);
			meta.introduced[today] = introduced + 1;
			reviewStore.writeMeta(meta);
			next = minted;
		}
	}
	return {
		profile: activeProfile(),
		available: orderedLexicon().length > 0,
		counts: {
			due: due.filter((c) => c.state === "review").length,
			learning: due.filter((c) => c.state === "learning").length,
			newToday: meta.introduced[today] ?? 0,
			newLeft: Math.max(0, meta.settings.newPerDay - (meta.introduced[today] ?? 0)),
			total: list.length,
			reviewedToday,
			// Distinct cards, not answers: a card answered three times today is one card, so the day's bar does not grow every time one comes back.
			cardsToday: answeredToday.cards.size,
			dueUntouched: due.filter((c) => !answeredToday.cards.has(c.id)).length,
			// New cards that already exist and have not been answered (minted just now, or put in the deck by a lesson, Listen or Read), which the daily budget does not count.
			pendingNew: Object.values(cards).filter((c) => c.state === "new" && !c.suspended).length,
			// Cards not seen today that fall due before the local day ends: the day's work that has not come due yet.
			dueLater: list.filter(
				(c) =>
					!c.suspended &&
					c.state !== "new" &&
					!answeredToday.cards.has(c.id) &&
					Date.parse(c.due) > now.getTime() &&
					Date.parse(c.due) < endOfDay,
			).length,
		},
		settings: meta.settings,
		next: next ? prompt(next, now, meta.settings, cards) : null,
		answered: answeredToday.lines,
		leeches: activeHardWords({ tz: tzOffset })
			.slice(0, 10)
			.map(({ id, slug, lemma, gloss, lapses, wrongs }) => ({ id, slug, lemma, gloss, lapses, wrongs })),
	};
}

interface ReviewAnswer {
	cardId: string;
	given: string;
	ms?: number;
	rating?: Rating;
	hints?: number;
	picked?: boolean;
	spans?: Span[];
}

interface ReviewOutcome {
	verdict: "exact" | "accents" | "wrong";
	rating: Rating;
	card: ReviewCard;
}

export function answerReview(input: ReviewAnswer, now = new Date()): ReviewOutcome {
	const cards = reviewStore.readCards();
	const card = cards[input.cardId];
	if (!card) throw new Error(`unknown card ${input.cardId}`);
	const meta = reviewStore.readMeta();
	const blank = blankOf(card, input.spans, cards);
	const verdict = compareAnswer(blank.answer, input.given, tag());
	const word = targetWordOf(blank, input.given);
	const wordVerdict = blank.words > 1 ? compareAnswer(card.answer, word, tag()) : verdict;
	const help: ReviewHelp = {
		...(input.hints ? { hints: input.hints } : {}),
		...(input.picked ? { picked: true } : {}),
	};
	const rating = Math.min(input.rating ?? ratingFor(verdict, input.ms, help), ratingCeiling(verdict, help)) as Rating;
	const elapsedDays = card.lastReview ? (now.getTime() - Date.parse(card.lastReview)) / DAY_MS : 0;
	const memory = review(card.memory, rating, elapsedDays);
	const updated: ReviewCard = {
		...card,
		memory,
		state: rating === 1 ? "learning" : "review",
		due: nextDue(now, memory, rating, { retention: meta.settings.retention }).toISOString(),
		reps: card.reps + 1,
		lapses: card.lapses + (rating === 1 && card.state === "review" ? 1 : 0),
		lastReview: now.toISOString(),
	};
	cards[card.id] = updated;
	reviewStore.writeCards(cards);
	noteWeakForm(updated, rating, now, wordVerdict === "wrong");
	noteReviewMixup(card, word, wordVerdict, input.hints, now);
	const form = noteFirstTry(card, input, word, wordVerdict);
	reviewStore.appendLog({
		cardId: card.id,
		rating,
		given: input.given,
		verdict,
		elapsedDays,
		reviewedAt: now.toISOString(),
		...(input.ms !== undefined ? { ms: input.ms } : {}),
		...(input.hints ? { hints: input.hints } : {}),
		...(input.picked ? { picked: true } : {}),
		...(blank.words > 1 ? { words: blank.words, spans: blank.spans } : {}),
		...form,
	});
	return { verdict, rating, card: updated };
}

export function reviewMiss(cardId: string, givenAnswer: string, spans?: Span[]): MissReason | null {
	return missOf(cardId, givenAnswer, spans)?.reason ?? null;
}

export async function reviewMissWithNote(
	cardId: string,
	givenAnswer: string,
	spans?: Span[],
): Promise<MissReason | null> {
	const miss = missOf(cardId, givenAnswer, spans);
	if (!miss?.reason.other?.notePending || !miss.entry || !miss.otherEntry) return miss?.reason ?? null;
	await ensureMissNote(miss.entry, miss.otherEntry);
	const after = reviewMiss(cardId, givenAnswer, spans);
	if (!after?.other?.notePending) return after;
	const { notePending: _unwritten, ...other } = after.other;
	return { ...after, other };
}

type MissTarget = Pick<ReviewCard, "slug" | "lemma" | "gloss" | "sentence" | "answer" | "at">;

/** The gap a wrong answer is explained on: the card's own word when it is
 *  the one missed, otherwise the first other hidden word typed wrong, as
 *  the dictionary's commonest entry with that form. */
const slovakGrammarWord = (form: string) => (tag().startsWith("sk") ? grammarWord(form) : undefined);

function missedGap(
	card: ReviewCard,
	blank: Blank,
	givenAnswer: string,
	lexicon: ReturnType<typeof loadLexicon>,
): { card: MissTarget; given: string } | null {
	const typed = givenAnswer.trim().split(/\s+/);
	if (blank.words <= 1 || typed.length !== blank.words) return { card, given: targetWordOf(blank, givenAnswer) };
	const wrong = (i: number) => compareAnswer(blank.gaps[i]!, typed[i]!, tag()) === "wrong";
	if (wrong(blank.target)) return { card, given: typed[blank.target]! };
	const gap = blank.gaps.findIndex((_, i) => i !== blank.target && wrong(i));
	if (gap < 0) return null;
	const answer = blank.gaps[gap]!;
	const commonerFirst = (a: LexiconEntry, b: LexiconEntry) => (a.rank ?? Infinity) - (b.rank ?? Infinity);
	const entry = [...(lexicon?.byForm.get(answer.toLocaleLowerCase(tag())) ?? [])].sort(commonerFirst)[0];
	const grammar = entry ? undefined : slovakGrammarWord(answer);
	const lemma = entry ? entryLemma(entry) : (grammar?.lemma ?? answer.toLocaleLowerCase(tag()));
	return {
		card: {
			slug: entry?.slug ?? "",
			lemma,
			gloss: entry ? shortGloss(entry.en) : (grammar?.gloss ?? ""),
			sentence: card.sentence,
			answer,
			at: blank.spans[gap]![0],
		},
		given: typed[gap]!,
	};
}

function missOf(
	cardId: string,
	givenAnswer: string,
	spans?: Span[],
): { reason: MissReason; entry?: LexiconEntry; otherEntry?: LexiconEntry } | null {
	const reviewCard = reviewStore.readCards()[cardId];
	if (!reviewCard) return null;
	const lexicon = loadLexicon();
	const missed = missedGap(reviewCard, blankOf(reviewCard, spans), givenAnswer, lexicon);
	if (!missed) return null;
	const { card, given } = missed;
	const entry = lexicon?.bySlug.get(card.slug);
	const unit = entry
		? classifyExample(entry, { sk: card.sentence, cloze: { answer: card.answer, at: card.at } })
		: null;
	const word = given.trim().toLocaleLowerCase(tag());
	const matches = word ? (lexicon?.byForm.get(word) ?? lexicon?.byFolded.get(foldDiacritics(word)) ?? []) : [];
	const samePartOfSpeechFirst = (a: LexiconEntry, b: LexiconEntry) =>
		Number(b.cat === entry?.cat) - Number(a.cat === entry?.cat);
	const commonerFirst = (a: LexiconEntry, b: LexiconEntry) => (a.rank ?? Infinity) - (b.rank ?? Infinity);
	const ranked = matches
		.filter((e) => e.slug !== card.slug)
		.map((e) => ({ e, isLemma: foldDiacritics(entryLemma(e).toLocaleLowerCase(tag())) === foldDiacritics(word) }))
		.sort(
			(a, b) => samePartOfSpeechFirst(a.e, b.e) || Number(b.isLemma) - Number(a.isLemma) || commonerFirst(a.e, b.e),
		);
	const aiReady = ranked.length > 0 && aiStatus().ready;
	const reference = languageReference(activeLanguage().id, tag());
	const rankedEntriesOfGiven: MissWord[] = ranked.map(({ e, isLemma }) => {
		const cached = entry ? cachedMissNote(entry, e) : undefined;
		const noteCanBeWritten = !cached && aiReady && !!entry && enoughEvidence(missNoteEvidence(entry, e, tag()));
		return missWordOf(
			{ slug: card.slug, lemma: card.lemma, entry },
			e,
			{
				typed: word,
				isLemma,
				language: activeLanguage().id,
				reference,
				...(cached?.status === "kept" ? { note: cached.note } : {}),
				noteCanBeWritten,
			},
			tag(),
		);
	});
	const givenGrammar = ranked.length === 0 && word ? slovakGrammarWord(word) : undefined;
	if (givenGrammar)
		rankedEntriesOfGiven.push({
			lemma: givenGrammar.lemma,
			gloss: givenGrammar.gloss,
			isLemma: givenGrammar.lemma === word,
		});
	const form = entry && unit ? describeForm(entry, card.answer, unit) : undefined;
	const trigger = unit && unit !== "words" ? triggerOf(card.sentence, card.at, unit) : undefined;
	const forms = entry ? knownForms(entry) : [];
	const neededCase = unit ? caseOfUnit(unit) : undefined;
	const reason = missReason(
		{
			answer: card.answer,
			lemma: card.lemma,
			gloss: entry ? shortGloss(entry.en) : card.gloss,
			given,
			forms,
			inflects: !entry || forms.length > 0 || INFLECTING_CATEGORIES.has(entry.cat),
			asks: startsQuestion(card.sentence, card.answer, tag()),
			form,
			trigger,
			...(entry?.declension ? { declension: entry.declension } : {}),
			...(neededCase ? { neededCase } : {}),
			isNoun: entry?.cat === "Nouns",
			rankedEntriesOfGiven,
		},
		tag(),
	);
	if (!reason) return null;
	reason.answer = card.answer;
	reason.given = given;
	const otherEntry = reason.other ? ranked[rankedEntriesOfGiven.indexOf(reason.other)]?.e : undefined;
	return { reason, ...(entry ? { entry } : {}), ...(otherEntry ? { otherEntry } : {}) };
}

/** A review answer as a first try (src/core/first-try.ts) on the drill its
 *  sentence practices, unless a hint came before the answer. Returns what
 *  the log keeps of it: the drill, the word's gender and a counted slip. A
 *  card with no drill (plain vocabulary) counts toward nothing. */
function noteFirstTry(
	card: ReviewCard,
	input: ReviewAnswer,
	given: string,
	verdict: ReviewLogEntry["verdict"],
): Pick<ReviewLogEntry, "unit" | "gender" | "slip"> {
	const entry = loadLexicon()?.bySlug.get(card.slug);
	const unit = entry
		? classifyExample(entry, { sk: card.sentence, cloze: { answer: card.answer, at: card.at } })
		: null;
	if (!entry || !unit) return {};
	const count = firstTryOf(
		{
			kind: input.picked ? "choose" : "type",
			unit,
			answer: card.answer,
			entry,
			first: { given, verdict, ...(input.hints ? { peeked: true } : {}) },
		},
		tag(),
	);
	try {
		if (count) {
			const p = progressStore.read();
			p.units[count.unit] = recordFirstTry(p.units[count.unit] ?? { lessons: 0, reps: 0, correct: 0 }, count);
			progressStore.write(p);
		}
	} catch (err) {
		console.warn("[review] could not record the first try:", err instanceof Error ? err.message : err);
	}
	return { unit, ...(entry.gender ? { gender: entry.gender } : {}), ...(count?.slip ? { slip: count.slip } : {}) };
}

/** The weak-spots record (src/core/weak-spots.ts): a card whose cloze is
 *  a grammar form counts its answer against that unit, and a card that
 *  keeps lapsing flags the unit. Words with no form (plain vocabulary)
 *  stay the deck's business. */
function noteWeakForm(card: ReviewCard, rating: Rating, now: Date, formMissed = rating === 1): void {
	const entry = loadLexicon()?.bySlug.get(card.slug);
	const unit = entry
		? classifyExample(entry, { sk: card.sentence, cloze: { answer: card.answer, at: card.at } })
		: null;
	if (!unit || unit === "words") return;
	try {
		const p = progressStore.read();
		let weak = p.weak ?? {};
		const miss = formMissed;
		weak = tallyWeak(weak, unit, miss ? 0 : 1, miss ? 1 : 0, now).weak;
		if (miss && !weak[unit] && card.lapses >= WEAK_REVIEW_LAPSES)
			weak = flagWeak(weak, unit, "review", `${card.lemma} missed repeatedly (${card.answer}, ×${card.lapses})`, now);
		if (weak !== (p.weak ?? {})) {
			p.weak = weak;
			progressStore.write(p);
		}
	} catch (err) {
		console.warn("[review] could not update the weak spots:", err instanceof Error ? err.message : err);
	}
}

export function suspendCard(cardId: string, suspended = true): void {
	const cards = reviewStore.readCards();
	if (!cards[cardId]) return;
	cards[cardId] = { ...cards[cardId], suspended };
	reviewStore.writeCards(cards);
}

export function updateReviewSettings(patch: Partial<ReviewSettings>): ReviewSettings {
	const meta = reviewStore.readMeta();
	const next: ReviewSettings = { ...meta.settings };
	if (typeof patch.newPerDay === "number" && Number.isFinite(patch.newPerDay))
		next.newPerDay = Math.max(0, Math.min(100, Math.round(patch.newPerDay)));
	if (typeof patch.retention === "number" && Number.isFinite(patch.retention))
		next.retention = Math.max(0.7, Math.min(0.97, patch.retention));
	reviewStore.writeMeta({ ...meta, settings: next });
	return next;
}

/** Queue specific words (the tutor taught them) ahead of the frequency
 *  order. Returns the slugs actually added. Not counted against the daily
 *  new-card budget: the learner just met these words. */
export function enqueueWords(slugs: string[], now = new Date()): string[] {
	const cards = reviewStore.readCards();
	const added: string[] = [];
	for (const slug of slugs) {
		const card = mintNext(cards, now, [slug]);
		if (card && card.slug === slug) {
			cards[card.id] = card;
			added.push(slug);
		}
	}
	if (added.length) reviewStore.writeCards(cards);
	return added;
}

export function reviewDigest(now = new Date()): string {
	const list = Object.values(reviewStore.readCards());
	if (list.length === 0) return "The learner has not started spaced review yet.";
	const due = dueCards(list, now).length;
	const learned = list.filter((c) => c.state === "review" && (c.memory?.stability ?? 0) >= 7).length;
	const hardwords = activeHardWords().slice(0, 12);
	return [
		`Spaced review: ${list.length} words in the deck, ${learned} stable for a week or more, ${due} due now.`,
		hardwords.length
			? `Words you keep missing: ${hardwords.map((c) => `${c.lemma} "${c.gloss}" ×${c.wrongs}`).join("; ")}.`
			: "No words are repeatedly missed.",
	].join("\n");
}
