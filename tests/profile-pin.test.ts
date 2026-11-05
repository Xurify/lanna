/**
 * The running language is process state, switched in place. `next dev`
 * evaluates config.ts more than once in one process, so every copy of the
 * module must read and switch the same language (2026-11-01: one server ran
 * two languages at once). A query string makes Node evaluate the module
 * again, which is what a route compile or HMR does.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-profile-pin-"));
process.env.LH_DATA_DIR = dir;
delete process.env.LH_PROFILE;
const added = path.join(dir, "languages", "czech");
fs.mkdirSync(added, { recursive: true });
fs.writeFileSync(path.join(added, "language.json"), JSON.stringify({ id: "czech", tag: "cs-CZ", code: "cs", endonym: "Čeština", english: "Czech" }));
const czechCourse = { language: "czech", code: "cs", tag: "cs-CZ", units: [], tutors: [], goals: [], chapters: [] };
fs.writeFileSync(path.join(added, "course.json"), JSON.stringify(czechCourse));

type Config = typeof import("../config.ts");
const load = async (tag: string) => (await import(new URL(`../config.ts?${tag}`, import.meta.url).href)) as Config;
const course = () => (globalThis as Record<string, unknown>).__lhCourse as { language?: string } | undefined;

describe("the running language", () => {
	it("boots from profile.json, and every copy of config agrees on a switch", async () => {
		fs.writeFileSync(path.join(dir, "profile.json"), JSON.stringify({ active: "slovak" }));
		const first = await load("first");
		assert.equal(first.activeProfile(), "slovak");
		assert.equal(course(), undefined, "Slovak runs the hand-written course");

		fs.writeFileSync(path.join(dir, "profile.json"), JSON.stringify({ active: "czech" }));
		const again = await load("again");
		assert.equal(again.activeProfile(), "slovak", "a file saved after boot does not split the process");

		first.switchProfile("czech");
		assert.equal(again.activeProfile(), "czech");
		assert.equal(again.PATHS.data, path.join(dir, "profiles", "czech"), "the paths follow the switch");
		assert.equal(again.PATHS.review, path.join(dir, "profiles", "czech", "review"));
		assert.equal(course()?.language, "czech", "the course follows the switch");
		assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "profile.json"), "utf-8")).active, "czech", "the next start runs it too");

		again.switchProfile("slovak");
		assert.equal(first.activeProfile(), "slovak");
		assert.equal(course(), undefined);
	});

	it("borrows another language for a synchronous read and gives it back", async () => {
		const config = await load("borrow");
		const seen = config.withProfile("czech", () => ({ profile: config.activeProfile(), data: config.PATHS.data, course: course()?.language }));
		assert.deepEqual(seen, { profile: "czech", data: path.join(dir, "profiles", "czech"), course: "czech" });
		assert.equal(config.activeProfile(), "slovak");
		assert.equal(course(), undefined);
		assert.throws(
			() =>
				config.withProfile("czech", () => {
					throw new Error("boom");
				}),
			/boom/,
		);
		assert.equal(config.activeProfile(), "slovak", "an error still gives it back");
	});

	it("refuses a language that is not in the list", async () => {
		const config = await load("refuse");
		assert.throws(() => config.switchProfile("klingon"), /not one of your languages/);
		assert.equal(config.activeProfile(), "slovak");
	});

	it("reports the running language and switches through the server", async () => {
		const { profileStatus, selectProfile } = await import("../src/server/language.ts");
		assert.equal(profileStatus().active, "slovak");
		assert.equal(selectProfile("czech").active, "czech");
		assert.equal(selectProfile("slovak").active, "slovak");
	});
});
