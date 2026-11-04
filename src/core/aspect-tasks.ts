/**
 * Form-reading tasks for the aspect chapters (LangHarness, 2026-11-04). Two
 * kinds of rep, both built from data the learner can already see, so they
 * reach them in the shipped state (the aspect pairs have no two-sided deck
 * yet, so the drills do not):
 *
 * - grid: the forms of one aspect pair in a 2×3 grid (past, present, future
 *   by imperfective and perfective). The question names one form; the answer
 *   is the cell it sits in. The perfective present is labelled "present form =
 *   future meaning". The perfective future cell has no form: budem + a
 *   perfective infinitive is never offered.
 * - cue: an approved row's own sentence, with the word or phrase that decided
 *   its form (the row's span) among three windows of the same length from the
 *   same sentence. No new sentences: every row is a verified sentence.
 *
 * Neither is a drill for the first-try measure or the mix-up record (the
 * player and the server read `task` and skip them). The grid's forms come from
 * the paradigms, so a pair with an unverified list (unless the family accepts
 * it) gets no grid.
 *
 * Pure and browser-safe: the family file is bundled, no fs.
 */

import { MIXUP_FAMILIES, mixupKey, type MixupFamily, type MixupProbe } from "./mixups.ts";
import { buildPairsLesson, rng, shuffle, type LessonExplain, type LessonItem, type LessonPlan, type LessonTask, type UnitId } from "./lesson.ts";
import { chapterPairs, pairMembers, type PairDef } from "./pairs.ts";
import { entryLemma, exampleText, type LexiconEntry } from "./review.ts";

/** The family whose pairs are aspect pairs (curriculum/slovak/mixups.json). */
export const ASPECT_FAMILY_ID = "aspect";

const CELL_ROWS = ["imperfective", "perfective"];
const CELL_COLS = ["past", "present", "future"];
const PERFECTIVE_PRESENT_NOTE = "present form = future meaning";
const PERFECTIVE_FUTURE_NOTE = "no such form: the perfective future is the present form";

const aspectFamily = (): MixupFamily | undefined => MIXUP_FAMILIES.find((f) => f.id === ASPECT_FAMILY_ID);

/** The masculine singular past (bral, čítal): the only past form the grid reads. */
const isPastMasc = (form: string) => /l$/iu.test(form.trim());

/** A paradigm the verifier has checked: flagged in the lexicon, or accepted by the family. */
const verified = (e: LexiconEntry, accepted: ReadonlySet<string>) => (e as { formsVerified?: boolean }).formsVerified === true || accepted.has(e.slug);

/** The family's pair as [imperfective, perfective] entries, or null when either is missing. */
function aspectTwins(entries: readonly LexiconEntry[], family: MixupFamily, pair: [string, string]): [LexiconEntry, LexiconEntry] | null {
	const imp = entries.find((e) => e.slug === pair[0]);
	const perf = entries.find((e) => e.slug === pair[1]);
	return imp && perf ? [imp, perf] : null;
}

/** The six cells of the grid for one aspect pair, row by row, or null when a
 *  paradigm is missing or not verified. */
export function gridCells(imp: LexiconEntry, perf: LexiconEntry, accepted: ReadonlySet<string> = new Set()): Array<{ row: number; col: number; form: string | null; note?: string }> | null {
	if (!verified(imp, accepted) || !verified(perf, accepted)) return null;
	const presentImp = imp.forms?.[0];
	const pastImp = imp.forms?.find(isPastMasc);
	const presentPerf = perf.forms?.[0];
	const pastPerf = perf.forms?.find(isPastMasc);
	if (!presentImp || !pastImp || !presentPerf || !pastPerf) return null;
	return [
		{ row: 0, col: 0, form: pastImp },
		{ row: 0, col: 1, form: presentImp },
		{ row: 0, col: 2, form: `budem ${entryLemma(imp)}` },
		{ row: 1, col: 0, form: pastPerf },
		{ row: 1, col: 1, form: presentPerf, note: PERFECTIVE_PRESENT_NOTE },
		{ row: 1, col: 2, form: null, note: PERFECTIVE_FUTURE_NOTE },
	];
}

const cellLabel = (row: number, col: number) => `${CELL_ROWS[row]} · ${CELL_COLS[col]}`;

/** The explanation a family's pair shows after a miss (aspect only). */
function explainFor(family: MixupFamily): { cue?: string; explain?: LessonExplain } {
	return { ...(family.cue ? { cue: family.cue } : {}), ...(family.explain ? { explain: family.explain } : {}) };
}

/** The pair block a task rep carries: the family's rule, bridge, cue and explanation.
 *  The id is the Dvojičky pair's (curriculum/slovak/pairs.json) when the chapter has it. */
const pairOf = (family: MixupFamily, imp: string, perf: string, ids: ReadonlyMap<string, string>) => ({
	id: ids.get(mixupKey(imp, perf)) ?? mixupKey(imp, perf),
	rule: family.rule,
	bridge: family.bridge,
	...explainFor(family),
});

/** One grid rep for an aspect pair: the question names one form and the
 *  options are three cell labels, the answer among them. */
function gridTask(entries: readonly LexiconEntry[], family: MixupFamily, unit: UnitId, rand: () => number, pair: [string, string], ids: ReadonlyMap<string, string>): LessonItem | null {
	const accepted = new Set(family.formsAccepted ?? []);
	const twins = aspectTwins(entries, family, pair);
	if (!twins) return null;
	const [imp, perf] = twins;
	const cells = gridCells(imp, perf, accepted);
	if (!cells) return null;
	const askable = cells.filter((c) => c.form !== null);
	const target = askable[Math.floor(rand() * askable.length)]!;
	const others = shuffle(askable.filter((c) => c !== target), rand).slice(0, 2);
	const answer = cellLabel(target.row, target.col);
	const task: LessonTask = { kind: "grid", form: target.form!, rows: CELL_ROWS, cols: CELL_COLS, cells, target: { row: target.row, col: target.col } };
	const holder = target.row === 0 ? imp : perf;
	return {
		id: `${holder.slug}#task-grid-${target.row}${target.col}`,
		kind: "choose",
		unit,
		slug: holder.slug,
		lemma: entryLemma(holder),
		gloss: holder.en,
		sentence: "",
		translation: "",
		answer,
		before: "",
		after: "",
		hint: "Which cell of the grid holds this form?",
		options: shuffle([answer, ...others.map((c) => cellLabel(c.row, c.col))], rand),
		task,
		pair: pairOf(family, imp.slug, perf.slug, ids),
	};
}

/** Word tokens of a sentence, with where each starts and ends. */
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
function wordsOf(text: string): Array<{ start: number; end: number }> {
	return [...text.matchAll(WORD)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
}

/** The windows of the sentence the same number of words as the span, not
 *  touching it, and not the span's own text. Empty when the span is not a
 *  whole run of words of the sentence. */
export function cueWindows(sentence: string, span: string): string[] {
	const at = sentence.indexOf(span);
	if (at < 0 || span.length === 0) return [];
	const tokens = wordsOf(sentence);
	const first = tokens.findIndex((t) => t.start === at);
	const last = tokens.findIndex((t) => t.end === at + span.length);
	if (first < 0 || last < first || sentence.slice(tokens[first]!.start, tokens[last]!.end) !== span) return [];
	const n = last - first + 1;
	const out: string[] = [];
	for (let k = 0; k + n <= tokens.length; k++) {
		if (k <= last && k + n - 1 >= first) continue;
		const text = sentence.slice(tokens[k]!.start, tokens[k + n - 1]!.end);
		if (text !== span && !out.includes(text)) out.push(text);
	}
	return out;
}

/** One cue rep per approved row of the chapter's aspect twins that has a span
 *  with at least three windows to offer. */
function cueTasks(entries: readonly LexiconEntry[], family: MixupFamily, unit: UnitId, rand: () => number, slugs: ReadonlySet<string>, ids: ReadonlyMap<string, string>): LessonItem[] {
	const out: LessonItem[] = [];
	(family.probes ?? []).forEach((row: MixupProbe, index) => {
		if (!row.approved || !row.span || !slugs.has(row.slug)) return;
		const entry = entries.find((e) => e.slug === row.slug);
		const pair = family.pairs.find(([x, y]) => x === row.slug || y === row.slug);
		if (!entry || !pair) return;
		const windows = cueWindows(row.sk, row.span);
		if (windows.length < 3) return;
		const translation = row.en ?? entry.examples.find((x) => exampleText(x) === row.sk)?.en ?? "";
		out.push({
			id: `${entry.slug}#task-cue-${index}`,
			kind: "choose",
			unit,
			slug: entry.slug,
			lemma: entryLemma(entry),
			gloss: entry.en,
			sentence: row.sk,
			translation,
			answer: row.span,
			before: "",
			after: "",
			hint: "Which word decided the form?",
			options: shuffle([row.span, ...shuffle(windows, rand).slice(0, 3)], rand),
			task: { kind: "cue", span: row.span, phrase: row.phrase ?? row.type },
			pair: pairOf(family, pair[0], pair[1], ids),
		});
	});
	return out;
}

/** The form-reading tasks of a chapter's aspect pairs, shuffled (empty when
 *  the chapter has no aspect pair). */
export function aspectTasks(entries: readonly LexiconEntry[], pairs: readonly PairDef[], unit: UnitId, seed: number): LessonItem[] {
	const family = aspectFamily();
	if (!family) return [];
	const rand = rng(seed);
	const twins: Array<[string, string]> = [];
	const ids = new Map<string, string>();
	for (const p of pairs) {
		const members = pairMembers(entries, p);
		if (!members) continue;
		const key = mixupKey(members[0].slug, members[1].slug);
		const listed = family.pairs.find(([x, y]) => mixupKey(x, y) === key);
		if (!listed) continue;
		twins.push(listed);
		ids.set(key, p.id);
	}
	if (twins.length === 0) return [];
	const grids = twins.flatMap((pair) => gridTask(entries, family, unit, rand, pair, ids) ?? []);
	const slugs = new Set(twins.flat());
	return shuffle([...grids, ...cueTasks(entries, family, unit, rand, slugs, ids)], rand);
}

/** The cue and explanation an aspect pair's Dvojičky reps carry; none for other pairs. */
export function aspectPairInfo(entries: readonly LexiconEntry[]): (pair: PairDef) => { cue?: string; explain?: LessonExplain } | undefined {
	const family = aspectFamily();
	return (pair) => {
		const members = pairMembers(entries, pair);
		if (!family || !members) return undefined;
		const key = mixupKey(members[0].slug, members[1].slug);
		return family.pairs.some(([x, y]) => mixupKey(x, y) === key) ? explainFor(family) : undefined;
	};
}

/** A Dvojičky lesson for a chapter, with its aspect pairs' tasks and explanations.
 *  A chapter with no aspect pair is the plain Dvojičky lesson. */
export function pairsLessonFor(entries: readonly LexiconEntry[], unit: UnitId, opts: { seed: number; recent?: ReadonlySet<string> }): LessonPlan {
	const chapter = unit.startsWith("pairs-") ? unit.slice("pairs-".length) : unit;
	const tasks = aspectTasks(entries, chapterPairs(chapter), unit, opts.seed);
	return buildPairsLesson(entries, unit, { seed: opts.seed, recent: opts.recent, tasks, pairInfo: aspectPairInfo(entries) });
}
