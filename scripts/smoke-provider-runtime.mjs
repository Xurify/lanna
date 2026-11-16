/**
 * OFFLINE native Pi Google initialization gate (no generation or provider calls).
 * Unlike /api/models, this traverses Pi's lazy adapter and constructs GoogleGenAI.
 * The real onPayload hook throws a unique sentinel BEFORE generateContentStream.
 * All file modules must resolve inside the payload, including nested dependencies.
 *
 * node scripts/smoke-provider-runtime.mjs [--standalone <dir>] [--runtime <Node/Electron>]
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire, registerHooks, syncBuiltinESMExports } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

/** @param {Record<string, string | undefined>} env @param {string} home @returns {Record<string, string | undefined>} */
export function probeEnv(env, home) {
	const clean = Object.fromEntries(
		Object.entries(env).filter(
			([key]) =>
				!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) &&
				!/^(AWS_|GOOGLE_|GCLOUD_|CLOUDSDK_|AZURE_|ANTHROPIC_|OPENAI_|OPENROUTER_|GEMINI_)/.test(key) &&
				!["NODE_OPTIONS", "NODE_PATH", "LANNA_DEV_URL", "ELECTRON_RUN_AS_NODE"].includes(key),
		),
	);
	return {
		...clean,
		HOME: home,
		USERPROFILE: home,
		APPDATA: path.join(home, "config"),
		LOCALAPPDATA: path.join(home, "local"),
		XDG_CONFIG_HOME: path.join(home, "config"),
		XDG_CACHE_HOME: path.join(home, "cache"),
		LANNA_DATA_DIR: path.join(home, "data"),
		LANNA_AUTH_FILE: path.join(home, "auth.json"),
		LANNA_IGNORE_ENV_KEYS: "1",
		NODE_ENV: "production",
	};
}

// Keep fetch's nested cause (including AggregateError socket failures), but
// never dump arbitrary error properties such as request headers or environment.
export function formatProbeError(error, depth = 0) {
	if (depth > 5) return "[cause chain truncated]";
	if (!error || typeof error !== "object") return String(error);
	const lines = [
		typeof error.stack === "string" ? error.stack : `${error.name ?? "Error"}: ${error.message ?? "unknown error"}`,
	];
	for (const field of ["code", "errno", "syscall", "address", "port"]) {
		if (["string", "number"].includes(typeof error[field])) lines.push(`${field}: ${error[field]}`);
	}
	if (error.cause !== undefined) lines.push(`cause: ${formatProbeError(error.cause, depth + 1)}`);
	if (Array.isArray(error.errors)) {
		for (const nested of error.errors.slice(0, 8)) lines.push(`aggregate: ${formatProbeError(nested, depth + 1)}`);
	}
	return lines.join("\n");
}

export function verifyProviderRuntime(standalone, runtime = process.execPath) {
	const home = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-provider-runtime-"));
	try {
		fs.writeFileSync(path.join(home, "auth.json"), "{}\n", { mode: 0o600 });
		const result = spawnSync(runtime, [fileURLToPath(import.meta.url), "--probe", path.resolve(standalone)], {
			cwd: home,
			env: { ...probeEnv(process.env, home), ELECTRON_RUN_AS_NODE: "1" },
			encoding: "utf8",
			timeout: 30_000,
			maxBuffer: 128 * 1024,
		});
		if (result.status !== 0 || result.error) {
			throw new Error(
				`provider runtime probe failed (${result.error?.message ?? result.status}):\n${result.stdout ?? ""}${result.stderr ?? ""}`,
			);
		}
		assert.match(result.stdout, /native Pi Google initialization passed/, "probe exited without success marker");
		process.stdout.write(result.stdout);
	} finally {
		fs.rmSync(home, { recursive: true, force: true });
	}
}

// Dedicated child only: nothing delegates to a live transport, even if the SDK
// changes its fetch path. Count attempts as well: a swallowed guard error fails.
function closeNetwork() {
	let attempts = 0;
	const deny = () => {
		attempts++;
		throw new Error("OFFLINE provider gate: network forbidden");
	};
	globalThis.fetch = deny;
	globalThis.WebSocket = class {
		constructor() {
			deny();
		}
	};
	const require = createRequire(import.meta.url);
	for (const [name, methods] of [
		["http", ["request", "get"]],
		["https", ["request", "get"]],
		["net", ["connect", "createConnection"]],
		["tls", ["connect"]],
		["dgram", ["createSocket"]],
		["dns", ["lookup", "resolve", "resolve4", "resolve6", "resolveAny", "reverse"]],
		["dns/promises", ["lookup", "resolve", "resolve4", "resolve6", "resolveAny", "reverse"]],
	]) {
		const mod = require(`node:${name}`);
		for (const method of methods) mod[method] = deny;
	}
	require("node:net").Socket.prototype.connect = deny;
	syncBuiltinESMExports();
	return () => assert.equal(attempts, 0, "SDK attempted network access");
}

async function probe(standalone) {
	const noNetwork = closeNetwork();
	const root = fs.realpathSync(standalone);
	const inside = (file) => {
		const relative = path.relative(root, fs.realpathSync(file));
		assert.ok(
			relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
			`dependency escaped standalone payload: ${file}`,
		);
	};
	const loaded = new Set();
	const hooks = registerHooks({
		resolve(specifier, context, nextResolve) {
			const result = nextResolve(specifier, context);
			if (result.url.startsWith("file:")) {
				inside(fileURLToPath(result.url));
				loaded.add(fileURLToPath(result.url));
			} else assert.ok(result.url.startsWith("node:"), `unexpected dependency URL: ${result.url}`);
			return result;
		},
	});
	try {
		// Pi is an explicit server external. Import its shipped public entry and
		// factories, never the checkout's module or a direct/fake Google adapter.
		const entry = pathToFileURL(path.join(root, "node_modules/@earendil-works/pi-ai/dist/index.js"));
		const { createModels } = await import(entry.href);
		const models = createModels();
		for (const [name, factory] of [
			["google", "googleProvider"],
			["opencode", "opencodeProvider"],
			["opencode-go", "opencodeGoProvider"],
		]) {
			const provider = (await import(new URL(`providers/${name}.js`, entry).href))[factory]();
			models.setProvider(provider);
			const model = provider.getModels().find((candidate) => candidate.api === "google-generative-ai");
			assert.ok(model, `${name}: missing Google-backed catalog model`);
			const sentinel = `LANNA_OFFLINE_ON_PAYLOAD_${randomUUID()}`;
			let reached = 0;
			const result = await models
				.streamSimple(
					model,
					{ messages: [{ role: "user", content: "Offline initialization only", timestamp: 0 }] },
					{
						apiKey: "dummy-offline-provider-gate-not-a-key",
						onPayload(payload, selected) {
							assert.equal(selected.api, "google-generative-ai");
							assert.ok(payload && typeof payload === "object");
							reached++;
							throw new Error(sentinel);
						},
					},
				)
				.result();
			assert.equal(reached, 1, `${name}: did not reach onPayload: ${result.errorMessage}`);
			assert.equal(result.stopReason, "error");
			assert.equal(result.errorMessage, sentinel, `${name}: unexpected initialization error`);
			noNetwork();
			console.log(`[smoke-provider-runtime] ${name}: native lazy Google adapter reached onPayload; generation stopped`);
		}
		// Exercise the public lazy OAuth surface offline. toAuth evaluates the
		// real flow module and its imports but neither logs in nor refreshes.
		for (const [name, factory] of [
			["github-copilot", "githubCopilotProvider"],
			["xai", "xaiProvider"],
		]) {
			const provider = (await import(new URL(`providers/${name}.js`, entry).href))[factory]();
			const credential = {
				type: "oauth",
				access:
					name === "github-copilot"
						? "tid=offline;proxy-ep=proxy.individual.githubcopilot.com;"
						: "offline-xai-oauth-not-a-token",
				refresh: "offline-refresh-not-a-token",
				expires: Date.now() + 3600000,
				availableModelIds: provider.getModels().map((model) => model.id),
			};
			const auth = await provider.auth.oauth.toAuth(credential);
			assert.equal(auth.apiKey, credential.access);
			if (name === "github-copilot") assert.equal(auth.baseUrl, "https://api.individual.githubcopilot.com");
			const seenApis = new Set();
			for (const model of provider.getModels()) {
				if (seenApis.has(model.api)) continue;
				seenApis.add(model.api);
				const sentinel = `LANNA_OFFLINE_SUBSCRIPTION_${randomUUID()}`;
				let reached = 0;
				const result = await provider
					.streamSimple(
						{ ...model, ...(auth.baseUrl ? { baseUrl: auth.baseUrl } : {}) },
						{ messages: [{ role: "user", content: "Offline initialization only", timestamp: 0 }] },
						{
							...auth,
							maxRetries: 0,
							onPayload() {
								reached++;
								throw new Error(sentinel);
							},
						},
					)
					.result();
				assert.equal(reached, 1, `${name}/${model.api}: ${result.errorMessage}`);
				assert.equal(result.errorMessage, sentinel);
			}
			noNetwork();
			console.log(
				`[smoke-provider-runtime] ${name}: public native OAuth and ${seenApis.size} transport APIs initialized offline`,
			);
		}
		// Resolution/evaluation, not folder-exists checks. This also covers the
		// previously missing transitive edge and permits legitimate nested deps.
		for (const name of ["@google/genai", "google-auth-library", "gcp-metadata", "json-bigint", "bignumber.js"]) {
			assert.ok(
				[...loaded].some((file) =>
					file.includes(`${path.sep}node_modules${path.sep}${name.replaceAll("/", path.sep)}${path.sep}`),
				),
				`Google runtime chain was not loaded: ${name}`,
			);
		}
		console.log(
			`[smoke-provider-runtime] native Pi Google initialization passed; ${loaded.size} modules confined to ${root}; zero network attempts`,
		);
	} finally {
		hooks.deregister();
	}
}

async function main() {
	const args = process.argv.slice(2);
	if (args[0] === "--probe") return probe(args[1]);
	const value = (name, fallback) => {
		const index = args.indexOf(name);
		if (index < 0) return fallback;
		assert.ok(args[index + 1] && !args[index + 1].startsWith("--"), `${name} requires a path`);
		return path.resolve(args[index + 1]);
	};
	verifyProviderRuntime(
		value("--standalone", path.resolve(import.meta.dirname, "../.next/standalone")),
		value("--runtime", process.execPath),
	);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(`[smoke-provider-runtime] FAIL: ${formatProbeError(error)}`);
		process.exitCode = 1;
	});
}
