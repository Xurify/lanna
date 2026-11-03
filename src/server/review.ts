/**
 * Spaced review service (LangHarness) — the cloze deck behind /review and
 * /api/review. Mints cards from the lexicon (agent/lexicon.ts) in
 * frequency order, a daily budget of new ones, and schedules every answer
 * with FSRS (core/fsrs.ts). Persistence: src/store/review.ts.
 */

import { ACTIVE_PROFILE } from "../../config.ts";
import { loadLexicon } from "../agent/lexicon.ts";
import { compareAnswer, foldDiacritics, LANGUAGES, isLanguageId } from "../core/language.ts";
import { nextDue, previewIntervals, review, type Rating } from "../core/fsrs.ts";
import { classifyExample, describeForm } from "../core/lesson.ts";
import { clozeParts, dayKey, dueCards, leeches, lexiconOrder, mintCard, pickClozeExample, ratingCap, ratingFor, type LexiconEntry, type ReviewCard, type ReviewHelp, type ReviewLogEntry, type ReviewSettings } from "../core/review.ts";
import { reviewStore } from "../store/review.ts";
import { progressStore } from "../store/progress.ts";
import { flagWeak, tallyWeak, WEAK_REVIEW_LAPSES } from "../core/weak-spots.ts";
import { firstTryOf, recordFirstTry } from "../core/first-try.ts";
import { noteReviewMixup } from "./mixups.ts";

const DAY_MS = 86_400_000;
const tag = () => (isLanguageId(ACTIVE_PROFILE) ? LANGUAGES[ACTIVE_PROFILE].tag : "sk-SK");

let ordered: { profile: string; list: LexiconEntry[] } | null = null;
function orderedLexicon(): LexiconEntry[] {
	if (ordered?.profile === ACTIVE_PROFILE) return ordered.list;
	const lexicon = loadLexicon();
	const list = lexicon ? [...lexicon.entries].sort(lexiconOrder) : [];
	ordered = { profile: ACTIVE_PROFILE, list };
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
	const candidates = [...preferSlugs.map((s) => lexicon?.bySlug.get(s)).filter((e): e is LexiconEntry => !!e), ...orderedLexicon()];
	for (const entry of candidates) {
		if (have.has(entry.slug)) continue;
		const idx = pickClozeExample(entry);
		if (idx === undefined) continue;
		const card = mintCard(entry, idx, now);
		if (card) return card;
	}
	return undefined;
}

export interface ReviewPrompt {
	card: ReviewCard;
	before: string;
	after: string;
	/** Days each rating would schedule — the button labels. */
	intervals: Record<Rating, number>;
	/** Four choices including the answer, for multiple-choice mode. */
	options: string[];
	/** The word's facts for the verdict chips (see the lesson footer). */
	rank?: number;
	cat?: string;
	form?: string;
}

export interface ReviewStatus {
	profile: string;
	available: boolean;
	counts: { due: number; learning: number; newToday: number; newLeft: number; total: number; reviewedToday: number; cardsToday: number; dueUntouched: number; pendingNew: number; dueLater: number };
	settings: ReviewSettings;
	next: ReviewPrompt | null;
	leeches: Array<Pick<ReviewCard, "id" | "lemma" | "gloss" | "lapses">>;
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
	const own = [...new Set([...(entry?.forms ?? []), ...(entry?.declension?.singular ?? []), ...(entry?.declension?.plural ?? [])])];
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

function prompt(card: ReviewCard, now: Date, settings: ReviewSettings): ReviewPrompt {
	const elapsed = card.lastReview ? (now.getTime() - Date.parse(card.lastReview)) / DAY_MS : 0;
	const entry = loadLexicon()?.bySlug.get(card.slug);
	const unit = entry ? classifyExample(entry, { sk: card.sentence, cloze: { answer: card.answer, at: card.at } }) : null;
	const form = entry && unit ? describeForm(entry, card.answer, unit) : undefined;
	return {
		card,
		...clozeParts(card),
		intervals: previewIntervals(card.memory, elapsed, { retention: settings.retention }),
		options: distractors(card),
		...(entry?.rank !== undefined ? { rank: entry.rank } : {}),
		...(entry?.cat ? { cat: entry.cat } : {}),
		...(form ? { form } : {}),
	};
}

/** Reviews logged on a local day. The log is chronological, so walk back from the newest line and
 *  stop two days short of now (no time zone is further off than 14 hours): the whole log is not scanned. */
function reviewedOn(today: string, now: Date, tzOffset?: number): { answers: number; cards: Set<string> } {
	const log = reviewStore.readLog();
	const floor = now.getTime() - 2 * DAY_MS;
	let answers = 0;
	const cards = new Set<string>();
	for (let i = log.length - 1; i >= 0; i--) {
		const at = Date.parse(log[i]?.reviewedAt ?? "");
		if (Number.isNaN(at)) continue;
		if (at < floor) break;
		if (dayKey(new Date(at), tzOffset) === today) {
			answers++;
			cards.add(log[i]!.cardId);
		}
	}
	return { answers, cards };
}

export function reviewStatus(now = new Date(), tzOffset?: number, opts: { mint?: boolean } = {}): ReviewStatus {
	const cards = reviewStore.readCards();
	const meta = reviewStore.readMeta();
	const today = dayKey(now, tzOffset);
	const introduced = meta.introduced[today] ?? 0;
	const list = Object.values(cards);
	const due = dueCards(list, now);
	const answeredToday = reviewedOn(today, now, tzOffset);
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
		profile: ACTIVE_PROFILE,
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
			dueLater: list.filter((c) => !c.suspended && c.state !== "new" && !answeredToday.cards.has(c.id) && Date.parse(c.due) > now.getTime() && Date.parse(c.due) < endOfDay).length,
		},
		settings: meta.settings,
		next: next ? prompt(next, now, meta.settings) : null,
		leeches: leeches(list)
			.slice(0, 10)
			.map(({ id, lemma, gloss, lapses }) => ({ id, lemma, gloss, lapses })),
	};
}

export interface ReviewAnswer {
	cardId: string;
	given: string;
	ms?: number;
	/** Override the derived rating (the learner pressed a button); still
	 *  capped by the help taken. */
	rating?: Rating;
	/** Hints taken before the answer (1 = meaning, 2 = the word too). */
	hints?: number;
	/** Picked from four rather than typed. */
	picked?: boolean;
}

export interface ReviewOutcome {
	verdict: "exact" | "accents" | "wrong";
	rating: Rating;
	card: ReviewCard;
}

export function answerReview(input: ReviewAnswer, now = new Date()): ReviewOutcome {
	const cards = reviewStore.readCards();
	const card = cards[input.cardId];
	if (!card) throw new Error(`unknown card ${input.cardId}`);
	const meta = reviewStore.readMeta();
	const verdict = compareAnswer(card.answer, input.given, tag());
	const help: ReviewHelp = { ...(input.hints ? { hints: input.hints } : {}), ...(input.picked ? { picked: true } : {}) };
	const rating = Math.min(input.rating ?? ratingFor(verdict, input.ms, help), ratingCap(help)) as Rating;
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
	noteWeakForm(updated, rating, now);
	noteReviewMixup(card, input.given, verdict, input.hints, now);
	const form = noteFirstTry(card, input, verdict);
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
		...form,
	});
	return { verdict, rating, card: updated };
}

/** A review answer as a first try (src/core/first-try.ts) on the drill its
 *  sentence practices, unless a hint came before the answer. Returns what
 *  the log keeps of it: the drill, the word's gender and a counted slip. A
 *  card with no drill (plain vocabulary) counts toward nothing. */
function noteFirstTry(card: ReviewCard, input: ReviewAnswer, verdict: ReviewLogEntry["verdict"]): Pick<ReviewLogEntry, "unit" | "gender" | "slip"> {
	const entry = loadLexicon()?.bySlug.get(card.slug);
	const unit = entry ? classifyExample(entry, { sk: card.sentence, cloze: { answer: card.answer, at: card.at } }) : null;
	if (!entry || !unit) return {};
	const count = firstTryOf({ kind: input.picked ? "choose" : "type", unit, answer: card.answer, entry, first: { given: input.given, verdict, ...(input.hints ? { peeked: true } : {}) } }, tag());
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
function noteWeakForm(card: ReviewCard, rating: Rating, now: Date): void {
	const entry = loadLexicon()?.bySlug.get(card.slug);
	const unit = entry ? classifyExample(entry, { sk: card.sentence, cloze: { answer: card.answer, at: card.at } }) : null;
	if (!unit || unit === "words") return;
	try {
		const p = progressStore.read();
		let weak = p.weak ?? {};
		const miss = rating === 1;
		weak = tallyWeak(weak, unit, miss ? 0 : 1, miss ? 1 : 0, now).weak;
		if (miss && !weak[unit] && card.lapses >= WEAK_REVIEW_LAPSES) weak = flagWeak(weak, unit, "review", `${card.lemma} keeps slipping (${card.answer}, ×${card.lapses})`, now);
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
	if (typeof patch.newPerDay === "number" && Number.isFinite(patch.newPerDay)) next.newPerDay = Math.max(0, Math.min(100, Math.round(patch.newPerDay)));
	if (typeof patch.retention === "number" && Number.isFinite(patch.retention)) next.retention = Math.max(0.7, Math.min(0.97, patch.retention));
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

/** A short plain-text digest for the tutor: what is due and which words
 *  keep slipping. */
export function reviewDigest(now = new Date()): string {
	const list = Object.values(reviewStore.readCards());
	if (list.length === 0) return "The learner has not started spaced review yet.";
	const due = dueCards(list, now).length;
	const learned = list.filter((c) => c.state === "review" && (c.memory?.stability ?? 0) >= 7).length;
	const slipping = leeches(list, 2).slice(0, 12);
	return [
		`Spaced review: ${list.length} words in the deck, ${learned} stable for a week or more, ${due} due now.`,
		slipping.length ? `Words that keep slipping (lapses): ${slipping.map((c) => `${c.lemma} "${c.gloss}" ×${c.lapses}`).join("; ")}.` : "No words are repeatedly slipping.",
	].join("\n");
}
