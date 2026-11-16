import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, afterEach, describe, it } from "node:test";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lh-sub-public-"));
process.env.LANNA_DATA_DIR = path.join(TMP, "data");
process.env.LANNA_AUTH_FILE = path.join(TMP, "auth.json");
fs.writeFileSync(process.env.LANNA_AUTH_FILE, "{}", { mode: 0o600 });
delete process.env.LANNA_DESKTOP_SERVER;
delete process.env.LANNA_DESKTOP_API_SECRET;

const { subscriptionBrowserResponse, subscriptionControlsResponse } =
	await import("../src/server/web-subscription-http.ts");
const { webSubscriptionOwner } = await import("../src/server/web-subscriptions.ts");

after(() => {
	webSubscriptionOwner().close();
	fs.rmSync(TMP, { recursive: true, force: true });
});
afterEach(() => {
	delete process.env.LANNA_PUBLIC_HOST;
});

const origin = "https://learn.example.com";
const sameOrigin = (method: "GET" | "POST", pathname: string, body?: unknown) =>
	new Request(`${origin}${pathname}`, {
		method,
		headers: {
			host: "learn.example.com",
			origin,
			"sec-fetch-site": "same-origin",
			"x-lanna-subscriptions": "1",
			"content-type": "application/json",
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});

describe("subscription sign-ins on a public address", () => {
	it("are refused for every control and the sign-in redirect while LANNA_PUBLIC_HOST is set", async () => {
		process.env.LANNA_PUBLIC_HOST = "learn.example.com";
		for (const request of [
			sameOrigin("GET", "/api/subscriptions"),
			sameOrigin("POST", "/api/subscriptions", { providerId: "chatgpt", op: "login" }),
			sameOrigin("POST", "/api/subscriptions", { providerId: "xai", op: "login" }),
			sameOrigin("POST", "/api/subscriptions", { providerId: "github-copilot", op: "login" }),
		]) {
			const response = await subscriptionControlsResponse(request);
			assert.equal(response.status, 403);
			assert.match(((await response.json()) as { error: string }).error, /public address/);
		}
		for (const method of ["GET", "POST"] as const) {
			const response = await subscriptionBrowserResponse(
				sameOrigin(method, "/api/subscriptions/browser?id=00000000-0000-4000-8000-000000000000"),
			);
			assert.equal(response.status, 403);
		}
	});

	it("stay available on a private setup, where LANNA_PUBLIC_HOST is unset or blank", async () => {
		for (const value of [undefined, "", "   "]) {
			if (value === undefined) delete process.env.LANNA_PUBLIC_HOST;
			else process.env.LANNA_PUBLIC_HOST = value;
			const response = await subscriptionControlsResponse(sameOrigin("GET", "/api/subscriptions"));
			assert.notEqual(response.status, 403, `LANNA_PUBLIC_HOST=${JSON.stringify(value)}`);
		}
	});
});
