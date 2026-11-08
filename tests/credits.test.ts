import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { CREDIT_GROUPS, CREDITS, HOSTS_THAT_ARE_NOT_SOURCES, creditsFor } from "../src/core/credits.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const CREDITS_FILE = path.join(ROOT, "src", "core", "credits.ts");

function codeFiles(dir: string): string[] {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) return codeFiles(full);
		return /\.(ts|tsx)$/.test(e.name) && full !== CREDITS_FILE ? [full] : [];
	});
}

function hostsInCode(): Map<string, string> {
	const found = new Map<string, string>();
	for (const file of [...codeFiles(path.join(ROOT, "src")), ...codeFiles(path.join(ROOT, "app"))]) {
		for (const m of fs.readFileSync(file, "utf8").matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) {
			if (!found.has(m[1]!)) found.set(m[1]!, path.relative(ROOT, file));
		}
	}
	return found;
}

describe("Settings → Sources", () => {
	it("credits every outside host the app fetches from", () => {
		const credited = new Set(CREDITS.flatMap((c) => c.fetchedHosts ?? []));
		const missing = [...hostsInCode()].filter(([host]) => !credited.has(host) && !HOSTS_THAT_ARE_NOT_SOURCES.has(host)).map(([host, file]) => `${host} (${file})`);
		assert.deepEqual(missing, [], "add a credit in src/core/credits.ts, or list the host as not a source");
	});

	it("gives every credit a unique id, a link and a known group", () => {
		const groups = new Set(CREDIT_GROUPS.map((g) => g.id));
		assert.equal(new Set(CREDITS.map((c) => c.id)).size, CREDITS.length);
		for (const c of CREDITS) {
			assert.match(c.url, /^https:\/\//, c.id);
			assert.ok(groups.has(c.group), c.id);
		}
	});

	it("shows a language's own sources only to its learners", () => {
		const ids = (codes: string[]) => creditsFor(codes).map((c) => c.id);
		assert.ok(ids(["sk", "et"]).includes("slovak-wiki"));
		assert.ok(!ids(["et", "ru"]).includes("slovak-wiki"));
		assert.ok(ids(["et"]).includes("tatoeba"));
	});
});
