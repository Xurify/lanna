/**
 * FSRS-5 scheduler (LangHarness spaced review) — pure, browser-safe.
 *
 * The Free Spaced Repetition Scheduler models each card's memory with two
 * numbers: STABILITY (days until recall probability falls to 90%) and
 * DIFFICULTY (1–10). Every review updates both from the rating and from
 * how retrievable the card was at that moment. Formulas and the default
 * weights are FSRS-5's published ones (open-spaced-repetition/fsrs4anki,
 * "The Algorithm" wiki page); nothing here is fitted to one learner yet —
 * per-learner optimization needs a few hundred reviews first.
 */

export type Rating = 1 | 2 | 3 | 4; // Again · Hard · Good · Easy

export const RATING_LABELS: Record<Rating, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

/** FSRS-5 default parameters. */
export const FSRS5_WEIGHTS = [
	0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605,
	2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
] as const;

/** The 19 FSRS-5 parameters. */
export type Weights = readonly [
	number, number, number, number, number, number, number, number, number, number,
	number, number, number, number, number, number, number, number, number,
];

const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R(S, S) = 0.9

export interface MemoryState {
	stability: number;
	difficulty: number;
}

export interface SchedulerOptions {
	/** Target recall probability at the due date (0.7–0.97). */
	retention?: number;
	/** Longest interval in days. */
	maxInterval?: number;
	weights?: Weights;
}

const DAY_MS = 86_400_000;
/** A failed card comes back within the session (minutes), not tomorrow. */
export const RELEARN_MS = 10 * 60_000;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Probability of recall after `elapsedDays` at `stability`. */
export function retrievability(elapsedDays: number, stability: number): number {
	return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Days until retrievability falls to `retention`. */
export function intervalDays(stability: number, retention = 0.9, maxInterval = 36500): number {
	const raw = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
	return clamp(Math.round(raw), 1, maxInterval);
}

function initDifficulty(w: Weights, rating: Rating): number {
	return w[4] - Math.exp(w[5] * (rating - 1)) + 1;
}

export function initialState(rating: Rating, weights: Weights = FSRS5_WEIGHTS): MemoryState {
	return {
		stability: Math.max(0.1, weights[rating - 1] ?? 1),
		difficulty: clamp(initDifficulty(weights, rating), 1, 10),
	};
}

function nextDifficulty(w: Weights, d: number, rating: Rating): number {
	const delta = -w[6] * (rating - 3);
	const damped = d + (delta * (10 - d)) / 9; // linear damping near 10
	const reverted = w[7] * initDifficulty(w, 4) + (1 - w[7]) * damped; // mean reversion
	return clamp(reverted, 1, 10);
}

function recallStability(w: Weights, s: number, d: number, r: number, rating: Rating): number {
	const hard = rating === 2 ? w[15] : 1;
	const easy = rating === 4 ? w[16] : 1;
	return s * (Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy + 1);
}

function forgetStability(w: Weights, s: number, d: number, r: number): number {
	const next = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
	return Math.min(next, s);
}

function sameDayStability(w: Weights, s: number, rating: Rating): number {
	return s * Math.exp(w[17] * (rating - 3 + w[18]));
}

/**
 * Apply one review. `state` is undefined for a card's first review;
 * `elapsedDays` is the time since the previous review (fractional).
 */
export function review(
	state: MemoryState | undefined,
	rating: Rating,
	elapsedDays: number,
	weights: Weights = FSRS5_WEIGHTS,
): MemoryState {
	if (!state) return initialState(rating, weights);
	const difficulty = nextDifficulty(weights, state.difficulty, rating);
	let stability: number;
	if (elapsedDays < 1) stability = sameDayStability(weights, state.stability, rating);
	else {
		const r = retrievability(elapsedDays, state.stability);
		stability =
			rating === 1
				? forgetStability(weights, state.stability, state.difficulty, r)
				: recallStability(weights, state.stability, state.difficulty, r, rating);
	}
	return { stability: clamp(stability, 0.1, 36500), difficulty };
}

/** When the card is due next, given its new state and the rating. Again
 *  re-queues within the session; everything else waits whole days. */
export function nextDue(now: Date, state: MemoryState, rating: Rating, opts: SchedulerOptions = {}): Date {
	if (rating === 1) return new Date(now.getTime() + RELEARN_MS);
	const days = intervalDays(state.stability, opts.retention ?? 0.9, opts.maxInterval ?? 36500);
	return new Date(now.getTime() + days * DAY_MS);
}

/** What each button would do — for the "Good · 4d" labels. */
export function previewIntervals(
	state: MemoryState | undefined,
	elapsedDays: number,
	opts: SchedulerOptions = {},
): Record<Rating, number> {
	const out = {} as Record<Rating, number>;
	for (const rating of [1, 2, 3, 4] as Rating[]) {
		const next = review(state, rating, elapsedDays, opts.weights);
		out[rating] = rating === 1 ? RELEARN_MS / DAY_MS : intervalDays(next.stability, opts.retention ?? 0.9, opts.maxInterval);
	}
	return out;
}

/** "10m", "3d", "2mo", "1.5y" */
export function formatInterval(days: number): string {
	if (days < 1) return `${Math.max(1, Math.round(days * 1440))}m`;
	if (days < 30) return `${Math.round(days)}d`;
	if (days < 365) return `${Math.round(days / 30)}mo`;
	return `${(days / 365).toFixed(1).replace(/\.0$/, "")}y`;
}
