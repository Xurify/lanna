import * as fs from "node:fs";
import * as path from "node:path";

export const KEEP_AT_ROOT = new Set([
	"server.js",
	"package.json",
	".next",
	"node_modules",
	"public",
	"curriculum",
	"src",
	"scripts",
	"skills",
	".claude",
]);

export function curateStandalone(standalone) {
	const removed = [];
	for (const name of fs.readdirSync(standalone)) {
		if (KEEP_AT_ROOT.has(name)) continue;
		fs.rmSync(path.join(standalone, name), { recursive: true, force: true });
		removed.push(name);
	}
	return removed;
}
