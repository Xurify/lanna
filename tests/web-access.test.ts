import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	PROXY_SECRET_HEADER,
	clientAddress,
	decideAccess,
	originAllowed,
	publicModeFrom,
	publicWebPath,
	safeNext,
	validPublicHost,
	type AccessInput,
} from "../src/server/remote-access.ts";
import {
	LOGIN_LIMITS,
	emptyThrottle,
	pruneThrottle,
	readThrottle,
	refundAttempt,
	reserveAttempt,
} from "../src/server/web-login-throttle.ts";
import {
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
	SCRYPT_DEFAULT,
	hashPassword,
	isPasswordRecord,
	passwordProblem,
	verifyPassword,
} from "../src/server/web-password.ts";

const HOST = "learn.example.com";
const SECRET = "s".repeat(40);
const ENV = { LANNA_PUBLIC_HOST: HOST, LANNA_PROXY_SECRET: SECRET };

const PROXIED = { host: HOST, "x-forwarded-host": HOST, "x-forwarded-proto": "https", [PROXY_SECRET_HEADER]: SECRET };

function request(
	overrides: Partial<Omit<AccessInput, "headers" | "publicMode">> & {
		headers?: Record<string, string>;
		env?: Record<string, string | undefined>;
	} = {},
): AccessInput {
	const { headers, env, ...rest } = overrides;
	const all = new Headers({ ...PROXIED, ...headers });
	return {
		pathname: "/",
		method: "GET",
		host: all.get("host"),
		headers: all,
		enabled: true,
		desktopWindow: false,
		desktopApiOk: true,
		paired: false,
		publicMode: publicModeFrom(all, env ?? ENV),
		...rest,
	};
}

describe("public mode is off unless LANNA_PUBLIC_HOST is set", () => {
	it("gives no public mode without the variable, so the old rules apply", () => {
		assert.equal(publicModeFrom(new Headers(PROXIED), {}), null);
		assert.equal(publicModeFrom(new Headers(PROXIED), { LANNA_PUBLIC_HOST: "  " }), null);
	});

	it("leaves this computer's own request on the old rules when the variable is not set", () => {
		const local = decideAccess({
			...request({ headers: { host: "localhost:3010" } }),
			publicMode: null,
			headers: new Headers(),
			host: "localhost:3010",
		});
		assert.deepEqual(local, { action: "allow" });
	});

	it("accepts only a host name: no scheme, port, path or single label", () => {
		for (const good of ["learn.example.com", "a.b.example.co", "xn--n3h.example"])
			assert.equal(validPublicHost(good), true, good);
		for (const bad of [
			"https://learn.example.com",
			"learn.example.com:3010",
			"learn.example.com/",
			"localhost",
			"",
			"-a.example.com",
			"a b.example.com",
		]) {
			assert.equal(validPublicHost(bad), false, bad);
		}
	});
});

describe("a request at the public address", () => {
	it("sends an unsigned page request to the sign-in page, and an unsigned API request a 401 by the proxy file", () => {
		assert.deepEqual(decideAccess(request()), { action: "login" });
		assert.deepEqual(decideAccess(request({ pathname: "/api/settings" })), { action: "login" });
	});

	it("lets a signed-in browser through on pages and the API", () => {
		assert.deepEqual(decideAccess(request({ paired: true })), { action: "allow" });
		assert.deepEqual(decideAccess(request({ paired: true, pathname: "/api/progress" })), { action: "allow" });
	});

	it("keeps only the sign-in page, its one POST and the static files public", () => {
		const origin = { origin: `https://${HOST}` };
		assert.deepEqual(decideAccess(request({ pathname: "/login" })), { action: "allow" });
		assert.deepEqual(decideAccess(request({ pathname: "/api/access/login", method: "POST", headers: origin })), {
			action: "allow",
		});
		assert.deepEqual(decideAccess(request({ pathname: "/_next/static/chunk.js" })), { action: "allow" });
		assert.deepEqual(decideAccess(request({ pathname: "/manifest.webmanifest" })), { action: "allow" });
		for (const [pathname, method] of [
			["/login", "POST"],
			["/api/access/login", "GET"],
			["/pair", "GET"],
			["/api/access/pair", "POST"],
			["/api/access", "GET"],
			["/api/keys", "GET"],
		] as const) {
			assert.equal(publicWebPath(pathname, method), false, `${method} ${pathname}`);
		}
	});

	it("does not offer pairing there, because a code is a tailnet matter", () => {
		assert.deepEqual(decideAccess(request({ pathname: "/pair" })), { action: "login" });
		assert.deepEqual(
			decideAccess(request({ pathname: "/api/access/pair", method: "POST", headers: { origin: `https://${HOST}` } })),
			{ action: "login" },
		);
	});

	it("refuses everything while web access is off, the sign-in page included", () => {
		const decision = decideAccess(request({ enabled: false, pathname: "/login" }));
		assert.equal(decision.action, "refuse");
		assert.match(decision.action === "refuse" ? decision.message : "", /Web access is off/);
	});
});

describe("what makes a request not the proxy's", () => {
	const refused = (overrides: Parameters<typeof request>[0]) => {
		const decision = decideAccess(request(overrides));
		assert.equal(decision.action, "refuse", JSON.stringify(decision));
		return decision.action === "refuse" ? decision.message : "";
	};

	it("refuses a request without the proxy secret, even one that names the right host over HTTPS", () => {
		assert.match(refused({ headers: { [PROXY_SECRET_HEADER]: "" } }), /only through its reverse proxy/);
		const noHeader = new Headers({ host: HOST, "x-forwarded-host": HOST, "x-forwarded-proto": "https" });
		assert.equal(
			decideAccess({ ...request(), headers: noHeader, publicMode: publicModeFrom(noHeader, ENV) }).action,
			"refuse",
		);
	});

	it("refuses a wrong secret, one of the wrong length, and a secret that is too short to be configured", () => {
		assert.match(refused({ headers: { [PROXY_SECRET_HEADER]: "x".repeat(40) } }), /only through its reverse proxy/);
		assert.match(refused({ headers: { [PROXY_SECRET_HEADER]: SECRET.slice(1) } }), /only through its reverse proxy/);
		assert.match(
			refused({
				env: { LANNA_PUBLIC_HOST: HOST, LANNA_PROXY_SECRET: "short" },
				headers: { [PROXY_SECRET_HEADER]: "short" },
			}),
			/not set up/,
		);
		assert.match(refused({ env: { LANNA_PUBLIC_HOST: HOST } }), /not set up/);
	});

	it("looks like this computer to nobody: a default nginx Host of 127.0.0.1 is refused, with or without the secret", () => {
		assert.match(
			refused({ host: "127.0.0.1:3010", headers: { host: "127.0.0.1:3010", "x-forwarded-host": "127.0.0.1:3010" } }),
			/Use the public address/,
		);
		const bare = new Headers({ host: "localhost:3010" });
		const decision = decideAccess({
			...request(),
			headers: bare,
			host: "localhost:3010",
			publicMode: publicModeFrom(bare, ENV),
		});
		assert.equal(decision.action, "refuse");
	});

	it("refuses another host name, in Host or in the original host a client may have sent", () => {
		assert.match(
			refused({ headers: { host: "evil.example", "x-forwarded-host": "evil.example" } }),
			/Use the public address/,
		);
		assert.match(refused({ headers: { "x-forwarded-host": "evil.example" } }), /Use the public address/);
		assert.match(refused({ headers: { host: `${HOST}:8443` } }), /Use the public address/);
	});

	it("does not let a spoofed tailnet name in X-Forwarded-Host skip the public rules", () => {
		const decision = decideAccess(request({ headers: { "x-forwarded-host": "pc.tail1234.ts.net" } }));
		assert.equal(decision.action, "refuse");
	});

	it("refuses plain HTTP, and a client's own claim of HTTP, but never trusts a claim of HTTPS without the secret", () => {
		assert.match(refused({ headers: { "x-forwarded-proto": "http" } }), /needs HTTPS/);
		const spoofed = new Headers({ host: HOST, "x-forwarded-host": HOST, "x-forwarded-proto": "https" });
		assert.equal(
			decideAccess({ ...request(), headers: spoofed, publicMode: publicModeFrom(spoofed, ENV) }).action,
			"refuse",
		);
	});

	it("refuses a request that names no host at all", () => {
		const nameless = new Headers({ "x-forwarded-proto": "https", [PROXY_SECRET_HEADER]: SECRET });
		const decision = decideAccess({
			...request(),
			headers: nameless,
			host: null,
			publicMode: publicModeFrom(nameless, ENV),
		});
		assert.equal(decision.action, "refuse");
	});

	it("is case-insensitive about the host name, as DNS is", () => {
		assert.deepEqual(
			decideAccess(
				request({ headers: { host: "Learn.Example.COM", "x-forwarded-host": "LEARN.example.com" }, paired: true }),
			),
			{ action: "allow" },
		);
	});
});

describe("the origin of a request that changes something", () => {
	it("needs an Origin that is exactly the public address over HTTPS, on every unsafe method", () => {
		for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
			const bare = decideAccess(request({ method, pathname: "/api/settings", paired: true }));
			assert.equal(bare.action, "refuse", `${method} without Origin`);
			const wrong = decideAccess(
				request({ method, pathname: "/api/settings", paired: true, headers: { origin: "https://evil.example" } }),
			);
			assert.equal(wrong.action, "refuse", `${method} from another origin`);
			const plain = decideAccess(
				request({ method, pathname: "/api/settings", paired: true, headers: { origin: `http://${HOST}` } }),
			);
			assert.equal(plain.action, "refuse", `${method} from plain http`);
			const ok = decideAccess(
				request({ method, pathname: "/api/settings", paired: true, headers: { origin: `https://${HOST}` } }),
			);
			assert.deepEqual(ok, { action: "allow" }, `${method} from the page`);
		}
	});

	it("applies to the sign-in POST too, and not to reads", () => {
		assert.equal(decideAccess(request({ method: "POST", pathname: "/api/access/login" })).action, "refuse");
		assert.deepEqual(decideAccess(request({ pathname: "/api/progress", paired: true })), { action: "allow" });
		assert.equal(originAllowed(null, HOST), false);
		assert.equal(originAllowed("null", HOST), false);
		assert.equal(originAllowed(`https://${HOST}.evil.example`, HOST), false);
	});
});

describe("the Tailscale path beside the public address", () => {
	const phone = {
		host: "pc.tail1234.ts.net",
		"x-forwarded-host": "pc.tail1234.ts.net",
		"x-forwarded-proto": "https",
		"tailscale-user-login": "me@example.com",
	};

	it("still pairs a phone that names a tailnet host, and lets a paired one through", () => {
		const unpaired = decideAccess({ ...request({ headers: phone }), host: phone.host, headers: new Headers(phone) });
		assert.deepEqual(unpaired, { action: "pair" });
		const paired = decideAccess({
			...request({ headers: phone, paired: true }),
			host: phone.host,
			headers: new Headers(phone),
		});
		assert.deepEqual(paired, { action: "allow" });
	});

	it("is not reachable by a request that the proxy sent for the public host", () => {
		const decision = decideAccess(request({ headers: { "tailscale-user-login": "me@example.com" } }));
		assert.deepEqual(decision, { action: "login" });
	});
});

describe("inside Docker, where every connection comes from 172.17.0.1", () => {
	const bridge = { "x-forwarded-for": "172.17.0.1" };
	const raw = (
		headers: Record<string, string>,
		extra: Partial<Omit<AccessInput, "headers" | "publicMode" | "host">> = {},
		env: Record<string, string | undefined> = ENV,
	): AccessInput => {
		const all = new Headers(headers);
		return {
			pathname: "/",
			method: "GET",
			host: all.get("host"),
			headers: all,
			enabled: true,
			desktopWindow: false,
			desktopApiOk: true,
			paired: false,
			publicMode: publicModeFrom(all, env),
			...extra,
		};
	};
	const refused = (input: AccessInput) => decideAccess(input).action === "refuse";

	const loopbackNames = ["127.0.0.1:3010", "localhost:3010", "[::1]:3010", "127.0.0.1"];
	const proxyMarks: Record<string, string>[] = [
		{},
		{ "x-real-ip": "203.0.113.9" },
		{ forwarded: "for=203.0.113.9" },
		{ "x-real-ip": "203.0.113.9", forwarded: "for=203.0.113.9", "x-forwarded-proto": "https" },
	];
	const requests = [
		{ pathname: "/", method: "GET" },
		{ pathname: "/api/settings", method: "GET" },
		{ pathname: "/api/keys", method: "GET" },
		{ pathname: "/api/access", method: "PUT" },
		{ pathname: "/api/access/login", method: "POST" },
		{ pathname: "/login", method: "GET" },
	];

	it("refuses a loopback Host at the public address, with or without proxy headers, on every kind of request", () => {
		for (const host of loopbackNames) {
			for (const marks of proxyMarks) {
				for (const { pathname, method } of requests) {
					const headers = { host, ...bridge, ...marks };
					for (const signedIn of [false, true]) {
						assert.equal(
							refused(raw(headers, { pathname, method, paired: signedIn })),
							true,
							`${method} ${pathname} host=${host} marks=${Object.keys(marks).join("+") || "none"} signedIn=${signedIn}`,
						);
					}
				}
			}
		}
	});

	it("refuses a loopback Host even when the proxy secret is right, because the name is not the public one", () => {
		for (const host of loopbackNames) {
			const headers = {
				host,
				...bridge,
				"x-real-ip": "203.0.113.9",
				"x-forwarded-proto": "https",
				[PROXY_SECRET_HEADER]: SECRET,
			};
			assert.equal(refused(raw(headers)), true, host);
			assert.equal(
				refused(raw({ ...headers, "x-forwarded-host": HOST })),
				true,
				`${host} with the original host named`,
			);
		}
	});

	it("refuses the public Host from the bridge when the secret is missing, whatever else the proxy sent", () => {
		const headers = {
			host: HOST,
			"x-forwarded-host": HOST,
			"x-forwarded-proto": "https",
			"x-real-ip": "203.0.113.9",
			...bridge,
		};
		assert.equal(refused(raw(headers)), true);
		assert.equal(refused(raw({ ...headers, forwarded: "for=203.0.113.9;proto=https" })), true);
	});

	it("lets only the public Host with the secret and HTTPS through, and then needs a session", () => {
		const good = {
			host: HOST,
			"x-forwarded-host": HOST,
			"x-forwarded-proto": "https",
			"x-real-ip": "203.0.113.9",
			"x-forwarded-for": "203.0.113.9",
			[PROXY_SECRET_HEADER]: SECRET,
		};
		assert.deepEqual(decideAccess(raw(good)), { action: "login" });
		assert.deepEqual(decideAccess(raw(good, { paired: true })), { action: "allow" });
		assert.deepEqual(decideAccess(raw(good, { pathname: "/login" })), { action: "allow" });
		assert.equal(refused(raw({ ...good, "x-forwarded-proto": "http" })), true);
	});

	it("keeps desktop and dev as they were when LANNA_PUBLIC_HOST is not set: this computer passes, a marked request does not", () => {
		const unset = {};
		for (const host of loopbackNames) {
			assert.deepEqual(decideAccess(raw({ host, ...bridge }, {}, unset)), { action: "allow" }, host);
			assert.deepEqual(
				decideAccess(raw({ host, ...bridge }, { pathname: "/api/settings" }, unset)),
				{ action: "allow" },
				`${host} API`,
			);
			assert.deepEqual(
				decideAccess(raw({ host, ...bridge, "x-real-ip": "203.0.113.9" }, {}, unset)),
				{ action: "pair" },
				`${host} with X-Real-IP, access on`,
			);
			assert.equal(
				refused(raw({ host, ...bridge, "x-real-ip": "203.0.113.9" }, { enabled: false }, unset)),
				true,
				`${host} with X-Real-IP, access off`,
			);
			assert.equal(
				refused(raw({ host, ...bridge, forwarded: "for=203.0.113.9" }, { enabled: false }, unset)),
				true,
				`${host} with Forwarded, access off`,
			);
		}
	});
});

describe("where to go after signing in, and who is asking", () => {
	it("keeps the redirect inside the app", () => {
		assert.equal(safeNext("/read?id=3"), "/read?id=3");
		for (const bad of [
			"https://evil.example",
			"//evil.example",
			"/\\evil.example",
			"evil",
			"",
			null,
			undefined,
			"/login",
			"/login?next=/",
			"/pair",
			"/a\nb",
			"/a\u0000b",
		]) {
			assert.equal(safeNext(bad), "/", String(bad));
		}
	});

	it("reads the address the one trusted proxy appended, never what the client put first", () => {
		assert.equal(clientAddress(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" })), "203.0.113.9");
		assert.equal(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.9" })), "203.0.113.9");
		assert.equal(clientAddress(new Headers()), "unknown");
		assert.equal(clientAddress(new Headers({ "x-forwarded-for": "a".repeat(500) })).length, 64);
	});
});

describe("the limit on password tries", () => {
	const T0 = 1_000_000;

	it("allows five tries a minute from one address, then locks it for fifteen minutes", () => {
		let state = emptyThrottle();
		for (let i = 0; i < LOGIN_LIMITS.perAddressTries; i++) {
			const r = reserveAttempt(state, "1.1.1.1", T0 + i * 1000);
			assert.equal(r.allowed, true, `try ${i + 1}`);
			state = r.state;
		}
		const sixth = reserveAttempt(state, "1.1.1.1", T0 + 6000);
		assert.equal(sixth.allowed, false);
		assert.equal(sixth.allowed === false && sixth.scope, "address");
		assert.equal(sixth.allowed === false && sixth.retryAfterMs, LOGIN_LIMITS.lockMs);
		const during = reserveAttempt(sixth.state, "1.1.1.1", T0 + LOGIN_LIMITS.lockMs - 1000);
		assert.equal(during.allowed, false, "still locked just before the end");
		const after = reserveAttempt(during.state, "1.1.1.1", T0 + 6000 + LOGIN_LIMITS.lockMs + 1);
		assert.equal(after.allowed, true, "free again once the lock is over");
	});

	it("does not lock an address that spreads its tries over more than a minute", () => {
		let state = emptyThrottle();
		for (let i = 0; i < 20; i++) {
			const r = reserveAttempt(state, "1.1.1.1", T0 + i * 20_000);
			assert.equal(r.allowed, true, `try ${i + 1}`);
			state = r.state;
		}
	});

	it("keeps one address's lock away from another", () => {
		let state = emptyThrottle();
		for (let i = 0; i < 6; i++) state = reserveAttempt(state, "1.1.1.1", T0 + i).state;
		assert.equal(reserveAttempt(state, "1.1.1.1", T0 + 10).allowed, false);
		assert.equal(reserveAttempt(state, "2.2.2.2", T0 + 10).allowed, true);
	});

	it("gives a try back when the password was right, so the owner is not locked out by their own sign-ins", () => {
		let state = emptyThrottle();
		for (let i = 0; i < 4; i++) state = reserveAttempt(state, "1.1.1.1", T0 + i).state;
		const fifth = reserveAttempt(state, "1.1.1.1", T0 + 4);
		assert.equal(fifth.allowed && fifth.triesLeft, 0);
		const refunded = refundAttempt(fifth.state, "1.1.1.1", T0 + 4);
		assert.equal(reserveAttempt(refunded, "1.1.1.1", T0 + 5).allowed, true);
	});

	it("caps all addresses together, so a botnet of single tries is stopped as well", () => {
		let state = emptyThrottle();
		for (let i = 0; i < LOGIN_LIMITS.globalTries; i++) {
			const r = reserveAttempt(state, `10.0.${Math.floor(i / 250)}.${i % 250}`, T0 + i * 1000);
			assert.equal(r.allowed, true, `try ${i + 1}`);
			state = r.state;
		}
		const next = reserveAttempt(state, "198.51.100.1", T0 + LOGIN_LIMITS.globalTries * 1000);
		assert.equal(next.allowed, false);
		assert.equal(next.allowed === false && next.scope, "global");
		const sameAgain = reserveAttempt(next.state, "198.51.100.2", T0 + LOGIN_LIMITS.globalTries * 1000 + 60_000);
		assert.equal(sameAgain.allowed, false, "the global lock holds for every address");
		const hourLater = reserveAttempt(
			sameAgain.state,
			"198.51.100.3",
			T0 + LOGIN_LIMITS.globalWindowMs + LOGIN_LIMITS.globalLockMs + 100_000,
		);
		assert.equal(hourLater.allowed, true);
	});

	it("bounds the memory a flood of addresses can take", () => {
		let state = emptyThrottle();
		let refusedAt = -1;
		for (let i = 0; i < LOGIN_LIMITS.maxAddresses + 5 && refusedAt < 0; i++) {
			const r = reserveAttempt({ ...state, globalAttempts: [] }, `a${i}`, T0 + i);
			if (!r.allowed) refusedAt = i;
			else state = r.state;
		}
		assert.equal(refusedAt, LOGIN_LIMITS.maxAddresses);
		assert.ok(Object.keys(state.addresses).length <= LOGIN_LIMITS.maxAddresses);
	});

	it("forgets what has expired, and reads a damaged file as a clean start", () => {
		let state = emptyThrottle();
		state = reserveAttempt(state, "1.1.1.1", T0).state;
		assert.deepEqual(Object.keys(pruneThrottle(state, T0 + LOGIN_LIMITS.windowMs + 1).addresses), []);
		for (const damaged of [null, "x", 3, { addresses: 4 }, { addresses: {}, globalAttempts: "no" }]) {
			assert.deepEqual(readThrottle(damaged), emptyThrottle());
		}
		assert.deepEqual(readThrottle(JSON.parse(JSON.stringify(state))).addresses["1.1.1.1"]?.attempts, [T0]);
	});
});

describe("the password record", () => {
	const SMALL = { N: 1024, r: 8, p: 1, keyLength: 32, saltBytes: 16 };

	it("uses scrypt at OWASP's minimum cost, with a 16-byte salt and a 32-byte key", () => {
		assert.deepEqual(SCRYPT_DEFAULT, { N: 2 ** 17, r: 8, p: 1, keyLength: 32, saltBytes: 16 });
	});

	it("hashes with a new salt each time, never stores the password, and verifies only the right one", async () => {
		const a = await hashPassword("a long enough passphrase", SMALL);
		const b = await hashPassword("a long enough passphrase", SMALL);
		assert.notEqual(a.salt, b.salt);
		assert.notEqual(a.hash, b.hash);
		assert.equal(JSON.stringify(a).includes("passphrase"), false);
		assert.equal(a.salt.length, 32);
		assert.equal(a.hash.length, 64);
		assert.equal(await verifyPassword("a long enough passphrase", a), true);
		assert.equal(await verifyPassword("a long enough passphrasE", a), false);
		assert.equal(await verifyPassword("", a), false);
		assert.equal(await verifyPassword("x".repeat(PASSWORD_MAX_LENGTH + 1), a), false);
	});

	it("verifies under the parameters the record names, so a stronger default later does not lock the owner out", async () => {
		const old = await hashPassword("old record passphrase", { ...SMALL, N: 2048 });
		assert.equal(old.N, 2048);
		assert.equal(await verifyPassword("old record passphrase", old), true);
	});

	it("treats the same text in two Unicode forms as one password", async () => {
		const record = await hashPassword("café café café", SMALL);
		assert.equal(await verifyPassword("café café café", record), true);
	});

	it("asks for 12 to 200 characters", () => {
		assert.equal(passwordProblem("x".repeat(PASSWORD_MIN_LENGTH)), null);
		assert.match(passwordProblem("x".repeat(PASSWORD_MIN_LENGTH - 1)) ?? "", /at least 12/);
		assert.match(passwordProblem("x".repeat(PASSWORD_MAX_LENGTH + 1)) ?? "", /at most 200/);
		assert.match(passwordProblem(undefined) ?? "", /Enter a password/);
	});

	it("reads back only a record whose parameters this server can run", async () => {
		const good = await hashPassword("a long enough passphrase", SMALL);
		assert.equal(isPasswordRecord(good), true);
		for (const bad of [
			null,
			{},
			{ ...good, algo: "md5" },
			{ ...good, N: 1000 },
			{ ...good, N: 2 ** 25 },
			{ ...good, r: 0 },
			{ ...good, p: 99 },
			{ ...good, salt: "zz" },
			{ ...good, hash: 5 },
		]) {
			assert.equal(isPasswordRecord(bad), false, JSON.stringify(bad));
		}
	});
});
