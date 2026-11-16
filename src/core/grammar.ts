/**
 * The grammar atlas (LangHarness, 2026-10-30; first tries 2026-10-31): the six
 * Slovak cases down the side, the three genders across the top, and each cell
 * pointing at the drill that teaches it, or "not yet" while no drill exists.
 * A cell's percentage is its first-try accuracy for that case and gender
 * (src/core/first-try.ts): the answers given unaided, with the slips behind
 * the wrong ones. Pure and browser-safe: the server or the page hands in the
 * stats.
 */

import { allUnits, type UnitId } from "./lesson.ts";
import { perCourse } from "./course.ts";
import { FORM_SLIPS, FORM_SLIP_LABEL, type FormSlip } from "./form-slip.ts";
import type { FirstTally } from "./first-try.ts";

export type AtlasCase = "N" | "G" | "D" | "A" | "L" | "I";
export type AtlasGender = "masc" | "fem" | "neut";

interface AtlasCaseInfo {
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
 *  allUnits() — is "not yet" (null). */
const CELL_UNITS: Record<AtlasCase, Partial<Record<AtlasGender, string>>> = {
	N: {},
	G: { masc: "gen", fem: "gen", neut: "gen" },
	D: { masc: "dat", fem: "dat", neut: "dat" },
	A: { masc: "acc-people", fem: "acc-fem" },
	L: { masc: "loc", fem: "loc", neut: "loc" },
	I: { masc: "ins", fem: "ins", neut: "ins" },
};

export interface NoDrill {
	short: string;
	sub: string;
	why: string;
}

const NOMINATIVE: NoDrill = {
	short: "dictionary form",
	sub: "the word does not change",
	why: "The nominative is the case of the subject (Peter číta knihu: Peter is nominative). In the singular its form is the dictionary form, so there is nothing to change and nothing to practice. The plural does have endings (domy, ženy, mestá): that is the lesson More than one. The describing word that goes with it changes with gender (nový dom, nová kniha, nové mesto): that is Describing words.",
};

const NO_DRILL: Partial<Record<AtlasCase, Partial<Record<AtlasGender, NoDrill>>>> = {
	N: { masc: NOMINATIVE, fem: NOMINATIVE, neut: NOMINATIVE },
	A: {
		neut: {
			short: "same as nominative",
			sub: "the word does not change",
			why: "A neuter word as the object keeps its dictionary form, the same as in the nominative: Vidím mesto. So there is nothing to change and nothing to practice.",
		},
	},
};

const NOT_BUILT: NoDrill = { short: "no drill yet", sub: "", why: "There is no drill for this cell yet." };

const unitIds = perCourse(() => new Set<string>(allUnits().map((u) => u.id)));

/** The cell's drill unit, or null while it is "not yet". */
export function atlasUnit(row: AtlasCase, col: AtlasGender): UnitId | null {
	const id = CELL_UNITS[row][col];
	return id && unitIds().has(id) ? (id as UnitId) : null;
}

/** The atlas column a lexicon gender falls in: both masculine kinds are
 *  "masc"; plural-only and unknown genders have no column (null). */
export function genderColumn(gender: string | undefined): AtlasGender | null {
	if (gender === "masculine-inanimate" || gender === "masculine-animate") return "masc";
	if (gender === "feminine") return "fem";
	if (gender === "neuter") return "neut";
	return null;
}

export function isAtlasGender(v: unknown): v is AtlasGender {
	return v === "masc" || v === "fem" || v === "neut";
}

export function genderLabel(g: AtlasGender): string {
	if (g === "masc") return "Masculine";
	if (g === "fem") return "Feminine";
	return "Neuter";
}

/** The cell a drill rep counts toward, from its drill and its word's gender.
 *  Null for a drill the atlas does not map, or a gender its cell does not hold. */
export function atlasCellOf(unit: string, gender: string | undefined): { row: AtlasCase; col: AtlasGender } | null {
	const col = genderColumn(gender);
	if (!col) return null;
	const row = ATLAS_CASES.find((c) => atlasUnit(c.case, col) === unit)?.case;
	return row ? { row, col } : null;
}

/** The case a drill teaches, for the drills the atlas maps (null otherwise:
 *  "kam-kde" is a place or a direction, not one case). */
export function caseDrill(unit: string): AtlasCase | null {
	return ATLAS_CASES.find((c) => ATLAS_GENDERS.some((g) => atlasUnit(c.case, g.id) === unit))?.case ?? null;
}

/** One drill's record as the atlas reads it (progress.json units): its first
 *  tries split by gender column. */
interface AtlasStats {
	byGender?: Partial<Record<AtlasGender, FirstTally>>;
}

export interface AtlasCell {
	row: AtlasCase;
	col: AtlasGender;
	/** The drill the cell opens, or null when there is none. */
	unit: UnitId | null;
	/** Why a cell with no drill has none: nothing to practice, or not built yet. */
	noDrill: NoDrill | null;
	/** First-try accuracy (right / tries, 0..1); null with no first tries yet. */
	accuracy: number | null;
	/** Unaided first tries in this cell, how many were right, and how many of
	 *  the right ones only lacked an accent. */
	reps: number;
	right: number;
	accents: number;
	/** The wrong first tries by slip, and the slips said in Speak. */
	slips: Partial<Record<FormSlip, number>>;
	spoken: Partial<Record<FormSlip, number>>;
}

/** The whole 6 × 3 table, each cell carrying its drill and the learner's
 *  first-try record. Row by row, N first: the reading order of the table. */
export function grammarAtlas(units: Readonly<Record<string, AtlasStats | undefined>>): AtlasCell[] {
	const cells: AtlasCell[] = [];
	for (const { case: row } of ATLAS_CASES) {
		for (const { id: col } of ATLAS_GENDERS) {
			const unit = atlasUnit(row, col);
			const tally = unit ? units[unit]?.byGender?.[col] : undefined;
			const accuracy = tally && tally.reps > 0 ? tally.right / tally.reps : null;
			cells.push({
				row,
				col,
				unit,
				noDrill: unit ? null : (NO_DRILL[row]?.[col] ?? NOT_BUILT),
				accuracy,
				reps: tally?.reps ?? 0,
				right: tally?.right ?? 0,
				accents: tally?.accents ?? 0,
				slips: tally?.slips ?? {},
				spoken: tally?.spoken ?? {},
			});
		}
	}
	return cells;
}

/** "dictionary form, no ending (2) · wrong ending (1)": the slips that
 *  occurred, most frequent first; "" when none. */
export function slipLine(slips: Partial<Record<FormSlip, number>>): string {
	return FORM_SLIPS.filter((s) => (slips[s] ?? 0) > 0)
		.sort((a, b) => (slips[b] ?? 0) - (slips[a] ?? 0))
		.map((s) => `${FORM_SLIP_LABEL[s]} (${slips[s]})`)
		.join(" · ");
}

export function weakestGender(
	byGender?: Partial<Record<AtlasGender, FirstTally>>,
	minReps = 3,
	threshold = 0.7,
): AtlasGender | null {
	if (!byGender) return null;
	const candidates: Array<{ gender: AtlasGender; accuracy: number; reps: number }> = [];
	for (const g of ["masc", "fem", "neut"] as const) {
		const t = byGender[g];
		if (t && t.reps >= minReps) {
			const acc = t.right / t.reps;
			if (acc < threshold) candidates.push({ gender: g, accuracy: acc, reps: t.reps });
		}
	}
	if (candidates.length === 0) return null;
	return candidates.sort((a, b) => a.accuracy - b.accuracy || b.reps - a.reps)[0]!.gender;
}

export function weakestAtlasCell(atlas: AtlasCell[], minReps = 3, threshold = 0.7): AtlasCell | null {
	const candidates = atlas.filter((c) => c.unit && c.accuracy !== null && c.reps >= minReps && c.accuracy < threshold);
	if (candidates.length === 0) return null;
	return candidates.sort((a, b) => a.accuracy! - b.accuracy! || b.reps - a.reps)[0]!;
}
