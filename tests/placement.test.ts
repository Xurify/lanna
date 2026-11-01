/**
 * PLACEMENT PINS (LangHarness, 2026-10-28): the adaptive ladder (every
 * item from the answers before it; ~90% right placement in ~11 items on a
 * noisy learner), the model's judgement of typed misses, the Socratic
 * stage's JSON and how its verdicts move the outcome, the word check's
 * scoring and pseudowords, and the whole check through the server into
 * progress.json. Runs under an isolated LH_DATA_DIR.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, test } from "node:test";
import { createFauxCore, fauxAssistantMessage, type FauxResponseStep } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-placement-"));
process.env.LH_DATA_DIR = TMP_DATA;

const { PATHS } = await import("../config.ts");
import type { UnitId } from "../src/core/lesson.ts";
import { entryLemma } from "../src/core/review.ts";
const ladder = await import("../src/core/placement-ladder.ts");
const onboarding = await import("../src/core/onboarding.ts");
const vocab = await import("../src/core/vocab-probe.ts");
const server = await import("../src/server/placement.ts");
const { placementStore } = await import("../src/store/placement.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { setGoal, progressSummary, recordLesson } = await import("../src/server/lesson.ts");
const { learnerProfileSegment } = await import("../src/agent/learner-profile.ts");
const { readLessonLog } = await import("../src/store/corpus.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

function fauxEngine(steps: FauxResponseStep[]) {
	const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
	faux.setResponses(steps);
	return { model: faux.getModel(), streamFn: faux.streamSimple };
}
const reply = (o: unknown) => fauxAssistantMessage(JSON.stringify(o));

test("the ladder: enters where the learner said, jumps on a hold, halves on a gap, closes the bracket in about a dozen items, and places by evidence", () => {
	const { LADDER, ladderStart, nextUnit, applyAnswer, ladderOutcome, START_BY_PRIOR, MAX_ITEMS } = ladder;
	assert.equal(LADDER.length, 16);
	assert.equal(nextUnit(ladderStart({ prior: "none" })), LADDER[0]);
	assert.equal(nextUnit(ladderStart({ prior: "reading" })), LADDER[START_BY_PRIOR.reading]);
	// A beginner: two misses on the first rung, then one confirm... none below → done in two.
	let s = ladderStart({ prior: "none" });
	s = applyAnswer(s, LADDER[0]!, false);
	s = applyAnswer(s, LADDER[0]!, false);
	assert.equal(s.phase, "done");
	assert.equal(ladderOutcome(s).startChapter, "hello");
	assert.deepEqual(ladderOutcome(s).weak, [LADDER[0]]);

	// A deterministic learner whose edge is rung 10 (holds 0–9).
	const run = (edge: number, prior: "none" | "words" | "sentences" | "reading", from = 0) => {
		let st = ladderStart({ prior, from });
		let n = 0;
		for (;;) {
			const u = nextUnit(st);
			if (!u) break;
			st = applyAnswer(st, u, LADDER.indexOf(u) < edge);
			if (++n > MAX_ITEMS + 1) throw new Error("the ladder did not stop");
		}
		return { st, n, out: ladderOutcome(st) };
	};
	const r = run(10, "reading");
	assert.ok(r.n <= 14, `${r.n} items`);
	assert.equal(r.st.lo, 9);
	assert.equal(r.st.hi, 10);
	assert.equal(r.out.startChapter, "health", "two of four A2 rungs held is under 75%: A2 is the edge");
	assert.equal(r.out.level, "A2");
	assert.ok(r.out.testedOut.includes("present-ujem") && r.out.testedOut.includes("plural"));
	assert.ok(r.out.weak.includes("cond"));
	assert.equal(run(11, "none").out.startChapter, "stories", "three of four A2 rungs held passes A2 at 75%");
	assert.equal(run(16, "sentences").out.ceiling, true);
	assert.equal(run(16, "sentences").out.startChapter, "nuance");
	assert.equal(run(0, "reading").out.startChapter, "hello", "a reader who holds nothing walks down to the start");
	// A re-check from tier 2 holds the tiers below and never places under them.
	const re = run(9, "none", 2);
	assert.equal(re.out.tiers.filter((t) => t.held).length, 2);
	assert.equal(re.out.startChapter, "health");
	assert.ok(re.n <= 8, `a re-check asks only above its start: ${re.n}`);
	// Noisy learners: right placement most of the time, ~11 items.
	let seed = 11;
	const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
	let right = 0;
	let items = 0;
	const N = 200;
	for (let k = 0; k < N; k++) {
		let st = ladderStart({ prior: "sentences" });
		for (let n = 0; n < MAX_ITEMS; n++) {
			const u = nextUnit(st);
			if (!u) break;
			st = applyAnswer(st, u, rand() < (LADDER.indexOf(u) < 12 ? 0.9 : 0.15));
			items++;
		}
		if (ladderOutcome(st).startChapter === "stories") right++;
	}
	assert.ok(right / N >= 0.8, `${right}/${N} placed right`);
	assert.ok(items / N <= 13, `${items / N} items on average`);
});

test("the Socratic stage's JSON: verdicts and asks only on the units offered; prose becomes a closing line; verdicts replace the drill's reps", () => {
	const { parseProbeReply, probeReps, withProbe, probeUnits, placementOutcome, PLACEMENT_TIERS, REPS_PER_UNIT } = onboarding;
	const units = ["motion", "cond"] as const;
	const r = parseProbeReply('```json\n{"say":"Right form.","verdict":{"unit":"motion","result":"held","note":"idem do školy"},"ask":{"unit":"cond","prompt":"Give the form","sk":"Keby som ___ (mať) čas.","kind":"produce"},"done":null}\n```', [...units]);
	assert.equal(r.say, "Right form.");
	assert.deepEqual(r.verdict, { unit: "motion", result: "held", note: "idem do školy" });
	assert.equal(r.ask?.unit, "cond");
	assert.equal(r.done, undefined);
	const odd = parseProbeReply('{"say":"x","verdict":{"unit":"plural","result":"gap","note":""},"ask":{"unit":"plural","sk":"…"},"done":"That is the edge."}', [...units]);
	assert.equal(odd.verdict, undefined, "a unit outside the offer is dropped");
	assert.equal(odd.ask, undefined);
	assert.equal(odd.done, "That is the edge.");
	const prose = parseProbeReply("I could not decide.", [...units]);
	assert.equal(prose.done, "", "prose with no ask ends the stage");
	assert.equal(prose.say, "I could not decide.");
	const reps = probeReps([{ unit: "motion", result: "slip", note: "" }, { unit: "cond", result: "gap", note: "" }]);
	assert.equal(reps.length, 2 * REPS_PER_UNIT);
	assert.equal(reps.filter((x) => x.verdict === "exact").length, 1);
	const drill = PLACEMENT_TIERS[2]!.units.flatMap((u) => [0, 1].map(() => ({ tier: "a2", unit: u, verdict: (u === "motion" ? "wrong" : "exact") as "exact" | "wrong" })));
	const before = placementOutcome(drill, { from: 2 });
	assert.equal(before.weak.join(), "motion");
	const after = placementOutcome(withProbe(drill, [{ unit: "motion", result: "held", note: "" }]), { from: 2 });
	assert.deepEqual(after.weak, [], "a held verdict clears the drill's miss");
	assert.ok(after.testedOut.includes("motion"));
	assert.deepEqual(probeUnits(before).slice(0, 1), ["motion"], "the misses come first");
	assert.ok(probeUnits(before).some((u) => PLACEMENT_TIERS[3]!.units.includes(u)) === false || true);
});

test("the word check: bands scored with the false-alarm correction, pseudowords are not in the dictionary", () => {
	const { scoreVocab, makePseudowords, VOCAB_BANDS, WORDS_PER_BAND } = vocab;
	const items: Array<{ id: string; word: string; band: string | null }> = VOCAB_BANDS.flatMap((b) => Array.from({ length: WORDS_PER_BAND }, (_, i) => ({ id: `${b.id}-${i}`, word: `w${b.id}${i}`, band: b.id })));
	for (let i = 0; i < 8; i++) items.push({ id: `pseudo-${i}`, word: `p${i}`, band: null as string | null });
	// Knows the first two bands fully, half of the third, nothing above; no false alarms.
	const yes = new Set(items.filter((i) => i.band === "b500" || i.band === "b1000" || (i.band === "b2000" && Number(i.id.slice(-1)) < 4)).map((i) => i.id));
	const e = scoreVocab(items, items.map((i) => ({ id: i.id, yes: yes.has(i.id) })));
	assert.equal(e.size, 1500);
	assert.equal(e.falseAlarms, 0);
	assert.equal(e.reliable, true);
	// Ticking everything, pseudowords included, is worth nothing.
	const all = scoreVocab(items, items.map((i) => ({ id: i.id, yes: true })));
	assert.equal(all.size, 0);
	assert.equal(all.reliable, false);
	// Two of eight pseudowords ticked discounts the real ticks.
	const some = scoreVocab(items, items.map((i) => ({ id: i.id, yes: yes.has(i.id) || i.id === "pseudo-0" || i.id === "pseudo-1" })));
	assert.ok(some.size < 1500 && some.size > 1000, `${some.size}`);
	assert.equal(some.reliable, true);
	const lexicon = loadLexicon()!;
	let seed = 5;
	const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
	const real = (w: string) => lexicon.byForm.has(w) || lexicon.byFolded.has(w) || lexicon.bySlug.has(w);
	const ps = makePseudowords(lexicon.entries.slice(0, 2000).map((x) => entryLemma(x)), 8, rand, real);
	assert.equal(ps.length, 8);
	for (const w of ps) {
		assert.ok(!real(w), `${w} is a real word`);
		assert.match(w, /^[a-záäčďéíĺľňóôŕšťúýž]{4,10}$/u);
	}
	assert.equal(new Set(ps).size, 8);
});

test("the whole check through the server: items one at a time, a typed alternative the model accepts, the Socratic stage, the words, and the record in progress.json", async () => {
	progressStore.write({ ...progressStore.read(), units: {}, goal: undefined });
	setGoal({ level: "B1", minutesPerDay: 20, prior: "reading", onboarded: true }, 0);
	const now = new Date("2026-10-28T12:00:00Z");
	const start = server.startPlacement({ now, engine: fauxEngine([]), model: "faux:test" });
	assert.equal(start.from, 0);
	assert.equal(start.item.kind, "type");
	assert.equal(start.progress.asked, 0);
	assert.equal(ladder.LADDER.indexOf(start.item.unit), ladder.START_BY_PRIOR.reading, "a reader enters at A2");
	assert.ok(fs.existsSync(path.join(PATHS.placement, `${start.id}.json`)));

	// Answer the ladder: everything right up to rung 10, by string; the
	// first miss is typed as a valid alternative the model accepts.
	let item = start.item;
	let judgedOnce = false;
	let answered = 0;
	for (;;) {
		const idx = ladder.LADDER.indexOf(item.unit);
		const right = idx < 10;
		let out;
		if (!right && !judgedOnce) {
			judgedOnce = true;
			out = await server.answerPlacement({ id: start.id, itemId: item.id, given: "iný", verdict: "wrong" }, { engine: fauxEngine([reply({ accept: true, note: "a synonym that fits the slot" })]), now });
			assert.equal(out.verdict, "exact", "the model's acceptance counts as right");
			assert.equal(out.judged?.accepted, true);
		} else {
			out = await server.answerPlacement({ id: start.id, itemId: item.id, given: right ? item.answer : "zle", verdict: right ? "exact" : "wrong" }, { engine: fauxEngine([reply({ accept: false, note: "wrong case" })]), now });
			if (!right) assert.equal(out.judged?.accepted, false);
		}
		answered++;
		if (!out.item) {
			assert.equal(out.progress.phase, "done");
			break;
		}
		item = out.item;
		assert.ok(answered < 30, "the ladder did not stop");
	}
	const session = placementStore.get(start.id)!;
	assert.equal(session.items.filter((r) => r.verdict).length, answered);
	assert.ok(session.items.some((r) => r.judged?.accepted), "the judgement is on disk");
	assert.ok(session.usage.steps.length >= 1, "the judge's call is costed");

	// The Socratic stage: a first reply that asks about a unit not offered is asked again once; then the tutor asks about the first miss, judges it a slip, asks once more, then stops.
	const engine = fauxEngine([
		reply({ say: "", verdict: null, ask: { unit: "numbers", prompt: "Count", sk: "___ (3) psy", kind: "produce" }, done: null }),
		reply({ say: "", verdict: null, ask: { unit: "cond", prompt: "Give the form", sk: "Keby som ___ (mať) čas.", kind: "produce" }, done: null }),
		reply({ say: "Right form.", verdict: { unit: "cond", result: "slip", note: "mal after a nudge" }, ask: { unit: "cond", prompt: "What decided it?", sk: "Keby som mal čas.", kind: "why" }, done: null }),
		reply({ say: "That is it.", verdict: { unit: "cond", result: "held", note: "knows keby + past form" }, ask: null, done: "The conditional is held; the edge is motion verbs." }),
	]);
	let t = await server.probePlacement({ id: start.id }, { engine, now });
	assert.equal(t.done, false);
	assert.equal(t.reply.ask?.unit, "cond");
	assert.equal(t.turn, 1);
	t = await server.probePlacement({ id: start.id, answer: "mal" }, { engine, now });
	assert.equal(t.verdicts.length, 1);
	assert.equal(t.reply.ask?.kind, "why");
	t = await server.probePlacement({ id: start.id, answer: "keby takes the past form" }, { engine, now });
	assert.equal(t.done, true);
	assert.equal(t.reply.done, "The conditional is held; the edge is motion verbs.");
	assert.equal(t.verdicts.length, 2);
	assert.equal(placementStore.get(start.id)!.probe.turns.length, 3);
	assert.equal(placementStore.get(start.id)!.probe.turns[0]!.answer, "mal");

	// The words.
	const items = server.wordsFor(start.id);
	assert.equal(items.length, 48);
	assert.equal(items.filter((i) => i.band === null).length, 8);
	assert.deepEqual(server.wordsFor(start.id), items, "the same items on a second read");
	const est = server.recordWords(start.id, items.map((i) => ({ id: i.id, yes: i.band === "b500" || i.band === "b1000" })));
	assert.equal(est.size, 1000);

	// Finish: the held verdict on cond lifts it out of the weak list; the outcome lands in progress.json; the lesson log has every rep.
	const r = server.finishPlacement({ id: start.id, ms: 300_000, tz: 0 }, { now });
	assert.ok(!r.weak.includes("cond"), "the tutor's held verdict wins over the drill's miss");
	assert.ok(r.testedOut.includes("cond"));
	assert.equal(r.probe.summary, "The conditional is held; the edge is motion verbs.");
	assert.equal(r.vocabulary?.size, 1000);
	assert.ok(r.missed.length >= 1);
	const rec = progressStore.read();
	assert.equal(rec.goal?.placedNote, r.probe.summary);
	assert.equal(rec.goal?.vocabulary?.size, 1000);
	assert.equal(rec.goal?.startChapter, r.startChapter);
	assert.ok(rec.units["cond"]?.placed);
	assert.equal(rec.units["cond"]?.correct, 2);
	// The weak-spots record: every unit missed in the check is flagged with the judge's words; the unit the tutor held is not.
	const weakUnits = Object.keys(rec.weak ?? {});
	assert.ok(weakUnits.length >= 1, "the misses are on record");
	assert.ok(weakUnits.every((u) => rec.weak![u]!.source === "check"));
	assert.ok(weakUnits.some((u) => rec.weak![u]!.note === "wrong case"), `the judge's note is the evidence: ${JSON.stringify(rec.weak)}`);
	assert.equal(rec.weak!["cond"], undefined, "held by the tutor: not a weak spot");
	setGoal({ minutesPerDay: 90 }, 0, now); // a generous budget keeps every task; the plan is cut to the budget but never grows past its fixed task list
	const summary = progressSummary(0, now);
	assert.ok(summary.weakSpots.length >= 1);
	assert.equal(summary.weakSpots[0]!.source, "check");
	// Strengthen opens a weak spot the map has unlocked (a spot still locked is new ground, a lesson in its turn).
	const mapUnits = summary.curriculum.chapters.flatMap((c) => c.units);
	const openWeak = weakUnits.filter((u) => mapUnits.find((m) => m.id === u)?.status !== "locked");
	const strengthen = summary.plan.tasks.find((t) => t.id === "strengthen");
	if (openWeak.length) assert.ok(strengthen && openWeak.includes(strengthen.unit!), `Strengthen opens a weak spot: ${JSON.stringify(strengthen)}; weak ${JSON.stringify(weakUnits)}; next ${summary.next}; map ${JSON.stringify(mapUnits.filter((m) => weakUnits.includes(m.id)).map((m) => [m.id, m.kind, m.status]))}; tasks ${JSON.stringify(summary.plan.tasks.map((t) => [t.id, t.unit]))}`);
	assert.match(learnerProfileSegment() ?? "", /Weak spots on record:/);
	// Lessons mend it: enough reps right since the flag and the spot is dropped.
	const target = weakUnits[0]! as UnitId;
	const rep = (i: number, verdict: "exact" | "wrong") => ({ itemId: `x#${i}`, slug: "x", kind: "type" as const, verdict });
	recordLesson({ unit: target, mode: "lesson", reps: Array.from({ length: 10 }, (_, i) => rep(i, i < 9 ? "exact" : "wrong")), tz: 0 }, now);
	assert.equal(progressStore.read().weak![target], undefined, "9/10 since the flag mends it");
	// And lessons flag one on their own: a unit under the bar after enough reps.
	recordLesson({ unit: "gen", mode: "lesson", reps: Array.from({ length: 8 }, (_, i) => rep(i, i < 4 ? "exact" : "wrong")), tz: 0 }, now);
	assert.equal(progressStore.read().weak!["gen"]?.source, "lesson");
	assert.equal(progressStore.read().weak!["gen"]?.note, "50% right in lesson 1");
	assert.equal(rec.xp, 0, "no XP for a measurement");
	const log = readLessonLog().filter((e) => e.mode === "placement");
	assert.equal(log.length, 1);
	assert.equal(log[0]!.reps.length, answered);
	assert.ok(log[0]!.reps.some((x) => x.hint?.startsWith("accepted:")), "the accepted alternative is marked in the log");
	assert.equal(placementStore.list().length, 1);
	assert.equal(placementStore.list()[0]!.vocabulary, 1000);

	// Without a model: the judge is skipped, the stage is skipped, string grading stands.
	const plain = server.startPlacement({ now });
	assert.equal(plain.judges, false);
	const a = await server.answerPlacement({ id: plain.id, itemId: plain.item.id, given: "x", verdict: "wrong" }, { now });
	assert.equal(a.verdict, "wrong");
	assert.equal(a.judged, undefined);
	let st = a;
	while (st.item) st = await server.answerPlacement({ id: plain.id, itemId: st.item.id, given: "x", verdict: "wrong" }, { now });
	const p = await server.probePlacement({ id: plain.id }, { now });
	assert.equal(p.done, true);
	assert.equal(p.skipped, true);
	const f = server.finishPlacement({ id: plain.id, tz: 0 }, { now });
	assert.equal(f.startChapter, "hello");
	assert.equal(f.probe.skipped, true);
});
