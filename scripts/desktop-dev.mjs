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
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || "3010";
const URL_ = `http://localhost:${PORT}`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const children = [];
let stopping = false;
function stop(code = 0) {
	if (stopping) return;
	stopping = true;
	for (const c of children) if (c.exitCode === null) c.kill();
	process.exit(code);
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

const nextBin = require.resolve("next/dist/bin/next");
const next = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", PORT], { cwd: root, stdio: "inherit" });
children.push(next);
next.on("exit", (code) => stop(code ?? 0));

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
	const electronBin = require("electron");
	const electron = spawn(electronBin, ["."], { cwd: root, stdio: "inherit", env: { ...process.env, LH_DEV_URL: URL_ } });
	children.push(electron);
	electron.on("exit", (code) => stop(code ?? 0));
} else if (!stopping) {
	console.error(`desktop:dev: Next did not answer on ${URL_} within 2 minutes`);
	stop(1);
}
