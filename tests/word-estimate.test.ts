import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";
import { createFauxCore, fauxAssistantMessage } from "@earendil-works/pi-ai";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-word-estimate-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const core = await import("../src/core/word-estimate.ts");
const { rng } = await import("../src/core/lesson.ts");
const server = await import("../src/server/word-estimate.ts");
const judge = await import("../src/server/word-check-judge.ts");
const { wordCheckStore, latestMeasuredVocabulary } = await import("../src/store/word-check.ts");
const { knownWordStore } = await import("../src/store/known-words.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { reviewStore } = await import("../src/store/review.ts");
const { loadLexicon } = await import("../src/agent/lexicon.ts");
const { frequencyOrder } = await import("../src/server/reading.ts");
type CheckAnswer = import("../src/core/word-estimate.ts").CheckAnswer;
type RankedWord = import("../src/core/word-estimate.ts").RankedWord;
type WordEvidence = import("../src/core/word-estimate.ts").WordEvidence;
type LexiconEntry = import("../src/core/review.ts").LexiconEntry;
type WordCheckItem = import("../src/core/word-estimate.ts").WordCheckItem;
type WordCheckFeedback = import("../src/core/word-estimate.ts").WordCheckFeedback;

after(() => fs.rmSync(TMP_DATA, { recursive: true, force: true }));

const DICTIONARY = 7000;
const words: RankedWord[] = Array.from({ length: DICTIONARY }, (_, i) => ({ slug: `w${i + 1}`, rank: i + 1 }));
const noEvidence = new Map<string, WordEvidence>();

function learnerWhoKnows(midpoint: number, slope: number) {
	const chance = (rank: number) => 1 / (1 + Math.exp(-slope * (Math.log(midpoint) - Math.log(rank))));
	return { chance, size: words.reduce((n, w) => n + chance(w.rank), 0) };
}

function simulateChecks(learner: ReturnType<typeof learnerWhoKnows>, count: number, priorSize: number, seed: number): CheckAnswer[] {
	const rand = rng(seed);
	const answers: CheckAnswer[] = [];
	const asked = new Set<string>();
	for (let turn = 0; turn < count; turn++) {
		const curve = core.fitKnowledgeCurve(answers, priorSize, DICTIONARY);
		const word = core.nextCheckWord(
			words.filter((w) => !asked.has(w.slug)),
			curve,
			turn,
			rand,
		)!;
		asked.add(word.slug);
		answers.push({ slug: word.slug, rank: word.rank, known: rand() < learner.chance(word.rank), ageDays: 0 });
	}
	return answers;
}

describe("the estimate of words known", () => {
	test("with no answers it is the level's figure, and says how wide the guess is", () => {
		const estimate = core.estimateWords(words, noEvidence, core.fitKnowledgeCurve([], 1200, DICTIONARY));
		assert.ok(Math.abs(estimate.total - 1200) <= 20, `total ${estimate.total}`);
		assert.equal(estimate.answers, 0);
		assert.equal(estimate.parts.inferred, estimate.parts.inferred + estimate.parts.review + estimate.parts.marked + estimate.parts.checked);
		assert.ok(estimate.high - estimate.low > 1000, `an unmeasured guess is wide: ${estimate.low} to ${estimate.high}`);
	});

	test("check answers pull a wrong starting guess to the learner's real size", () => {
		const learner = learnerWhoKnows(2500, 1.5);
		for (const seed of [1, 2, 3, 4, 5]) {
			const answers = simulateChecks(learner, 72, 300, seed);
			const evidence = new Map<string, WordEvidence>(answers.map((a) => [a.slug, { check: { known: a.known, ageDays: 0 } }]));
			const estimate = core.estimateWords(words, evidence, core.fitKnowledgeCurve(answers, 300, DICTIONARY));
			assert.ok(Math.abs(estimate.total - learner.size) / learner.size < 0.3, `seed ${seed}: ${estimate.total} for a real ${Math.round(learner.size)}`);
		}
	});

	test("more answers narrow the range", () => {
		const learner = learnerWhoKnows(1500, 1.4);
		const width = (count: number) => {
			const answers = simulateChecks(learner, count, 1200, 7);
			const estimate = core.estimateWords(words, noEvidence, core.fitKnowledgeCurve(answers, 1200, DICTIONARY));
			return estimate.high - estimate.low;
		};
		assert.ok(width(96) < width(24), `${width(96)} < ${width(24)}`);
		assert.ok(width(24) < width(0), `${width(24)} < ${width(0)}`);
	});

	test("every answer right or every answer wrong still gives a finite size inside the dictionary", () => {
		for (const known of [true, false]) {
			const answers: CheckAnswer[] = [50, 200, 800, 2000, 5000].map((rank) => ({ slug: `w${rank}`, rank, known, ageDays: 0 }));
			const estimate = core.estimateWords(words, noEvidence, core.fitKnowledgeCurve(answers, 1200, DICTIONARY));
			assert.ok(Number.isFinite(estimate.total) && estimate.total >= 0 && estimate.total <= DICTIONARY, `${known}: ${estimate.total}`);
			assert.ok(estimate.low <= estimate.total && estimate.total <= estimate.high);
		}
		const more = core.estimateWords(words, noEvidence, core.fitKnowledgeCurve([{ slug: "w3000", rank: 3000, known: true, ageDays: 0 }], 1200, DICTIONARY));
		const fewer = core.estimateWords(words, noEvidence, core.fitKnowledgeCurve([{ slug: "w3000", rank: 3000, known: false, ageDays: 0 }], 1200, DICTIONARY));
		assert.ok(more.total > fewer.total);
	});

	test("a word with evidence counts by its evidence, the strongest first", () => {
		const curve = core.fitKnowledgeCurve([], 1200, DICTIONARY);
		const base = core.estimateWords(words, noEvidence, curve);
		const rare = "w6500";
		const rareChance = core.chanceKnown(curve, 6500);
		assert.ok(rareChance < 0.2);

		const marked = core.estimateWords(words, new Map([[rare, { marked: true }]]), curve);
		assert.equal(marked.counts.marked, 1);
		assert.equal(marked.parts.marked, 1);

		const reviewed = core.estimateWords(words, new Map([[rare, { reviewRecall: 0.9 }]]), curve);
		assert.equal(reviewed.counts.review, 1);
		assert.equal(reviewed.counts.inferred, DICTIONARY - 1);

		const both = core.estimateWords(words, new Map([[rare, { reviewRecall: 0.4, marked: true }]]), curve);
		assert.equal(both.counts.marked, 1);
		assert.equal(both.counts.review, 0);

		const common = "w20";
		const missed = core.estimateWords(words, new Map([[common, { check: { known: false, ageDays: 0 } }]]), curve);
		assert.equal(missed.counts.checked, 1);
		assert.equal(missed.parts.checked, 0);
		assert.ok(base.counts.inferred === DICTIONARY);
	});

	test("an old answer fades toward what the curve says about the word", () => {
		assert.equal(core.answerWeight(0), 1);
		assert.equal(core.answerWeight(core.ANSWER_HALF_LIFE_DAYS), 0.5);
		const curve = core.fitKnowledgeCurve([], 3000, DICTIONARY);
		const commonWords = words.slice(0, 40);
		const missedAt = (ageDays: number) => core.estimateWords(words, new Map(commonWords.map((w) => [w.slug, { check: { known: false, ageDays } }])), curve).parts.checked;
		assert.equal(missedAt(0), 0);
		assert.ok(missedAt(60) > 15 && missedAt(60) < 25, `${missedAt(60)}`);
		assert.ok(missedAt(600) > 35, `${missedAt(600)}`);
	});

	test("the next word to check comes from the words on offer, half near the edge and half across the dictionary", () => {
		const curve = core.fitKnowledgeCurve([], 1200, DICTIONARY);
		const edge = core.midpointRank(curve);
		const rand = rng(11);
		const candidates = words.filter((w) => w.rank % 3 === 0);
		const offered = new Set(candidates.map((w) => w.slug));
		const focused: number[] = [];
		const spread: number[] = [];
		for (let turn = 0; turn < 200; turn++) {
			const word = core.nextCheckWord(candidates, curve, turn, rand)!;
			assert.ok(offered.has(word.slug));
			(turn % 2 === 0 ? focused : spread).push(word.rank);
		}
		assert.ok(focused.every((r) => r > edge / 5 && r < edge * 5), "focused turns stay around the edge");
		assert.ok(Math.max(...spread) > 4000 && Math.min(...spread) < 100, "spread turns reach both ends");
		assert.equal(core.nextCheckWord([], curve, 0, rand), undefined);
	});
	test("a typed meaning is right by the dictionary only when every meaning typed is one of the word's own", () => {
		assert.deepEqual(core.meaningsInGloss("to apologize (sa); to excuse / justify (someone)"), ["apologize", "excuse", "justify"]);
		assert.deepEqual(core.meaningsInGloss("circle; round; lap; bike (colloq.)"), ["circle", "round", "lap", "bike"]);
		assert.equal(core.plainMeaning("  To Smile (usmiať sa) "), "smile");
		assert.equal(core.plainMeaning("the"), "the");

		const kolo = ["circle; round; lap; bike (colloq.)"];
		assert.equal(core.dictionaryAccepts(kolo, "Circle"), true);
		assert.equal(core.dictionaryAccepts(kolo, "a bike"), true);
		assert.equal(core.dictionaryAccepts(kolo, "lap, round"), true);
		assert.equal(core.dictionaryAccepts(kolo, "circle or wheel"), false, "one meaning the dictionary does not list sends the whole answer to the model");
		assert.equal(core.dictionaryAccepts(kolo, "wheel"), false);
		assert.equal(core.dictionaryAccepts(kolo, "  "), false);
		assert.equal(core.dictionaryAccepts(["to smile (usmiať sa)"], "to smile"), true);
		assert.equal(core.dictionaryAccepts(["to smile (usmiať sa)"], "smiling"), false);
		assert.equal(core.dictionaryAccepts(["transport", "to the right"], "to the right"), true, "a word written the same way counts with either meaning");
	});

	test("the number of answers studies ask for grows with the dictionary", () => {
		assert.equal(core.answersForASteadyEstimate(7105), 210);
		assert.equal(core.answersForASteadyEstimate(1000), 30);
	});
});

describe("the word check", () => {
	const lexicon = loadLexicon()!;
	const rankOf = new Map(frequencyOrder(lexicon).map((slug, i) => [slug, i + 1]));
	const KNOWS_UP_TO_RANK = 900;

	test("an empty profile gets a guess from its level, labeled as not measured, and the day is kept", () => {
		const report = server.wordEstimateReport(new Date("2026-11-12T10:00:00Z"));
		assert.ok(report.estimate);
		assert.equal(report.measured, false);
		assert.equal(report.estimate.dictionary, lexicon.entries.length);
		assert.equal(report.checks, 0);
		assert.deepEqual(report.history, []);
		assert.ok(report.wordsLeftToCheck > 5000);
		const kept = server.recordEstimateDay(new Date("2026-11-12T10:00:00Z"), 0);
		assert.deepEqual(kept.history, [{ day: "2026-11-12", total: report.estimate.total }]);
	});

	test("a marked word counts at once", () => {
		const before = server.wordEstimateReport(new Date("2026-11-12T10:05:00Z")).estimate!;
		const rare = frequencyOrder(lexicon).at(-10)!;
		knownWordStore.set(rare, rare, true, new Date("2026-11-12T10:05:00Z"));
		const after = server.wordEstimateReport(new Date("2026-11-12T10:06:00Z")).estimate!;
		assert.equal(after.counts.marked, before.counts.marked + 1);
		assert.equal(after.parts.marked, before.parts.marked + 1);
	});

	test("a whole check: one word at a time with no meanings shown, none repeated; the typed meanings measure the size and the measurement reaches Milestones", async () => {
		const started = new Date("2026-11-12T11:00:00Z");
		const start = server.startWordCheck(started, 4242);
		assert.equal(start.progress.total, core.CHECK_LENGTH);
		assert.equal(start.judges, false, "no model is set in a test profile");
		assert.deepEqual(Object.keys(start.item).sort(), ["slug", "word"], "the question carries no meaning to pick from");
		let item: WordCheckItem | null = start.item;
		const seen = new Set<string>();
		let known = 0;
		let asked = 0;
		while (item) {
			assert.ok(!seen.has(item.slug), `${item.slug} asked twice`);
			seen.add(item.slug);
			const entry: LexiconEntry = lexicon.bySlug.get(item.slug)!;
			const knows: boolean = rankOf.get(item.slug)! <= KNOWS_UP_TO_RANK;
			const typed: string | null = knows ? core.meaningsInGloss(entry.en)[0]! : null;
			const feedback: WordCheckFeedback = await server.answerWordCheck({ id: start.id, slug: item.slug, typed, ms: 2500 }, new Date(started.getTime() + (asked + 1) * 5000));
			assert.equal(feedback.verdict, knows ? "known" : "dont-know");
			assert.equal(feedback.markedBy, knows ? "dictionary" : undefined);
			assert.equal(feedback.typed, typed);
			assert.ok(feedback.gloss.startsWith(entry.en));
			if (knows) known++;
			asked++;
			assert.equal(feedback.progress.asked, asked);
			item = feedback.item;
		}
		assert.equal(asked, core.CHECK_LENGTH);
		await assert.rejects(server.answerWordCheck({ id: start.id, slug: "nothing", typed: "x" }), /answered already/);

		const ended = new Date(started.getTime() + 150_000);
		const result = server.finishWordCheck({ id: start.id, activeMs: 120_000, tz: 0 }, ended);
		assert.equal(result.answered, core.CHECK_LENGTH);
		assert.equal(result.known, known);
		assert.equal(result.unchecked, 0);
		assert.equal(result.measured, true);
		assert.equal(result.missed.length, core.CHECK_LENGTH - known);
		assert.ok(result.after.total > 450 && result.after.total < 1800, `a learner who knows the commonest ${KNOWS_UP_TO_RANK}: ${result.after.total} (${result.after.low} to ${result.after.high})`);
		const relativeWidth = (r: { total: number; low: number; high: number }) => (r.high - r.low) / r.total;
		assert.ok(relativeWidth(result.after) < relativeWidth(result.before), `the check narrows the range: ${JSON.stringify(result.before)} then ${JSON.stringify(result.after)}`);
		assert.equal(result.report.checks, 1);
		assert.equal(result.report.lastCheckAt, ended.toISOString());
		assert.equal(result.report.history.at(-1)!.total, result.after.total);
		assert.equal(result.report.answersForASteadyEstimate, core.answersForASteadyEstimate(lexicon.entries.length));

		assert.equal(wordCheckStore.open(), null);
		assert.equal(wordCheckStore.answers().length, core.CHECK_LENGTH);
		assert.equal(wordCheckStore.sessions().at(-1)!.usage, undefined, "no model was called, so the check cost nothing");
		assert.deepEqual(latestMeasuredVocabulary(undefined), { size: result.after.total, at: ended.toISOString(), reliable: true });
		assert.equal(progressStore.read().days["2026-11-12"]?.minutesBy?.wordcheck, 2);
		assert.throws(() => server.finishWordCheck({ id: start.id }), /No such word check/);
	});

	test("a second check asks other words, and never a word in Review or marked as known; fewer answers than a whole check are not called measured", async () => {
		const first = new Set(wordCheckStore.answers().map((a) => a.slug));
		const marked = knownWordStore.slugs();
		const start = server.startWordCheck(new Date("2026-11-13T09:00:00Z"), 99);
		let item: WordCheckItem | null = start.item;
		let n = 0;
		while (item && n < 6) {
			assert.ok(!first.has(item.slug) && !marked.has(item.slug));
			item = (await server.answerWordCheck({ id: start.id, slug: item.slug, typed: null }, new Date("2026-11-13T09:01:00Z"))).item;
			n++;
		}
		const result = server.finishWordCheck({ id: start.id }, new Date("2026-11-13T09:02:00Z"));
		assert.equal(result.answered, 6);
		assert.equal(result.missed.length, 6);
		assert.equal(wordCheckStore.sessions().length, 2);
	});

	test("an answer the dictionary words differently goes to the model once, is kept, and counts by its verdict; with no model it counts neither way", async () => {
		const now = new Date("2026-11-13T12:00:00Z");
		const answersBefore = server.wordEstimateReport(now).estimate!.answers;
		const calls = { n: 0 };
		const judging = (accept: boolean, note: string) => {
			const faux = createFauxCore({ tokenSize: { min: 64, max: 64 } });
			return {
				model: faux.getModel(),
				streamFn: ((model, context, options) => {
					calls.n++;
					faux.setResponses([fauxAssistantMessage(JSON.stringify({ accept, note }))]);
					return faux.streamSimple(model, context, options);
				}) as typeof faux.streamSimple,
			};
		};
		const start = server.startWordCheck(now, 7, judging(true, ""));
		assert.equal(start.judges, true);

		const accepted = await server.answerWordCheck({ id: start.id, slug: start.item.slug, typed: "zzz a paraphrase" }, now, judging(true, "A close paraphrase."));
		assert.equal(accepted.verdict, "known");
		assert.equal(accepted.markedBy, "model");
		assert.equal(accepted.note, "A close paraphrase.");
		assert.equal(calls.n, 1);
		assert.deepEqual(Object.keys(wordCheckStore.judgements()), [`${start.item.slug}|zzz a paraphrase`]);

		const rejected = await server.answerWordCheck({ id: start.id, slug: accepted.item!.slug, typed: "zzz something else" }, now, judging(false, "A different meaning."));
		assert.equal(rejected.verdict, "not-known");
		assert.equal(rejected.markedBy, "model");
		assert.equal(calls.n, 2);

		const unchecked = await server.answerWordCheck({ id: start.id, slug: rejected.item!.slug, typed: "zzz nobody to ask" }, now);
		assert.equal(unchecked.verdict, "unchecked");
		assert.equal(unchecked.markedBy, undefined);

		const result = server.finishWordCheck({ id: start.id }, now);
		assert.equal(result.answered, 2);
		assert.equal(result.known, 1);
		assert.equal(result.unchecked, 1);
		assert.deepEqual(
			result.missed.map((w) => w.slug),
			[accepted.item!.slug],
		);
		assert.equal(result.report.estimate!.answers, answersBefore + 2, "the unchecked answer is no evidence");
		assert.equal(wordCheckStore.sessions().at(-1)!.usage!.steps.length, 2);

		const again = server.startWordCheck(now, 8);
		const sameAnswer = await judge.judgeMeaning({ slug: start.item.slug, word: start.item.word, glosses: ["x"], typed: "ZZZ a paraphrase" }, { model: "none", steps: [] });
		assert.deepEqual(sameAnswer, { accepted: true, note: "A close paraphrase." }, "the kept verdict answers without a model");
		assert.equal(calls.n, 2);
		server.finishWordCheck({ id: again.id }, now);
	});

	test("the model's reply is read strictly: a verdict or nothing", () => {
		assert.deepEqual(judge.parseMeaningJudgement('Sure. {"accept": true, "note": " same meaning "}'), { accepted: true, note: "same meaning" });
		assert.deepEqual(judge.parseMeaningJudgement('{"accept": false}'), { accepted: false, note: "" });
		assert.equal(judge.parseMeaningJudgement('{"accept": "yes"}'), null);
		assert.equal(judge.parseMeaningJudgement("I think it is right."), null);
		const prompt = judge.meaningJudgePrompt({ slug: "kolo", word: "kolo", glosses: ["circle; round", "bike"], typed: "wheel" });
		assert.ok(prompt.includes("Word: kolo") && prompt.includes("circle; round | bike") && prompt.includes("The learner typed: wheel"));
		assert.ok(judge.meaningJudgeSystem({ english: "Slovak" }).includes("one Slovak word"));
	});

	test("a Review card counts by the scheduler's chance of recall today, an unanswered or suspended card does not, and none of them is asked in a check", () => {
		const now = new Date("2026-11-14T09:00:00Z");
		const before = server.wordEstimateReport(now).estimate!;
		const untested = frequencyOrder(lexicon).filter((slug) => !wordCheckStore.answers().some((a) => a.slug === slug) && !knownWordStore.has(slug));
		const [fresh, old, unanswered, suspended] = untested.slice(-40, -36) as [string, string, string, string];
		const card = (slug: string, extra: Record<string, unknown>) => ({ id: `${slug}#0`, slug, lemma: slug, gloss: "", sentence: "", translation: "", answer: "", at: 0, state: "review" as const, due: now.toISOString(), reps: 1, lapses: 0, createdAt: now.toISOString(), ...extra });
		reviewStore.writeCards({
			[`${fresh}#0`]: card(fresh, { memory: { stability: 10, difficulty: 5 }, lastReview: now.toISOString() }),
			[`${old}#0`]: card(old, { memory: { stability: 10, difficulty: 5 }, lastReview: "2026-11-04T09:00:00Z" }),
			[`${unanswered}#0`]: card(unanswered, { state: "new", reps: 0 }),
			[`${suspended}#0`]: card(suspended, { memory: { stability: 10, difficulty: 5 }, lastReview: now.toISOString(), suspended: true }),
		});
		const after = server.wordEstimateReport(now).estimate!;
		assert.equal(after.counts.review, before.counts.review + 2);
		assert.equal(after.parts.review, before.parts.review + 2, "1 for the card answered now, 0.9 for the one answered a stability ago, rounded");
		const start = server.startWordCheck(now, 5);
		assert.ok(![fresh, old, unanswered, suspended].includes(start.item.slug));
		server.finishWordCheck({ id: start.id }, now);
		reviewStore.writeCards({});
	});

	test("a newer level check replaces the word check's figure, an older one does not", () => {
		const last = wordCheckStore.sessions().at(-1)!;
		assert.equal(latestMeasuredVocabulary({ size: 50, at: "2026-01-01T00:00:00Z", reliable: true })!.size, last.after.total);
		assert.equal(latestMeasuredVocabulary({ size: 50, at: "2027-01-01T00:00:00Z", reliable: false })!.size, 50);
	});
});
