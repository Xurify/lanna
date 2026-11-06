/**
 * Which pair to catch, and whether the model's item checks out (LangHarness,
 * 2026-11-05; creator-hooks proposal 6). Catch the mistake shows a short item
 * with one wrong word from a pair the learner keeps mixing up (E24); the
 * learner taps it and types the right one.
 *
 * chooseCatch picks the pair before the item is written. A pair qualifies with
 * CATCH_MIN_MISSES misses on the learner's record, when it is one of the
 * verified pairs (E11: curriculum/<language>/pairs.json, with the sentences the
 * drop rule asks for), and when none of the last CATCH_RECENT_ITEMS items used
 * it. Open mix-ups come first, then the most misses, then the latest.
 *
 * verifyCatch checks what the model returns, in code (E29): the wrong word is a
 * token of the mistaken sentence and resolves in the lexicon to its own twin
 * and not the other; the right word is a token of the correction; both
 * sentences are the speaker's; the pair is verified. An item that fails is
 * dropped with its reason.
 *
 * Pure: the pairs and families are bundled JSON, no fs.
 */
import { formsOfEntry, MIN_PAIR_SENTENCES, pairSentences, type PairDef } from "./pairs.ts";
import { entryLemma, type LexiconEntry } from "./review.ts";
import { mixupStatus, type Mixup, type MixupRecord } from "./mixups.ts";
import type { StorySentence } from "./reading.ts";

/** The checked mistake: where it is, what is wrong and what is right, with the pair's rule. */
export interface CatchMark {
	/** The pair's id in curriculum/<language>/pairs.json ("kam-vs-kde"). */
	pair: string;
	/** Index of the sentence with the wrong word; the correction is the next one. */
	sentence: number;
	/** The wrong word, as it is written in that sentence. */
	wrong: string;
	/** The right word, as it is written in the correction. */
	right: string;
	/** Lexicon slugs of the two words. */
	wrongSlug: string;
	rightSlug: string;
	/** The pair's rule, one English line. */
	rule: string;
	/** Who says both lines. */
	speaker: string;
}

/** The mistake as the model returns it, before the code checks it. */
export interface CatchDraftMark {
	sentence: number;
	wrong: string;
	right: string;
}

/** Misses on a pair before it can be caught: one miss is already sent to review. */
export const CATCH_MIN_MISSES = 2;
/** Items whose pairs are kept out of the next choice. */
export const CATCH_RECENT_ITEMS = 5;

/** One word of the pair: its lexicon entry and the forms the lexicon attests. */
export interface CatchWord {
	slug: string;
	lemma: string;
	forms: string[];
}

/** The pair chosen for an episode, before anything is written. */
export interface CatchTarget {
	/** The pair's id in pairs.json. */
	pair: string;
	/** The pair's rule, one English line. */
	rule: string;
	/** Who says both sentences: the series lead. */
	speaker: string;
	/** The word the speaker uses by mistake. */
	wrong: CatchWord;
	/** The word the sentence needs; the speaker says it in the correction. */
	right: CatchWord;
}

/** What the chooser and the checker read from the dictionary (src/agent/lexicon.ts). */
export interface CatchLexicon {
	entries: readonly LexiconEntry[];
	bySlug: ReadonlyMap<string, LexiconEntry>;
}

export interface CatchChoice {
	record: MixupRecord;
	lexicon: CatchLexicon;
	pairs: readonly PairDef[];
	/** Pair ids the last items used. */
	recentPairs: readonly string[];
	/** The series lead, who says the lines; empty when the series has none. */
	speaker: string;
}

/** The result of checking an item: the mistake to keep, or why it was dropped. */
export type CatchCheck = { slip: CatchMark } | { reason: string };

/** The model may wrap a form in punctuation, so the match ignores it. */
function clean(form: string): string {
	return form.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();
}

function formsOf(bySlug: ReadonlyMap<string, LexiconEntry>, slug: string): Set<string> {
	const entry = bySlug.get(slug);
	return new Set(entry ? formsOfEntry(entry) : []);
}

function catchWord(lexicon: CatchLexicon, slug: string): CatchWord {
	const entry = lexicon.bySlug.get(slug)!;
	return { slug, lemma: entryLemma(entry), forms: formsOfEntry(entry) };
}

/** The verified pair two lexicon entries make: their lemmas are the pair's
 *  twins, and the pair has the sentences the drop rule asks for (E11). */
function verifiedPairFor(lexicon: CatchLexicon, pairs: readonly PairDef[], ea: LexiconEntry, eb: LexiconEntry): PairDef | null {
	const key = [entryLemma(ea), entryLemma(eb)].map((s) => s.toLowerCase()).sort().join("~");
	const def = pairs.find((p) => [p.a, p.b].map((s) => s.toLowerCase()).sort().join("~") === key);
	if (!def) return null;
	return pairSentences(lexicon.entries, def).length >= MIN_PAIR_SENTENCES ? def : null;
}

/** Which twin the learner was asked for in their last miss (the sentence's
 *  own form is the answer) and which they gave: the item repeats that mistake.
 *  Null when the record does not say which is which. */
function direction(m: Mixup, bySlug: ReadonlyMap<string, LexiconEntry>): { wrong: string; right: string } | null {
	const last = m.seen?.[m.seen.length - 1];
	if (!last) return null;
	const asked = clean(last.answer);
	const aAsked = formsOf(bySlug, m.a).has(asked);
	const bAsked = formsOf(bySlug, m.b).has(asked);
	if (aAsked === bAsked) return null;
	return aAsked ? { right: m.a, wrong: m.b } : { right: m.b, wrong: m.a };
}

export function chooseCatch(input: CatchChoice): CatchTarget | null {
	if (!input.speaker) return null;
	const recent = new Set(input.recentPairs);
	const found: Array<{ m: Mixup; pair: PairDef; wrong: string; right: string }> = [];
	for (const m of Object.values(input.record)) {
		if (m.misses < CATCH_MIN_MISSES) continue;
		const ea = input.lexicon.bySlug.get(m.a);
		const eb = input.lexicon.bySlug.get(m.b);
		if (!ea || !eb) continue;
		const pair = verifiedPairFor(input.lexicon, input.pairs, ea, eb);
		if (!pair || recent.has(pair.id)) continue;
		const dir = direction(m, input.lexicon.bySlug);
		if (dir) found.push({ m, pair, ...dir });
	}
	found.sort(
		(x, y) =>
			Number(mixupStatus(y.m) === "active") - Number(mixupStatus(x.m) === "active") ||
			y.m.misses - x.m.misses ||
			y.m.lastAt.localeCompare(x.m.lastAt) ||
			x.pair.id.localeCompare(y.pair.id),
	);
	const best = found[0];
	if (!best) return null;
	return {
		pair: best.pair.id,
		rule: best.pair.rule,
		speaker: input.speaker,
		wrong: catchWord(input.lexicon, best.wrong),
		right: catchWord(input.lexicon, best.right),
	};
}

/** The word token of a sentence that is this form, as the sentence writes it. */
function wordOf(sentence: StorySentence, form: string): string | null {
	const want = clean(form);
	const hit = sentence.tokens.find((t) => t.word && t.text.toLowerCase() === want);
	return hit?.text ?? null;
}

function resolvesOnly(form: string, own: string, other: string, lexicon: CatchLexicon): boolean {
	const f = clean(form);
	return formsOf(lexicon.bySlug, own).has(f) && !formsOf(lexicon.bySlug, other).has(f);
}

/** Check the mistake the model returned against the target the brief named. */
export function verifyCatch(draft: CatchDraftMark | undefined, target: CatchTarget, sentences: readonly StorySentence[], lexicon: CatchLexicon, pairs: readonly PairDef[]): CatchCheck {
	if (!draft) return { reason: "the model gave no mistake" };
	const ea = lexicon.bySlug.get(target.wrong.slug);
	const eb = lexicon.bySlug.get(target.right.slug);
	if (!ea || !eb) return { reason: "a word of the pair is not in the lexicon" };
	const pair = verifiedPairFor(lexicon, pairs, ea, eb);
	if (!pair || pair.id !== target.pair) return { reason: `the pair ${target.pair} is not one of the verified pairs` };
	const mistakeAt = sentences[draft.sentence];
	const repairAt = sentences[draft.sentence + 1];
	if (!mistakeAt || !repairAt) return { reason: "the mistake has no sentence to hold it, or no correction after it" };
	if (mistakeAt.who !== target.speaker || repairAt.who !== target.speaker) return { reason: "the mistake and its correction are not both the speaker's lines" };
	const rightForms = formsOf(lexicon.bySlug, target.right.slug);
	if (mistakeAt.tokens.some((t) => t.word && rightForms.has(t.text.toLowerCase()))) return { reason: "the mistaken sentence also holds the right word" };
	const wrong = wordOf(mistakeAt, draft.wrong);
	if (!wrong || !resolvesOnly(draft.wrong, target.wrong.slug, target.right.slug, lexicon)) return { reason: `"${draft.wrong}" is not a form of ${target.wrong.lemma} in the slip sentence` };
	const right = wordOf(repairAt, draft.right);
	if (!right || !resolvesOnly(draft.right, target.right.slug, target.wrong.slug, lexicon)) return { reason: `the repair does not say a form of ${target.right.lemma}` };
	return { slip: { pair: pair.id, sentence: draft.sentence, wrong, right, wrongSlug: target.wrong.slug, rightSlug: target.right.slug, rule: pair.rule, speaker: target.speaker } };
}
