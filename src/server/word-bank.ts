/**
 * Word Bank and Saved Phrases service (LangHarness).
 *
 * Unifies the learner's vocabulary from:
 * - Active review deck cards (FSRS retention and state)
 * - Curated Slovak lexicon (frequency rank, category, POS, examples)
 * - Favorited words and bookmarked phrases
 */

import { loadLexicon, type Lexicon } from "../agent/lexicon.ts";
import { reviewStore } from "../store/review.ts";
import { savedPhraseStore } from "../store/saved-phrases.ts";
import {
	calculateRetention,
	classifyWordState,
	type WordBankItem,
	type WordBankSummary,
	type WordLearningState,
} from "../core/saved-phrases.ts";
import type { ReviewCard } from "../core/review.ts";

export interface WordBankQuery {
	search?: string;
	pos?: string;
	status?: "all" | "mastered" | "learning" | "new" | "unseen" | "favorite" | "due";
	limit?: number;
	offset?: number;
}

export interface WordBankResult {
	items: WordBankItem[];
	total: number;
	summary: WordBankSummary;
}

export function getWordBank(query: WordBankQuery = {}, now = new Date()): WordBankResult {
	const lexicon = loadLexicon();
	const cards = reviewStore.readCards();
	const favoritesSet = new Set(savedPhraseStore.readFavorites());
	const savedPhrases = savedPhraseStore.readPhrases();

	// Map cards by lemma/slug for instant lookup
	const cardBySlug = new Map<string, ReviewCard>();
	for (const card of Object.values(cards)) {
		if (!cardBySlug.has(card.slug)) {
			cardBySlug.set(card.slug, card);
		}
	}

	const entries = lexicon?.entries ?? [];
	const items: WordBankItem[] = [];

	let wordsMastered = 0;
	let wordsLearning = 0;
	let wordsDue = 0;
	let totalRetentionSum = 0;
	let cardsReviewedCount = 0;

	const searchLower = query.search?.trim().toLowerCase();
	const posFilter = query.pos?.trim().toLowerCase();

	for (const entry of entries) {
		const card = cardBySlug.get(entry.slug);
		const favorite = favoritesSet.has(entry.slug);
		const inDeck = !!card;

		let state: WordLearningState = "unseen";
		let retention = 0;
		let stability = 0;
		let reps = 0;
		let lapses = 0;
		let due: string | undefined;
		let lastReviewed: string | undefined;

		if (card) {
			reps = card.reps ?? 0;
			lapses = card.lapses ?? 0;
			stability = card.memory?.stability ?? 0;
			due = card.due;
			lastReviewed = card.lastReview;
			retention = calculateRetention(card);
			state = classifyWordState(card);

			if (state === "mastered") wordsMastered++;
			else if (state === "learning") wordsLearning++;

			if (card.due && new Date(card.due).getTime() <= now.getTime()) {
				wordsDue++;
			}

			if (reps > 0) {
				totalRetentionSum += retention;
				cardsReviewedCount++;
			}
		}

		// Apply filters
		if (query.status === "favorite" && !favorite) continue;
		if (query.status === "mastered" && state !== "mastered") continue;
		if (query.status === "learning" && state !== "learning") continue;
		if (query.status === "new" && state !== "new") continue;
		if (query.status === "unseen" && state !== "unseen") continue;
		if (query.status === "due" && (!due || new Date(due).getTime() > now.getTime())) continue;

		if (posFilter && posFilter !== "all") {
			const entryPos = (entry.pos ?? entry.cat ?? "").toLowerCase();
			if (!entryPos.includes(posFilter)) continue;
		}

		if (searchLower) {
			const matchSk = entry.sk.toLowerCase().includes(searchLower);
			const matchEn = entry.en.toLowerCase().includes(searchLower);
			const matchForms = entry.forms?.some((f) => f.toLowerCase().includes(searchLower));
			if (!matchSk && !matchEn && !matchForms) continue;
		}

		const example = entry.examples?.[0] ? { sk: entry.examples[0].sk, en: entry.examples[0].en } : undefined;

		items.push({
			slug: entry.slug,
			lemma: entry.sk,
			gloss: entry.en,
			pos: entry.pos ?? entry.cat,
			gender: entry.gender,
			rank: entry.rank,
			cat: entry.cat,
			state,
			stability,
			retention,
			reps,
			lapses,
			lastReviewed,
			due,
			example,
			favorite,
			inDeck,
		});
	}

	// Sort logic:
	// 1. Favorites and cards in deck come first if no explicit query
	// 2. Otherwise sort by frequency rank (lower rank = commoner)
	items.sort((a, b) => {
		if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
		if (a.inDeck !== b.inDeck) return a.inDeck ? -1 : 1;
		const rankA = a.rank ?? 99999;
		const rankB = b.rank ?? 99999;
		return rankA - rankB;
	});

	const offset = query.offset ?? 0;
	const limit = query.limit ?? 50;
	const paginated = items.slice(offset, offset + limit);

	const summary: WordBankSummary = {
		totalWords: entries.length,
		wordsMastered,
		wordsLearning,
		wordsDue,
		wordsFavorited: favoritesSet.size,
		savedPhrasesCount: savedPhrases.length,
		averageRetention: cardsReviewedCount > 0 ? Math.round(totalRetentionSum / cardsReviewedCount) : 0,
	};

	return {
		items: paginated,
		total: items.length,
		summary,
	};
}
