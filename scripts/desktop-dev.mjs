#!/usr/bin/env node
/**
 * `npm run desktop:dev` — next dev + the Electron shell, on every OS.
 *
 * The old one-liner (`concurrently "next dev" "LH_DEV_URL=… electron ."`)
 * broke on Windows: concurrently runs each command through cmd.exe, which
 * has no `VAR=value cmd` syntax, and Electron could open before Next was
 * listening (main.cjs loads the URL once, no retry). This launcher sets the
 * env itself, waits for Next to answer, then opens Electron. Closing either
 * one stops both.
 */
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || "3010";
const URL_ = `http://localhost:${PORT}`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const children = new Set();
let stopping = false;

/** End one child and wait until it has. */
function end(c) {
	return new Promise((resolve) => {
		if (c.exitCode !== null || c.signalCode !== null) return resolve();
		c.once("exit", () => resolve());
		// A child that never reports its exit must not hold the launcher open.
		setTimeout(resolve, 5000).unref();
		// Windows: kill() ends only the top process and leaves Next's
		// workers holding the port, so take down the whole tree.
		if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(c.pid), "/T", "/F"], { stdio: "ignore" });
		else c.kill();
	});
}

function stop(code = 0) {
	if (stopping) return;
	stopping = true;
	void Promise.all([...children].map(end)).then(() => process.exit(code));
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

const nextBin = require.resolve("next/dist/bin/next");
// `--prod`: build once and serve the build. `next dev` compiles every route the
// first time it is opened and ships unminified React, so each new tab is slow;
// a build is what the app feels like (docs/research/slow-tabs.md).
const PROD = process.argv.includes("--prod");
if (PROD) {
	const built = spawnSync(process.execPath, [nextBin, "build"], { cwd: root, stdio: "inherit" });
	if (built.status !== 0) process.exit(built.status ?? 1);
}
function startNext() {
	const next = spawn(process.execPath, [nextBin, PROD ? "start" : "dev", "-H", "127.0.0.1", "-p", PORT], {
		cwd: root,
		stdio: "inherit",
	});
	children.add(next);
	next.on("exit", (code) => {
		children.delete(next);
		stop(code ?? 0);
	});
	return next;
}

function startShell() {
	const electronBin = require("electron");
	const electron = spawn(electronBin, ["."], {
		cwd: root,
		stdio: "inherit",
		env: { ...process.env, LH_DEV_URL: URL_ },
	});
	children.add(electron);
	electron.on("exit", (code) => {
		children.delete(electron);
		stop(code ?? 0);
	});
}

startNext();

async function ready() {
	for (let i = 0; i < 240; i++) {
		if (stopping) return false;
		try {
			const res = await fetch(URL_, { signal: AbortSignal.timeout(5000) });
			if (res.status < 500) return true;
		} catch {
			/* not listening yet */
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

if (await ready()) {
	startShell();
} else if (!stopping) {
	console.error(`desktop:dev: Next did not answer on ${URL_} within 2 minutes`);
	stop(1);
}
