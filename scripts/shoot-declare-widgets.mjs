/**
 * Screenshots the Declare practice widgets inside their seeded chats, via the
 * house verify-ui (theme and width matrix included). Run it through the
 * sandbox, which provides the URL and the data dir:
 *
 *   bun scripts/sandbox-run.ts --seed --keep-dir -- node scripts/shoot-declare-widgets.mjs <outDir>
 *
 * The chats come from scripts/seed-declare-chat.ts, which leaves the two chat
 * ids in <dataDir>/declare-chats.json.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2];
if (!outDir) {
	console.error("usage: node scripts/shoot-declare-widgets.mjs <outDir>");
	process.exit(1);
}
const url = process.env.LANNA_SANDBOX_URL;
const dataDir = process.env.LANNA_SANDBOX_DATA_DIR;
if (!url || !dataDir) {
	console.error("Run through bun scripts/sandbox-run.ts (it sets LANNA_SANDBOX_URL and LANNA_SANDBOX_DATA_DIR).");
	process.exit(1);
}
const seed = spawnSync("bun", ["scripts/seed-declare-chat.ts"], {
	stdio: "inherit",
	env: { ...process.env, LANNA_DATA_DIR: dataDir },
});
if (seed.status !== 0) process.exit(seed.status ?? 1);
const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, "declare-chats.json"), "utf-8"));
const routes = [`declare-quiz=/chat/${manifest.quiz}`, `declare-program=/chat/${manifest.program}`];

const result = spawnSync(
	process.execPath,
	[
		path.join("scripts", "verify-ui.mjs"),
		url,
		outDir,
		...routes,
		"--themes",
		"day,night",
		"--widths",
		"1280,390",
		"--wait-for",
		'[data-declare-ready="true"]',
		"--check-icons",
	],
	{ stdio: "inherit" },
);
process.exit(result.status ?? 1);
