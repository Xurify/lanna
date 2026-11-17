import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DATA = fs.mkdtempSync(path.join(os.tmpdir(), "lanna-deepl-"));
process.env.LANNA_DATA_DIR = TMP_DATA;
process.env.LANNA_PROFILE = "slovak";
delete process.env.DEEPL_API_KEY;

const { deeplEndpoint } = await import("../src/server/deepl.ts");
const { lookupSelectionAsync } = await import("../src/server/word-bank.ts");
const { translationEngineLabel } = await import("../src/core/translation-engine.ts");

const FREE_KEY = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0:fx";
const realFetch = globalThis.fetch;

interface SeenRequest {
	url: string;
	init?: RequestInit;
}

let seen: SeenRequest[] = [];

function stubFetch(deeplStatus: number, deeplText = "the little mouse"): void {
	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input instanceof Request ? input.url : input);
		seen.push({ url, init });
		if (url.includes("deepl.com")) {
			return new Response(JSON.stringify({ translations: [{ text: deeplText }] }), { status: deeplStatus });
		}
		if (url.includes("translate.googleapis.com")) {
			return new Response(JSON.stringify([[["google says", "x"]]]), { status: 200 });
		}
		return new Response("{}", { status: 500 });
	}) as typeof fetch;
}

beforeEach(() => {
	seen = [];
	delete process.env.DEEPL_API_KEY;
});

after(() => {
	globalThis.fetch = realFetch;
	delete process.env.DEEPL_API_KEY;
	fs.rmSync(TMP_DATA, { recursive: true, force: true });
});

describe("deeplEndpoint", () => {
	it("sends Free keys to the Free host and Pro keys to the Pro host", () => {
		assert.equal(deeplEndpoint(FREE_KEY), "https://api-free.deepl.com/v2/translate");
		assert.equal(deeplEndpoint(FREE_KEY.replace(":fx", "")), "https://api.deepl.com/v2/translate");
	});
});

describe("word lookup with DeepL", () => {
	it("never calls DeepL without a key", async () => {
		stubFetch(200);
		const result = await lookupSelectionAsync("qwzxmyška");
		assert.ok(!seen.some((r) => r.url.includes("deepl.com")));
		assert.equal(result.translatedBy, "google");
	});

	it("asks DeepL first with the profile's language and EN-US, and labels the answer DeepL", async () => {
		process.env.DEEPL_API_KEY = FREE_KEY;
		stubFetch(200);
		const result = await lookupSelectionAsync("qwzxmyšička");
		const deepl = seen.find((r) => r.url.includes("deepl.com"));
		assert.ok(deepl, "DeepL was called");
		assert.equal(deepl.url, "https://api-free.deepl.com/v2/translate");
		const headers = (deepl.init?.headers ?? {}) as Record<string, string>;
		assert.equal(headers.Authorization, `DeepL-Auth-Key ${FREE_KEY}`);
		const body = JSON.parse(String(deepl.init?.body)) as { source_lang: string; target_lang: string };
		assert.equal(body.source_lang, "SK");
		assert.equal(body.target_lang, "EN-US");
		assert.ok(!seen.some((r) => r.url.includes("googleapis")), "Google is not asked once DeepL answered");
		assert.equal(result.googleTranslation, "the little mouse");
		assert.equal(result.translatedBy, "deepl");
	});

	it("falls back to Google when DeepL refuses (quota 456)", async () => {
		process.env.DEEPL_API_KEY = FREE_KEY;
		stubFetch(456);
		const result = await lookupSelectionAsync("qwzxmyšiak");
		assert.ok(seen.some((r) => r.url.includes("deepl.com")));
		assert.equal(result.googleTranslation, "google says");
		assert.equal(result.translatedBy, "google");
	});

	it("re-translates a Google cache entry once a key is set, then serves it from the cache", async () => {
		stubFetch(200);
		const before = await lookupSelectionAsync("qwzxmyšisko");
		assert.equal(before.translatedBy, "google");

		process.env.DEEPL_API_KEY = FREE_KEY;
		seen = [];
		const upgraded = await lookupSelectionAsync("qwzxmyšisko", { includeGoogleTranslate: true });
		assert.equal(upgraded.translatedBy, "deepl");

		seen = [];
		const cached = await lookupSelectionAsync("qwzxmyšisko", { includeGoogleTranslate: true });
		assert.equal(cached.translatedBy, "deepl");
		assert.equal(seen.length, 0, "no second request");
	});
});

describe("translationEngineLabel", () => {
	it("names each engine and does not guess for old cache entries", () => {
		assert.equal(translationEngineLabel("deepl"), "DeepL");
		assert.equal(translationEngineLabel("google"), "Google");
		assert.equal(translationEngineLabel(undefined), "Translator");
	});
});
