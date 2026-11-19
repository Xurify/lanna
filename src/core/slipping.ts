import { compareAnswer } from "./language.ts";
import { buildItem, meaningChoices, rng, shortGloss, shuffle, type LessonItem, type LessonPlan } from "./lesson.ts";
import {
	mixupItem,
	mixupLexicon,
	mixupRule,
	NO_FRAMES,
	openMixupFor,
	pairSentenceId,
	twinsOf,
	type MixupProbe,
	type MixupRecord,
} from "./mixups.ts";
import {
	blankAtSpans,
	dayKey,
	entryLemma,
	exampleText,
	targetWordOf,
	type LexiconEntry,
	type ReviewCard,
	type ReviewLogEntry,
} from "./review.ts";
import { SENTENCE_TARGETS, type PracticeSentenceTarget } from "./sentences.ts";

export const SLIPPING_MIN_WRONGS = 2;
export const SLIPPING_GRADUATE_DAYS = 2;
export const SLIPPING_MIN_GAP_MS = 12 * 3_600_000;
export const SLIPPING_STABILITY_DAYS = 7;
export const SLIPPING_DRILL_WORDS = 6;

export interface SlippingWord {
	id: string;
	slug: string;
	lemma: string;
	gloss: string;
	lapses: number;
	wrongs: number;
	missDays: number;
	hasBlankMiss: boolean;
	lastWrongAt: string;
	stability: number;
	card: ReviewCard;
}

export function reviewEntryWordVerdict(
	card: Pick<ReviewCard, "sentence" | "answer" | "at">,
	entry: Pick<ReviewLogEntry, "verdict" | "given" | "spans" | "words">,
	langTag = "sk-SK",
): "exact" | "accents" | "wrong" {
	if (!entry.words || entry.words <= 1) return entry.verdict;
	const blank = blankAtSpans(card, entry.spans);
	if (!blank || blank.words <= 1) return entry.verdict;
	const word = targetWordOf(blank, entry.given);
	return compareAnswer(card.answer, word, langTag);
}

function isBlankAnswer(
	card: Pick<ReviewCard, "sentence" | "answer" | "at">,
	entry: Pick<ReviewLogEntry, "given" | "spans" | "words">,
): boolean {
	if (!entry.given.trim()) return true;
	if (entry.words && entry.words > 1) {
		const blank = blankAtSpans(card, entry.spans);
		if (blank && blank.words > 1) return !targetWordOf(blank, entry.given).trim();
	}
	return false;
}

export function slippingWords(
	cards: readonly ReviewCard[],
	log: readonly ReviewLogEntry[],
	opts: { langTag?: string; tz?: number; minWrongs?: number } = {},
): SlippingWord[] {
	const langTag = opts.langTag ?? "sk-SK";
	const minWrongs = opts.minWrongs ?? SLIPPING_MIN_WRONGS;
	const byCard = new Map<string, ReviewLogEntry[]>();
	for (const entry of log) {
		let list = byCard.get(entry.cardId);
		if (!list) {
			list = [];
			byCard.set(entry.cardId, list);
		}
		list.push(entry);
	}

	const out: SlippingWord[] = [];
	for (const card of cards) {
		if (card.suspended) continue;
		const history = [...(byCard.get(card.id) ?? [])].sort(
			(a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt),
		);
		let wrongs = 0;
		const missDays = new Set<string>();
		let hasBlankMiss = false;
		let lastWrongAt = "";
		let lastWrongMs = -Infinity;
		let lastWrongDay = "";
		const cleanDaysAfterWrong = new Set<string>();

		for (const entry of history) {
			const atMs = Date.parse(entry.reviewedAt);
			if (!Number.isFinite(atMs)) continue;
			const day = dayKey(new Date(atMs), opts.tz);
			const verdict = reviewEntryWordVerdict(card, entry, langTag);
			if (verdict === "wrong") {
				wrongs++;
				missDays.add(day);
				if (isBlankAnswer(card, entry)) hasBlankMiss = true;
				lastWrongAt = entry.reviewedAt;
				lastWrongMs = atMs;
				lastWrongDay = day;
				cleanDaysAfterWrong.clear();
				continue;
			}
			const clean = verdict === "exact" && !entry.hints && !entry.picked && entry.rating >= 3;
			if (!clean) continue;
			if (lastWrongMs === -Infinity) {
				cleanDaysAfterWrong.add(day);
			} else if (atMs - lastWrongMs >= SLIPPING_MIN_GAP_MS && day !== lastWrongDay) {
				cleanDaysAfterWrong.add(day);
			}
		}

		const count = Math.max(wrongs, card.lapses);
		if (count < minWrongs) continue;
		const stability = card.memory?.stability ?? 0;
		const graduated =
			cleanDaysAfterWrong.size >= SLIPPING_GRADUATE_DAYS ||
			(card.state === "review" && stability >= SLIPPING_STABILITY_DAYS && cleanDaysAfterWrong.size >= 1);
		if (graduated) continue;

		out.push({
			id: card.id,
			slug: card.slug,
			lemma: card.lemma,
			gloss: card.gloss,
			lapses: card.lapses,
			wrongs: count,
			missDays: missDays.size,
			hasBlankMiss,
			lastWrongAt: lastWrongAt || card.lastReview || card.createdAt,
			stability,
			card,
		});
	}

	return out.sort(
		(a, b) => b.wrongs - a.wrongs || Date.parse(b.lastWrongAt) - Date.parse(a.lastWrongAt) || a.stability - b.stability,
	);
}

function cardFallbackItem(card: ReviewCard, kind: "meaning" | "type"): LessonItem {
	return {
		id: card.id,
		kind,
		unit: "words",
		slug: card.slug,
		lemma: card.lemma,
		gloss: card.gloss,
		sentence: card.sentence,
		translation: card.translation,
		answer: card.answer,
		before: card.sentence.slice(0, card.at),
		after: card.sentence.slice(card.at + card.answer.length),
		hint: kind === "meaning" ? card.lemma : shortGloss(card.gloss),
	};
}

export function buildSlippingLesson(
	slipping: readonly SlippingWord[],
	entries: readonly LexiconEntry[],
	mixups: MixupRecord | undefined,
	opts: {
		seed: number;
		recent?: ReadonlySet<string>;
		drilledToday?: ReadonlySet<string>;
		frames?: readonly MixupProbe[];
		maxWords?: number;
	},
): LessonPlan {
	const rand = rng(opts.seed);
	const maxWords = opts.maxWords ?? SLIPPING_DRILL_WORDS;
	if (!slipping.length) return { unit: "words", items: [], focus: "slipping" };

	const drilled = opts.drilledToday;
	const prioritized = drilled?.size
		? [...slipping.filter((w) => !drilled.has(w.slug)), ...slipping.filter((w) => drilled.has(w.slug))]
		: [...slipping];
	const chosen = prioritized.slice(0, maxWords);

	const lex = mixupLexicon(entries, opts.frames ?? NO_FRAMES);
	const lemmaPool = entries.map((e) => entryLemma(e));

	const queues: LessonItem[][] = [];
	for (const w of chosen) {
		const entry = lex.bySlug.get(w.slug);
		const validIndexes = entry ? entry.examples.flatMap((x, i) => (x.cloze && !x.rejected ? [i] : [])) : [];
		const freshIndexes = entry
			? [
					...shuffle(
						validIndexes.filter(
							(i) => exampleText(entry.examples[i]!) !== w.card.sentence && !opts.recent?.has(`${w.slug}#${i}`),
						),
						rand,
					),
					...shuffle(
						validIndexes.filter(
							(i) => exampleText(entry.examples[i]!) !== w.card.sentence && opts.recent?.has(`${w.slug}#${i}`),
						),
						rand,
					),
					...shuffle(
						validIndexes.filter((i) => exampleText(entry.examples[i]!) === w.card.sentence),
						rand,
					),
				]
			: [];

		const wordItems: LessonItem[] = [];
		const needsMeaning = w.hasBlankMiss || w.wrongs >= 3;
		const open = openMixupFor(mixups, w.slug);
		let freshTwin: ReturnType<typeof twinsOf>[number] | undefined;
		if (open) {
			const twins = shuffle(
				twinsOf(lex, open.a, open.b).filter((t) => (t.member === "a" ? open.a : open.b) === w.slug),
				rand,
			);
			const twinText = (t: (typeof twins)[number]) => exampleText(t.entry.examples[t.index]!);
			freshTwin =
				twins.find((t) => twinText(t) !== w.card.sentence && !opts.recent?.has(pairSentenceId(t))) ??
				twins.find((t) => twinText(t) !== w.card.sentence) ??
				twins[0];
		}

		const typeIndex = freshIndexes.find((i) => i !== freshTwin?.index) ?? freshIndexes[0];
		const meaningIndex =
			freshIndexes.find((i) => i !== typeIndex && i !== freshTwin?.index) ?? freshIndexes[1] ?? freshIndexes[0];

		if (needsMeaning) {
			const meaningItem =
				entry && meaningIndex !== undefined
					? buildItem({ entry, index: meaningIndex, unit: "words" }, "meaning", lemmaPool, rand)
					: cardFallbackItem(w.card, "meaning");
			meaningItem.hint = entry ? entryLemma(entry) : w.lemma;
			const distractors = entries
				.filter((e) => e.slug !== w.slug)
				.flatMap((e) => e.examples.filter((x) => !x.rejected && x.en).map((x) => x.en));
			for (const other of slipping)
				if (other.slug !== w.slug && other.card.translation) distractors.push(other.card.translation);
			meaningItem.options = meaningChoices(meaningItem.translation, distractors, rand);
			if (meaningItem.options.length >= 2) wordItems.push(meaningItem);
		}

		if (open && freshTwin) {
			const rule = mixupRule(open, lex);
			wordItems.push(mixupItem(freshTwin, { key: open.key, m: open, probe: true, ...rule }, lex, rand));
		}

		const typeItem =
			entry && typeIndex !== undefined
				? buildItem({ entry, index: typeIndex, unit: "words" }, "type", lemmaPool, rand)
				: cardFallbackItem(w.card, "type");
		wordItems.push(typeItem);

		queues.push(wordItems);
	}

	const items: LessonItem[] = [];
	const usedIds = new Set<string>();
	let progress = true;
	while (progress) {
		progress = false;
		for (const q of queues) {
			const next = q.shift();
			if (!next) continue;
			progress = true;
			if (usedIds.has(next.id)) {
				let candidate = `${next.id}~${next.kind}`;
				let n = 2;
				while (usedIds.has(candidate)) candidate = `${next.id}~${next.kind}~${n++}`;
				next.id = candidate;
			}
			usedIds.add(next.id);
			items.push(next);
		}
	}

	return { unit: "words", items, focus: "slipping" };
}

export function slippingSentenceTargets(
	items: readonly Pick<LessonItem, "slug" | "lemma" | "gloss" | "sentence">[],
	missedSlugs: readonly string[] = [],
	max = SENTENCE_TARGETS,
): PracticeSentenceTarget[] {
	const bySlug = new Map<string, PracticeSentenceTarget>();
	const order: string[] = [];
	for (const item of items) {
		if (!bySlug.has(item.slug)) {
			bySlug.set(item.slug, {
				lemma: item.lemma,
				slug: item.slug,
				gloss: item.gloss,
				line: item.sentence,
			});
			order.push(item.slug);
		}
	}
	const missedSet = new Set(missedSlugs);
	const ranked = [...order.filter((s) => missedSet.has(s)), ...order.filter((s) => !missedSet.has(s))];
	return ranked.slice(0, max).map((s) => bySlug.get(s)!);
}
