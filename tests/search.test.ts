/**
 * The search engines (search port + model slots wave, 2026-09-20):
 * engine resolution (the owner's auto-detect decision — a key is enough,
 * no engine choice needed; explicit pin requires the key; no silent
 * fallback) + the Tavily/Brave adapters against a STUB fetch (never the
 * network — the wire shapes are verified against the published docs, and
 * the tests pin those shapes).
 *
 * PURE + injected fetch — this file owns no fs.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSearchEngineFor, contextProvider, tavilyProvider, braveProvider } from "../src/server/search.ts";

describe("resolveSearchEngineFor (the auto-detect decision)", () => {
	it("no keys: honestly unavailable, no default", () => {
		const out = resolveSearchEngineFor(undefined, {});
		assert.ok(!out.available);
		assert.equal(out.engine, null);
		assert.match(out.reason, /no search engine configured/i);
	});

	it("a key alone is enough — no engine choice needed", () => {
		const ctx = resolveSearchEngineFor(undefined, { context: "cxt-throwaway-key-00001" });
		assert.ok(ctx.available);
		assert.equal(ctx.engine, "context");
		assert.match(ctx.reason, /auto/);

		const tav = resolveSearchEngineFor(undefined, { tavily: "tvly-throwaway-key-00001" });
		assert.ok(tav.available);
		assert.equal(tav.engine, "tavily");
		assert.match(tav.reason, /auto/);

		const brv = resolveSearchEngineFor(undefined, { brave: "brave-throwaway-key-00001" });
		assert.ok(brv.available);
		assert.equal(brv.engine, "brave");
	});

	it("multiple keys, no pin: preference order — Context first, then Tavily, then Brave", () => {
		const allThree = resolveSearchEngineFor(undefined, {
			context: "cxt-throwaway-key-00001",
			tavily: "tvly-throwaway-key-00001",
			brave: "brave-throwaway-key-00001",
		});
		assert.ok(allThree.available);
		assert.equal(allThree.engine, "context");

		const tavBrave = resolveSearchEngineFor(undefined, {
			tavily: "tvly-throwaway-key-00001",
			brave: "brave-throwaway-key-00001",
		});
		assert.ok(tavBrave.available);
		assert.equal(tavBrave.engine, "tavily");
	});

	it("the explicit pin wins when its key is present", () => {
		const out = resolveSearchEngineFor("brave", {
			context: "cxt-throwaway-key-00001",
			tavily: "tvly-throwaway-key-00001",
			brave: "brave-throwaway-key-00001",
		});
		assert.ok(out.available);
		assert.equal(out.engine, "brave");
		assert.match(out.reason, /chosen/);

		const ctxOut = resolveSearchEngineFor("context", {
			context: "cxt-throwaway-key-00001",
			tavily: "tvly-throwaway-key-00001",
		});
		assert.ok(ctxOut.available);
		assert.equal(ctxOut.engine, "context");
		assert.match(ctxOut.reason, /chosen/);
	});

	it("the explicit pin does NOT silently fall back to the other engine", () => {
		const out = resolveSearchEngineFor("context", { brave: "brave-throwaway-key-00001" });
		assert.ok(!out.available);
		assert.equal(out.engine, null);
		assert.match(out.reason, /context/);
		assert.match(out.reason, /CONTEXT_API_KEY key/);

		const tavOut = resolveSearchEngineFor("tavily", { brave: "brave-throwaway-key-00001" });
		assert.ok(!tavOut.available);
		assert.equal(tavOut.engine, null);
		assert.match(tavOut.reason, /tavily/);
		assert.match(tavOut.reason, /TAVILY_API_KEY key/);
	});
});

/** A one-shot stub fetch: asserts the request shape and returns the canned response. */
function stubFetch(canned: unknown, expect: (url: string, init: RequestInit) => void) {
	return async (url: string, init: RequestInit): Promise<Response> => {
		expect(url, init);
		return new Response(JSON.stringify(canned), { status: 200 });
	};
}

describe("contextProvider (wire shape per docs.context.dev, verified 2026-11-09)", () => {
	it("POSTs api.context.dev/v1/web/search with Bearer auth + query and numResults body", async () => {
		const provider = contextProvider("cxt-throwaway-key-00001", stubFetch(
			{
				results: [
					{ title: "Context Example", url: "https://example.com/c", description: "line1\nline2" },
					{ title: "Highlight Example", url: "https://example.com/h", highlights: { highlights: ["passages", "found"] } },
					{ title: "No URL", description: "dropped" },
				],
			},
			(url, init) => {
				assert.equal(url, "https://api.context.dev/v1/web/search");
				assert.equal(init.method, "POST");
				const headers = init.headers as Record<string, string>;
				assert.equal(headers.authorization, "Bearer cxt-throwaway-key-00001");
				assert.equal(headers["content-type"], "application/json");
				const body = JSON.parse(init.body as string);
				assert.equal(body.query, "test query");
				assert.equal(body.numResults, 5);
			},
		));
		const hits = await provider.search("test query", 5);
		assert.deepEqual(hits, [
			{ title: "Context Example", url: "https://example.com/c", snippet: "line1 line2" },
			{ title: "Highlight Example", url: "https://example.com/h", snippet: "passages found" },
		]);
	});

	it("maps the {message, error_code} error body into the message", async () => {
		const provider = contextProvider("cxt-throwaway-key-00001", async () =>
			new Response(JSON.stringify({ message: "Profile not found or subscription expired.", error_code: "PROFILE_NOT_FOUND" }), { status: 401 }),
		);
		await assert.rejects(provider.search("q", 5), /Context search API 401: Profile not found/);
	});

	it("surfaces raw HTTP status on error without JSON body", async () => {
		const provider = contextProvider("cxt-throwaway-key-00001", async () =>
			new Response("Too many requests", { status: 429 }),
		);
		await assert.rejects(provider.search("q", 5), /Context search API 429: Too many requests/);
	});
});

describe("tavilyProvider (wire shape per docs.tavily.com, verified 2026-09-20)", () => {
	it("POSTs api.tavily.com/search with Bearer auth + the query body", async () => {
		const provider = tavilyProvider("tvly-throwaway-key-00001", stubFetch(
			{
				results: [
					{ title: "Example", url: "https://example.com/a", content: "line1\nline2" },
					{ title: "No URL", content: "dropped" },
				],
			},
			(url, init) => {
				assert.equal(url, "https://api.tavily.com/search");
				assert.equal(init.method, "POST");
				const headers = init.headers as Record<string, string>;
				assert.equal(headers.authorization, "Bearer tvly-throwaway-key-00001");
				const body = JSON.parse(init.body as string);
				assert.equal(body.query, "test query");
				assert.equal(body.max_results, 5);
				// The legacy api_key-in-body form is retired — auth is the header.
				assert.equal(body.api_key, undefined);
			},
		));
		const hits = await provider.search("test query", 5);
		assert.deepEqual(hits, [{ title: "Example", url: "https://example.com/a", snippet: "line1 line2" }]);
	});

	it("maps the {detail:{error}} error body into the message", async () => {
		const provider = tavilyProvider("tvly-throwaway-key-00001", async () =>
			new Response(JSON.stringify({ detail: { error: "Unauthorized: missing or invalid API key." } }), { status: 401 }),
		);
		await assert.rejects(provider.search("q", 5), /Tavily search API 401: Unauthorized/);
	});
});

describe("braveProvider (wire shape per Brave's dashboard docs, verified 2026-09-20)", () => {
	it("GETs res/v1/web/search with the X-Subscription-Token header", async () => {
		const provider = braveProvider("brave-throwaway-key-00001", stubFetch(
			{
				web: {
					results: [
						{ title: "Example", url: "https://example.com/b", description: "a description" },
						{ description: "dropped — no url" },
					],
				},
			},
			(url, init) => {
				assert.ok(url.startsWith("https://api.search.brave.com/res/v1/web/search?"), url);
				assert.ok(url.includes("q=test+query"), url); // URLSearchParams: spaces as +
				assert.ok(url.includes("count=5"));
				const headers = init.headers as Record<string, string>;
				assert.equal(headers["x-subscription-token"], "brave-throwaway-key-00001");
			},
		));
		const hits = await provider.search("test query", 5);
		assert.deepEqual(hits, [{ title: "Example", url: "https://example.com/b", snippet: "a description" }]);
	});

	it("surfaces the HTTP status on failure", async () => {
		const provider = braveProvider("brave-throwaway-key-00001", async () =>
			new Response("rate limited", { status: 429 }),
		);
		await assert.rejects(provider.search("q", 5), /Brave search API 429/);
	});
});
