/**
 * Check a hand-written course (curriculum/<id>/course.json) against an added
 * language's lexicon: what checkCourse keeps and drops, how many Tatoeba
 * sentences each grammar lesson draws, and a few of them with the blank.
 *
 *   LH_DATA_DIR=<data> npx tsx scripts/check-course.ts estonian [samples]
 */

import fs from "node:fs";
import path from "node:path";
import { curriculumFile, PATHS } from "../config.ts";
import {
	checkCourse,
	courseUnitsFor,
	formCaseCell,
	unitCaseCells,
	type Course,
	type CourseUnit,
} from "../src/core/course.ts";
import { SPEAK_SCENES } from "../src/core/speak.ts";
import type { LexiconEntry } from "../src/core/review.ts";

const id = process.argv[2];
const samples = Number(process.argv[3] ?? 3);
if (!id) {
	console.error("Name an added language, e.g. estonian");
	process.exit(1);
}
const lexicon: LexiconEntry[] = JSON.parse(
	fs.readFileSync(path.join(PATHS.languages, id, "lexicon.json"), "utf-8"),
).words;
const raw = JSON.parse(fs.readFileSync(curriculumFile(id, "course.json"), "utf-8")) as Course;
const tag = raw.tag;
const checked = checkCourse(
	raw,
	id,
	lexicon,
	tag,
	SPEAK_SCENES.map((s) => s.id),
);
if (!checked) {
	console.log("REFUSED: fewer than three chapters or three grammar lessons survive");
	process.exit(1);
}
for (const d of checked.dropped) console.log(`DROPPED ${d}`);

const kept = new Set(checked.course.units.map((u) => u.id));
for (const u of raw.units) if (!kept.has(u.id)) console.log(`NOT KEPT ${u.id}`);
const placed = new Set(raw.chapters.flatMap((c) => c.units));
for (const x of [...raw.units, ...raw.tutors, ...raw.goals])
	if (!placed.has(x.id)) console.log(`IN NO CHAPTER ${x.id}`);

for (const unit of checked.course.units.filter((u): u is CourseUnit => u.kind === "grammar")) {
	const hits: string[] = [];
	const cells = new Map<string, number>();
	for (const e of lexicon) {
		for (const ex of e.examples) {
			if (ex.rejected || !courseUnitsFor([unit], e, ex, tag).length) continue;
			const text = ex.text ?? ex.sk ?? "";
			const c = ex.cloze!;
			hits.push(`${text.slice(0, c.at)}[${c.answer}]${text.slice(c.at + c.answer.length)}  (${e.lemma})`);
			const cell = formCaseCell(unit, e, c.answer, tag);
			if (cell) cells.set(cell, (cells.get(cell) ?? 0) + 1);
		}
	}
	const byCell = unitCaseCells(unit).length > 1 ? `  cells: ${[...cells].map(([k, n]) => `${k} ${n}`).join(", ")}` : "";
	console.log(`\n${hits.length < 12 ? "THIN " : ""}${unit.id}: ${hits.length} sentences${byCell}`);
	const step = Math.max(1, Math.floor(hits.length / Math.max(1, samples)));
	for (let i = 0; i < hits.length && i / step < samples; i += step) console.log(`   ${hits[i]}`);
}
