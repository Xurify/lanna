import assert from "node:assert/strict";
import { describe, it } from "node:test";

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

async function rulesFor(nodeEnv: "production" | "development"): Promise<Rule[]> {
	const previous = process.env.NODE_ENV;
	(process.env as Record<string, string>).NODE_ENV = nodeEnv;
	try {
		const { default: configure } = (await import(`../next.config.ts?env=${nodeEnv}`)) as {
			default: (phase: string) => { headers: () => Promise<Rule[]> };
		};
		const config = configure("phase-production-build");
		return await config.headers();
	} finally {
		(process.env as Record<string, string | undefined>).NODE_ENV = previous;
	}
}

function headersOf(rules: Rule[], source: string): Map<string, string> {
	const rule = rules.find((r) => r.source === source);
	assert.ok(rule, `no header rule for ${source}`);
	return new Map(rule.headers.map((header) => [header.key, header.value]));
}

const directives = (policy: string) =>
	new Map(
		policy
			.split(";")
			.map((part) => part.trim().split(/\s+/))
			.map(([name, ...values]) => [name!, values]),
	);

describe("response headers", () => {
	it("every build refuses sniffing, framing and cross-origin reads, and keeps the microphone for this page only", async () => {
		for (const env of ["production", "development"] as const) {
			const headers = headersOf(await rulesFor(env), "/:path*");
			assert.equal(headers.get("X-Content-Type-Options"), "nosniff", env);
			assert.equal(headers.get("X-Frame-Options"), "DENY", env);
			assert.equal(headers.get("Cross-Origin-Resource-Policy"), "same-origin", env);
			assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin", env);
			const permissions = headers.get("Permissions-Policy")!;
			assert.match(permissions, /microphone=\(self\)/);
			for (const feature of ["camera", "geolocation", "payment", "usb"])
				assert.match(permissions, new RegExp(`${feature}=\\(\\)`));
		}
	});

	it("the widget paths override framing and open the sandbox's cross-origin reads, in both builds", async () => {
		for (const env of ["production", "development"] as const) {
			const rules = await rulesFor(env);
			const host = headersOf(rules, "/declare/host.html");
			assert.equal(host.get("X-Frame-Options"), "SAMEORIGIN", env);
			const assets = headersOf(rules, "/declare/:path*");
			assert.equal(assets.get("Access-Control-Allow-Origin"), "*", env);
			assert.equal(assets.get("Cross-Origin-Resource-Policy"), "cross-origin", env);
			const api = headersOf(rules, "/api/declare-widget/:path*");
			assert.equal(api.get("Access-Control-Allow-Origin"), "*", env);
			assert.equal(api.get("Cross-Origin-Resource-Policy"), "cross-origin", env);
		}
	});

	it("the development server sends no content security policy and no HSTS", async () => {
		for (const source of ["/:path*", "/declare/host.html"]) {
			const headers = headersOf(await rulesFor("development"), source);
			assert.equal(headers.has("Content-Security-Policy"), false, source);
			assert.equal(headers.has("Strict-Transport-Security"), false, source);
		}
	});

	it("a production build sends HSTS and a policy that stops data leaving and code arriving from elsewhere", async () => {
		const headers = headersOf(await rulesFor("production"), "/:path*");
		assert.match(headers.get("Strict-Transport-Security")!, /^max-age=\d{7,}$/);
		const policy = directives(headers.get("Content-Security-Policy")!);
		assert.deepEqual(policy.get("default-src"), ["'self'"]);
		assert.deepEqual(policy.get("object-src"), ["'none'"]);
		assert.deepEqual(policy.get("base-uri"), ["'self'"]);
		assert.deepEqual(policy.get("form-action"), ["'self'"]);
		assert.deepEqual(policy.get("frame-ancestors"), ["'none'"]);
		assert.deepEqual(policy.get("connect-src"), ["'self'", "wss://api.deepgram.com"]);
		assert.deepEqual(policy.get("frame-src"), [
			"'self'",
			"https://www.youtube-nocookie.com",
			"https://www.youtube.com",
		]);
		for (const [name, values] of policy) {
			assert.ok(!values.includes("*"), `${name} must not allow every host`);
			assert.ok(!values.includes("'unsafe-eval'"), `${name} must not allow eval`);
			assert.ok(!values.includes("http:"), `${name} must not allow plain http`);
		}
		for (const origin of policy.get("img-src")!)
			assert.ok(
				origin.startsWith("'self'") ||
					origin === "data:" ||
					origin === "blob:" ||
					/^https:\/\/[a-z0-9.]+$/.test(origin),
				origin,
			);
	});

	it("the widget host's own policy is framed by this app alone and holds eval inside the sandbox", async () => {
		const headers = headersOf(await rulesFor("production"), "/declare/host.html");
		const policy = directives(headers.get("Content-Security-Policy")!);
		assert.deepEqual(policy.get("frame-ancestors"), ["'self'"]);
		assert.ok(policy.get("script-src")!.includes("'unsafe-eval'"), "the widget compiler needs eval");
		assert.deepEqual(policy.get("default-src"), ["'self'"]);
	});
});
