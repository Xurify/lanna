import assert from "node:assert/strict";
import fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";

process.env.LH_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "lh-tts-retries-"));

const { withRetries } = await import("../src/server/tts.ts");

function failingTimes(failures: number) {
	let calls = 0;
	const run = async () => {
		calls++;
		if (calls <= failures) throw new Error(`stream closed ${calls}`);
		return "audio";
	};
	return { run, calls: () => calls };
}

describe("withRetries", () => {
	it("returns the first success without more tries", async () => {
		const f = failingTimes(0);
		assert.equal(await withRetries(f.run, 4, 0), "audio");
		assert.equal(f.calls(), 1);
	});

	it("tries again after a dropped stream", async () => {
		const f = failingTimes(3);
		assert.equal(await withRetries(f.run, 4, 0), "audio");
		assert.equal(f.calls(), 4);
	});

	it("gives up after the limit with the last error", async () => {
		const f = failingTimes(10);
		await assert.rejects(withRetries(f.run, 4, 0), /stream closed 4/);
		assert.equal(f.calls(), 4);
	});
});
