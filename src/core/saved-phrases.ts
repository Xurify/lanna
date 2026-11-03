/**
 * Saved Phrases and Word Bank (LangHarness) — pure models and calculations.
 *
 * Supports:
 * - Bookmarked / saved phrases from stories, scenes, lessons, and custom inputs.
 * - Favorited words with one-tap toggle across the app.
 * - Lingvist-style memory retention calculations based on FSRS stability and repetition history.
 */

export interface SavedPhrase {
	id: string;
	text: string;
	translation: string;
	source: "story" | "speak" | "lesson" | "review" | "manual";
	context?: string;
	savedAt: string;
	tags?: string[];
	notes?: string;
}

export type WordLearningState = "mastered" | "learning" | "new" | "unseen";

export interface WordBankItem {
	slug: string;
	lemma: string;
	gloss: string;
	pos?: string;
	gender?: string;
	rank?: number;
	cat?: string;
	state: WordLearningState;
	/** Stability in days from FSRS (0 if unreviewed). */
	stability: number;
	/** Estimated retention percentage (0 - 100%). Lingvist-style mastery gauge. */
	retention: number;
	reps: number;
	lapses: number;
	lastReviewed?: string;
	due?: string;
	example?: { sk: string; en: string };
	favorite: boolean;
	inDeck: boolean;
	/** Set only while searching: how the word matched (see word-search.ts). */
	match?: { kind: "start" | "contains" | "form" | "meaning" | "example"; span?: [number, number]; via?: string };
}

export interface WordBankSummary {
	totalWords: number;
	wordsMastered: number;
	wordsLearning: number;
	wordsDue: number;
	wordsFavorited: number;
	savedPhrasesCount: number;
	averageRetention: number;
}

/**
 * Calculates Lingvist/Speakly-style memory retention percentage (0–100%)
 * based on FSRS memory state and repetition history.
 */
export function calculateRetention(card?: {
	state: "new" | "learning" | "review";
	reps?: number;
	lapses?: number;
	memory?: { stability?: number; difficulty?: number };
}): number {
	if (!card) return 0;
	if (card.state === "new" || (card.reps ?? 0) === 0) return 0;

	const reps = card.reps ?? 1;
	const lapses = card.lapses ?? 0;
	const stability = card.memory?.stability ?? 1;

	if (card.state === "learning") {
		const base = 20 + Math.min(30, reps * 10);
		const penalty = Math.min(15, lapses * 8);
		return Math.max(10, Math.min(50, base - penalty));
	}

	let base = 50 + Math.min(50, Math.round(stability * 2.4));
	const lapsePenalty = Math.min(35, lapses * 10);
	const score = Math.max(15, Math.min(100, base - lapsePenalty));
	return score;
}

export function classifyWordState(card?: {
	state: "new" | "learning" | "review";
	reps?: number;
	lapses?: number;
	memory?: { stability?: number };
}): WordLearningState {
	if (!card) return "unseen";
	if (card.state === "new" || (card.reps ?? 0) === 0) return "new";
	const retention = calculateRetention(card);
	if (retention >= 80) return "mastered";
	return "learning";
}
