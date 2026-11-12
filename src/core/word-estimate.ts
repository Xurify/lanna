export interface RankedWord {
	slug: string;
	rank: number;
}

export interface CheckAnswer {
	slug: string;
	rank: number;
	known: boolean;
	saidDontKnow: boolean;
	ageDays: number;
}

export interface WordEvidence {
	reviewRecall?: number;
	marked?: boolean;
	check?: { known: boolean; ageDays: number };
}

export interface KnowledgeCurve {
	centerLogRank: number;
	shift: number;
	slope: number;
	luckyPickRate: number;
	covariance: readonly [readonly [number, number], readonly [number, number]];
	answers: number;
}

export type WordEvidenceSource = "review" | "marked" | "checked" | "inferred";

export interface WordEstimate {
	total: number;
	low: number;
	high: number;
	parts: Record<WordEvidenceSource, number>;
	counts: Record<WordEvidenceSource, number>;
	dictionary: number;
	answers: number;
	midpointRank: number;
}

export interface EstimateRange {
	total: number;
	low: number;
	high: number;
}

export interface WordEstimateReport {
	estimate: WordEstimate | null;
	measured: boolean;
	level: string | null;
	checks: number;
	lastCheckAt?: string;
	history: Array<{ day: string; total: number }>;
	wordsLeftToCheck: number;
	checkLength: number;
}

export interface WordCheckItem {
	slug: string;
	word: string;
	options: string[];
}

export interface WordCheckProgress {
	asked: number;
	total: number;
}

export interface WordCheckStart {
	id: string;
	item: WordCheckItem;
	progress: WordCheckProgress;
}

export interface WordCheckFeedback {
	known: boolean;
	correctOption: number;
	lemma: string;
	gloss: string;
	example?: { text: string; translation: string };
	item: WordCheckItem | null;
	progress: WordCheckProgress;
}

export interface WordCheckMiss {
	slug: string;
	lemma: string;
	gloss: string;
	inReview: boolean;
}

export interface WordCheckResult {
	before: EstimateRange;
	after: EstimateRange;
	answered: number;
	known: number;
	measured: boolean;
	missed: WordCheckMiss[];
	report: WordEstimateReport;
}

export const CHECK_LENGTH = 40;
export const CHECK_OPTIONS = 4;
export const ANSWERS_FOR_A_MEASURED_ESTIMATE = 12;
export const ANSWER_HALF_LIFE_DAYS = 60;

const PRIOR_SLOPE = 1.2;
const PRIOR_SLOPE_SD = 1.6;
const PRIOR_SHIFT_SD = 3;
const MIN_SLOPE = 0.3;
const PRIOR_SHARE_CEILING = 0.98;
const MIN_PRIOR_SIZE = 200;
const NEWTON_STEPS = 40;
const Z_FOR_80_PERCENT_RANGE = 1.2816;
const SPREAD_FROM_RANK = 25;
const FOCUS_LOGIT_HALF_WIDTH = 1.4;
const MEANINGS_LEFT_WHEN_PICKING = [CHECK_OPTIONS, CHECK_OPTIONS - 1, CHECK_OPTIONS - 2];

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const roundToTen = (x: number) => Math.round(x / 10) * 10;

export function answerWeight(ageDays: number): number {
	return Math.pow(0.5, Math.max(0, ageDays) / ANSWER_HALF_LIFE_DAYS);
}

interface PickingHabit {
	luckyPickRate: number;
	logChanceOfTheMisses: number;
}

export function pickingHabit(answers: readonly CheckAnswer[], meaningsLeftWhenPicking: number): PickingHabit {
	let wrongPicks = 0;
	let dontKnows = 0;
	for (const a of answers) {
		if (a.known) continue;
		if (a.saidDontKnow) dontKnows += answerWeight(a.ageDays);
		else wrongPicks += answerWeight(a.ageDays);
	}
	if (wrongPicks === 0) return { luckyPickRate: 0, logChanceOfTheMisses: 0 };
	const wrongWhenPicking = (meaningsLeftWhenPicking - 1) / meaningsLeftWhenPicking;
	const picks = wrongPicks / wrongWhenPicking;
	const picksWhenNotKnown = picks / (dontKnows + picks);
	return {
		luckyPickRate: picksWhenNotKnown / meaningsLeftWhenPicking,
		logChanceOfTheMisses: wrongPicks * Math.log(picksWhenNotKnown * wrongWhenPicking) + (dontKnows === 0 ? 0 : dontKnows * Math.log(1 - picksWhenNotKnown)),
	};
}

function chanceOfRightAnswer(chance: number, luck: number): number {
	return luck + (1 - luck) * chance;
}

function knowledgeBehindRightAnswer(chance: number, luck: number): number {
	const right = chanceOfRightAnswer(chance, luck);
	return right === 0 ? 1 : chance / right;
}

export function chanceKnown(curve: KnowledgeCurve, rank: number): number {
	return sigmoid(curve.shift - curve.slope * (Math.log(Math.max(1, rank)) - curve.centerLogRank));
}

export function midpointRank(curve: KnowledgeCurve): number {
	return Math.exp(curve.centerLogRank + curve.shift / curve.slope);
}

function wordsUnderPriorCurve(centerLogRank: number, dictionarySize: number): number {
	let sum = 0;
	for (let rank = 1; rank <= dictionarySize; rank++) sum += sigmoid(-PRIOR_SLOPE * (Math.log(rank) - centerLogRank));
	return sum;
}

const priorCenters = new Map<string, number>();

export function priorCenterLogRank(priorSize: number, dictionarySize: number): number {
	const target = Math.round(Math.min(Math.max(MIN_PRIOR_SIZE, priorSize), dictionarySize * PRIOR_SHARE_CEILING));
	const key = `${target}/${dictionarySize}`;
	const kept = priorCenters.get(key);
	if (kept !== undefined) return kept;
	let lo = -5;
	let hi = Math.log(Math.max(2, dictionarySize)) + 8;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (wordsUnderPriorCurve(mid, dictionarySize) < target) lo = mid;
		else hi = mid;
	}
	const center = (lo + hi) / 2;
	priorCenters.set(key, center);
	return center;
}

interface WeightedPoint {
	x: number;
	known: boolean;
	weight: number;
}

function logPosterior(points: readonly WeightedPoint[], shift: number, slope: number, luck: number): number {
	let sum = -(shift * shift) / (2 * PRIOR_SHIFT_SD ** 2) - (slope - PRIOR_SLOPE) ** 2 / (2 * PRIOR_SLOPE_SD ** 2);
	for (const p of points) {
		const eta = shift - slope * p.x;
		const logChanceRight = luck === 0 ? -Math.log1p(Math.exp(-eta)) : Math.log(chanceOfRightAnswer(sigmoid(eta), luck));
		sum += p.weight * (p.known ? logChanceRight : -Math.log1p(Math.exp(eta)));
	}
	return sum;
}

function curvature(points: readonly WeightedPoint[], shift: number, slope: number, luck: number) {
	let gradShift = -shift / PRIOR_SHIFT_SD ** 2;
	let gradSlope = -(slope - PRIOR_SLOPE) / PRIOR_SLOPE_SD ** 2;
	let hShift = 1 / PRIOR_SHIFT_SD ** 2;
	let hCross = 0;
	let hSlope = 1 / PRIOR_SLOPE_SD ** 2;
	for (const p of points) {
		const chance = sigmoid(shift - slope * p.x);
		const knowledge = knowledgeBehindRightAnswer(chance, luck);
		const residual = p.weight * ((p.known ? 1 : 0) - chanceOfRightAnswer(chance, luck)) * knowledge;
		const information = p.weight * chance * (1 - chance) * (1 - luck) * knowledge;
		gradShift += residual;
		gradSlope -= residual * p.x;
		hShift += information;
		hCross -= information * p.x;
		hSlope += information * p.x * p.x;
	}
	return { gradShift, gradSlope, hShift, hCross, hSlope };
}

function climb(points: readonly WeightedPoint[], luck: number, slopeIsFree: boolean, startSlope: number): { shift: number; slope: number } {
	let shift = 0;
	let slope = startSlope;
	for (let i = 0; i < NEWTON_STEPS; i++) {
		const c = curvature(points, shift, slope, luck);
		const determinant = c.hShift * c.hSlope - c.hCross * c.hCross;
		const stepShift = slopeIsFree ? (c.hSlope * c.gradShift - c.hCross * c.gradSlope) / determinant : c.gradShift / c.hShift;
		const stepSlope = slopeIsFree ? (c.hShift * c.gradSlope - c.hCross * c.gradShift) / determinant : 0;
		const before = logPosterior(points, shift, slope, luck);
		let scale = 1;
		while (scale > 1e-4 && logPosterior(points, shift + scale * stepShift, slope + scale * stepSlope, luck) < before) scale /= 2;
		shift += scale * stepShift;
		slope += scale * stepSlope;
		if (Math.abs(scale * stepShift) < 1e-7 && Math.abs(scale * stepSlope) < 1e-7) break;
	}
	return { shift, slope };
}

export function fitKnowledgeCurve(answers: readonly CheckAnswer[], priorSize: number, dictionarySize: number): KnowledgeCurve {
	const centerLogRank = priorCenterLogRank(priorSize, dictionarySize);
	const points = answers.map((a) => ({ x: Math.log(Math.max(1, a.rank)) - centerLogRank, known: a.known, weight: answerWeight(a.ageDays) }));
	const fits = MEANINGS_LEFT_WHEN_PICKING.map((meaningsLeft) => {
		const habit = pickingHabit(answers, meaningsLeft);
		const free = climb(points, habit.luckyPickRate, true, PRIOR_SLOPE);
		const slopeIsFree = free.slope >= MIN_SLOPE;
		const fit = slopeIsFree ? free : climb(points, habit.luckyPickRate, false, MIN_SLOPE);
		return { ...fit, slopeIsFree, luck: habit.luckyPickRate, score: logPosterior(points, fit.shift, fit.slope, habit.luckyPickRate) + habit.logChanceOfTheMisses };
	});
	const { shift, slope, slopeIsFree, luck } = fits.reduce((best, fit) => (fit.score > best.score ? fit : best));
	const c = curvature(points, shift, slope, luck);
	const determinant = c.hShift * c.hSlope - c.hCross * c.hCross;
	const covariance = slopeIsFree
		? ([
				[c.hSlope / determinant, -c.hCross / determinant],
				[-c.hCross / determinant, c.hShift / determinant],
			] as const)
		: ([
				[1 / c.hShift, 0],
				[0, 0],
			] as const);
	return { centerLogRank, shift, slope, luckyPickRate: luck, covariance, answers: answers.length };
}

interface WordReading {
	source: WordEvidenceSource;
	chance: number;
	curveShare: number;
}

function readWord(curve: KnowledgeCurve, rank: number, evidence: WordEvidence | undefined): WordReading {
	const fromCurve = chanceKnown(curve, rank);
	let best: WordReading = { source: "inferred", chance: fromCurve, curveShare: 1 };
	let hasEvidence = false;
	const offer = (reading: WordReading) => {
		if (!hasEvidence || reading.chance > best.chance) best = reading;
		hasEvidence = true;
	};
	if (evidence?.check) {
		const weight = answerWeight(evidence.check.ageDays);
		const fromAnswer = evidence.check.known ? knowledgeBehindRightAnswer(fromCurve, curve.luckyPickRate) : 0;
		const right = chanceOfRightAnswer(fromCurve, curve.luckyPickRate);
		const answerMovesWithCurve = evidence.check.known && right > 0 ? curve.luckyPickRate / (right * right) : 0;
		offer({ source: "checked", chance: weight * fromAnswer + (1 - weight) * fromCurve, curveShare: weight * answerMovesWithCurve + (1 - weight) });
	}
	if (evidence?.reviewRecall !== undefined) offer({ source: "review", chance: Math.min(1, Math.max(0, evidence.reviewRecall)), curveShare: 0 });
	if (evidence?.marked) offer({ source: "marked", chance: 1, curveShare: 0 });
	return best;
}

export function estimateWords(words: readonly RankedWord[], evidence: ReadonlyMap<string, WordEvidence>, curve: KnowledgeCurve): WordEstimate {
	const parts: Record<WordEvidenceSource, number> = { review: 0, marked: 0, checked: 0, inferred: 0 };
	const counts: Record<WordEvidenceSource, number> = { review: 0, marked: 0, checked: 0, inferred: 0 };
	let outcomeVariance = 0;
	let shiftSensitivity = 0;
	let slopeSensitivity = 0;
	for (const word of words) {
		const reading = readWord(curve, word.rank, evidence.get(word.slug));
		parts[reading.source] += reading.chance;
		counts[reading.source]++;
		outcomeVariance += reading.chance * (1 - reading.chance);
		if (reading.curveShare > 0) {
			const fromCurve = chanceKnown(curve, word.rank);
			const sensitivity = reading.curveShare * fromCurve * (1 - fromCurve);
			shiftSensitivity += sensitivity;
			slopeSensitivity -= sensitivity * (Math.log(Math.max(1, word.rank)) - curve.centerLogRank);
		}
	}
	const [[varShift, cross], [, varSlope]] = curve.covariance;
	const curveVariance = shiftSensitivity * shiftSensitivity * varShift + 2 * shiftSensitivity * slopeSensitivity * cross + slopeSensitivity * slopeSensitivity * varSlope;
	const spread = Z_FOR_80_PERCENT_RANGE * Math.sqrt(Math.max(0, outcomeVariance + curveVariance));
	const total = parts.review + parts.marked + parts.checked + parts.inferred;
	for (const source of Object.keys(parts) as WordEvidenceSource[]) parts[source] = Math.round(parts[source]);
	return {
		total: roundToTen(total),
		low: Math.max(0, roundToTen(total - spread)),
		high: Math.min(words.length, roundToTen(total + spread)),
		parts,
		counts,
		dictionary: words.length,
		answers: curve.answers,
		midpointRank: Math.round(midpointRank(curve)),
	};
}

function nearestByLogRank(candidates: readonly RankedWord[], targetLogRank: number): RankedWord | undefined {
	let lo = 0;
	let hi = candidates.length - 1;
	if (hi < 0) return undefined;
	const target = Math.exp(targetLogRank);
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (candidates[mid]!.rank < target) lo = mid + 1;
		else hi = mid;
	}
	const above = candidates[lo]!;
	const below = candidates[lo - 1];
	if (!below) return above;
	return Math.abs(Math.log(above.rank) - targetLogRank) < Math.abs(Math.log(below.rank) - targetLogRank) ? above : below;
}

export function nextCheckWord(candidatesByRank: readonly RankedWord[], curve: KnowledgeCurve, turn: number, rand: () => number): RankedWord | undefined {
	const last = candidatesByRank[candidatesByRank.length - 1];
	if (!last) return undefined;
	const top = Math.log(last.rank);
	const floor = Math.min(top, Math.log(SPREAD_FROM_RANK));
	const focused = turn % 2 === 0;
	const raw = focused ? Math.log(midpointRank(curve)) + ((rand() * 2 - 1) * FOCUS_LOGIT_HALF_WIDTH) / curve.slope : floor + rand() * (top - floor);
	return nearestByLogRank(candidatesByRank, Math.min(top, Math.max(floor, raw)));
}
