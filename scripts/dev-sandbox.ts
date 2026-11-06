/**
 * A sandbox instance for demos, tests and anything an agent drives
 * (LangHarness, 2026-10-29).
 *
 *   npm run dev:sandbox              # an empty profile, no keys
 *   npm run dev:sandbox -- --seed    # with the demo week (scripts/demo-measured-minutes.ts)
 *
 * What it isolates, so nothing here can touch your learning data:
 *   data     LH_DATA_DIR  a new folder under the OS temp dir (never inside this repo)
 *   keys     LH_AUTH_FILE inside that folder, and LH_IGNORE_ENV_KEYS=1 hides every
 *                         key in .env.local and the environment (no paid calls)
 *   port     a free port chosen by the OS, never 3010
 *
 * It never edits a tracked file and never deletes anything: the folder is
 * printed, and you delete it when you are done. Next locks this checkout's
 * .next folder, so if your own dev server is running here the sandbox cannot
 * start; it says so and gives the worktree recipe instead of touching either
 * server.
 *
 * `dev:fresh` (scripts/dev-fresh.sh) is the older new-user simulator. It ends
 * in `npm run dev`, whose `-p 3010` beats the PORT it exports, so it starts on
 * the real port; this script starts `next dev` itself with its own port.
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** The port a normal `npm run dev` uses; the sandbox never takes it. */
export const REAL_PORT = 3010;

/** A free port picked by the OS, never one of `avoid`. */
export function freePort(avoid: readonly number[] = [REAL_PORT]): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as net.AddressInfo;
			server.close(() => (avoid.includes(port) ? freePort(avoid).then(resolve, reject) : resolve(port)));
		});
	});
}

/** Refuse a data folder inside the repo: that is where the real `data/` lives. */
export function assertSafeDataDir(dir: string, root: string = ROOT): void {
	const rel = path.relative(path.resolve(root), path.resolve(dir));
	if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
		throw new Error(`refusing ${dir}: a sandbox data folder must be outside the repo (${root}), where your real data/ lives`);
	}
}

/** A plain environment: Next's types make `NODE_ENV` a required, read-only
 *  member of NodeJS.ProcessEnv, which this script has to be free to remove. */
export type Env = Record<string, string | undefined>;

export interface SandboxPlan {
	dir: string;
	port: number;
	env: Env;
}

/** The folder, the port and the environment of one sandbox. Creates the folder. */
export function planSandbox(opts: { port: number; root?: string; tmp?: string; env?: Env }): SandboxPlan {
	const root = opts.root ?? ROOT;
	const dir = fs.mkdtempSync(path.join(opts.tmp ?? os.tmpdir(), "lh-sandbox-"));
	assertSafeDataDir(dir, root);
	if (opts.port === REAL_PORT) throw new Error(`refusing port ${REAL_PORT}: that is your real dev server's port`);
	const env: Env = { ...(opts.env ?? process.env) };
	// A browser-only instance: no desktop capability, and not a test run.
	delete env.LH_DESKTOP_SERVER;
	delete env.LH_DESKTOP_API_SECRET;
	delete env.NODE_ENV;
	env.LH_DATA_DIR = dir;
	env.LH_AUTH_FILE = path.join(dir, "auth.json");
	env.LH_IGNORE_ENV_KEYS = "1";
	env.PORT = String(opts.port);
	return { dir, port: opts.port, env };
}

/** What to tell the learner when Next refuses to start because another dev
 *  server holds this checkout's .next lock; null for any other output. */
export function explainFailure(output: string, root: string = ROOT): string | null {
	if (!/Another next dev server is already running/i.test(output)) return null;
	const name = path.basename(root);
	return [
		"",
		"The sandbox could not start: another dev server is already running from this checkout, and Next locks its .next folder.",
		"Your data and that server were not touched. Run the sandbox from a separate worktree instead:",
		`  git worktree add ..${path.sep}${name}-sandbox`,
		`  cd ..${path.sep}${name}-sandbox`,
		"  bun install   (or: npm ci)",
		"  npm run dev:sandbox -- --seed",
		"",
	].join("\n");
}

function killTree(pid: number | undefined): void {
	if (!pid) return;
	if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
	else process.kill(pid, "SIGTERM");
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args.includes("-h") || args.includes("--help")) {
		console.log("Usage: npm run dev:sandbox [-- --seed]\n  --seed  fill the sandbox with the demo week (scripts/demo-measured-minutes.ts)");
		return;
	}
	const unknown = args.filter((a) => a !== "--seed");
	if (unknown.length) {
		console.error(`unknown argument: ${unknown.join(" ")}  (try --help)`);
		process.exit(1);
	}

	const plan = planSandbox({ port: await freePort() });
	const rule = "-".repeat(72);
	console.log(rule);
	console.log("  SANDBOX instance: your real data, keys and port 3010 are not used");
	console.log(`  URL      : http://127.0.0.1:${plan.port}`);
	console.log(`  data dir : ${plan.dir}`);
	console.log("             a throwaway folder; nothing deletes it, delete it when you are done");
	console.log("  keys     : hidden (LH_IGNORE_ENV_KEYS=1); auth.json lives in the sandbox");
	console.log(rule);

	if (args.includes("--seed")) {
		const seed = spawnSync(process.execPath, ["--import", "tsx", path.join(ROOT, "scripts", "demo-measured-minutes.ts")], { cwd: ROOT, env: plan.env as NodeJS.ProcessEnv, stdio: "inherit" });
		if (seed.status !== 0) process.exit(seed.status ?? 1);
		// Four hand-made episodes for the Read screens (scripts/fixtures/series-episodes.ts).
		const stories = spawnSync(process.execPath, ["--import", "tsx", path.join(ROOT, "scripts", "seed-stories.ts")], { cwd: ROOT, env: plan.env as NodeJS.ProcessEnv, stdio: "inherit" });
		if (stories.status !== 0) process.exit(stories.status ?? 1);
	}

	const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
	const child = spawn(process.execPath, [next, "dev", "-H", "127.0.0.1", "-p", String(plan.port)], { cwd: ROOT, env: plan.env as NodeJS.ProcessEnv, stdio: ["inherit", "pipe", "pipe"] });
	let seen = "";
	for (const [stream, sink] of [
		[child.stdout, process.stdout],
		[child.stderr, process.stderr],
	] as const) {
		stream.on("data", (chunk: Buffer) => {
			sink.write(chunk);
			seen = (seen + chunk.toString()).slice(-4000);
		});
	}
	const stop = () => killTree(child.pid);
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	child.on("exit", (code) => {
		const why = explainFailure(seen);
		if (why) console.error(why);
		process.exit(code ?? 0);
	});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((err: unknown) => {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	});
}
