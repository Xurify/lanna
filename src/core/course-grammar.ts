import { CASE_NUMBERS, CASE_TAGS, unitCaseCells, type CaseNumber, type Course, type CourseCase } from "./course.ts";
import type { FirstTally, FirstTryStats } from "./first-try.ts";
import type { FormSlip } from "./form-slip.ts";

export interface CaseTableCell {
	case: string;
	number: CaseNumber;
	unit: string | null;
	noDrill: { short: string; why: string } | null;
	tutor: { id: string; title: string } | null;
	accuracy: number | null;
	reps: number;
	right: number;
	accents: number;
	slips: Partial<Record<FormSlip, number>>;
}

export interface CaseTableRow {
	tag: string;
	native: string;
	means: string;
	cells: CaseTableCell[];
}

const NO_LESSON_YET = { short: "no lesson yet", why: "No lesson drills this form yet." };

function unitsInTeachingOrder(course: Course) {
	const ids = [...new Set([...course.chapters.flatMap((c) => c.units), ...course.units.map((u) => u.id)])];
	return ids.map((id) => course.units.find((u) => u.id === id)).filter((u) => !!u);
}

function caseRows(course: Course): CourseCase[] {
	if (course.cases?.length) return course.cases;
	const drilled = new Set(course.units.flatMap((u) => unitCaseCells(u)).map((cell) => cell.split(" ")[0]!));
	return CASE_TAGS.filter((t) => drilled.has(t)).map((tag) => ({ tag, native: "", means: "" }));
}

function sumTallies(tallies: ReadonlyArray<FirstTally | undefined>): FirstTally | undefined {
	const present = tallies.filter((t): t is FirstTally => !!t);
	if (present.length === 0) return undefined;
	const slips: Partial<Record<FormSlip, number>> = {};
	for (const t of present)
		for (const [k, n] of Object.entries(t.slips) as Array<[FormSlip, number]>) slips[k] = (slips[k] ?? 0) + n;
	return {
		reps: present.reduce((n, t) => n + t.reps, 0),
		right: present.reduce((n, t) => n + t.right, 0),
		accents: present.reduce((n, t) => n + t.accents, 0),
		slips,
	};
}

export function caseTable(course: Course, stats: Readonly<Record<string, FirstTryStats | undefined>>): CaseTableRow[] {
	const units = unitsInTeachingOrder(course);
	const tutorTitles = new Map(course.tutors.map((t) => [t.id, t.title]));
	return caseRows(course).map((row) => ({
		tag: row.tag,
		native: row.native,
		means: row.means,
		cells: CASE_NUMBERS.map((number): CaseTableCell => {
			const key = `${row.tag} ${number}`;
			const covering = units
				.filter((u) => unitCaseCells(u).includes(key))
				.sort((x, y) => unitCaseCells(x).length - unitCaseCells(y).length);
			const unit = covering[0] ?? null;
			const tally = sumTallies(
				covering.map((u) => (unitCaseCells(u).length === 1 ? stats[u.id]?.first : stats[u.id]?.byForm?.[key])),
			);
			const tutorTitle = row.tutor ? tutorTitles.get(row.tutor) : undefined;
			return {
				case: row.tag,
				number,
				unit: unit?.id ?? null,
				noDrill: unit ? null : (row.noDrill?.[number] ?? NO_LESSON_YET),
				tutor: row.tutor && tutorTitle ? { id: row.tutor, title: tutorTitle } : null,
				accuracy: tally && tally.reps > 0 ? tally.right / tally.reps : null,
				reps: tally?.reps ?? 0,
				right: tally?.right ?? 0,
				accents: tally?.accents ?? 0,
				slips: tally?.slips ?? {},
			};
		}),
	}));
}
