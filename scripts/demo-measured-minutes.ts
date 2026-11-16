/**
 * Demo data for measured minutes (2026-10-29).
 *
 *   LANNA_DATA_DIR=<an empty folder> tsx scripts/demo-measured-minutes.ts
 *
 * Seeds one week into that folder's Slovak profile: three older days that
 * only have counts (how every day was recorded before minutes were
 * measured) and three newer days with minutes measured per activity, then
 * prints the same week counted both ways. Start the app against the same
 * folder (LANNA_DATA_DIR=<folder> npm run dev) to try the live behavior.
 *
 * `npm run dev:sandbox -- --seed` does both steps in a throwaway folder.
 *
 * Refuses to run without LANNA_DATA_DIR, and refuses a folder that already has
 * any profile data in it, so it can never overwrite your own days.
 */

import fs from "node:fs";
import path from "node:path";

/** Every file under `dir`, so a folder with anything in it is not empty. */
function hasFiles(dir: string): boolean {
	if (!fs.existsSync(dir)) return false;
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.some((e) => (e.isDirectory() ? hasFiles(path.join(dir, e.name)) : true));
}

const dir = process.env.LANNA_DATA_DIR;
if (!dir) {
	console.error(
		"Set LANNA_DATA_DIR to an empty folder first: this script writes a demo profile and must not touch your real data.",
	);
	process.exit(1);
}
if (hasFiles(path.join(dir, "profiles"))) {
	console.error(
		`${dir} already has profile data. This script only seeds an empty folder; it would replace the days in it. Use a new folder (npm run dev:sandbox -- --seed makes one).`,
	);
	process.exit(1);
}
process.env.LANNA_PROFILE = "slovak";

const { dayKey } = await import("../src/core/review.ts");
const { STRANDS, strandBalance, strandCaption } = await import("../src/core/strands.ts");
const { setGoal } = await import("../src/server/lesson.ts");
const { progressStore } = await import("../src/store/progress.ts");
type DayRecord = import("../src/store/progress.ts").DayRecord;

const tz = new Date().getTimezoneOffset();
const dayAgo = (n: number) => dayKey(new Date(Date.now() - n * 86_400_000), tz);

const round = (n: number) => Math.round(n * 10) / 10;
const measured = (day: Omit<DayRecord, "minutes"> & { minutesBy: NonNullable<DayRecord["minutesBy"]> }): DayRecord => ({
	...day,
	minutes: round(Object.values(day.minutesBy).reduce((a, b) => a + (b ?? 0), 0)),
});

const days: Record<string, DayRecord> = {
	// Before minutes were measured: counts, and one wall-clock total.
	[dayAgo(6)]: { xp: 120, lessons: 2, reps: 24, reviews: 20, minutes: 21 },
	[dayAgo(5)]: { xp: 90, lessons: 1, reps: 12, reviews: 31, listens: 1, minutes: 17 },
	[dayAgo(4)]: { xp: 60, lessons: 1, reps: 12, reviews: 12, blitz: 1, minutes: 9 },
	// Measured while the learner was active.
	[dayAgo(3)]: measured({
		xp: 140,
		lessons: 2,
		reps: 24,
		reviews: 24,
		listens: 1,
		minutesBy: { lesson: 11.4, review: 4.2, listen: 3.1 },
	}),
	[dayAgo(2)]: measured({
		xp: 150,
		lessons: 1,
		reps: 12,
		reviews: 0,
		watches: 1,
		speaks: 1,
		blitz: 1,
		talks: 1,
		minutesBy: { lesson: 7.2, watch: 9.5, speak: 6.8, blitz: 1 },
	}),
	[dayAgo(1)]: measured({
		xp: 110,
		lessons: 0,
		reps: 0,
		reviews: 18,
		reads: 1,
		fasts: 1,
		minutesBy: { review: 3.1, read: 5.3, fast: 2.6 },
	}),
};

fs.mkdirSync(path.join(dir, "profiles", "slovak"), { recursive: true });
setGoal({ level: "B2", minutesPerDay: 30, daysPerWeek: 5, onboarded: true }, tz);
const p = progressStore.read();
progressStore.write({ ...p, xp: Object.values(days).reduce((n, d) => n + d.xp, 0), days });

const stripped = Object.values(days).map(({ minutesBy: _unused, ...rest }) => rest);
const before = strandBalance(stripped);
const after = strandBalance(Object.values(days));

const pad = (s: string, n: number) => s.padEnd(n);
console.log(`\nDemo profile written to ${dir}\n`);
console.log(`${pad("Strand", 16)}${pad("Estimated (old)", 20)}Measured (new)`);
for (const s of STRANDS) {
	const a = `${before.minutes[s.id]} min · ${Math.round(before.share[s.id] * 100)}%`;
	const b = `${after.minutes[s.id]} min · ${Math.round(after.share[s.id] * 100)}%`;
	console.log(`${pad(s.title, 16)}${pad(a, 20)}${b}`);
}
console.log(`${pad("Total", 16)}${pad(`${before.total} min`, 20)}${after.total} min`);
console.log(`\nCaption now: ${strandCaption(after)}\n`);
