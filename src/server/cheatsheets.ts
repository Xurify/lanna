/**
 * Cheatsheets and the Review deck. A sheet's phrases are matched word by
 * word against the running language's lexicon; the words found can go into
 * Review, where each is drilled on the lexicon's own verified sentences
 * (E27), never on the sheet's lines.
 */

import { loadLexicon } from "../agent/lexicon.ts";
import { cheatsheetWords, type Cheatsheet } from "../core/cheatsheets.ts";
import { foldDiacritics } from "../core/language.ts";
import { reviewStore } from "../store/review.ts";
import { activeLanguage } from "./active-language.ts";
import { enqueueWords } from "./review.ts";

/** At most this many words go to Review on one press, so a long sheet
 *  does not bury the day's deck. */
export const CHEATSHEET_REVIEW_BATCH = 30;

export interface CheatsheetReviewState {
	/** Words of the sheet the dictionary knows, each lemma once. */
	inDictionary: number;
	/** Of those, the ones already in Review. */
	inReview: number;
}

function sheetSlugs(sheet: Cheatsheet): string[] {
	const lexicon = loadLexicon();
	if (!lexicon) return [];
	const tag = activeLanguage().tag;
	const slugs: string[] = [];
	const seen = new Set<string>();
	for (const word of cheatsheetWords(sheet, tag)) {
		const entry = lexicon.byForm.get(word)?.[0] ?? lexicon.byFolded.get(foldDiacritics(word))?.[0];
		if (!entry || seen.has(entry.slug)) continue;
		seen.add(entry.slug);
		slugs.push(entry.slug);
	}
	return slugs;
}

function deckSlugs(): Set<string> {
	return new Set(Object.values(reviewStore.readCards()).map((c) => c.slug));
}

export function cheatsheetReviewState(sheet: Cheatsheet): CheatsheetReviewState {
	const slugs = sheetSlugs(sheet);
	const deck = deckSlugs();
	return { inDictionary: slugs.length, inReview: slugs.filter((s) => deck.has(s)).length };
}

/** Put the next batch of the sheet's words that are not in Review yet into
 *  the deck, in the order the sheet uses them. Words with no verified
 *  sentence cannot become cards and are skipped. */
export function cheatsheetToReview(sheet: Cheatsheet, now = new Date()): CheatsheetReviewState & { added: string[] } {
	const deck = deckSlugs();
	const waiting = sheetSlugs(sheet).filter((s) => !deck.has(s));
	const added: string[] = [];
	let cursor = 0;
	while (cursor < waiting.length && added.length < CHEATSHEET_REVIEW_BATCH) {
		const take = waiting.slice(cursor, cursor + CHEATSHEET_REVIEW_BATCH - added.length);
		cursor += take.length;
		added.push(...enqueueWords(take, now));
	}
	return { ...cheatsheetReviewState(sheet), added };
}
