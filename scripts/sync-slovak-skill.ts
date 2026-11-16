/**
 * Bring .claude/skills/slovak-language up to date with slovak.wiki (LangHarness,
 * 2026-11-01). slovak.wiki is the source of truth; this copy only follows. The
 * same files are then mirrored to .agents/skills/slovak-language.
 *
 *   npm run skill:sync                  # from ../slovak.wiki next to this repo
 *   npm run skill:sync -- <dir>         # from another checkout of slovak.wiki
 *   npm run skill:sync -- --force       # overwrite edits made only here
 *
 * It compares three versions of every file: this copy, the slovak.wiki commit
 * the copy was taken from (named in SOURCE.md), and slovak.wiki now. A file
 * changed only upstream is updated; a file changed only here is a conflict,
 * because copying would silently undo a fix that never reached slovak.wiki.
 * It refuses an upstream skill with uncommitted changes, so SOURCE.md always
 * names a commit that holds exactly what was copied. SOURCE.md itself is
 * this repo's own and only its commit line is rewritten.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL = path.join(ROOT, ".claude", "skills", "slovak-language");
// The same skill, kept beside it under .agents/skills so agents that read that folder see it too.
const MIRROR = path.join(ROOT, ".agents", "skills", "slovak-language");
const UPSTREAM_SKILL = ".agents/skills/slovak-language";
const OWN = "SOURCE.md";

type Files = Map<string, string>;

export interface SyncPlan {
	add: string[];
	update: string[];
	remove: string[];
	/** Changed here and not in slovak.wiki: copying would undo them. */
	conflicts: string[];
}

/** What a sync does to each file, from this copy, the recorded upstream
 *  commit and upstream now. Pure. */
export function planSkillSync(local: Files, recorded: Files, incoming: Files): SyncPlan {
	const plan: SyncPlan = { add: [], update: [], remove: [], conflicts: [] };
	const paths = [...new Set([...local.keys(), ...recorded.keys(), ...incoming.keys()])].filter((p) => p !== OWN).sort();
	for (const p of paths) {
		const here = local.get(p);
		const was = recorded.get(p);
		const now = incoming.get(p);
		if (here === now) continue;
		const editedHere = here !== was;
		if (now === undefined) {
			if (editedHere) plan.conflicts.push(p);
			else plan.remove.push(p);
		} else if (here === undefined) {
			if (was === undefined) plan.add.push(p);
			else plan.conflicts.push(p);
		} else if (editedHere) plan.conflicts.push(p);
		else plan.update.push(p);
	}
	return plan;
}

/** Rewrites SOURCE.md's commit line; null when the line is missing. */
export function recordCommit(source: string, commit: string, date: string): string | null {
	const re = /at commit `[0-9a-f]+` \(\d{4}-\d{2}-\d{2}\)/;
	return re.test(source) ? source.replace(re, `at commit \`${commit}\` (${date})`) : null;
}

const git = (dir: string, ...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
// A Windows checkout may hold CRLF where git holds LF; only the text counts.
const lf = (s: string) => s.replace(/\r\n/g, "\n");

function readTree(dir: string): Files {
	const files: Files = new Map();
	const walk = (sub: string) => {
		for (const e of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
			const rel = sub ? `${sub}/${e.name}` : e.name;
			if (e.isDirectory()) walk(rel);
			else files.set(rel, lf(fs.readFileSync(path.join(dir, rel), "utf8")));
		}
	};
	walk("");
	return files;
}

function readCommit(repo: string, commit: string): Files {
	const files: Files = new Map();
	for (const full of git(repo, "ls-tree", "-r", "--name-only", commit, "--", UPSTREAM_SKILL)
		.split("\n")
		.filter(Boolean)) {
		files.set(full.slice(UPSTREAM_SKILL.length + 1), lf(git(repo, "show", `${commit}:${full}`)));
	}
	return files;
}

/** slovak.wiki beside the main checkout, also when run from a worktree. */
function defaultSource(): string {
	const common = git(ROOT, "rev-parse", "--path-format=absolute", "--git-common-dir").trim();
	return path.join(path.dirname(path.dirname(common)), "slovak.wiki");
}

function main() {
	const args = process.argv.slice(2);
	const force = args.includes("--force");
	const repo = path.resolve(args.find((a) => !a.startsWith("--")) ?? process.env.SLOVAK_WIKI_DIR ?? defaultSource());
	if (!fs.existsSync(path.join(repo, UPSTREAM_SKILL, "SKILL.md"))) {
		console.error(
			`No slovak-language skill at ${path.join(repo, UPSTREAM_SKILL)}. Pass the slovak.wiki checkout: npm run skill:sync -- <dir>`,
		);
		process.exit(1);
	}
	if (git(repo, "status", "--porcelain", "--", UPSTREAM_SKILL).trim()) {
		console.error(
			`The skill in ${repo} has uncommitted changes. Commit them in slovak.wiki first, so SOURCE.md can name the commit.`,
		);
		process.exit(1);
	}
	const sourceMd = fs.readFileSync(path.join(LOCAL, OWN), "utf8");
	const recordedCommit = /at commit `([0-9a-f]+)`/.exec(sourceMd)?.[1];
	if (!recordedCommit) {
		console.error(`${OWN} names no commit ("at commit \`<hash>\` (<date>)").`);
		process.exit(1);
	}
	const commit = git(repo, "log", "-1", "--format=%h", "--", UPSTREAM_SKILL).trim();
	const date = git(repo, "log", "-1", "--format=%cs", "--", UPSTREAM_SKILL).trim();
	const incoming = readTree(path.join(repo, UPSTREAM_SKILL));
	const plan = planSkillSync(readTree(LOCAL), readCommit(repo, recordedCommit), incoming);

	if (plan.conflicts.length && !force) {
		console.error(
			`Not synced. Changed here but not in slovak.wiki:\n  ${plan.conflicts.join("\n  ")}\nPort the change to slovak.wiki and sync again, or pass --force to drop it.`,
		);
		process.exit(1);
	}
	for (const p of [...plan.add, ...plan.update, ...(force ? plan.conflicts.filter((c) => incoming.has(c)) : [])]) {
		fs.mkdirSync(path.dirname(path.join(LOCAL, p)), { recursive: true });
		fs.writeFileSync(path.join(LOCAL, p), incoming.get(p)!);
	}
	for (const p of [...plan.remove, ...(force ? plan.conflicts.filter((c) => !incoming.has(c)) : [])])
		fs.rmSync(path.join(LOCAL, p));
	fs.writeFileSync(path.join(LOCAL, OWN), recordCommit(sourceMd, commit, date)!);
	fs.rmSync(MIRROR, { recursive: true, force: true });
	fs.cpSync(LOCAL, MIRROR, { recursive: true });

	const changed = plan.add.length + plan.update.length + plan.remove.length + (force ? plan.conflicts.length : 0);
	console.log(
		`Synced from ${repo} at ${commit} (${date}): ${plan.add.length} added, ${plan.update.length} updated, ${plan.remove.length} removed${force && plan.conflicts.length ? `, ${plan.conflicts.length} local edits dropped` : ""}.`,
	);
	if (changed > 0)
		console.log(
			"The tutor reads these files at runtime. Before merging, measure it: EVAL_BUDGET_USD=0.05 tsx scripts/eval-slovak-accuracy.ts <out-dir> claude-haiku-5-5:xhigh:skill (see docs/research/slovak-accuracy-eval.md).",
		);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
