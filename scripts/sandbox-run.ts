import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { explainFailure, freePort, planSandbox } from "./dev-sandbox.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANGUAGE_FILES = ["language.json", "course.json", "lexicon.json"] as const;

export interface SandboxRunOptions {
	seed: boolean;
	copyLanguagesFrom?: string;
	timeoutSeconds: number;
	keepDir: boolean;
	command: string[];
}

export function parseSandboxRunArgs(args: readonly string[], root: string = ROOT): SandboxRunOptions {
	const divider = args.indexOf("--");
	const flagArgs = divider >= 0 ? args.slice(0, divider) : args;
	const command = divider >= 0 ? [...args.slice(divider + 1)] : [];

	let seed = false;
	let copyLanguagesFrom: string | undefined;
	let timeoutSeconds = 90;
	let keepDir = false;

	for (let index = 0; index < flagArgs.length; index += 1) {
		const arg = flagArgs[index]!;
		if (arg === "--seed") {
			seed = true;
		} else if (arg === "--keep-dir") {
			keepDir = true;
		} else if (arg === "--timeout") {
			const next = Number(flagArgs[index + 1]);
			if (!Number.isFinite(next) || next <= 0) throw new Error("--timeout requires a positive number of seconds");
			timeoutSeconds = next;
			index += 1;
		} else if (arg === "--copy-languages") {
			const next = flagArgs[index + 1];
			if (next && !next.startsWith("--")) {
				copyLanguagesFrom = path.resolve(next);
				index += 1;
			} else {
				copyLanguagesFrom = path.join(root, "data", "languages");
			}
		} else {
			throw new Error(`Unknown flag: ${arg}`);
		}
	}

	return { seed, copyLanguagesFrom, timeoutSeconds, keepDir, command };
}

export function copyLanguageAssets(sourceDir: string, sandboxDir: string): string[] {
	const sourceLanguagesDir = fs.existsSync(path.join(sourceDir, "languages"))
		? path.join(sourceDir, "languages")
		: sourceDir;
	if (!fs.existsSync(sourceLanguagesDir)) return [];
	const copied: string[] = [];
	const targetLanguagesDir = path.join(sandboxDir, "languages");
	for (const entry of fs.readdirSync(sourceLanguagesDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const srcFolder = path.join(sourceLanguagesDir, entry.name);
		const dstFolder = path.join(targetLanguagesDir, entry.name);
		let copiedAny = false;
		for (const fileName of LANGUAGE_FILES) {
			const srcFile = path.join(srcFolder, fileName);
			if (!fs.existsSync(srcFile)) continue;
			fs.mkdirSync(dstFolder, { recursive: true });
			fs.copyFileSync(srcFile, path.join(dstFolder, fileName));
			copiedAny = true;
		}
		if (copiedAny) copied.push(entry.name);
	}
	return copied.sort();
}

export function substituteCommandArgs(command: readonly string[], url: string, dataDir: string): string[] {
	return command.map((token) => token.replaceAll("{URL}", url).replaceAll("{DATA_DIR}", dataDir));
}

function killProcessTree(pid: number | undefined): void {
	if (!pid) return;
	if (process.platform === "win32") {
		spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
	} else {
		try {
			process.kill(pid, "SIGTERM");
		} catch {
			// Process may have already exited before teardown.
		}
	}
}

async function waitForServerReady(
	url: string,
	timeoutMs: number,
	hasExited: () => { exited: boolean; output: string },
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const status = hasExited();
		if (status.exited) {
			const lockNote = explainFailure(status.output);
			throw new Error(lockNote ?? `Sandbox server exited before becoming ready:\n${status.output.slice(-1000)}`);
		}
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
			if (response.status < 500) return;
		} catch {
			// Server still booting; retry until deadline.
		}
		await new Promise((resolve) => setTimeout(resolve, 400));
	}
	throw new Error(`Sandbox server at ${url} did not become ready within ${Math.round(timeoutMs / 1000)}s`);
}

async function main(): Promise<void> {
	const rawArgs = process.argv.slice(2);
	if (rawArgs.includes("-h") || rawArgs.includes("--help") || rawArgs.length === 0) {
		console.log(
			"Usage: bun scripts/sandbox-run.ts [--seed] [--copy-languages [dir]] [--timeout 90] [--keep-dir] -- <command...>\n" +
				"  Replaces {URL} and {DATA_DIR} in <command>, and sets LANNA_SANDBOX_URL / LANNA_SANDBOX_DATA_DIR.",
		);
		process.exit(rawArgs.length === 0 ? 1 : 0);
	}

	const options = parseSandboxRunArgs(rawArgs);
	if (options.command.length === 0) {
		console.error("Missing command after `--`");
		process.exit(1);
	}

	const plan = planSandbox({ port: await freePort() });
	const url = `http://127.0.0.1:${plan.port}`;
	let serverPid: number | undefined;

	try {
		if (options.copyLanguagesFrom) {
			const copied = copyLanguageAssets(options.copyLanguagesFrom, plan.dir);
			if (copied.length > 0) console.log(`Copied read-only language data: ${copied.join(", ")}`);
		}

		if (options.seed) {
			const loaderArgs = process.versions.bun ? [] : ["--import", "tsx"];
			for (const seedScript of ["demo-measured-minutes.ts", "seed-stories.ts"]) {
				const result = spawnSync(process.execPath, [...loaderArgs, path.join(ROOT, "scripts", seedScript)], {
					cwd: ROOT,
					env: plan.env as NodeJS.ProcessEnv,
					stdio: "inherit",
				});
				if (result.status !== 0) process.exit(result.status ?? 1);
			}
		}

		const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
		const nodeRuntime = process.versions.bun ? "node" : process.execPath;
		let exited = false;
		let outputTail = "";

		const server = spawn(nodeRuntime, [nextBin, "dev", "-H", "127.0.0.1", "-p", String(plan.port)], {
			cwd: ROOT,
			env: plan.env as NodeJS.ProcessEnv,
			stdio: ["ignore", "pipe", "pipe"],
		});
		serverPid = server.pid;
		for (const stream of [server.stdout, server.stderr]) {
			stream.on("data", (chunk: Buffer) => {
				outputTail = (outputTail + chunk.toString()).slice(-4000);
			});
		}
		server.on("exit", () => {
			exited = true;
		});

		await waitForServerReady(url, options.timeoutSeconds * 1000, () => ({ exited, output: outputTail }));

		const [executable, ...commandArgs] = substituteCommandArgs(options.command, url, plan.dir);
		const commandResult = spawnSync(executable!, commandArgs, {
			cwd: ROOT,
			env: {
				...process.env,
				LANNA_SANDBOX_URL: url,
				LANNA_SANDBOX_DATA_DIR: plan.dir,
			},
			stdio: "inherit",
			shell: process.platform === "win32",
		});
		process.exitCode = commandResult.status ?? 1;
	} finally {
		killProcessTree(serverPid);
		if (!options.keepDir) {
			fs.rmSync(plan.dir, { recursive: true, force: true });
		}
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
