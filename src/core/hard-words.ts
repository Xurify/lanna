import { compareAnswer } from "./language.ts";
import { blankAtSpans, dayKey, targetWordOf, type ReviewCard, type ReviewLogEntry } from "./review.ts";

export interface HardWord {
	id: string;
	slug: string;
	lemma: string;
	gloss: string;
	lapses: number;
	wrongs: number;
	lastWrongAt: string;
}

export function reviewEntryWordVerdict(
	card: Pick<ReviewCard, "sentence" | "answer" | "at">,
	entry: Pick<ReviewLogEntry, "verdict" | "given" | "spans" | "words">,
	langTag = "sk-SK",
): "exact" | "accents" | "wrong" {
	if (!entry.words || entry.words <= 1) return entry.verdict;
	const blank = blankAtSpans(card, entry.spans);
	if (!blank || blank.words <= 1) return entry.verdict;
	return compareAnswer(card.answer, targetWordOf(blank, entry.given), langTag);
}

export function hardWords(
	cards: readonly ReviewCard[],
	log: readonly ReviewLogEntry[],
	opts: { langTag?: string; tz?: number } = {},
): HardWord[] {
	const byId = new Map(cards.filter((card) => !card.suspended).map((card) => [card.id, card]));
	const groups = new Map<
		string,
		{ card: ReviewCard; members: ReviewCard[]; lapses: number; history: ReviewLogEntry[] }
	>();
	for (const card of byId.values()) {
		const group = groups.get(card.slug);
		if (group) {
			group.lapses = Math.max(group.lapses, card.lapses);
			group.members.push(card);
		} else groups.set(card.slug, { card, members: [card], lapses: card.lapses, history: [] });
	}
	for (const entry of log) {
		const card = byId.get(entry.cardId);
		if (card) groups.get(card.slug)!.history.push(entry);
	}
	const result: HardWord[] = [];
	for (const { card, members, lapses, history } of groups.values()) {
		let wrongs = 0;
		let lastWrongAt = "";
		let lastWrongMs = -Infinity;
		let lastWrongDay = "";
		const cleanDays = new Set<string>();
		const neighborMisses = new Map<string, number>();
		history.sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt));
		for (const entry of history) {
			const at = Date.parse(entry.reviewedAt);
			if (!Number.isFinite(at)) continue;
			const day = dayKey(new Date(at), opts.tz);
			const verdict = reviewEntryWordVerdict(byId.get(entry.cardId)!, entry, opts.langTag);
			if (entry.verdict === "wrong" && verdict !== "wrong")
				neighborMisses.set(entry.cardId, (neighborMisses.get(entry.cardId) ?? 0) + 1);
			if (verdict === "wrong") {
				wrongs += 1;
				lastWrongAt = entry.reviewedAt;
				lastWrongMs = at;
				lastWrongDay = day;
				cleanDays.clear();
			} else if (
				verdict === "exact" &&
				!entry.hints &&
				!entry.picked &&
				entry.rating >= 3 &&
				at - lastWrongMs >= 12 * 3_600_000 &&
				day !== lastWrongDay
			)
				cleanDays.add(day);
		}
		const misses = Math.max(wrongs, ...members.map((member) => member.lapses - (neighborMisses.get(member.id) ?? 0)));
		if (misses < 2 || cleanDays.size >= 2) continue;
		result.push({
			id: card.id,
			slug: card.slug,
			lemma: card.lemma,
			gloss: card.gloss,
			lapses,
			wrongs: misses,
			lastWrongAt: lastWrongAt || card.lastReview || card.createdAt,
		});
	}
	return result.sort((a, b) => b.wrongs - a.wrongs || Date.parse(b.lastWrongAt) - Date.parse(a.lastWrongAt));
}
