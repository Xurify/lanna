import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, test } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-word-estimate-"));
process.env.LH_DATA_DIR = TMP_DATA;
process.env.LH_PROFILE = "slovak";

const core = await import("../src/core/word-estimate.ts");
const { rng } = await import("../src/core/lesson.ts");
const server = await import("../src/server/word-estimate.ts");
const { wordCheckStore, latestMeasuredVocabulary } = await import("../src/store/word-check.ts");
const { knownWordStore } = await import("../src/store/known-words.ts");
const { progressStore } = await import("../src/store/progress.ts");
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

	test("a whole check, four meanings each, none repeated; the answers measure the size and the measurement reaches Milestones", () => {
		const started = new Date("2026-11-12T11:00:00Z");
		const start = server.startWordCheck(started, 4242);
		assert.equal(start.progress.total, core.CHECK_LENGTH);
		let item: WordCheckItem | null = start.item;
		const seen = new Set<string>();
		let known = 0;
		let asked = 0;
		while (item) {
			assert.ok(!seen.has(item.slug), `${item.slug} asked twice`);
			seen.add(item.slug);
			assert.equal(item.options.length, 4);
			assert.equal(new Set(item.options.map((o) => o.toLowerCase())).size, 4, `distinct meanings for ${item.word}: ${item.options.join(" | ")}`);
			const entry: LexiconEntry = lexicon.bySlug.get(item.slug)!;
			const right = item.options.indexOf(server.meaningOffered(entry));
			assert.ok(!item.options.some((o) => /[()]/.test(o)), `no bracketed note that could name the word: ${item.options.join(" | ")}`);
			assert.ok(right >= 0, `the right meaning is offered for ${item.word}`);
			const knows: boolean = rankOf.get(item.slug)! <= KNOWS_UP_TO_RANK;
			const feedback: WordCheckFeedback = server.answerWordCheck({ id: start.id, slug: item.slug, pick: knows ? right : null, ms: 2500 }, new Date(started.getTime() + (asked + 1) * 5000));
			assert.equal(feedback.known, knows);
			assert.equal(feedback.correctOption, right);
			assert.equal(feedback.gloss, entry.en);
			if (knows) known++;
			asked++;
			assert.equal(feedback.progress.asked, asked);
			item = feedback.item;
		}
		assert.equal(asked, core.CHECK_LENGTH);
		assert.throws(() => server.answerWordCheck({ id: start.id, slug: "nothing", pick: 0 }), /answered already/);

		const ended = new Date(started.getTime() + 150_000);
		const result = server.finishWordCheck({ id: start.id, activeMs: 120_000, tz: 0 }, ended);
		assert.equal(result.answered, core.CHECK_LENGTH);
		assert.equal(result.known, known);
		assert.equal(result.measured, true);
		assert.equal(result.missed.length, core.CHECK_LENGTH - known);
		assert.ok(result.after.total > 450 && result.after.total < 1800, `a learner who knows the commonest ${KNOWS_UP_TO_RANK}: ${result.after.total} (${result.after.low} to ${result.after.high})`);
		const relativeWidth = (r: { total: number; low: number; high: number }) => (r.high - r.low) / r.total;
		assert.ok(relativeWidth(result.after) < relativeWidth(result.before), `the check narrows the range: ${JSON.stringify(result.before)} then ${JSON.stringify(result.after)}`);
		assert.equal(result.report.checks, 1);
		assert.equal(result.report.lastCheckAt, ended.toISOString());
		assert.equal(result.report.history.at(-1)!.total, result.after.total);

		assert.equal(wordCheckStore.open(), null);
		assert.equal(wordCheckStore.answers().length, core.CHECK_LENGTH);
		assert.deepEqual(latestMeasuredVocabulary(undefined), { size: result.after.total, at: ended.toISOString(), reliable: true });
		assert.equal(progressStore.read().days["2026-11-12"]?.minutesBy?.wordcheck, 2);
		assert.throws(() => server.finishWordCheck({ id: start.id }), /No such word check/);
	});

	test("a second check asks other words, and never a word in Review or marked as known", () => {
		const first = new Set(wordCheckStore.answers().map((a) => a.slug));
		const marked = knownWordStore.slugs();
		const start = server.startWordCheck(new Date("2026-11-13T09:00:00Z"), 99);
		let item: WordCheckItem | null = start.item;
		let n = 0;
		while (item && n < 6) {
			assert.ok(!first.has(item.slug) && !marked.has(item.slug));
			item = server.answerWordCheck({ id: start.id, slug: item.slug, pick: null }, new Date("2026-11-13T09:01:00Z")).item;
			n++;
		}
		const result = server.finishWordCheck({ id: start.id }, new Date("2026-11-13T09:02:00Z"));
		assert.equal(result.answered, 6);
		assert.equal(result.missed.length, 6);
		assert.equal(wordCheckStore.sessions().length, 2);
	});

	test("a newer level check replaces the word check's figure, an older one does not", () => {
		const last = wordCheckStore.sessions().at(-1)!;
		assert.equal(latestMeasuredVocabulary({ size: 50, at: "2026-01-01T00:00:00Z", reliable: true })!.size, last.after.total);
		assert.equal(latestMeasuredVocabulary({ size: 50, at: "2027-01-01T00:00:00Z", reliable: false })!.size, 50);
	});
});
