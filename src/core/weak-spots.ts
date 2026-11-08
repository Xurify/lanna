/**
 * Weak spots (LangHarness, 2026-10-28) — the units the learner has shown
 * they struggle with, kept as a record of their own so the app can say
 * "you struggle with the accusative" and act on it, instead of letting
 * that fact sink into an accuracy figure.
 *
 * A spot is flagged by the level check (a miss on a unit, the tutor's
 * slip/gap verdict), by lessons (a unit under the strengthen bar after
 * enough reps) or by the review deck (a card on a form that keeps
 * lapsing). From then on every rep on that unit tallies against it, and
 * it is mended, and dropped, once enough reps since the flag come back
 * mostly right. The record lives in progress.json (`weak`), and feeds:
 * the Today page and the map (a line per spot), the tutor's "This
 * learner" block (so Speak, Why? and lessons target it) and the daily
 * plan's Strengthen task (a weak spot first, lesson accuracy second).
 *
 * Browser-safe: pure functions over plain records.
 */

import { unitInfo, allUnits, type UnitId } from "./lesson.ts";

export type WeakSource = "check" | "lesson" | "review";

export interface WeakSpot {
	/** When it was first flagged. */
	since: string;
	/** What flagged it. */
	source: WeakSource;
	/** The evidence in words: the tutor's verdict, the judge's note, the
	 *  lesson figure, the card that keeps lapsing. */
	note?: string;
	/** Reps on the unit since the flag. */
	hits: number;
	misses: number;
	lastAt: string;
}

export type WeakRecord = Record<string, WeakSpot>;

/** Reps since the flag before a spot can be called mended … */
export const WEAK_MEND_REPS = 8;
/** … and the share of them that must be right. */
export const WEAK_MEND_ACCURACY = 0.85;
/** Lessons flag a unit once it has this many reps under this accuracy. */
const WEAK_LESSON_REPS = 6;
const WEAK_LESSON_ACCURACY = 0.85;
/** A review card flags its unit from this many lapses. */
export const WEAK_REVIEW_LAPSES = 2;

/** Units that are one struggle seen from two sides: the accusative missed
 *  on a feminine noun and on a person is "the accusative by noun class",
 *  not two unrelated misses. Shown and told as one spot. */
export const WEAK_FAMILIES: ReadonlyArray<{ id: string; title: string; tagline: string; units: readonly UnitId[] }> = [
	{ id: "accusative", title: "The accusative by noun class", tagline: "feminine -a → -u, people +a, things unchanged", units: ["acc-fem", "acc-people", "kam-kde"] },
	{ id: "adjectives", title: "Adjective endings", tagline: "agree with the noun, in every case", units: ["adj", "adj-cases"] },
	{ id: "present", title: "Present-tense endings", tagline: "-ám/-ím, -ujem, -em, and the irregulars", units: ["present", "present-ujem", "present-em", "core-verbs"] },
];

export function weakFamily(unit: UnitId): (typeof WEAK_FAMILIES)[number] | undefined {
	return WEAK_FAMILIES.find((f) => f.units.includes(unit));
}

const SOURCE_LABEL: Record<WeakSource, string> = { check: "from the level check", lesson: "from your lessons", review: "from review" };

function isUnit(id: string): id is UnitId {
	return allUnits().some((u) => u.id === id);
}

/** Flag a unit. An existing spot keeps its first date and its tally; a
 *  note from the check replaces an older one (it is the freshest reading),
 *  any other note fills in only when there was none. */
export function flagWeak(weak: WeakRecord, unit: string, source: WeakSource, note: string | undefined, now: Date): WeakRecord {
	if (!isUnit(unit)) return weak;
	const at = now.toISOString();
	const prev = weak[unit];
	const clean = note?.trim().replace(/[.\s]+$/u, "") || undefined;
	const spot: WeakSpot = prev
		? { ...prev, lastAt: at, ...(source === "check" ? { source, note: clean ?? prev.note, hits: 0, misses: 0 } : { note: prev.note ?? clean }) }
		: { since: at, source, ...(clean ? { note: clean } : {}), hits: 0, misses: 0, lastAt: at };
	return { ...weak, [unit]: spot };
}

/** Clear a unit: the check held it, or it was mended. */
export function clearWeak(weak: WeakRecord, unit: string): WeakRecord {
	if (!(unit in weak)) return weak;
	const { [unit]: _gone, ...rest } = weak;
	return rest;
}

/** Count reps on a unit against its spot; a spot that has earned it is
 *  dropped. Returns the record and whether the unit was just mended. */
export function tallyWeak(weak: WeakRecord, unit: string, hits: number, misses: number, now: Date): { weak: WeakRecord; mended: boolean } {
	const spot = weak[unit];
	if (!spot) return { weak, mended: false };
	const next: WeakSpot = { ...spot, hits: spot.hits + hits, misses: spot.misses + misses, lastAt: now.toISOString() };
	const reps = next.hits + next.misses;
	if (reps >= WEAK_MEND_REPS && next.hits / reps >= WEAK_MEND_ACCURACY) return { weak: clearWeak(weak, unit), mended: true };
	return { weak: { ...weak, [unit]: next }, mended: false };
}

/** The lesson rule: a unit with enough reps under the bar is a weak spot
 *  even when nothing else flagged it. */
export function lessonFlagsWeak(reps: number, correct: number): boolean {
	return reps >= WEAK_LESSON_REPS && correct / reps < WEAK_LESSON_ACCURACY;
}

export interface WeakSpotSummary {
	unit: UnitId;
	title: string;
	/** The grammar in one phrase, for the map and the tutor. */
	tagline: string;
	source: WeakSource;
	since: string;
	note?: string;
	hits: number;
	misses: number;
	/** One line for the UI: where it came from, and the evidence. */
	line: string;
}

/** The spots in order of urgency: a gap from the check first, then the
 *  most-missed since the flag, then the oldest. */
export function weakSpotList(weak: WeakRecord | undefined): WeakSpotSummary[] {
	if (!weak) return [];
	const out: WeakSpotSummary[] = [];
	for (const [unit, s] of Object.entries(weak)) {
		if (!isUnit(unit)) continue;
		const info = unitInfo(unit);
		const since = s.hits + s.misses > 0 ? ` · since then ${s.hits}/${s.hits + s.misses} right` : "";
		out.push({ unit, title: info.title, tagline: info.tagline, source: s.source, since: s.since, ...(s.note ? { note: s.note } : {}), hits: s.hits, misses: s.misses, line: `${SOURCE_LABEL[s.source]}${s.note ? `: ${s.note}` : ""}${since}` });
	}
	const order: Record<WeakSource, number> = { check: 0, review: 1, lesson: 2 };
	return out.sort((a, b) => order[a.source] - order[b.source] || b.misses - a.misses || a.since.localeCompare(b.since));
}

/** One row per struggle: spots in the same family fold into one entry
 *  (its title, its members' evidence), the rest stand alone. */
interface WeakSpotGroup {
	id: string;
	title: string;
	tagline: string;
	/** The units in it, most urgent first. */
	spots: WeakSpotSummary[];
	/** The first unit: what Strengthen opens. */
	unit: UnitId;
	line: string;
}

export function weakSpotGroups(list: readonly WeakSpotSummary[]): WeakSpotGroup[] {
	const out: WeakSpotGroup[] = [];
	const seen = new Set<string>();
	for (const w of list) {
		const fam = weakFamily(w.unit);
		const members = fam ? list.filter((x) => fam.units.includes(x.unit)) : [w];
		if (fam && members.length > 1) {
			if (seen.has(fam.id)) continue;
			seen.add(fam.id);
			out.push({ id: fam.id, title: fam.title, tagline: fam.tagline, spots: members, unit: members[0]!.unit, line: members.map((m) => `${m.title}: ${m.line}`).join(" · ") });
		} else out.push({ id: w.unit, title: w.title, tagline: w.tagline, spots: [w], unit: w.unit, line: w.line });
	}
	return out;
}

/** The line in the tutor's "This learner" block. */
export function weakSpotsLine(list: readonly WeakSpotSummary[]): string | null {
	if (!list.length) return null;
	const parts = weakSpotGroups(list).slice(0, 6).map((g) => (g.spots.length > 1 ? `${g.title} (${g.tagline}; ${g.spots.map((m) => `${m.title}: ${m.line}`).join("; ")})` : `${g.title} (${g.tagline}; ${g.line})`));
	return `- Weak spots on record: ${parts.join("; ")}. Work these into examples and corrections; a spot is cleared once ${WEAK_MEND_REPS} reps since the flag come back ${Math.round(WEAK_MEND_ACCURACY * 100)}% right.`;
}
