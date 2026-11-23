#!/usr/bin/env node
// Build the Windows installer from this checkout and install it over the copy on this PC.
//   npm run desktop:install                 full build, install, relaunch
//   npm run desktop:install -- --skip-build install the installer already in dist/
//   npm run desktop:install -- --no-launch  do not start Lanna afterwards
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const INSTALLED_EXE = path.join(process.env.LOCALAPPDATA ?? "", "Programs", "lanna", "Lanna.exe");

function fail(message) {
	console.error(`✗ ${message}`);
	process.exit(1);
}

function run(command, commandArgs) {
	console.log(`\n▶ ${command} ${commandArgs.join(" ")}`);
	const result = spawnSync(command, commandArgs, { cwd: ROOT, stdio: "inherit", shell: true });
	if (result.status !== 0) fail(`${command} ${commandArgs.join(" ")} exited with ${result.status}`);
}

function build() {
	fs.rmSync(path.join(ROOT, "dist"), { recursive: true, force: true });
	fs.rmSync(path.join(ROOT, ".next", "standalone"), { recursive: true, force: true });
	run("npm", ["run", "build"]);
	run("node", ["scripts/smoke-provider-runtime.mjs"]);
	run("node", ["scripts/build-server.mjs"]);
	run("node", ["scripts/smoke-server.mjs", "--electron"]);
	run("npx", ["electron-builder", "--win", "--x64", "--publish", "never"]);
}

function builtInstaller() {
	const feed = path.join(ROOT, "dist", "latest.yml");
	if (!fs.existsSync(feed)) fail("dist/latest.yml is missing. Run without --skip-build.");
	const text = fs.readFileSync(feed, "utf8");
	const version = /^version:\s*(\S+)/m.exec(text)?.[1];
	const file = /^path:\s*(\S+)/m.exec(text)?.[1];
	const installer = file && path.join(ROOT, "dist", file);
	if (!version || !installer || !fs.existsSync(installer))
		fail("dist/latest.yml does not point at an installer in dist/.");
	return { version, installer };
}

function lannaIsRunning() {
	const result = spawnSync("tasklist", ["/FI", "IMAGENAME eq Lanna.exe", "/NH"], { encoding: "utf8" });
	return result.stdout.includes("Lanna.exe");
}

async function closeLanna() {
	if (!lannaIsRunning()) return;
	console.log("\n▶ Closing Lanna");
	spawnSync("taskkill", ["/IM", "Lanna.exe", "/T"], { stdio: "ignore" });
	for (let i = 0; i < 10 && lannaIsRunning(); i++) await new Promise((resolve) => setTimeout(resolve, 1000));
	if (lannaIsRunning()) spawnSync("taskkill", ["/IM", "Lanna.exe", "/T", "/F"], { stdio: "ignore" });
}

function installedVersion() {
	const result = spawnSync(
		"powershell",
		["-NoProfile", "-Command", `(Get-Item -LiteralPath '${INSTALLED_EXE}').VersionInfo.ProductVersion`],
		{ encoding: "utf8" },
	);
	return result.stdout.trim();
}

async function main() {
	if (process.platform !== "win32") fail("desktop:install installs the Windows app; run it on Windows.");
	if (!args.has("--skip-build")) build();
	const { version, installer } = builtInstaller();
	await closeLanna();
	console.log(`\n▶ Installing ${path.basename(installer)}`);
	// /S is the NSIS silent switch; electron-builder's per-user installer replaces the existing copy in place.
	const install = spawnSync(installer, ["/S"], { stdio: "inherit" });
	if (install.status !== 0) fail(`The installer exited with ${install.status}`);
	const now = installedVersion();
	// Windows file versions have four parts: 0.1.2 is stamped as 0.1.2.0.
	if (now !== version && now !== `${version}.0`) fail(`Expected ${version} at ${INSTALLED_EXE}, found "${now}".`);
	console.log(`\n✓ Lanna ${version} is installed.`);
	if (!args.has("--no-launch")) spawn(INSTALLED_EXE, [], { detached: true, stdio: "ignore" }).unref();
}

await main();
