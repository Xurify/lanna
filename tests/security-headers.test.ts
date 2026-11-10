import assert from "node:assert/strict";
import { describe, it } from "node:test";

type Header = { key: string; value: string };

async function headersFor(nodeEnv: "production" | "development"): Promise<Map<string, string>> {
	const previous = process.env.NODE_ENV;
	(process.env as Record<string, string>).NODE_ENV = nodeEnv;
	try {
		const { default: config } = (await import(`../next.config.ts?env=${nodeEnv}`)) as { default: { headers: () => Promise<{ source: string; headers: Header[] }[]> } };
		const rules = await config.headers();
		assert.equal(rules.length, 1);
		assert.equal(rules[0]!.source, "/:path*");
		return new Map(rules[0]!.headers.map((header) => [header.key, header.value]));
	} finally {
		(process.env as Record<string, string | undefined>).NODE_ENV = previous;
	}
}

const directives = (policy: string) => new Map(policy.split(";").map((part) => part.trim().split(/\s+/)).map(([name, ...values]) => [name!, values]));

describe("response headers", () => {
	it("every build refuses sniffing, framing and cross-origin reads, and keeps the microphone for this page only", async () => {
		for (const env of ["production", "development"] as const) {
			const headers = await headersFor(env);
			assert.equal(headers.get("X-Content-Type-Options"), "nosniff", env);
			assert.equal(headers.get("X-Frame-Options"), "DENY", env);
			assert.equal(headers.get("Cross-Origin-Resource-Policy"), "same-origin", env);
			assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin", env);
			const permissions = headers.get("Permissions-Policy")!;
			assert.match(permissions, /microphone=\(self\)/);
			for (const feature of ["camera", "geolocation", "payment", "usb"]) assert.match(permissions, new RegExp(`${feature}=\\(\\)`));
		}
	});

	it("the development server sends no content security policy and no HSTS", async () => {
		const headers = await headersFor("development");
		assert.equal(headers.has("Content-Security-Policy"), false);
		assert.equal(headers.has("Strict-Transport-Security"), false);
	});

	it("a production build sends HSTS and a policy that stops data leaving and code arriving from elsewhere", async () => {
		const headers = await headersFor("production");
		assert.match(headers.get("Strict-Transport-Security")!, /^max-age=\d{7,}$/);
		const policy = directives(headers.get("Content-Security-Policy")!);
		assert.deepEqual(policy.get("default-src"), ["'self'"]);
		assert.deepEqual(policy.get("object-src"), ["'none'"]);
		assert.deepEqual(policy.get("base-uri"), ["'self'"]);
		assert.deepEqual(policy.get("form-action"), ["'self'"]);
		assert.deepEqual(policy.get("frame-ancestors"), ["'none'"]);
		assert.deepEqual(policy.get("connect-src"), ["'self'", "wss://api.deepgram.com"]);
		assert.deepEqual(policy.get("frame-src"), ["https://www.youtube-nocookie.com", "https://www.youtube.com"]);
		for (const [name, values] of policy) {
			assert.ok(!values.includes("*"), `${name} must not allow every host`);
			assert.ok(!values.includes("'unsafe-eval'"), `${name} must not allow eval`);
			assert.ok(!values.includes("http:"), `${name} must not allow plain http`);
		}
		for (const origin of policy.get("img-src")!) assert.ok(origin.startsWith("'self'") || origin === "data:" || origin === "blob:" || /^https:\/\/[a-z0-9.]+$/.test(origin), origin);
	});
});
