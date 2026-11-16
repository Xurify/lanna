/**
 * THE FREE COURSE (2026-11-05): built from the dictionary alone. A
 * preposition belongs to the case of the unambiguous forms after it; the
 * present tense leaves out imperatives Wiktionary also tags "present";
 * every unit and chapter passes the same check as a written course.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCourse } from "../src/core/course.ts";
import { proceduralCourse } from "../src/core/course-procedural.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const TAG = "cs-CZ";

function noun(
	slug: string,
	lemma: string,
	forms: Record<string, string[]>,
	sentences: Array<[string, string]>,
	rank: number,
): LexiconEntry {
	return {
		slug,
		lemma,
		en: slug,
		cat: "Nouns",
		gender: "masculine-inanimate",
		rank,
		forms: Object.keys(forms),
		formTags: forms,
		related: [],
		examples: sentences.map(([text, answer]) => ({
			text,
			en: text,
			src: "tatoeba",
			cloze: { answer, at: text.indexOf(answer) },
		})),
	};
}
const prep = (w: string): LexiconEntry => ({
	slug: w,
	lemma: w,
	en: w,
	cat: "Prepositions",
	rank: 1,
	related: [],
	examples: [],
});
const times = <T>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

// "domě" is only locative; "domu" is genitive or dative, so "do domu" says
// nothing; "domem" is only instrumental.
const DUM = noun(
	"dum",
	"dům",
	{
		dům: ["nominative singular"],
		domě: ["locative singular"],
		domu: ["genitive singular", "dative singular"],
		domem: ["instrumental singular"],
	},
	[
		...times(14, (i): [string, string] => [
			`Jsem v domě číslo ${"abcdefghijklmn"[i]}.`.replace(/ číslo .\./, i % 2 ? " dnes." : " teď."),
			"domě",
		]),
		...times(6, (i): [string, string] => [i % 2 ? "Jdu do domu." : "Běžím do domu.", "domu"]),
		...times(13, (): [string, string] => ["Stojím před domem.", "domem"]),
	],
	5,
);
const DELAT = {
	slug: "delat",
	lemma: "dělat",
	en: "to do",
	cat: "Verbs",
	rank: 3,
	forms: ["dělám", "dělej"],
	formTags: {
		dělám: ["first-person indicative present singular"],
		dělej: ["imperative present second-person singular"],
	},
	related: [],
	examples: [
		...times(13, (): { text: string; en: string; src: string; cloze: { answer: string; at: number } } => ({
			text: "Dnes dělám večeři.",
			en: "x",
			src: "tatoeba",
			cloze: { answer: "dělám", at: 5 },
		})),
		...times(13, () => ({ text: "Dělej to hned.", en: "x", src: "tatoeba", cloze: { answer: "Dělej", at: 0 } })),
	],
} as LexiconEntry;
const LEXICON = [DUM, DELAT, prep("v"), prep("do"), prep("před")];

test("a preposition gets the case of the unambiguous forms after it; an ambiguous one gets none", () => {
	const course = proceduralCourse(LEXICON, "czech", "Czech", TAG);
	const loc = course.units.find((u) => u.id === "locative-singular");
	assert.deepEqual(loc?.after, ["v"]);
	assert.match(loc!.rule, /^After v, a noun takes the locative: /);
	assert.ok(
		!course.units.some((u) => u.after?.includes("do")),
		'"do domu" decides nothing: domu is genitive or dative',
	);
	const ins = course.units.find((u) => u.id === "instrumental-singular");
	assert.deepEqual(ins?.after, ["před"]);
});

test("the present tense leaves out the imperatives Wiktionary also tags present, and the imperative gets its own lesson", () => {
	const course = proceduralCourse(LEXICON, "czech", "Czech", TAG);
	const present = course.units.find((u) => u.id === "v-present-first-person");
	assert.deepEqual(present?.tags, ["present", "first-person", "indicative"]);
	assert.ok(course.units.some((u) => u.id === "v-imperative"));
});

test("the free course passes the same check as a written one, with general tutors and Speak goals", () => {
	const course = proceduralCourse(LEXICON, "czech", "Czech", TAG);
	const checked = checkCourse(course, "czech", LEXICON, TAG, [
		"cafe",
		"way",
		"colleague",
		"family",
		"shop",
		"doctor",
		"station",
		"restaurant",
		"hotel",
	]);
	assert.ok(checked, "kept");
	assert.equal(checked!.course.chapters.at(-1)!.units.at(-1)!.startsWith("can-"), true);
	assert.ok(checked!.course.tutors.some((t) => /Czech sounds and spelling/.test(t.brief)));
	assert.equal(checked!.course.units.filter((u) => u.kind === "words").length, 0, "no word themes without a model");
});
