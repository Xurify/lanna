import assert from "node:assert/strict";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import * as zlib from "node:zlib";
import { afterEach, describe, it } from "node:test";

import { assertPublicUrl, isPublicAddress, safeFetch, safeFetchSeams, SafeFetchError, type Transport, type TransportRequest } from "../src/agent/safe-fetch.ts";

const original = { ...safeFetchSeams };
afterEach(() => Object.assign(safeFetchSeams, original));

const PUBLIC = "93.184.216.34";

function replyWith(handler: (request: TransportRequest) => { status?: number; headers?: Record<string, string>; body?: Buffer | string }): { transport: Transport; seen: TransportRequest[] } {
	const seen: TransportRequest[] = [];
	const transport: Transport = async (request) => {
		seen.push(request);
		const reply = handler(request);
		return {
			status: reply.status ?? 200,
			statusText: "",
			headers: new Headers(reply.headers ?? {}),
			body: reply.body === undefined ? null : Readable.from([Buffer.from(reply.body)]),
		};
	};
	return { transport, seen };
}

describe("isPublicAddress", () => {
	const blocked = [
		"0.0.0.0", "10.1.2.3", "100.64.0.1", "100.127.255.255", "127.0.0.1", "127.255.255.254", "169.254.169.254", "172.16.0.1", "172.31.255.255",
		"192.0.0.1", "192.168.1.1", "198.18.0.1", "224.0.0.1", "240.0.0.1", "255.255.255.255",
		"::", "::1", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "2002:7f00:1::", "2001:db8::1", "64:ff9b::7f00:1", "64:ff9b::a9fe:a9fe",
		"::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "::ffff:169.254.169.254", "0:0:0:0:0:ffff:c0a8:1",
		"not-an-ip", "",
	];
	for (const address of blocked) {
		it(`refuses ${address || "an empty string"}`, () => assert.equal(isPublicAddress(address), false));
	}
	for (const address of ["93.184.216.34", "8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "100.63.255.255", "2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "64:ff9b::808:808"]) {
		it(`allows ${address}`, () => assert.equal(isPublicAddress(address), true));
	}
});

describe("assertPublicUrl", () => {
	const refused: [string, RegExp][] = [
		["file:///etc/passwd", /only http/],
		["ftp://example.com/", /only http/],
		["gopher://example.com/", /only http/],
		["http://user:pass@example.com/", /user name/],
		["http://example.com:6379/", /standard web ports/],
		["http://example.com:8080/", /standard web ports/],
		["http://localhost/", /internal host/],
		["http://LOCALHOST./", /internal host/],
		["http://app.localhost/", /internal host/],
		["http://printer.local/", /internal host/],
		["http://metadata/", /internal host/],
		["http://metadata.google.internal/", /internal host/],
		["http://127.0.0.1/", /public internet/],
		["http://127.1/", /public internet/],
		["http://2130706433/", /public internet/],
		["http://0x7f000001/", /public internet/],
		["http://017700000001/", /public internet/],
		["http://[::1]/", /public internet/],
		["http://[::ffff:127.0.0.1]/", /public internet/],
		["http://169.254.169.254/latest/meta-data/", /public internet/],
		["http://100.100.100.200/", /public internet/],
		["http://10.0.0.5:80/", /public internet/],
		["not a url", /invalid URL/],
	];
	for (const [url, message] of refused) {
		it(`refuses ${url}`, async () => {
			safeFetchSeams.resolve = async () => assert.fail("a literal or internal name is never resolved");
			await assert.rejects(assertPublicUrl(url), (error) => error instanceof SafeFetchError && message.test(error.message));
		});
	}

	it("refuses a name that resolves to a private address", async () => {
		safeFetchSeams.resolve = async () => ["127.0.0.1"];
		await assert.rejects(assertPublicUrl("https://rebind.example.com/"), /public internet/);
	});

	it("refuses a name when any one of its addresses is private", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC, "10.0.0.1"];
		await assert.rejects(assertPublicUrl("https://mixed.example.com/"), /public internet/);
	});

	it("refuses a name that does not resolve", async () => {
		safeFetchSeams.resolve = async () => [];
		await assert.rejects(assertPublicUrl("https://nowhere.example.com/"), /did not resolve/);
	});

	it("accepts a public name on the standard ports and hands back what it resolved", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		assert.deepEqual((await assertPublicUrl("https://example.com:443/a")).addresses, [PUBLIC]);
		assert.deepEqual((await assertPublicUrl("http://example.com/")).addresses, [PUBLIC]);
		assert.deepEqual((await assertPublicUrl("https://8.8.8.8/")).addresses, ["8.8.8.8"]);
	});
});

describe("safeFetch", () => {
	it("never reaches the transport for a private target", async () => {
		const { transport, seen } = replyWith(() => ({ body: "secret" }));
		safeFetchSeams.transport = transport;
		await assert.rejects(safeFetch("http://127.0.0.1:3010/api/keys"), SafeFetchError);
		await assert.rejects(safeFetch("http://169.254.169.254/latest/meta-data/"), SafeFetchError);
		assert.equal(seen.length, 0);
	});

	it("connects to the addresses it checked", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const { transport, seen } = replyWith(() => ({ body: "hello" }));
		safeFetchSeams.transport = transport;
		const response = await safeFetch("https://example.com/page", { headers: { "user-agent": "t" } });
		assert.equal(await response.text(), "hello");
		assert.equal(response.url, "https://example.com/page");
		assert.deepEqual(seen[0]?.addresses, [PUBLIC]);
		assert.equal(seen[0]?.headers["user-agent"], "t");
	});

	it("checks every redirect hop, not only the first URL", async () => {
		safeFetchSeams.resolve = async (host) => (host === "evil.example.com" ? ["10.0.0.9"] : [PUBLIC]);
		const { transport, seen } = replyWith((request) =>
			request.url.hostname === "example.com" ? { status: 302, headers: { location: "https://evil.example.com/inner" } } : { body: "internal" },
		);
		safeFetchSeams.transport = transport;
		await assert.rejects(safeFetch("https://example.com/"), /public internet/);
		assert.equal(seen.length, 1);
	});

	it("refuses a redirect to a literal loopback address and to a non-http scheme", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const { transport } = replyWith(() => ({ status: 301, headers: { location: "http://127.0.0.1/api/chats" } }));
		safeFetchSeams.transport = transport;
		await assert.rejects(safeFetch("https://example.com/"), /public internet/);
		const toFile = replyWith(() => ({ status: 301, headers: { location: "file:///etc/passwd" } }));
		safeFetchSeams.transport = toFile.transport;
		await assert.rejects(safeFetch("https://example.com/"), /only http/);
	});

	it("follows a relative redirect and reports the final URL", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const { transport } = replyWith((request) => (request.url.pathname === "/a" ? { status: 301, headers: { location: "/b" } } : { body: "done" }));
		safeFetchSeams.transport = transport;
		const response = await safeFetch("https://example.com/a");
		assert.equal(response.url, "https://example.com/b");
		assert.equal(await response.text(), "done");
	});

	it("stops after the redirect limit", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const { transport, seen } = replyWith(() => ({ status: 302, headers: { location: "https://example.com/again" } }));
		safeFetchSeams.transport = transport;
		await assert.rejects(safeFetch("https://example.com/", { maxRedirects: 3 }), /too many redirects/);
		assert.equal(seen.length, 4);
	});

	it("turns a redirected POST into a GET without the body", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const { transport, seen } = replyWith((request) => (request.url.pathname === "/post" ? { status: 303, headers: { location: "/get" } } : { body: "ok" }));
		safeFetchSeams.transport = transport;
		await safeFetch("https://example.com/post", { method: "POST", body: "x" });
		assert.equal(seen[1]?.method, "GET");
		assert.equal(seen[1]?.body, undefined);
	});

	it("rejects a body over the cap, however it is sent", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const { transport } = replyWith(() => ({ body: Buffer.alloc(2000, 97) }));
		safeFetchSeams.transport = transport;
		await assert.rejects(async () => (await safeFetch("https://example.com/", { maxBytes: 1000 })).text(), /response too large/);
		const declared = replyWith(() => ({ headers: { "content-length": "5000" }, body: "x" }));
		safeFetchSeams.transport = declared.transport;
		await assert.rejects(safeFetch("https://example.com/", { maxBytes: 1000 }), /response too large/);
	});

	it("caps the decoded size, so a compressed bomb is stopped", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const bomb = zlib.gzipSync(Buffer.alloc(5_000_000, 0));
		assert.ok(bomb.length < 10_000);
		const { transport } = replyWith(() => ({ headers: { "content-encoding": "gzip" }, body: bomb }));
		safeFetchSeams.transport = transport;
		await assert.rejects(async () => (await safeFetch("https://example.com/", { maxBytes: 100_000 })).text(), /response too large/);
	});

	it("decodes gzip and brotli", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const gzip = replyWith(() => ({ headers: { "content-encoding": "gzip" }, body: zlib.gzipSync("plain gzip") }));
		safeFetchSeams.transport = gzip.transport;
		assert.equal(await (await safeFetch("https://example.com/")).text(), "plain gzip");
		const brotli = replyWith(() => ({ headers: { "content-encoding": "br" }, body: zlib.brotliCompressSync("plain br") }));
		safeFetchSeams.transport = brotli.transport;
		assert.equal(await (await safeFetch("https://example.com/")).text(), "plain br");
	});

	it("refuses an encoding it cannot decode", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const { transport } = replyWith(() => ({ headers: { "content-encoding": "zstd" }, body: "x" }));
		safeFetchSeams.transport = transport;
		await assert.rejects(safeFetch("https://example.com/"), /unsupported content-encoding/);
	});

	it("gives up when the whole request takes too long", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		const keepAlive = setTimeout(() => {}, 5000);
		safeFetchSeams.transport = (request) => new Promise((_resolve, reject) => request.signal.addEventListener("abort", () => reject(request.signal.reason)));
		try {
			await assert.rejects(safeFetch("https://example.com/", { timeoutMs: 30 }));
		} finally {
			clearTimeout(keepAlive);
		}
	});

	it("honors the caller's abort signal", async () => {
		safeFetchSeams.resolve = async () => [PUBLIC];
		let reachedTransport = false;
		safeFetchSeams.transport = async () => {
			reachedTransport = true;
			return { status: 200, statusText: "", headers: new Headers(), body: null };
		};
		const controller = new AbortController();
		const pending = safeFetch("https://example.com/", { signal: controller.signal });
		controller.abort(new Error("stop"));
		await assert.rejects(pending, /stop/);
		assert.equal(reachedTransport, false);
	});
});

describe("safeFetch over a real socket", () => {
	const serve = async (handler: http.RequestListener) => {
		const server = http.createServer(handler);
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		return { server, port: (server.address() as AddressInfo).port, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
	};

	it("is refused by default: a server on this computer is not reachable", async () => {
		let hits = 0;
		const local = await serve((_req, res) => {
			hits++;
			res.end("local only");
		});
		try {
			safeFetchSeams.resolve = async () => ["127.0.0.1"];
			await assert.rejects(safeFetch(`http://localhost:${local.port}/`), SafeFetchError);
			await assert.rejects(safeFetch(`http://127.0.0.1:${local.port}/`), SafeFetchError);
			assert.equal(hits, 0);
		} finally {
			await local.close();
		}
	});

	it("connects to the address it checked, whatever the name would resolve to", async () => {
		const local = await serve((request, res) => res.end(`host=${request.headers.host}`));
		try {
			safeFetchSeams.isAllowedAddress = () => true;
			safeFetchSeams.allowedPorts = new Set([String(local.port)]);
			safeFetchSeams.resolve = async () => ["127.0.0.1"];
			const reached = await safeFetch(`http://pinned.example.com:${local.port}/`);
			assert.equal(await reached.text(), `host=pinned.example.com:${local.port}`);
		} finally {
			await local.close();
		}
	});

	it("follows a redirect over the socket", async () => {
		const local = await serve((request, res) => {
			if (request.url === "/start") res.writeHead(302, { location: "/end" }).end();
			else res.end("arrived");
		});
		try {
			safeFetchSeams.allowedPorts = new Set([String(local.port)]);
			safeFetchSeams.resolve = async () => ["127.0.0.1"];
			safeFetchSeams.isAllowedAddress = () => true;
			assert.equal(await (await safeFetch(`http://hop.example.com:${local.port}/start`)).text(), "arrived");
		} finally {
			await local.close();
		}
	});
});

describe("the tools and readers that fetch for someone else", () => {
	it("web_fetch will not read this computer's own API, or a cloud metadata address", async () => {
		const { createWebTools } = await import("../src/agent/tools/web.ts");
		const { web_fetch } = createWebTools(() => null);
		const reached: string[] = [];
		safeFetchSeams.transport = async (request) => {
			reached.push(request.url.href);
			return { status: 200, statusText: "", headers: new Headers({ "content-type": "text/plain" }), body: Readable.from(["a page of text long enough to be returned"]) };
		};
		for (const url of ["http://127.0.0.1/api/keys", "http://localhost/api/chats", "http://169.254.169.254/latest/meta-data/iam", "http://[::1]/", "http://10.0.0.1/"]) {
			const out = await web_fetch!.execute!("t", { url });
			assert.match(String(out.details), /web_fetch failed/, url);
		}
		assert.deepEqual(reached, []);
	});

	it("web_fetch_pdf applies the same guard", async () => {
		const { createPdfReadTools } = await import("../src/agent/tools/pdf-read.ts");
		const fs = await import("node:fs/promises");
		const os = await import("node:os");
		const path = await import("node:path");
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lh-safe-fetch-"));
		try {
			let reached = 0;
			safeFetchSeams.transport = async () => {
				reached++;
				return { status: 200, statusText: "", headers: new Headers(), body: null };
			};
			const out = await createPdfReadTools(dir).web_fetch_pdf!.execute!("t", { url: "http://127.0.0.1/secret.pdf" });
			assert.match(String(out.details), /web_fetch_pdf failed/);
			assert.equal(reached, 0);
		} finally {
			await fs.rm(dir, { recursive: true, force: true });
		}
	});

	it("only YouTube's own caption addresses are fetched for a track", async () => {
		const { isYouTubeCaptionUrl } = await import("../src/core/watch.ts");
		assert.equal(isYouTubeCaptionUrl("https://www.youtube.com/api/timedtext?v=abc&lang=sk"), true);
		for (const url of ["http://www.youtube.com/api/timedtext?v=a", "https://youtube.com.evil.example/api/timedtext", "https://evil.example/api/timedtext", "https://www.youtube.com/other", "https://user:pw@www.youtube.com/api/timedtext", "http://127.0.0.1/api/timedtext", "not a url"]) {
			assert.equal(isYouTubeCaptionUrl(url), false, url);
		}
	});
});
