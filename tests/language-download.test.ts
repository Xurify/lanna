/**
 * READING A DOWNLOAD IN SLICES (2026-11-05): the parser yields to the server
 * every few kilobytes, so a line cut by a slice or by a network chunk must
 * come out whole, once, in order.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-language-download-"));
process.env.LANNA_DATA_DIR = dir;
delete process.env.LANNA_PROFILE;

const { lines } = await import("../src/server/language-add.ts");

/** A response whose body arrives in pieces of `chunk` bytes. */
function body(text: string, chunk: number): Response {
	const bytes = new TextEncoder().encode(text);
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.subarray(i, i + chunk));
			controller.close();
		},
	});
	return new Response(stream);
}

async function collect(text: string, chunk: number): Promise<string[]> {
	const get = (async () => body(text, chunk)) as unknown as typeof fetch;
	const out: string[] = [];
	for await (const line of lines(get, "https://example.test/download", new AbortController().signal, {
		what: "the test download",
	}))
		out.push(line);
	return out;
}

describe("reading a download in slices", () => {
	test("every line comes out once, whole and in order, however the chunks and slices fall", async () => {
		const rows = Array.from({ length: 1500 }, (_, i) => `${i}\tkaikki ${"é".repeat(i % 40)} ${i}`);
		const text = rows.map((row, i) => (i % 3 === 0 ? `${row}\r\n` : `${row}\n`)).join("");
		assert.ok(new TextEncoder().encode(text).length > 16 * 1024, "long enough for several slices");
		for (const chunk of [7, 4096, 1 << 20]) {
			assert.deepEqual(await collect(text, chunk), rows, `chunk of ${chunk} bytes`);
		}
	});

	test("a last line without a newline is still a line", async () => {
		assert.deepEqual(await collect("a\nb", 2), ["a", "b"]);
	});
});
