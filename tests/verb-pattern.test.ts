import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { buildLesson, givesAway, PATTERN_VERBS, tableBlanks, verbPatterns } from "../src/core/index.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const entries = (JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] })
	.words;
const written = (unit: string) =>
	verbPatterns(entries, unit).map((p) =>
		p.rows.map((r) => r.forms.map((f) => `${f.stem}[${f.ending}]${f.tail ? ` ${f.tail}` : ""}`).join(" / ")),
	);

test("every verb unit's model verbs are in the dictionary with a full table", () => {
	for (const [unit, verbs] of Object.entries(PATTERN_VERBS))
		assert.deepEqual(
			verbPatterns(entries, unit).map((p) => p.verb),
			verbs,
			unit,
		);
});

test("the present table marks the endings the rule names", () => {
	assert.deepEqual(written("present")[0], ["číta[m]", "číta[š]", "číta[]", "číta[me]", "číta[te]", "číta[jú]"]);
	assert.deepEqual(written("present-ujem")[0], [
		"pracuj[em]",
		"pracuj[eš]",
		"pracuj[e]",
		"pracuj[eme]",
		"pracuj[ete]",
		"pracuj[ú]",
	]);
	assert.equal(verbPatterns(entries, "present")[1]!.gloss, "to speak");
});

test("the past table pairs the -l form with som and si, by gender", () => {
	assert.deepEqual(written("past")[0], [
		"robi[l] som / robi[la] som",
		"robi[l] si / robi[la] si",
		"robi[l]",
		"robi[la]",
		"robi[lo]",
		"robi[li] sme",
		"robi[li] ste",
		"robi[li]",
	]);
});

test("a verb whose forms do not have the expected shape gets no table", () => {
	const odd = [
		{ slug: "x", lemma: "čítať", en: "to read", forms: ["čítam", "čítaš"], examples: [] },
	] as unknown as LexiconEntry[];
	assert.deepEqual(verbPatterns(odd, "present"), []);
	assert.deepEqual(verbPatterns(entries, "loc"), []);
});

test("only a new verb lesson carries the tables", () => {
	assert.equal(buildLesson(entries, "past", { seed: 1 }).patterns?.length, 1);
	assert.equal(buildLesson(entries, "past", { seed: 1, stage: "practiced" }).patterns, undefined);
	assert.equal(buildLesson(entries, "loc", { seed: 1 }).patterns, undefined);
});

test("the closing table blanks three forms the lesson drilled", () => {
	const blanks = (unit: string) => tableBlanks(verbPatterns(entries, unit)[0]!).map((b) => [b.row, b.form, b.answer]);
	assert.deepEqual(blanks("present"), [
		[1, 0, "čítaš"],
		[3, 0, "čítame"],
		[5, 0, "čítajú"],
	]);
	assert.deepEqual(blanks("present-ujem"), [
		[1, 0, "pracuješ"],
		[3, 0, "pracujeme"],
		[5, 0, "pracujú"],
	]);
	assert.deepEqual(blanks("present-em"), [
		[1, 0, "píšeš"],
		[3, 0, "píšeme"],
		[5, 0, "píšu"],
	]);
	assert.deepEqual(blanks("past"), [
		[0, 1, "robila"],
		[3, 0, "robila"],
		[5, 0, "robili"],
	]);
});

test("no cell left on screen gives a blank's answer away", () => {
	for (const unit of Object.keys(PATTERN_VERBS)) {
		const pattern = verbPatterns(entries, unit)[0]!;
		const blanks = tableBlanks(pattern);
		const visible = pattern.rows.flatMap((row, r) =>
			row.forms
				.map((f, i) => ({ form: f.stem + f.ending, r, i }))
				.filter(
					({ r: rr, i }) => !blanks.some((b) => b.row === rr && b.form === i) && !givesAway(pattern, blanks, rr, i),
				),
		);
		for (const b of blanks)
			assert.ok(!visible.some((v) => v.form === b.answer), `${unit}: ${b.answer} is still on screen`);
	}
	const past = verbPatterns(entries, "past")[0]!;
	assert.equal(givesAway(past, tableBlanks(past), 1, 1), true, "robila si would answer robila");
	assert.equal(givesAway(past, tableBlanks(past), 2, 0), false, "robil gives nothing away");
});

test("each past form says whose it is", () => {
	const ja = verbPatterns(entries, "past")[0]!.rows[0]!;
	assert.deepEqual(
		ja.forms.map((f) => f.en),
		["I (man)", "I (woman)"],
	);
});
