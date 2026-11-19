import { reviewEntryWordVerdict } from "./hard-words.ts";
import { blankAtSpans, type ReviewCard, type ReviewLogEntry } from "./review.ts";

export function shouldUnmarkKnownWord(
	cards: readonly ReviewCard[],
	log: readonly ReviewLogEntry[],
	slug: string,
	markedAt: string,
	now: Date,
	langTag: string,
): boolean {
	const since = Date.parse(markedAt);
	if (!Number.isFinite(since)) return false;
	const byId = new Map(cards.filter((card) => card.slug === slug && !card.suspended).map((card) => [card.id, card]));
	const history = log
		.filter((entry) => {
			const at = Date.parse(entry.reviewedAt);
			return byId.has(entry.cardId) && at > since && at <= now.getTime() && !entry.hints && !entry.picked;
		})
		.toSorted((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt));
	let misses = 0;
	const seen = new Set<string>();
	for (const entry of history) {
		const key = `${entry.cardId}:${Date.parse(entry.reviewedAt)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const card = byId.get(entry.cardId)!;
		if (
			entry.words &&
			entry.words > 1 &&
			(blankAtSpans(card, entry.spans)?.words !== entry.words ||
				(entry.given.trim() && entry.given.trim().split(/\s+/).length !== entry.words))
		) {
			misses = 0;
			continue;
		}
		misses = reviewEntryWordVerdict(card, entry, langTag) === "wrong" ? misses + 1 : 0;
	}
	return misses >= 3;
}
