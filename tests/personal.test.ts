/**
 * THE PERSONAL LESSON (LangHarness, 2026-11-01): the guide's model names
 * targets, the lexicon decides which survive, and the lesson is built from
 * verified sentences only. Pins: what resolvePractice keeps and drops, the
 * rep invariants (every rep a real sentence, targets interleaved, open pairs
 * typed, probes a choice), and the guide's practice field.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { parseGuide } from "../src/core/mistakes.ts";
import { mixupKey, tallyMixups, mixupLexicon } from "../src/core/mixups.ts";
import { buildPersonalLesson, resolvePractice } from "../src/core/personal.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const entries = (JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: LexiconEntry[] })
	.words;

test("the targets the lexicon cannot back are dropped: an unknown word, an unknown or pairs unit, a pair that cannot be drilled", () => {
	const p = resolvePractice(
		{
			words: ["domov", "qqqzz", "Doma"],
			units: ["loc", "nope", "pairs-town"],
			pairs: [
				["nikto", "niekto"],
				["nikto", "qqqzz"],
				["nikto", "nikto"],
			],
		},
		["Endings after v"],
		entries,
	)!;
	assert.equal(p.words.length, 2, "domov and doma (case does not matter); the non-word is dropped");
	assert.deepEqual(p.units, ["loc"]);
	assert.deepEqual(p.pairs, [["nikto", "niekto"]]);
	assert.deepEqual(p.focus, ["Endings after v"]);
	assert.ok(p.shown.includes("nikto / niekto"));
	assert.equal(
		resolvePractice({ words: ["qqqzz"], units: [], pairs: [] }, [], entries),
		null,
		"nothing left is no practice",
	);
	assert.equal(resolvePractice(undefined, [], entries), null);
});

test("the personal lesson: every rep a verified sentence, targets take turns, open pairs typed and new pairs a choice", () => {
	const practice = resolvePractice(
		{
			words: ["doma"],
			units: ["loc"],
			pairs: [
				["nikto", "niekto"],
				["nič", "niečo"],
			],
		},
		["x"],
		entries,
	)!;
	const lex = mixupLexicon(entries);
	const { record } = tallyMixups(
		{},
		[
			{
				slug: "nikto",
				answer: "Nikto",
				given: "Niekto",
				verdict: "wrong",
				sentence: "",
				at: "2026-11-01T09:00:00.000Z",
			},
		],
		lex,
	);
	const plan = buildPersonalLesson(entries, practice, record, { seed: 5 });
	assert.equal(plan.focus, "personal");
	assert.equal(plan.items.length, 12);
	assert.equal(new Set(plan.items.map((i) => i.id)).size, 12, "no sentence twice");
	for (const item of plan.items) assert.equal(item.before + item.answer + item.after, item.sentence, item.id);
	const first4 = plan.items.slice(0, 4).map((i) => i.slug);
	assert.ok(first4.includes("doma"), "each target gets a turn in the first round");
	assert.ok(plan.items.slice(0, 4).some((i) => i.unit === "loc"));
	for (const i of plan.items.filter((x) => x.slug === "nikto" || x.slug === "niekto"))
		assert.equal(i.kind, "type", `${i.id}: an open mix-up is produced`);
	for (const i of plan.items.filter((x) => (x.slug === "nic" || x.slug === "nieco") && x.kind === "choose"))
		assert.equal(i.options?.length, 2);
	assert.ok(
		plan.items
			.filter((i) => i.pair)
			.every((i) => i.pair!.id === mixupKey("nikto", "niekto") || i.pair!.id === mixupKey("nic", "nieco")),
	);
	assert.equal(buildPersonalLesson(entries, null, undefined, { seed: 1 }).items.length, 0);
});

test("the guide's practice field: lists capped, pairs of two distinct words only", () => {
	const data = parseGuide(
		JSON.stringify({
			patterns: [{ title: "t", why: "w" }],
			practice: {
				words: ["a", "b", "c", "d", "e", "f", "g"],
				units: ["loc", 3, "gen"],
				pairs: [["nikto", "niekto"], ["x"], ["y", "y"], ["a", "b"], ["c", "d"], ["e", "f"]],
			},
		}),
	)!;
	assert.equal(data.practice?.words.length, 6);
	assert.deepEqual(data.practice?.units, ["loc", "gen"]);
	assert.deepEqual(data.practice?.pairs, [
		["nikto", "niekto"],
		["a", "b"],
		["c", "d"],
	]);
	assert.equal(
		parseGuide(JSON.stringify({ patterns: [{ title: "t", why: "w" }] }))?.practice,
		undefined,
		"no targets, no practice",
	);
});
