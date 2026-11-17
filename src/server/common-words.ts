import { loadLexicon } from "../agent/lexicon.ts";
import { entryLemma } from "../core/review.ts";
import { knownWordStore } from "../store/known-words.ts";
import { frequencyOrder } from "./reading.ts";

function validRange(from: number, count: number) {
	if (!Number.isSafeInteger(count) || count < 1 || count > 100_000)
		throw new Error("Choose a whole number of words between 1 and 100,000.");
	if (!Number.isSafeInteger(from) || from < 1 || from > count)
		throw new Error("Choose a start between 1 and the count.");
}

function commonEntries(count: number, from = 1) {
	validRange(from, count);
	const lexicon = loadLexicon();
	if (!lexicon) return [];
	return frequencyOrder(lexicon)
		.slice(from - 1, count)
		.map((slug) => lexicon.bySlug.get(slug)!);
}
export function getCommonWords(count = 200) {
	const entries = commonEntries(count);
	const known = knownWordStore.slugs();
	return {
		total: loadLexicon()?.entries.length ?? 0,
		items: entries.map((entry, index) => ({
			slug: entry.slug,
			lemma: entryLemma(entry),
			gloss: entry.en,
			rank: index + 1,
			known: known.has(entry.slug),
		})),
	};
}

export function markCommonWordsKnown(count: number, now = new Date(), from = 1) {
	const entries = commonEntries(count, from);
	const added = knownWordStore.markMany(
		entries.map((entry) => ({ slug: entry.slug, lemma: entryLemma(entry) })),
		now,
	);
	return { added, selected: entries.length };
}
