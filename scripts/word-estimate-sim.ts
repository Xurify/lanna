import { rng } from "../src/core/lesson.ts";
import { CHECK_OPTIONS, estimateWords, fitKnowledgeCurve, nextCheckWord, type CheckAnswer, type RankedWord, type WordEvidence } from "../src/core/word-estimate.ts";

const DICTIONARY = 7105;
const SEEDS = 12;
const words: RankedWord[] = Array.from({ length: DICTIONARY }, (_, i) => ({ slug: `w${i + 1}`, rank: i + 1 }));

interface Habit {
	label: string;
	picksWhenNotKnown: number;
	rightWhenPicking: number;
}

const SAYS_DONT_KNOW: Habit = { label: "always says \"I don't know\"", picksWhenNotKnown: 0, rightWhenPicking: 0 };
const GUESSING_HABITS: Habit[] = [
	{ label: "picks blind for half of the words not known", picksWhenNotKnown: 0.5, rightWhenPicking: 1 / CHECK_OPTIONS },
	{ label: "always picks blind", picksWhenNotKnown: 1, rightWhenPicking: 1 / CHECK_OPTIONS },
	{ label: "always picks, after ruling two meanings out", picksWhenNotKnown: 1, rightWhenPicking: 1 / 2 },
];

function oneLearner(midpoint: number, slope: number, startingGuess: number, checked: number, seed: number, habit: Habit) {
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
		const knows = rand() < chance(word.rank);
		const picks = knows || rand() < habit.picksWhenNotKnown;
		answers.push({ slug: word.slug, rank: word.rank, known: knows || (picks && rand() < habit.rightWhenPicking), saidDontKnow: !picks, ageDays: 0 });
	}
	const evidence = new Map<string, WordEvidence>(answers.map((a) => [a.slug, { check: { known: a.known, ageDays: 0 } }]));
	const estimate = estimateWords(words, evidence, fitKnowledgeCurve(answers, startingGuess, DICTIONARY));
	return { realSize, ratio: estimate.total / realSize, inRange: realSize >= estimate.low && realSize <= estimate.high };
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

function learnersOfOneSize(midpoint: number, checked: number, habit: Habit) {
	const runs = [1.0, 1.5, 2.5, 5].flatMap((slope) => [200, 1200, 3600].flatMap((guess) => Array.from({ length: SEEDS }, (_, i) => oneLearner(midpoint, slope, guess, checked, (i + 1) * 131 + midpoint, habit))));
	return {
		size: Math.round(runs.reduce((sum, r) => sum + r.realSize, 0) / runs.length),
		error: Math.round(median(runs.map((r) => Math.abs(r.ratio - 1))) * 100),
		timesTheRealSize: median(runs.map((r) => r.ratio)).toFixed(2),
		inRange: Math.round((100 * runs.filter((r) => r.inRange).length) / runs.length),
	};
}

const MIDPOINTS = [150, 500, 1500, 4000];
const lengths = process.argv.includes("--one-check") ? [40] : [40, 80, 160];

console.log(SAYS_DONT_KNOW.label);
for (const checked of lengths) {
	const cells = MIDPOINTS.map((midpoint) => {
		const r = learnersOfOneSize(midpoint, checked, SAYS_DONT_KNOW);
		return `about ${r.size} words: median error ${r.error}%, in range ${r.inRange}%`;
	});
	console.log(`${checked} answers | ${cells.join(" | ")}`);
}

for (const habit of GUESSING_HABITS) {
	console.log(habit.label);
	const cells = MIDPOINTS.map((midpoint) => {
		const r = learnersOfOneSize(midpoint, 40, habit);
		return `about ${r.size} words: estimate ${r.timesTheRealSize}x the real size, median error ${r.error}%, in range ${r.inRange}%`;
	});
	console.log(`40 answers | ${cells.join(" | ")}`);
}
