import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateBranchName } from "./branch-name.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function resolveWorktreePath(nameOrBranch: string, customDir?: string, root: string = ROOT): string {
	if (customDir) return path.resolve(path.dirname(root), customDir);
	const slug = nameOrBranch
		.replace(/^.*\//, "")
		.replace(/[^a-zA-Z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	if (!slug) throw new Error(`Cannot derive worktree folder name from "${nameOrBranch}"`);
	return path.resolve(path.dirname(root), `${path.basename(root)}-${slug}`);
}

export interface WorktreeCommand {
	action: "create" | "clean" | "list";
	branch?: string;
	customDir?: string;
	base: string;
	install: boolean;
	targets: string[];
}

export function parseWorktreeArgs(args: readonly string[]): WorktreeCommand {
	const action = args[0];
	if (action === "list") return { action: "list", base: "origin/main", install: false, targets: [] };
	if (action === "clean") {
		return { action: "clean", base: "origin/main", install: false, targets: args.slice(1) };
	}
	if (action === "create") {
		let branch = "";
		let customDir: string | undefined;
		let base = "origin/main";
		let install = true;
		for (let index = 1; index < args.length; index += 1) {
			const arg = args[index]!;
			if (arg === "--base") base = args[++index] ?? "origin/main";
			else if (arg === "--no-install") install = false;
			else if (!branch) branch = arg;
			else if (!customDir) customDir = arg;
			else throw new Error(`Unexpected argument: ${arg}`);
		}
		if (!branch) throw new Error("create requires <branch>");
		const verdict = validateBranchName(branch);
		if (!verdict.ok) throw new Error(verdict.reason);
		return { action: "create", branch, customDir, base, install, targets: [] };
	}
	throw new Error("Usage: bun scripts/worktree.ts <create|clean|list> ...");
}

function runCommand(executable: string, commandArgs: string[], cwd: string): void {
	const result = spawnSync(executable, commandArgs, { cwd, stdio: "inherit" });
	if (result.status !== 0) {
		throw new Error(`${executable} ${commandArgs.join(" ")} exited with code ${result.status ?? 1}`);
	}
}

function main(): void {
	const parsed = parseWorktreeArgs(process.argv.slice(2));
	if (parsed.action === "list") {
		runCommand("git", ["worktree", "list"], ROOT);
		return;
	}
	if (parsed.action === "create") {
		const targetDir = resolveWorktreePath(parsed.branch!, parsed.customDir);
		runCommand("git", ["fetch", "-q", "origin"], ROOT);
		runCommand("git", ["worktree", "add", targetDir, parsed.base, "-b", parsed.branch!], ROOT);
		if (parsed.install) {
			runCommand("bun", ["install", "--frozen-lockfile"], targetDir);
		}
		console.log(`Worktree ready: ${targetDir} (${parsed.branch})`);
		return;
	}
	if (parsed.targets.length === 0) {
		throw new Error("clean requires one or more worktree paths or folder names");
	}
	for (const target of parsed.targets) {
		const resolved = path.isAbsolute(target) ? target : path.resolve(path.dirname(ROOT), target);
		runCommand("git", ["worktree", "remove", "--force", resolved], ROOT);
	}
	runCommand("git", ["worktree", "prune"], ROOT);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		main();
	} catch (error: unknown) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
