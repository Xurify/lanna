/**
 * SCRIPTED SCENES PINS (LangHarness, phase 5, E13): every scene has a
 * script of six to ten turns, every turn a tutor line and exactly three
 * options with exactly one correct, the correct lines built from lexicon
 * words, and the grader's results — right, wrong with an explanation, and
 * a wrong index never read as an answer.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { grade, scriptFor, tutorLineText, type SceneScript } from "../src/core/speak-script.ts";
import { SPEAK_SCENES } from "../src/core/speak.ts";

const lexicon = JSON.parse(fs.readFileSync("curriculum/slovak/lexicon.json", "utf-8")) as { words: Array<{ sk: string }> };
const lemmas = new Set(lexicon.words.map((e) => e.sk.toLowerCase()));

test("every scene has a script, and nothing else does", () => {
	for (const scene of SPEAK_SCENES) assert.ok(scriptFor(scene.id), `${scene.id} has no script`);
	assert.equal(scriptFor("nope"), undefined);
});

test("each script has six to ten turns: a tutor line (Slovak and English), three options, one correct", () => {
	for (const scene of SPEAK_SCENES) {
		const script = scriptFor(scene.id)!;
		assert.ok(script.turns.length >= 6 && script.turns.length <= 10, `${scene.id}: ${script.turns.length} turns`);
		script.turns.forEach((turn, i) => {
			assert.ok(tutorLineText(turn.tutor).length > 0, `${scene.id} turn ${i}: no Slovak tutor line`);
			assert.ok(turn.tutor.en.length > 0, `${scene.id} turn ${i}: no English meaning`);
			assert.equal(turn.options.length, 3, `${scene.id} turn ${i}: ${turn.options.length} options`);
			assert.equal(turn.options.filter((o) => o.correct).length, 1, `${scene.id} turn ${i}: not exactly one correct option`);
			const correct = turn.options.find((o) => o.correct)!;
			assert.ok(correct.lemmas && correct.lemmas.length > 0, `${scene.id} turn ${i}: the correct option names no lemmas`);
			for (const wrong of turn.options.filter((o) => !o.correct)) {
				assert.ok(wrong.why && wrong.why.length > 0, `${scene.id} turn ${i}: a wrong option explains nothing`);
			}
		});
	}
});

test("the correct options are built from lexicon words (the key words are lexicon lemmas)", () => {
	for (const scene of SPEAK_SCENES) {
		const script = scriptFor(scene.id)!;
		script.turns.forEach((turn, i) => {
			const correct = turn.options.find((o) => o.correct)!;
			for (const lemma of correct.lemmas ?? []) {
				assert.ok(lemmas.has(lemma.toLowerCase()), `${scene.id} turn ${i}: "${lemma}" is not a lexicon entry`);
			}
		});
	}
});

test("the grader: the right choice is right; a slip comes back with an explanation and the right line", () => {
	const script: SceneScript = scriptFor("cafe")!;
	const first = script.turns[0]!;
	const rightIndex = first.options.findIndex((o) => o.correct);
	const wrongIndex = first.options.findIndex((o) => !o.correct);
	const right = grade(script, 0, rightIndex)!;
	assert.equal(right.correct, true);
	assert.equal(right.right, first.options[rightIndex]!.sk);
	assert.equal(right.explanation, undefined);
	const wrong = grade(script, 0, wrongIndex)!;
	assert.equal(wrong.correct, false);
	assert.equal(wrong.right, first.options[rightIndex]!.sk);
	assert.ok(wrong.explanation && wrong.explanation.length > 0);
});

test("the grader: a turn or a choice that does not exist is never an answer", () => {
	const script: SceneScript = scriptFor("cafe")!;
	assert.equal(grade(script, 99, 0), undefined);
	assert.equal(grade(script, 0, 99), undefined);
	assert.equal(grade(script, -1, 0), undefined);
});

test("each script's last turn grades, so the walk can end", () => {
	for (const scene of SPEAK_SCENES) {
		const script = scriptFor(scene.id)!;
		const last = script.turns.length - 1;
		const rightIndex = script.turns[last]!.options.findIndex((o) => o.correct);
		assert.equal(grade(script, last, rightIndex)!.correct, true, scene.id);
	}
});

test("the core barrel exposes the scripted scenes", async () => {
	const core = await import("../src/core/index.ts");
	assert.equal(core.scriptFor, scriptFor);
	assert.equal(core.grade, grade);
});
