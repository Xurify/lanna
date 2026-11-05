/**
 * A language switch under `npm run desktop:dev` (2026-11-05): the shell used
 * app.relaunch(), the launcher saw Electron exit and stopped Next, and the new
 * window opened on a dead server, an empty black window. Now the shell asks
 * the launcher, which restarts both.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const require = createRequire(import.meta.url);
const relaunch = require("../electron/dev-relaunch.cjs") as {
	RELAUNCH_EXIT_CODE: number;
	LAUNCHER_ENV: string;
	relaunchMode: (env: Record<string, string | undefined>) => "launcher" | "electron";
	onShellExit: (code: number | null) => "restart" | "stop";
};

describe("relaunch after a language switch", () => {
	it("goes through the launcher only when the launcher started the dev shell", () => {
		assert.equal(relaunch.relaunchMode({ LH_DEV_URL: "http://localhost:3010", [relaunch.LAUNCHER_ENV]: "1" }), "launcher");
		assert.equal(relaunch.relaunchMode({ LH_DEV_URL: "http://localhost:3010" }), "electron", "a dev shell started by hand relaunches itself");
		assert.equal(relaunch.relaunchMode({ [relaunch.LAUNCHER_ENV]: "1" }), "electron", "the packaged app owns its server");
	});

	it("the launcher restarts on the relaunch code and stops on any other exit", () => {
		assert.equal(relaunch.onShellExit(relaunch.RELAUNCH_EXIT_CODE), "restart");
		assert.equal(relaunch.onShellExit(0), "stop");
		assert.equal(relaunch.onShellExit(1), "stop");
		assert.equal(relaunch.onShellExit(null), "stop");
	});

	it("the shell and the launcher are wired to the same module", () => {
		const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
		assert.match(main, /relaunchMode\(process\.env\) === "launcher"/);
		assert.match(main, /app\.exit\(RELAUNCH_EXIT_CODE\)/);
		const launcher = readFileSync(new URL("../scripts/desktop-dev.mjs", import.meta.url), "utf8");
		assert.match(launcher, /\[LAUNCHER_ENV\]: "1"/);
		assert.match(launcher, /onShellExit\(code\) === "restart"/);
	});
});
