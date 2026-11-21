import * as fs from "node:fs";
import * as path from "node:path";
import { curateStandalone } from "./standalone-payload.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");

const copyTree = (from, to) => {
	fs.cpSync(from, to, { recursive: true });
};

const exists = (p) => fs.existsSync(p);

if (!exists(path.join(STANDALONE, "server.js"))) {
	console.error("[build-server] .next/standalone/server.js missing — run `next build` first (output: 'standalone').");
	process.exit(1);
}

const staticFrom = path.join(ROOT, ".next", "static");
const staticTo = path.join(STANDALONE, ".next", "static");
if (!exists(staticFrom)) {
	console.error("[build-server] .next/static missing — the build looks incomplete.");
	process.exit(1);
}
copyTree(staticFrom, staticTo);
if (exists(path.join(ROOT, "public"))) {
	copyTree(path.join(ROOT, "public"), path.join(STANDALONE, "public"));
}

// The trace can sweep the whole checkout, including data/, auth.json and the
// repo's own docs and logs, so the payload is cut down to what the server reads
// at runtime (scripts/standalone-payload.mjs) and then checked.
const removed = curateStandalone(STANDALONE);
if (removed.length) console.log(`[build-server] removed from the payload: ${removed.join(", ")}`);

for (const extra of [path.join(".next", "cache"), "dist", path.join("node_modules", "electron")]) {
	const target = path.join(STANDALONE, extra);
	if (exists(target)) {
		fs.rmSync(target, { recursive: true, force: true });
		console.log(`[build-server] removed build-only payload: ${extra}`);
	}
}

const subscriptionSecrets = fs
	.readdirSync(STANDALONE)
	.filter((name) => /^(chatgpt|github-copilot|xai)-credentials\.json/.test(name));
for (const secret of ["data", "auth.json", ...subscriptionSecrets, ".env", ".env.local"]) {
	if (exists(path.join(STANDALONE, secret))) {
		console.error(`[build-server] REFUSING: standalone still contains ${secret} after curation.`);
		process.exit(1);
	}
}

for (const asset of [
	path.join("src", "agent", "prompts", "chat", "10-chat.md"),
	path.join("src", "agent", "prompts", "chat", "tutor-unit.md"),
	path.join("src", "agent", "prompts", "language", "10-slovak.md"),
	path.join("src", "agent", "prompts", "language", "10-estonian.md"),
	path.join("src", "agent", "prompts", "language", "10-russian.md"),
	path.join("src", "agent", "prompts", "drawing", "10-drawing.md"),
	path.join("curriculum", "slovak", "lexicon.json"),
	path.join("curriculum", "estonian", "course.json"),
	path.join("curriculum", "russian", "course.json"),
]) {
	if (!exists(path.join(STANDALONE, asset))) {
		console.error(`[build-server] prompt asset missing from the trace: ${asset}`);
		process.exit(1);
	}
}

console.log("[build-server] server payload ready:", STANDALONE);
