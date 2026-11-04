/**
 * The zone (LangHarness, 2026-11-03, E42): where a unit's first tries sit
 * against a target band. Too far above the band is boredom (nothing is
 * being learned), too far below is anxiety (the unit is out of reach), and
 * in between is the channel where practice is hard enough to teach and
 * easy enough to be done. It is the flow idea from game design, read from
 * the measure the app already keeps: the first try, before any help
 * (first-try.ts). Research: docs/research/game-design-fundamentals.md.
 *
 * Nothing is called from a handful of answers (E25): a unit needs
 * FLOW_MIN_REPS first tries, and it is called easy or hard only when the
 * likely range of its true rate (a one-sided 95% Wilson bound) lies wholly
 * outside the band. Anything else is "in the zone", which here means "no
 * evidence it is outside". Pure and browser-safe.
 */

import type { UnitStage } from "./lesson.ts";
import { wilson, type UnitTrend } from "./mistakes.ts";

export type FlowZone = "new" | "easy" | "zone" | "hard";

/** The band a unit's first tries aim for: hard enough to teach (desirable
 *  difficulty, P3), easy enough to stay with. The top is the weak-spot bar
 *  the app already uses (WEAK_BAR in mistakes.ts); the bottom is the
 *  skill's 65% target. The owner's call: change them here and nowhere else. */
export const FLOW_LOW = 0.65;
export const FLOW_HIGH = 0.85;
/** First tries a unit needs before it is placed at all. */
export const FLOW_MIN_REPS = 12;
/** One-sided 95%: each call looks in one direction only. */
export const FLOW_Z = 1.645;

export interface UnitZone {
	zone: FlowZone;
	/** First tries behind the call, and how many were right. */
	reps: number;
	right: number;
	/** Share right; null under FLOW_MIN_REPS. */
	accuracy: number | null;
	/** The likely range of the true rate (one-sided bounds at FLOW_Z). */
	low: number;
	high: number;
	/** The call reads the last two weeks, not the whole history. */
	lately: boolean;
}

/** The zone of `right` out of `reps` first tries. */
export function flowZone(right: number, reps: number): FlowZone {
	if (reps < FLOW_MIN_REPS) return "new";
	const { low, high } = wilson(right, reps, FLOW_Z);
	if (low >= FLOW_HIGH) return "easy";
	if (high < FLOW_LOW) return "hard";
	return "zone";
}

/** Where one lesson's share of first tries sits against the band. It describes
 *  that lesson only: a unit is placed from many lessons (unitZone). */
export function bandPosition(share: number): "above" | "in" | "below" {
	return share > FLOW_HIGH ? "above" : share < FLOW_LOW ? "below" : "in";
}

/** A unit's zone from its analysis row: the last two weeks when they hold
 *  enough first tries, else the whole history. */
export function unitZone(u: Pick<UnitTrend, "reps" | "wrong" | "lately">): UnitZone {
	const lately = !!u.lately && u.lately.reps >= FLOW_MIN_REPS;
	const reps = lately ? u.lately!.reps : u.reps;
	const right = lately ? u.lately!.right : u.reps - u.wrong;
	const { low, high } = wilson(right, reps, FLOW_Z);
	return { zone: flowZone(right, reps), reps, right, accuracy: reps >= FLOW_MIN_REPS ? right / reps : null, low, high, lately };
}

/** Every unit in the analysis, placed. Units under UNIT_MIN_REPS are not in the analysis at all. */
export function unitZones(units: readonly Pick<UnitTrend, "unit" | "reps" | "wrong" | "lately">[]): Record<string, UnitZone> {
	const out: Record<string, UnitZone> = {};
	for (const u of units) out[u.unit] = unitZone(u);
	return out;
}

const STEPS: UnitStage[] = ["new", "practiced", "strong"];

/** The lesson's stage moved one step by the zone: an easy unit asks for more
 *  (production, the meaning hidden), a hard one is met again from the
 *  sentence with the meaning in view. One step either way, never past the
 *  ends; `shift` is null when nothing moved. */
export function steppedStage(stage: UnitStage, zone: FlowZone | undefined): { stage: UnitStage; shift: "up" | "down" | null } {
	const at = STEPS.indexOf(stage);
	if (zone === "easy" && at < STEPS.length - 1) return { stage: STEPS[at + 1]!, shift: "up" };
	if (zone === "hard" && at > 0) return { stage: STEPS[at - 1]!, shift: "down" };
	return { stage, shift: null };
}

/** The word a learner reads for a zone. */
export const ZONE_WORD: Record<FlowZone, string> = { new: "Too few tries", easy: "Above your zone", zone: "In your zone", hard: "Below your zone" };

/** One plain line of evidence for a placed unit. */
export function zoneLine(z: UnitZone): string {
	const pct = (x: number) => `${Math.round(x * 100)}%`;
	if (z.zone === "new") return `${z.reps} of ${FLOW_MIN_REPS} first tries needed before this unit is placed`;
	return `${z.right} of ${z.reps} first tries right${z.lately ? " lately" : ""}, likely ${pct(z.low)}–${pct(z.high)}; the zone is ${pct(FLOW_LOW)}–${pct(FLOW_HIGH)}`;
}

export interface FlowFocus {
	kind: "hard" | "easy";
	unit: string;
	zone: UnitZone;
}

export interface FlowSummary {
	band: { low: number; high: number };
	minReps: number;
	units: Record<string, UnitZone>;
	counts: Record<FlowZone, number>;
	/** The one unit to act on: the hardest-hit below the zone, else the one
	 *  furthest above it; null when every placed unit is in the zone. */
	focus: FlowFocus | null;
}

export function flowSummary(units: Record<string, UnitZone>): FlowSummary {
	const counts: Record<FlowZone, number> = { new: 0, easy: 0, zone: 0, hard: 0 };
	for (const z of Object.values(units)) counts[z.zone]++;
	const pick = (zone: "hard" | "easy"): FlowFocus | null => {
		const list = Object.entries(units).filter(([, z]) => z.zone === zone);
		if (!list.length) return null;
		const [unit, z] = list.sort(([, a], [, b]) => (zone === "hard" ? a.high - b.high : b.low - a.low))[0]!;
		return { kind: zone, unit, zone: z };
	};
	return { band: { low: FLOW_LOW, high: FLOW_HIGH }, minReps: FLOW_MIN_REPS, units, counts, focus: pick("hard") ?? pick("easy") };
}

/** Units below the zone, worst first: the plan's Strengthen takes the first one it can drill. */
export function hardUnits(units: Record<string, UnitZone>): string[] {
	return Object.entries(units)
		.filter(([, z]) => z.zone === "hard")
		.sort(([, a], [, b]) => a.high - b.high)
		.map(([id]) => id);
}

/** Units above the zone, the most clearly first. */
export function easyUnits(units: Record<string, UnitZone>): string[] {
	return Object.entries(units)
		.filter(([, z]) => z.zone === "easy")
		.sort(([, a], [, b]) => b.low - a.low)
		.map(([id]) => id);
}

/** The line in the tutor's "This learner" block, or null with nothing placed. */
export function flowTutorLine(units: Record<string, UnitZone>, titleOf: (unit: string) => string): string | null {
	const placed = Object.entries(units).filter(([, z]) => z.zone !== "new");
	if (!placed.length) return null;
	const names = (zone: FlowZone) => placed.filter(([, z]) => z.zone === zone).map(([id]) => titleOf(id));
	const parts: string[] = [];
	const hard = names("hard");
	const easy = names("easy");
	if (hard.length) parts.push(`below the zone (first tries mostly wrong, needs a gentler start): ${hard.join(", ")}`);
	if (easy.length) parts.push(`above the zone (first tries almost always right, ask for more): ${easy.join(", ")}`);
	if (!parts.length) return `- Zone: every unit with enough first tries (${placed.length}) sits in the target band of ${Math.round(FLOW_LOW * 100)}–${Math.round(FLOW_HIGH * 100)}% right.`;
	return `- Zone (first tries against a ${Math.round(FLOW_LOW * 100)}–${Math.round(FLOW_HIGH * 100)}% band): ${parts.join("; ")}.`;
}
