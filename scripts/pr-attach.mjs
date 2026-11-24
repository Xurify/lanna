import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const IMAGE_LINK_PATTERN = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function findLocalImages(markdown, baseDir) {
	const found = [];
	const seen = new Set();
	for (const match of markdown.matchAll(IMAGE_LINK_PATTERN)) {
		const rawTarget = match[1];
		if (!rawTarget || /^https?:\/\//i.test(rawTarget) || rawTarget.startsWith("data:")) continue;
		const resolved = path.resolve(baseDir, rawTarget);
		if (!seen.has(resolved)) {
			seen.add(resolved);
			found.push({ rawTarget, resolved });
		}
	}
	return found;
}

export function findUnresolvedLocalImages(markdown) {
	const unresolved = [];
	for (const match of markdown.matchAll(IMAGE_LINK_PATTERN)) {
		const rawTarget = match[1];
		if (!rawTarget || /^https?:\/\//i.test(rawTarget) || rawTarget.startsWith("data:")) continue;
		unresolved.push(rawTarget);
	}
	return unresolved;
}

export function parsePrAttachArgs(args) {
	const mode = args[0];
	if (mode !== "create" && mode !== "edit") {
		throw new Error("First argument must be 'create' or 'edit'");
	}
	const passthrough = [];
	let bodyFile = "";
	let prNumber = "";
	let repo = "";

	for (let index = 1; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--body-file" || arg === "-F") {
			bodyFile = args[++index] ?? "";
			passthrough.push(arg, bodyFile);
		} else if (arg === "-R" || arg === "--repo") {
			repo = args[++index] ?? "";
			passthrough.push(arg, repo);
		} else if (mode === "edit" && !prNumber && !arg.startsWith("-")) {
			prNumber = arg;
			passthrough.push(arg);
		} else {
			passthrough.push(arg);
		}
	}
	return { mode, prNumber, bodyFile, repo, passthrough };
}

function runGh(ghArgs) {
	const result = spawnSync("gh", ghArgs, { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
	if (result.status !== 0) {
		throw new Error(`gh ${ghArgs.join(" ")} failed:\n${result.stderr || result.stdout}`);
	}
	return result.stdout.trim();
}

function main() {
	const rawArgs = process.argv.slice(2);
	if (rawArgs.length === 0 || rawArgs.includes("-h") || rawArgs.includes("--help")) {
		console.log(
			"Usage:\n" +
				'  node scripts/pr-attach.mjs create --title "..." --body-file pr-body.md [gh pr create flags...]\n' +
				"  node scripts/pr-attach.mjs edit <pr-number> --body-file pr-body.md [gh pr edit flags...]\n" +
				"Verifies every local Markdown image exists, attaches them via `gh --attach`, and confirms none remain unresolved.",
		);
		process.exit(rawArgs.length === 0 ? 1 : 0);
	}

	const { mode, prNumber, bodyFile, repo, passthrough } = parsePrAttachArgs(rawArgs);
	if (!bodyFile) throw new Error("--body-file is required");
	const absoluteBody = path.resolve(bodyFile);
	const markdown = fs.readFileSync(absoluteBody, "utf8");
	const images = findLocalImages(markdown, path.dirname(absoluteBody));
	const missing = images.filter((image) => !fs.existsSync(image.resolved));
	if (missing.length > 0) {
		throw new Error(`Missing screenshot file(s):\n${missing.map((item) => `  - ${item.rawTarget}`).join("\n")}`);
	}

	const attachArgs = images.flatMap((image) => ["--attach", image.resolved]);
	const ghArgs = ["pr", mode, ...passthrough, ...attachArgs];
	const output = runGh(ghArgs);
	console.log(output);

	const targetPr = prNumber || output.match(/\/pull\/(\d+)/)?.[1] || "";
	if (!targetPr) return;

	const viewArgs = ["pr", "view", targetPr, "--json", "body", "--jq", ".body"];
	if (repo) viewArgs.push("-R", repo);
	const liveBody = runGh(viewArgs);
	const unresolved = findUnresolvedLocalImages(liveBody);
	if (unresolved.length > 0) {
		throw new Error(`PR #${targetPr} still contains unresolved local image links: ${unresolved.join(", ")}`);
	}
	console.log(`Verified PR #${targetPr}: ${images.length} local image(s) resolved with 0 broken links.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
