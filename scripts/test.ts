/**
 * Parallel Bun test runner (`npm test` / `bun run test` / `bun scripts/test.ts [files...]`).
 *
 * Why this exists:
 * - `tsx --test tests/*.test.ts tests/*.test.tsx` ran 268 files inside Node's
 *   test runner with heavy tsx loader startup per child process (~190s on Windows),
 *   and hit Windows command-line length limits when expanded by shells.
 * - Several test files mutate module-load process globals (`process.env.LANNA_DATA_DIR`,
 *   `globalThis.window`, `globalThis.document`, `globalThis.fetch`), so running all
 *   268 files in a single `bun test` process causes cross-file state collisions.
 * - Spawning isolated `bun test <file>` workers across CPU cores gives full
 *   process isolation per file with Bun's ~30ms startup, finishing the entire
 *   268-file suite in ~15-20s (~90% faster).
 */

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TESTS_DIR = path.join(ROOT, "tests");

export function resolveAffectedTests(changedFiles: readonly string[], root: string = ROOT): string[] {
	const testsDir = path.join(root, "tests");
	if (!fs.existsSync(testsDir)) return [];
	const allTestFiles = fs
		.readdirSync(testsDir)
		.filter((name) => /\.test\.tsx?$/.test(name))
		.sort()
		.map((name) => path.join("tests", name));

	const normalizedChanged = changedFiles.map((file) => file.replace(/\\/g, "/"));
	const matched = new Set<string>();
	const stemTokens = new Set<string>();

	for (const changed of normalizedChanged) {
		if (/^tests\/.*\.test\.tsx?$/.test(changed) && fs.existsSync(path.join(root, changed))) {
			matched.add(path.normalize(changed));
			continue;
		}
		const baseName = path.basename(changed, path.extname(changed));
		if (baseName && baseName !== "index") stemTokens.add(baseName);
		if (changed.startsWith("curriculum/")) stemTokens.add("chapter-stories");
	}

	if (stemTokens.size === 0) return [...matched].sort();

	for (const testRelPath of allTestFiles) {
		if (matched.has(testRelPath)) continue;
		const testBase = path.basename(testRelPath).replace(/\.test\.tsx?$/, "");
		if (stemTokens.has(testBase)) {
			matched.add(testRelPath);
			continue;
		}
		const source = fs.readFileSync(path.join(root, testRelPath), "utf-8");
		for (const stem of stemTokens) {
			if (source.includes(`/${stem}.`) || source.includes(`/${stem}"`) || source.includes(`/${stem}'`)) {
				matched.add(testRelPath);
				break;
			}
		}
	}

	return [...matched].sort();
}

function listChangedFiles(baseRef: string): string[] {
	const diff = spawnSync("git", ["diff", "--name-only", baseRef], { cwd: ROOT, encoding: "utf8" });
	const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" });
	const lines = [
		...(diff.status === 0 ? diff.stdout.split(/\r?\n/) : []),
		...(untracked.status === 0 ? untracked.stdout.split(/\r?\n/) : []),
	];
	return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}

function resolveRunner(): { cmd: string; argsFor: (file: string) => string[] } {
	if (process.versions.bun) {
		return { cmd: process.execPath, argsFor: (file) => ["test", "--timeout", "30000", file] };
	}
	const bunCheck = spawnSync("bun", ["--version"], { encoding: "utf8", stdio: "ignore" });
	if (bunCheck.status === 0) {
		return { cmd: "bun", argsFor: (file) => ["test", "--timeout", "30000", file] };
	}
	const tsxCli = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
	return {
		cmd: process.execPath,
		argsFor: (file) => [tsxCli, "--test", file],
	};
}

function collectTestFiles(filters: string[]): string[] {
	if (filters.length > 0) {
		const matched: string[] = [];
		for (const f of filters) {
			const candidate = path.isAbsolute(f) ? f : path.resolve(ROOT, f);
			if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
				matched.push(path.relative(ROOT, candidate));
				continue;
			}
			const all = fs
				.readdirSync(TESTS_DIR)
				.filter((name) => /\.test\.tsx?$/.test(name) && name.includes(f))
				.sort()
				.map((name) => path.join("tests", name));
			matched.push(...all);
		}
		return [...new Set(matched)];
	}
	return fs
		.readdirSync(TESTS_DIR)
		.filter((name) => /\.test\.tsx?$/.test(name))
		.sort()
		.map((name) => path.join("tests", name));
}

async function main(): Promise<void> {
	const args = process.argv.slice(2).filter((arg) => arg !== "--");
	const changedIndex = args.indexOf("--changed");
	let files: string[];
	if (changedIndex >= 0) {
		const nextArg = args[changedIndex + 1];
		const baseRef = nextArg && !nextArg.startsWith("-") ? nextArg : "origin/main";
		const changed = listChangedFiles(baseRef);
		files = resolveAffectedTests(changed);
		if (files.length === 0) {
			console.log(`No affected test files matched ${changed.length} changed file(s) against ${baseRef}.`);
			return;
		}
		console.log(`Running ${files.length} affected test file(s) for ${changed.length} changed file(s):`);
	} else {
		files = collectTestFiles(args);
	}
	if (files.length === 0) {
		console.error(`No test files matched: ${args.join(" ")}`);
		process.exit(1);
	}

	const runner = resolveRunner();
	const concurrency = Math.max(
		1,
		Math.min(files.length, Number(process.env.LANNA_TEST_JOBS) || Math.min(os.cpus().length, 12)),
	);
	const start = performance.now();

	if (files.length === 1) {
		const res = spawnSync(runner.cmd, runner.argsFor(files[0]!), {
			cwd: ROOT,
			stdio: "inherit",
			env: { ...process.env, NODE_ENV: "test" },
		});
		process.exit(res.status ?? 1);
	}

	let index = 0;
	let passedFiles = 0;
	const failed: { file: string; output: string; ms: number }[] = [];

	async function worker(): Promise<void> {
		while (index < files.length) {
			const file = files[index++]!;
			const fileStart = performance.now();
			const result = await new Promise<{ code: number; output: string }>((resolve) => {
				const child = spawn(runner.cmd, runner.argsFor(file), {
					cwd: ROOT,
					env: { ...process.env, NODE_ENV: "test" },
					stdio: ["ignore", "pipe", "pipe"],
				});
				const chunks: Buffer[] = [];
				child.stdout.on("data", (c: Buffer) => chunks.push(c));
				child.stderr.on("data", (c: Buffer) => chunks.push(c));
				child.on("close", (code) => {
					resolve({ code: code ?? 1, output: Buffer.concat(chunks).toString("utf8") });
				});
				child.on("error", (err) => {
					resolve({ code: 1, output: String(err) });
				});
			});
			const ms = Math.round(performance.now() - fileStart);
			if (result.code === 0) {
				passedFiles++;
			} else {
				failed.push({ file, output: result.output, ms });
				process.stderr.write(`\nFAIL ${file} (${ms}ms)\n${result.output}\n`);
			}
		}
	}

	await Promise.all(Array.from({ length: concurrency }, () => worker()));
	const elapsed = ((performance.now() - start) / 1000).toFixed(2);
	console.log(
		`\nTest files: ${passedFiles} passed, ${failed.length} failed, ${files.length} total (${elapsed}s, ${concurrency} workers)`,
	);
	if (failed.length > 0) {
		console.error(`Failed files:\n${failed.map((f) => `  - ${f.file}`).join("\n")}`);
		process.exit(1);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
