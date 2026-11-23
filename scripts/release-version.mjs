#!/usr/bin/env node
// Usage:
//   node scripts/release-version.mjs            fail if package.json is older than the published release
//   node scripts/release-version.mjs --release  also fail if it is not newer, if package-lock.json
//                                               disagrees, or if HEAD is not on origin/main
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseVersion(version) {
	const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(String(version).trim());
	if (!match) throw new Error(`Not a semver version: ${version}`);
	return { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4] ?? null };
}

export function compareVersions(a, b) {
	const left = parseVersion(a);
	const right = parseVersion(b);
	for (let i = 0; i < 3; i++) {
		if (left.numbers[i] !== right.numbers[i]) return left.numbers[i] - right.numbers[i];
	}
	if (left.prerelease === right.prerelease) return 0;
	if (left.prerelease === null) return 1;
	if (right.prerelease === null) return -1;
	return left.prerelease < right.prerelease ? -1 : 1;
}

export function nextPatch(version) {
	const [major, minor, patch] = parseVersion(version).numbers;
	return `${major}.${minor}.${patch + 1}`;
}

function readJson(file) {
	return JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
}

export function packageVersion() {
	return readJson("package.json").version;
}

export function updateFeedRepo() {
	const config = fs.readFileSync(path.join(ROOT, "electron-builder.yml"), "utf8");
	const owner = /^\s*owner:\s*(\S+)/m.exec(config)?.[1];
	const repo = /^\s*repo:\s*(\S+)/m.exec(config)?.[1];
	if (!owner || !repo) throw new Error("electron-builder.yml has no publish owner/repo");
	return { owner, repo };
}

// GitHub's /releases/latest skips drafts and prereleases, the same releases
// electron-updater's GitHub provider offers to installed apps. 404 = none yet.
export async function latestPublishedVersion({ owner, repo } = updateFeedRepo()) {
	const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
	const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
		headers: {
			accept: "application/vnd.github+json",
			"user-agent": "release-version-check",
			...(token ? { authorization: `Bearer ${token}` } : {}),
		},
		signal: AbortSignal.timeout(20_000),
	});
	if (response.status === 404) return null;
	if (!response.ok) throw new Error(`GitHub answered ${response.status} for ${owner}/${repo} releases`);
	const { tag_name: tag } = await response.json();
	return String(tag).replace(/^v/, "");
}

export function judgeVersion(version, latest, { release = false } = {}) {
	if (latest === null) return { ok: true, message: `No release is published yet; ${version} is fine.` };
	const order = compareVersions(version, latest);
	if (order > 0) return { ok: true, message: `${version} is newer than the published ${latest}.` };
	if (order === 0 && !release) {
		return {
			ok: true,
			message: `${version} matches the published release; installed copies will treat it as current.`,
		};
	}
	const fix = `Bump package.json and package-lock.json to ${nextPatch(latest)} or higher.`;
	if (order === 0) {
		return {
			ok: false,
			message: `${version} is already published. Installed apps only update to a higher version. ${fix}`,
		};
	}
	return {
		ok: false,
		message: [
			`This build is ${version}, but ${latest} is already published on GitHub.`,
			"Installed apps are on " +
				latest +
				" and electron-updater refuses downgrades, so this build can never reach them.",
			`If the bump to ${latest} lives on a branch that never reached main, merge it first. Otherwise: ${fix}`,
			"For a deliberately older build (for example a baseline to test updating from), set LANNA_ALLOW_OLD_VERSION=1.",
		].join("\n"),
	};
}

function releaseProblems(version) {
	const problems = [];
	const lock = readJson("package-lock.json");
	if (lock.version !== version || lock.packages?.[""]?.version !== version) {
		problems.push(
			`package-lock.json says ${lock.version}, package.json says ${version}. Run npm install to sync them.`,
		);
	}
	const git = (...args) => execFileSync("git", args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
	git("fetch", "--quiet", "--no-tags", "origin", "main");
	try {
		git("merge-base", "--is-ancestor", "HEAD", "origin/main");
	} catch {
		problems.push(
			"HEAD is not on origin/main. Release from main so the version bump and the shipped code stay on main.",
		);
	}
	return problems;
}

async function main() {
	const release = process.argv.includes("--release");
	const version = packageVersion();
	const verdict = judgeVersion(version, await latestPublishedVersion(), { release });
	const problems = verdict.ok ? [] : [verdict.message];
	if (release) problems.push(...releaseProblems(version));
	if (problems.length > 0) {
		for (const problem of problems) console.error(`✗ ${problem}`);
		process.exit(1);
	}
	console.log(`✓ ${verdict.message}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(`✗ ${error.message}`);
		process.exit(1);
	});
}
