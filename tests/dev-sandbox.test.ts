/**
 * SANDBOX PINS (LangHarness, 2026-10-29): a demo or an agent-driven run must
 * never reach the learner's real data, keys or port. The planning functions
 * of scripts/dev-sandbox.ts, and the demo seed's refusal to touch a folder
 * that already has data (run as the real script, in a subprocess).
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { assertSafeDataDir, explainFailure, freePort, planSandbox, REAL_PORT } from "../scripts/dev-sandbox.ts";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const made: string[] = [];
const scratch = (prefix: string) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	made.push(dir);
	return dir;
};
after(() => {
	for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

describe("planSandbox: data, keys and port of its own", () => {
	it("puts everything in a new folder outside the repo and hides the real keys", () => {
		const tmp = scratch("lh-sbx-tmp-");
		const plan = planSandbox({
			port: 4123,
			tmp,
			env: {
				LH_DATA_DIR: "C:/real/profile/data",
				LH_AUTH_FILE: "C:/real/auth.json",
				LH_DESKTOP_SERVER: "1",
				LH_DESKTOP_API_SECRET: "x".repeat(64),
				NODE_ENV: "test",
				OPENAI_API_KEY: "sk-real",
			},
		});
		made.push(plan.dir);
		assert.ok(plan.dir.startsWith(tmp), "under the temp folder");
		assert.ok(path.relative(ROOT, plan.dir).startsWith(".."), "outside the repo");
		assert.equal(plan.env.LH_DATA_DIR, plan.dir, "the caller's data folder is replaced, not kept");
		assert.equal(plan.env.LH_AUTH_FILE, path.join(plan.dir, "auth.json"), "keys file is inside the sandbox");
		assert.equal(plan.env.LH_IGNORE_ENV_KEYS, "1", "every key in the environment is hidden from the app");
		assert.equal(plan.env.PORT, "4123");
		assert.equal(plan.env.LH_DESKTOP_SERVER, undefined);
		assert.equal(plan.env.LH_DESKTOP_API_SECRET, undefined);
		assert.equal(plan.env.NODE_ENV, undefined);
		assert.deepEqual(fs.readdirSync(plan.dir), [], "starts empty");
	});

	it("is a different folder every time", () => {
		const tmp = scratch("lh-sbx-tmp-");
		const a = planSandbox({ port: 4001, tmp, env: {} });
		const b = planSandbox({ port: 4002, tmp, env: {} });
		made.push(a.dir, b.dir);
		assert.notEqual(a.dir, b.dir);
	});

	it("never takes the real dev server's port", () => {
		const tmp = scratch("lh-sbx-tmp-");
		assert.throws(() => planSandbox({ port: REAL_PORT, tmp, env: {} }), /3010/);
		assert.equal(REAL_PORT, 3010);
	});

	it("refuses a folder inside the repo, where the real data/ lives", () => {
		const root = scratch("lh-sbx-root-");
		const inside = path.join(root, "tmp");
		fs.mkdirSync(inside);
		assert.throws(() => planSandbox({ port: 4000, tmp: inside, root, env: {} }), /outside the repo/);
	});
});

describe("assertSafeDataDir", () => {
	it("refuses the repo, its data/ and anything inside it", () => {
		for (const bad of [
			ROOT,
			path.join(ROOT, "data"),
			path.join(ROOT, "data", "profiles", "slovak"),
			path.join(ROOT, ".fresh-data"),
		])
			assert.throws(() => assertSafeDataDir(bad, ROOT), /outside the repo/, bad);
	});
	it("accepts a folder elsewhere", () => {
		assert.doesNotThrow(() => assertSafeDataDir(path.join(os.tmpdir(), "lh-sandbox-x"), ROOT));
	});
});

describe("freePort", () => {
	it("hands back a port that can be bound at once, and not 3010", async () => {
		const port = await freePort();
		assert.ok(Number.isInteger(port) && port > 1023 && port < 65536);
		assert.notEqual(port, 3010);
		await new Promise<void>((resolve, reject) => {
			const s = net.createServer();
			s.once("error", reject);
			s.listen(port, "127.0.0.1", () => s.close(() => resolve()));
		});
	});
});

describe("explainFailure: Next locks the .next folder, so a second dev server cannot share a checkout", () => {
	it("explains the lock and gives the worktree recipe", () => {
		const text = explainFailure(
			"  Another next dev server is already running.\n",
			path.join(os.tmpdir(), "langharness"),
		);
		assert.ok(text);
		assert.match(text!, /already running from this checkout/);
		assert.match(text!, /git worktree add \.\.[\\/]langharness-sandbox/);
		assert.match(text!, /not touched/);
	});
	it("says nothing about any other output", () => {
		assert.equal(explainFailure("Ready in 500ms"), null);
	});
});

describe("the demo seed only fills an empty folder", () => {
	const seed = path.join(ROOT, "scripts", "demo-measured-minutes.ts");
	const run = (dataDir?: string) =>
		spawnSync(process.execPath, ["--import", "tsx", seed], {
			cwd: ROOT,
			encoding: "utf8",
			timeout: 90_000,
			env: { ...process.env, ...(dataDir ? { LH_DATA_DIR: dataDir } : { LH_DATA_DIR: "" }) },
		});
	const progressFile = (dir: string) => path.join(dir, "profiles", "slovak", "progress.json");

	it("seeds an empty folder with a week that has measured and unmeasured days", () => {
		const dir = scratch("lh-sbx-seed-");
		const res = run(dir);
		assert.equal(res.status, 0, res.stderr);
		const days = Object.values(
			(JSON.parse(fs.readFileSync(progressFile(dir), "utf8")) as { days: Record<string, { minutesBy?: object }> }).days,
		);
		assert.equal(days.length, 6);
		assert.equal(days.filter((d) => d.minutesBy).length, 3, "three days measured, three before measuring");
	});

	it("refuses a folder it already seeded, and leaves it byte for byte as it was", () => {
		const dir = scratch("lh-sbx-seed-");
		assert.equal(run(dir).status, 0);
		const before = fs.readFileSync(progressFile(dir));
		const res = run(dir);
		assert.equal(res.status, 1);
		assert.match(res.stderr, /already has profile data/);
		assert.ok(before.equals(fs.readFileSync(progressFile(dir))), "the days were not replaced");
	});

	it("refuses a folder with a learner's own progress in it", () => {
		const dir = scratch("lh-sbx-seed-");
		fs.mkdirSync(path.dirname(progressFile(dir)), { recursive: true });
		const mine = JSON.stringify({
			xp: 1234,
			dailyGoal: 50,
			days: { "2026-10-27": { xp: 1234, lessons: 9, reps: 90, reviews: 40, minutes: 51 } },
			units: {},
			recent: [],
		});
		fs.writeFileSync(progressFile(dir), mine);
		const res = run(dir);
		assert.equal(res.status, 1);
		assert.equal(fs.readFileSync(progressFile(dir), "utf8"), mine, "untouched");
	});

	it("refuses to run with no data folder named", () => {
		const res = run();
		assert.equal(res.status, 1);
		assert.match(res.stderr, /LH_DATA_DIR/);
	});
});
