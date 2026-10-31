/**
 * PAIRS PINS (LangHarness, phase 3, Dvojičky): the pairs file's shape, the
 * drop rule (fewer than three verified sentences), the rep invariants (two
 * options, the target form really in the sentence, exactly one correct),
 * and the units sitting right after their chapter's forms step.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { chapterArc } from "../src/core/arc.ts";
import { CHAPTERS, curriculumUnit } from "../src/core/curriculum.ts";
import { buildPairsLesson, PAIR_UNIT_IDS, UNITS, unitInfo, type UnitId } from "../src/core/lesson.ts";
import { MIN_PAIR_SENTENCES, PAIRS, pairSentences, pairsWithSentences } from "../src/core/pairs.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const lexicon = JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] };
const entries = lexicon.words;

test("the pairs file: 12 to 20 pairs, both forms in the lexicon, a real chapter, a rule and a bridge", () => {
	assert.ok(PAIRS.length >= 12 && PAIRS.length <= 20, `${PAIRS.length} pairs`);
	const lemmas = new Set(entries.map((e) => e.sk));
	const ids = new Set<string>();
	for (const p of PAIRS) {
		assert.ok(!ids.has(p.id), `${p.id} appears twice`);
		ids.add(p.id);
		assert.ok(lemmas.has(p.a), `${p.id}: "${p.a}" is not a lexicon entry`);
		assert.ok(lemmas.has(p.b), `${p.id}: "${p.b}" is not a lexicon entry`);
		assert.notEqual(p.a, p.b, p.id);
		assert.ok(CHAPTERS.some((c) => c.id === p.chapter), `${p.id}: "${p.chapter}" is not a chapter`);
		assert.ok(p.rule.length > 10 && !p.rule.includes("\n"), `${p.id}: the rule is one English line`);
		assert.ok(p.bridge.length > 10 && !p.bridge.includes("\n"), `${p.id}: the bridge is one Estonian line`);
	}
});

test("the registry has one pairs unit per chapter that teaches a pair, of the pairs kind", () => {
	const chapters = [...new Set(PAIRS.map((p) => p.chapter))];
	assert.deepEqual([...PAIR_UNIT_IDS], chapters.map((c) => `pairs-${c}`), "PAIR_UNIT_IDS and the file agree");
	for (const id of PAIR_UNIT_IDS) {
		const info = UNITS.find((u) => u.id === id)!;
		assert.equal(info.kind, "pairs", id);
		assert.ok(curriculumUnit(id), `${id} is not on the map`);
	}
});

test("every pair keeps at least three verified sentences, so none is dropped", () => {
	for (const p of PAIRS) {
		const n = pairSentences(entries, p).length;
		assert.ok(n >= MIN_PAIR_SENTENCES, `${p.id}: only ${n} verified sentences`);
	}
	assert.equal(pairsWithSentences(entries).length, PAIRS.length, "no pair dropped");
});

test("a pair with fewer than three verified sentences is dropped", () => {
	const entry = (sk: string, sentences: number): LexiconEntry =>
		({
			slug: sk,
			sk,
			en: "to test",
			cat: "Verbs",
			examples: Array.from({ length: sentences }, (_, i) => ({ sk: `${sk} ${i}`, en: `to test ${i}`, src: "curated", cloze: { answer: sk, at: 0 } })),
		}) as unknown as LexiconEntry;
	const pair = { id: "thin", a: "robiť", b: "urobiť", rule: "r", bridge: "b", chapter: "moving" };
	assert.equal(pairsWithSentences([entry("robiť", 1), entry("urobiť", 1)], [pair]).length, 0, "two sentences: dropped");
	assert.equal(pairsWithSentences([entry("robiť", 2), entry("urobiť", 1)], [pair]).length, 1, "three sentences: kept");
});

test("each chapter's pairs unit sits right after its forms unit and fills the arc's pairs step", () => {
	for (const id of PAIR_UNIT_IDS) {
		const chapterId = id.slice("pairs-".length);
		const ch = CHAPTERS.find((c) => c.id === chapterId)!;
		const idx = ch.units.indexOf(id);
		assert.ok(idx > 0, `${id} is on the chapter's list`);
		const forms = ch.units.map((u) => curriculumUnit(u)!).find((u) => u.kind === "drill" && !u.id.startsWith("lx-") && !u.id.startsWith("pairs-"));
		assert.ok(forms, `${chapterId} has a forms unit`);
		assert.equal(ch.units.indexOf(forms!.id), idx - 1, `${id} sits right after ${forms!.id}`);
		assert.deepEqual(chapterArc(chapterId)!.find((a) => a.step.id === "pairs")!.units, [id], chapterId);
	}
});

test("pairs reps: two options, the target form in the sentence, exactly one correct", () => {
	for (const id of PAIR_UNIT_IDS) {
		const chapterId = id.slice("pairs-".length);
		const pairs = PAIRS.filter((p) => p.chapter === chapterId);
		const plan = buildPairsLesson(entries, id as UnitId, { seed: 5 });
		assert.equal(plan.items.length, 12, id);
		for (const item of plan.items) {
			const pair = pairs.find((p) => p.id === item.pair!.id)!;
			assert.ok(pair, `${id}: ${item.id} names a pair of the chapter`);
			assert.equal(item.kind, "choose", item.id);
			assert.deepEqual([...(item.options ?? [])].sort(), [pair.a, pair.b].sort(), item.id);
			assert.ok(item.options!.includes(item.answer), item.id);
			assert.equal(item.options!.filter((o) => o === item.answer).length, 1, `${item.id}: exactly one correct option`);
			// The target is really in the sentence: the marked form closes the
			// sentence back together, and the blank sits on a form of the answer.
			assert.equal(item.before + item.form + item.after, item.sentence, item.id);
		}
	}
});

test("a pairs lesson is deterministic per seed and puts fresh sentences first", () => {
	const a = buildPairsLesson(entries, "pairs-town" as UnitId, { seed: 42 });
	const b = buildPairsLesson(entries, "pairs-town" as UnitId, { seed: 42 });
	assert.deepEqual(a, b);
	const recent = new Set(a.items.slice(0, 6).map((i) => i.id));
	const c = buildPairsLesson(entries, "pairs-town" as UnitId, { seed: 42, recent });
	for (const item of c.items) {
		if (recent.has(item.id)) break; // fresh ones all come first
		assert.ok(!recent.has(item.id), "fresh sentences before recent ones");
	}
	assert.ok(c.items.some((i) => !recent.has(i.id)), "a fresh sentence is never crowded out");
	const d = buildPairsLesson(entries, "pairs-town" as UnitId, { seed: 43 });
	assert.notDeepEqual(a.items.map((i) => i.id), d.items.map((i) => i.id));
	assert.equal(unitInfo("pairs-town" as UnitId).kind, "pairs");
});
