export interface RankedWord {
	slug: string;
	rank: number;
	uses?: number;
}

export interface CheckAnswer {
	slug: string;
	rank: number;
	known: boolean;
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
	shareOfUses: number | null;
}

export interface EstimateRange {
	total: number;
	low: number;
	high: number;
}

export interface WordEstimateReport {
	estimate: WordEstimate | null;
	measured: boolean;
	answersForASteadyEstimate: number;
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
}

export interface WordCheckProgress {
	asked: number;
	total: number;
}

export interface WordCheckStart {
	id: string;
	item: WordCheckItem;
	progress: WordCheckProgress;
	judges: boolean;
}

export type WordCheckVerdict = "known" | "not-known" | "dont-know" | "unchecked";
export type WordCheckMarker = "dictionary" | "model";

export interface WordCheckFeedback {
	verdict: WordCheckVerdict;
	markedBy?: WordCheckMarker;
	note?: string;
	typed: string | null;
	lemma: string;
	gloss: string;
	example?: { text: string; translation: string };
	item: WordCheckItem | null;
	progress: WordCheckProgress;
}

export interface WordCheckAnswered {
	slug: string;
	lemma: string;
	gloss: string;
	rank: number;
	verdict: WordCheckVerdict;
	typed: string | null;
}

export interface WordCheckMiss extends WordCheckAnswered {
	inReview: boolean;
}

export interface WordCheckResult {
	before: EstimateRange;
	after: EstimateRange;
	answered: number;
	known: number;
	unchecked: number;
	measured: boolean;
	answers: WordCheckAnswered[];
	missed: WordCheckMiss[];
	report: WordEstimateReport;
}

export const CHECK_LENGTH = 40;
export const ANSWERS_FOR_A_MEASURED_ESTIMATE = CHECK_LENGTH;
// Gyllstad, McLean & Stewart (2021), Language Testing 38(4): "around 30 or more items per 1000-word frequency band".
const ANSWERS_PER_THOUSAND_WORDS = 30;

export function answersForASteadyEstimate(dictionarySize: number): number {
	return Math.round(((dictionarySize / 1000) * ANSWERS_PER_THOUSAND_WORDS) / 10) * 10;
}

const NOTE_IN_BRACKETS = /\([^)]*\)/g;

export function plainMeaning(text: string): string {
	return text
		.normalize("NFKC")
		.toLowerCase()
		.replace(NOTE_IN_BRACKETS, " ")
		.replace(/[^\p{L}\p{N}']+/gu, " ")
		.trim()
		.replace(/^(?:to|a|an|the)\s+/, "");
}

const meaningsIn = (text: string, separators: RegExp) => text.replace(NOTE_IN_BRACKETS, " ").split(separators).map(plainMeaning).filter(Boolean);

export function meaningsInGloss(gloss: string): string[] {
	return [...new Set(meaningsIn(gloss, /[;,/]/))];
}

export function dictionaryAccepts(glosses: readonly string[], typed: string): boolean {
	const accepted = new Set(glosses.flatMap(meaningsInGloss));
	const answers = meaningsIn(typed, /[;,/]|\bor\b/);
	return answers.length > 0 && answers.every((answer) => accepted.has(answer));
}

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

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const roundToTen = (x: number) => Math.round(x / 10) * 10;

export function answerWeight(ageDays: number): number {
	return Math.pow(0.5, Math.max(0, ageDays) / ANSWER_HALF_LIFE_DAYS);
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

function logPosterior(points: readonly WeightedPoint[], shift: number, slope: number): number {
	let sum = -(shift * shift) / (2 * PRIOR_SHIFT_SD ** 2) - (slope - PRIOR_SLOPE) ** 2 / (2 * PRIOR_SLOPE_SD ** 2);
	for (const p of points) {
		const eta = shift - slope * p.x;
		sum += p.weight * (p.known ? -Math.log1p(Math.exp(-eta)) : -Math.log1p(Math.exp(eta)));
	}
	return sum;
}

function curvature(points: readonly WeightedPoint[], shift: number, slope: number) {
	let gradShift = -shift / PRIOR_SHIFT_SD ** 2;
	let gradSlope = -(slope - PRIOR_SLOPE) / PRIOR_SLOPE_SD ** 2;
	let hShift = 1 / PRIOR_SHIFT_SD ** 2;
	let hCross = 0;
	let hSlope = 1 / PRIOR_SLOPE_SD ** 2;
	for (const p of points) {
		const chance = sigmoid(shift - slope * p.x);
		const residual = p.weight * ((p.known ? 1 : 0) - chance);
		const information = p.weight * chance * (1 - chance);
		gradShift += residual;
		gradSlope -= residual * p.x;
		hShift += information;
		hCross -= information * p.x;
		hSlope += information * p.x * p.x;
	}
	return { gradShift, gradSlope, hShift, hCross, hSlope };
}

function climb(points: readonly WeightedPoint[], slopeIsFree: boolean, startSlope: number): { shift: number; slope: number } {
	let shift = 0;
	let slope = startSlope;
	for (let i = 0; i < NEWTON_STEPS; i++) {
		const c = curvature(points, shift, slope);
		const determinant = c.hShift * c.hSlope - c.hCross * c.hCross;
		const stepShift = slopeIsFree ? (c.hSlope * c.gradShift - c.hCross * c.gradSlope) / determinant : c.gradShift / c.hShift;
		const stepSlope = slopeIsFree ? (c.hShift * c.gradSlope - c.hCross * c.gradShift) / determinant : 0;
		const before = logPosterior(points, shift, slope);
		let scale = 1;
		while (scale > 1e-4 && logPosterior(points, shift + scale * stepShift, slope + scale * stepSlope) < before) scale /= 2;
		shift += scale * stepShift;
		slope += scale * stepSlope;
		if (Math.abs(scale * stepShift) < 1e-7 && Math.abs(scale * stepSlope) < 1e-7) break;
	}
	return { shift, slope };
}

export function fitKnowledgeCurve(answers: readonly CheckAnswer[], priorSize: number, dictionarySize: number): KnowledgeCurve {
	const centerLogRank = priorCenterLogRank(priorSize, dictionarySize);
	const points = answers.map((a) => ({ x: Math.log(Math.max(1, a.rank)) - centerLogRank, known: a.known, weight: answerWeight(a.ageDays) }));
	let { shift, slope } = climb(points, true, PRIOR_SLOPE);
	const slopeIsFree = slope >= MIN_SLOPE;
	if (!slopeIsFree) ({ shift, slope } = climb(points, false, MIN_SLOPE));
	const c = curvature(points, shift, slope);
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
	return { centerLogRank, shift, slope, covariance, answers: answers.length };
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
		offer({ source: "checked", chance: weight * (evidence.check.known ? 1 : 0) + (1 - weight) * fromCurve, curveShare: 1 - weight });
	}
	if (evidence?.reviewRecall !== undefined) offer({ source: "review", chance: Math.min(1, Math.max(0, evidence.reviewRecall)), curveShare: 0 });
	if (evidence?.marked) offer({ source: "marked", chance: 1, curveShare: 0 });
	return best;
}

export function estimateWords(words: readonly RankedWord[], evidence: ReadonlyMap<string, WordEvidence>, curve: KnowledgeCurve): WordEstimate {
	const parts: Record<WordEvidenceSource, number> = { review: 0, marked: 0, checked: 0, inferred: 0 };
	const counts: Record<WordEvidenceSource, number> = { review: 0, marked: 0, checked: 0, inferred: 0 };
	let outcomeVariance = 0;
	let usesOfKnownWords = 0;
	let usesOfAllWords = 0;
	let shiftSensitivity = 0;
	let slopeSensitivity = 0;
	for (const word of words) {
		const reading = readWord(curve, word.rank, evidence.get(word.slug));
		parts[reading.source] += reading.chance;
		usesOfKnownWords += reading.chance * (word.uses ?? 0);
		usesOfAllWords += word.uses ?? 0;
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
		shareOfUses: usesOfAllWords > 0 ? usesOfKnownWords / usesOfAllWords : null,
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
