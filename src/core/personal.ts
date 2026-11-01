/**
 * The personal lesson (LangHarness, 2026-11-01): the guide's model names
 * what to drill (words, units, pairs of words) from the learner's own
 * mistakes, and the app builds the lesson from its own verified sentences.
 * The model never writes a sentence a learner practices (P8): a target it
 * names is kept only when the lexicon can back it, and the reps are the
 * same cloze, unit and pair reps the other lessons use.
 *
 * Pure and browser-safe, given the lexicon entries.
 */

import { buildItem, buildLesson, candidatesFor, classifyExample, isUnitId, rng, shuffle, unitInfo, type LessonItem, type LessonPlan, type UnitId } from "./lesson.ts";
import { drillable, mixupItem, mixupKey, mixupLexicon, mixupRule, mixupStatus, twinsOf, type MixupLexicon, type MixupRecord } from "./mixups.ts";
import { entryLemma, type LexiconEntry } from "./review.ts";

/** The targets, as the lexicon backs them. */
export interface PersonalPractice {
	/** Lexicon slugs of words with verified sentences. */
	words: string[];
	units: UnitId[];
	/** Pairs of slugs with enough sentences that hold only one of the two. */
	pairs: Array<[string, string]>;
	/** The guide's pattern titles, for the plan and the lesson's line. */
	focus: string[];
	/** The targets in words a learner reads: lemmas, "a / b" pairs, unit titles. */
	shown: string[];
}

/** A unit needs this many sentences before the lesson takes it. */
const MIN_UNIT_SENTENCES = 3;

const verified = (e: LexiconEntry) => e.examples.some((x) => x.cloze && !x.rejected);

function entryOfLemma(lex: MixupLexicon, lemma: string): LexiconEntry | undefined {
	const list = lex.byLemma.get(lemma.trim().toLocaleLowerCase("sk-SK")) ?? [];
	return list.filter(verified).sort((a, b) => (a.rank ?? 100_000) - (b.rank ?? 100_000))[0];
}

/** Keep what the lexicon can back: a word with a verified sentence, a unit
 *  that lessons can build (not a pairs or tutor unit) with enough sentences,
 *  a pair whose twins both exist and can be drilled. */
export function resolvePractice(raw: { words: string[]; units: string[]; pairs: Array<[string, string]> } | undefined, focus: string[], entries: readonly LexiconEntry[]): PersonalPractice | null {
	if (!raw) return null;
	const lex = mixupLexicon(entries);
	const words = [...new Set(raw.words.map((w) => entryOfLemma(lex, w)?.slug).filter((s): s is string => !!s))];
	const units = [...new Set(raw.units.filter(isUnitId))].filter((u) => unitInfo(u).kind !== "pairs" && candidatesFor(entries, u).length >= MIN_UNIT_SENTENCES);
	const pairs: Array<[string, string]> = [];
	for (const [x, y] of raw.pairs) {
		const a = entryOfLemma(lex, x);
		const b = entryOfLemma(lex, y);
		if (!a || !b || a === b || pairs.some((p) => mixupKey(...p) === mixupKey(a.slug, b.slug)) || !drillable(lex, a.slug, b.slug)) continue;
		pairs.push([a.slug, b.slug]);
	}
	if (words.length + units.length + pairs.length === 0) return null;
	const lemma = (slug: string) => entryLemma(lex.bySlug.get(slug)!);
	const shown = [...pairs.map(([a, b]) => `${lemma(a)} / ${lemma(b)}`), ...words.map(lemma), ...units.map((u) => unitInfo(u).title)];
	return { words, units, pairs, focus: focus.slice(0, 3), shown };
}

/**
 * The lesson: the pairs first in each round (two sides in turn: typed when
 * the pair is an open mix-up, a choice when it is not tested yet), then the
 * words (a typed cloze from one of the word's verified sentences), then the
 * units (typed reps from the unit's own lesson builder). Targets take turns,
 * one rep each, so the lesson is interleaved rather than blocked. `recent`
 * sentence ids go to the back while fresher ones remain.
 */
export function buildPersonalLesson(entries: readonly LexiconEntry[], practice: PersonalPractice | null | undefined, record: MixupRecord | undefined, opts: { seed: number; length?: number; recent?: ReadonlySet<string> }): LessonPlan {
	const rand = rng(opts.seed);
	const length = opts.length ?? 12;
	if (!practice) return { unit: "words", items: [], focus: "personal" };
	const lex = mixupLexicon(entries);
	const fresh = <T>(list: T[], id: (x: T) => string) => [...list.filter((x) => !opts.recent?.has(id(x))), ...list.filter((x) => opts.recent?.has(id(x)))];
	const pools: LessonItem[][] = [];
	for (const [a, b] of practice.pairs) {
		const key = mixupKey(a, b);
		const m = record?.[key];
		const open = !!m && mixupStatus(m) === "active";
		const rule = mixupRule(m ?? { a, b }, lex);
		const sentences = fresh(shuffle(twinsOf(lex, a, b), rand), (x) => `${x.entry.slug}#${x.index}`);
		const sides = [sentences.filter((x) => x.member === "a"), sentences.filter((x) => x.member === "b")];
		const turns: LessonItem[] = [];
		for (let i = 0; turns.length < 4 && (sides[0]!.length || sides[1]!.length); i++) {
			const side = sides[i % 2]!.length ? sides[i % 2]! : sides[(i + 1) % 2]!;
			turns.push(mixupItem(side.shift()!, { key, m: { a, b }, probe: !open, ...rule }, lex, rand));
		}
		pools.push(turns);
	}
	for (const slug of practice.words) {
		const entry = lex.bySlug.get(slug);
		if (!entry) continue;
		const indexes = fresh(
			shuffle(
				entry.examples.flatMap((x, i) => (x.cloze && !x.rejected ? [i] : [])),
				rand,
			),
			(i) => `${slug}#${i}`,
		);
		pools.push(
			indexes.slice(0, 2).map((index) => {
				const unit = classifyExample(entry, entry.examples[index]!) ?? "words";
				return buildItem({ entry, index, unit }, "type", [entryLemma(entry)], rand);
			}),
		);
	}
	for (const unit of practice.units) {
		pools.push(buildLesson(entries, unit, { seed: opts.seed, recent: opts.recent, pattern: ["type", "type", "type", "type"], length: 4 }).items);
	}
	const items: LessonItem[] = [];
	const used = new Set<string>();
	while (items.length < length && pools.some((p) => p.length)) {
		for (const pool of pools) {
			if (items.length >= length) break;
			let next = pool.shift();
			while (next && used.has(next.id)) next = pool.shift();
			if (!next) continue;
			used.add(next.id);
			items.push(next);
		}
	}
	return { unit: "words", items, focus: "personal" };
}
