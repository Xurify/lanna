/**
 * The LH_DATA_DIR seam (Electron contract, 2026-09-17): when set, every
 * mutable record relocates under it; when unset, byte-for-byte the old
 * repo-data/ behavior. The desktop shell's whole data story rests on this,
 * so pin both directions.
 *
 * The seam is evaluated at MODULE LOAD, so the "set" case must set the env
 * BEFORE the first import of config.ts in this process (dynamic import,
 * below) and the "unset" case needs a fresh child process.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const TSX_LOADER = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "loader.mjs");

describe("LH_DATA_DIR seam", () => {
	it("relocates data/chats/graph under LH_DATA_DIR, keeps prompts ROOT-anchored", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-seam-"));
		process.env.LH_DATA_DIR = dir;
		try {
			const { PATHS, ROOT, ACTIVE_PROFILE, SETTINGS_FILE } = await import("../config.ts");
			// LangHarness: records live under the active language profile;
			// settings stay shared at the data root.
			const profileDir = path.join(dir, "profiles", ACTIVE_PROFILE);
			assert.equal(PATHS.base, dir, "PATHS.base resolves the env value (resolved absolute)");
			assert.equal(PATHS.data, profileDir);
			assert.equal(PATHS.chats, path.join(profileDir, "chats"));
			assert.equal(PATHS.graph, path.join(profileDir, "graph"));
			assert.equal(SETTINGS_FILE, path.join(dir, "settings.json"));
			assert.equal(
				PATHS.teacherPrompt,
				path.join(ROOT, "src", "agent", "system-prompt.md"),
				"read-only prompt assets stay bundle-anchored on purpose",
			);
		} finally {
			delete process.env.LH_DATA_DIR;
		}
	});

	it("unset = the repo data/ exactly as before (fresh child process, no env)", () => {
		// NODE_ENV "production" rather than the runner's "test", and no
		// NODE_TEST_CONTEXT (the runner's own marker, inherited through the
		// spread): under either config.ts fences data into a temp folder (the
		// test fence, 2026-10-28, widened 2026-10-29); this child simulates
		// the packaged app.
		const env: Record<string, string | undefined> = { ...process.env, LH_DATA_DIR: "", LH_PROFILE: "", NODE_ENV: "production" };
		delete env.NODE_TEST_CONTEXT;
		const out = execFileSync(
			process.execPath,
			["--import", pathToFileURL(TSX_LOADER).href, "--eval", `const m = await import(${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "config.ts")).href)}); console.log(JSON.stringify({ data: m.PATHS.data, chats: m.PATHS.chats }));`],
			{ cwd: REPO_ROOT, encoding: "utf-8", env: env as NodeJS.ProcessEnv },
		);
		const parsed = JSON.parse(out) as { data: string; chats: string | null };
		assert.equal(parsed.data, path.join(REPO_ROOT, "data", "profiles", "slovak"));
		assert.equal(parsed.chats, path.join(REPO_ROOT, "data", "profiles", "slovak", "chats"));
	});
});