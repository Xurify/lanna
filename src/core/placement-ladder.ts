/**
 * The adaptive placement ladder (LangHarness, 2026-10-28).
 *
 * Why: the first check was a fixed staircase — four tiers of eight items,
 * pass at six — and Xurify called it "clearly wrong … this test should be
 * dynamic". Eight answers at 75% put a learner who truly knows three in
 * four through only two times in three, half the items were multiple
 * choice, and a right answer the dictionary had not foreseen ("Zostal
 * sam doma") counted as a miss.
 *
 * Here every item is chosen from the answers before it. The sixteen drill
 * units of the four tiers form one ladder from first words to mixed
 * cases. The check enters where the learner said they stand, asks one
 * typed item (production, never a choice) and moves: a unit held (two
 * right) jumps the cursor halfway to the top of the open bracket, a gap
 * (two wrong) halves it downward, one each asks a third. The bracket
 * closes when the highest unit held and the lowest unit missed are
 * neighbors — about ten to fourteen items — then one item below the
 * floor guards against a lucky run. The server judges typed misses with
 * the model (a valid alternative counts), and the Socratic stage
 * (src/core/onboarding.ts, ProbeReply) probes the edge itself.
 *
 * Pure and browser-safe; the outcome has the same shape as before so the
 * map, the plan and the profile read it unchanged.
 */

import { CHAPTERS, STAGES, type Cefr } from "./curriculum.ts";
import type { UnitId } from "./lesson.ts";
import { PASS_SHARE, PLACEMENT_TIERS, type PlacementOutcome, type Prior, type TierResult } from "./onboarding.ts";

/** The units of the four tiers, easiest first: the ladder's rungs. */
export const LADDER: readonly UnitId[] = PLACEMENT_TIERS.flatMap((t) => t.units);

/** The most items the check asks before it stops where it is. */
export const MAX_ITEMS = 24;

/** Where the check enters, by what the learner said about their Slovak:
 *  the rung for "simple sentences" is the second A1 tier, "I read some
 *  Slovak" starts at A2 (an adult who reads almost always holds A1). */
export const START_BY_PRIOR: Record<Prior, number> = { none: 0, words: 1, sentences: 4, reading: 8 };

export interface UnitTally {
	hits: number;
	misses: number;
}

export type RungStatus = "open" | "held" | "gap";

/** Two right (one miss allowed, so best of three) holds a rung; two wrong
 *  is a gap; anything else is still open. */
export function rungStatus(t: UnitTally | undefined): RungStatus {
	if (!t) return "open";
	if (t.misses >= 2) return "gap";
	if (t.hits >= 2) return "held";
	return "open";
}

export interface LadderState {
	/** The highest rung held (-1: none yet). Rungs below it count as held. */
	lo: number;
	/** The lowest rung missed (LADDER.length: none yet). */
	hi: number;
	/** The rung being asked. */
	cursor: number;
	asked: number;
	tally: Partial<Record<UnitId, UnitTally>>;
	phase: "bracket" | "confirm" | "done";
	/** The tier a re-check started at; the tiers below were not asked. */
	from: number;
}

/** A fresh ladder: a re-check from tier `from` holds every rung below it. */
export function ladderStart(opts: { prior?: Prior; from?: number } = {}): LadderState {
	const from = Math.max(0, Math.min(PLACEMENT_TIERS.length - 1, opts.from ?? 0));
	const below = PLACEMENT_TIERS.slice(0, from).reduce((n, t) => n + t.units.length, 0);
	const lo = below - 1;
	const seed = START_BY_PRIOR[opts.prior ?? "none"];
	const cursor = Math.max(lo + 1, seed);
	return { lo, hi: LADDER.length, cursor: Math.min(cursor, LADDER.length - 1), asked: 0, tally: {}, phase: "bracket", from };
}

/** The unit the next item comes from, or null when the check is over. */
export function nextUnit(state: LadderState): UnitId | null {
	if (state.phase === "done") return null;
	return LADDER[state.cursor] ?? null;
}

/** Fold one answer in and move the cursor. */
export function applyAnswer(state: LadderState, unit: UnitId, hit: boolean): LadderState {
	const idx = LADDER.indexOf(unit);
	if (idx < 0 || state.phase === "done") return state;
	const was = state.tally[unit] ?? { hits: 0, misses: 0 };
	const tally = { ...state.tally, [unit]: { hits: was.hits + (hit ? 1 : 0), misses: was.misses + (hit ? 0 : 1) } };
	const next: LadderState = { ...state, tally, asked: state.asked + 1 };
	if (next.asked >= MAX_ITEMS) return { ...next, phase: "done" };

	if (next.phase === "confirm") {
		// One item on a rung below the floor: a miss makes it weak (it is
		// in the tally), it does not reopen the bracket. Then the next
		// unasked rung below, at most two, then done.
		const more = confirmRung(next);
		return more === null ? { ...next, phase: "done" } : { ...next, cursor: more };
	}

	const status = rungStatus(tally[unit]);
	if (status === "open") return next; // a third item on the same rung
	if (status === "held") next.lo = Math.max(next.lo, idx);
	else next.hi = Math.min(next.hi, idx);
	if (next.hi - next.lo <= 1) {
		const more = confirmRung(next);
		return more === null ? { ...next, phase: "done" } : { ...next, phase: "confirm", cursor: more };
	}
	// Halfway into the open bracket, never a rung already decided.
	next.cursor = next.lo + Math.max(1, Math.floor((next.hi - next.lo) / 2));
	return next;
}

/** The next rung below the floor to confirm: unasked, above the re-check's
 *  start, at most two rungs down. Null when there is none. */
function confirmRung(state: LadderState): number | null {
	const floor = PLACEMENT_TIERS.slice(0, state.from).reduce((n, t) => n + t.units.length, 0);
	for (let i = state.lo - 1; i >= Math.max(floor, state.lo - 2); i--) {
		const u = LADDER[i]!;
		if (!state.tally[u]) return i;
	}
	return null;
}

/** The outcome in the shape the map and the profile read: a tier passes
 *  when PASS_SHARE of its rungs are held (by evidence or by sitting below
 *  the floor); the check starts the learner in the first chapter of the
 *  first tier not passed. */
export function ladderOutcome(state: LadderState): PlacementOutcome {
	const tiers: TierResult[] = [];
	const units: PlacementOutcome["units"] = {};
	let offset = 0;
	let lastPassed = -1;
	let blocked = false;
	for (const [i, t] of PLACEMENT_TIERS.entries()) {
		let reps = 0;
		let correct = 0;
		let held = 0;
		for (const [j, u] of t.units.entries()) {
			const idx = offset + j;
			const tally = state.tally[u];
			if (tally) {
				reps += tally.hits + tally.misses;
				correct += tally.hits;
				units[u] = { lessons: 0, reps: tally.hits + tally.misses, correct: tally.hits, placed: true };
			}
			const status = rungStatus(tally);
			if (status === "held" || (status === "open" && idx <= state.lo)) held++;
		}
		offset += t.units.length;
		const passed = i < state.from || held / t.units.length >= PASS_SHARE;
		if (passed && !blocked) lastPassed = i;
		if (!passed) blocked = true;
		tiers.push({ id: t.id, level: t.level, title: t.title, reps, correct, passed, ...(i < state.from ? { held: true } : {}) });
	}
	const startChapter = lastPassed >= 0 ? (CHAPTERS[CHAPTERS.findIndex((c) => c.id === PLACEMENT_TIERS[lastPassed]!.chapters.at(-1)) + 1]?.id ?? CHAPTERS.at(-1)!.id) : CHAPTERS[0]!.id;
	const level: Cefr = STAGES.find((st) => st.id === CHAPTERS.find((c) => c.id === startChapter)!.stage)!.level;
	const testedOut = Object.entries(units)
		.filter(([, e]) => e.reps >= 2 && e.correct === e.reps)
		.map(([id]) => id as UnitId);
	const weak = Object.entries(units)
		.filter(([, e]) => e.correct < e.reps)
		.map(([id]) => id as UnitId);
	return { level, tiers, from: state.from, ceiling: lastPassed === PLACEMENT_TIERS.length - 1, startChapter, units, testedOut, weak };
}

/** The floor and the ceiling in words, for the result screen and the tutor. */
export function ladderEdge(state: LadderState): { floor: UnitId | null; ceiling: UnitId | null } {
	return { floor: state.lo >= 0 ? (LADDER[state.lo] ?? null) : null, ceiling: state.hi < LADDER.length ? (LADDER[state.hi] ?? null) : null };
}
