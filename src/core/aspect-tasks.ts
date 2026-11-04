/**
 * Form-reading tasks for the aspect chapters (LangHarness, 2026-11-04). Two
 * kinds of rep, both built from data the learner can already see, so they
 * reach them in the shipped state (the aspect pairs have no two-sided deck
 * yet, so the drills do not):
 *
 * - grid: one aspect pair's grid (past, present, future by imperfective and
 *   perfective) with its cells labelled and empty. The question names a form,
 *   and the learner places it: picks the label of the cell it belongs in. The
 *   cells fill, with their notes, once the rep is answered. The perfective
 *   future cell has no form: budem + a perfective is never offered. Each formed
 *   cell of each pair is one task: five per pair, sixty in all.
 * - cue: an approved row's own sentence, with the word or phrase that decided
 *   its form (the row's span) among same-length windows of the same sentence.
 *   A window is dropped when it overlaps the span, repeats it, contains the
 *   form, touches the form, crosses a comma, holds a cue word of the verifier's
 *   list (habit, duration, phase verb, perfective, present moment: cueMarks),
 *   or is made only of function words (STOPWORDS). A row with fewer than three
 *   windows left gives no cue rep.
 *
 * Neither is a drill for the first-try measure or the mix-up record (the
 * player and the server read `task`). The grid's forms come from the paradigms,
 * so a pair with an unverified list (unless the family accepts it) gets no grid.
 *
 * Pure and browser-safe: the family file is bundled, no fs.
 */

import { MIXUP_FAMILIES, mixupKey, parallelForm, type MixupFamily, type MixupProbe } from "./mixups.ts";
import { buildPairsLesson, rng, shuffle, type LessonExplain, type LessonItem, type LessonPlan, type LessonTask, type UnitId } from "./lesson.ts";
import { chapterPairs, pairMembers, type PairDef } from "./pairs.ts";
import { entryLemma, exampleText, type LexiconEntry } from "./review.ts";

/** The family whose pairs are aspect pairs (curriculum/slovak/mixups.json). */
export const ASPECT_FAMILY_ID = "aspect";

const CELL_ROWS = ["imperfective", "perfective"];
const CELL_COLS = ["past", "present", "future"];
const PERFECTIVE_PRESENT_NOTE = "present form = future meaning";
const PERFECTIVE_FUTURE_NOTE = "perfective future: no such form";

/** Function words and clitics a cue window is never made of alone (lowercase). */
export const STOPWORDS: ReadonlySet<string> = new Set([
	"a", "i", "o", "u", "v", "vo", "s", "so", "z", "zo", "na", "do", "od", "po", "za", "pre", "pri", "pod", "nad", "bez", "k", "ku", "o",
	"ani", "aj", "ale", "že", "aby", "ak", "ako", "lebo", "keď", "tak", "len", "tiež", "ešte", "už", "veľmi", "tu", "tam", "ten", "tá", "to", "toto", "ach", "čo",
	"sa", "si", "som", "sme", "ste", "je", "sú", "bol", "bola", "boli", "mi", "ti", "mu", "ho", "ju", "ich", "im", "ma", "nás", "vás", "ťa",
]);

const aspectFamily = (): MixupFamily | undefined => MIXUP_FAMILIES.find((f) => f.id === ASPECT_FAMILY_ID);

/** The masculine singular past (bral, čítal): the only past form the grid reads. */
const isPastMasc = (form: string) => /l$/iu.test(form.trim());

/** A paradigm the verifier has checked: flagged in the lexicon, or accepted by the family. */
const verified = (e: LexiconEntry, accepted: ReadonlySet<string>) => (e as { formsVerified?: boolean }).formsVerified === true || accepted.has(e.slug);

/** The family's pair as [imperfective, perfective] entries, or null when either is missing. */
function aspectTwins(entries: readonly LexiconEntry[], pair: [string, string]): [LexiconEntry, LexiconEntry] | null {
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
		{ row: 1, col: 1, form: presentPerf, note: `${presentPerf}: ${PERFECTIVE_PRESENT_NOTE}` },
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

/** The grid tasks of one aspect pair: one per formed cell. The question names
 *  the cell's form and the options are three cell labels, the answer among them. */
function gridTasks(entries: readonly LexiconEntry[], family: MixupFamily, unit: UnitId, rand: () => number, pair: [string, string], ids: ReadonlyMap<string, string>): LessonItem[] {
	const accepted = new Set(family.formsAccepted ?? []);
	const twins = aspectTwins(entries, pair);
	if (!twins) return [];
	const [imp, perf] = twins;
	const cells = gridCells(imp, perf, accepted);
	if (!cells) return [];
	const askable = cells.filter((c) => c.form !== null);
	return askable.map((target) => {
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
			hint: "Which cell of the grid does this form belong in?",
			options: shuffle([answer, ...others.map((c) => cellLabel(c.row, c.col))], rand),
			task,
			pair: pairOf(family, imp.slug, perf.slug, ids),
		};
	});
}

/** Word tokens of a sentence, with where each starts and ends. */
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
function wordsOf(text: string): Array<{ start: number; end: number }> {
	return [...text.matchAll(WORD)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
}

/* The cue words a window may not hold (N9; the verifier's list, lowercase). A
 * window that holds one is dropped, unless it is the row's span. */
const HABIT_WORDS: ReadonlySet<string> = new Set(["každý", "každá", "každé", "každú", "každoročne", "denne", "vždy", "často", "zvyčajne", "obvykle", "bežne", "občas"]);
/** "každom" counts only with a time noun next. */
const EACH_IN_TIME = "každom";
const TIME_NOUNS: ReadonlySet<string> = new Set(["deň", "dni", "dní", "týždeň", "týždňa", "týždni", "týždne", "týždňov", "mesiac", "mesiaca", "mesiaci", "mesiace", "mesiacov", "rok", "roku", "roky", "rokov", "večer", "ráno", "noc", "hodinu", "hodine", "hodiny", "hodín", "minútu", "minúty", "minút", "sekúnd", "chvíľu", "polhodinu"]);
const DURATION_WORDS: ReadonlySet<string> = new Set(["dlho"]);
/** "celý", "celú", "celé" count with a time noun next (celý deň, celé ráno, celú noc). */
const WHOLE_WORDS: ReadonlySet<string> = new Set(["celý", "celú", "celé"]);
const NUMBER_WORDS: ReadonlySet<string> = new Set(["jeden", "jedna", "jedno", "jednu", "dva", "dve", "tri", "štyri", "päť", "šesť", "sedem", "osem", "deväť", "desať", "jedenásť", "dvanásť", "pätnásť", "dvadsať", "tridsať", "štyridsať", "päťdesiat", "šesťdesiat", "sedemdesiat", "osemdesiat", "deväťdesiat", "sto"]);
/** A number before one of these is a duration. */
const HOUR_MINUTE_WORDS: ReadonlySet<string> = new Set(["hodiny", "hodín", "minút", "minúty", "hodinu", "dni", "dní"]);
const PHASE_WORDS: ReadonlySet<string> = new Set(["budem", "budeš", "bude", "budeme", "budete", "budú"]);
/** Every form of začať, prestať and skončiť, by its stem. */
const PHASE_STEMS = ["začn", "začal", "začať", "začín", "prestan", "prestaň", "prestal", "prestať", "prestá", "skonč", "konč"];
/** The perfective cue words that are whole words. */
const PERFECTIVE_WORDS: ReadonlySet<string> = new Set(["nakoniec", "konečne"]);
/** podaril-, podarí and stihol, stihne, stihnú, stihnúť by stem. "podari" alone misses the accented podarí, so both are listed. */
const PERFECTIVE_STEMS = ["podari", "podarí", "stih"];
/** "za" counts with a time noun within the next two words. */
const FOR_WORD = "za";
const PRESENT_WORDS: ReadonlySet<string> = new Set(["práve"]);

export type CueGroup = "habit" | "duration" | "phase" | "perfective" | "present";

const GROUP_REASON: Record<CueGroup, WindowDrop["reason"]> = {
	habit: "a habit cue",
	duration: "a duration cue",
	phase: "a phase verb",
	perfective: "a perfective cue",
	present: "the present-moment cue",
};

const isNumberWord = (w: string) => /^\p{N}+$/u.test(w) || NUMBER_WORDS.has(w);

/** The cue-word tokens of a sentence, by token index, each with its group. */
function cueMarks(sentence: string, tokens: ReadonlyArray<{ start: number; end: number }>): Map<number, CueGroup> {
	const words = tokens.map((t) => sentence.slice(t.start, t.end).toLocaleLowerCase("sk-SK"));
	const marks = new Map<number, CueGroup>();
	const mark = (i: number, group: CueGroup) => {
		if (!marks.has(i)) marks.set(i, group);
	};
	words.forEach((w, i) => {
		const next = words[i + 1];
		if (HABIT_WORDS.has(w)) mark(i, "habit");
		if (w === EACH_IN_TIME && next !== undefined && TIME_NOUNS.has(next)) mark(i, "habit");
		if (DURATION_WORDS.has(w)) mark(i, "duration");
		if (WHOLE_WORDS.has(w) && TIME_NOUNS.has(next ?? "")) {
			mark(i, "duration");
			mark(i + 1, "duration");
		}
		if (HOUR_MINUTE_WORDS.has(w) && i > 0 && isNumberWord(words[i - 1]!)) {
			mark(i - 1, "duration");
			mark(i, "duration");
		}
		if (PHASE_WORDS.has(w) || PHASE_STEMS.some((stem) => w.startsWith(stem))) mark(i, "phase");
		if (PERFECTIVE_WORDS.has(w) || PERFECTIVE_STEMS.some((stem) => w.startsWith(stem))) mark(i, "perfective");
		if (w === FOR_WORD && (TIME_NOUNS.has(next ?? "") || TIME_NOUNS.has(words[i + 2] ?? ""))) mark(i, "perfective");
		if (PRESENT_WORDS.has(w)) mark(i, "present");
	});
	return marks;
}

/** Why a candidate window was not offered as a cue option. */
export type WindowDrop = {
	text: string;
	reason:
		| "overlaps the cue"
		| "repeats the cue"
		| "contains the form"
		| "touches the form"
		| "crosses a comma"
		| "a habit cue"
		| "a duration cue"
		| "a phase verb"
		| "a perfective cue"
		| "the present-moment cue"
		| "only function words"
		| "repeats another window";
};

/** The cue windows of a sentence: the same number of words as the span, each
 *  kept or dropped with its reason. `form` is the verb form the row names (its
 *  first and last words are read from the sentence; none when absent). `keep`
 *  is the row's keep list: a window that is exactly one of its words skips the
 *  cue-word drop only (the other drops still apply). */
export function cueWindowReport(sentence: string, span: string, form?: string, keep: readonly string[] = []): { kept: string[]; dropped: WindowDrop[] } {
	const none = { kept: [] as string[], dropped: [] as WindowDrop[] };
	const at = sentence.indexOf(span);
	if (at < 0 || span.length === 0) return none;
	const tokens = wordsOf(sentence);
	const first = tokens.findIndex((t) => t.start === at);
	const last = tokens.findIndex((t) => t.end === at + span.length);
	if (first < 0 || last < first || sentence.slice(tokens[first]!.start, tokens[last]!.end) !== span) return none;
	const n = last - first + 1;
	let formFirst = -1;
	let formLast = -1;
	if (form) {
		const fa = sentence.indexOf(form);
		const fi = fa < 0 ? -1 : tokens.findIndex((t) => t.start === fa);
		const fl = fa < 0 ? -1 : tokens.findIndex((t) => t.end === fa + form.length);
		if (fi >= 0 && fl >= fi) [formFirst, formLast] = [fi, fl];
	}
	const marks = cueMarks(sentence, tokens);
	const kept: string[] = [];
	const dropped: WindowDrop[] = [];
	for (let k = 0; k + n <= tokens.length; k++) {
		const a = k;
		const b = k + n - 1;
		const text = sentence.slice(tokens[a]!.start, tokens[b]!.end);
		const drop = (reason: WindowDrop["reason"]) => dropped.push({ text, reason });
		let cue: CueGroup | undefined;
		for (let i = a; i <= b && cue === undefined; i++) cue = marks.get(i);
		if (a <= last && b >= first) drop("overlaps the cue");
		else if (text === span) drop("repeats the cue");
		else if (formFirst >= 0 && a <= formLast && b >= formFirst) drop("contains the form");
		else if (formFirst >= 0 && (b === formFirst - 1 || a === formLast + 1)) drop("touches the form");
		else if (text.includes(",")) drop("crosses a comma");
		else if (cue !== undefined && !keep.includes(text)) drop(GROUP_REASON[cue]);
		else if (wordsOf(text).every((w) => STOPWORDS.has(text.slice(w.start, w.end).toLocaleLowerCase("sk-SK")))) drop("only function words");
		else if (kept.includes(text)) drop("repeats another window");
		else kept.push(text);
	}
	return { kept, dropped };
}

/** The windows a cue offers (see cueWindowReport). */
export function cueWindows(sentence: string, span: string, form?: string, keep: readonly string[] = []): string[] {
	return cueWindowReport(sentence, span, form, keep).kept;
}

/** The cue groups the span's own words belong to (habit, duration, phase,
 *  perfective, present), so a test can name which kind of cue a row is. */
export function spanCueGroups(sentence: string, span: string): CueGroup[] {
	const at = sentence.indexOf(span);
	if (at < 0 || span.length === 0) return [];
	const tokens = wordsOf(sentence);
	const first = tokens.findIndex((t) => t.start === at);
	const last = tokens.findIndex((t) => t.end === at + span.length);
	if (first < 0 || last < first) return [];
	const marks = cueMarks(sentence, tokens);
	const groups = new Set<CueGroup>();
	for (let i = first; i <= last; i++) {
		const g = marks.get(i);
		if (g !== undefined) groups.add(g);
	}
	return [...groups];
}

/** The cue rep's question, built from the row: the verb the sentence holds and
 *  its twin, so a cue word on another verb cannot be mistaken for the answer
 *  (N10). A finite row names the parallel form ("kúpil and not kupoval"); an
 *  infinitive row names the two lemmas ("robiť and not urobiť"). Null when the
 *  twin's form cannot be found. */
export function cueQuestion(entries: readonly LexiconEntry[], family: MixupFamily, row: MixupProbe): string | null {
	const entry = entries.find((e) => e.slug === row.slug);
	const pair = family.pairs.find(([x, y]) => x === row.slug || y === row.slug);
	if (!entry || !pair || !row.form) return null;
	const twin = entries.find((e) => e.slug === (pair[0] === row.slug ? pair[1] : pair[0]));
	if (!twin) return null;
	const theirs = row.form === entryLemma(entry) ? entryLemma(twin) : parallelForm(entry, twin, row.form, new Set(family.formsAccepted ?? []));
	if (theirs === null) return null;
	return `Which word made it ${row.form} and not ${theirs}?`;
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
		const windows = cueWindows(row.sk, row.span, row.form, row.cueKeep ?? []);
		if (windows.length < 3) return;
		const question = cueQuestion(entries, family, row);
		if (question === null) return;
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
			hint: question,
			options: shuffle([row.span, ...shuffle(windows, rand).slice(0, 3)], rand),
			task: { kind: "cue", span: row.span, phrase: row.phrase ?? row.type, question },
			pair: pairOf(family, pair[0], pair[1], ids),
		});
	});
	return out;
}

/** The form-reading tasks of a chapter's aspect pairs: every grid and cue task
 *  in a shuffled order, the tasks not seen in the last lessons first (`recent`
 *  holds the rep ids). Empty when the chapter has no aspect pair. */
export function aspectTasks(entries: readonly LexiconEntry[], pairs: readonly PairDef[], unit: UnitId, seed: number, recent?: ReadonlySet<string>): LessonItem[] {
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
	const grids = twins.flatMap((pair) => gridTasks(entries, family, unit, rand, pair, ids));
	const slugs = new Set(twins.flat());
	const pool = shuffle([...grids, ...cueTasks(entries, family, unit, rand, slugs, ids)], rand);
	return [...pool.filter((t) => !recent?.has(t.id)), ...pool.filter((t) => recent?.has(t.id))];
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
	const tasks = aspectTasks(entries, chapterPairs(chapter), unit, opts.seed, opts.recent);
	return buildPairsLesson(entries, unit, { seed: opts.seed, recent: opts.recent, tasks, pairInfo: aspectPairInfo(entries) });
}
