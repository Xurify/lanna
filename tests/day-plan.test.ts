/**
 * THE DAY ACROSS LANGUAGES (2026-11-05): every language in the list with its
 * own plan for today, read by borrowing the language without switching, and
 * the split of the day written as each language's minutes a day.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import type { Course } from "../src/core/course.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-day-plan-"));
process.env.LANNA_DATA_DIR = dir;
delete process.env.LANNA_PROFILE;

const COURSE: Course = {
	language: "czech",
	code: "cs",
	tag: "cs-CZ",
	version: 1,
	draft: true,
	units: [
		{
			id: "acc",
			kind: "grammar",
			title: "Objects",
			tagline: "What you have",
			rule: "The object takes the accusative: Piju kávu.",
			glyph: "coffee",
			grammarTerm: "Accusative case",
			cat: "Nouns",
			tags: ["accusative", "singular"],
		},
		{
			id: "loc",
			kind: "grammar",
			title: "Where? v, na",
			tagline: "The locative",
			rule: "After v and na for a place, the locative.",
			glyph: "map-pin",
			grammarTerm: "Locative case",
			cat: "Nouns",
			tags: ["locative", "singular"],
			after: ["v", "na"],
		},
	],
	tutors: [],
	goals: [{ id: "can-order", title: "Can order", tagline: "In a café", scene: "cafe" }],
	chapters: [
		{ id: "cafe", stage: "a1", title: "At the café", tagline: "Objects", units: ["acc", "can-order"] },
		{ id: "town", stage: "a2", title: "In town", tagline: "Places", units: ["loc"] },
	],
};
const czech = path.join(dir, "languages", "czech");
fs.mkdirSync(czech, { recursive: true });
fs.writeFileSync(path.join(czech, "course.json"), JSON.stringify(COURSE));
fs.writeFileSync(
	path.join(czech, "language.json"),
	JSON.stringify({ id: "czech", tag: "cs-CZ", code: "cs", endonym: "Čeština", english: "Czech" }),
);

const config = await import("../config.ts");
const { languageDay, setLanguageMinutes } = await import("../src/server/day-plan.ts");
const { setGoal } = await import("../src/server/lesson.ts");
const { minutesFromShares, sharesFromMinutes } = await import("../src/core/day-plan.ts");

describe("splitting the day", () => {
	test("shares come out whole and add up to 100", () => {
		assert.deepEqual(
			sharesFromMinutes([
				{ id: "a", minutes: 60 },
				{ id: "b", minutes: 30 },
				{ id: "c", minutes: 30 },
			]),
			{ a: 50, b: 25, c: 25 },
		);
		const thirds = sharesFromMinutes([
			{ id: "a", minutes: 10 },
			{ id: "b", minutes: 10 },
			{ id: "c", minutes: 10 },
		]);
		assert.equal(
			Object.values(thirds).reduce((n, v) => n + v, 0),
			100,
		);
	});

	test("minutes follow the shares, each language keeps a floor, and shares need not add up to 100", () => {
		assert.deepEqual(minutesFromShares(120, { slovak: 45, russian: 35, estonian: 20 }), {
			slovak: 54,
			russian: 42,
			estonian: 24,
		});
		assert.deepEqual(minutesFromShares(20, { a: 95, b: 5 }), { a: 19, b: 5 });
		assert.deepEqual(minutesFromShares(100, { a: 60, b: 60 }), { a: 50, b: 50 });
	});
});

describe("the day across languages", () => {
	test("a language not set up yet has no plan, only its setup", () => {
		const day = languageDay();
		assert.deepEqual(day.languages.map((l) => l.id).sort(), ["czech", "slovak"]);
		assert.ok(day.languages.every((l) => !l.setUp && l.tasks.length === 0));
	});

	test("each language's plan is its own, read without switching, largest share first", () => {
		setGoal({ minutesPerDay: 60, onboarded: true });
		config.withProfile("czech", () => setGoal({ minutesPerDay: 30, onboarded: true }));
		const day = languageDay();
		assert.deepEqual(
			day.languages.map((l) => [l.id, l.minutes, l.running]),
			[
				["slovak", 60, true],
				["czech", 30, false],
			],
		);
		assert.equal(day.minutes, 90);
		const cz = day.languages.find((l) => l.id === "czech")!;
		assert.ok(cz.setUp && cz.tasks.some((t) => t.id === "lesson"), "the Czech plan has a lesson");
		assert.equal(config.activeProfile(), "slovak", "nothing switched");
		assert.equal((globalThis as Record<string, unknown>).__lhCourse, undefined, "the Slovak course is running again");
		assert.ok(
			fs.existsSync(path.join(dir, "profiles", "czech", "progress.json")),
			"the Czech plan was kept in the Czech folder",
		);
	});

	test("splitting the day writes each language's minutes a day", () => {
		const day = setLanguageMinutes({ slovak: 45, czech: 75, klingon: 10 });
		assert.deepEqual(
			day.languages.map((l) => [l.id, l.minutes]),
			[
				["czech", 75],
				["slovak", 45],
			],
		);
		assert.equal(
			config.withProfile(
				"czech",
				() => JSON.parse(fs.readFileSync(path.join(config.PATHS.data, "progress.json"), "utf-8")).goal.minutesPerDay,
			),
			75,
		);
	});
});
