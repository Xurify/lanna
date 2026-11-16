import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-secrets-"));
process.env.LH_DATA_DIR = path.join(TMP, "data");
process.env.LH_AUTH_FILE = path.join(TMP, "auth.json");
process.env.LH_IGNORE_ENV_KEYS = "1";
delete process.env.LH_DESKTOP_SERVER;
delete process.env.LH_DESKTOP_API_SECRET;

const canary = (name: string) => `canary-${name}-7f3a9c2e51b84d60a1c3e5f70912ab34-wxyz`;
const SECRETS: Record<string, string> = {
	OPENROUTER_API_KEY: canary("openrouter"),
	ELEVENLABS_API_KEY: canary("elevenlabs"),
	DEEPGRAM_API_KEY: canary("deepgram"),
	AZURE_SPEECH_KEY: canary("azure"),
	GROQ_API_KEY: canary("groq"),
	ANTHROPIC_API_KEY: canary("anthropic"),
	TAVILY_API_KEY: canary("tavily"),
	SOME_UNKNOWN_VAR: canary("unknown"),
};
const CREDENTIAL_TOKENS = [
	canary("chatgpt-access"),
	canary("chatgpt-refresh"),
	canary("chatgpt-id"),
	canary("copilot-access"),
	canary("copilot-refresh"),
	canary("xai-access"),
];

fs.mkdirSync(process.env.LH_DATA_DIR, { recursive: true });
fs.writeFileSync(process.env.LH_AUTH_FILE, JSON.stringify(SECRETS), { mode: 0o600 });
fs.writeFileSync(
	path.join(TMP, "chatgpt-credentials.json"),
	JSON.stringify({
		version: 1,
		hostId: "h",
		allowBackgroundUse: true,
		activeId: "a",
		registrations: [
			{
				id: "a",
				clientId: "c",
				issuer: "https://auth.openai.com",
				subject: "s",
				email: "person@example.invalid",
				tokens: {
					accessToken: CREDENTIAL_TOKENS[0],
					refreshToken: CREDENTIAL_TOKENS[1],
					idToken: CREDENTIAL_TOKENS[2],
					scopes: [],
					expiresAt: Date.now() + 3_600_000,
				},
			},
		],
	}),
	{ mode: 0o600 },
);
fs.writeFileSync(
	path.join(TMP, "github-copilot-credentials.json"),
	JSON.stringify({
		version: 1,
		allowBackgroundUse: true,
		connectionId: "00000000-0000-4000-8000-000000000001",
		credential: {
			type: "oauth",
			access: CREDENTIAL_TOKENS[3],
			refresh: CREDENTIAL_TOKENS[4],
			expires: Date.now() + 3_600_000,
		},
	}),
	{ mode: 0o600 },
);
fs.writeFileSync(
	path.join(TMP, "xai-credentials.json"),
	JSON.stringify({
		version: 1,
		allowBackgroundUse: true,
		connectionId: "00000000-0000-4000-8000-000000000002",
		credential: { type: "oauth", access: CREDENTIAL_TOKENS[5], refresh: "r", expires: Date.now() + 3_600_000 },
	}),
	{ mode: 0o600 },
);

const { initAuthEnv, redactSecrets } = await import("../src/server/keys.ts");
initAuthEnv();
const { webSubscriptionOwner } = await import("../src/server/web-subscriptions.ts");

const originalFetch = globalThis.fetch;
after(() => {
	globalThis.fetch = originalFetch;
	webSubscriptionOwner().close();
	fs.rmSync(TMP, { recursive: true, force: true });
});

const everySecret = [...Object.values(SECRETS), ...CREDENTIAL_TOKENS];
/** The key minus its last four characters, which is all a masked row may show. */
const leaks = (text: string): string[] =>
	everySecret.filter(
		(secret) => text.includes(secret) || text.includes(secret.slice(0, -4)) || text.includes(secret.slice(8, 40)),
	);

type Handler = (request: Request, context?: unknown) => Promise<Response> | Response;
const routeFiles = (dir: string): string[] =>
	fs
		.readdirSync(dir, { withFileTypes: true })
		.flatMap((entry) =>
			entry.isDirectory()
				? routeFiles(path.join(dir, entry.name))
				: entry.name === "route.ts"
					? [path.join(dir, entry.name)]
					: [],
		);
const API_ROOT = path.join(import.meta.dirname, "..", "app", "api");

describe("no route answers with a key or a sign-in token", () => {
	it("GET /api/keys shows the last four characters and the length, nothing more", async () => {
		const { GET } = await import("../app/api/keys/route.ts");
		const text = await (await GET()).text();
		assert.deepEqual(leaks(text), []);
		const rows = (JSON.parse(text) as { keys: { id: string; masked: string | null }[] }).keys;
		const row = rows.find((key) => key.id === "OPENROUTER_API_KEY");
		assert.equal(row?.masked, `…wxyz (${SECRETS.OPENROUTER_API_KEY!.length} chars)`);
		assert.ok(rows.some((key) => key.id === "SOME_UNKNOWN_VAR" && key.masked?.startsWith("…wxyz")));
	});

	it("a saved key is answered with its mask, never its value", async () => {
		const { PUT } = await import("../app/api/keys/[id]/route.ts");
		const fresh = "sk-or-v1-0123456789abcdef0123456789abcdef0123456789abcdef-NEWKEY";
		const response = await PUT(
			new Request("http://localhost/api/keys/OPENROUTER_API_KEY", {
				method: "PUT",
				body: JSON.stringify({ value: fresh }),
			}),
			{ params: Promise.resolve({ id: "OPENROUTER_API_KEY" }) },
		);
		const text = await response.text();
		assert.equal(response.status, 200);
		assert.ok(!text.includes(fresh) && !text.includes(fresh.slice(0, -4)));
		SECRETS.OPENROUTER_API_KEY = fresh;
	});

	it("no GET route returns one, however it is reached", async () => {
		const reached: string[] = [];
		for (const file of routeFiles(API_ROOT)) {
			const relative = path.relative(API_ROOT, file).split(path.sep).join("/");
			const handlers = (await import(pathToFileURL(file).href)) as Record<string, Handler>;
			if (!handlers.GET) continue;
			const url = `http://localhost/api/${relative
				.replace(/\/?route\.ts$/, "")
				.replace(/\[\.\.\.\w+\]/, "x/y")
				.replace(/\[\w+\]/g, "nope")}`;
			const context = { params: Promise.resolve({ id: "nope", section: "agent", segment: ["x"] }) };
			let response: Response;
			try {
				response = await handlers.GET(new Request(url), context);
			} catch {
				continue;
			}
			const type = response.headers.get("content-type") ?? "";
			if (type.includes("event-stream")) {
				await response.body?.cancel();
				continue;
			}
			const text = await response.text();
			reached.push(relative);
			assert.deepEqual(leaks(text), [], `GET /api/${relative} returned a key or token`);
			for (const [name, value] of response.headers)
				assert.deepEqual(leaks(value), [], `GET /api/${relative} sent one in the ${name} header`);
		}
		assert.ok(reached.length > 25, `only ${reached.length} routes were reached`);
	});

	it("the subscription status shows who is connected and no token", async () => {
		const { subscriptionControlsResponse } = await import("../src/server/web-subscription-http.ts");
		const origin = "http://localhost:3010";
		const response = await subscriptionControlsResponse(
			new Request(`${origin}/api/subscriptions`, {
				headers: {
					host: "localhost:3010",
					origin,
					"sec-fetch-site": "same-origin",
					"x-langharness-subscriptions": "1",
				},
			}),
		);
		assert.deepEqual(leaks(await response.text()), []);
	});

	it("a provider that echoes the key back in an error does not get it to the page", async () => {
		globalThis.fetch = (async (_url, init) =>
			new Response(`bad request: ${String((init?.headers as Record<string, string>)?.Authorization)}`, {
				status: 401,
			})) as typeof fetch;
		const { GET } = await import("../app/api/stt/token/route.ts");
		const response = await GET();
		const text = await response.text();
		assert.equal(response.status, 502);
		assert.deepEqual(leaks(text), []);
		assert.match(text, /key hidden/);
	});
});

describe("redactSecrets", () => {
	it("removes every key the server holds, wherever it sits in the text", () => {
		const text = `a ${SECRETS.DEEPGRAM_API_KEY} b Token ${SECRETS.ELEVENLABS_API_KEY} c ${SECRETS.SOME_UNKNOWN_VAR}`;
		const out = redactSecrets(text);
		assert.deepEqual(leaks(out), []);
		assert.equal(out, "a [key hidden] b Token [key hidden] c [key hidden]");
	});

	it("leaves ordinary text and a plain setting such as the Azure region alone", () => {
		assert.equal(
			redactSecrets("Azure Speech failed (401): quota exceeded"),
			"Azure Speech failed (401): quota exceeded",
		);
	});

	it("does not treat a short value as a secret to cut out of the text", () => {
		fs.writeFileSync(process.env.LH_AUTH_FILE!, JSON.stringify({ ...SECRETS, SHORT_VAR: "abc" }), { mode: 0o600 });
		assert.equal(redactSecrets("abc abc"), "abc abc");
	});
});
