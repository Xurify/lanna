/**
 * ASPECT TASKS AND THE FIXTURE PATH (LangHarness, 2026-11-04). Pins the form-
 * reading tasks in the aspect chapters (src/core/aspect-tasks.ts): the grid
 * never offers budem + a perfective, the perfective present carries its note,
 * the cue reps are spans of their own verified sentence with same-length
 * distractor windows, and the tasks are never a first try or a mix-up.
 *
 * It also runs the drill path on a fixture deck, since the shipped aspect
 * pairs have no two-sided deck yet: approved rows on both sides of kupovať /
 * kupiť (real verified sentences of those two entries), through the builder,
 * the parallel choice, the balance gate, the licence, the mend rule and the
 * shadow ids. No network: every source is a file in the repository.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { aspectPairInfo, aspectTasks, cueWindowReport, cueWindows, gridCells, pairsLessonFor, STOPWORDS } from "../src/core/aspect-tasks.ts";
import { PAIRS_TASK_SLOTS, patternExamples, type LessonItem, type UnitId } from "../src/core/lesson.ts";
import { chapterPairs, twinSentences, PAIRS } from "../src/core/pairs.ts";
import {
	buildMixupLesson,
	MIXUP_FAMILIES,
	mixupKey,
	mixupLexicon,
	mixupStatus,
	NO_FRAMES,
	parallelForm,
	tallyMixups,
	type MixupFamily,
	type MixupProbe,
	type MixupRecord,
} from "../src/core/mixups.ts";
import { entryLemma, exampleText, type LexiconEntry } from "../src/core/review.ts";
import { lessonMixupEvent } from "../src/server/mixups.ts";

const entries = (JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] }).words;
const E = (slug: string) => entries.find((e) => e.slug === slug) as LexiconEntry;
const aspect = MIXUP_FAMILIES.find((f) => f.id === "aspect") as MixupFamily;
const accepted = new Set(aspect.formsAccepted ?? []);
const at = (n: number) => new Date(Date.UTC(2026, 10, 4, 10, n)).toISOString();
const fold = (x: string) => x.toLocaleLowerCase("sk-SK");

// ─── The grid ───────────────────────────────────────────────────────────────

test("the grid: every aspect pair with verified paradigms has five formed cells and one with no form", () => {
	for (const [imp, perf] of aspect.pairs) {
		const cells = gridCells(E(imp), E(perf), accepted);
		assert.ok(cells, `${imp}/${perf}: a grid`);
		assert.equal(cells.length, 6, "two rows of three cells");
		assert.equal(cells.filter((c) => c.form !== null).length, 5, "five formed cells");
		assert.equal(cells.find((c) => c.row === 1 && c.col === 2)!.form, null, "the perfective future has no form");
	}
});

test("the grid never offers budem + a perfective, and budem only sits in the imperfective future", () => {
	for (const [imp, perf] of aspect.pairs) {
		for (const cell of gridCells(E(imp), E(perf), accepted)!) {
			if (cell.form === null || !cell.form.startsWith("budem ")) continue;
			assert.equal(cell.row, 0, `${imp}: budem sits in the imperfective row`);
			assert.equal(cell.form, `budem ${entryLemma(E(imp))}`, `${imp}: budem with the imperfective lemma`);
		}
	}
});

test("the grid's forms are the paradigm's own: present and past from the lists, the future from the lemma", () => {
	for (const [imp, perf] of aspect.pairs) {
		const cells = gridCells(E(imp), E(perf), accepted)!;
		for (const cell of cells) {
			if (cell.form === null || cell.form.startsWith("budem ")) continue;
			const list = cell.row === 0 ? E(imp).forms! : E(perf).forms!;
			assert.ok(list.includes(cell.form), `${cell.form} is in the paradigm of its row`);
		}
	}
});

test("the grid labels the perfective present as the future meaning, and the perfective future as no form", () => {
	const cells = gridCells(E("pisat"), E("napisat"), accepted)!;
	assert.equal(cells.find((c) => c.row === 1 && c.col === 1)!.note, "present form = future meaning");
	assert.match(cells.find((c) => c.row === 1 && c.col === 2)!.note ?? "", /no such form/);
});

test("the grid is refused for a pair whose paradigm is not verified and not accepted", () => {
	const unverified = { ...E("citat"), formsVerified: undefined } as LexiconEntry;
	assert.equal(gridCells(unverified, E("precitat"), new Set()), null);
	assert.ok(gridCells(unverified, E("precitat"), accepted), "the family's acceptance is enough");
});

// ─── The cue reps ───────────────────────────────────────────────────────────

test("a cue window is a same-length run of words of the sentence, never the span or a touching run", () => {
	const sentence = "Po porade s lekárom prestal brať lieky.";
	const windows = cueWindows(sentence, "prestal");
	assert.ok(windows.length >= 3);
	for (const w of windows) {
		assert.equal(w.split(" ").length, 1, "one word, as the span is");
		assert.ok(sentence.includes(w), `${w} is in the sentence`);
		assert.notEqual(w, "prestal");
	}
	assert.deepEqual(cueWindows(sentence, "orade"), [], "a span that starts inside a word gives no windows");
	assert.deepEqual(cueWindows(sentence, "absent"), []);
});

test("a cue window the row's form touches or contains is dropped, with its reason (N3)", () => {
	const drops = (sentence: string, span: string, form?: string) => cueWindowReport(sentence, span, form).dropped;
	const reason = (sentence: string, span: string, form: string | undefined, text: string) => drops(sentence, span, form).find((d) => d.text === text)?.reason;
	assert.equal(reason("Román o vojne čítala celú noc.", "celú noc", "čítala", "vojne čítala"), "contains the form", "'vojne čítala' holds the twin form");
	assert.equal(reason("Román o vojne čítala celú noc.", "celú noc", "čítala", "o vojne"), "touches the form");
	assert.equal(reason("Náhodne otvoril knihu a začal čítať.", "začal", "čítať", "čítať"), "contains the form", "'čítať' is the twin form for začal");
	assert.equal(reason("Náhodne otvoril knihu a začal čítať.", "začal", "čítať", "a"), "only function words");
	assert.equal(reason("Tom bude písať list.", "bude", "písať", "list"), "touches the form");
	assert.equal(reason("Po porade s lekárom prestal brať lieky.", "prestal", "brať", "Po"), "only function words");
	assert.equal(reason("Po porade s lekárom prestal brať lieky.", "prestal", "brať", "lieky"), "touches the form");
	assert.ok(drops("Ona bežne pracuje a bežne číta knihy.", "bežne", "pracuje").some((d) => d.text === "bežne" && d.reason === "repeats the cue"), "the same word elsewhere in the sentence is not a window");
	assert.equal(reason("Pracuje tvrdo, tvrdo pracuje.", "Pracuje", undefined, "tvrdo"), "repeats another window");
	assert.deepEqual(cueWindowReport("Román o vojne čítala celú noc.", "celú noc", "čítala").kept, ["Román o"], "the kept window is the one the rules allow");
});

test("the cue-word groups: a window holding one is dropped with its group's reason, and the span itself is never dropped (N9)", () => {
	const reason = (sentence: string, span: string, form: string | undefined, text: string) => cueWindowReport(sentence, span, form).dropped.find((d) => d.text === text)?.reason;
	// Habit and frequency: každý, vždy, často, … and každom only with a time noun next
	assert.equal(reason("Pes štekal často, ale mačka spala v kúte.", "spala", undefined, "často"), "a habit cue");
	assert.equal(reason("Každý deň chodím do parku.", "chodím", undefined, "Každý"), "a habit cue");
	assert.equal(reason("Chodí do školy každom roku.", "Chodí", undefined, "každom"), "a habit cue", "každom with a time noun");
	assert.equal(reason("Chodí v každom obchode.", "Chodí", undefined, "každom"), undefined, "každom with no time noun is kept");
	// Duration: dlho; celý, celú, celé with noc; a number with hodiny, hodín or minút
	assert.equal(reason("Čakal dlho na vlak.", "Čakal", undefined, "dlho"), "a duration cue");
	assert.equal(reason("Čítal celú noc knihu.", "Čítal", undefined, "celú"), "a duration cue");
	assert.equal(reason("Čítal celú noc knihu.", "Čítal", undefined, "noc"), "a duration cue", "the noc of the phrase too");
	assert.equal(reason("Čakal dve hodiny na vlak.", "Čakal", undefined, "dve"), "a duration cue", "the number");
	assert.equal(reason("Čakal dve hodiny na vlak.", "Čakal", undefined, "hodiny"), "a duration cue", "the unit");
	// Phase verbs: budem, budeš, bude, budeme, budete, budú; every form of začať, prestať, skončiť
	assert.equal(reason("Tom bude písať list.", "Tom", undefined, "bude"), "a phase verb");
	assert.equal(reason("Začal čítať knihu.", "knihu", undefined, "Začal"), "a phase verb", "začať by stem");
	assert.equal(reason("Prestal som fajčiť.", "fajčiť", undefined, "Prestal"), "a phase verb", "prestať by stem");
	assert.equal(reason("Skončil včera prácu.", "prácu", undefined, "Skončil"), "a phase verb", "skončiť by stem");
	// Perfective cues: nakoniec, konečne; za with a time noun; podarilo, podarí; stihol, stihla, stihli, stihnem
	assert.equal(reason("Nakoniec ju našiel doma.", "doma", undefined, "Nakoniec"), "a perfective cue");
	assert.equal(reason("Vrátil sa za hodinu domov.", "domov", undefined, "za"), "a perfective cue", "za with a time noun");
	assert.equal(reason("Podarilo sa mu to.", "to", undefined, "Podarilo"), "a perfective cue");
	assert.equal(reason("Stihol včas prísť domov.", "domov", undefined, "Stihol"), "a perfective cue");
	// Present moment: práve
	assert.equal(reason("Práve čítam knihu.", "knihu", undefined, "Práve"), "the present-moment cue");
	// The span is the answer, so it is never a dropped window and never a cue of its own
	assert.deepEqual(cueWindowReport("Každý deň čítam knihu.", "Každý deň", undefined).kept, ["čítam knihu"], "the span is not a window");
});

test("a window that crosses a comma is dropped; ach and čo are filler, so they are only function words (N9)", () => {
	assert.equal(reason2("Dom stojí, a záhrada kvitne.", "záhrada kvitne", undefined, "stojí, a"), "crosses a comma");
	assert.equal(reason2("Ach, zabudla som kúpiť kapustu. Čo budeme robiť?", "budeme", "robiť", "Ach"), "only function words");
	assert.equal(reason2("Ach, zabudla som kúpiť kapustu. Čo budeme robiť?", "budeme", "robiť", "Čo"), "only function words");
	assert.ok(STOPWORDS.has("ach") && STOPWORDS.has("čo"), "ach and čo are stopwords");
});

function reason2(sentence: string, span: string, form: string | undefined, text: string) {
	return cueWindowReport(sentence, span, form).dropped.find((d) => d.text === text)?.reason;
}

test("the cue reps: one per approved row whose span has three windows, each a substring of its sentence", () => {
	const tasks = aspectTasks(entries, PAIRS, "pairs-plans", 5).filter((i) => i.task?.kind === "cue");
	const usable = aspect.probes!.filter((r) => r.approved && r.span && cueWindows(r.sk, r.span, r.form).length >= 3);
	assert.equal(tasks.length, usable.length, "every usable approved row gives one cue rep");
	for (const item of tasks) {
		assert.equal(item.kind, "choose");
		assert.equal(item.task!.kind, "cue");
		assert.ok(item.sentence.includes(item.answer), "the span is in the sentence");
		assert.equal(item.options!.filter((o) => o === item.answer).length, 1, "the span is offered once");
		assert.equal(new Set(item.options).size, item.options!.length, "no repeated option");
		for (const o of item.options!) assert.ok(item.sentence.includes(o), `${o} is a substring of the sentence`);
		for (const o of item.options!.filter((o) => o !== item.answer)) assert.equal(o.split(" ").length, item.answer.split(" ").length, "same length");
	}
});

test("the verifier's span corrections hold: po francúzsky and pohŕdavo are the cues; the three rows that show no single cue give none", () => {
	const row = (part: string) => {
		const hits = aspect.probes!.filter((r) => r.sk.includes(part));
		assert.equal(hits.length, 1, `${part}: one row`);
		return hits[0]!;
	};
	const francuzsky = row("Hovorím po francúzsky každý deň");
	assert.equal(francuzsky.approved !== undefined && francuzsky.span, undefined, "row 53 stays an approved probe row with no cue span (its každý deň is a second answer)");
	const why = cueWindowReport(francuzsky.sk, "po francúzsky", francuzsky.form).dropped.find((d) => d.text === "každý deň");
	assert.equal(why?.reason, "a habit cue", "as a window, každý deň would be a second answer: the rule drops it");
	assert.equal(row("O susedoch vždy hovorila pohŕdavo").span, "pohŕdavo", "the cue is pohŕdavo");
	assert.equal(row("Starý otec vždy hovoril múdro a pokojne").span, undefined, "no single span: no cue rep");
	assert.equal(row("Lokálny obchod predáva čerstvé pečivo každé ráno").span, undefined, "the ongoing offer is no span");
	assert.equal(row("Zodpovední rodičia čítajú deťom každý večer").span, undefined, "no object shows no span");
	const cueRows = aspect.probes!.filter((r) => r.approved && r.span && cueWindows(r.sk, r.span, r.form).length >= 3);
	assert.equal(cueRows.length, 5, "five rows make cue reps: the form's neighbours and the cue words are dropped, and row 53 is withdrawn");
});

test("the rows with fewer than three windows give no cue rep, and are named (N3)", () => {
	const short = aspect.probes!.filter((r) => r.approved && r.span && cueWindows(r.sk, r.span, r.form).length < 3).map((r) => r.span);
	assert.deepEqual([...short].sort(), ["Budete", "bude", "budeš", "celú noc", "nakoniec", "pohŕdavo", "prestal", "v každej trafike", "za necelý mesiac"].sort());
});

test("cue reps and grid reps are tasks: they carry the family's cue and explanation, and never a first try", () => {
	const plan = pairsLessonFor(entries, "pairs-shopping", { seed: 11 });
	const tasks = plan.items.filter((i) => i.task);
	assert.ok(tasks.length > 0, "the shopping chapter has tasks");
	for (const i of tasks) {
		assert.equal(i.pair?.cue, aspect.cue);
		assert.ok(i.pair?.explain, "the explanation is attached");
		assert.equal(lessonMixupEvent({ slug: i.slug, kind: i.kind, first: { given: "x", verdict: "wrong" }, detail: { answer: i.answer, unit: i.unit, task: i.task!.kind } }, at(1)), null, "a task is no mix-up event");
	}
});

test("the task pool: sixty grid tasks and five cue tasks across the twelve pairs (66 is withdrawn; 65 in all)", () => {
	const pool = aspectTasks(entries, PAIRS, "pairs-plans", 5);
	assert.equal(pool.filter((i) => i.task?.kind === "grid").length, 60, "five formed cells in each of twelve pairs");
	assert.equal(pool.filter((i) => i.task?.kind === "cue").length, 5, "five rows with three windows");
	assert.equal(pool.length, 65, "sixty-five tasks in all");
	assert.equal(new Set(pool.map((i) => i.id)).size, pool.length, "every task has its own id");
});

test("a task seen in the last lesson goes to the back of the pool, the rest keep their order (N4)", () => {
	const ids = aspectTasks(entries, PAIRS, "pairs-plans", 5).map((i) => i.id);
	const seen = ids[0]!;
	const after = aspectTasks(entries, PAIRS, "pairs-plans", 5, new Set([seen])).map((i) => i.id);
	assert.equal(after.length, ids.length, "no task is dropped");
	assert.equal(after.at(-1), seen, "the recent task is last");
	assert.deepEqual(after.slice(0, -1), ids.slice(1), "the fresh tasks keep their order");
});

// ─── The Dvojičky lesson with tasks ─────────────────────────────────────────

test("aspect chapters put their tasks at the task slots; other chapters have none", () => {
	for (const chapter of ["everyday", "health", "shopping", "plans", "moving", "stories"]) {
		const plan = pairsLessonFor(entries, `pairs-${chapter}` as UnitId, { seed: 3 });
		assert.equal(plan.items.length, 12, `${chapter}: twelve reps`);
		const at = plan.items.flatMap((i, n) => (i.task ? [n] : []));
		assert.ok(at.length >= 1, `${chapter}: has a task`);
		assert.ok(at.every((n) => PAIRS_TASK_SLOTS.includes(n)), `${chapter}: tasks sit at the task slots (${at})`);
	}
	for (const chapter of ["town", "family", "people", "opinions"]) {
		const plan = pairsLessonFor(entries, `pairs-${chapter}` as UnitId, { seed: 3 });
		assert.ok(plan.items.every((i) => !i.task), `${chapter}: no task`);
		assert.ok(plan.items.every((i) => !i.pair?.explain), `${chapter}: no explanation`);
	}
});

test("the aspect pairs' Dvojičky reps carry the family's cue and explanation; other pairs do not", () => {
	const info = aspectPairInfo(entries);
	const aspectPair = PAIRS.find((p) => p.id === "pisat-vs-napisat")!;
	const other = PAIRS.find((p) => p.id === "tento-vs-ten")!;
	assert.equal(info(aspectPair)?.cue, aspect.cue);
	assert.equal(info(aspectPair)?.explain, aspect.explain);
	assert.equal(info(other), undefined);
	const plan = pairsLessonFor(entries, "pairs-plans", { seed: 4 });
	const pairReps = plan.items.filter((i: LessonItem) => !i.task);
	assert.ok(pairReps.length > 0 && pairReps.every((i) => i.pair?.explain), "every plans pair rep explains");
});

test("the Dvojičky pair ids are the pairs file's ids for the task reps too", () => {
	const ids = new Set(PAIRS.map((p) => p.id));
	const plan = pairsLessonFor(entries, "pairs-stories", { seed: 9 });
	for (const i of plan.items.filter((x) => x.task)) assert.ok(ids.has(i.pair!.id), `${i.pair!.id} is a pairs.json id`);
	assert.ok(chapterPairs("stories").length > 0);
});

// ─── The fixture deck: approved rows on both sides ─────────────────────────

/** Verified rows for kupovať (imperfective) and kupiť (perfective): the first two
 *  raw sentences of each twin, the real examples of those entries. */
function fixtureRows(overrides: Partial<MixupProbe> = {}, extra: MixupProbe[] = []): MixupProbe[] {
	const raw = twinSentences(E("kupovat"), E("kupit"));
	const pick = (member: "a" | "b") => raw.filter((x) => x.member === member).slice(0, 2);
	const rows = [...pick("a"), ...pick("b")].map((s) => ({
		slug: s.entry.slug,
		sk: exampleText(s.entry.examples[s.index]!),
		form: s.form,
		at: s.at,
		type: "fixture",
		phrase: "fixture",
		src: "verified-pool",
		approved: "fixture (test)",
		...overrides,
	}));
	return [...rows, ...extra];
}

const fixtureFamily = (probes: MixupProbe[], extra: Partial<MixupFamily> = {}): MixupFamily => ({
	...aspect,
	probes,
	licence: { first: ["fixture"], second: ["fixture"] },
	...extra,
});

/** A record entry for the kupovať / kupiť pair, as a miss (or a probe) would write it. */
function kupRecord(misses: number, hits = 0, won?: string[]): MixupRecord {
	return { [mixupKey("kupovat", "kupit")]: { a: "kupovat", b: "kupit", words: ["kupovať", "kúpiť"], family: "aspect", since: at(0), lastAt: at(0), misses, hits, ...(won ? { won } : {}) } };
}

const build = (probes: MixupProbe[], record: MixupRecord, seed = 1, extra: Partial<MixupFamily> = {}) => {
	const families = MIXUP_FAMILIES.map((f) => (f.id === "aspect" ? fixtureFamily(probes, extra) : f));
	return buildMixupLesson(entries, record, { seed, length: 12, families });
};

test("fixture: approved rows on both sides give choices from both twins, each distractor the other twin's form in the same slot", () => {
	const plan = build(fixtureRows(), kupRecord(0));
	assert.ok(plan.items.length > 0, "items are built");
	assert.deepEqual([...new Set(plan.items.map((i) => i.slug))].sort(), ["kupit", "kupovat"], "both sides are drilled");
	for (const item of plan.items) {
		assert.equal(item.kind, "choose", "a probe is a choice");
		const other = item.slug === "kupovat" ? E("kupit") : E("kupovat");
		const expected = parallelForm(E(item.slug), other, item.answer, accepted);
		assert.ok(expected !== null, `${item.answer}: a parallel exists`);
		assert.ok(item.options!.includes(item.answer), "the answer is offered");
		assert.ok(item.options!.some((o) => fold(o) === fold(expected!)), `${item.answer}: the other twin's form in the slot (${expected}) is offered`);
	}
});

test("fixture: an infinitive row gives the other twin's lemma as the choice", () => {
	const plan = build(fixtureRows(), kupRecord(0));
	const infinitive = plan.items.find((i) => i.answer === "kúpiť");
	assert.ok(infinitive, "the infinitive row is drilled");
	assert.equal(infinitive!.kind, "choose");
	assert.ok(infinitive!.options!.includes("kupovať"), "the other lemma is the choice");
});

test("fixture: an open mix-up is typed, a probe is chosen", () => {
	const probe = build(fixtureRows(), kupRecord(0));
	assert.ok(probe.items.every((i) => i.kind === "choose"));
	const open = build(fixtureRows(), kupRecord(1));
	assert.ok(open.items.length > 0);
	assert.ok(open.items.every((i) => i.kind === "type"), "an open mix-up is typed");
});

test("fixture: an unapproved row is refused, and a pair with one side approved is refused (the balance gate)", () => {
	assert.equal(build(fixtureRows({ approved: null }), kupRecord(0)).items.length, 0, "unapproved rows drill nothing");
	const oneSide = fixtureRows().filter((r) => r.slug === "kupit");
	assert.equal(build(oneSide, kupRecord(0)).items.length, 0, "one side is not a deck");
});

test("fixture: a row outside the licence is refused", () => {
	assert.equal(build(fixtureRows({ type: "not-licensed" }), kupRecord(0)).items.length, 0);
});

test("fixture: a row with no parallel form is refused unless it is the dictionary form", () => {
	const unverified = (slug: string) => (slug === "kupovat" ? { ...E("kupovat"), formsVerified: undefined } : E(slug));
	const list = entries.map((e) => (e.slug === "kupovat" ? unverified("kupovat") : e));
	const families = MIXUP_FAMILIES.map((f) => (f.id === "aspect" ? fixtureFamily(fixtureRows()) : f));
	const plan = buildMixupLesson(list, kupRecord(0), { seed: 1, length: 12, families });
	// kupovat is unverified: its own rows have no choice, and kupiť's finite rows
	// have no parallel, so only the infinitive (a lemma choice) is left, one side only.
	assert.equal(plan.items.filter((i) => i.slug === "kupovat").length, 0);
	assert.ok(plan.items.every((i) => i.answer === "kúpiť"), "only the dictionary form is left");
	assert.equal(plan.items.length, 0, "and one side alone is no deck");
});

test("fixture: one aspect never mends, and both aspects mend (the fixture's own rows)", () => {
	const key = mixupKey("kupovat", "kupit");
	const right = (slug: string, n: number) => ({ slug, answer: slug, given: slug, verdict: "exact" as const, sentence: "", at: at(n) });
	const lex = mixupLexicon(entries, NO_FRAMES, MIXUP_FAMILIES.map((f) => (f.id === "aspect" ? fixtureFamily(fixtureRows()) : f)));
	let record: MixupRecord = { [key]: { ...kupRecord(1)[key]! } };
	record = tallyMixups(record, [right("kupovat", 1), right("kupovat", 2), right("kupovat", 3), right("kupovat", 4)], lex).record;
	assert.equal(mixupStatus(record[key]!), "active", "three or more right on one aspect do not mend");
	record = tallyMixups(record, [right("kupit", 5)], lex).record;
	assert.equal(mixupStatus(record[key]!), "mended", "the other aspect mends it");
});

test("fixture: a wrong first try between the twins opens the pair, with both aspects' rows drillable", () => {
	const families = MIXUP_FAMILIES.map((f) => (f.id === "aspect" ? fixtureFamily(fixtureRows()) : f));
	const lex = mixupLexicon(entries, NO_FRAMES, families);
	const event = { slug: "kupit", answer: "kúpiť", given: "kupovať", verdict: "wrong" as const, sentence: "Chcem kúpiť knihu.", at: at(1) };
	const { record, found } = tallyMixups({}, [event], lex);
	assert.deepEqual(found, [mixupKey("kupit", "kupovat")]);
	assert.equal(record[mixupKey("kupit", "kupovat")]!.misses, 1);
});

test("visible: a miss on a Dvojičky pick opens the pair even where the family cannot drill it (S1)", () => {
	const event = { slug: "napisat", answer: "napísať", given: "písať", verdict: "wrong" as const, sentence: "Chcem napísať knihu.", at: at(1) };
	assert.deepEqual(tallyMixups({}, [event], mixupLexicon(entries)).record, {}, "a plain miss on an undrillable pair records nothing");
	const seen = tallyMixups({}, [{ ...event, visible: true }], mixupLexicon(entries)).record;
	assert.equal(seen[mixupKey("napisat", "pisat")]?.misses, 1, "a visible miss is recorded");
});

test("a Dvojičky pick's miss from the lesson reads as visible; a task's miss does not count", () => {
	const detail = { answer: "napísať", sentence: "Chcem napísať knihu.", unit: "pairs-plans" };
	const picked = lessonMixupEvent({ slug: "napisat", kind: "choose", first: { given: "písať", verdict: "wrong" }, detail }, at(2));
	assert.equal(picked?.visible, true);
	assert.equal(lessonMixupEvent({ slug: "napisat", kind: "choose", first: { given: "písať", verdict: "wrong" }, detail: { ...detail, task: "cue" } }, at(2)), null);
});

test("shadow ids: a probe row past the entry's own examples has a `#p` id that is never a lexicon example index (S4)", () => {
	const synthetic: MixupProbe = { slug: "kupovat", sk: "Dnes som kupoval knihu.", form: "kupoval", at: 9, type: "fixture", phrase: "fixture", src: "verified-pool", approved: "fixture (test)" };
	const probes = fixtureRows().concat(synthetic);
	const own = E("kupovat").examples.length;
	const plan = build(probes, kupRecord(0));
	const shadow = plan.items.filter((i) => i.id.includes("#p"));
	assert.ok(shadow.length > 0, "the shadow row is drilled");
	for (const item of shadow) {
		const n = Number(item.id.split("#p")[1]);
		assert.ok(Number.isInteger(n) && n >= own, `${item.id}: past the own examples`);
	}
	for (const item of plan.items.filter((i) => !i.id.includes("#p"))) {
		assert.ok(Number(item.id.split("#")[1]) < E(item.slug).examples.length, `${item.id}: a real example index`);
	}
	const drilledShadow = shadow.find((i) => i.sentence === synthetic.sk);
	assert.ok(drilledShadow, "the synthetic row is drilled with its own id");
	assert.equal(drilledShadow!.id, `kupovat#p${own}`, "its id is past the entry's own examples");
});

test("the Same pattern examples never show a form-reading task, and a task rep shows none (N2)", () => {
	const plan = pairsLessonFor(entries, "pairs-plans", { seed: 4 });
	const task = plan.items.find((i) => i.task);
	assert.ok(task, "the plans lesson has a task");
	assert.deepEqual(patternExamples(plan.items, task), [], "a task rep shows no examples");
	const [a, b] = plan.items.filter((i) => !i.task);
	assert.deepEqual(patternExamples([task!, a!, b!], b).map((i) => i.id), [a!.id], "the task before them is not an example");
	assert.ok(patternExamples(plan.items, a).every((o) => !o.task), "no task among a pair rep's examples");
});

test("the task slots are three, at 3, 7 and 11 of a twelve-rep lesson", () => {
	assert.deepEqual(PAIRS_TASK_SLOTS, [3, 7, 11]);
});

test("the fixture lesson never repeats a sentence", () => {
	const plan = build(fixtureRows(), kupRecord(0), 5);
	const ids = plan.items.map((i) => i.id);
	assert.equal(new Set(ids).size, ids.length, "no repeated sentence in one lesson");
});
