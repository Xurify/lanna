/**
 * MY MISTAKES (LangHarness, 2026-11-01): the analysis reads first tries from
 * the lesson log (never a retry, a meaning check, a peek or a Mix-ups
 * lesson), compares the last 14 days with the days before, names the words
 * missed most, and gives the guide's facts a digest that changes with them.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { analyseMistakes, digest, guideFacts, parseGuide, SAMPLES_KEPT, trendOf, TREND_MIN_REPS, type LoggedLesson } from "../src/core/mistakes.ts";

const NOW = new Date("2026-11-01T12:00:00Z");
const day = (back: number) => new Date(NOW.getTime() - back * 86_400_000).toISOString();

type Rep = LoggedLesson["reps"][number];
const rep = (right: boolean, over: Partial<Rep> = {}): Rep => ({
	kind: "type",
	unit: "loc",
	slug: "dom",
	lemma: "dom",
	answer: "dome",
	first: { given: right ? "dome" : "dom", verdict: right ? "exact" : "wrong" },
	...(right ? {} : { slip: "base" as const }),
	...over,
});
const lesson = (back: number, reps: Rep[], mode = "lesson"): LoggedLesson => ({ at: day(back), mode, reps });
const many = (n: number, right: number, over: Partial<Rep> = {}) => Array.from({ length: n }, (_, i) => rep(i < right, over));

test("only first tries count: not a retry, a meaning check, a word bank, a peek, or a rep with no first answer", () => {
	const a = analyseMistakes(
		[
			lesson(1, [
				rep(true),
				rep(false, { again: true }),
				rep(false, { kind: "meaning" }),
				rep(false, { kind: "build" }),
				rep(false, { first: { given: "x", verdict: "wrong", peeked: true } }),
				rep(false, { first: undefined }),
			]),
		],
		undefined,
		NOW,
	);
	assert.equal(a.reps, 1);
	assert.equal(a.wrong, 0);
});

test("a Mix-ups lesson, placement and Speak stay out of the unit figures", () => {
	const a = analyseMistakes([lesson(1, many(6, 0), "mixups"), lesson(1, many(6, 0), "placement"), lesson(1, many(6, 0), "speak")], undefined, NOW);
	assert.equal(a.reps, 0);
	assert.deepEqual(a.units, []);
});

test("a unit needs three first tries to be listed, and lists the most misses first with its slips", () => {
	const a = analyseMistakes([lesson(1, [...many(4, 1), ...many(3, 3, { unit: "gen", slug: "ruka" })])], undefined, NOW);
	assert.deepEqual(
		a.units.map((u) => u.unit),
		["loc", "gen"],
	);
	assert.equal(a.units[0]!.wrong, 3);
	assert.equal(a.units[0]!.accuracy, 0.25);
	assert.deepEqual(a.units[0]!.slips, { base: 3 });
	assert.deepEqual(a.slips, { base: 3 });
	assert.equal(analyseMistakes([lesson(1, many(2, 0))], undefined, NOW).units.length, 0, "two first tries is too few");
});

test("trend: better, worse, steady, or too few answers to say", () => {
	const mk = (reps: number, right: number) => ({ reps, right });
	assert.equal(trendOf(mk(10, 9), mk(10, 5)), "better");
	assert.equal(trendOf(mk(10, 4), mk(10, 8)), "worse");
	assert.equal(trendOf(mk(10, 8), mk(10, 8)), "steady");
	assert.equal(trendOf(mk(TREND_MIN_REPS - 1, 4), mk(10, 5)), "new");
	const a = analyseMistakes([lesson(30, many(8, 4)), lesson(2, many(8, 8))], undefined, NOW);
	const u = a.units[0]!;
	assert.equal(u.trend, "better");
	assert.equal(u.earlier, 0.5);
	assert.equal(u.recent, 1);
});

test("the words missed most: counted per word, with the form wanted and what was last written", () => {
	const ruka = { slug: "ruka", lemma: "ruka", answer: "ruku" };
	const a = analyseMistakes(
		[
			lesson(5, [rep(false, { ...ruka, first: { given: "ruka", verdict: "wrong" } })]),
			lesson(2, [rep(false, { ...ruka, first: { given: "rukou", verdict: "wrong" } }), rep(true), rep(false)]),
		],
		undefined,
		NOW,
	);
	assert.equal(a.words[0]!.slug, "ruka");
	assert.equal(a.words[0]!.misses, 2);
	assert.equal(a.words[0]!.lastGiven, "rukou", "the latest miss wins");
	assert.equal(a.words.length, 2);
});

test("weeks are Mondays, oldest first", () => {
	const a = analyseMistakes([lesson(0, many(4, 4)), lesson(8, many(4, 2))], undefined, NOW);
	assert.equal(a.weeks.length, 2);
	assert.ok(a.weeks[0]!.week < a.weeks[1]!.week);
	for (const w of a.weeks) assert.equal(new Date(`${w.week}T00:00:00Z`).getUTCDay(), 1);
	assert.equal(a.weeks[0]!.accuracy, 0.5);
});

test("the guide's digest follows its facts, not the time the snapshot was taken", () => {
	const a = analyseMistakes([lesson(1, many(6, 3))], undefined, NOW);
	const b = analyseMistakes([lesson(1, many(6, 3))], undefined, new Date(NOW.getTime() + 3_600_000));
	assert.equal(digest(guideFacts(a)), digest(guideFacts(b)));
	const c = analyseMistakes([lesson(1, many(6, 2))], undefined, NOW);
	assert.notEqual(digest(guideFacts(a)), digest(guideFacts(c)));
	assert.match(guideFacts(a), /Unit .*: 50% of 6 first tries/);
});

test("the wrong first tries are kept for the guide: newest first, capped, with the sentence and what was written", () => {
	const wrong = (n: number) => rep(false, { sentence: `Veta ${n}.`, answer: `a${n}`, first: { given: `g${n}`, verdict: "wrong" } });
	const a = analyseMistakes([lesson(3, Array.from({ length: 20 }, (_, i) => wrong(i))), lesson(1, [wrong(99), rep(false, { sentence: undefined })])], undefined, NOW);
	assert.equal(a.samples?.length, SAMPLES_KEPT);
	assert.equal(a.samples?.[0]?.sentence, "Veta 99.", "newest first");
	assert.deepEqual(a.samples?.[0] && { answer: a.samples[0].answer, given: a.samples[0].given, slip: a.samples[0].slip }, { answer: "a99", given: "g99", slip: "base" });
	assert.match(guideFacts(a), /Wrong: "Veta 99\." wanted "a99", wrote "g99" \(.*, base\)\./);
});

test("the guide's reply is read as patterns, guesses and a plan; anything else is not trusted", () => {
	const reply = JSON.stringify({
		patterns: [{ title: "Endings after v", evidence: '"Bývam v dom"', why: "The locative ending is dropped.", fix: "Say the -e out loud." }, { title: "", why: "x" }],
		next: [{ what: "nič / niečo", why: "Same pattern as nikto / niekto." }],
		plan: [{ step: "Practise pairs", kind: "mixups" }, { step: "Lesson", kind: "unit", unit: "loc" }, { step: "Bad unit", kind: "unit", unit: "nope" }, { step: "Cards", kind: "review" }, { step: "", kind: "review" }],
	});
	const data = parseGuide(`Here you go:\n\`\`\`json\n${reply}\n\`\`\``)!;
	assert.equal(data.patterns.length, 1, "a pattern with no title is dropped");
	assert.equal(data.plan.length, 4);
	assert.deepEqual(data.plan.map((p) => p.kind), ["mixups", "unit", "other", "review"], "an unknown unit is not a link");
	assert.equal(data.plan[1]!.unit, "loc");
	assert.equal(data.next[0]!.what, "nič / niečo");
	assert.equal(parseGuide("no json here"), null);
	assert.equal(parseGuide('{"patterns":[]}'), null, "nothing to say is not a guide");
	assert.equal(parseGuide("{broken"), null);
	const long = parseGuide(JSON.stringify({ patterns: [{ title: "t".repeat(500), why: "w".repeat(900) }] }))!;
	assert.equal(long.patterns[0]!.title.length, 90);
	assert.equal(long.patterns[0]!.why.length, 300);
});
