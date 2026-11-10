/**
 * What the speed scripts share (perf-check.mjs, instant-check.mjs): a server on a
 * seeded scratch profile, and a headless browser. It never uses your own data:
 * LH_DATA_DIR is a new folder under the OS temp dir, seeded with the demo week
 * (scripts/demo-measured-minutes.ts, as `npm run dev:sandbox -- --seed` does),
 * with keys hidden and a free port. Nothing is deleted afterwards.
 *
 *   PUPPETEER_CORE  folder holding node_modules/puppeteer-core (default: this checkout, then ../langharness-learning-ui)
 *   BROWSER_PATH    the browser executable (default: Edge on Windows)
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
	return new Promise((resolve, reject) => {
		const s = net.createServer();
		s.once("error", reject);
		s.listen(0, "127.0.0.1", () => {
			const { port } = s.address();
			s.close(() => resolve(port));
		});
	});
}

export function loadPuppeteer() {
	const roots = [process.env.PUPPETEER_CORE, ROOT, path.resolve(ROOT, "..", "langharness-learning-ui"), "C:/Users/Stream/Projects/langharness-learning-ui"].filter(Boolean);
	for (const r of roots) {
		try {
			return createRequire(path.join(r, "package.json"))("puppeteer-core");
		} catch {
			/* try the next one */
		}
	}
	throw new Error("puppeteer-core not found; set PUPPETEER_CORE to a folder that has node_modules/puppeteer-core");
}

export function findBrowser() {
	const cands = [process.env.BROWSER_PATH, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].filter(Boolean);
	const hit = cands.find((p) => fs.existsSync(p));
	if (!hit) throw new Error("no browser found; set BROWSER_PATH");
	return hit;
}

export const BROWSER_ARGS = ["--no-sandbox", "--no-first-run", "--disable-extensions", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"];

/** Start the app on a seeded scratch profile: `next start` from the existing build, or `next dev` with `dev`. `heavy` adds a year of reviews (scripts/perf-seed.ts). */
export async function startServer({ heavy = true, dev = false } = {}) {
	if (!dev && !fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) throw new Error("no production build; run `npm run build` first");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-perf-"));
	const env = { ...process.env, LH_DATA_DIR: dir, LH_AUTH_FILE: path.join(dir, "auth.json"), LH_IGNORE_ENV_KEYS: "1", NODE_ENV: dev ? "development" : "production" };
	delete env.LH_DESKTOP_SERVER;
	delete env.LH_DESKTOP_API_SECRET;
	const seed = spawnSync(process.execPath, ["--import", "tsx", path.join(ROOT, "scripts", "demo-measured-minutes.ts")], { cwd: ROOT, env: { ...env, NODE_ENV: "development" }, encoding: "utf8" });
	if (seed.status !== 0) throw new Error(`seed failed: ${seed.stderr || seed.stdout}`);
	if (heavy) {
		const more = spawnSync(process.execPath, ["--import", "tsx", path.join(ROOT, "scripts", "perf-seed.ts")], { cwd: ROOT, env: { ...env, NODE_ENV: "development" }, encoding: "utf8" });
		if (more.status !== 0) throw new Error(`heavy seed failed: ${more.stderr || more.stdout}`);
		console.log(more.stdout.trim());
	}
	const port = await freePort();
	const next = createRequire(path.join(ROOT, "package.json")).resolve("next/dist/bin/next");
	const child = spawn(process.execPath, [next, dev ? "dev" : "start", "-H", "127.0.0.1", "-p", String(port)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
	let log = "";
	child.stdout.on("data", (c) => (log += c));
	child.stderr.on("data", (c) => (log += c));
	const base = `http://127.0.0.1:${port}`;
	for (let i = 0; i < 200; i++) {
		try {
			const r = await fetch(`${base}/api/progress`);
			if (r.ok) return { base, dir, stop: () => (process.platform === "win32" ? spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }) : child.kill()) };
		} catch {
			/* not up yet */
		}
		await sleep(300);
	}
	throw new Error(`server did not start:\n${log}`);
}

export function table(rows, head) {
	const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
	const line = (r) => r.map((c, i) => (i === 0 ? String(c).padEnd(w[i]) : String(c).padStart(w[i]))).join("  ");
	return [line(head), w.map((x) => "-".repeat(x)).join("  "), ...rows.map(line)].join("\n");
}
