/**
 * THE TEST FENCE (LangHarness, 2026-10-29): in any test run, however it was
 * launched, data goes to a throwaway folder and never to the learner's
 * real data/. It used to key on NODE_ENV=test alone, which `npm test` cannot
 * set on Windows, so bare `tsx --test` runs wrote fixtures, a goal, unit
 * records and log entries into the real profile. Node's test runner marks
 * every test process with NODE_TEST_CONTEXT; each case below is a fresh
 * child process, because the seam is evaluated at module load.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const TSX_LOADER = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "loader.mjs");
const made: string[] = [];
after(() => {
	for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** Where config.ts puts the data in a fresh process with exactly this environment. */
function baseIn(extra: Record<string, string>): { base: string; pid: number } {
	const env: Record<string, string | undefined> = { ...process.env, LH_PROFILE: "" };
	for (const k of ["NODE_ENV", "NODE_TEST_CONTEXT", "LH_DATA_DIR"]) delete env[k];
	Object.assign(env, extra);
	const loaderArgs = process.versions.bun ? [] : ["--import", pathToFileURL(TSX_LOADER).href];
	const out = execFileSync(
		process.execPath,
		[
			...loaderArgs,
			"--eval",
			`const m = await import(${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "config.ts")).href)}); console.log(JSON.stringify({ base: m.PATHS.base, pid: process.pid }));`,
		],
		{ cwd: REPO_ROOT, encoding: "utf-8", env: env as NodeJS.ProcessEnv },
	);
	const parsed = JSON.parse(out) as { base: string; pid: number };
	if (parsed.base.startsWith(os.tmpdir())) made.push(parsed.base);
	return parsed;
}

const insideRepoData = (p: string) => !path.relative(path.join(REPO_ROOT, "data"), p).startsWith("..");

describe("the test fence holds however the suite is launched", () => {
	it("a bare `tsx --test` / `node --test` run (only the runner's marker, no NODE_ENV) is fenced", () => {
		const { base, pid } = baseIn({ NODE_TEST_CONTEXT: "child-v8" });
		assert.equal(base, path.join(os.tmpdir(), `lh-test-data-${pid}`));
		assert.ok(!insideRepoData(base), "not the real data/");
	});

	it("the old way, NODE_ENV=test, still is", () => {
		const { base, pid } = baseIn({ NODE_ENV: "test" });
		assert.equal(base, path.join(os.tmpdir(), `lh-test-data-${pid}`));
	});

	it("an explicit LH_DATA_DIR still wins, so tests that set their own folder keep it", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-fence-own-"));
		made.push(dir);
		assert.equal(baseIn({ NODE_TEST_CONTEXT: "child-v8", LH_DATA_DIR: dir }).base, dir);
	});

	it("outside a test run nothing changes: the repo's own data/", () => {
		assert.equal(baseIn({}).base, path.join(REPO_ROOT, "data"));
	});
});
