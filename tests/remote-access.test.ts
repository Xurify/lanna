/**
 * REMOTE ACCESS RULES (E21, 2026-11-01): the pure decision for every page and
 * API request, the cookie and host helpers, and the pairing-code input. No
 * file is touched; the store has its own test (remote-access-store.test.ts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DEVICE_COOKIE,
	decideAccess,
	deviceCookie,
	deviceNameFromAgent,
	cleanDeviceName,
	formatCode,
	listeningPort,
	normalizeCode,
	publicPath,
	readCookie,
	secureRequest,
	tailnetHost,
	type AccessInput,
} from "../src/server/remote-access.ts";

function input(
	overrides: Partial<Omit<AccessInput, "headers">> & { headers?: Record<string, string> } = {},
): AccessInput {
	const { headers, ...rest } = overrides;
	return {
		pathname: "/",
		method: "GET",
		host: "localhost:3010",
		headers: new Headers(headers),
		enabled: false,
		desktopWindow: false,
		desktopApiOk: true,
		paired: false,
		...rest,
	};
}

describe("remote access off (the default): the old rules, plus two refusals", () => {
	it("serves pages and the API to this computer", () => {
		assert.deepEqual(decideAccess(input()), { action: "allow" });
		assert.deepEqual(decideAccess(input({ pathname: "/api/settings" })), { action: "allow" });
	});

	it("keeps the desktop check on the API, as before", () => {
		const decision = decideAccess(input({ pathname: "/api/settings", desktopApiOk: false }));
		assert.equal(decision.action, "refuse");
		assert.match(decision.action === "refuse" ? decision.message : "", /trusted LangHarness window/);
	});

	it("refuses another host, on pages and on the API", () => {
		const page = decideAccess(input({ host: "evil.example" }));
		assert.deepEqual(page, { action: "refuse", message: "LangHarness only answers this computer." });
		const api = decideAccess(input({ host: "evil.example", pathname: "/api/chats" }));
		assert.deepEqual(api, { action: "refuse", message: "The LangHarness API only answers this computer." });
	});

	it("reads the original name from x-forwarded-host, because the router rewrites Host on the way in", () => {
		const hidden = decideAccess(input({ host: "127.0.0.1:44444", headers: { "x-forwarded-host": "evil.example" } }));
		assert.equal(hidden.action, "refuse");
		assert.deepEqual(
			decideAccess(input({ host: "127.0.0.1:44444", headers: { "x-forwarded-host": "localhost:3010" } })),
			{ action: "allow" },
		);
	});

	it("does not take the router's own x-forwarded-host for a proxy", () => {
		assert.deepEqual(
			decideAccess(input({ host: "localhost:3010", headers: { "x-forwarded-host": "localhost:3010" } })),
			{ action: "allow" },
		);
	});

	it("refuses a request a proxy marked, so a running Serve cannot leak in while the switch is off", () => {
		for (const header of ["Tailscale-User-Login", "Tailscale-User-Name", "Forwarded", "X-Real-IP"]) {
			const decision = decideAccess(input({ host: "127.0.0.1:3010", headers: { [header]: "1" } }));
			assert.equal(decision.action, "refuse", header);
			assert.match(decision.action === "refuse" ? decision.message : "", /Remote access is off/);
		}
	});

	it("does not treat the x-forwarded-* headers Next sets on every request as proof of a proxy", () => {
		const nextsOwn = {
			"x-forwarded-for": "127.0.0.1",
			"x-forwarded-proto": "http",
			"x-forwarded-port": "3010",
			"x-forwarded-host": "localhost:3010",
		};
		assert.deepEqual(decideAccess(input({ headers: nextsOwn })), { action: "allow" });
	});
});

describe("remote access on: this computer always passes; a proxied request needs a paired device", () => {
	const on = { enabled: true };
	// What Tailscale Serve hands the app for a phone: a tailnet name and an identity header.
	const phone = { ...on, host: "pc.tail1234.ts.net", headers: { "tailscale-user-login": "phone@example.test" } };

	it("lets this computer's own browser open pages and the API without a code", () => {
		assert.deepEqual(decideAccess(input({ ...on, pathname: "/" })), { action: "allow" });
		assert.deepEqual(decideAccess(input({ ...on, pathname: "/chat/new" })), { action: "allow" });
		assert.deepEqual(decideAccess(input({ ...on, pathname: "/api/chats" })), { action: "allow" });
		assert.deepEqual(decideAccess(input({ ...on, pathname: "/api/access" })), { action: "allow" });
	});

	it("gives this computer the same answer with the switch on or off, on every path", () => {
		for (const pathname of ["/", "/chat/new", "/api/settings", "/api/access", "/pair"]) {
			for (const desktopApiOk of [true, false]) {
				const switchOff = decideAccess(input({ pathname, desktopApiOk }));
				const switchOn = decideAccess(input({ ...on, pathname, desktopApiOk }));
				assert.deepEqual(switchOn, switchOff, `${pathname}, desktop check ${desktopApiOk}`);
			}
		}
	});

	it("lets this computer's browser through at 127.0.0.1 and [::1] as well as localhost", () => {
		assert.deepEqual(decideAccess(input({ ...on, host: "127.0.0.1:3010", pathname: "/" })), { action: "allow" });
		assert.deepEqual(decideAccess(input({ ...on, host: "[::1]:3010", pathname: "/" })), { action: "allow" });
	});

	it("keeps the desktop API check for this computer, with remote access on as with it off", () => {
		const decision = decideAccess(input({ ...on, pathname: "/api/settings", desktopApiOk: false }));
		assert.equal(decision.action, "refuse");
		assert.match(decision.action === "refuse" ? decision.message : "", /trusted LangHarness window/);
	});

	it("lets the packaged desktop window through", () => {
		assert.deepEqual(decideAccess(input({ ...on, desktopWindow: true, pathname: "/api/access" })), { action: "allow" });
	});

	it("sends a phone with no session to pairing, on a page and on the API", () => {
		assert.deepEqual(decideAccess(input({ ...phone, pathname: "/" })), { action: "pair" });
		assert.deepEqual(decideAccess(input({ ...phone, pathname: "/api/chats" })), { action: "pair" });
	});

	it("lets a paired phone through, on any page and on the API", () => {
		assert.deepEqual(decideAccess(input({ ...phone, paired: true, pathname: "/api/events" })), { action: "allow" });
		assert.deepEqual(decideAccess(input({ ...phone, paired: true, pathname: "/" })), { action: "allow" });
	});

	it("treats a proxied request as a phone even when Serve rewrote Host to loopback", () => {
		assert.deepEqual(decideAccess(input({ ...on, host: "127.0.0.1:3010", headers: { "tailscale-user-login": "x" } })), {
			action: "pair",
		});
	});

	it("treats a tailnet name in X-Forwarded-Host as proxied, whatever Host says", () => {
		assert.deepEqual(
			decideAccess(input({ ...on, host: "127.0.0.1:3010", headers: { "x-forwarded-host": "pc.tail1234.ts.net" } })),
			{ action: "pair" },
		);
	});

	it("sends a tailnet name with no identity header (a tagged device, or Funnel) to pairing too", () => {
		assert.deepEqual(decideAccess(input({ ...on, host: "pc.tail1234.ts.net" })), { action: "pair" });
	});

	it("treats any request carrying a proxy header as proxied, even on this computer's own name", () => {
		for (const header of [
			"Tailscale-User-Login",
			"Tailscale-User-Name",
			"Tailscale-User-Profile-Pic",
			"Tailscale-App-Capabilities",
			"Forwarded",
			"X-Real-IP",
		]) {
			assert.deepEqual(decideAccess(input({ ...on, headers: { [header]: "x" } })), { action: "pair" }, header);
		}
	});

	it("accepts a tailnet name as the host, and refuses any other name", () => {
		assert.equal(decideAccess(input({ ...on, paired: true, host: "pc.tail1234.ts.net" })).action, "allow");
		assert.deepEqual(decideAccess(input({ ...on, paired: true, host: "evil.example" })), {
			action: "refuse",
			message: "This address is not allowed. Use this computer’s Tailscale name.",
		});
	});

	it("keeps the pairing page, its one POST and the static assets public for a phone", () => {
		assert.deepEqual(decideAccess(input({ ...phone, pathname: "/pair" })), { action: "allow" });
		assert.deepEqual(decideAccess(input({ ...phone, pathname: "/api/access/pair", method: "POST" })), {
			action: "allow",
		});
		assert.deepEqual(decideAccess(input({ ...phone, pathname: "/_next/static/chunks/app.js" })), { action: "allow" });
		assert.deepEqual(decideAccess(input({ ...phone, pathname: "/icons/icon-192.png" })), { action: "allow" });
	});

	it("keeps everything else behind pairing for a phone: the pairing GET, the access reads and the pairing POST", () => {
		assert.equal(decideAccess(input({ ...phone, pathname: "/api/access/pair", method: "GET" })).action, "pair");
		assert.equal(decideAccess(input({ ...phone, pathname: "/api/access" })).action, "pair");
		assert.equal(decideAccess(input({ ...phone, pathname: "/api/access/pairing", method: "POST" })).action, "pair");
	});
});

describe("public paths", () => {
	it("lists the pages and files an unpaired device needs, and nothing more", () => {
		assert.equal(publicPath("/pair", "GET"), true);
		assert.equal(publicPath("/pair", "POST"), false);
		assert.equal(publicPath("/api/access/pair", "POST"), true);
		assert.equal(publicPath("/api/access/pair", "GET"), false);
		assert.equal(publicPath("/manifest.webmanifest", "GET"), true);
		assert.equal(publicPath("/api/settings", "GET"), false);
	});
});

describe("host and proxy helpers", () => {
	it("recognizes MagicDNS names and nothing else", () => {
		assert.equal(tailnetHost("pc.tail1234.ts.net"), true);
		assert.equal(tailnetHost("pc.tail1234.ts.net:443"), true);
		assert.equal(tailnetHost("PC.TAIL1234.TS.NET"), true);
		assert.equal(tailnetHost("pc.example.com"), false);
		assert.equal(tailnetHost("ts.net.evil.example"), false);
		assert.equal(tailnetHost(null), false);
	});

	it("reads one cookie from a Cookie header", () => {
		const headers = new Headers({ cookie: `theme=dark; ${DEVICE_COOKIE}=abc_DEF-123; other=x` });
		assert.equal(readCookie(headers, DEVICE_COOKIE), "abc_DEF-123");
		assert.equal(readCookie(new Headers({ cookie: "lh_device_old=1" }), DEVICE_COOKIE), null);
		assert.equal(readCookie(new Headers(), DEVICE_COOKIE), null);
	});

	it("writes the device cookie HttpOnly and Lax, and Secure only over HTTPS", () => {
		const plain = deviceCookie("tok", false);
		assert.match(plain, /^lh_device=tok; /);
		assert.match(plain, /HttpOnly/);
		assert.match(plain, /SameSite=Lax/);
		assert.match(plain, /Max-Age=15552000/);
		assert.doesNotMatch(plain, /Secure/);
		assert.match(deviceCookie("tok", true), /Secure/);
	});

	it("decides HTTPS from the URL or from a proxy that says so", () => {
		assert.equal(secureRequest("https://pc.tail1234.ts.net/api/access", new Headers()), true);
		assert.equal(
			secureRequest("http://127.0.0.1:3010/api/access", new Headers({ "x-forwarded-proto": "https" })),
			true,
		);
		assert.equal(secureRequest("http://127.0.0.1:3010/api/access", new Headers()), false);
		// The dev router can pass a bare path as request.url; that must not throw.
		assert.equal(secureRequest("/api/access/pair", new Headers()), false);
	});

	it("takes the port from the request, then PORT, then 3010", () => {
		assert.equal(listeningPort("http://localhost:3010/api/access", {}), 3010);
		assert.equal(listeningPort("http://pc.tail1234.ts.net/api/access", { PORT: "41234" }), 41234);
		assert.equal(listeningPort("http://pc.tail1234.ts.net/api/access", {}), 3010);
		assert.equal(listeningPort("/api/access", { PORT: "41234" }), 41234);
		assert.equal(listeningPort("/api/access", {}), 3010);
	});
});

describe("pairing input and device names", () => {
	it("accepts six digits with or without a space or dash, and nothing else", () => {
		assert.equal(normalizeCode("482913"), "482913");
		assert.equal(normalizeCode("482 913"), "482913");
		assert.equal(normalizeCode("482-913"), "482913");
		assert.equal(normalizeCode("48291"), null);
		assert.equal(normalizeCode("4829130"), null);
		assert.equal(normalizeCode("48291a"), null);
		assert.equal(normalizeCode(482913), null);
		assert.equal(normalizeCode(undefined), null);
	});

	it("shows the code as two halves", () => {
		assert.equal(formatCode("482913"), "482 913");
	});

	it("names a device from its browser, and keeps the owner's name when they give one", () => {
		assert.equal(deviceNameFromAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "iPhone");
		assert.equal(deviceNameFromAgent("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)"), "iPad");
		assert.equal(deviceNameFromAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "Mac or iPad");
		assert.equal(deviceNameFromAgent(null), "Browser");
		assert.equal(cleanDeviceName("  Mária’s iPad\u0007 ", "iPad"), "Mária’s iPad");
		assert.equal(cleanDeviceName("   ", "iPhone"), "iPhone");
		assert.equal(cleanDeviceName("x".repeat(80), "iPhone").length, 40);
		assert.equal(cleanDeviceName(42, "iPhone"), "iPhone");
	});
});
