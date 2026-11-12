import { rng } from "../src/core/lesson.ts";
import { estimateWords, fitKnowledgeCurve, nextCheckWord, type CheckAnswer, type RankedWord, type WordEvidence } from "../src/core/word-estimate.ts";

const DICTIONARY = 7105;
const SEEDS = 12;
const words: RankedWord[] = Array.from({ length: DICTIONARY }, (_, i) => ({ slug: `w${i + 1}`, rank: i + 1 }));

function oneLearner(midpoint: number, slope: number, startingGuess: number, checked: number, seed: number) {
	const chance = (rank: number) => 1 / (1 + Math.exp(-slope * (Math.log(midpoint) - Math.log(rank))));
	const realSize = words.reduce((sum, w) => sum + chance(w.rank), 0);
	const rand = rng(seed);
	const answers: CheckAnswer[] = [];
	const asked = new Set<string>();
	for (let turn = 0; turn < checked; turn++) {
		const word = nextCheckWord(
			words.filter((w) => !asked.has(w.slug)),
			fitKnowledgeCurve(answers, startingGuess, DICTIONARY),
			turn,
			rand,
		)!;
		asked.add(word.slug);
		answers.push({ slug: word.slug, rank: word.rank, known: rand() < chance(word.rank), ageDays: 0 });
	}
	const evidence = new Map<string, WordEvidence>(answers.map((a) => [a.slug, { check: { known: a.known, ageDays: 0 } }]));
	const estimate = estimateWords(words, evidence, fitKnowledgeCurve(answers, startingGuess, DICTIONARY));
	return { realSize, error: Math.abs(estimate.total - realSize) / realSize, inRange: realSize >= estimate.low && realSize <= estimate.high };
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

for (const checked of [40, 80, 160]) {
	const cells: string[] = [];
	for (const midpoint of [150, 500, 1500, 4000]) {
		const runs = [1.0, 1.5, 2.5, 5].flatMap((slope) => [200, 1200, 3600].flatMap((guess) => Array.from({ length: SEEDS }, (_, i) => oneLearner(midpoint, slope, guess, checked, (i + 1) * 131 + midpoint))));
		const size = Math.round(runs.reduce((sum, r) => sum + r.realSize, 0) / runs.length);
		cells.push(`about ${size} words: median error ${Math.round(median(runs.map((r) => r.error)) * 100)}%, in range ${Math.round((100 * runs.filter((r) => r.inRange).length) / runs.length)}%`);
	}
	console.log(`${checked} answers | ${cells.join(" | ")}`);
}
