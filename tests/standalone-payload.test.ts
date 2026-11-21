import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import configure from "../next.config.ts";
import { KEEP_AT_ROOT, curateStandalone } from "../scripts/standalone-payload.mjs";

function payload(names: string[]): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-payload-"));
	for (const name of names) {
		fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
		fs.writeFileSync(path.join(dir, name), "x");
	}
	return dir;
}

describe("the standalone server payload", () => {
	it("keeps the server and drops the repo the trace swept in", () => {
		const dir = payload([
			"server.js",
			"package.json",
			"node_modules/next/index.js",
			"data/chats/a.json",
			"auth.json",
			"docs/remote-access.md",
			"_handoff/shot.png",
			"tests/server-port.test.ts",
		]);
		const removed = curateStandalone(dir);

		assert.deepEqual(removed.sort(), ["_handoff", "auth.json", "data", "docs", "tests"]);
		assert.equal(fs.existsSync(path.join(dir, "server.js")), true);
		assert.equal(fs.existsSync(path.join(dir, "package.json")), true);
		assert.equal(fs.existsSync(path.join(dir, "node_modules", "next", "index.js")), true);
		assert.equal(fs.existsSync(path.join(dir, "data")), false);

		fs.rmSync(dir, { recursive: true, force: true });
	});

	it("keeps every repo path the next config includes for the server", () => {
		const nextConfig = configure("phase-production-build");
		for (const pattern of nextConfig.outputFileTracingIncludes!["*"]!) {
			if (pattern.startsWith("node_modules/")) continue;
			assert.equal(KEEP_AT_ROOT.has(pattern.split("/")[0]!), true, pattern);
		}
	});
});
