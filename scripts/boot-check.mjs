import { execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const USAGE = `usage: boot-check.mjs [--standalone <folder with server.js>] [--image-checks] [--url <base of a running server>]
Starts the standalone server on throwaway data with empty keys and checks that it serves and turns away what it should.
--image-checks also checks the container image: no data or keys in it, the files read at run time, a non-root user, a working Chromium and yt-dlp.
--url probes a server that is already running and starts nothing.`;
if (args.includes("--help") || args.includes("-h")) {
	console.log(USAGE);
	process.exit(0);
}
const flag = (name) => args.includes(name);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

const STANDALONE = path.resolve(option("--standalone") ?? path.join(ROOT, ".next", "standalone"));
const BOOT_TIMEOUT_MS = 60_000;
const PUBLIC_NAME = "learn.example.com";
const OUTSIDE_ADDRESS = "203.0.113.9";

const REQUIRED_ASSETS = [
	"server.js",
	"src/agent/system-prompt.md",
	"src/agent/prompts/teacher/20-teaching.md",
	"src/agent/prompts/language/10-slovak.md",
	"curriculum/slovak/lexicon.json",
	"curriculum/slovak/world.json",
	"curriculum/slovak/mixups.json",
	"curriculum/slovak/pairs.json",
	".claude/skills/slovak-language/references",
	".next/static",
	"public",
];
const FORBIDDEN_FILES = [/^data$/, /^auth(-saved)?\.json$/, /^\.env/, /-credentials\.json/];

function freePort() {
	return new Promise((resolve, reject) => {
		const srv = net.createServer();
		srv.listen(0, "127.0.0.1", () => {
			const { port } = srv.address();
			srv.close(() => resolve(port));
		});
		srv.on("error", reject);
	});
}

function request(base, route, headers = {}) {
	const url = new URL(route, base);
	return new Promise((resolve) => {
		const req = http.request(
			{ host: url.hostname, port: url.port, path: url.pathname + url.search, method: "GET", headers },
			(res) => {
				res.resume();
				resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? "" });
			},
		);
		req.on("error", () => resolve({ status: 0, location: "" }));
		req.setTimeout(10_000, () => {
			req.destroy();
			resolve({ status: 0, location: "" });
		});
		req.end();
	});
}

function post(base, route, headers, json) {
	const url = new URL(route, base);
	const payload = JSON.stringify(json);
	return new Promise((resolve) => {
		const req = http.request(
			{
				host: url.hostname,
				port: url.port,
				path: url.pathname,
				method: "POST",
				headers: { ...headers, "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
			},
			(res) => {
				res.resume();
				resolve({
					status: res.statusCode ?? 0,
					location: res.headers.location ?? "",
					cookie: [res.headers["set-cookie"] ?? []].flat().join("; "),
				});
			},
		);
		req.on("error", () => resolve({ status: 0, location: "", cookie: "" }));
		req.setTimeout(10_000, () => {
			req.destroy();
			resolve({ status: 0, location: "", cookie: "" });
		});
		req.end(payload);
	});
}

function firstRunRedirect(res) {
	return res.status === 307 && new URL(res.location, "http://127.0.0.1").pathname === "/start";
}

function turnedAway(res) {
	if (res.status === 401 || res.status === 403) return true;
	if (res.status >= 300 && res.status < 400) {
		const where = new URL(res.location, "http://127.0.0.1").pathname;
		return where === "/pair" || where === "/login";
	}
	return false;
}

const failures = [];
function check(label, ok, detail = "") {
	console.log(`[boot-check] ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
	if (!ok) failures.push(label);
}

async function probeServer(base) {
	const host = new URL(base).host;
	const home = await request(base, "/");
	check(
		"GET / answers (200, or the first-run redirect to /start)",
		home.status === 200 || firstRunRedirect(home),
		`${home.status} ${home.location}`,
	);
	for (const route of ["/start", "/api/models", "/api/settings"]) {
		const res = await request(base, route);
		check(`GET ${route} → 200`, res.status === 200, String(res.status));
	}
	const refusals = [
		["a page addressed to a public name", "/", { host: PUBLIC_NAME }],
		["the API addressed to a public name", "/api/settings", { host: PUBLIC_NAME }],
		["the API with X-Real-IP from a reverse proxy", "/api/settings", { host, "x-real-ip": OUTSIDE_ADDRESS }],
		["a page with X-Real-IP from a reverse proxy", "/", { host, "x-real-ip": OUTSIDE_ADDRESS }],
		["the API with a Forwarded header", "/api/settings", { host, forwarded: `for=${OUTSIDE_ADDRESS}` }],
		["the API with a public X-Forwarded-Host", "/api/settings", { host, "x-forwarded-host": PUBLIC_NAME }],
	];
	for (const [label, route, headers] of refusals) {
		const res = await request(base, route, headers);
		check(`turned away: ${label}`, turnedAway(res), `${res.status} ${res.location}`);
	}
}

function checkImage(dir) {
	for (const asset of REQUIRED_ASSETS) check(`present: ${asset}`, fs.existsSync(path.join(dir, asset)));
	const leaked = fs.readdirSync(dir).filter((name) => FORBIDDEN_FILES.some((pattern) => pattern.test(name)));
	check("no data, keys or env files in the image", leaked.length === 0, leaked.join(", "));
	check(
		"runs as a non-root user",
		typeof process.getuid !== "function" || process.getuid() !== 0,
		`uid ${process.getuid?.()}`,
	);

	const chrome = process.env.CHROME_PATH;
	check("CHROME_PATH names a browser", !!chrome && fs.existsSync(chrome), chrome ?? "unset");
	if (chrome && fs.existsSync(chrome)) {
		const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lh-chrome-"));
		try {
			const dom = execFileSync(
				chrome,
				[
					"--headless",
					"--no-sandbox",
					"--disable-gpu",
					"--disable-dev-shm-usage",
					`--user-data-dir=${profile}`,
					"--dump-dom",
					"about:blank",
				],
				{ timeout: 45_000, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
			);
			check("headless Chromium renders a page", dom.includes("<html"));
		} catch (error) {
			check("headless Chromium renders a page", false, String(error.message).split("\n")[0]);
		} finally {
			fs.rmSync(profile, { recursive: true, force: true });
		}
	}
	try {
		const version = execFileSync("yt-dlp", ["--version"], { timeout: 30_000, encoding: "utf8" }).trim();
		check("yt-dlp runs", /^\d{4}\.\d{2}\.\d{2}/.test(version), version);
	} catch (error) {
		check("yt-dlp runs", false, String(error.message).split("\n")[0]);
	}
}

async function runStartedServer({
	label = "",
	extraEnv = {},
	prepare = () => {},
	probe = probeServer,
	isUp = (res) => res.status === 200 || firstRunRedirect(res),
} = {}) {
	const server = path.join(STANDALONE, "server.js");
	if (!fs.existsSync(server)) {
		console.error(`[boot-check] ${server} is missing; run next build and scripts/build-server.mjs first.`);
		process.exit(1);
	}
	const port = await freePort();
	const home = fs.mkdtempSync(path.join(os.tmpdir(), "lh-boot-"));
	fs.writeFileSync(path.join(home, "auth.json"), "{}\n");
	const env = {
		PATH: process.env.PATH,
		HOME: home,
		NODE_ENV: "production",
		NEXT_TELEMETRY_DISABLED: "1",
		HOSTNAME: "127.0.0.1",
		LH_DATA_DIR: path.join(home, "data"),
		LH_AUTH_FILE: path.join(home, "auth.json"),
		LH_REPO_CHEATSHEETS_DIR: path.join(home, "sheets"),
		LH_IGNORE_ENV_KEYS: "1",
		...(process.env.CHROME_PATH ? { CHROME_PATH: process.env.CHROME_PATH } : {}),
	};
	prepare({ home, env });
	const tail = [];
	const child = spawn(process.execPath, [server], {
		cwd: STANDALONE,
		env: { ...env, ...extraEnv, PORT: String(port) },
		stdio: ["ignore", "pipe", "pipe"],
	});
	let exited = false;
	const keep = (chunk) => tail.push(...String(chunk).split("\n").filter(Boolean));
	child.stdout.on("data", keep);
	child.stderr.on("data", keep);
	child.on("exit", () => {
		exited = true;
	});

	const base = `http://127.0.0.1:${port}`;
	try {
		const deadline = Date.now() + BOOT_TIMEOUT_MS;
		let up = false;
		while (Date.now() < deadline && !exited) {
			const res = await request(base, "/");
			if (isUp(res)) {
				up = true;
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		check(`the server boots${label}`, up, up ? base : exited ? "it exited early" : "no answer in 60 s");
		if (up) await probe(base, extraEnv);
		const wroteHere = fs.existsSync(path.join(STANDALONE, "data"));
		check("it wrote no data folder next to server.js", !wroteHere);
	} finally {
		if (!exited) {
			child.kill("SIGTERM");
			await new Promise((resolve) => {
				child.once("exit", resolve);
				setTimeout(() => {
					child.kill("SIGKILL");
					resolve();
				}, 3000);
			});
		}
		fs.rmSync(home, { recursive: true, force: true });
	}
	if (failures.length > 0) {
		console.error("--- server log tail ---");
		for (const line of tail.slice(-40)) console.error(`    ${line}`);
	}
}

const PASSWORD = "boot-check-password-0123";
const SECRET = "b".repeat(48);
const CLI = path.join(STANDALONE, "cli", "web-password.mjs");

function setPassword({ home, env }) {
	const file = path.join(home, "password.txt");
	fs.writeFileSync(file, `${PASSWORD}\n`, { mode: 0o600 });
	execFileSync(process.execPath, [CLI], {
		env: { ...env, LH_WEB_PASSWORD_FILE: file },
		stdio: "ignore",
		timeout: 60_000,
	});
	fs.rmSync(file, { force: true });
}

async function probePublicMode(base) {
	const proxied = {
		host: PUBLIC_NAME,
		"x-forwarded-host": PUBLIC_NAME,
		"x-forwarded-proto": "https",
		"x-lh-proxy-secret": SECRET,
	};
	const noSecret = { host: PUBLIC_NAME, "x-forwarded-host": PUBLIC_NAME, "x-forwarded-proto": "https" };
	const wrongSecret = { ...proxied, "x-lh-proxy-secret": "c".repeat(48) };
	const notHttps = { ...proxied, "x-forwarded-proto": "http" };
	const refusals = [
		["a loopback Host, as nginx sends by default", "/api/settings", {}],
		["a loopback Host with X-Real-IP", "/api/settings", { "x-real-ip": OUTSIDE_ADDRESS }],
		["the public name without the proxy secret", "/api/settings", noSecret],
		["the public name with a wrong proxy secret", "/api/settings", wrongSecret],
		["the public name over plain HTTP", "/api/settings", notHttps],
		["the pairing page", "/pair", proxied],
	];
	for (const [label, route, headers] of refusals) {
		const res = await request(base, route, headers);
		check(`public mode, not served: ${label}`, res.status !== 200 && turnedAway(res), `${res.status} ${res.location}`);
	}
	const page = await request(base, "/", proxied);
	check(
		"public mode: a page without a session goes to /login",
		page.status >= 300 && page.status < 400 && new URL(page.location, "https://x").pathname === "/login",
		`${page.status} ${page.location}`,
	);
	const api = await request(base, "/api/settings", proxied);
	check("public mode: the API without a session answers 401", api.status === 401, String(api.status));
	const login = await request(base, "/login", proxied);
	check("public mode: /login is served", login.status === 200, String(login.status));

	const origin = { origin: `https://${PUBLIC_NAME}` };
	const wrong = await post(base, "/api/access/login", { ...proxied, ...origin }, { password: "not the password" });
	check("public mode: a wrong password answers 401", wrong.status === 401, String(wrong.status));
	const right = await post(base, "/api/access/login", { ...proxied, ...origin }, { password: PASSWORD });
	check("public mode: the right password signs in", right.status === 200, String(right.status));
	check(
		"public mode: the session cookie is HttpOnly and Secure",
		/lh_device=/.test(right.cookie) && /HttpOnly/i.test(right.cookie) && /Secure/i.test(right.cookie),
	);
	const cookie = right.cookie.match(/lh_device=[^;]+/)?.[0] ?? "";
	const inside = await request(base, "/api/settings", { ...proxied, cookie });
	check("public mode: the API answers with the session", inside.status === 200, String(inside.status));
	const foreign = await post(base, "/api/settings/agent", { ...proxied, cookie, origin: "https://evil.example" }, {});
	check("public mode: a change from another origin is refused", foreign.status === 403, String(foreign.status));
}

async function runPublicMode() {
	if (!fs.existsSync(CLI)) {
		console.log(`[boot-check] skip public mode: ${CLI} is not built (the image has it).`);
		return;
	}
	await runStartedServer({
		label: " in public mode",
		extraEnv: { LH_PUBLIC_HOST: PUBLIC_NAME, LH_PROXY_SECRET: SECRET },
		prepare: setPassword,
		probe: probePublicMode,
		isUp: (res) => res.status === 403,
	});
}

if (flag("--image-checks")) checkImage(STANDALONE);
const target = option("--url");
if (target) await probeServer(target.replace(/\/$/, ""));
else {
	await runStartedServer();
	await runPublicMode();
}

if (failures.length > 0) {
	console.error(`[boot-check] FAILED: ${failures.length} check(s): ${failures.join("; ")}`);
	process.exit(1);
}
console.log("[boot-check] passed.");
