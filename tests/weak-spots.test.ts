/**
 * Weak spots (src/core/weak-spots.ts) and the miss verdict
 * (src/core/onboarding.ts missVerdict): the record, its mending rule,
 * the families, the tutor's line, and the judge-note normalizer.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanNote, missVerdict } from "../src/core/onboarding.ts";
import {
	clearWeak,
	flagWeak,
	lessonFlagsWeak,
	tallyWeak,
	weakSpotGroups,
	weakSpotList,
	weakSpotsLine,
	WEAK_MEND_REPS,
	type WeakRecord,
} from "../src/core/weak-spots.ts";

const t0 = new Date("2026-10-28T06:00:00Z");
const t1 = new Date("2026-10-29T06:00:00Z");

test("a spot is flagged with its evidence, tallied by later reps, and dropped once enough come back right", () => {
	let weak: WeakRecord = {};
	weak = flagWeak(
		weak,
		"acc-people",
		"check",
		"Animate masculine accusative is kuchára; kucháru is dative/locative, wrong case..",
		t0,
	);
	assert.equal(weak["acc-people"]!.source, "check");
	assert.equal(
		weak["acc-people"]!.note,
		"Animate masculine accusative is kuchára; kucháru is dative/locative, wrong case",
		"trailing full stops are trimmed",
	);
	assert.equal(weak["acc-people"]!.since, t0.toISOString());
	// Not a unit: ignored.
	assert.deepEqual(flagWeak(weak, "nope", "lesson", undefined, t0), weak);
	// A lesson note never overwrites the check's; a check note replaces an older one and restarts the tally.
	weak = flagWeak(weak, "acc-people", "lesson", "60% right", t1);
	assert.equal(
		weak["acc-people"]!.note,
		"Animate masculine accusative is kuchára; kucháru is dative/locative, wrong case",
	);
	assert.equal(weak["acc-people"]!.since, t0.toISOString(), "keeps its first date");
	// Six right of eight: not yet; then two more right: mended.
	let r = tallyWeak(weak, "acc-people", 6, 2, t1);
	assert.equal(r.mended, false);
	assert.equal(r.weak["acc-people"]!.hits, 6);
	r = tallyWeak(r.weak, "acc-people", 2, 0, t1);
	assert.equal(r.mended, false, "8/10 is under the bar");
	r = tallyWeak(r.weak, "acc-people", 4, 0, t1);
	assert.equal(r.mended, true, "12/14 clears it");
	assert.equal(r.weak["acc-people"], undefined);
	// A unit with no spot tallies nothing.
	assert.deepEqual(tallyWeak({}, "loc", 1, 0, t1), { weak: {}, mended: false });
	assert.deepEqual(clearWeak({}, "loc"), {});
	assert.ok(WEAK_MEND_REPS >= 6);
	assert.equal(lessonFlagsWeak(5, 2), false, "too few reps to judge");
	assert.equal(lessonFlagsWeak(6, 4), true);
	assert.equal(lessonFlagsWeak(10, 9), false);
});

test("the list orders check gaps first, folds a family into one row, and the tutor's line names the evidence", () => {
	let weak: WeakRecord = {};
	weak = flagWeak(weak, "loc", "lesson", "62% right over 2 lessons", t0);
	weak = flagWeak(weak, "acc-fem", "check", "After prijal the object is accusative, and feminine -a nouns take -u", t1);
	weak = flagWeak(weak, "acc-people", "check", "wrote kucháru for kuchára", t1);
	weak = tallyWeak(weak, "loc", 1, 2, t1).weak;
	const list = weakSpotList(weak);
	assert.deepEqual(
		list.map((w) => w.unit),
		["acc-fem", "acc-people", "loc"],
	);
	assert.equal(list[2]!.line, "from your lessons: 62% right over 2 lessons · since then 1/3 right");
	assert.equal(
		list[0]!.line,
		"from the level check: After prijal the object is accusative, and feminine -a nouns take -u",
	);
	const groups = weakSpotGroups(list);
	assert.equal(groups.length, 2, "the two accusative units are one struggle");
	assert.equal(groups[0]!.id, "accusative");
	assert.equal(groups[0]!.title, "The accusative by noun class");
	assert.deepEqual(
		groups[0]!.spots.map((s) => s.unit),
		["acc-fem", "acc-people"],
	);
	assert.equal(groups[0]!.unit, "acc-fem", "Strengthen opens the first member");
	assert.equal(groups[1]!.id, "loc");
	// One accusative unit alone stays its own row.
	assert.equal(weakSpotGroups(weakSpotList(flagWeak({}, "acc-fem", "check", undefined, t0)))[0]!.id, "acc-fem");
	const line = weakSpotsLine(list)!;
	assert.match(
		line,
		/^- Weak spots on record: The accusative by noun class \(feminine -a → -u, people \+a, things unchanged; Objects: -a → -u: from the level check: After prijal/,
	);
	assert.match(
		line,
		/Where\? v, na, o \(Kde\? The locative; from your lessons: 62% right over 2 lessons · since then 1\/3 right\)/,
	);
	assert.match(line, /cleared once 8 reps since the flag come back 85% right\.$/);
	assert.equal(weakSpotsLine([]), null);
	assert.deepEqual(weakSpotList(undefined), []);
});

test("the miss verdict: the judge's note becomes clean sentences and the unit's rule is the pattern", () => {
	assert.equal(
		cleanNote("Verb 'prijal' requires accusative 'ponuku'; nominative 'ponuka' is the wrong case.."),
		"Verb prijal requires accusative ponuku. Nominative ponuka is the wrong case.",
	);
	assert.equal(
		cleanNote("  animate masculine accusative is kuchára; kucháru is dative/locative, wrong case.  "),
		"Animate masculine accusative is kuchára. Kucháru is dative/locative, wrong case.",
	);
	assert.equal(cleanNote('"wrong case"'), "Wrong case.");
	assert.equal(cleanNote("Right form, wrong diacritic: víno not vino"), "Right form, wrong diacritic: víno not vino.");
	assert.equal(cleanNote("it's the dative"), "It's the dative.", "an apostrophe inside a word is not a quote");
	assert.equal(cleanNote(""), null);
	assert.equal(cleanNote("..."), null);
	assert.equal(cleanNote(undefined), null);
	const v = missVerdict(
		{ answer: "ponuku", unit: "acc-fem", trigger: "prijal" },
		"Verb 'prijal' requires accusative 'ponuku'; nominative 'ponuka' is the wrong case..",
	);
	assert.equal(v.form, "ponuku");
	assert.equal(v.reason, "Verb prijal requires accusative ponuku. Nominative ponuka is the wrong case.");
	assert.equal(v.pattern, "A feminine noun in -a takes -u as the direct object: Pijem kávu. Mám sestru.");
	const none = missVerdict({ answer: "kávu", unit: "words", trigger: undefined }, null);
	assert.equal(none.reason, null);
	assert.equal(none.pattern, null, "a word unit's rule is not a pattern");
});

test("the check's items leave out crime, violence and death", async () => {
	const { calmEntries, isGrim } = await import("../src/core/onboarding.ts");
	assert.equal(isGrim("Polícia chytila vraha."), true);
	assert.equal(isGrim("The police caught the murderer."), true);
	assert.equal(isGrim("Tom sold a gun to me."), true);
	assert.equal(isGrim("Chcem kávu."), false);
	assert.equal(isGrim("This knife serves for slicing bread."), true, "a knife is out, cheap as the rule is");
	assert.equal(isGrim("Pijem vodu."), false);
	assert.equal(isGrim("He died laughing at the joke."), true);
	assert.equal(isGrim("The deadline has not changed."), false, "deadline is not death");
	assert.equal(isGrim("Kde je bazén?"), false);
	const ex = (sk: string, en: string) => ({ sk, en });
	const calm = calmEntries([
		{
			sk: "chytiť",
			en: "to catch",
			examples: [
				ex("Polícia chytila vraha.", "The police caught the murderer."),
				ex("Chytil som loptu.", "I caught the ball."),
			],
		},
		{ sk: "vrah", en: "murderer", examples: [ex("Vrah utiekol.", "The murderer fled.")] },
		{ sk: "zomrieť", en: "to die", examples: [ex("Chcem zomrieť.", "I want to die.")] },
	]);
	assert.deepEqual(
		calm.map((e) => [e.sk, e.examples.length]),
		[["chytiť", 1]],
	);
	assert.equal(calm[0]!.examples[0]!.sk, "Chytil som loptu.");
});
