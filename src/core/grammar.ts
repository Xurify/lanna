/**
 * The grammar atlas (LangHarness, 2026-10-30): the six Slovak cases down
 * the side, the three genders across the top, and each cell pointing at
 * the drill that teaches it — or "not yet", while no drill exists. The
 * learner's cell comes from progress.units (accuracy = correct / reps),
 * so the same table is a reference and a map of what to drill next.
 * Pure and browser-safe: the server or the page hands in the stats.
 */

import { UNITS, type UnitId } from "./lesson.ts";

export type AtlasCase = "N" | "G" | "D" | "A" | "L" | "I";
export type AtlasGender = "masc" | "fem" | "neut";

export interface AtlasCaseInfo {
	case: AtlasCase;
	/** The Slovak name of the case (menný, genitív…). */
	slovak: string;
	english: string;
}

export const ATLAS_CASES: AtlasCaseInfo[] = [
	{ case: "N", slovak: "menný", english: "nominative" },
	{ case: "G", slovak: "genitív", english: "genitive" },
	{ case: "D", slovak: "datív", english: "dative" },
	{ case: "A", slovak: "akuzatív", english: "accusative" },
	{ case: "L", slovak: "lokál", english: "locative" },
	{ case: "I", slovak: "inštrumentál", english: "instrumental" },
];

export const ATLAS_GENDERS: Array<{ id: AtlasGender; slovak: string; english: string }> = [
	{ id: "masc", slovak: "mužský", english: "masculine" },
	{ id: "fem", slovak: "ženský", english: "feminine" },
	{ id: "neut", slovak: "stredný", english: "neuter" },
];

/** The drill unit each cell opens: A-fem → acc-fem, A-masc → acc-people,
 *  and one drill per case for G, D, L and I (each unit drills every
 *  gender of its case). A blank — or a mapped id that is not a unit in
 *  UNITS — is "not yet" (null). */
const CELL_UNITS: Record<AtlasCase, Partial<Record<AtlasGender, string>>> = {
	N: {},
	G: { masc: "gen", fem: "gen", neut: "gen" },
	D: { masc: "dat", fem: "dat", neut: "dat" },
	A: { masc: "acc-people", fem: "acc-fem" },
	L: { masc: "loc", fem: "loc", neut: "loc" },
	I: { masc: "ins", fem: "ins", neut: "ins" },
};

const UNIT_IDS = new Set<string>(UNITS.map((u) => u.id));

/** The cell's drill unit, or null while it is "not yet". */
export function atlasUnit(row: AtlasCase, col: AtlasGender): UnitId | null {
	const id = CELL_UNITS[row][col];
	return id && UNIT_IDS.has(id) ? (id as UnitId) : null;
}

/** One unit's counts from progress.units. */
export interface AtlasStats {
	reps: number;
	correct: number;
}

/** The cell's accuracy (correct / reps, 0..1). No record, zero reps, or a
 *  "not yet" cell is null — the app never shows a percentage with nothing
 *  behind it. */
export function cellAccuracy(unit: UnitId | null, units: Readonly<Record<string, AtlasStats>>): number | null {
	if (!unit) return null;
	const stats = units[unit];
	if (!stats || !(stats.reps > 0)) return null;
	return stats.correct / stats.reps;
}

export interface AtlasCell {
	row: AtlasCase;
	col: AtlasGender;
	/** The drill the cell opens, or null for "not yet". */
	unit: UnitId | null;
	accuracy: number | null;
	reps: number;
	correct: number;
}

/** The whole 6 × 3 table, each cell carrying its drill and the learner's
 *  accuracy. Row by row, N first — the reading order of the table. */
export function grammarAtlas(units: Readonly<Record<string, AtlasStats>>): AtlasCell[] {
	const cells: AtlasCell[] = [];
	for (const { case: row } of ATLAS_CASES) {
		for (const { id: col } of ATLAS_GENDERS) {
			const unit = atlasUnit(row, col);
			const stats = unit ? units[unit] : undefined;
			cells.push({ row, col, unit, accuracy: cellAccuracy(unit, units), reps: stats?.reps ?? 0, correct: stats?.correct ?? 0 });
		}
	}
	return cells;
}
