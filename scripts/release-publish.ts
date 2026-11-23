// bun run release:publish [patch|minor|major|<x.y.z>]   bump, check, tag, wait for the build, publish
// bun run release:publish --resume                     wait for and publish the tag of the current version
// bun run release:publish --notes                      print the notes the next release would get, change nothing
// --yes                                                use the generated release notes without opening an editor
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	compareVersions,
	latestPublishedVersion,
	packageVersion,
	parseVersion,
	updateFeedRepo,
} from "./release-version.mjs";
import {
	expectedAssets,
	normalizeReleasePages,
	parseReleases,
	selectDraft,
	verifyAssets,
	verifyMetadataFiles,
	type Platform,
} from "./verify-release.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLL_MS = 30_000;
const MAX_WAIT_MS = 200 * 60_000;
const PACKAGE_JOBS: Record<string, Platform> = {
	"Package (mac-arm64)": "mac",
	"Package (windows-x64)": "win",
	"Package (linux-x64)": "linux",
};
const REQUIRED_PLATFORMS: Platform[] = ["win", "linux"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type BumpKind = "patch" | "minor" | "major";
type MergeCommit = { number: number; sha: string; base: string; head: string };
export type ReleasedPr = { number: number; title: string; change: string | null };
type Job = { name: string; status: string; conclusion: string; url: string };

function fail(message: string): never {
	console.error(`\n✗ ${message}`);
	process.exit(1);
}

function step(message: string) {
	console.log(`\n▶ ${message}`);
}

function exec(command: string, args: string[], { quiet = false, env = {} } = {}): string {
	const result = spawnSync(command, args, {
		cwd: ROOT,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
		stdio: quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"],
		env: { ...process.env, ...env },
	});
	if (result.status !== 0) {
		fail(`${command} ${args.join(" ")} failed${quiet && result.stderr ? `:\n${result.stderr.trim()}` : ""}`);
	}
	return result.stdout;
}

function runVisible(command: string, args: string[], env: Record<string, string> = {}) {
	console.log(`  $ ${command} ${args.join(" ")}`);
	const result = spawnSync(command, args, {
		cwd: ROOT,
		stdio: "inherit",
		shell: process.platform === "win32",
		env: { ...process.env, ...env },
	});
	if (result.status !== 0) fail(`${command} ${args.join(" ")} failed. Nothing was pushed.`);
}

const git = (...args: string[]) => exec("git", args, { quiet: true }).trim();
const gh = (...args: string[]) => exec("gh", args, { quiet: true });

export function bump(version: string, kind: BumpKind): string {
	const [major = 0, minor = 0, patch = 0] = parseVersion(version).numbers;
	if (kind === "major") return `${major + 1}.0.0`;
	if (kind === "minor") return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
}

export function chooseVersion(current: string, latest: string | null, request: string | undefined): string {
	if (request && /^\d+\.\d+\.\d+$/.test(request)) {
		if (latest && compareVersions(request, latest) <= 0) {
			throw new Error(`${request} is not higher than the published ${latest}.`);
		}
		return request;
	}
	if (request && request !== "patch" && request !== "minor" && request !== "major") {
		throw new Error(`Unknown version "${request}". Use patch, minor, major or a version such as 0.2.0.`);
	}
	if (!request && (latest === null || compareVersions(current, latest) > 0)) return current;
	const base = latest && compareVersions(latest, current) > 0 ? latest : current;
	return bump(base, (request as BumpKind | undefined) ?? "patch");
}

function replaceVersion(file: string, from: string, to: string, count: number) {
	const target = path.join(ROOT, file);
	let replaced = 0;
	const text = fs
		.readFileSync(target, "utf8")
		.replace(new RegExp(`"version": "${from.replace(/\./g, "\\.")}"`, "g"), (match) =>
			replaced++ < count ? `"version": "${to}"` : match,
		);
	if (replaced < count) fail(`${file}: expected ${count} "version": "${from}" entries, found ${replaced}.`);
	fs.writeFileSync(target, text);
}

function writeVersion(from: string, to: string) {
	replaceVersion("package.json", from, to, 1);
	replaceVersion("package-lock.json", from, to, 2);
	const readme = path.join(ROOT, "README.md");
	fs.writeFileSync(readme, fs.readFileSync(readme, "utf8").replace(/^Version \d+\.\d+\.\d+/m, `Version ${to}`));
	if (packageVersion() !== to) fail("package.json did not take the new version.");
}

export function mergedPrs(log: string): MergeCommit[] {
	const merges: MergeCommit[] = [];
	for (const line of log.split("\n")) {
		const [sha, parentList = "", subject = ""] = line.split("\t");
		if (!sha) continue;
		const number = Number(/^Merge pull request #(\d+)/.exec(subject)?.[1] ?? /\(#(\d+)\)$/.exec(subject)?.[1]);
		if (!number) continue;
		const [base = "", head = sha] = parentList.split(" ");
		merges.push({ number, sha, base, head });
	}
	return merges;
}

export function learnerChange(body: string): string | null {
	const section = /^##\s+What changes for the learner\s*$([\s\S]*?)(?=^##\s|$(?![\s\S]))/m.exec(body)?.[1] ?? "";
	const text = section.replace(/<!--[\s\S]*?-->/g, "").trim();
	if (!text || /^nothing\b/i.test(text)) return null;
	const [first = "", second] = text.split(/\n\s*\n/).map((block) => block.trim());
	return first.endsWith(":") && second ? `${first}\n${second}` : first;
}

export function composeNotes(prs: ReleasedPr[]): string {
	const indent = (text: string) => text.replace(/\n/g, "\n  ");
	const learner = prs.filter((pr) => pr.change);
	const internal = prs.filter((pr) => !pr.change);
	const sections: string[] = [];
	if (learner.length > 0) {
		const items = learner.map((pr) => `- **${pr.title}.** ${indent(pr.change!)} (#${pr.number})`);
		sections.push(["## What's new", "", ...items].join("\n"));
	}
	if (internal.length > 0) {
		const items = internal.map((pr) => `- ${pr.title} (#${pr.number})`);
		sections.push(["## Under the hood", "", ...items].join("\n"));
	}
	return `${sections.join("\n\n") || "Maintenance release."}\n`;
}

function pullRequest(merge: MergeCommit): { title: string; body: string } {
	const result = spawnSync("gh", ["pr", "view", String(merge.number), "--json", "title,body"], {
		cwd: ROOT,
		encoding: "utf8",
	});
	if (result.status === 0) return JSON.parse(result.stdout) as { title: string; body: string };
	const mergeTitle = git("log", "-1", "--format=%b", merge.sha).split("\n")[0];
	return { title: mergeTitle || `Pull request #${merge.number}`, body: "" };
}

function releasedPrs(previousTag: string): ReleasedPr[] {
	const log = git("log", "--format=%H%x09%P%x09%s", `${previousTag}..HEAD`);
	const claimed = new Set<string>();
	const prs: ReleasedPr[] = [];
	for (const merge of mergedPrs(log).reverse()) {
		const exclude = merge.base ? [`^${merge.base}`] : [];
		const commits = git("rev-list", "--no-merges", merge.head, ...exclude, `^${previousTag}`)
			.split("\n")
			.filter((commit) => commit && !claimed.has(commit));
		if (commits.length === 0) continue;
		for (const commit of commits) claimed.add(commit);
		const { title, body } = pullRequest(merge);
		prs.push({ number: merge.number, title: title.replace(/\.$/, ""), change: learnerChange(body ?? "") });
	}
	return prs;
}

function writeNotes(version: string, latest: string | null, edit: boolean): string {
	step(latest ? `Writing release notes from the pull requests merged since v${latest}` : "Writing release notes");
	const file = path.join(os.tmpdir(), `lanna-release-notes-${version}.md`);
	fs.writeFileSync(file, latest ? composeNotes(releasedPrs(`v${latest}`)) : "First release.\n");
	if (edit) {
		console.log(`  Opening ${file} in your editor. Save and close to continue; an empty file cancels the release.`);
		const editor = git("var", "GIT_EDITOR");
		const result = spawnSync(`${editor} "${file}"`, { cwd: ROOT, stdio: "inherit", shell: true });
		if (result.status !== 0) fail("The editor exited with an error. Nothing was pushed.");
	}
	if (fs.readFileSync(file, "utf8").trim() === "") fail("The release notes are empty. Nothing was pushed.");
	console.log(`\n${fs.readFileSync(file, "utf8")}`);
	return file;
}

function notesFromTag(tag: string): string {
	const file = path.join(os.tmpdir(), `lanna-release-notes-${tag}.md`);
	fs.writeFileSync(file, git("tag", "--list", "--format=%(contents)", tag));
	return file;
}

function preflight() {
	step("Checking the checkout");
	if (git("branch", "--show-current") !== "main") fail("Run this on main.");
	if (git("status", "--porcelain") !== "")
		fail("The working tree has uncommitted changes. Commit or discard them first.");
	git("fetch", "--quiet", "origin", "main", "--tags");
	if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")) {
		fail("main is not in sync with origin/main. Pull or push first.");
	}
	exec("gh", ["auth", "status"], { quiet: true });
}

function runGates() {
	step("Running the release gates locally (typecheck, lint, format, tests)");
	runVisible("bun", ["run", "typecheck"]);
	runVisible("bun", ["run", "lint"]);
	runVisible("bun", ["run", "fmt:check"]);
	const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-release-test-"));
	runVisible("bun", ["run", "test"], { NODE_ENV: "test", LANNA_DATA_DIR: dataDir });
	fs.rmSync(dataDir, { recursive: true, force: true });
}

function tagAndPush(version: string, current: string, notesFile: string) {
	const tag = `v${version}`;
	if (git("tag", "--list", tag) !== "") fail(`Tag ${tag} already exists.`);
	if (version !== current) {
		step(`Bumping ${current} → ${version}`);
		writeVersion(current, version);
		git("add", "package.json", "package-lock.json", "README.md");
		git("commit", "--quiet", "-m", `Release ${version}`);
	}
	git("tag", "-a", "--cleanup=verbatim", "-F", notesFile, tag);
	step(`Pushing main and ${tag}`);
	git("push", "--atomic", "origin", "HEAD:main", tag);
}

async function findRun(owner: string, repo: string, tag: string): Promise<{ id: number; url: string }> {
	for (let waited = 0; waited < 3 * 60_000; waited += 10_000) {
		const runs = JSON.parse(
			gh(
				"run",
				"list",
				"-R",
				`${owner}/${repo}`,
				"--workflow",
				"release.yml",
				"--branch",
				tag,
				"--event",
				"push",
				"--limit",
				"1",
				"--json",
				"databaseId,url",
			),
		) as { databaseId: number; url: string }[];
		if (runs[0]) return { id: runs[0].databaseId, url: runs[0].url };
		await sleep(10_000);
	}
	return fail(`No "Desktop release" run started for ${tag}. Check that GitHub Actions is enabled for the repo.`);
}

async function waitForPackaging(owner: string, repo: string, runId: number): Promise<Job[]> {
	const watched = (job: Job) => job.name !== "Verify draft release";
	let last = "";
	for (let waited = 0; waited < MAX_WAIT_MS; waited += POLL_MS) {
		const { jobs } = JSON.parse(gh("run", "view", String(runId), "-R", `${owner}/${repo}`, "--json", "jobs")) as {
			jobs: Job[];
		};
		const summary = jobs
			.filter(watched)
			.map((job) => `${job.name}: ${job.conclusion || job.status}`)
			.join(" · ");
		if (summary !== last) console.log(`  ${new Date().toLocaleTimeString()}  ${summary}`);
		last = summary;
		const gate = jobs.find((job) => job.name === "Release gates" || job.name === "Prepare one draft");
		if (gate?.conclusion && gate.conclusion !== "success") fail(`${gate.name} ${gate.conclusion}: ${gate.url}`);
		const packaging = jobs.filter((job) => job.name in PACKAGE_JOBS);
		if (packaging.length === Object.keys(PACKAGE_JOBS).length && packaging.every((job) => job.status === "completed")) {
			return packaging;
		}
		await sleep(POLL_MS);
	}
	return fail("Gave up waiting after 200 minutes. Run `bun run release:publish --resume` later.");
}

function verifyDraft(owner: string, repo: string, version: string, platforms: Platform[]) {
	step(`Checking the draft's files and update feeds (${platforms.join(", ")})`);
	const tag = `v${version}`;
	const pages = normalizeReleasePages(
		JSON.parse(gh("api", "--paginate", "--slurp", `repos/${owner}/${repo}/releases?per_page=100`)),
	);
	if (!pages.ok) fail(pages.errors.join("\n"));
	const releases = parseReleases(pages.releases);
	if (!releases.ok) fail(releases.errors.join("\n"));
	const draft = selectDraft(releases.releases, tag, version);
	if (!draft.ok) fail(draft.errors.join("\n"));
	const expected = expectedAssets(version, platforms);
	const assets = verifyAssets(draft.release, expected);
	if (!assets.ok) fail(`The draft is not fit to publish:\n${assets.errors.join("\n")}`);
	const feeds: Record<string, string> = {};
	for (const name of [expected.mac.feed, expected.win.feed, expected.linux.feed]) {
		const asset = draft.release.assets.find((entry) => entry.name === name);
		if (asset)
			feeds[name] = gh(
				"api",
				`repos/${owner}/${repo}/releases/assets/${asset.id}`,
				"-H",
				"Accept: application/octet-stream",
			);
	}
	const metadata = verifyMetadataFiles(feeds, draft.release, expected);
	if (!metadata.ok) fail(`The update feeds are not fit to publish:\n${metadata.errors.join("\n")}`);
}

async function main() {
	const args = process.argv.slice(2);
	const resume = args.includes("--resume");
	const edit = !args.includes("--yes");
	const request = args.find((arg) => !arg.startsWith("--"));
	const { owner, repo } = updateFeedRepo();

	if (args.includes("--notes")) {
		const latest = await latestPublishedVersion();
		git("fetch", "--quiet", "origin", "--tags");
		console.log(latest ? composeNotes(releasedPrs(`v${latest}`)) : "First release.");
		return;
	}

	preflight();
	const current = packageVersion();
	const latest = await latestPublishedVersion();
	let version = current;
	if (resume) {
		if (git("ls-remote", "--tags", "origin", `v${current}`) === "")
			fail(`v${current} is not on origin. Run without --resume.`);
	} else {
		try {
			version = chooseVersion(current, latest, request);
		} catch (error) {
			fail((error as Error).message);
		}
		console.log(`  Published: ${latest ?? "none"} · main: ${current} · releasing: ${version}`);
		runGates();
		tagAndPush(version, current, writeNotes(version, latest, edit));
	}

	const tag = `v${version}`;
	const notesFile = notesFromTag(tag);
	step(`Waiting for the "Desktop release" workflow on ${tag}`);
	const run = await findRun(owner, repo, tag);
	console.log(`  ${run.url}`);
	const packaging = await waitForPackaging(owner, repo, run.id);
	const built = packaging.filter((job) => job.conclusion === "success").map((job) => PACKAGE_JOBS[job.name]!);
	for (const platform of REQUIRED_PLATFORMS) {
		if (!built.includes(platform))
			fail(
				`The ${platform} build failed: ${run.url}. Fix it, then run \`bun run release:publish --resume\` after re-running the workflow.`,
			);
	}
	if (!built.includes("mac"))
		console.warn("\n! The macOS build failed (signing secrets missing?). Publishing without macOS.");

	verifyDraft(owner, repo, version, built);
	step(`Publishing ${tag}`);
	gh(
		"release",
		"edit",
		tag,
		"-R",
		`${owner}/${repo}`,
		"--title",
		`Lanna ${version}`,
		"--notes-file",
		notesFile,
		"--draft=false",
		"--latest",
	);
	console.log(`\n✓ Lanna ${version} is published: https://github.com/${owner}/${repo}/releases/tag/${tag}`);
	console.log(
		"  Installed copies download it at their next check (startup, every 24 hours, or Check for Updates…) and install it on quit.",
	);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
