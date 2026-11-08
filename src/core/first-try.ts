/**
 * First tries (LangHarness, 2026-10-31): the first answer a learner gave to
 * a form, before any help. A lesson records its final answer for XP and the
 * path, and a cue lets a miss come back right, so the final verdict hides how
 * the form went. The grammar atlas and the tutor read this measure instead:
 * how often a form came out right unaided, what the wrong ones got wrong
 * (form-slip.ts), and the slips said in Speak. A Speak slip has no right
 * answers beside it, so it is counted as a slip, never as accuracy. Pure and
 * browser-safe.
 */

import { allUnits, classifyAll, type RepVerdict, type UnitId } from "./lesson.ts";
import { formCaseCell } from "./course.ts";
import { formSlip, isFormOf, knownForms, type FormSlip } from "./form-slip.ts";
import { atlasCellOf, caseDrill, type AtlasCase, type AtlasGender } from "./grammar.ts";
import { foldDiacritics } from "./language.ts";
import { entryLemma, type LexiconEntry } from "./review.ts";

/** The first answer to a rep, as the learner gave it. */
export interface FirstAnswer {
	/** What the learner typed or picked ("" for "I don't know"). */
	given: string;
	verdict: RepVerdict;
	/** The translation was shown before the answer: a priced hint, so the try
	 *  was not unaided and does not count. */
	peeked?: boolean;
}

/** One set of first tries, as progress.json keeps them. */
export interface FirstTally {
	/** Unaided first tries counted. */
	reps: number;
	/** Of them, right: exact, or with only the accents missing. */
	right: number;
	/** Of the right ones, the accents were the only miss. */
	accents: number;
	/** The wrong first tries, by slip. */
	slips: Partial<Record<FormSlip, number>>;
	/** Slips said in Speak. No reps beside them, so no accuracy. */
	spoken?: Partial<Record<FormSlip, number>>;
}

export function emptyTally(): FirstTally {
	return { reps: 0, right: 0, accents: 0, slips: {} };
}

/** A first try added to a tally. A wrong try with no slip named counts as
 *  "other", so the slips always add up to the wrong tries. */
export function addFirstTry(t: FirstTally, verdict: RepVerdict, slip?: FormSlip): FirstTally {
	if (verdict === "wrong") {
		const key: FormSlip = slip ?? "other";
		return { ...t, reps: t.reps + 1, slips: { ...t.slips, [key]: (t.slips[key] ?? 0) + 1 } };
	}
	return { ...t, reps: t.reps + 1, right: t.right + 1, accents: t.accents + (verdict === "accents" ? 1 : 0) };
}

/** A slip said in Speak, counted apart from the first tries. */
export function addSpokenSlip(t: FirstTally, slip: FormSlip): FirstTally {
	const spoken = t.spoken ?? {};
	return { ...t, spoken: { ...spoken, [slip]: (spoken[slip] ?? 0) + 1 } };
}

/** Share of first tries right, 0..1; null with none counted (never a
 *  percentage with nothing behind it). */
export function firstTryAccuracy(t: FirstTally | undefined): number | null {
	return t && t.reps > 0 ? t.right / t.reps : null;
}

/** Whether a rep's first answer is a first try for this measure: a form was
 *  asked (a meaning check tests the sentence, a word bank the order), the
 *  answer was not helped by a peek, and it is the first try at the sentence,
 *  not the retry of a missed rep at the end of the lesson. */
export function countsAsFirstTry(rep: { kind: string; again?: boolean; first?: FirstAnswer }): boolean {
	return !!rep.first && rep.kind !== "meaning" && rep.kind !== "build" && rep.again !== true && rep.first.peeked !== true;
}

/** An atlas cell: a case drill's case and the gender column of its word. */
export type FirstTryCell = { row: AtlasCase; col: AtlasGender } | null;

/** What a unit keeps of its first tries: all of them, a Slovak case drill's
 *  split by the gender column of its word (the atlas cells), and a
 *  generated course's split by the case table cell its form filled
 *  ("inessive plural"). */
export interface FirstTryStats {
	first?: FirstTally;
	byGender?: Partial<Record<AtlasGender, FirstTally>>;
	byForm?: Record<string, FirstTally>;
}

/** One rep as the first-try measure reads it. */
interface FirstTryRep {
	kind: string;
	/** The unit the rep drilled (its own unit, also inside a mixed lesson). */
	unit: string;
	again?: boolean;
	first?: FirstAnswer;
	/** The form the sentence needed, and the word's lexicon entry. */
	answer: string;
	entry: LexiconEntry;
}

/** A counted first try: the unit it drilled, the cell it fills and what it was. */
export interface FirstTryCount {
	unit: string;
	cell: FirstTryCell;
	/** A generated course's case table cell ("inessive plural"), when the form fills one. */
	form?: string;
	verdict: RepVerdict;
	/** Named only for a wrong answer (form-slip.ts). */
	slip?: FormSlip;
}

/** The first try a rep counts as, or null when it counts toward nothing. */
export function firstTryOf(rep: FirstTryRep, tag = "sk-SK"): FirstTryCount | null {
	if (!rep.first || !countsAsFirstTry(rep)) return null;
	const { given, verdict } = rep.first;
	const slip = verdict === "wrong" ? formSlip({ answer: rep.answer, lemma: entryLemma(rep.entry), given, forms: knownForms(rep.entry) }, tag) : undefined;
	const match = allUnits().find((u) => u.id === rep.unit)?.match;
	const form = match ? formCaseCell({ kind: "grammar", ...match }, rep.entry, rep.answer, tag) : null;
	return { unit: rep.unit, cell: atlasCellOf(rep.unit, rep.entry.gender), verdict, ...(form ? { form } : {}), ...(slip ? { slip } : {}) };
}

/** Steps a unit's tally, the gender column's when the try filled an atlas
 *  cell, and the case table cell's when it filled one. */
function bump<T extends FirstTryStats>(s: T, cell: FirstTryCell, step: (t: FirstTally) => FirstTally, form?: string): T {
	let out: T = { ...s, first: step(s.first ?? emptyTally()) };
	if (cell) out = { ...out, byGender: { ...s.byGender, [cell.col]: step(s.byGender?.[cell.col] ?? emptyTally()) } };
	if (form) out = { ...out, byForm: { ...s.byForm, [form]: step(s.byForm?.[form] ?? emptyTally()) } };
	return out;
}

/** A counted first try, recorded on its unit and its atlas or case table cell. */
export function recordFirstTry<T extends FirstTryStats>(s: T, t: FirstTryCount): T {
	return bump(s, t.cell, (x) => addFirstTry(x, t.verdict, t.slip), t.form);
}

/** A slip said in Speak, recorded on its drill and its atlas cell. */
export function recordSpokenSlip<T extends FirstTryStats>(s: T, cell: FirstTryCell, slip: FormSlip): T {
	return bump(s, cell, (x) => addSpokenSlip(x, slip));
}

/** A slip the learner said in Speak, read against the dictionary. */
interface SpokenSlip {
	/** The case drill the phrase puts the word in (gen, dat, loc, ins, acc-fem, acc-people). */
	drill: UnitId;
	slip: FormSlip;
}

/** The slip in a Speak correction: `said` is the learner's line, `right` the
 *  corrected one. The form is the word of `right` the learner did not say,
 *  that is a form of the entry's lemma; the learner's word nearest to it is
 *  what they said for it. Undefined when there is no such word, no case
 *  drill, or no slip (the word is right, or only its accents differ). */
export function spokenSlip(entry: LexiconEntry, said: string, right: string, tag = "sk-SK"): SpokenSlip | undefined {
	const heard = [...said.matchAll(/\p{L}+/gu)].map((m) => m[0].toLocaleLowerCase(tag));
	const forms = knownForms(entry);
	const hit = [...right.matchAll(/\p{L}+/gu)].find((m) => !heard.includes(m[0].toLocaleLowerCase(tag)) && isFormOf(m[0], entryLemma(entry), forms, tag));
	if (!hit || hit.index === undefined) return undefined;
	const answer = hit[0];
	const drill = classifyAll(entry, { sk: right, cloze: { answer, at: hit.index } }).find((u) => caseDrill(u) !== null);
	if (!drill) return undefined;
	const key = answer.toLocaleLowerCase(tag);
	const given = heard.reduce((best, w) => (sharedPrefix(w, key) > sharedPrefix(best, key) ? w : best), heard[0] ?? "");
	const slip = formSlip({ answer, lemma: entryLemma(entry), given, forms }, tag);
	return slip ? { drill, slip } : undefined;
}

function sharedPrefix(a: string, b: string): number {
	const fa = foldDiacritics(a);
	const fb = foldDiacritics(b);
	let i = 0;
	while (i < fa.length && i < fb.length && fa[i] === fb[i]) i++;
	return i;
}
