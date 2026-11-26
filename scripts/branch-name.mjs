import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ALLOWED_BRANCH_TYPES = [
	"feat",
	"fix",
	"refactor",
	"docs",
	"chore",
	"test",
	"perf",
	"style",
	"ci",
	"build",
];

const GENERATED_PREFIXES = ["t3", "freebuff", "claude", "codex", "cursor", "agent", "copilot", "devin"];
const BRANCH_PATTERN = new RegExp(`^(${ALLOWED_BRANCH_TYPES.join("|")})\\/([a-z0-9]+(?:-[a-z0-9]+)*)$`);
const HEX_ONLY_SLUG = /^[0-9a-f]{6,}$/;

export function validateBranchName(branch, { allowMain = false } = {}) {
	const name = (branch ?? "").trim();
	if (!name) {
		return { ok: false, reason: "Detached HEAD or empty branch name. Checkout a named branch first." };
	}
	if (name === "main" || name === "master") {
		if (allowMain) return { ok: true };
		return {
			ok: false,
			reason: `Refusing to use "${name}" directly. Create a descriptive branch like "feat/<short-slug>".`,
		};
	}
	const prefix = name.includes("/") ? name.slice(0, name.indexOf("/")) : "";
	if (GENERATED_PREFIXES.includes(prefix.toLowerCase())) {
		const slug = name.slice(name.indexOf("/") + 1);
		const suggestion = slug && !HEX_ONLY_SLUG.test(slug) ? `feat/${slug.toLowerCase()}` : "feat/<short-slug>";
		return {
			ok: false,
			reason: `Generated branch name "${name}" is not allowed (W2). Rename it first: git branch -m ${suggestion}`,
		};
	}
	const match = name.match(BRANCH_PATTERN);
	if (!match) {
		return {
			ok: false,
			reason:
				`Branch "${name}" must match <type>/<kebab-case-slug> where <type> is one of: ` +
				`${ALLOWED_BRANCH_TYPES.join(", ")} (example: feat/mobile-language-picker).`,
		};
	}
	const slug = match[2];
	if (slug.length < 3 || HEX_ONLY_SLUG.test(slug)) {
		return {
			ok: false,
			reason: `Branch slug "${slug}" in "${name}" is not descriptive. Use lowercase words like "feat/mobile-language-picker".`,
		};
	}
	return { ok: true };
}

export function currentGitBranch(cwd = process.cwd()) {
	const result = spawnSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8" });
	if (result.status !== 0) return "";
	return result.stdout.trim();
}

function main() {
	const args = process.argv.slice(2);
	const allowMain = args.includes("--allow-main");
	const positional = args.filter((arg) => arg !== "--allow-main");
	const branch = positional[0] ?? currentGitBranch();
	const verdict = validateBranchName(branch, { allowMain });
	if (!verdict.ok) {
		console.error(verdict.reason);
		process.exit(1);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main();
}
