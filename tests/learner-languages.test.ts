/**
 * WHAT THE LEARNER KNOWS IS THE LEARNER'S (2026-11-05): the languages they
 * know, their levels and the explanation languages are kept once for every
 * language, and the tutor hears which other languages they study here.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-learner-languages-"));
process.env.LH_DATA_DIR = dir;
delete process.env.LH_PROFILE;

const czech = path.join(dir, "languages", "czech");
fs.mkdirSync(czech, { recursive: true });
fs.writeFileSync(
	path.join(czech, "course.json"),
	JSON.stringify({
		language: "czech",
		code: "cs",
		tag: "cs-CZ",
		version: 1,
		units: [
			{
				id: "acc",
				kind: "grammar",
				title: "Objects",
				tagline: "What you have",
				rule: "The accusative.",
				glyph: "coffee",
				cat: "Nouns",
				tags: ["accusative", "singular"],
			},
		],
		tutors: [],
		goals: [],
		chapters: [{ id: "cafe", stage: "a1", title: "At the café", tagline: "Objects", units: ["acc"] }],
	}),
);
fs.writeFileSync(
	path.join(czech, "language.json"),
	JSON.stringify({ id: "czech", tag: "cs-CZ", code: "cs", endonym: "Čeština", english: "Czech" }),
);
// A Slovak profile set up before the fields were shared: its languages are the learner's.
fs.mkdirSync(path.join(dir, "profiles", "slovak"), { recursive: true });
fs.writeFileSync(
	path.join(dir, "profiles", "slovak", "progress.json"),
	JSON.stringify({
		xp: 0,
		days: {},
		units: {},
		goal: {
			level: "B1",
			minutesPerDay: 60,
			languages: ["en", "cs", "et"],
			languageLevels: { en: "native", cs: "A1", et: "A2" },
			explainIn: ["en", "et"],
			onboardedAt: "2026-10-30T00:00:00Z",
		},
	}),
);

const config = await import("../config.ts");
const { progressStore } = await import("../src/store/progress.ts");
const { progressSummary, setGoal } = await import("../src/server/lesson.ts");
const { learnerProfileSegment } = await import("../src/agent/learner-profile.ts");
const { studiedLine } = await import("../src/core/onboarding.ts");

const learnerFile = path.join(dir, "learner.json");

describe("the learner's languages, once for every language", () => {
	test("an older profile hands its languages to the shared copy", () => {
		const goal = progressStore.read().goal!;
		assert.deepEqual(goal.languages, ["en", "cs", "et"]);
		assert.ok(fs.existsSync(learnerFile));
		assert.deepEqual(JSON.parse(fs.readFileSync(learnerFile, "utf-8")).languageLevels, {
			en: "native",
			cs: "A1",
			et: "A2",
		});
	});

	test("a new language starts from them, and its fresh goal does not wipe them", () => {
		const fresh = config.withProfile("czech", () => progressSummary().goal);
		assert.deepEqual(fresh.languages, ["en", "cs", "et"], "setup is prefilled");
		config.withProfile("czech", () => setGoal({ minutesPerDay: 20 }));
		assert.deepEqual(JSON.parse(fs.readFileSync(learnerFile, "utf-8")).languages, ["en", "cs", "et"]);
		const raw = JSON.parse(fs.readFileSync(path.join(dir, "profiles", "czech", "progress.json"), "utf-8"));
		assert.equal(raw.goal.languages, undefined, "a language's own file does not keep a copy");
	});

	test("a list saved in one language reaches the others, and keeps the running language it cannot show", () => {
		// The Czech picker leaves Czech out; the shared list keeps it for Slovak.
		config.withProfile("czech", () =>
			setGoal({ languages: ["en", "et", "sk"], languageLevels: { en: "native", et: "B1", sk: "B1" }, onboarded: true }),
		);
		const slovak = progressStore.read().goal!;
		assert.deepEqual(slovak.languages, ["en", "et", "sk", "cs"]);
		assert.deepEqual(slovak.languageLevels, { en: "native", et: "B1", sk: "B1", cs: "A1" });
	});

	test("the tutor hears the other languages studied here, and never explains a language in itself", () => {
		const text = learnerProfileSegment()!;
		assert.ok(text.includes("Also studying in this app: Czech (working at A1 on its map, aiming at B2)"), text);
		const cz = config.withProfile("czech", () => learnerProfileSegment()!);
		assert.ok(cz.includes("Also studying in this app: Slovak (working at A1 on its map, aiming at B1)"), cz);
		assert.ok(cz.includes("Slovak (B1 on the CEFR)"), cz);
	});

	test("a language not set up yet is named as such", () => {
		assert.equal(studiedLine([]), null);
		assert.ok(studiedLine([{ english: "Estonian" }])!.includes("Estonian (just added, not set up yet)"));
	});
});
