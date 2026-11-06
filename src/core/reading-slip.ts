/**
 * Robo makes your mistake (LangHarness, 2026-11-05; creator-hooks proposal 6).
 * The one slip a series episode may carry: Robo, the lead of the story, says
 * the wrong word of a pair the learner keeps mixing up (E24) in one sentence,
 * and the right word in the next. The reader marks the line and explains it,
 * and the right word goes to the review deck once the episode is read.
 *
 * chooseSlip picks the pair before the episode is written. A pair qualifies
 * with SLIP_MIN_MISSES misses on the learner's record, when it is one of the
 * verified pairs (E11: curriculum/<language>/pairs.json, with the sentences the
 * drop rule asks for), and when none of the last SLIP_RECENT_EPISODES episodes
 * used it. Open mix-ups come first, then the most misses, then the latest.
 *
 * verifySlip checks what the model returns, in code (E29): the wrong word is a
 * token of the slip sentence and resolves in the lexicon to its own twin and
 * not the other; the right word is a token of the repair; both sentences are
 * Robo's; the pair is verified. A slip that fails is dropped with its reason,
 * and the episode is kept.
 *
 * Pure: the pairs and families are bundled JSON, no fs.
 */

import { formsOfEntry, MIN_PAIR_SENTENCES, pairSentences, type PairDef } from "./pairs.ts";
import { entryLemma, type LexiconEntry } from "./review.ts";
import { mixupStatus, type Mixup, type MixupRecord } from "./mixups.ts";
import type { DraftSlip, StorySentence, StorySlip } from "./reading.ts";

/** Misses on a pair before it can be the slip: one miss is already sent to review. */
export const SLIP_MIN_MISSES = 2;
/** Episodes whose slip pairs are kept out of the next choice. */
export const SLIP_RECENT_EPISODES = 5;
/** Forms of each word the brief lists, so the model picks one the checker knows. */
const BRIEF_FORMS = 12;

/** One word of the slip: its lexicon entry and the forms the lexicon attests. */
export interface SlipWord {
	slug: string;
	lemma: string;
	forms: string[];
}

/** The pair chosen for an episode, before anything is written. */
export interface SlipTarget {
	/** The pair's id in pairs.json. */
	pair: string;
	/** The pair's rule, one English line. */
	rule: string;
	/** Who says both sentences: the series lead. */
	speaker: string;
	/** The word Robo uses by mistake. */
	wrong: SlipWord;
	/** The word the sentence needs; Robo says it in the repair. */
	right: SlipWord;
}

/** What the chooser and the checker read from the dictionary (src/agent/lexicon.ts). */
export interface SlipLexicon {
	entries: readonly LexiconEntry[];
	bySlug: ReadonlyMap<string, LexiconEntry>;
}

export interface SlipChoice {
	record: MixupRecord;
	lexicon: SlipLexicon;
	pairs: readonly PairDef[];
	/** Pair ids the last episodes used as their slip. */
	recentPairs: readonly string[];
	/** The series lead, who says the lines; empty when the series has none. */
	speaker: string;
}

/** The result of checking a slip: the slip to keep, or why it was dropped. */
export type SlipCheck = { slip: StorySlip } | { reason: string };

/** The model may wrap a form in punctuation, so the match ignores it. */
function clean(form: string): string {
	return form.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();
}

function formsOf(bySlug: ReadonlyMap<string, LexiconEntry>, slug: string): Set<string> {
	const entry = bySlug.get(slug);
	return new Set(entry ? formsOfEntry(entry) : []);
}

function slipWord(lexicon: SlipLexicon, slug: string): SlipWord {
	const entry = lexicon.bySlug.get(slug)!;
	return { slug, lemma: entryLemma(entry), forms: formsOfEntry(entry) };
}

/** The verified pair two lexicon entries make: their lemmas are the pair's
 *  twins, and the pair has the sentences the drop rule asks for (E11). */
function verifiedPairFor(lexicon: SlipLexicon, pairs: readonly PairDef[], ea: LexiconEntry, eb: LexiconEntry): PairDef | null {
	const key = [entryLemma(ea), entryLemma(eb)].map((s) => s.toLowerCase()).sort().join("~");
	const def = pairs.find((p) => [p.a, p.b].map((s) => s.toLowerCase()).sort().join("~") === key);
	if (!def) return null;
	return pairSentences(lexicon.entries, def).length >= MIN_PAIR_SENTENCES ? def : null;
}

/** Which twin the learner was asked for in their last miss (the sentence's
 *  own form is the answer) and which they gave: the slip is that mistake.
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

export function chooseSlip(input: SlipChoice): SlipTarget | null {
	if (!input.speaker) return null;
	const recent = new Set(input.recentPairs);
	const found: Array<{ m: Mixup; pair: PairDef; wrong: string; right: string }> = [];
	for (const m of Object.values(input.record)) {
		if (m.misses < SLIP_MIN_MISSES) continue;
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
		wrong: slipWord(input.lexicon, best.wrong),
		right: slipWord(input.lexicon, best.right),
	};
}

/** The brief's lines for the slip: which pair, which sentence, which forms,
 *  and the JSON that carries it back. */
export function slipBrief(t: SlipTarget): string[] {
	const forms = (w: SlipWord) => w.forms.slice(0, BRIEF_FORMS).map((f) => `"${f}"`).join(", ");
	return [
		`${t.speaker}'s slip (this episode only): ${t.speaker} uses the wrong word of a pair the learner mixes up, "${t.wrong.lemma}" where the sentence needs "${t.right.lemma}". The rule: ${t.rule}`,
		`Write one of ${t.speaker}'s sentences, not one of the last three, with a form of "${t.wrong.lemma}" where "${t.right.lemma}" belongs, so the sentence is wrong in exactly this way. Use one of these forms, exactly as written: ${forms(t.wrong)}. That sentence holds no form of "${t.right.lemma}".`,
		`The sentence after it is ${t.speaker} again: ${t.speaker} notices and says the right word, a form of "${t.right.lemma}" (one of ${forms(t.right)}), in a short, natural repair. Both sentences are spoken by ${t.speaker}, and no other line in the text is a slip.`,
		`In the JSON add "slip": {"sentence": <the index of the wrong sentence in the sentences array, counting from 0>, "wrong": "<the wrong form exactly as written in that sentence>", "right": "<the right form exactly as written in the repair>"}.`,
	];
}

/** The word token of a sentence that is this form, as the sentence writes it. */
function wordOf(sentence: StorySentence, form: string): string | null {
	const want = clean(form);
	const hit = sentence.tokens.find((t) => t.word && t.text.toLowerCase() === want);
	return hit?.text ?? null;
}

function resolvesOnly(form: string, own: string, other: string, lexicon: SlipLexicon): boolean {
	const f = clean(form);
	return formsOf(lexicon.bySlug, own).has(f) && !formsOf(lexicon.bySlug, other).has(f);
}

/** Check the slip the model returned against the target the brief named. */
export function verifySlip(draft: DraftSlip | undefined, target: SlipTarget, sentences: readonly StorySentence[], lexicon: SlipLexicon, pairs: readonly PairDef[]): SlipCheck {
	if (!draft) return { reason: "the model gave no slip" };
	const ea = lexicon.bySlug.get(target.wrong.slug);
	const eb = lexicon.bySlug.get(target.right.slug);
	if (!ea || !eb) return { reason: "a word of the pair is not in the lexicon" };
	const pair = verifiedPairFor(lexicon, pairs, ea, eb);
	if (!pair || pair.id !== target.pair) return { reason: `the pair ${target.pair} is not one of the verified pairs` };
	const slipAt = sentences[draft.sentence];
	const repairAt = sentences[draft.sentence + 1];
	if (!slipAt || !repairAt) return { reason: "the slip has no sentence to hold it, or no repair after it" };
	if (slipAt.who !== target.speaker || repairAt.who !== target.speaker) return { reason: "the slip and its repair are not both Robo's lines" };
	const rightForms = formsOf(lexicon.bySlug, target.right.slug);
	if (slipAt.tokens.some((t) => t.word && rightForms.has(t.text.toLowerCase()))) return { reason: "the slip sentence also holds the right word" };
	const wrong = wordOf(slipAt, draft.wrong);
	if (!wrong || !resolvesOnly(draft.wrong, target.wrong.slug, target.right.slug, lexicon)) return { reason: `"${draft.wrong}" is not a form of ${target.wrong.lemma} in the slip sentence` };
	const right = wordOf(repairAt, draft.right);
	if (!right || !resolvesOnly(draft.right, target.right.slug, target.wrong.slug, lexicon)) return { reason: `the repair does not say a form of ${target.right.lemma}` };
	return { slip: { pair: pair.id, sentence: draft.sentence, wrong, right, wrongSlug: target.wrong.slug, rightSlug: target.right.slug, rule: pair.rule, speaker: target.speaker } };
}
