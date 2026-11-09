import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-body-limits-"));
process.env.LH_DATA_DIR = TMP;

const { BODY_LIMITS, bodyTooLarge } = await import("../src/server/body-limit.ts");

after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const withLength = (length: string | null, method = "POST") =>
	new Request("http://localhost/api/x", { method, headers: length === null ? {} : { "content-length": length }, body: method === "GET" ? undefined : "{}" });

describe("bodyTooLarge", () => {
	it("passes a body at or under the limit, and a request that announces none", () => {
		assert.equal(bodyTooLarge(withLength("10"), 100), null);
		assert.equal(bodyTooLarge(withLength("100"), 100), null);
		assert.equal(bodyTooLarge(withLength("0"), 100), null);
		assert.equal(bodyTooLarge(new Request("http://localhost/api/x"), 100), null);
	});

	it("answers 413 with a plain message over the limit", async () => {
		const response = bodyTooLarge(withLength("101"), 100);
		assert.equal(response?.status, 413);
		assert.equal(((await response?.json()) as { error: string }).error, "request too large");
	});

	it("refuses a length that is not a number or is negative", () => {
		assert.equal(bodyTooLarge(withLength("lots"), 100)?.status, 413);
		assert.equal(bodyTooLarge(withLength("-5"), 100)?.status, 413);
	});

	it("keeps the audio limit above the recording cap the engines accept", async () => {
		const { STT_MAX_BYTES } = await import("../src/server/speak.ts");
		assert.ok(BODY_LIMITS.recording > STT_MAX_BYTES);
		assert.ok(BODY_LIMITS.cheatsheet > 200_000);
	});
});

const oversizedCall = async (route: string, method: "POST" | "PUT", bytes: number, params?: Record<string, string>) => {
	const handlers = (await import(`../app/api/${route}/route.ts`)) as Record<string, (request: Request, context?: unknown) => Promise<Response>>;
	const request = new Request(`http://localhost/api/${route}`, { method, headers: { "content-type": "application/json", "content-length": String(bytes) }, body: "{}" });
	return handlers[method]!(request, params ? { params: Promise.resolve(params) } : undefined);
};

describe("routes refuse an oversized body with 413", () => {
	const over = BODY_LIMITS.json + 1;
	const cases: [string, "POST" | "PUT", number, Record<string, string>?][] = [
		["lesson", "POST", over],
		["chat", "POST", over],
		["chats", "POST", over],
		["review", "POST", over],
		["watch", "POST", over],
		["words", "POST", over],
		["keys/OPENROUTER_API_KEY", "PUT", over, { id: "OPENROUTER_API_KEY" }],
		["settings/agent", "PUT", over, { section: "agent" }],
		["cheatsheets", "POST", BODY_LIMITS.cheatsheet + 1],
		["watch/discover", "POST", BODY_LIMITS.import + 1],
		["stt", "POST", BODY_LIMITS.recording + 1],
		["speak", "POST", BODY_LIMITS.recording + 1],
		["pronounce", "POST", BODY_LIMITS.recording + 1],
	];
	for (const [route, method, bytes, params] of cases) {
		it(`${method} /api/${route}`, async () => {
			const response = await oversizedCall(route.startsWith("keys/") ? "keys/[id]" : route.startsWith("settings/") ? "settings/[section]" : route, method, bytes, params);
			assert.equal(response.status, 413);
		});
	}
});

describe("every route that takes a body checks its size first", () => {
	const root = path.join(import.meta.dirname, "..", "app", "api");
	const routes = (dir: string): string[] =>
		fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? routes(path.join(dir, entry.name)) : entry.name === "route.ts" ? [path.join(dir, entry.name)] : []));
	const handled = /^export async function (POST|PUT|PATCH|DELETE)\((req|request)\b/m;
	const own = ["access", "subscriptions"];

	for (const file of routes(root)) {
		const relative = path.relative(root, file).split(path.sep).join("/");
		if (own.some((prefix) => relative.startsWith(`${prefix}/`) || relative === `${prefix}/route.ts`)) continue;
		const source = fs.readFileSync(file, "utf8");
		if (!handled.test(source)) continue;
		it(relative, () => assert.match(source, /bodyTooLarge\(/));
	}
});
