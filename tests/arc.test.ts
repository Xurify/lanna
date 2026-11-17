/**
 * CHAPTER ARC PINS (2026-10-30): the seven steps in one order,
 * the mapping on one chapter by hand, a words and a forms step for every
 * chapter bar the named exceptions, the scene steps, and no tutor unit or
 * unit in two steps.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ARC_STEPS, chapterArc } from "../src/core/arc.ts";
import { allChapters, curriculumUnits, curriculumUnit } from "../src/core/curriculum.ts";
import { SPEAK_SCENES } from "../src/core/speak.ts";

/** Chapters the mapping leaves without a words or forms step, on purpose.
 *  The rest of their work is tutor units, which sit outside the seven steps.
 *  The curriculum is unchanged in phase 1: a chapter leaves a list once a unit fills its step. */
const NO_WORDS: Record<string, string> = {
	media: "its three units are all tutor sessions, so it has no word unit",
};
const NO_FORMS: Record<string, string> = {
	work: "its grammar is three tutor sessions (negation, time and dates, word order)",
	offices: "its grammar is two tutor sessions (plural cases, phone and email)",
	world: "its grammar is one tutor session (participles)",
	nuance: "its grammar is three tutor sessions (passive, past conditional, numerals)",
	register: "its grammar is three tutor sessions (idioms, register, connectors)",
	media: "its three units are all tutor sessions (reading, listening, writing)",
};

const stepUnits = (chapter: string, id: string): string[] => chapterArc(chapter)!.find((a) => a.step.id === id)!.units;

test("the arc is seven steps, in the same order for every chapter", () => {
	assert.deepEqual(
		ARC_STEPS.map((s) => s.id),
		["story", "words", "forms", "pairs", "scene", "sound", "exam"],
	);
	for (const s of ARC_STEPS) assert.ok(s.slovak && s.english, `${s.id} needs a name in both languages`);
	for (const ch of allChapters())
		assert.deepEqual(
			chapterArc(ch.id)!.map((a) => a.step.id),
			ARC_STEPS.map((s) => s.id),
			ch.id,
		);
	assert.equal(chapterArc("no-such-chapter"), undefined);
});

test("every chapter has a words step and a forms step, bar the exceptions above", () => {
	for (const id of [...Object.keys(NO_WORDS), ...Object.keys(NO_FORMS)])
		assert.ok(
			allChapters().some((c) => c.id === id),
			`${id} is not a chapter`,
		);
	for (const ch of allChapters()) {
		const words = stepUnits(ch.id, "words");
		const forms = stepUnits(ch.id, "forms");
		if (ch.id in NO_WORDS) assert.deepEqual(words, [], `${ch.id} has a words step: drop it from NO_WORDS`);
		else assert.ok(words.length > 0, `${ch.id} has no words step`);
		if (ch.id in NO_FORMS) assert.deepEqual(forms, [], `${ch.id} has a forms step: drop it from NO_FORMS`);
		else assert.equal(forms.length, 1, `${ch.id} needs one forms unit, got ${forms.length}`);
	}
});

test("the mapping, pinned on one chapter: words are its word units, forms its first grammar drill, scene its goal", () => {
	assert.deepEqual(
		chapterArc("hello")!.map((a) => [a.step.id, a.units]),
		[
			["story", []],
			["words", ["words", "lx-greetings", "lx-questions"]],
			["forms", ["present"]],
			["pairs", []],
			["scene", ["can-introduce"]],
			["sound", []],
			["exam", []],
		],
	);
});

test("tutor units sit outside the seven steps, and no unit provides two", () => {
	const seen = new Set<string>();
	for (const ch of allChapters()) {
		for (const { step, units } of chapterArc(ch.id)!) {
			for (const id of units) {
				assert.notEqual(curriculumUnit(id)!.kind, "tutor", `${id} is a tutor unit in ${step.id}`);
				assert.ok(!seen.has(id), `${id} is in two steps`);
				seen.add(id);
			}
		}
	}
});

test("every scene a goal uses is a Speak scene, and a chapter's scene step is its goal", () => {
	for (const u of curriculumUnits()) {
		if (u.kind === "goal" && u.scene)
			assert.ok(
				SPEAK_SCENES.some((s) => s.id === u.scene),
				`${u.id} uses ${u.scene}`,
			);
	}
	for (const ch of allChapters()) {
		const goal = curriculumUnit(ch.units.at(-1)!)!;
		assert.deepEqual(stepUnits(ch.id, "scene"), goal.scene ? [goal.id] : [], ch.id);
	}
});

test("the core barrel exposes the arc", async () => {
	const core = await import("../src/core/index.ts");
	assert.equal(core.chapterArc, chapterArc);
	assert.equal(core.ARC_STEPS, ARC_STEPS);
});
