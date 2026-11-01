/**
 * MIX-UPS (LangHarness, 2026-11-01): a wrong first try that gives another
 * lexicon word opens a pair, predicts its look-alikes, and the Mix-ups
 * lesson drills both. Pins: the family file, what counts as a mix-up (not a
 * form slip, a blank or a non-word), the open → mended and probe → cleared
 * rules, the edit-rule neighbours, the lesson's rep invariants and the
 * tutor's line.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import {
	buildMixupLesson,
	drillable,
	MIXUP_FAMILIES,
	MIXUP_MEND_HITS,
	MIXUP_RECORD_CAP,
	mixupEventOf,
	mixupKey,
	mixupLexicon,
	mixupList,
	mixupsLine,
	mixupStatus,
	PROBE_CLEAR_HITS,
	ruleNeighbours,
	tallyMixups,
	wordGiven,
	type MixupEvent,
	type MixupRecord,
} from "../src/core/mixups.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const entries = (JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] }).words;
const lex = mixupLexicon(entries);

const at = (n: number) => new Date(Date.UTC(2026, 10, 1, 9, n)).toISOString();
const miss = (slug: string, answer: string, given: string, n = 0): MixupEvent => ({ slug, answer, given, verdict: "wrong", sentence: `${answer} mi nezavolal.`, at: at(n) });
const hit = (slug: string, answer: string, n = 0): MixupEvent => ({ slug, answer, given: answer, verdict: "exact", sentence: `${answer} prišiel.`, at: at(n) });

const NIKTO = mixupKey("nikto", "niekto");
const NIC = mixupKey("nic", "nieco");

test("the family file: unique ids, one-line rule and bridge, distinct twins; the ni-/nie- family can be drilled", () => {
	const ids = new Set<string>();
	for (const f of MIXUP_FAMILIES) {
		assert.ok(!ids.has(f.id), `${f.id} appears twice`);
		ids.add(f.id);
		assert.ok(f.rule.length > 10 && !f.rule.includes("\n"), `${f.id}: the rule is one line`);
		assert.ok(f.bridge.length > 10 && !f.bridge.includes("\n"), `${f.id}: the bridge is one line`);
		for (const [a, b] of f.pairs) assert.notEqual(a, b, f.id);
	}
	const ni = MIXUP_FAMILIES.find((f) => f.id === "ni-vs-nie")!;
	const live = ni.pairs.filter(([a, b]) => lex.bySlug.has(a) && lex.bySlug.has(b) && drillable(lex, a, b));
	assert.ok(live.length >= 2, `only ${live.length} ni-/nie- pairs can be drilled`);
});

test("a mix-up is another word: not the same word's form, a blank, a phrase or a non-word", () => {
	const nikto = lex.bySlug.get("nikto")!;
	assert.equal(wordGiven(lex, nikto, "Niekto")?.slug, "niekto");
	assert.equal(wordGiven(lex, nikto, " niekto. ")?.slug, "niekto", "punctuation and case do not matter");
	assert.equal(wordGiven(lex, nikto, "nikto"), null, "its own form is a slip, not a mix-up");
	assert.equal(wordGiven(lex, nikto, ""), null);
	assert.equal(wordGiven(lex, nikto, "nie kto"), null);
	assert.equal(wordGiven(lex, nikto, "qqqzz"), null);
});

test("a miss opens the pair with its family and evidence, and predicts the family's other pairs as probes", () => {
	const { record, found } = tallyMixups({}, [miss("nikto", "Nikto", "Niekto")], lex);
	assert.deepEqual(found, [NIKTO]);
	const m = record[NIKTO]!;
	assert.deepEqual([m.a, m.b], ["nikto", "niekto"], "the word wanted first, then the word given");
	assert.deepEqual(m.words, ["nikto", "niekto"]);
	assert.equal(m.family, "ni-vs-nie");
	assert.equal(mixupStatus(m), "active");
	assert.equal(m.seen?.[0]?.given, "Niekto");
	const probe = record[NIC];
	assert.ok(probe, "nič / niečo is predicted");
	assert.equal(mixupStatus(probe), "probe");
	assert.equal(probe.from, NIKTO);
	assert.equal(probe.misses, 0);
});

test("right first tries mend a mix-up; a later miss opens it again", () => {
	let record: MixupRecord = tallyMixups({}, [miss("nikto", "Nikto", "Niekto")], lex).record;
	const rights = Array.from({ length: MIXUP_MEND_HITS }, (_, i) => hit(i % 2 ? "niekto" : "nikto", i % 2 ? "Niekto" : "Nikto", i + 1));
	record = tallyMixups(record, rights, lex).record;
	assert.equal(mixupStatus(record[NIKTO]!), "mended");
	record = tallyMixups(record, [miss("niekto", "Niekto", "Nikto", 9)], lex).record;
	assert.equal(mixupStatus(record[NIKTO]!), "active");
	assert.equal(record[NIKTO]!.misses, 2);
	assert.equal(record[NIKTO]!.hits, 0);
	assert.equal(record[NIKTO]!.seen?.length, 2);
});

test("a probe is cleared by right first tries, and a miss on it makes it a real mix-up", () => {
	const opened = tallyMixups({}, [miss("nikto", "Nikto", "Niekto")], lex).record;
	const cleared = tallyMixups(opened, Array.from({ length: PROBE_CLEAR_HITS }, (_, i) => hit("nic", "nič", i + 1)), lex).record;
	assert.equal(mixupStatus(cleared[NIC]!), "cleared");
	assert.ok(!mixupList(cleared).some((m) => m.key === NIC), "a cleared probe is not listed");
	const missed = tallyMixups(opened, [miss("nic", "Nič", "Niečo", 2)], lex).record;
	assert.equal(mixupStatus(missed[NIC]!), "active");
	assert.equal(missed[NIC]!.from, undefined, "no longer a prediction");
});

test("the list puts open mix-ups first, then probes, and the tutor line names both", () => {
	const { record } = tallyMixups({}, [miss("nikto", "Nikto", "Niekto")], lex);
	const list = mixupList(record);
	assert.equal(list[0]!.key, NIKTO);
	assert.equal(list[0]!.status, "active");
	assert.match(list[0]!.line, /1 miss · last: “Niekto” for “Nikto”/);
	assert.ok(list.slice(1).every((m) => m.status === "probe"));
	const line = mixupsLine(list)!;
	assert.match(line, /nikto \/ niekto \(1 miss; last wrote "Niekto" in "Nikto mi nezavolal\."\)/);
	assert.match(line, /Not tested yet, but the same pattern: .*nič \/ niečo/);
	assert.equal(mixupsLine(list.filter((m) => m.status === "probe")), null, "probes alone are not a tutor line");
});

test("a pair no family names predicts the same edit applied to other words", () => {
	const word = (slug: string): LexiconEntry => ({
		slug,
		sk: slug,
		en: slug,
		cat: "Phrases",
		related: [],
		examples: [0, 1, 2].map((i) => ({ sk: `${slug} je tu ${i}.`, en: "", cloze: { answer: slug, at: 0 } })) as LexiconEntry["examples"],
	});
	const tiny = mixupLexicon(["nido", "niedo", "nima", "niema", "nipo", "kolo"].map(word));
	const found = ruleNeighbours(tiny, "nido", "niedo").map(([a, b]) => mixupKey(a, b));
	assert.deepEqual(found, [mixupKey("nima", "niema")], "nima / niema follows the ni → nie edit; nipo has no twin");
	assert.deepEqual(ruleNeighbours(tiny, "nido", "kolo"), [], "a big edit predicts nothing");
	const { record } = tallyMixups({}, [{ slug: "nido", answer: "nido", given: "niedo", verdict: "wrong", sentence: "", at: at(0) }], tiny);
	assert.equal(record[mixupKey("nima", "niema")]?.from, mixupKey("nido", "niedo"));
});

test("the Mix-ups lesson: open pairs typed on both sides, probes as a two-way choice, every rep a real sentence", () => {
	const { record } = tallyMixups({}, [miss("nikto", "Nikto", "Niekto")], lex);
	const plan = buildMixupLesson(entries, record, { seed: 7 });
	assert.equal(plan.focus, "mixups");
	assert.ok(plan.items.length >= 8, `${plan.items.length} reps`);
	assert.equal(new Set(plan.items.map((i) => i.id)).size, plan.items.length, "no sentence twice");
	const ni = MIXUP_FAMILIES.find((f) => f.id === "ni-vs-nie")!;
	for (const item of plan.items) {
		assert.equal(item.before + item.answer + item.after, item.sentence, item.id);
		assert.equal(item.pair?.rule, ni.rule, item.id);
		if (item.slug === "nikto" || item.slug === "niekto") assert.equal(item.kind, "type", `${item.id}: an open mix-up is produced`);
		if (item.kind === "choose") {
			assert.equal(item.options?.length, 2, item.id);
			assert.ok(item.options!.includes(item.answer), item.id);
		}
	}
	const sides = new Set(plan.items.filter((i) => i.slug === "nikto" || i.slug === "niekto").map((i) => i.slug));
	assert.deepEqual([...sides].sort(), ["niekto", "nikto"], "both sides of the pair");
	assert.ok(plan.items.some((i) => i.slug === "nic" || i.slug === "nieco"), "the probe is in the lesson");
	assert.equal(buildMixupLesson(entries, {}, { seed: 1 }).items.length, 0, "nothing on record, nothing to drill");
});

test("only one-word first tries count: not meaning or build reps, not the end-of-lesson retry, not after a peek", () => {
	const first = { given: "x", verdict: "wrong" as const };
	assert.ok(mixupEventOf({ kind: "type", first }));
	assert.ok(mixupEventOf({ kind: "choose", first }));
	assert.ok(!mixupEventOf({ kind: "meaning", first }));
	assert.ok(!mixupEventOf({ kind: "build", first }));
	assert.ok(!mixupEventOf({ kind: "type", first, again: true }));
	assert.ok(!mixupEventOf({ kind: "type", first: { ...first, peeked: true } }));
	assert.ok(!mixupEventOf({ kind: "type" }));
});

test("the record keeps at most the cap, dropping settled pairs before open ones", () => {
	const record: MixupRecord = {};
	for (let i = 0; i < MIXUP_RECORD_CAP + 5; i++) record[`a${i}~b${i}`] = { a: `a${i}`, b: `b${i}`, words: [`a${i}`, `b${i}`], since: at(i), lastAt: at(i), misses: 1, hits: i < 10 ? MIXUP_MEND_HITS : 0 };
	const { record: out } = tallyMixups(record, [miss("nikto", "Nikto", "Niekto", 59)], lex);
	assert.equal(Object.keys(out).length, MIXUP_RECORD_CAP);
	assert.ok(out[NIKTO], "the new mix-up stays");
	const open = Object.values(out).filter((m) => mixupStatus(m) === "active").length;
	assert.equal(open, MIXUP_RECORD_CAP + 5 - 10 + 1, "every open mix-up stays");
});
