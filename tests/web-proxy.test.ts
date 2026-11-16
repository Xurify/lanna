import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, describe, it } from "node:test";
import { NextRequest } from "next/server";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lh-web-proxy-"));
process.env.LH_DATA_DIR = TMP_DATA;
const HOST = "learn.example.com";
const SECRET = "p".repeat(48);
process.env.LH_PUBLIC_HOST = HOST;
process.env.LH_PROXY_SECRET = SECRET;

const { proxy } = await import("../proxy.ts");
const access = await import("../src/server/remote-access-store.ts");
const login = await import("../src/server/web-login-store.ts");

after(() => {
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

const PASSWORD = "a long enough passphrase";
const proxied = (overrides: Record<string, string> = {}) => ({
	host: HOST,
	"x-forwarded-host": HOST,
	"x-forwarded-proto": "https",
	"x-forwarded-for": "203.0.113.7",
	"x-lh-proxy-secret": SECRET,
	...overrides,
});
const call = (pathname: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
	proxy(
		new NextRequest(`http://127.0.0.1:3010${pathname}`, {
			method: init.method ?? "GET",
			headers: init.headers ?? proxied(),
		}),
	);
const passes = (response: Response) => response.headers.get("x-middleware-next") === "1";

describe("proxy.ts at the public address", () => {
	it("refuses everything while web access is off, with a reason that says how to turn it on", async () => {
		const response = await call("/login");
		assert.equal(response.status, 403);
		assert.match(await response.text(), /Web access is off/);
	});

	it("sends a signed-out page request to the sign-in page at the public address, and remembers where it was going", async () => {
		await access.enableRemoteAccess({ issueThisComputer: false });
		const response = await call("/read?id=3");
		assert.equal(response.status, 307);
		assert.equal(response.headers.get("location"), `https://${HOST}/login?next=%2Fread%3Fid%3D3`);
		assert.equal(response.headers.get("cache-control"), "no-store");
	});

	it("answers a signed-out API request with a 401, never a redirect", async () => {
		const response = await call("/api/progress");
		assert.equal(response.status, 401);
		assert.equal((await response.json()).error, "login_required");
		const post = await call("/api/settings", { method: "POST", headers: proxied({ origin: `https://${HOST}` }) });
		assert.equal(post.status, 401);
	});

	it("lets the sign-in page, its POST and the static files through without a session", async () => {
		assert.equal(passes(await call("/login")), true);
		assert.equal(
			passes(await call("/api/access/login", { method: "POST", headers: proxied({ origin: `https://${HOST}` }) })),
			true,
		);
		assert.equal(passes(await call("/_next/static/chunks/app.js")), true);
	});

	it("refuses a request without the proxy secret, whatever else it says", async () => {
		const withoutSecret: Record<string, string>[] = [
			{ host: HOST, "x-forwarded-host": HOST, "x-forwarded-proto": "https" },
			{ host: "127.0.0.1:3010" },
			{ host: "localhost:3010", "x-forwarded-for": "203.0.113.7" },
			proxied({ "x-lh-proxy-secret": "wrong".repeat(10) }),
		];
		for (const headers of withoutSecret) {
			assert.equal((await call("/login", { headers })).status, 403, JSON.stringify(headers));
			assert.equal((await call("/api/progress", { headers })).status, 403, JSON.stringify(headers));
		}
	});

	it("refuses a page request that comes from another site's form", async () => {
		const response = await call("/api/access/login", {
			method: "POST",
			headers: proxied({ origin: "https://evil.example" }),
		});
		assert.equal(response.status, 403);
	});

	it("lets a browser through once it has signed in, and not after it is signed out", async () => {
		await login.setWebPassword(PASSWORD, { params: { N: 1024, r: 8, p: 1, keyLength: 32, saltBytes: 16 } });
		const result = await login.signInWithPassword({ password: PASSWORD, client: "203.0.113.7", deviceName: "iPhone" });
		assert.ok(result.ok);
		if (!result.ok) return;
		const cookie = { cookie: `lh_device=${result.token}` };
		assert.equal(passes(await call("/", { headers: proxied(cookie) })), true);
		assert.equal(passes(await call("/api/progress", { headers: proxied(cookie) })), true);
		assert.equal(
			passes(
				await call("/api/settings", { method: "PUT", headers: proxied({ ...cookie, origin: `https://${HOST}` }) }),
			),
			true,
		);
		assert.equal(
			(await call("/api/settings", { method: "PUT", headers: proxied(cookie) })).status,
			403,
			"a change without the page's Origin",
		);
		await access.revokeToken(result.token);
		assert.equal((await call("/", { headers: proxied(cookie) })).status, 307);
	});

	it("takes a signed-in cookie away when web access is turned off", async () => {
		await login.setWebPassword(PASSWORD, { params: { N: 1024, r: 8, p: 1, keyLength: 32, saltBytes: 16 } });
		const result = await login.signInWithPassword({ password: PASSWORD, client: "203.0.113.8", deviceName: "iPad" });
		assert.ok(result.ok);
		if (!result.ok) return;
		await access.disableRemoteAccess();
		assert.equal((await call("/", { headers: proxied({ cookie: `lh_device=${result.token}` }) })).status, 403);
	});
});
